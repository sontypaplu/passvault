/* Encrypted-only recovery for a failed cloud save. The existing vault key,
 * Argon2id settings and AES-GCM envelope are used unchanged. No plaintext,
 * pepper or CryptoKey is ever written to browser storage. */
const PV_RECOVERY_PREFIX = 'passvault-encrypted-recovery-v1:';
const PV_RECOVERY_TAB_ID = (() => {
  try {
    let value = sessionStorage.getItem('passvault-recovery-tab-id');
    if (!/^[0-9a-f-]{36}$/i.test(value || '')) {
      value = crypto.randomUUID();
      sessionStorage.setItem('passvault-recovery-tab-id', value);
    }
    return value;
  } catch { return crypto.randomUUID(); }
})();
function recoveryStoragePrefix(userId = cloud.userId, vaultId = cloud.selectedVaultId) {
  return userId && vaultId ? PV_RECOVERY_PREFIX + userId + ':' + vaultId + ':' : null;
}
function recoveryStorageKey(userId = cloud.userId, vaultId = cloud.selectedVaultId) {
  const prefix = recoveryStoragePrefix(userId, vaultId);
  return prefix && prefix + PV_RECOVERY_TAB_ID;
}
function readEncryptedRecovery(userId = cloud.userId, vaultId = cloud.selectedVaultId) {
  const prefix = recoveryStoragePrefix(userId, vaultId);
  if (!prefix) return null;
  let newest = null;
  try {
    // Separate copies for separate tabs prevent one tab from overwriting
    // another tab's unsynced edits. Only the newest copy is offered here.
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const raw = localStorage.getItem(key);
      if (!raw || raw.length > MAX_VAULT_TEXT_BYTES * 2) continue;
      const candidate = JSON.parse(raw);
      if (candidate?.version !== 1 || candidate.userId !== userId ||
          candidate.vaultId !== vaultId || !Number.isSafeInteger(candidate.revision) ||
          candidate.revision < 0 || !Number.isSafeInteger(candidate.savedAt) ||
          !candidate.envelope || typeof candidate.envelope !== 'object') continue;
      if (!newest || candidate.savedAt > newest.savedAt) newest = {...candidate, storageKey: key};
    }
  } catch { return null; }
  return newest;
}
function listUnsyncedNewVaultRecoveries(userId = cloud.userId) {
  if (!userId) return [];
  const seen = new Map();
  try {
    const prefix = PV_RECOVERY_PREFIX + userId + ':';
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(prefix)) continue;
      const parts = key.slice(prefix.length).split(':');
      // Keep legacy UUID recoveries readable while allowing new reserved device- IDs.
      if (parts.length !== 2 || !/^(?:device-)?[0-9a-f-]{36}$/i.test(parts[0])) continue;
      const draft = readEncryptedRecovery(userId, parts[0]);
      if (!draft || draft.revision !== 0) continue;
      const previous = seen.get(draft.vaultId);
      if (!previous || draft.savedAt > previous.savedAt) seen.set(draft.vaultId,draft);
    }
  } catch {}
  return [...seen.values()];
}
function purgeEncryptedRecoveriesForContext(userId, vaultId = null) {
  // Irreversible account/vault deletion must also remove encrypted device
  // checkpoints, even if the user did not restore them in this browser tab.
  const prefix = vaultId
    ? recoveryStoragePrefix(userId, vaultId)
    : (userId ? PV_RECOVERY_PREFIX + userId + ':' : null);
  if (!prefix) return;
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) localStorage.removeItem(key);
    }
  } catch {}
  cloud.restoredRecoveryKey = null;
}
function deleteEncryptedRecovery(userId, vaultId) {
  // Successful cloud saves must not delete unsynced snapshots belonging to
  // another tab, unless the user explicitly restored that snapshot here.
  const currentKey = recoveryStorageKey(userId, vaultId);
  for (const key of [currentKey, cloud.restoredRecoveryKey]) {
    if (key && key.startsWith(recoveryStoragePrefix(userId, vaultId))) {
      try { localStorage.removeItem(key); } catch {}
    }
  }
  cloud.restoredRecoveryKey = null;
}
async function secureLockWithCheckpoint(reason = 'Vault locked for security.') {
  if (state.locked) return true;
  if (cloud.secureLockPromise) return cloud.secureLockPromise;
  // Prevent any view/edit of decrypted data while an asynchronous Web Crypto
  // checkpoint is being encrypted. This must happen before the first await.
  document.documentElement.classList.add('pv-secure-lock-pending');
  if (els.unlockedView) els.unlockedView.inert = true;
  const wasDirty = state.dirty;
  const userId = cloud.userId, vaultId = cloud.selectedVaultId;
  const revision = cloud.revision;
  cloud.secureLockPromise = (async () => {
    let stored = !wasDirty;
    try {
      if (wasDirty) {
        if (!userId || !vaultId || !state.vault || !state.vaultKey || !state.vaultMeta)
          throw new Error('Missing vault context');
        const envelope = await encryptAndBuildEnvelope();
        if (cloud.userId !== userId || cloud.selectedVaultId !== vaultId || state.locked)
          throw new Error('Vault changed while protecting pending edits');
        // localStorage can fail (private mode/quota/disabled). In this case
        // confidentiality still wins over keeping the unlocked vault alive.
        if (state.dirty) {
          localStorage.setItem(recoveryStorageKey(userId, vaultId), JSON.stringify({
            version: 1, userId, vaultId, revision, deviceOnly: Boolean(cloud.deviceOnly), savedAt: Date.now(), envelope
          }));
        }
        stored = true;
      }
    } catch (error) {
      // Do not surface exception details or any secret-bearing data in the UI.
      stored = false;
    } finally {
      if (!state.locked) lockVault(reason);
      document.documentElement.classList.remove('pv-secure-lock-pending');
      if (els.unlockedView) els.unlockedView.inert = false;
    }
    if (wasDirty) {
      setGlobalStatus(stored
        ? 'Session locked. Unsynced changes are stored as an encrypted recovery copy on this device. Unlock this vault to restore them.'
        : 'Session locked for security. Local encrypted recovery failed; unsynced changes may be lost. Check your encrypted backups.', stored ? 'warning' : 'error');
    }
    return stored;
  })();
  try { return await cloud.secureLockPromise; }
  finally { cloud.secureLockPromise = null; }
}
async function offerEncryptedRecovery(originalEnvelope, key, userId, vaultId) {
  const pending = readEncryptedRecovery(userId, vaultId);
  if (!pending) return false;
  if (cloud.importSource === 'file') {
    setGlobalStatus('An encrypted local recovery copy exists for this vault. Open the cloud version to restore it; the copy remains on this device.', 'warning');
    return false;
  }
  // A recovery copy for a different KDF/salt is not silently substituted.
  if (pending.envelope.salt !== originalEnvelope.salt ||
      pending.envelope.kdf !== originalEnvelope.kdf) {
    setGlobalStatus('An encrypted local recovery copy exists but uses different key settings. It has been retained for manual review.', 'warning');
    return false;
  }
  if (!window.confirm('Unsynced encrypted changes were found on this device. Restore those changes after unlocking? They will only sync if the cloud revision still matches. Select Cancel to leave the recovery copy untouched.')) {
    setGlobalStatus('Local encrypted recovery copy retained. The cloud vault is open.', 'warning');
    return false;
  }
  let recovered;
  try { recovered = await decryptVaultPayload(pending.envelope, key); }
  catch {
    setGlobalStatus('Local recovery copy could not be authenticated. Cloud data is unchanged; the encrypted copy was retained.', 'error');
    return false;
  }
  if (cloud.userId !== userId || cloud.selectedVaultId !== vaultId)
    return false;
  state.vault = recovered;
  cloud.restoredRecoveryKey = pending.storageKey;
  if (pending.revision !== cloud.revision) {
    cloud.conflict = true;
    setDirty(true);
    cloudStatus('RECOVERY CONFLICT','error');
    setGlobalStatus('Recovered local changes, but the cloud has a different revision. Do NOT overwrite it. Export an encrypted backup and reconcile the versions.', 'error');
  } else {
    setDirty(true);
    setGlobalStatus('Encrypted recovery copy restored. Pending cloud synchronization; keep an encrypted backup until SAVED.', 'warning');
  }
  return true;
}

