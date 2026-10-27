'use strict';
// Account dashboard: vault IDs and labels only. Decrypted secrets never leave browser memory.
let deleteTarget = null;
let deletionBusy = false;

async function reloadVaultList() {
  if (!cloud.client || !cloud.userId) throw new Error('Sign in required');
  const {data,error} = await cloud.client.from('vault_items')
    .select('vault_id,label,revision,created_at,updated_at')
    .eq('user_id',cloud.userId).order('updated_at',{ascending:false});
  if (error) throw error;
  cloud.vaults = data || [];
  return cloud.vaults;
}

function renderVaultDashboard() {
  const list = $('vaultDashboardList');
  const localRecoveries = listUnsyncedNewVaultRecoveries(cloud.userId)
    .filter(draft => !cloud.vaults.some(v => v.vault_id === draft.vaultId));
  const atLimit = cloud.vaults.length >= 2;
  $('dashboardCreateVault').disabled = atLimit;
  $('dashboardCreateVault').textContent = atLimit ? 'Vault limit reached (2/2)' : '+ Create new vault';
  if (!list) return;
  list.replaceChildren();
  if (!cloud.loaded) {
    const msg = document.createElement('p'); msg.className = 'hint';
    msg.textContent = 'Could not load vaults. Check your internet and try Refresh.';
    list.append(msg); return;
  }
  if (!cloud.vaults.length && !localRecoveries.length) {
    const empty = document.createElement('div'); empty.className='empty-state';
    empty.textContent='No cloud vaults yet. Create your first vault to get started.';
    list.append(empty); return;
  }
  for (const draft of localRecoveries) {
    const row = document.createElement('div'); row.className = 'vault-tile';
    const icon = document.createElement('span'); icon.className = 'vault-tile-icon'; icon.textContent = '🔒';
    const text = document.createElement('div'); text.className = 'vault-tile-text';
    const name = document.createElement('strong'); name.textContent = 'Unsynced local vault';
    const sub = document.createElement('small');
    sub.textContent = 'Encrypted on this device only. Unlock to restore and sync to cloud.';
    text.append(name, sub);
    const restore = document.createElement('button'); restore.type = 'button';
    restore.textContent = 'Restore';
    restore.addEventListener('click', () => openUnsyncedNewVaultRecovery(draft.vaultId));
    row.append(icon, text, restore); list.append(row);
  }
  for (const v of cloud.vaults) {
    const row = document.createElement('div'); row.className = 'vault-tile';
    const icon = document.createElement('span'); icon.className='vault-tile-icon'; icon.textContent='🔒';
    icon.setAttribute('aria-hidden','true');
    const text = document.createElement('div'); text.className='vault-tile-text';
    const name = document.createElement('strong'); name.textContent = v.label || 'Encrypted vault';
    const sub = document.createElement('small');
    sub.textContent = `Revision ${v.revision} · Updated ${new Date(v.updated_at).toLocaleString()}`;
    text.append(name,sub);
    const open = document.createElement('button'); open.type='button'; open.textContent='Open';
    open.addEventListener('click',()=>{ void openVaultById(v.vault_id); });
    const remove = document.createElement('button'); remove.type='button'; remove.className='danger'; remove.textContent='Delete';
    remove.setAttribute('aria-label',`Delete ${v.label || 'vault'}`);
    remove.addEventListener('click',()=>requestDeletion('vault',v.vault_id,v.label));
    row.append(icon,text,open,remove); list.append(row);
  }
}

function openUnsyncedNewVaultRecovery(vaultId) {
  if (!cloud.userId || !cloud.loaded || !state.locked) return;
  if (cloud.vaults.some(v => v.vault_id === vaultId)) return;
  const draft = readEncryptedRecovery(cloud.userId, vaultId);
  if (!draft || draft.revision !== 0) return;
  try {
    const parsed = parseVaultFileText(JSON.stringify(draft.envelope));
    if (parsed.type !== 'v2') throw new Error('Recovery format is unsupported');
    cloud.selectedVaultId = vaultId; cloud.revision = 0;
    cloud.vaultLabel = 'Recovered vault'; cloud.encryptedEnvelope = draft.envelope;
    cloud.importSource = 'local-recovery'; cloud.conflict = false;
    state.pendingImport = parsed;
    els.selectedFileName.textContent = 'Encrypted local recovery loaded';
    els.unlockPepperHint.textContent = parsed.record.pepperRequired
      ? 'This recovery requires the original secret pepper.' : 'Enter the original master password.';
    showAccessScreen('unlock');
  } catch (error) {
    setStatus($('dashboardStatus'), 'Cannot open local recovery: ' + (error.message || 'Invalid data'), 'error');
  }
}

