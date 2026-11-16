/* Vault sync preference affects encrypted vault uploads only; account authentication still uses Supabase. */
function syncPreferenceKey(userId) { return 'passvault-vault-sync-v1:' + userId; }
function initializeSyncPreference(userId) {
  try { cloud.syncEnabled = localStorage.getItem(syncPreferenceKey(userId)) !== 'off'; }
  catch {
    // Fail closed if preference storage is unavailable: never assume upload consent.
    cloud.syncEnabled = false;
  }
  cloud.deviceOnly = false;
  cloud.lastBackup = null;
  window.dispatchEvent(new Event('passvault-sync-change'));
}
function isCloudSyncAllowed() { return cloud.syncEnabled && !cloud.deviceOnly && !String(cloud.selectedVaultId || '').startsWith('device-'); }
function setCloudSyncEnabled(enabled) {
  if (!cloud.userId) return false;
  if (enabled && cloud.deviceOnly) {
    setGlobalStatus('This imported vault is device-only. Export an encrypted backup and lock it before switching to a cloud vault.', 'warning');
    window.dispatchEvent(new Event('passvault-sync-change'));
    return false;
  }
  const hadInFlightSave = Boolean(cloud.savePromise);
  cloud.syncEnabled = Boolean(enabled);
  clearTimeout(cloud.saveTimer); cloud.saveTimer = null;
  clearTimeout(cloud.retryTimer); cloud.retryTimer = null;
  try { localStorage.setItem(syncPreferenceKey(cloud.userId), enabled ? 'on' : 'off'); }
  catch {
    setGlobalStatus('Cloud sync preference could not be saved in this browser. Sync is set for this session only; check it again after restarting before editing.', 'error');
  }
  window.dispatchEvent(new Event('passvault-sync-change'));
  if (enabled && state.dirty && !cloud.deviceOnly) scheduleCloudSave();
  setGlobalStatus(enabled
    ? 'Cloud sync enabled for cloud vaults. Pending cloud-vault edits may be uploaded.'
    : hadInFlightSave ? 'Cloud sync paused for future saves. A previously started upload may still finish. Export an encrypted backup.' : 'Cloud sync paused. Previously uploaded data stays in the cloud. Export an encrypted backup to preserve new changes.', 'warning');
  return true;
}
window.PassVaultSync = Object.freeze({ setEnabled: setCloudSyncEnabled, allowed: isCloudSyncAllowed });

function isCloudConfigured() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL) &&
    SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_") &&
    !SUPABASE_PUBLISHABLE_KEY.includes("REPLACE");
}

function cloudStatus(message, kind = "") {
  if (!els.cloudSyncStatus) return;
  els.cloudSyncStatus.textContent = message;
  els.cloudSyncStatus.classList.toggle("unsaved", kind === "warning" || kind === "error");
}

async function handleAccountLogin(event) {
  event.preventDefault();
  if (!cloud.client) return setStatus(els.accessStatus, "Configure the Supabase URL and publishable key first.", "error");
  const email = els.accessEmail.value.trim();
  const password = els.accessPassword.value;
  els.accessSubmit.disabled = true;
  els.registerAccountButton.disabled = true;
  try {
    const { error } = await cloud.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setStatus(els.accessStatus, "Signed in. Loading encrypted cloud vault…", "success");
  } catch (error) {
    setStatus(els.accessStatus, error.message || "Sign-in failed.", "error");
  } finally {
    els.accessPassword.value = "";
    els.accessSubmit.disabled = false;
    els.registerAccountButton.disabled = false;
  }
}


async function resetCloudUserState() {
  if ($('pvOfflineExitDialog')?.open) $('pvExitCancel').click(); // A timed-out session must not leave a stale backup dialog.
  // An auth event can arrive during an unsynced edit. Preserve the same
  // encrypted-only recovery rule before clearing account/vault state.
  if (!state.locked) await secureLockWithCheckpoint('Account session ended.');
  ++cloud.epoch;
  clearTimeout(cloud.saveTimer);
  clearTimeout(cloud.retryTimer);
  cloud.saveTimer = null;
  cloud.retryTimer = null;
  cloud.retryAttempt = 0;
  cloud.lastSaveError = '';
  cloud.autoLockDeferred = false;
  cloud.restoredRecoveryKey = null;
  if (!state.locked) lockVault('Account signed out');
  try { sessionStorage.removeItem('passvault-account-last-active'); } catch {}
  cloud.userId = null; cloud.email = ''; cloud.loaded = false;
  cloud.vaults = []; cloud.selectedVaultId = null; cloud.vaultLabel = '';
  cloud.revision = 0; cloud.conflict = false; cloud.encryptedEnvelope = null;
  cloud.importSource = 'cloud'; cloud.deviceOnly = false; cloud.lastBackup = null; state.pendingImport = null;
  clearSensitiveFieldsEverywhere(); uiState.accessGranted = false;
  cloudStatus('CLOUD'); setActiveView();
}