function setDirty(value) {
  state.dirty = Boolean(value);
  els.dirtyStatus.classList.toggle("hidden", !state.dirty);
  if (state.dirty) {
    cloudStatus("UNSAVED", "warning");
    ++cloud.mutation;
    if (isCloudSyncAllowed()) scheduleCloudSave();
  }
}

function markActivity() {
  if (cloud.secureLockPromise) return;
  const now = Date.now();
  // A first click after a throttled/background tab must not renew an expired
  // authenticated session before the inactivity watcher gets a chance to run.
  if (cloud.userId && now - state.lastActivity >= ACCOUNT_IDLE_LIMIT_MS) {
    updateAccountInactivity();
    return;
  }
  state.lastActivity = now;
  if (cloud.userId) {
    try { sessionStorage.setItem('passvault-account-last-active', String(now)); } catch {}
  }
}

function validateCredentialDraft() {
  const title = els.credentialTitle.value.trim();
  const url = els.credentialUrl.value.trim();
  const username = els.credentialUsername.value;
  const password = els.credentialPassword.value;
  const notes = els.credentialNotes.value;

  if (!title) throw new Error("Website / Application is required.");
  if (!username) throw new Error("Username / Email is required.");
  if (!password) throw new Error("Password is required.");
  if (url) {
    window.PassVaultURLSafety.validate(url);
  }

  if (title.length > 256 || username.length > 512 || password.length > 2048 || notes.length > 4096 || url.length > 2048) {
    throw new Error("One or more credential fields exceed the permitted length.");
  }

  return { title, url, username, password, notes };
}

function resetCredentialEditor() {
  state.editingId = null;
  els.editingCredentialId.value = "";
  els.editorTitle.textContent = "Add Credential";
  els.credentialTitle.value = "";
  els.credentialUrl.value = "";
  els.credentialUsername.value = "";
  els.credentialNotes.value = "";
  clearCredentialFormSensitive();
  clearStatus(els.credentialStatus);
}

function beginEditCredential(id) {
  const credential = state.vault?.credentials.find((item) => item.id === id);
  if (!credential) return;
  state.editingId = id;
  els.editingCredentialId.value = id;
  els.editorTitle.textContent = "Edit Credential";
  els.credentialTitle.value = credential.title;
  els.credentialUrl.value = credential.url;
  els.credentialUsername.value = credential.username;
  els.credentialPassword.value = credential.password;
  els.credentialPassword.type = "password";
  els.toggleCredentialPassword.textContent = "Show";
  els.credentialNotes.value = credential.notes;
  clearStatus(els.credentialStatus);
  els.credentialEditorCard.scrollIntoView({ behavior: "auto", block: "start" });
}