function displayVaultDashboard() {
  if (!cloud.userId) return;
  if (!state.locked) {
    lockVault('Manual lock');
    if (!state.locked) return; // Cancelled because changes were unsaved.
  }
  cloud.selectedVaultId = null;
  cloud.revision = 0;
  cloud.vaultLabel = '';
  cloud.encryptedEnvelope = null;
  state.pendingImport = null;
  cloud.conflict = false;
  cloud.importSource = 'cloud';
  clearSensitiveFieldsEverywhere();
  uiState.accessScreen='dashboard';
  setActiveView(); renderVaultDashboard();
}

async function openVaultById(vaultId) {
  if (!cloud.userId || !cloud.loaded || !state.locked) return;
  if (!cloud.vaults.some(v=>v.vault_id === vaultId)) return;
  const epoch=cloud.epoch;
  const userId=cloud.userId;
  setStatus($('dashboardStatus'),'Loading encrypted vault…','warning');
  try {
    const {data,error} = await cloud.client.from('vault_items')
      .select('encrypted_vault,revision,label')
      .eq('user_id',userId).eq('vault_id',vaultId).single();
    if (error) throw error;
    if (epoch!==cloud.epoch || userId!==cloud.userId || !state.locked) return;
    const parsed = parseVaultFileText(JSON.stringify(data.encrypted_vault));
    if (parsed.type !== 'v2') throw new Error('Unsupported encrypted vault format');
    cloud.selectedVaultId=vaultId; cloud.revision=Number(data.revision);
    cloud.vaultLabel=data.label || 'Vault'; cloud.encryptedEnvelope=parsed.record;
    cloud.importSource='cloud'; cloud.conflict=false; state.pendingImport=parsed;
    els.selectedFileName.textContent='Encrypted cloud vault loaded';
    els.unlockPepperHint.textContent=parsed.record.pepperRequired ? 'This vault requires its secret pepper.' : 'Leave blank unless your vault uses a secret pepper.';
    showAccessScreen('unlock');
    clearStatus($('dashboardStatus'));
  } catch(err) { setStatus($('dashboardStatus'),err.message||'Unable to open vault','error'); }
}

function prepareNewVault() {
  if (!cloud.loaded || !cloud.userId || !state.locked) return;
  if (!crypto.randomUUID) return setStatus($('dashboardStatus'),'Your browser does not support secure UUID generation','error');
  if (cloud.vaults.length >= 2) return setStatus($('dashboardStatus'),'Vault limit reached: maximum 2 vaults per account. Delete a vault (after backup) to create another.','error');
  cloud.selectedVaultId=crypto.randomUUID(); cloud.revision=0;
  cloud.encryptedEnvelope=null; cloud.conflict=false; cloud.importSource='cloud';
  cloud.vaultLabel='Vault'; state.pendingImport=null;
  els.newVaultName.value='';
  showAccessScreen('create');
}

async function changeAccountPassword(event) {
  event.preventDefault();
  if(state.dirty) return setGlobalStatus("Save changes or export an encrypted backup before changing your account password.","error");
  const form=$('changeAccountPasswordForm');
  const status=$('accountPasswordStatus');
  const current=$('currentAccountPassword').value;
  const next=$('newAccountPassword').value;
  const confirm=$('confirmNewAccountPassword').value;
  if (!cloud.client || !cloud.userId || !cloud.email) return setStatus(status,'Sign in first','error');
  if (next.length<12 || next!==confirm || current===next) return setStatus(status,'Use a different 12+ character password and matching confirmation','error');
  const submit=form.querySelector('button[type="submit"]'); submit.disabled=true;
  try {
    // Separate non-persistent client checks the current password without changing the signed-in session.
    const verifier=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
      auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
    });
    const {data: verified,error: verifyError}=await verifier.auth.signInWithPassword({email:cloud.email,password:current});
    if (verifyError || verified.user?.id!==cloud.userId) throw new Error('Current account password is incorrect');
    const {error}=await cloud.client.auth.updateUser({password:next});
    if (error) throw error;
    form.reset();
    setStatus(status,'Account password changed. Signing out…','success');
    await handleSignOut();
  } catch(err) {setStatus(status,err.message||'Password update failed','error');}
  finally { $('currentAccountPassword').value=''; $('newAccountPassword').value=''; $('confirmNewAccountPassword').value='';submit.disabled=false; }
}

