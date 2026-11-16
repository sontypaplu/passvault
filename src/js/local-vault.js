/* Ciphora encrypted on-device vaults.
 * Only authenticated AES-GCM envelopes are persisted. Plaintext, secrets,
 * master passwords and derived keys remain in volatile memory.
 * Device-only mode never invokes cloud vault upload functions.
 */
(() => {
  'use strict';
  const DB_NAME = 'ciphora-encrypted-device-vaults-v1';
  const STORE = 'vaults';
  const LOCAL_ID = 'ciphora-device-session';
  let dbPromise = null;
  let debounce = null;
  let pending = null;
  let knownRevision = 0;
  let hasSaveFailure = false;

  function openDb() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB is unavailable. Download encrypted backups instead.'));
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, {keyPath:'id'}); };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error('Secure local storage could not be opened.'));
      request.onblocked = () => reject(new Error('Close other Ciphora tabs and retry local storage.'));
    }).catch(error => { dbPromise = null; throw error; });
    return dbPromise;
  }
  async function listing() {
    const db = await openDb();
    return new Promise((resolve,reject) => {
      const tx=db.transaction(STORE,'readonly'), req=tx.objectStore(STORE).getAll();
      req.onsuccess=()=>resolve((req.result||[]).map(x=>({id:x.id,revision:x.revision||0,updatedAt:x.updatedAt||0})).sort((a,b)=>b.updatedAt-a.updatedAt));
      req.onerror=()=>reject(new Error('Could not read encrypted vault list.'));
    });
  }
  async function getRecord(id) {
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const req=db.transaction(STORE,'readonly').objectStore(STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(new Error('Cannot read encrypted local vault.'));
    });
  }
  async function commit(record, expectedRevision) {
    const db=await openDb();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      const store=tx.objectStore(STORE);
      const read=store.get(record.id);
      let conflict=false;
      read.onsuccess=()=>{
        const old=read.result;
        if ((old?.revision||0)!==expectedRevision) {
          conflict=true;
          tx.abort();
          return;
        }
        store.put({...record,revision:expectedRevision+1});
      };
      tx.oncomplete=()=>resolve(expectedRevision+1);
      tx.onerror=()=>reject(new Error('Failed to save encrypted vault locally. Check available device storage.'));
      tx.onabort=()=>reject(new Error(conflict ? 'Another tab changed this vault. Your changes were NOT overwritten. Export a backup and reopen the latest version.' : 'Local save was cancelled. Export an encrypted backup.'));
    });
  }
  function localVault() { return Boolean(cloud.deviceOnly && String(cloud.selectedVaultId||'').startsWith('device-')); }
  async function saveNow() {
    if (!localVault() || state.locked || !state.vault || !state.vaultKey || !state.vaultMeta) return false;
    if (pending) return pending;
    if (!state.dirty && !hasSaveFailure) return true;
    const user=cloud.userId,id=cloud.selectedVaultId,epoch=cloud.epoch,mutation=cloud.mutation,revision=knownRevision;
    pending=(async()=>{
      try {
        cloudStatus('SAVING ON DEVICE…','warning');
        const envelope=await encryptAndBuildEnvelope();
        if (state.locked || user!==cloud.userId || id!==cloud.selectedVaultId || epoch!==cloud.epoch) return false;
        const next=await commit({id,envelope,updatedAt:Date.now()},revision);
        if (user!==cloud.userId || id!==cloud.selectedVaultId || epoch!==cloud.epoch) return false;
        knownRevision=next;
        hasSaveFailure=false;
        if (mutation===cloud.mutation) {
          setDirty(false);
          cloudStatus('SAVED ON DEVICE');
          setGlobalStatus('Encrypted vault saved on this device. Keep an exported backup for recovery.', 'success');
        }
        return true;
      } catch(error) {
        hasSaveFailure=true;
        cloudStatus('LOCAL SAVE FAILED','error');
        setGlobalStatus(error.message||'Local save failed. Export an encrypted backup now.','error');
        return false;
      }
    })();
    try{return await pending;} finally {
      pending=null;
      if (localVault() && !state.locked && user===cloud.userId && id===cloud.selectedVaultId && state.dirty && !hasSaveFailure) schedule();
    }
  }
  function schedule() {
    if (!localVault() || state.locked || !state.vaultKey) return;
    clearTimeout(debounce);
    debounce=setTimeout(()=>{debounce=null;void saveNow();},450);
  }
  async function flush() {
    clearTimeout(debounce);debounce=null;
    if(pending) await pending;
    if(localVault() && !state.locked && state.dirty) return saveNow();
    return !hasSaveFailure;
  }
  function mapLocalRecords(records) {
    return records.map(item=>({vault_id:item.id,label:'On-device vault · '+item.id.slice(-6),revision:item.revision,updated_at:new Date(item.updatedAt).toISOString()}));
  }
  async function refresh() {
    try {
      const records=await listing();
      if(cloud.localMode) {
        cloud.vaults=mapLocalRecords(records);
        cloud.loaded=true;
        renderVaultDashboard();
      }
      return records;
    } catch(error) {
      if(cloud.localMode) { cloud.loaded=false; cloud.vaults=[]; renderVaultDashboard(); }
      setGlobalStatus(error.message,'error');
      return [];
    }
  }
  async function enter() {
    if (!state.locked || window.PassVaultAuth?.recoveryPending) return;
    if (cloud.userId && !cloud.localMode) {
      setStatus(els.accessStatus,'Sign out of your cloud account before entering standalone device mode.','warning');
      return;
    }
    try { await openDb(); }
    catch(error) {setStatus(els.accessStatus,error.message,'error');return;}
    ++cloud.epoch;
    cloud.localMode=true;cloud.userId=LOCAL_ID;cloud.email='On this device';
    cloud.syncEnabled=false;cloud.deviceOnly=true;cloud.loaded=true;
    cloud.selectedVaultId=null;cloud.vaultLabel='';cloud.conflict=false;
    uiState.accessGranted=true;uiState.accessScreen='dashboard';
    els.signedInIdentity.textContent='On-device mode · no account required';
    await refresh();
    setActiveView();renderVaultDashboard();
    window.dispatchEvent(new Event('passvault-access-change'));
    setGlobalStatus('On-device mode is ready, even without internet. Open or create an encrypted vault.', 'success');
  }
  async function open(id) {
    if (!cloud.loaded || !state.locked || !cloud.localMode) return;
    const record=await getRecord(id);
    if(!record || !record.envelope) throw new Error('Encrypted vault is unavailable on this device.');
    const parsed=parseVaultFileText(JSON.stringify(record.envelope));
    if(parsed.type!=='v2') throw new Error('Unsupported local encryption format.');
    knownRevision=record.revision||0;hasSaveFailure=false;
    cloud.selectedVaultId=id;cloud.revision=0;
    cloud.vaultLabel='On-device vault';cloud.encryptedEnvelope=record.envelope;
    cloud.importSource='device-local';cloud.deviceOnly=true;cloud.lastBackup=null;cloud.conflict=false;
    state.pendingImport=parsed;
    els.selectedFileName.textContent='Encrypted vault stored on this device';
    els.unlockPepperHint.textContent=parsed.record.pepperRequired?'Enter the original secret pepper.':'Enter your original master password.';
    showAccessScreen('unlock');
    window.dispatchEvent(new Event('passvault-access-change'));
  }
  function resetRevision(){ knownRevision=0;hasSaveFailure=false; }
  async function exit(){
    if (!cloud.localMode) return;
    const saved=await flush();
    if(!saved && !state.locked && state.dirty) {
      setGlobalStatus('Local save failed. Export and verify an encrypted backup before leaving on-device mode.','error');
      return false;
    }
    if (!state.locked) await secureLockWithCheckpoint('Local vault locked.');
    clearTimeout(debounce); debounce=null;
    cloud.localMode=false;
    await resetCloudUserState();
    window.dispatchEvent(new Event('passvault-access-change'));
    return true;
  }
  window.CiphoraLocal=Object.freeze({enter,open,refresh,saveNow,schedule,flush,resetRevision,exit,isLocalMode:()=>!!cloud.localMode,isDeviceVault:localVault});
  document.getElementById('ciphoraDeviceEntry')?.addEventListener('click',()=>{void enter();});
})();