async function loadAccountVault(session) {
  if (window.PassVaultAuth?.recoveryPending) return;
  if (!session?.user?.id) { await resetCloudUserState(); return; }
  const userId = session.user.id;
  if (cloud.userId === userId) return;
  if (cloud.userId) await resetCloudUserState();
  const requestEpoch = ++cloud.epoch;
  cloud.userId = userId; cloud.email = session.user.email || 'Account';
  initializeSyncPreference(userId);
  // A fresh login begins the 15-minute account idle clock. A restored tab
  // retains its previous clock rather than gaining another 15 minutes.
  try { if(!sessionStorage.getItem('passvault-account-last-active'))markActivity(); } catch { markActivity(); }
  cloud.loaded = false; cloud.vaults = []; cloud.selectedVaultId = null;
  cloud.revision = 0; cloud.conflict = false;cloud.lastSaveError='';cloud.retryAttempt=0;
  uiState.accessGranted = true; uiState.accessScreen = 'dashboard';
  els.signedInIdentity.textContent = cloud.email;
  cloudStatus('LOADING'); setActiveView();
  try {
    await reloadVaultList();
    if (requestEpoch !== cloud.epoch || cloud.userId !== userId) return;
    cloud.loaded = true;
    setActiveView(); renderVaultDashboard(); cloudStatus(cloud.syncEnabled ? 'SYNC READY' : 'SYNC PAUSED');
    setGlobalStatus('Your encrypted vaults are ready.', 'success');
  } catch(error) {
    if (requestEpoch !== cloud.epoch) return;
    cloud.loaded = false; cloudStatus('LOAD FAILED','error');
    setGlobalStatus('Cannot list vaults: '+(error.message||'Network error'), 'error');
    renderVaultDashboard();
  }
}

