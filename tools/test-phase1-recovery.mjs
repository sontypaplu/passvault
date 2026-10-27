import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const core=read('src/js/core.js');
const start=core.indexOf('function validateVaultPlaintext(vault) {');
const end=core.indexOf('function buildNewVault(name) {',start);
assert(start>0&&end>start);
const stamp='2026-10-27T13:00:00.000Z';
const credential=(id,password)=>({id,title:'Test '+id,url:'https://example.test',username:'sample',password,notes:'Secret note',createdAt:stamp,updatedAt:stamp,kind:'login',favorite:false,tags:['private'],customFields:[]});
const state={locked:false,vault:{schemaVersion:1,id:'vault-1',name:'Encrypted test',createdAt:stamp,updatedAt:stamp,credentials:[credential('one','secret-one'),credential('two','secret-two')]}};
let dirty=false;
const context=vm.createContext({state,TextEncoder,Date,JSON,Object,Set,Error,Number,secureId:()=>crypto.randomUUID()});
vm.runInContext(core.slice(start,end),context);
const run=(expr)=>vm.runInContext(expr,context);
assert.equal(run('validateVaultPlaintext(state.vault)'),true,'pre-feature vault compatibility');
assert.equal(run('moveVaultItemToRecycleBin("one")'),true);
assert.equal(state.vault.credentials.length,1);
assert.equal(state.vault.recycleBin[0].item.password,'secret-one');
assert.equal(state.vault.editHistory[0].action,'deleted');
assert.equal(run('validateVaultPlaintext(state.vault)'),true);
assert.equal(run('restoreVaultRecycleItem("one")'),true);
assert.equal(state.vault.credentials.length,2);
assert.equal(state.vault.credentials.find(x=>x.id==='one').password,'secret-one');
assert.equal(state.vault.recycleBin.length,0);
assert.equal(state.vault.editHistory.at(-1).action,'restored');
assert.equal(run('validateVaultPlaintext(state.vault)'),true);
const existing=state.vault.credentials.find(x=>x.id==='one');
const changed={...existing,password:'changed-password',notes:'changed note'};
context.before=existing;context.after=changed;
assert.equal(run('recordVaultHistory(before,after,"edited")'),true);
state.vault.credentials=state.vault.credentials.map(x=>x.id==='one'?changed:x);
const previousEvent=state.vault.editHistory.find(x=>x.action==='edited');
context.historyId=previousEvent.id;
assert.equal(run('restoreVaultItemHistoryVersion("one",historyId,true)'),true);
assert.equal(state.vault.credentials.find(x=>x.id==='one').password,'secret-one');
assert.equal(state.vault.credentials.find(x=>x.id==='one').notes,'Secret note');
assert.equal(state.vault.editHistory.at(-1).before.password,'changed-password');
assert.equal(state.vault.editHistory.at(-1).after.password,'secret-one');
assert.equal(run('restoreVaultItemHistoryVersion("one",historyId,true)'),false,'same value restore no-op');
// Permanent deletion is explicit, removes both deleted item AND history.
run('moveVaultItemToRecycleBin("one")');
run('permanentlyDeleteRecycleItem("one")');
assert.equal(state.vault.credentials.some(x=>x.id==='one'),false);
assert.equal(state.vault.recycleBin.length,0);
assert.equal(state.vault.editHistory.some(x=>x.itemId==='one'),false);
assert.equal(run('validateVaultPlaintext(state.vault)'),true);
// Reject malformed recycle bin entries with no mutation of active items.
state.vault.recycleBin=[{item:credential('two','duplicate'),deletedAt:stamp}];
assert.throws(()=>run('validateVaultPlaintext(state.vault)'),/recycle bin entry/);
state.vault.recycleBin=[];
state.vault.editHistory=new Array(2000).fill(null);
assert.throws(()=>run('moveVaultItemToRecycleBin("two")'),/history is full/i);
assert.equal(state.vault.credentials.length,1,'full history must not cause partial deletion');
state.vault.editHistory=[];
// Too many deleted entries fail atomically (no silent eviction).
state.vault.recycleBin=Array.from({length:20},(_,i)=>({item:credential('deleted-'+i,'prior'),deletedAt:stamp}));
assert.equal(run('validateVaultPlaintext(state.vault)'),true);
assert.throws(()=>run('moveVaultItemToRecycleBin("two")'),/Recycle Bin is full/);
assert.equal(state.vault.credentials.length,1);
state.vault.recycleBin=[];
// 10 active items prevents restoring from bin without removing anything.
run('moveVaultItemToRecycleBin("two")');
state.vault.credentials=Array.from({length:10},(_,i)=>credential('active-'+i,'current'));
assert.throws(()=>run('restoreVaultRecycleItem("two")'),/Vault is full/);
assert.equal(state.vault.recycleBin.length,1);
const html=read('index.html'),ui=read('src/js/phase1-ui.js'),approved=read('src/js/approved.js');
assert(html.includes('data-settings-section="recycle"')&&html.includes('pvBackupVerifyForm')&&html.includes('src/js/phase1-ui.js'));
assert(ui.includes('decryptVaultPayload(envelope,key)')&&ui.includes('renderVault()')&&ui.includes('restoreVaultItemHistoryVersion'));
assert(!ui.includes('localStorage')&&!ui.includes('sessionStorage')&&!ui.includes('innerHTML'));
for(const code of [approved,read('src/js/premium.js'),read('src/js/vault.js')])assert(code.includes('moveVaultItemToRecycleBin('));
// AES-GCM integration for deleted data: plaintext never appears in the envelope.
const cryptVault={schemaVersion:1,id:'sealed-vault',name:'Sealed',credentials:[],recycleBin:[{deletedAt:stamp,item:credential('archived','old-plaintext-password')}],editHistory:[]};
const cryptoContext=vm.createContext({
  crypto:crypto.webcrypto,AES_TAG_LENGTH:128,JSON,
  validateVaultPlaintext:v=>vm.runInContext('validateVaultPlaintext(V)',Object.assign(context,{V:v})),
  utf8Encode:s=>new TextEncoder().encode(s),utf8Decode:b=>new TextDecoder().decode(b),
  canonicalAAD:()=> 'Phase1 authenticated vault',wipeBytes:b=>{if(b instanceof Uint8Array)b.fill(0)},
  bytesToBase64:b=>Buffer.from(b).toString('base64'),
  base64ToBytes:s=>new Uint8Array(Buffer.from(s,'base64'))
});
const cryptStart=core.indexOf('async function encryptVaultPayload(');
const cryptEnd=core.indexOf('async function encryptAndBuildEnvelope()',cryptStart);
vm.runInContext(core.slice(cryptStart,cryptEnd),cryptoContext);
const key=await crypto.webcrypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
const iv=new Uint8Array(crypto.randomBytes(12));
const meta={version:2,algorithm:'AES-256-GCM',kdf:'Argon2id',parameters:{},salt:'salt',nonce:Buffer.from(iv).toString('base64'),nonceBytes:iv,authentication:{},pepperRequired:false};
cryptoContext.VAULT=cryptVault;cryptoContext.K=key;cryptoContext.M=meta;
const enc=await vm.runInContext('encryptVaultPayload(VAULT,K,M)',cryptoContext);
assert(!enc.includes('old-plaintext-password'));
cryptoContext.R={...meta,ciphertext:enc};
assert.equal((await vm.runInContext('decryptVaultPayload(R,K)',cryptoContext)).recycleBin[0].item.password,'old-plaintext-password');
cryptoContext.R.ciphertext=Buffer.from(crypto.randomBytes(64)).toString('base64');
await assert.rejects(vm.runInContext('decryptVaultPayload(R,K)',cryptoContext),'tampered recycle ciphertext must fail');
console.log('Phase 1 regression tests passed: backwards compatibility, soft delete, recycle, restore, full history, atomicity, prior-version recovery, 10-item cap, privacy boundaries and UI hooks.');
