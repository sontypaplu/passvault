import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const vault = read('src/js/vault.js');
const cloudCode=read('src/js/cloud.js');
const core=read('src/js/core.js');
const getBlock=(s,start,end)=>{
  const a=s.indexOf(start),b=s.indexOf(end,a);
  assert(a>=0&&b>a,`Missing block ${start}`);
  return s.slice(a,b);
};
function storage() {
  const data=new Map();
  return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),key:i=>[...data.keys()][i]??null,get length(){return data.size},data};
}
const localStorage=storage(),sessionStorage=storage();
let encryptCalls=0,signOutCalls=0;
const state={locked:false,dirty:true,vault:{credentials:[{password:'very-private-dummy'}]},vaultKey:{},vaultMeta:{},lastActivity:Date.now()-20*60*1000,sessionTimeoutMs:900000};
const cloud={userId:'user-test',selectedVaultId:'vault-test',revision:5,secureLockPromise:null,restoredRecoveryKey:null,conflict:false};
const hidden=new Set();
const context={
  crypto,Date,JSON,localStorage,sessionStorage,MAX_VAULT_TEXT_BYTES:32*1024*1024,
  cloud,state,document:{documentElement:{classList:{add:k=>hidden.add(k),remove:k=>hidden.delete(k)}},hidden:false},
  els:{unlockedView:{inert:false},accessStatus:{}},window:{confirm:()=>true},
  setGlobalStatus:()=>{},cloudStatus:()=>{},navigator:{onLine:false},
  setStatus:()=>{},SUPABASE_URL:'https://sample.supabase.co',
  encryptAndBuildEnvelope:async()=>{encryptCalls++;return {salt:'salt',kdf:'Argon2id',ciphertext:'cipher-not-plaintext'}},
  decryptVaultPayload:async(record)=>{assert.equal(record.ciphertext,'cipher-not-plaintext');return {credentials:[{password:'restored-dummy'}]};},
  lockVault:()=>{state.locked=true;state.dirty=false;state.vault=null;},
  setDirty:val=>{state.dirty=val;},resetCloudUserState:async()=>{},
  clearTimeout,Promise,console
};
const vmContext=vm.createContext(context);
vm.runInContext(getBlock(vault,'/* Encrypted-only recovery','function setDirty(value)'),vmContext);
vm.runInContext(getBlock(vault,'function updateInactivityLock()','function toggleFieldVisibility('),vmContext);
// A newly-created vault that never reached the cloud must still be discoverable.
const newVaultId=crypto.randomUUID();
localStorage.setItem(`passvault-encrypted-recovery-v1:user-test:${newVaultId}:${crypto.randomUUID()}`,
  JSON.stringify({version:1,userId:'user-test',vaultId:newVaultId,revision:0,savedAt:Date.now(),envelope:{salt:'salt',kdf:'Argon2id',ciphertext:'cipher-not-plaintext'}}));
assert.equal(vm.runInContext('listUnsyncedNewVaultRecoveries("user-test").length',vmContext),1);
vm.runInContext('purgeEncryptedRecoveriesForContext("user-test", '+JSON.stringify(newVaultId)+')',vmContext);
assert.equal(vm.runInContext('listUnsyncedNewVaultRecoveries("user-test").length',vmContext),0);
// A failed cloud save MUST lock and preserve encrypted-only recovery.
vm.runInContext('updateInactivityLock()',vmContext);
await vm.runInContext('cloud.secureLockPromise',vmContext);
assert(state.locked,'dirty vault was left unlocked');
assert.equal(hidden.size,0,'privacy shield not removed');
assert.equal(encryptCalls,1);
assert.equal(localStorage.length,1);
const stored=[...localStorage.data.values()][0];
assert(!stored.includes('very-private-dummy'),'PLAINTEXT LEAKED TO LOCAL STORAGE');
assert.equal(JSON.parse(stored).revision,5);
// Recovery copies must survive and be offered after the user re-enters their master password.
state.locked=false;state.dirty=false;state.vault={credentials:[]};
assert.equal(await vm.runInContext("offerEncryptedRecovery({salt:'salt',kdf:'Argon2id'}, {}, 'user-test', 'vault-test')",vmContext),true);
assert.equal(state.vault.credentials[0].password,'restored-dummy');
assert.equal(state.dirty,true);
assert.equal(cloud.conflict,false);
vm.runInContext("deleteEncryptedRecovery('user-test','vault-test')",vmContext);
assert.equal(localStorage.length,0,'successful synchronization should remove recovered checkpoint');
// An expired session must attempt logout AFTER vault contents are cleared.
state.locked=false;state.dirty=true;state.vault={credentials:[{password:'dummy'}]};
cloud.client={auth:{signOut:async()=>{assert(state.locked,'session revoked before lock');signOutCalls++;return {error:null}}}};
vm.runInContext(getBlock(cloudCode,'const ACCOUNT_IDLE_LIMIT_MS =','function scheduleCloudRetry()'),vmContext);
await vm.runInContext('updateAccountInactivity()',vmContext);
assert.equal(signOutCalls,1);
assert(state.locked);
// If browser local storage rejects a write, confidentiality STILL wins.
state.locked=false;state.dirty=true;state.vault={credentials:[]};
const oldWrite=localStorage.setItem;
localStorage.setItem=()=>{throw new Error('quota denied')};
assert.equal(await vm.runInContext("secureLockWithCheckpoint('Lock test')",vmContext),false);
assert(state.locked,'storage failure left plaintext unlocked');
localStorage.setItem=oldWrite;
// Reordering cloud revision must not overwrite newer data without manual reconciliation.
state.locked=false;state.dirty=false;state.vault={credentials:[]};cloud.conflict=false;
localStorage.setItem(`passvault-encrypted-recovery-v1:user-test:vault-test:${crypto.randomUUID()}`,JSON.stringify({version:1,userId:'user-test',vaultId:'vault-test',revision:4,savedAt:Date.now()+10,envelope:{salt:'salt',kdf:'Argon2id',ciphertext:'cipher-not-plaintext'}}));
await vm.runInContext("offerEncryptedRecovery({salt:'salt',kdf:'Argon2id'}, {}, 'user-test','vault-test')",vmContext);
assert(cloud.conflict,'newer cloud revision was not protected');
// Password warnings reject predictable words + years without claiming bit strength.
const pwCtx=vm.createContext({COMMON_PASSWORDS:new Set(['password','123456']),els:{newMaster:{value:''},newMasterStrengthFill:{style:{}},newMasterStrengthText:{}},MAX_MASTER_LENGTH:256,Error});
vm.runInContext(getBlock(core,'const MASTER_OBVIOUS_WORDS','function canonicalAAD('),pwCtx);
for (const bad of ['Password2026!Example','Welcome2026!Secure','Autumn2026!Autumn']) {
  assert.equal(vm.runInContext('evaluateMasterPassword('+JSON.stringify(bad)+').predictable',pwCtx),true);
  assert.throws(()=>vm.runInContext('validateMasterForCreation('+JSON.stringify(bad)+')',pwCtx),/predictable/);
}
assert.doesNotThrow(()=>vm.runInContext('validateMasterForCreation("V6^zQ9.p7@K3eW!n8%S2yR")',pwCtx));
assert(!core.includes('bits by a simple character-set heuristic'));
const sql=read('supabase/migrations/005_harden_avatar_path.sql');
assert(sql.includes("name = (select auth.uid()::text) || '/avatar.webp'"));
console.log('Security regression tests passed: dirty auto-lock, encrypted recovery, never-saved vault discovery, logout order, denied-storage fail-closed, revision protection, strength warnings, avatar path.');
