/* Disposable, no-network regression checks for device-only creation, import, and sign-out. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = filename => readFileSync(new URL('../'+filename, import.meta.url),'utf8');
const js = read('src/js/vault.js'), multi = read('src/js/multi-vault.js'), cloudCode = read('src/js/cloud.js');
const html = read('index.html'), approved = read('src/js/approved.js');
function slice(src,start,end) {
  const a=src.indexOf(start),b=src.indexOf(end,a);
  assert(a>=0 && b>a, `Missing function range ${start}`);
  return src.slice(a,b);
}
const elements = Object.fromEntries([
  'createVaultModeBadge','createVaultModeDescription','createVaultButton','newVaultName',
  'dashboardStatus','pvOfflineExitDialog','pvExitCancel'
].map(key=>[key,{value:'',textContent:'',checked:true,open:false}]));
const cloud={userId:'account-a',loaded:true,selectedVaultId:null,vaults:[{vault_id:'cloud-original',revision:5}],
  revision:0,syncEnabled:true,deviceOnly:false,importSource:'cloud',epoch:1,mutation:0,conflict:false,
  lastBackup:null};
const state={locked:true,pendingImport:null,dirty:false,vault:null,vaultMeta:null,vaultKey:null};
const els={newVaultName:elements.newVaultName,createVaultButton:elements.createVaultButton,
  vaultFile:{files:[],value:''},selectedFileName:{textContent:''},unlockPepperHint:{textContent:''},
  unlockStatus:{},createStatus:{},newMaster:{value:'A strong test password'},newPepper:{value:''},
  newPepperEnabled:{checked:false},newKdfProfile:{value:'mobile'}};
let generatedIds=0, mode='', cloudWrites=0, status='', encryptCalls=0;
const ctx={cloud,state,els,uiState:{accessScreen:'dashboard'},window:{dispatchEvent() {},confirm(){return true;}},
  Event:class Event{},setStatus:(target,msg)=>{status=msg;},setGlobalStatus:msg=>{status=msg;},
  clearStatus(){},$:key=>elements[key]||{},crypto:{randomUUID:()=>`id-${++generatedIds}`},
  setActiveView(){},renderVault(){},resetCredentialEditor(){},clearCreateSensitiveFields(){},
  showAccessScreen:screen=>{mode=screen;},
  clearSensitiveFieldsEverywhere(){},parseVaultFileText:()=>({type:'v2',record:{pepperRequired:false}}),
  MAX_VAULT_TEXT_BYTES:1_000_000,setDirty:value=>{state.dirty=value;cloud.mutation++;},
  browserCapabilities:()=>true,validateCreateForm(){},getPreferredKdfProfile:()=>({}),
  randomBytes:()=>new Uint8Array(16),VAULT_SALT_BYTES:16,buildNewVault:name=>({name,credentials:[]}),
  deriveVaultKey:async()=>({opaque:true}),wipeBytes(){},bytesToBase64:()=> 'c2FsdA==',
  CURRENT_FORMAT_VERSION:2,AES_ALGORITHM:'AES-GCM',ARGON2_VERSION:19,ARGON2_TYPE_ID:2,
  ARGON2_OUTPUT_BYTES:32,AES_TAG_LENGTH:128,AAD_PREFIX:'test',
  cloudSave:async()=>{cloudWrites++;return true;},saveCloudVault:async()=>{cloudWrites++;return true;},
  navigator:{onLine:true},Date,console,clearTimeout,setTimeout};
vm.createContext(ctx);
vm.runInContext(slice(cloudCode,'function isCloudSyncAllowed()','function setCloudSyncEnabled('),ctx);
vm.runInContext(slice(multi,'function prepareNewVault()','async function changeAccountPassword('),ctx);
vm.runInContext(slice(js,'async function handleCreateVault(event)','function getPreferredKdfProfile()'),ctx);
ctx.prepareDeviceOnlyVault();
assert.equal(mode,'create');
assert.equal(cloud.selectedVaultId,'device-id-1');
assert.equal(cloud.deviceOnly,true);
assert.equal(cloud.syncEnabled,true,'device-only mode must NOT change normal cloud preference');
assert.equal(ctx.isCloudSyncAllowed(),false,'device-only local ID must never upload');
assert.match(elements.createVaultModeDescription.textContent,/download encrypted backups/i);
assert.equal(cloud.revision,0);
assert.equal(cloud.vaults.length,1);
state.locked=false;
await ctx.handleCreateVault({preventDefault(){}});
assert.equal(cloudWrites,0,'creating a device-only vault must not upload');
assert.equal(state.dirty,true,'new offline vault requires backup');
assert.equal(state.vault.name,'');
assert.equal(cloud.syncEnabled,true,'still have original account preference');
const offlineVaultId=cloud.selectedVaultId;
state.locked=true;state.vault=null;state.dirty=false;
cloud.deviceOnly=false;cloud.importSource='cloud';cloud.selectedVaultId=null;
vm.runInContext(slice(js,'async function handleFileChoose(','async function handleExportVault()'),ctx);
const fakeFile={name:'offline.pvault.json',size:42,text:async()=>'encrypted json'};
await ctx.handleFileChoose(fakeFile);
assert.equal(mode,'unlock');
assert.equal(cloud.deviceOnly,true);
assert.equal(cloud.importSource,'device-file');
assert.equal(cloud.selectedVaultId,'device-id-2');
assert.notEqual(cloud.selectedVaultId,offlineVaultId);
assert.equal(cloud.syncEnabled,true,'import must NOT disable the account-wide cloud preference');
assert.equal(cloudWrites,0);
assert.equal(ctx.isCloudSyncAllowed(),false);
// Even if a future code path forgets the deviceOnly flag, the reserved local ID still blocks uploads.
cloud.deviceOnly=false;
assert.equal(ctx.isCloudSyncAllowed(),false,'local-only IDs must not be promotable into cloud uploads');
// Paused sync must not strand the account at the locked chooser. A newly
// created cloud vault remains local until the user enables sync in Settings.
state.vault=null;state.dirty=false;state.locked=true;
cloud.selectedVaultId=null;cloud.deviceOnly=false;cloud.syncEnabled=false;
ctx.prepareNewVault();
assert.equal(mode,'create','cloud vault creation remains available with sync paused');
assert.equal(cloud.deviceOnly,false);
assert.equal(ctx.isCloudSyncAllowed(),false);
state.locked=false;
await ctx.handleCreateVault({preventDefault(){}});
assert.equal(cloudWrites,0,'paused-sync cloud creation must not call cloud save');
assert.match(status,/not been uploaded/i);
state.locked=true;state.vault=null;state.dirty=false;
cloud.syncEnabled=true;

// Check that the secure-lock checkpoint index can rediscover reserved device IDs.
const recoveryData=new Map();
const recoveryStorage={
 getItem:key=>recoveryData.get(key)??null,setItem:(key,val)=>recoveryData.set(key,String(val)),
 removeItem:key=>recoveryData.delete(key),key:i=>[...recoveryData.keys()][i]??null,
 get length(){return recoveryData.size;}
};
const recoveryCtx=vm.createContext({
 cloud:{userId:'account-a'},localStorage:recoveryStorage,sessionStorage:{getItem:()=>null,setItem:()=>{}},
 crypto:{randomUUID:()=> '11111111-1111-4111-8111-111111111111'},MAX_VAULT_TEXT_BYTES:1024,Date
});
vm.runInContext(slice(js,'/* Encrypted-only recovery','async function secureLockWithCheckpoint('),recoveryCtx);
const deviceRecoveryId='device-22222222-2222-4222-8222-222222222222';
recoveryStorage.setItem(`passvault-encrypted-recovery-v1:account-a:${deviceRecoveryId}:11111111-1111-4111-8111-111111111111`,
 JSON.stringify({version:1,userId:'account-a',vaultId:deviceRecoveryId,revision:0,deviceOnly:true,
  savedAt:Date.now(),envelope:{salt:'opaque-salt',kdf:'Argon2id',ciphertext:'opaque-ciphertext'}}));
assert.equal(recoveryCtx.listUnsyncedNewVaultRecoveries('account-a').length,1,'device-only encrypted recovery must be discoverable');
assert.equal(recoveryCtx.listUnsyncedNewVaultRecoveries('account-a')[0].deviceOnly,true);
// Voluntary sign-out must not lock or contact auth while backup confirmation is refused.
let signedOut=0,locked=0;
const exitCtx=vm.createContext({cloud:{client:{auth:{signOut:async()=>{signedOut++;return {error:null};}}}},
  confirmBackupBeforeSignOut:async()=>false,secureLockWithCheckpoint:async()=>{locked++;},
  resetCloudUserState:async()=>{},setGlobalStatus:()=>{},els:{},setStatus:()=>{}});
vm.runInContext(slice(cloudCode,'async function handleSignOut()','function scheduleCloudRetry()'),exitCtx);
await exitCtx.handleSignOut();
assert.equal(signedOut,0);assert.equal(locked,0);
exitCtx.confirmBackupBeforeSignOut=async()=>true;
await exitCtx.handleSignOut();
assert.equal(signedOut,1);assert.equal(locked,1);
assert(html.includes('id="approvedGateOfflineChoice"'));
assert(!html.includes('id="vaultImportDeviceOnly"'),'master password form must not ask storage-mode question');
for(const id of ['approvedGateOffline','approvedOfflineCreate','approvedOfflineImport','approvedOfflineFile','pvOfflineExitDialog',
 'pvExitPrepareBackup','pvExitBackupDownloadLink','pvExitBackupAcknowledged','pvExitConfirm'])
 assert(html.includes(`id="${id}"`), `Missing accessible offline workflow element: ${id}`);
assert(approved.includes('prepareDeviceOnlyVault();syncVisible();'),'chooser must open device-only creation');
assert(approved.includes('await handleFileChoose(file)'),'chooser must use validated native encrypted-file parser');
assert(js.includes("cloud.lastBackup = exportingMutation === cloud.mutation"),'backup may be considered current only for same mutation');
assert(cloudCode.includes('if (!await confirmBackupBeforeSignOut()) return;'),'sign-out must block until backup acknowledgement');
assert(cloudCode.includes('currentEncryptedBackupReady() && ack.checked'),'acknowledgment must be verified at exit time');
console.log('Offline vault flow passed: local creation, encrypted import, account preference isolation, cloud-upload boundary, and backup-exit UI.');