function renderCredentialList() {
  els.credentialList.textContent = "";
  if (!state.vault) return;

  const query = els.credentialSearch.value.trim().toLowerCase();
  const filtered = state.vault.credentials.filter((credential) => {
    if (!query) return true;
    return [credential.title, credential.url, credential.username, credential.notes]
      .some((value) => value.toLowerCase().includes(query));
  });

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = state.vault.credentials.length === 0
      ? "No credentials yet. Add your first credential below."
      : "No credentials match the current search.";
    els.credentialList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const credential of filtered) {
    const item = document.createElement("article");
    item.className = "credential-item";

    const main = document.createElement("div");
    main.className = "credential-main";

    const details = document.createElement("div");
    const title = document.createElement("h3");
    title.className = "credential-title";
    title.textContent = credential.title;

    const user = document.createElement("div");
    user.className = "credential-user";
    user.textContent = credential.username;
    details.append(title, user);

    if (credential.url) {
      const url = document.createElement("div");
      url.className = "credential-url";
      url.textContent = credential.url;
      details.appendChild(url);
    }

    if (credential.notes) {
      const note = document.createElement("div");
      note.className = "hint";
      note.textContent = credential.notes;
      details.appendChild(note);
    }

    const actions = document.createElement("div");
    actions.className = "credential-actions";

    const copyButton = makeActionButton("Copy", "secondary");
    copyButton.addEventListener("click", () => copyPasswordValue(credential.password, copyButton));

    const editButton = makeActionButton("Edit", "secondary");
    editButton.addEventListener("click", () => beginEditCredential(credential.id));

    const deleteButton = makeActionButton("Delete", "danger");
    deleteButton.addEventListener("click", () => deleteCredential(credential.id));

    actions.append(copyButton, editButton, deleteButton);
    main.append(details, actions);

    const secretRow = document.createElement("div");
    secretRow.className = "credential-secret";
    const secretInput = document.createElement("input");
    secretInput.type = "password";
    secretInput.readOnly = true;
    secretInput.autocomplete = "off";
    secretInput.spellcheck = false;
    secretInput.value = credential.password;
    secretInput.className = "mono";

    const revealButton = makeActionButton("Show", "secondary");
    revealButton.addEventListener("click", () => {
      const show = secretInput.type === "password";
      secretInput.type = show ? "text" : "password";
      revealButton.textContent = show ? "Hide" : "Show";
    });

    secretRow.append(secretInput, revealButton);
    item.append(main, secretRow);
    fragment.appendChild(item);
  }

  els.credentialList.appendChild(fragment);
}

function makeActionButton(label, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "secondary";
  button.textContent = label;
  return button;
}

async function copyPasswordValue(password, button) {
  if (typeof password !== "string" || !password) return;
  try {
    await writeClipboard(password);
    button.textContent = "Copied";
    scheduleClipboardClear();
    setGlobalStatus("Password copied. The app will attempt to clear the clipboard automatically.", "success");
    setTimeout(() => { if (button.isConnected) button.textContent = "Copy"; }, 1200);
  } catch (error) {
    setGlobalStatus(error instanceof Error ? error.message : "Clipboard access failed.", "error");
  }
}

async function writeClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      state.clipboardLastValue = text;
      return true;
    } catch {
      // Fallback below.
    }
  }

  const helper = document.createElement("textarea");
  helper.value = text;
  helper.setAttribute("aria-hidden", "true");
  helper.className = "clipboard-fallback-input";
  document.body.appendChild(helper);
  helper.focus({ preventScroll: true });
  helper.select();
  helper.setSelectionRange(0, helper.value.length);

  let copied = false;
  try { copied = document.execCommand("copy"); }
  finally {
    helper.value = "";
    helper.remove();
  }

  if (!copied) throw new Error("Clipboard access was denied by the browser.");
  state.clipboardLastValue = text;
  return true;
}

async function clearClipboardBestEffort({ announce = true } = {}) {
  if (!state.clipboardPending) return true;
  let cleared = false, changed = false;
  // Reading back the value is necessary: never delete something copied later
  // from another site or app. Browsers that forbid reading must leave it alone.
  if (state.clipboardLastValue && navigator.clipboard &&
      typeof navigator.clipboard.readText === 'function' &&
      typeof navigator.clipboard.writeText === 'function') {
    try {
      const current = await navigator.clipboard.readText();
      if (current !== state.clipboardLastValue) changed = true;
      else {
        await navigator.clipboard.writeText('');
        cleared = true;
      }
    } catch {
      // Browser did not permit safe conditional clearing.
    }
  }
  if (state.clipboardTimer) clearTimeout(state.clipboardTimer);
  state.clipboardTimer = null;
  state.clipboardPending = false;
  state.clipboardClearDeadline = 0;
  state.clipboardLastValue = '';
  if (announce) {
    if (cleared) setGlobalStatus('PassVault clipboard content was cleared.', 'success');
    else if (changed) setGlobalStatus('Clipboard changed after copying; newer content was left untouched.', 'success');
    else setGlobalStatus('Automatic clipboard clearing was blocked by the browser. Clear the clipboard manually.', 'warning');
  }
  return cleared || changed;
}

function scheduleClipboardClear() {
  if (state.clipboardTimer) clearTimeout(state.clipboardTimer);

  state.clipboardPending = true;
  state.clipboardClearDeadline = Date.now() + state.clipboardTimeoutMs;
  state.clipboardTimer = setTimeout(() => {
    state.clipboardTimer = null;
    void clearClipboardBestEffort({ announce: true });
  }, state.clipboardTimeoutMs);
}

