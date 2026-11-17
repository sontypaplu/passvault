/* AVENLOCK device-only vault store. Only AES-GCM authenticated envelopes are persisted.
   No master password, pepper, decrypted item, key, cloud token or account identifier is stored here. */
(() => {
  'use strict';
  const DB_NAME = 'avenlock-local-vaults-v1';
  const STORE = 'encrypted-vaults';
  const LOCAL_USER = 'avenlock-local-device';
  let active = false;
  let dbPromise = null;
  let cache = [];
  let saveTimer = null;
  let saveChain = Promise.resolve();
  let lastError = '';
  let trackedId = null;
  let trackedRevision = 0;
  const isLocalId = id => /^device-[0-9a-f-]{36}$/i.test(String(id || ''));

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) { reject(new Error('Encrypted device storage is unavailable in this browser.')); return; }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Device storage could not be opened.'));
      request.onblocked = () => reject(new Error('Close other tabs using AVENLOCK, then try again.'));
    }).catch(error => { dbPromise = null; throw error; });
    return dbPromise;
  }
  async function transact(mode, operation) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let result;
      const request = operation(tx.objectStore(STORE));
      request.onsuccess = () => { result = request.result; };
      request.onerror = () => { /* transaction error handler reports failure */ };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(new Error('Encrypted device storage write failed. Check available space and browser storage permissions.'));
      tx.onabort = () => reject(new Error('Encrypted device storage transaction was cancelled.'));
    });
  }
  function assertEnvelope(envelope) {
    if (parseVaultFileText(JSON.stringify(envelope)).type !== 'v2') throw new Error('Unsupported encrypted vault format.');
  }
  async function refresh() {
    const values = await transact('readonly', store => store.getAll());
    cache = (values || []).filter(row => isLocalId(row.id) && row.version === 1 && row.envelope);
    cache.sort((a,b) => (b.savedAt || 0) - (a.savedAt || 0));
    window.dispatchEvent(new Event('avenlock-local-list'));
    return list();
  }
  function list() {
    const localRecords = cache.map(row => ({id:row.id, savedAt:row.savedAt, size:row.size, source:'device'}));
    // A forced security lock may have written an encrypted emergency checkpoint
    // if IndexedDB was unavailable. Surface it rather than silently hiding it.
    try {
      for (const draft of listUnsyncedNewVaultRecoveries(LOCAL_USER)) {
        const previous = localRecords.find(row => row.id === draft.vaultId);
        if (!previous || draft.savedAt > previous.savedAt) localRecords.unshift({
          id:draft.vaultId, savedAt:draft.savedAt, size:0, source:'recovery'
        });
      }
    } catch { /* unavailable encrypted checkpoint storage */ }
    return localRecords;
  }

  async function enter() {
    if (active) { await refresh(); return true; }
    // Do not interrupt an unlocked cloud vault or a Supabase recovery callback.
    if (!state.locked || (cloud.userId && cloud.userId !== LOCAL_USER) || window.PassVaultAuth?.recoveryPending) {
      setStatus(els.accessStatus, 'Sign out of your cloud account or finish account recovery before entering independent offline mode.', 'warning');
      return false;
    }
    try { await refresh(); }
    catch(error) {
      setStatus(els.accessStatus, error.message, 'error');
      const offlineStatus = document.getElementById('avenlockOfflineStatus');
      if (offlineStatus) offlineStatus.textContent = error.message;
      return false;
    }
    ++cloud.epoch;
    cloud.userId = LOCAL_USER;
    cloud.email = 'Device-only workspace';
    cloud.loaded = true;
    cloud.vaults = [];
    cloud.selectedVaultId = null;
    cloud.vaultLabel = '';
    cloud.encryptedEnvelope = null;
    cloud.revision = 0;
    cloud.conflict = false;
    cloud.lastBackup = null;
    cloud.deviceOnly = true;
    cloud.syncEnabled = false;
    cloud.importSource = 'device-new';
    state.pendingImport = null;
    active = true;
    lastError = '';
    void storageDurability();
    uiState.accessGranted = true;
    uiState.accessScreen = 'dashboard';
    setActiveView();
    window.dispatchEvent(new Event('passvault-access-change'));
    return true;
  }

  async function leave() {
    if (!active) return;
    if (!state.locked) {
      const saved = await secureLockWithCheckpoint('Local vault locked.');
      if (!saved) throw new Error('The encrypted vault could not be saved. Export and verify a backup before leaving.');
    }
    clearTimeout(saveTimer);
    await saveChain;
    active = false;
    trackedId = null;trackedRevision = 0;
    ++cloud.epoch;
    cloud.userId = null; cloud.email = ''; cloud.loaded = false;
    cloud.selectedVaultId = null; cloud.encryptedEnvelope = null;
    cloud.vaults = []; cloud.deviceOnly = false; cloud.syncEnabled = false;
    cloud.importSource = 'cloud'; cloud.vaultLabel = ''; cloud.lastBackup = null;
    state.pendingImport = null;
    uiState.accessGranted = false; uiState.accessScreen = 'unlock';
    setActiveView();
    window.dispatchEvent(new Event('passvault-access-change'));
  }

  async function open(id) {
    if (!active || !state.locked || !isLocalId(id)) return;
    const row = await transact('readonly', store => store.get(id));
    if (!row || row.version !== 1 || !row.envelope) throw new Error('Encrypted local vault could not be found.');
    assertEnvelope(row.envelope);
    trackedId = id;trackedRevision = Number.isSafeInteger(row.revision) ? row.revision : 0;
    cloud.selectedVaultId = id;
    cloud.encryptedEnvelope = row.envelope;
    cloud.deviceOnly = true;
    cloud.revision = 0;
    cloud.vaultLabel = 'Device vault';
    cloud.lastBackup = null;
    cloud.importSource = 'device-local';
    state.pendingImport = parseVaultFileText(JSON.stringify(row.envelope));
    els.selectedFileName.textContent = 'Encrypted device vault loaded';
    els.unlockPepperHint.textContent = row.envelope.pepperRequired
      ? 'Enter the original master password and secret pepper.' : 'Enter the master password for this vault.';
    showAccessScreen('unlock');
    window.dispatchEvent(new Event('passvault-access-change'));
  }

  // One serial writer per application tab; never mark saved unless an IndexedDB
  // transaction has committed and the mutation number still matches.
  async function persist() {
    if (!active || !cloud.deviceOnly || !isLocalId(cloud.selectedVaultId) || state.locked) return false;
    const id = cloud.selectedVaultId;
    const stamp = cloud.mutation;
    const vault = state.vault;
    if (!vault || !state.vaultKey || !state.vaultMeta) return false;
    const envelope = await encryptAndBuildEnvelope();
    assertEnvelope(envelope);
    if (!active || cloud.selectedVaultId !== id || state.vault !== vault || state.locked) return false;
    const expected = trackedId === id ? trackedRevision : 0;
    const committed = await (async () => {
      const db = await openDb();
      return new Promise((resolve,reject) => {
        const tx = db.transaction(STORE,'readwrite');
        const store = tx.objectStore(STORE);
        const request = store.get(id);
        let nextRevision = expected + 1;
        let conflict = false;
        request.onsuccess = () => {
          const latest = request.result;
          const observed = Number.isSafeInteger(latest?.revision) ? latest.revision : 0;
          if (observed !== expected) { conflict=true; tx.abort(); return; }
          store.put({ id, version: 1, revision: nextRevision, savedAt:Date.now(), envelope,
            size:JSON.stringify(envelope).length });
        };
        tx.oncomplete = () => resolve(nextRevision);
        tx.onerror = () => reject(new Error('Encrypted device write failed. Check browser storage.'));
        tx.onabort = () => reject(new Error(conflict
          ? 'Another tab has saved a different version of this vault. Your changes remain unlocked; export a backup before reconciling.'
          : 'Encrypted device write was interrupted. Export a backup before leaving.'));
      });
    })();
    trackedId = id; trackedRevision = committed;
    if (!active || cloud.selectedVaultId !== id || state.vault !== vault) return false;
    lastError = '';
    if (stamp === cloud.mutation) {
      state.dirty = false;
      els.dirtyStatus.classList.add('hidden');
      cloudStatus('SAVED ON DEVICE');
    }
    await refresh();
    if (!state.dirty && typeof deleteEncryptedRecovery === 'function') {
      try { deleteEncryptedRecovery(LOCAL_USER,id); } catch { /* retention is safer than accidental deletion */ }
    }
    window.pvRenderApprovedStatus?.();
    return stamp === cloud.mutation;
  }
  function doWrite() {
    // Any failed write stays dirty and is never called successfully saved.
    saveChain = saveChain.catch(() => {}).then(async () => {
      if (!state.dirty || !active || state.locked) return true;
      try { return await persist(); }
      catch (error) {
        lastError = error.message || 'Device storage failed.';
        cloudStatus('LOCAL SAVE FAILED', 'error');
        setGlobalStatus('Encrypted device save failed. Keep this vault open and export a verified backup. ' + lastError, 'error');
        window.pvRenderApprovedStatus?.();
        return false;
      }
    });
    return saveChain;
  }
  function schedule() {
    if (!active || !cloud.deviceOnly || state.locked) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { saveTimer = null; void doWrite(); }, 180);
  }
  async function flush() {
    clearTimeout(saveTimer); saveTimer = null;
    await saveChain;
    for (let attempts = 0; attempts < 4 && state.dirty && !state.locked; attempts++) {
      if (await doWrite()) break;
      if (lastError) break;
    }
    return !state.dirty && !lastError;
  }
  async function openRecovery(id) {
    if (!active || !state.locked || !isLocalId(id)) return;
    const row = await transact('readonly', store => store.get(id));
    trackedId=id;
    trackedRevision=Number.isSafeInteger(row?.revision) ? row.revision : 0;
    openUnsyncedNewVaultRecovery(id);
  }
  async function remove(id) {
    if (!active || !state.locked || !isLocalId(id)) throw new Error('Lock the vault before deleting it.');
    await transact('readwrite', store => store.delete(id));
    await refresh();
  }
  async function storageDurability() {
    try { await navigator.storage?.persist?.(); } catch { /* best effort, never guarantees durability */ }
  }
  window.AvenlockLocal = Object.freeze({
    get active(){ return active; }, get localUser(){return LOCAL_USER;},
    get cachedList(){return list();}, get saveError(){return lastError;},
    enter, leave, open, openRecovery, refresh, remove, schedule, flush, storageDurability
  });
})();
