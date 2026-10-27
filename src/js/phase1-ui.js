/* Encrypted Phase 1 recovery interfaces. No plaintext persistence, telemetry or network requests.
 * The underlying vault schema and AES-GCM envelope remain unchanged.
 */
(()=>{
  'use strict';
  const $=id=>document.getElementById(id);
  const list=$('pvRecycleItems'), count=$('pvRecycleCount');
  const file=$('pvBackupVerifyFile'), master=$('pvBackupVerifyMaster'), pepper=$('pvBackupVerifyPepper');
  const status=$('pvBackupVerifyResult'), button=$('pvBackupVerifyButton');
  let verifyRun=0;
  const readable=()=>!state.locked && !!state.vault && !!state.vaultKey && !!uiState.accessGranted;
  const node=(tag,cls,txt)=>{
    const el=document.createElement(tag);
    if(cls)el.className=cls;
    if(txt!==undefined)el.textContent=String(txt);
    return el;
  };
  const labelKind=item=>item.kind==='note'?'Secure note':item.kind==='card'?'Payment card':'Password';
  function refresh(){
    list.replaceChildren();
    if(!readable()) {count.textContent='0 items';return;}
    const entries=[...(state.vault.recycleBin || [])].sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));
    count.textContent=`${entries.length} ${entries.length===1?'item':'items'}`;
    if(!entries.length){list.append(node('p','pv-recovery-empty','Recycle Bin is empty'));return;}
    for(const entry of entries){
      const item=entry.item;
      const row=node('div','pv-recovery-entry');
      const summary=node('div','pv-recovery-entry-info');
      const when=new Date(entry.deletedAt);
      summary.append(node('strong','',item.title || 'Untitled item'),node('small','',`${labelKind(item)} · Deleted ${Number.isFinite(when.getTime())?when.toLocaleString():'Unknown time'}`));
      const actions=node('div','pv-recovery-entry-actions');
      const restore=node('button','btn btn-light','Restore');restore.type='button';
      restore.setAttribute('aria-label',`Restore ${item.title}`);
      restore.addEventListener('click',()=>{
        if(!readable())return clear();
        if(!window.confirm(`Restore “${item.title}” to this encrypted vault?`))return;
        try{restoreVaultRecycleItem(item.id);setDirty(true);renderVault();refresh();window.PassVaultHistoryUI?.refresh();}
        catch(error){window.alert(error.message||'Restore failed. No changes were made.');}
      });
      const remove=node('button','btn btn-light pv-recovery-danger','Delete permanently');remove.type='button';
      remove.setAttribute('aria-label',`Permanently delete ${item.title}`);
      remove.addEventListener('click',()=>{
        if(!readable())return clear();
        const answer=window.prompt(`PERMANENT DELETE: erase “${item.title}” and all of its edit history from this vault? Exported backups may still contain it.\n\nType DELETE to continue.`);
        if(answer!=='DELETE')return;
        try{permanentlyDeleteRecycleItem(item.id);setDirty(true);renderVault();refresh();window.PassVaultHistoryUI?.refresh();}
        catch(error){window.alert(error.message||'Permanent deletion failed. No changes were made.');}
      });
      actions.append(restore,remove);row.append(summary,actions);list.append(row);
    }
  }
  function clear(){
    verifyRun++;
    list.replaceChildren();count.textContent='0 items';
    file.value='';master.value='';pepper.value='';
    $('pvBackupVerifyCredentials').open=false;
    status.textContent='No backup verified yet.';
    button.disabled=false;
  }
  function restoreVersion(itemId,eventId,useBefore){
    if(!readable())return clear();
    if(!window.confirm('Restore this encrypted historical version as the current item? Your current values will be kept in edit history.'))return;
    try{
      const updated=restoreVaultItemHistoryVersion(itemId,eventId,useBefore);
      if(!updated){window.alert('This version is already current; nothing changed.');return;}
      setDirty(true);
      const dialog=$('pvHistoryDialog');if(dialog.open)dialog.close();
      window.PassVaultHistoryUI?.refresh();
      renderVault();
    }catch(error){window.alert(error.message||'Version restore failed. No changes were made.');}
  }
  const sameMetadata=record=>state.vaultMeta &&
    record.salt===state.vaultMeta.salt &&
    record.pepperRequired===state.vaultMeta.pepperRequired &&
    record.algorithm===state.vaultMeta.algorithm &&
    record.kdf===state.vaultMeta.kdf &&
    JSON.stringify(record.parameters)===JSON.stringify(state.vaultMeta.parameters);
  async function verify(event){
    event.preventDefault();
    if(!readable())return clear();
    const chosen=file.files?.[0];
    if(!chosen){status.textContent='Choose an encrypted backup file first.';return;}
    const token=++verifyRun;
    const user=cloud.userId,epoch=cloud.epoch,vaultId=cloud.selectedVaultId,openedVault=state.vault;
    let verified=null;
    button.disabled=true;
    status.textContent='Checking file structure and AES-GCM authentication…';
    try{
      if(chosen.size>MAX_VAULT_TEXT_BYTES)throw new Error('Backup is larger than the permitted maximum.');
      const parsed=parseVaultFileText(await chosen.text());
      if(parsed.type!=='v2')throw new Error('Legacy backup verification requires migration. Open it through the existing import flow instead.');
      const envelope=parsed.record;
      const useCurrent=sameMetadata(envelope);
      let key=null;
      if(useCurrent){key=state.vaultKey;}
      else{
        const password=master.value;
        const secret=pepper.value;
        if(!password){$('pvBackupVerifyCredentials').open=true;throw new Error('This backup uses a different key. Enter its master password to authenticate it.');}
        if(envelope.pepperRequired && !secret)throw new Error('This backup also requires its secret pepper.');
        const salt=base64ToBytes(envelope.salt);
        try{key=await deriveVaultKey(password,salt,envelope.pepperRequired?secret:'',envelope.parameters);}
        finally{wipeBytes(salt);}
      }
      // No import or mutation. Reject if context changes during the KDF/decrypt.
      verified=await decryptVaultPayload(envelope,key);
      if(token!==verifyRun || !readable() || cloud.userId!==user || cloud.epoch!==epoch ||
         cloud.selectedVaultId!==vaultId || state.vault!==openedVault)throw new Error('Verification cancelled because the vault session changed.');
      const sameId=verified.id===state.vault.id;
      status.textContent=`Verified: AES-GCM authentication passed and backup decrypted successfully. ${verified.credentials.length} active items, ${(verified.recycleBin||[]).length} deleted items, ${(verified.editHistory||[]).length} history records. ${sameId?'Same vault ID.':'Different vault ID — this is not your currently unlocked vault.'} Verification does not establish that this is the newest backup. Nothing was imported or replaced.`;
    }catch(error){
      if(token===verifyRun && readable()){
        status.textContent=error.message.startsWith('This backup') || error.message.startsWith('Legacy') || error.message.startsWith('Backup is')?
          error.message:'Verification failed. The password/pepper may be incorrect, the file may be damaged, or it may have been modified. Nothing was imported.';
      }
    }finally{
      verified=null;
      master.value='';pepper.value='';file.value='';
      if(token===verifyRun)button.disabled=false;
    }
  }
  $('pvBackupVerifyForm').addEventListener('submit',verify);
  window.PassVaultPhase1={refresh,clear,restoreVersion};
})();