async function handleCreateVault(event) {
  event.preventDefault();
  if (!cloud.userId || !cloud.loaded || !cloud.selectedVaultId) return setStatus(els.createStatus, "Select Create new vault from My vaults first.", "error");
  if (!cloud.deviceOnly && !isCloudSyncAllowed()) return setStatus(els.createStatus, "Cloud sync is off. Choose Work offline to create a device-only vault, or enable sync for a cloud vault.", "error");
  if (cloud.deviceOnly && (!String(cloud.selectedVaultId).startsWith('device-') || cloud.importSource !== 'device-new')) return setStatus(els.createStatus, "Invalid device-only vault state; start again from Work offline.", "error");
  if (cloud.revision > 0) return setStatus(els.createStatus, "Selected vault already exists. Open it or create another from My vaults.", "error");
  if (!cloud.deviceOnly && cloud.vaults.length >= 2) return setStatus(els.createStatus, 'Cloud vault limit reached: only two cloud vaults are permitted.','error');
  const initialUserId = cloud.userId;
  const initialVaultId = cloud.selectedVaultId;
  const initialEpoch = cloud.epoch;
  if (!browserCapabilities()) return setStatus(els.createStatus, "This browser does not expose the required cryptographic APIs.", "error");
  if (state.kdfInProgress) return;
  if (Date.now() < state.blockedUntil || Date.now() < state.retryDelayUntil) return;

  let master = els.newMaster.value;
  let pepper = els.newPepperEnabled.checked ? els.newPepper.value : "";
  let salt = null;
  let key = null;
  try {
    validateCreateForm();

    if (state.vault && state.dirty && !window.confirm("Discard the current unsaved vault changes and create a new vault?")) return;

    els.createVaultButton.disabled = true;
    setStatus(els.createStatus, "Creating the vault and deriving the encryption key…", "warning");

    const params = getPreferredKdfProfile();
    salt = randomBytes(VAULT_SALT_BYTES);
    const vault = buildNewVault(els.newVaultName.value.trim());
    key = await deriveVaultKey(master, salt, pepper, params);
    if (cloud.userId !== initialUserId || cloud.selectedVaultId !== initialVaultId || cloud.epoch !== initialEpoch) throw new Error("Account or selected vault changed during encryption. Please try again.");

    state.vault = vault;
    state.vaultKey = key;
    key = null;
    state.vaultMeta = {
      version: CURRENT_FORMAT_VERSION,
      algorithm: AES_ALGORITHM,
      kdf: "Argon2id",
      parameters: { argonVersion: ARGON2_VERSION, type: ARGON2_TYPE_ID, ...params, outputLength: ARGON2_OUTPUT_BYTES },
      salt: bytesToBase64(salt),
      pepperRequired: els.newPepperEnabled.checked,
      authentication: { tagLength: AES_TAG_LENGTH, aad: AAD_PREFIX }
    };
    state.pendingImport = null;
    setDirty(true);
    state.locked = false;
    state.failedAttempts = 0;
    setActiveView();
    renderVault();
    resetCredentialEditor();
    clearCreateSensitiveFields();
    if (cloud.deviceOnly) {
      setStatus(els.createStatus, 'Device-only vault created. Nothing was uploaded. Download an encrypted backup to preserve it.', 'success');
      setGlobalStatus('Device-only vault active: download and verify an encrypted backup before signing out or leaving this browser.', 'warning');
    } else {
      setStatus(els.createStatus, 'Vault created. Uploading encrypted vault to Supabase…', 'success');
      await saveCloudVault(true);
    }
  } catch (error) {
    setStatus(els.createStatus, error instanceof Error ? error.message : "Vault creation failed.", "error");
  } finally {
    wipeBytes(salt);
    salt = null;
    key = null;
    master = null;
    pepper = null;
    els.createVaultButton.disabled = false;
    clearCreateSensitiveFields();
  }
}

function getPreferredKdfProfile() {
  return els.newKdfProfile.value === "mobile" ? ARGON2_MOBILE : ARGON2_STANDARD;
}