const ACCOUNT_IDLE_LIMIT_MS = 15 * 60 * 1000;
let idleSignOutPending = false;
async function updateAccountInactivity() {
  if (!cloud.userId || idleSignOutPending) return;
  if (Date.now() - state.lastActivity < ACCOUNT_IDLE_LIMIT_MS) return;
  idleSignOutPending = true;
  try {
    // Encrypt any pending edits, clear unlocked memory, THEN contact the
    // network. Network errors must never leave the vault readable.
    await secureLockWithCheckpoint('Account signed out after 15 minutes of inactivity.');
    if (!cloud.client) return;
    const { error } = await cloud.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    await resetCloudUserState();
  } catch (error) {
    try {
      const project = new URL(SUPABASE_URL).hostname.split('.')[0];
      sessionStorage.removeItem('sb-' + project + '-auth-token');
    } catch {}
    await resetCloudUserState();
    setStatus(els.accessStatus,
      'Session timed out. Sign in again. Remote refresh-token revocation could not be confirmed.', 'warning');
  } finally { idleSignOutPending = false; }
}
let signOutBackupPrompt = null;
function currentEncryptedBackupReady() {
  return !!cloud.lastBackup && cloud.lastBackup.userId === cloud.userId &&
    cloud.lastBackup.vaultId === cloud.selectedVaultId &&
    cloud.lastBackup.mutation === cloud.mutation &&
    !!els.downloadVaultLink.dataset.objectUrl;
}
function confirmBackupBeforeSignOut() {
  if (state.locked || !state.dirty) return Promise.resolve(true);
  if (signOutBackupPrompt) return signOutBackupPrompt;
  const dialog = $('pvOfflineExitDialog');
  const link = $('pvExitBackupDownloadLink');
  const ack = $('pvExitBackupAcknowledged');
  const confirmButton = $('pvExitConfirm');
  const status = $('pvExitBackupStatus');
  ack.checked = false;
  $('pvExitBackupHelp').open = false;
  let preparing = false;
  const refresh = () => {
    const ready = currentEncryptedBackupReady();
    link.hidden = !ready;
    $('pvExitBackupHelp').hidden = !ready;
    if (ready) { link.href = els.downloadVaultLink.href; link.download = els.downloadVaultLink.download; }
    else { link.removeAttribute('href'); link.removeAttribute('download'); }
    ack.disabled = !ready;
    confirmButton.disabled = !ready || !ack.checked;
    status.textContent = ready
      ? 'Backup download requested. Check your Downloads or Files app. If nothing downloaded, expand “Download didn\'t start?” to save it manually. Confirm only after checking the file.'
      : 'Download the latest encrypted backup before signing out. Verify it is saved on your device.';
  };
  refresh();
  signOutBackupPrompt = new Promise(resolve => {
    const finish = approved => {
      dialog.removeEventListener('cancel', onCancel);
      $('pvExitPrepareBackup').removeEventListener('click', onPrepare);
      $('pvExitCancel').removeEventListener('click', onCancelClick);
      $('pvExitConfirm').removeEventListener('click', onConfirm);
      ack.removeEventListener('change', refresh);
      if (dialog.open) dialog.close();
      signOutBackupPrompt = null;
      resolve(approved);
    };
    const onCancel = event => { event.preventDefault(); finish(false); };
    const onCancelClick = () => finish(false);
    const onConfirm = () => {
      if (!preparing && currentEncryptedBackupReady() && ack.checked) finish(true);
    };
    const onPrepare = async () => {
      if (preparing) return;
      preparing = true;
      $('pvExitPrepareBackup').disabled = true;
      try { await handleExportVault(); }
      finally { preparing = false; $('pvExitPrepareBackup').disabled = false; refresh(); }
    };
    dialog.addEventListener('cancel', onCancel);
    $('pvExitPrepareBackup').addEventListener('click', onPrepare);
    $('pvExitCancel').addEventListener('click', onCancelClick);
    $('pvExitConfirm').addEventListener('click', onConfirm);
    ack.addEventListener('change', refresh);
    dialog.showModal();
  });
  return signOutBackupPrompt;
}
async function handleSignOut() {
  if (!cloud.client) return;
  if (!await confirmBackupBeforeSignOut()) return;
  // Signing out always locks immediately. Unsaved changes are encrypted into
  // an on-device recovery snapshot first, rather than abandoned.
  await secureLockWithCheckpoint('Vault locked before account sign-out.');
  try {
    const { error } = await cloud.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    await resetCloudUserState();
  } catch (error) {
    setGlobalStatus('Could not revoke remote session. Your vault is locked locally; retry sign-out. ' + (error.message || ''), 'error');
  }
}

function scheduleCloudRetry() {
  if (!isCloudSyncAllowed() || cloud.retryTimer || cloud.conflict || state.locked || !state.dirty || !cloud.userId) return;
  const delay = Math.min(60000, 5000 * (2 ** Math.min(4, cloud.retryAttempt++)));
  cloud.retryTimer = setTimeout(() => {
    cloud.retryTimer = null;
    if (state.locked || !state.dirty || cloud.conflict) return;
    if (document.hidden || !navigator.onLine) return; // online/visibility triggers below
    void saveCloudVault();
  }, delay);
}
function retryUnsavedVaultOnReturn() {
  if (!isCloudSyncAllowed() || !state.dirty || state.locked || cloud.conflict || !cloud.lastSaveError || !navigator.onLine || document.hidden) return;
  clearTimeout(cloud.retryTimer);cloud.retryTimer=null;
  void saveCloudVault();
}
window.addEventListener('online', retryUnsavedVaultOnReturn);
document.addEventListener('visibilitychange', retryUnsavedVaultOnReturn);
function scheduleCloudSave() {
  if (!isCloudSyncAllowed() || !cloud.client || !cloud.userId || !cloud.selectedVaultId || !cloud.loaded || cloud.conflict || !state.vault || !state.vaultKey) return;
  clearTimeout(cloud.saveTimer);
  clearTimeout(cloud.retryTimer);cloud.retryTimer=null;
  cloud.saveTimer = setTimeout(() => { void saveCloudVault(); }, 1100);
}