function requestDeletion(kind,vaultId=null,label='') {
  if (deletionBusy || !cloud.userId) return;
  if (!state.locked && state.dirty) {
    setGlobalStatus('You have unsaved changes. Save to cloud or download an encrypted backup before deletion.','error');
    return;
  }
  if (kind==='vault' && !vaultId) return;
  deleteTarget={kind,vaultId};
  const isAccount = kind==='account';
  $('deleteDialogTitle').textContent=isAccount?'Delete your entire account?':'Delete this vault?';
  $('deleteDialogText').textContent=isAccount
    ? 'This permanently removes your account and ALL cloud vaults. Download encrypted backups first. Provider backups may persist temporarily.'
    : `Permanently delete “${label || 'this vault'}”? Download a backup first. This cannot be undone.`;
  $('deletePhraseLabel').textContent=`Type ${isAccount?'DELETE MY ACCOUNT':'DELETE VAULT'} to confirm`;
  $('deletePassword').value=''; $('deletePhrase').value='';
  clearStatus($('deleteDialogStatus'));
  $('deleteDialog').showModal();
}

function closeDeletionDialog() {
  if (deletionBusy) return;
  $('deletePassword').value='';$('deletePhrase').value='';
  deleteTarget=null; $('deleteDialog').close();
}

async function confirmDeletion(event) {
  event.preventDefault();
  if (!deleteTarget || deletionBusy) return;
  const target=deleteTarget;
  const phrase=target.kind==='account'?'DELETE MY ACCOUNT':'DELETE VAULT';
  const password=$('deletePassword').value;
  if (!password || $('deletePhrase').value!==phrase) {
    return setStatus($('deleteDialogStatus'),`Enter your account password and type ${phrase} exactly`,'error');
  }
  deletionBusy=true;
  $('confirmDeleteButton').disabled=true; $('cancelDeleteButton').disabled=true;
  setStatus($('deleteDialogStatus'),'Verifying password and deleting…','warning');
  try {
    const fn=target.kind==='account'?'delete-account':'delete-vault';
    const {data,error}=await cloud.client.functions.invoke(fn,{
      body: {account_password:password, confirm:phrase, ...(target.kind==='vault'?{vault_id:target.vaultId}:{})}
    });
    if(error) {
      let message=error.message || 'Deletion request failed';
      try { const b=await error.context?.json(); if (b?.error) message=b.error; } catch{}
      throw new Error(message);
    }
    if (!data?.deleted) throw new Error('Deletion not confirmed by server');
    $('deleteDialog').close(); deleteTarget=null;
    if(target.kind==='account') {
      const deletedUserId = cloud.userId;
      await resetCloudUserState();
      purgeEncryptedRecoveriesForContext(deletedUserId);
      try {await cloud.client.auth.signOut({scope:'local'});}catch{}
      setGlobalStatus('Account deleted. Previous exported backups remain on your devices.','success');
      return;
    }
    purgeEncryptedRecoveriesForContext(cloud.userId, target.vaultId);
    if (cloud.selectedVaultId===target.vaultId && !state.locked) {
      // Decrypted contents must be cleared even if currently viewing deleted vault.
      lockVault('Selected vault deleted.');
    }
    if (cloud.selectedVaultId===target.vaultId) {
      cloud.selectedVaultId=null;cloud.revision=0;state.pendingImport=null;
    }
    await reloadVaultList();
    displayVaultDashboard();
    setGlobalStatus('Vault deleted from cloud.','success');
  } catch(err) {
    setStatus($('deleteDialogStatus'),err.message||'Deletion failed','error');
  } finally {
    $('deletePassword').value=''; $('deletePhrase').value='';
    deletionBusy=false;$('confirmDeleteButton').disabled=false;$('cancelDeleteButton').disabled=false;
  }
}

function initializeMultiVaultEvents() {
  $('dashboardCreateVault').addEventListener('click',prepareNewVault);
  $('dashboardRefresh').addEventListener('click',async()=>{
    try { await reloadVaultList();cloud.loaded=true;renderVaultDashboard();clearStatus($('dashboardStatus')); }
    catch(e) {setStatus($('dashboardStatus'),e.message||'Refresh failed','error');}
  });
  for(const id of ['unlockBackButton','createBackButton','allVaultsButton','settingsAllVaultsButton']) {
    $(id).addEventListener('click',displayVaultDashboard);
  }
  $('dashboardDeleteAccount').addEventListener('click',()=>requestDeletion('account'));
  $('settingsDeleteAccount').addEventListener('click',()=>requestDeletion('account'));
  $('settingsDeleteCurrentVault').addEventListener('click',()=>requestDeletion('vault',cloud.selectedVaultId,cloud.vaultLabel));
  $('changeAccountPasswordForm').addEventListener('submit',changeAccountPassword);
  $('deleteConfirmForm').addEventListener('submit',confirmDeletion);
  $('cancelDeleteButton').addEventListener('click',closeDeletionDialog);
  $('deleteDialog').addEventListener('cancel',e=>{if(deletionBusy)e.preventDefault();else deleteTarget=null;});
  // The vault's display label is plaintext metadata, not the encrypted content.
  els.createVaultForm.addEventListener('submit',()=>{
    cloud.vaultLabel=(els.newVaultName.value.trim()||'Vault').slice(0,80);
  });
}