async function handleUnlockVault() {
  if (!cloud.userId || !cloud.loaded || !cloud.selectedVaultId) return setStatus(els.unlockStatus, "Cloud account is not ready.", "error");
  if (idleSignOutPending || Date.now() - state.lastActivity >= ACCOUNT_IDLE_LIMIT_MS) {
    void updateAccountInactivity();
    return setStatus(els.unlockStatus, 'Your account session expired. Sign in again.', 'error');
  }
  if (!state.pendingImport || !state.pendingImport.record) {
    return setStatus(els.unlockStatus, "Cloud vault not loaded. Sign in or import an encrypted backup first.", "error");
  }
  if (Date.now() < state.blockedUntil) return updateAccessLockoutStatus();
  if (Date.now() < state.retryDelayUntil) return updateAccessLockoutStatus();
  if (state.kdfInProgress) return;

  const openingUser = cloud.userId;
  const openingVaultId = cloud.selectedVaultId;
  const openingEpoch = cloud.epoch;
  let master = els.unlockMaster.value;
  let pepper = els.unlockPepper.value;
  let failureHandled = false;

  try {
    els.unlockVaultButton.disabled = true;
    setStatus(els.unlockStatus, "Deriving the vault key… this may take a while because Argon2id is intentionally memory-hard.", "warning");

    const imported = state.pendingImport;

    if (imported.type === "legacy-v1") {
      if (!master) throw new Error("Master password is required.");
      const vault = await decryptLegacyV1(imported.record, master);
      if(cloud.importSource === 'file' || cloud.importSource === 'device-file')window.PassVaultURLSafety.validateImportedVault(vault);
      if (idleSignOutPending || cloud.userId !== openingUser || cloud.selectedVaultId !== openingVaultId || cloud.epoch !== openingEpoch) throw new Error("Account changed or session expired while unlocking.");

      const salt = randomBytes(VAULT_SALT_BYTES);
      const key = await deriveVaultKey(master, salt, "", ARGON2_STANDARD);

      state.vault = vault;
      state.vaultKey = key;
      state.vaultMeta = {
        version: CURRENT_FORMAT_VERSION,
        algorithm: AES_ALGORITHM,
        kdf: "Argon2id",
        parameters: { argonVersion: ARGON2_VERSION, type: ARGON2_TYPE_ID, ...ARGON2_STANDARD, outputLength: ARGON2_OUTPUT_BYTES },
        salt: bytesToBase64(salt),
        pepperRequired: false,
        authentication: { tagLength: AES_TAG_LENGTH, aad: AAD_PREFIX }
      };
      wipeBytes(salt);
      setDirty(true);
      state.pendingImport = null;
      state.locked = false;
      state.failedAttempts = 0;
      setActiveView();
      renderVault();
      setStatus(els.unlockStatus, "Legacy credential migrated into a new Argon2id vault in memory.", "success");
      setGlobalStatus("Legacy v1 data was migrated. Export the new v2 vault to store it in the modern format.", "success");
      return;
    }

    const record = imported.record;
    const salt = base64ToBytes(record.salt);
    let key = null;
    try {
      if (record.pepperRequired && !pepper) throw new Error("This vault requires its secret pepper.");
      if (!record.pepperRequired && pepper) {
        setGlobalStatus("This vault does not require a pepper; the entered pepper was ignored for this attempt.", "warning");
      }
      key = await deriveVaultKey(master, salt, record.pepperRequired ? pepper : "", record.parameters);
      const vault = await decryptVaultPayload(record, key);
      // Imported encrypted backups are rejected before changing the active vault.
      if(cloud.importSource === 'file' || cloud.importSource === 'device-file')window.PassVaultURLSafety.validateImportedVault(vault);
      if (idleSignOutPending || cloud.userId !== openingUser || cloud.selectedVaultId !== openingVaultId || cloud.epoch !== openingEpoch) throw new Error("Account changed or session expired while unlocking.");

      if (cloud.importSource === 'file' && cloud.revision > 0) {
        const phrase = window.prompt(`You are about to replace the encrypted cloud vault with ${vault.credentials.length} imported item(s). Existing cloud items may be lost. Keep a separate backup first. Type REPLACE to confirm:`);
        if (phrase !== 'REPLACE') throw new Error('Import cancelled. The existing cloud vault was not replaced.');
      }
      state.vault = vault;
      state.vaultKey = key;
      state.vaultMeta = {
        version: record.version,
        algorithm: record.algorithm,
        kdf: record.kdf,
        parameters: { ...record.parameters },
        salt: record.salt,
        pepperRequired: record.pepperRequired,
        authentication: { ...record.authentication }
      };
      key = null;
      state.pendingImport = null;
      const importingLocalBackup = cloud.importSource === "file";
      const importingDeviceBackup = cloud.importSource === "device-file";
      if (importingDeviceBackup) cloud.vaultLabel = vault.name || 'Device-only vault';
      const importingLocalRecovery = cloud.importSource === "local-recovery";
      if (importingLocalRecovery) cloud.vaultLabel = vault.name || 'Recovered vault';
      state.locked = false;
      state.failedAttempts = 0;
      setDirty(importingLocalBackup || importingLocalRecovery);
      const hadRecovery = !importingLocalRecovery && !importingDeviceBackup && !!readEncryptedRecovery(openingUser, openingVaultId);
      const restoredRecovery = importingLocalRecovery ? true
        : importingDeviceBackup ? false : await offerEncryptedRecovery(record, state.vaultKey, openingUser, openingVaultId);
      cloud.importSource = "cloud";
      setActiveView();
      renderVault();
      setStatus(els.unlockStatus, importingDeviceBackup ? "Device-only vault unlocked. Download an encrypted backup after editing." : importingLocalBackup ? "Backup unlocked; encrypted cloud save scheduled." : "Vault unlocked successfully.", "success");
      if (!hadRecovery && !restoredRecovery) setGlobalStatus("Vault unlocked in memory.", "success");
    } catch (error) {
      state.failedAttempts += 1;
      state.vault = null;
      state.vaultKey = null;
      state.vaultMeta = null;
      clearUnlockedDom();
      failureHandled = true;
      registerFailedUnlock();
      throw new Error("Authentication failed. The master password or required secret pepper is incorrect, or the vault was modified.");
    } finally {
      wipeBytes(salt);
      key = null;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Vault unlock failed.";
    if (!failureHandled && !/Too many|locked for/.test(message)) setStatus(els.unlockStatus, message, "error");
  } finally {
    master = null;
    pepper = null;
    clearUnlockSensitiveFields();
    els.unlockVaultButton.disabled = false;
    updateAccessLockoutStatus();
  }
}

function registerFailedUnlock() {
  if (state.failedAttempts >= 5) {
    state.blockedUntil = Date.now() + 30000;
    state.retryDelayUntil = state.blockedUntil;
    setStatus(els.unlockStatus, "Too many failed attempts. Unlock is disabled for 30 seconds.", "error");
    return;
  }

  const delayMs = Math.min(1000 * (2 ** Math.min(state.failedAttempts - 1, 3)), 8000);
  state.retryDelayUntil = Date.now() + delayMs;
  setStatus(els.unlockStatus, `Unlock failed. The next attempt is delayed by ${Math.ceil(delayMs / 1000)} second${delayMs === 1000 ? "" : "s"}.`, "error");
}

function updateAccessLockoutStatus() {
  const now = Date.now();
  const blockedMs = Math.max(0, state.blockedUntil - now);
  const delayMs = Math.max(0, state.retryDelayUntil - now);
  if (blockedMs > 0) {
    els.unlockVaultButton.disabled = true;
    setStatus(els.unlockStatus, `Unlock disabled after repeated failures for ${Math.ceil(blockedMs / 1000)} seconds.`, "error");
  } else if (delayMs > 0) {
    els.unlockVaultButton.disabled = true;
    setStatus(els.unlockStatus, `Please wait ${Math.ceil(delayMs / 1000)} second${Math.ceil(delayMs / 1000) === 1 ? "" : "s"} before another attempt.`, "warning");
  } else if (!state.kdfInProgress) {
    els.unlockVaultButton.disabled = false;
  }
}

async function handleFileChoose(selectedFile = null) {
  const file = selectedFile && typeof selectedFile.text === "function" ? selectedFile : els.vaultFile.files?.[0];
  if (!file) return;
  try {
    if (file.size > MAX_VAULT_TEXT_BYTES) throw new Error("Vault file is too large.");
    const text = await file.text();
    const parsed = parseVaultFileText(text);

    if (!state.locked && state.vault && state.dirty && !window.confirm("Discard current unsaved changes and load this vault?")) {
      els.vaultFile.value = "";
      return;
    }

    if (!cloud.userId || !cloud.loaded) throw new Error("Sign in and load the account before importing.");
    const deviceOnly = $('vaultImportDeviceOnly').checked || !cloud.syncEnabled;
    if (!deviceOnly && (!cloud.selectedVaultId || !cloud.vaults.some(v=>v.vault_id===cloud.selectedVaultId)))
      throw new Error('Choose a cloud vault from My vaults before importing with cloud replacement enabled.');
    if (!deviceOnly && cloud.revision > 0 && !window.confirm("This backup will REPLACE your current cloud vault after you unlock it. Continue?")) return;
    if (deviceOnly) {
      // A fresh, never-uploaded vault identifier. The cloud revision is not reused.
      cloud.selectedVaultId = 'device-' + crypto.randomUUID();
      cloud.revision = 0;
      cloud.encryptedEnvelope = null;
      cloud.vaultLabel = 'Device-only backup';
      cloud.deviceOnly = true;
      cloud.lastBackup = null; // Per-vault isolation, without changing the account-wide sync preference.
    }
    cloud.importSource = deviceOnly ? "device-file" : "file";
    state.pendingImport = parsed;
    uiState.accessScreen = "unlock";
    showAccessScreen("unlock");
    els.selectedFileName.textContent = `${file.name} • ${parsed.type === "v2" ? "Pass Vault v2" : "Legacy Pass v1"}`;
    els.unlockPepperHint.textContent = parsed.type === "v2" && parsed.record.pepperRequired
      ? "This vault declares that a secret pepper is required."
      : "Leave empty unless the vault was created with a pepper.";

    clearStatus(els.unlockStatus);
    setGlobalStatus(deviceOnly ? "Device-only backup selected. It will never be uploaded; download a new encrypted backup after edits." : "Encrypted backup selected. After unlocking, it will replace the selected cloud vault.", "warning");
    window.dispatchEvent(new Event('passvault-access-change'));
  } catch (error) {
    state.pendingImport = null;
    els.selectedFileName.textContent = "No usable vault selected.";
    setStatus(els.unlockStatus, error instanceof Error ? error.message : "Vault import failed.", "error");
    window.dispatchEvent(new Event('passvault-access-change'));
  } finally {
    els.vaultFile.value = "";
  }
}

async function handleExportVault() {
  if (state.exportInProgress) return;
  try {
    if (!state.vault || !state.vaultKey || !state.vaultMeta) throw new Error("No unlocked vault is available.");
    state.exportInProgress = true;
    els.exportVaultButton.disabled = true;

    const exportingMutation = cloud.mutation;
    const exportingVaultId = cloud.selectedVaultId;
    state.vault.updatedAt = new Date().toISOString();
    const envelope = await encryptAndBuildEnvelope();
    const json = JSON.stringify(envelope, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const fileName = `${safeFileName(state.vault.name || "Pass-Vault")}.pvault.json`;

    /*
     * Desktop browsers normally honor a programmatic download after a user click.
     * Mobile Safari may choose not to start a download after asynchronous work.
     * Keeping a visible download link gives the user a reliable second step without
     * changing the encrypted file contents or sending anything off-device.
     */
    if (els.downloadVaultLink.dataset.objectUrl) {
      URL.revokeObjectURL(els.downloadVaultLink.dataset.objectUrl);
    }
    els.downloadVaultLink.href = url;
    els.downloadVaultLink.download = fileName;
    els.downloadVaultLink.dataset.objectUrl = url;
    els.downloadVaultLink.textContent = "Download Encrypted Vault";
    els.downloadVaultLink.classList.remove("hidden");
    // Mobile Safari sometimes needs a second explicit user gesture for saving.
    // These links reference the exact same in-memory encrypted Blob, not plaintext.
    for (const id of ['pvOverviewBackupLink','pvSettingsBackupLink']) {
      const link=$(id); if(!link) continue;
      link.href=url; link.download=fileName; link.classList.remove('hidden');
    }

    try {
      els.downloadVaultLink.click();
    } catch {}

    cloud.lastBackup = exportingMutation === cloud.mutation && exportingVaultId === cloud.selectedVaultId
      ? { userId: cloud.userId, vaultId: exportingVaultId, mutation: exportingMutation }
      : null;
    setGlobalStatus(cloud.lastBackup
      ? 'Encrypted backup prepared. Verify that the download exists and can be opened. Cloud sync status is unchanged.'
      : 'Edits changed while exporting. Prepare another backup to include the latest changes.', 'warning');
    renderVaultHeader();
  } catch (error) {
    setGlobalStatus(error instanceof Error ? error.message : "Vault export failed.", "error");
  } finally {
    state.exportInProgress = false;
    els.exportVaultButton.disabled = false;
  }
}

function safeFileName(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "Pass-Vault";
}

function renderVaultHeader() {
  if (!state.vault || !state.vaultMeta || uiState.activePage !== "vault") return;
  els.vaultTitle.textContent = state.vault.name || "Pass Vault";
  const p = state.vaultMeta.parameters;
  els.vaultMetaText.textContent = `${state.vault.credentials.length} credential${state.vault.credentials.length === 1 ? "" : "s"} • Argon2id ${p.memoryKiB / 1024} MiB / t=${p.iterations} / p=${p.parallelism} • ${state.vaultMeta.pepperRequired ? "pepper required" : "no pepper"}`;
}

function renderVault() {
  renderVaultHeader();
  renderCredentialList();
}

// Presentation routing: every screen is a separate view, never an anchor jump.
function showAccessScreen(screen = "unlock") {
  uiState.accessScreen = screen === "dashboard" ? "dashboard" : (screen === "create" && cloud.loaded && cloud.revision === 0 ? "create" : "unlock");
  els.unlockVaultScreen.classList.toggle("hidden", uiState.accessScreen !== "unlock");
  els.createVaultScreen.classList.toggle("hidden", uiState.accessScreen !== "create");
  $("vaultDashboardScreen").classList.toggle("hidden", uiState.accessScreen !== "dashboard");
  window.scrollTo(0, 0);
}

function showAppPage(page = "vault") {
  if (!state.vault || state.locked) return;
  const next = ["vault", "generator", "settings"].includes(page) ? page : "vault";
  uiState.activePage = next;
  [els.vaultPage, els.generatorPage, els.settingsPage].forEach((element) => {
    element.classList.toggle("hidden", element.dataset.appPage !== next);
  });
  document.querySelectorAll('[data-page-target]').forEach((button) => {
    const active = button.dataset.pageTarget === next;
    button.classList.toggle("active", active);
    if (button.classList.contains("nav-link")) {
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  });
  const pageInfo = {
    vault: { kicker: "WORKSPACE / MY VAULT" },
    generator: { kicker: "WORKSPACE / GENERATOR", title: "Password generator", subtitle: "Create unique, secure passwords." },
    settings: { kicker: "WORKSPACE / SETTINGS", title: "Security settings", subtitle: "Privacy and session preferences." }
  }[next];
  els.topKicker.textContent = pageInfo.kicker;
  if (next === "vault") renderVaultHeader();
  else {
    els.vaultTitle.textContent = pageInfo.title;
    els.vaultMetaText.textContent = pageInfo.subtitle;
  }
  window.scrollTo(0, 0);
}

function setActiveView() {
  const showVault = !state.locked && uiState.accessGranted;
  els.loginView.classList.toggle("hidden", uiState.accessGranted);
  els.lockedView.classList.toggle("hidden", !uiState.accessGranted || showVault);
  els.unlockedView.classList.toggle("hidden", !showVault);
  if (showVault) showAppPage("vault");
  else if (uiState.accessGranted) showAccessScreen(uiState.accessScreen);
  els.vaultStatus.textContent = state.locked ? "LOCKED" : "UNLOCKED";
  els.vaultStatus.classList.toggle("unlocked", !state.locked);
  if (state.locked) els.dirtyStatus.classList.add("hidden");
  else els.dirtyStatus.classList.toggle("hidden", !state.dirty);
}

function clearUnlockedDom() {
  els.vaultTitle.textContent = "Vault";
  els.vaultMetaText.textContent = "Locked.";
  els.credentialSearch.value = "";
  els.credentialList.textContent = "";
  resetCredentialEditor();
  clearGeneratedPassword();
}

function lockVault(reason = "Vault locked.") {
  if (state.locked) return;
  if (cloud.deviceOnly && state.dirty && reason === 'Manual lock' && !cloud.secureLockPromise) {
    void secureLockWithCheckpoint('Device-only vault locked; encrypted local recovery saved when supported.');
    return;
  }
  if (state.dirty && reason === "Manual lock" && !window.confirm("There are unsaved changes. Locking now will discard them. Continue?")) return;

  /*
   * Do not clear copied passwords early when the vault locks. The clipboard
   * deadline is independent from the vault session and remains scheduled.
   */

  clearTimeout(cloud.retryTimer);
  cloud.retryTimer = null;
  cloud.lastSaveError = '';
  cloud.autoLockDeferred = false;
  if (els.downloadVaultLink.dataset.objectUrl) {
    URL.revokeObjectURL(els.downloadVaultLink.dataset.objectUrl);
    delete els.downloadVaultLink.dataset.objectUrl;
  }
  els.downloadVaultLink.removeAttribute("href");
  els.downloadVaultLink.removeAttribute("download");
  els.downloadVaultLink.classList.add("hidden");
  for (const id of ['pvOverviewBackupLink','pvSettingsBackupLink']) {
    const link=$(id);if(!link)continue;
    link.removeAttribute('href');link.removeAttribute('download');link.classList.add('hidden');
  }

  if (state.vault?.credentials) {
    for (const credential of state.vault.credentials) {
      credential.password = "";
      credential.username = "";
      credential.notes = "";
      credential.url = "";
      credential.title = "";
      if (credential.cvv) credential.cvv = "";
      if (credential.expiry) credential.expiry = "";
      if (Array.isArray(credential.tags)) credential.tags.length = 0;
      if (Array.isArray(credential.customFields)) {
        for (const field of credential.customFields) field.value = "";
        credential.customFields.length = 0;
      }
    }
    state.vault.credentials.length = 0;
  }
  // Best-effort removal of references to decrypted deleted items on lock.
  if (Array.isArray(state.vault?.recycleBin)) {
    for (const entry of state.vault.recycleBin) {
      const item=entry.item;
      if (!item) continue;
      for (const field of ['title','url','username','password','notes','cvv','expiry'])
        if (typeof item[field]==='string') item[field]='';
      if (Array.isArray(item.tags)) item.tags.length=0;
      if (Array.isArray(item.customFields)) {
        for (const custom of item.customFields) if (typeof custom.value==='string') custom.value='';
        item.customFields.length=0;
      }
    }
    state.vault.recycleBin.length=0;
  }
  if (Array.isArray(state.vault?.editHistory)) {
    for (const event of state.vault.editHistory) {
      for (const snapshot of [event.before, event.after]) {
        if (!snapshot) continue;
        for (const field of HISTORY_FIELDS) {
          if (typeof snapshot[field] === 'string') snapshot[field] = '';
          else if (Array.isArray(snapshot[field])) {
            for (const entry of snapshot[field]) if (entry && typeof entry === 'object') {
              for (const key of Object.keys(entry)) if (typeof entry[key] === 'string') entry[key] = '';
            }
            snapshot[field].length = 0;
          }
        }
      }
    }
    state.vault.editHistory.length = 0;
  }

  state.vault = null;
  state.vaultKey = null;
  state.vaultMeta = null;
  state.pendingImport = null;
  state.editingId = null;
  cloud.lastBackup = null;
  setDirty(false);
  state.locked = true;
  clearSensitiveFieldsEverywhere();
  clearUnlockedDom();
  uiState.accessGranted = Boolean(cloud.userId); // Lock the vault, not the Supabase account.
  uiState.activePage = "vault";
  cloud.selectedVaultId = null; cloud.revision = 0; cloud.vaultLabel = "";
  uiState.accessScreen = "dashboard";
  setActiveView(); renderVaultDashboard();
  setGlobalStatus(reason, "success");
}

function clearSensitiveFieldsEverywhere() {
  clearCreateSensitiveFields();
  clearUnlockSensitiveFields();
  clearCredentialFormSensitive();
  clearGeneratedPassword();
  window.pvClearPremiumSecrets?.();
  window.pvClearApprovedSecrets?.();
}

function updateInactivityLock() {
  if (state.locked || state.kdfInProgress) return;
  const idle = Date.now() - state.lastActivity;
  if (idle >= state.sessionTimeoutMs) {
    // A dirty vault must not remain unlocked indefinitely. Encrypt an on-device
    // recovery copy and then lock, even during cloud outages or conflicts.
    void secureLockWithCheckpoint("Session timed out due to inactivity.");
  }
}

function toggleFieldVisibility(input, button) {
  const show = input.type === "password";
  input.type = show ? "text" : "password";
  button.textContent = show ? "Hide" : "Show";
}

function deleteCredential(id) {
  if (!state.vault) return;
  const index = state.vault.credentials.findIndex((item) => item.id === id);
  if (index < 0) return;
  const credential = state.vault.credentials[index];
  if (!window.confirm(`Move “${credential.title}” to the encrypted Recycle Bin? You can restore it later.`)) return;
  moveVaultItemToRecycleBin(credential.id);
  setDirty(true);
  if (state.editingId === id) resetCredentialEditor();
  renderVault();
  setGlobalStatus("Credential moved to encrypted Recycle Bin. Cloud sync scheduled…", "warning");
}

function saveCredential() {
  if (!state.vault) throw new Error("No unlocked vault is available.");
  const draft = validateCredentialDraft();
  const now = new Date().toISOString();

  if (state.editingId) {
    const credential = state.vault.credentials.find((item) => item.id === state.editingId);
    if (!credential) throw new Error("The credential being edited no longer exists.");
    const updated = {...credential, ...draft, updatedAt: now};
    recordVaultHistory(credential, updated, 'edited', now);
    credential.title = draft.title;
    credential.url = draft.url;
    credential.username = draft.username;
    credential.password = draft.password;
    credential.notes = draft.notes;
    credential.updatedAt = now;
    setGlobalStatus("Credential updated locally. Encrypted cloud sync scheduled…", "warning");
  } else {
    if (state.vault.credentials.length >= 10) throw new Error('Maximum 10 items per vault. Existing items can still be edited.');
    const newCredential = {
      id: secureId(),
      title: draft.title,
      url: draft.url,
      username: draft.username,
      password: draft.password,
      notes: draft.notes,
      createdAt: now,
      updatedAt: now
    };
    recordVaultHistory(null, newCredential, 'created', now);
    state.vault.credentials.push(newCredential);
    setGlobalStatus("Credential added locally. Encrypted cloud sync scheduled…", "warning");
  }

  state.vault.updatedAt = now;
  setDirty(true);
  resetCredentialEditor();
  renderVault();
}

function handleGeneratePassword() {
  try {
    const options = generatorOptions();
    const generated = generatePassword(options);
    els.generatedPassword.value = generated;
    els.generatedPassword.type = "password";
    els.toggleGeneratedPassword.textContent = "Show";
    els.copyGeneratedButton.disabled = false;
    els.generatorEntropy.textContent = `Approximate entropy: ${generatorEntropy(options).toFixed(1)} bits.`;
    setStatus(els.generatorStatus, "Generated locally with crypto.getRandomValues().", "success");
  } catch (error) {
    clearGeneratedPassword();
    setStatus(els.generatorStatus, error instanceof Error ? error.message : "Password generation failed.", "error");
  }
}

async function handleCopyGenerated() {
  const password = els.generatedPassword.value;
  if (!password) return;
  try {
    await writeClipboard(password);
    scheduleClipboardClear();
    setStatus(els.generatorStatus, "Copied. Clipboard auto-clear is scheduled.", "success");
    els.copyGeneratedButton.textContent = "Copied";
    setTimeout(() => { if (els.copyGeneratedButton.isConnected) els.copyGeneratedButton.textContent = "Copy"; }, 1200);
  } catch (error) {
    setStatus(els.generatorStatus, error instanceof Error ? error.message : "Copy failed.", "error");
  }
}

function handleNewCredential() {
  resetCredentialEditor();
  els.credentialTitle.focus();
}

function handleCancelEdit() {
  resetCredentialEditor();
}

function handleSessionSettings() {
  state.sessionTimeoutMs = Number(els.sessionTimeout.value) || 900000;
  state.clipboardTimeoutMs = Number(els.clipboardTimeout.value) || CLIPBOARD_DEFAULT_MS;
  markActivity();
}

function handlePageVisibility() {
  /*
   * Changing tabs must not lock the vault and must not clear a copied password
   * before its selected deadline. If a hidden-tab timer was throttled or a
   * clipboard write was denied while hidden, retry as soon as the page becomes
   * visible after the deadline has elapsed.
   */
  if (!document.hidden) {
    updateAccountInactivity();
    updateInactivityLock();
    if (state.clipboardPending && Date.now() >= state.clipboardClearDeadline) {
      void clearClipboardBestEffort({ announce: true });
    }
  }
}

function handleBlur() {
  document.querySelectorAll("input, textarea, .credential-secret input").forEach((element) => {
    if (!element.disabled) element.classList.add("privacy-blur");
  });
}

function handleFocus() {
  document.querySelectorAll("input, textarea, .credential-secret input").forEach((element) => {
    element.classList.remove("privacy-blur");
  });

  /* Focus alone is not user activity. Preserve the original inactivity clock. */
  updateAccountInactivity();
  updateInactivityLock();
  if (state.clipboardPending && Date.now() >= state.clipboardClearDeadline) {
    void clearClipboardBestEffort({ announce: true });
  }
}

function handleEscape() {
  clearSensitiveFieldsEverywhere();
  setGlobalStatus("Sensitive fields were cleared.", "success");
}

function handlePageExit() {
  /*
   * A browser page cannot keep JavaScript timers alive after the tab is destroyed.
   * If the page closes before the selected clipboard deadline, this is the final
   * best-effort opportunity to clear it. Tab switching does not call this path.
   */
  if (state.clipboardPending) void clearClipboardBestEffort({ announce: false });
  clearSensitiveFieldsEverywhere();
}

function beforeUnload(event) {
  if (state.clipboardPending) void clearClipboardBestEffort({ announce: false });
  if (!state.locked && state.dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
  clearSensitiveFieldsEverywhere();
}