async function saveCloudVault(manual = false) {
  if (!isCloudSyncAllowed()) {
    if (manual) setGlobalStatus('Cloud sync is off for this vault. Download an encrypted backup to keep changes.', 'warning');
    return false;
  }
  if (!cloud.client || !cloud.userId || !cloud.selectedVaultId || !cloud.loaded || state.locked || !state.vaultKey || !state.vault) {
    if (manual) setGlobalStatus("Sign in and unlock your vault first.", "error");
    return false;
  }
  if (cloud.conflict) {
    setGlobalStatus("Save blocked: a newer cloud version exists. Download a backup of this version, then reload and reconcile changes.", "error");
    return false;
  }
  if (cloud.savePromise) return cloud.savePromise;
  clearTimeout(cloud.saveTimer);
  cloud.saveTimer = null;
  cloud.savePromise = (async () => {
    const saveUser = cloud.userId;
    const saveVaultId = cloud.selectedVaultId;
    const saveEpoch = cloud.epoch;
    const saveMutation = cloud.mutation;
    cloud.saveInProgress = true;
    cloudStatus("SAVING…", "warning");
    try {
      state.vault.updatedAt = new Date().toISOString();
      const envelope = await encryptAndBuildEnvelope();
      if (!isCloudSyncAllowed() || saveUser !== cloud.userId || saveEpoch !== cloud.epoch || saveVaultId !== cloud.selectedVaultId) return false;
      const { data: nextRevision, error } = await cloud.client.rpc("save_multi_vault", {
        p_vault_id: saveVaultId,
        p_label: cloud.vaultLabel,
        p_encrypted_vault: envelope,
        p_expected_revision: cloud.revision
      });
      if (error) throw error;
      if (saveEpoch !== cloud.epoch || saveUser !== cloud.userId || saveVaultId !== cloud.selectedVaultId) return false;
      cloud.revision = Number(nextRevision);
      cloud.encryptedEnvelope = envelope;
      void reloadVaultList().then(renderVaultDashboard).catch(()=>{});
      if (!Number.isSafeInteger(cloud.revision) || cloud.revision < 1) throw new Error("Invalid revision returned by cloud.");
      cloud.lastSaveError = '';
      cloud.autoLockDeferred = false;
      cloud.retryAttempt = 0;
      clearTimeout(cloud.retryTimer);
      cloud.retryTimer = null;
      if (cloud.mutation === saveMutation) {
        setDirty(false);
        deleteEncryptedRecovery(saveUser, saveVaultId);
      }
      cloudStatus("SAVED");
      setGlobalStatus(cloud.mutation === saveMutation ? "Encrypted vault saved to cloud." : "Cloud saved an earlier version; saving recent edits next…", "success");
      return true;
    } catch (error) {
      const message = String(error.message || "Cloud save failed.");
      if (error.code === '23514' || message.includes('vault_limit_reached')) {
        cloud.conflict = true;
        cloudStatus('VAULT LIMIT', 'error');
        cloud.lastSaveError = 'Vault limit reached. This vault was NOT saved. Download an encrypted backup before leaving.';
        setGlobalStatus(cloud.lastSaveError, 'error');
      } else if (error.code === "40001" || message.includes("vault_conflict") || error.code === "23505") {
        cloud.conflict = true;
        cloudStatus("SYNC CONFLICT", "error");
        cloud.lastSaveError = "Cloud conflict: another device has a newer saved vault. Download an encrypted backup; this tab will not overwrite it.";
        setGlobalStatus(cloud.lastSaveError, "error");
      } else {
        cloudStatus("NOT SAVED", "error");
        cloud.lastSaveError = "Cloud save failed; changes are only in memory. Download an encrypted backup before closing. " + message;
        setGlobalStatus(cloud.lastSaveError, "error");
        scheduleCloudRetry();
      }
      return false;
    } finally {
      cloud.saveInProgress = false;
    }
  })();
  try { return await cloud.savePromise; }
  finally {
    cloud.savePromise = null;
    if (isCloudSyncAllowed() && state.dirty && !cloud.conflict && cloud.mutation > 0 && cloud.loaded && !state.locked && cloud.userId) {
      // Auto-resave ONLY when edits arrived while a successful save was in flight.
      // A failed network save must be retried explicitly, not in an infinite loop.
      if (els.cloudSyncStatus.textContent === "SAVED") scheduleCloudSave();
    }
  }
}

