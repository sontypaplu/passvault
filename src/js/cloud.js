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


function resetCloudUserState() {
  ++cloud.epoch;
  clearTimeout(cloud.saveTimer);
  clearTimeout(cloud.retryTimer);
  cloud.saveTimer = null;
  cloud.retryTimer = null;
  cloud.retryAttempt = 0;
  cloud.lastSaveError = '';
  cloud.autoLockDeferred = false;
  if (!state.locked) lockVault('Account signed out');
  try { sessionStorage.removeItem('passvault-account-last-active'); } catch {}
  cloud.userId = null; cloud.email = ''; cloud.loaded = false;
  cloud.vaults = []; cloud.selectedVaultId = null; cloud.vaultLabel = '';
  cloud.revision = 0; cloud.conflict = false; cloud.encryptedEnvelope = null;
  cloud.importSource = 'cloud'; state.pendingImport = null;
  clearSensitiveFieldsEverywhere(); uiState.accessGranted = false;
  cloudStatus('CLOUD'); setActiveView();
}

async function loadAccountVault(session) {
  if (window.PassVaultAuth?.recoveryPending) return;
  if (!session?.user?.id) { resetCloudUserState(); return; }
  const userId = session.user.id;
  if (cloud.userId === userId) return;
  if (cloud.userId) resetCloudUserState();
  const requestEpoch = ++cloud.epoch;
  cloud.userId = userId; cloud.email = session.user.email || 'Account';
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
    setActiveView(); renderVaultDashboard(); cloudStatus('SYNC READY');
    setGlobalStatus('Your encrypted vaults are ready.', 'success');
  } catch(error) {
    if (requestEpoch !== cloud.epoch) return;
    cloud.loaded = false; cloudStatus('LOAD FAILED','error');
    setGlobalStatus('Cannot list vaults: '+(error.message||'Network error'), 'error');
    renderVaultDashboard();
  }
}

const ACCOUNT_IDLE_LIMIT_MS=15*60*1000;
let idleSignOutPending=false;
function updateAccountInactivity(){
 if(!cloud.userId || idleSignOutPending)return;
 if(Date.now()-state.lastActivity<ACCOUNT_IDLE_LIMIT_MS)return;
 if(state.dirty){
  // Never discard the only decrypted copy of unsynced changes. Reuse the
  // existing warning/retry flow and sign out once cloud synchronization succeeds.
  if(!cloud.autoLockDeferred){cloud.autoLockDeferred=true;setGlobalStatus('Sign-out deferred: unsynced vault changes need a successful save or encrypted backup before logging out.','error');window.pvRenderApprovedStatus?.();}
  if(!state.locked && !cloud.conflict && !cloud.savePromise && !cloud.saveTimer && !cloud.retryTimer && navigator.onLine && !document.hidden)void saveCloudVault();
  return;
 }
 idleSignOutPending=true;
 // Immediately clear decrypted state before awaiting the network, and then
 // revoke this session's refresh token via Supabase local sign-out.
 if(!state.locked)lockVault('Account signed out after 15 minutes of inactivity.');
 void cloud.client.auth.signOut({scope:'local'}).then(({error})=>{
   if(error)throw error;
   resetCloudUserState();
 }).catch(error=>{
   // Fail closed locally on network outage; only remote revocation is unverified.
   try { const project=new URL(SUPABASE_URL).hostname.split('.')[0]; sessionStorage.removeItem('sb-'+project+'-auth-token'); } catch {}
   resetCloudUserState();
   setStatus(els.accessStatus,'Account timed out. Sign in again. Server-side token revocation could not be confirmed: '+(error.message||'Network error'),'warning');
 }).finally(()=>{idleSignOutPending=false;});
}
async function handleSignOut() {
  if (!cloud.client) return;
  if (state.dirty && !window.confirm("Unsynced changes may be lost. Download a backup before signing out. Continue?")) return;
  try {
    const { error } = await cloud.client.auth.signOut({ scope: "local" });
    if (error) throw error;
    resetCloudUserState();
  } catch (error) {
    setGlobalStatus("Could not sign out: " + error.message, "error");
  }
}

function scheduleCloudRetry() {
  if (cloud.retryTimer || cloud.conflict || state.locked || !state.dirty || !cloud.userId) return;
  const delay = Math.min(60000, 5000 * (2 ** Math.min(4, cloud.retryAttempt++)));
  cloud.retryTimer = setTimeout(() => {
    cloud.retryTimer = null;
    if (state.locked || !state.dirty || cloud.conflict) return;
    if (document.hidden || !navigator.onLine) return; // online/visibility triggers below
    void saveCloudVault();
  }, delay);
}
function retryUnsavedVaultOnReturn() {
  if (!state.dirty || state.locked || cloud.conflict || !cloud.lastSaveError || !navigator.onLine || document.hidden) return;
  clearTimeout(cloud.retryTimer);cloud.retryTimer=null;
  void saveCloudVault();
}
window.addEventListener('online', retryUnsavedVaultOnReturn);
document.addEventListener('visibilitychange', retryUnsavedVaultOnReturn);
function scheduleCloudSave() {
  if (!cloud.client || !cloud.userId || !cloud.selectedVaultId || !cloud.loaded || cloud.conflict || !state.vault || !state.vaultKey) return;
  clearTimeout(cloud.saveTimer);
  clearTimeout(cloud.retryTimer);cloud.retryTimer=null;
  cloud.saveTimer = setTimeout(() => { void saveCloudVault(); }, 1100);
}

async function saveCloudVault(manual = false) {
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
      if (saveUser !== cloud.userId || saveEpoch !== cloud.epoch || saveVaultId !== cloud.selectedVaultId) return false;
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
      if (cloud.mutation === saveMutation) setDirty(false);
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
    if (state.dirty && !cloud.conflict && cloud.mutation > 0 && cloud.loaded && !state.locked && cloud.userId) {
      // Auto-resave ONLY when edits arrived while a successful save was in flight.
      // A failed network save must be retried explicitly, not in an infinite loop.
      if (els.cloudSyncStatus.textContent === "SAVED") scheduleCloudSave();
    }
  }
}

