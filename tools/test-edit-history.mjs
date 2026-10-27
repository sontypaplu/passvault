import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
const source = readFileSync(new URL('../src/js/core.js',import.meta.url),'utf8');
const between = (a,b) => {
  const start=source.indexOf(a),end=source.indexOf(b,start);
  assert(start>=0&&end>start,`Missing ${a}`);
  return source.slice(start,end);
};
const now='2026-10-27T08:00:00.000Z';
const credential = (password, id='item-1') => ({id,title:'Example',url:'https://example.com',username:'test',password,notes:'private note',createdAt:now,updatedAt:now});
const vault = {schemaVersion:1,id:'vault-1',name:'Test',createdAt:now,updatedAt:now,credentials:[credential('original-secret')]};
const state = {locked:false,vault};
const context=vm.createContext({state,TextEncoder,Date,JSON,Object,Set,Error,Number,secureId:()=>crypto.randomUUID()});
vm.runInContext(between('function validateVaultPlaintext(vault) {','function buildNewVault(name) {'),context);
assert.equal(vm.runInContext('validateVaultPlaintext(state.vault)',context),true,'Older vaults must remain valid');
const record = (before,after,action) => {context.OLD=before;context.NEXT=after;context.ACTION=action;return vm.runInContext('recordVaultHistory(OLD, NEXT, ACTION)',context);};
const old=vault.credentials[0],newer={...old,password:'updated-secret',updatedAt:'2026-10-27T09:00:00.000Z'};
assert.equal(record(old,newer,'edited'),true);
assert.equal(vault.editHistory.length,1);
assert.equal(vault.editHistory[0].before.password,'original-secret');
assert.equal(vault.editHistory[0].after.password,'updated-secret');
assert.deepEqual(Array.from(vault.editHistory[0].fields),['password']);
assert.equal(record(newer,newer,'edited'),false,'No-op edits must not make fake history events');
assert.equal(vault.editHistory.length,1);
vault.credentials[0]=newer;
const added=credential('new-item-secret','item-2');
assert.equal(record(null,added,'created'),true);
vault.credentials.push(added);
assert.equal(vault.editHistory.length,2);
vm.runInContext('purgeVaultItemHistory("item-2")',context);
vault.credentials.pop();
assert.equal(vault.editHistory.length,1, 'Permanent item deletion must erase its historical secrets');
assert.equal(vm.runInContext('validateVaultPlaintext(state.vault)',context),true);
const savedEvents=[...vault.editHistory];
vault.editHistory = new Array(2000).fill(null);
assert.throws(()=>record(old,newer,'edited'),/full/);
assert.equal(vault.editHistory.length,2000,'A full history must not silently discard older events');
vault.editHistory=savedEvents;
const event=vault.editHistory[0];
event.before.password=5;
assert.throws(()=>vm.runInContext('validateVaultPlaintext(state.vault)',context),/history field/);
event.before.password='original-secret';

// Exercise the original AES-GCM payload encrypt/decrypt functions with a vault
// containing historical secrets. The resulting envelope contains no plaintext.
const cryptoContext = vm.createContext({
  crypto:crypto.webcrypto, AES_TAG_LENGTH:128, JSON, state, validateVaultPlaintext:v=>vm.runInContext('validateVaultPlaintext(V)',Object.assign(context,{V:v})),
  utf8Encode:s=>new TextEncoder().encode(s),utf8Decode:b=>new TextDecoder().decode(b),
  canonicalAAD:()=> 'PassVault test AAD',
  wipeBytes:bytes=>{if(bytes instanceof Uint8Array)bytes.fill(0);},
  bytesToBase64:bytes=>Buffer.from(bytes).toString('base64'),
  base64ToBytes:s=>new Uint8Array(Buffer.from(s,'base64'))
});
vm.runInContext(between('async function encryptVaultPayload(', 'async function encryptAndBuildEnvelope()'),cryptoContext);
const key=await crypto.webcrypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
const nonce=new Uint8Array(crypto.randomBytes(12));
const meta={version:2,nonceBytes:nonce,nonce:Buffer.from(nonce).toString('base64'),algorithm:'AES-256-GCM',kdf:'Argon2id',parameters:{},salt:'test',pepperRequired:false,authentication:{}};
cryptoContext.K=key;cryptoContext.M=meta;
const ciphertext=await vm.runInContext('encryptVaultPayload(state.vault,K,M)',cryptoContext);
assert(!ciphertext.includes('original-secret')&&!ciphertext.includes('updated-secret'),'No plaintext in encrypted envelope');
cryptoContext.R={...meta,ciphertext};
assert.equal((await vm.runInContext('decryptVaultPayload(R,K)',cryptoContext)).editHistory[0].before.password,'original-secret');
cryptoContext.R.ciphertext=Buffer.from(crypto.randomBytes(64)).toString('base64');
await assert.rejects(vm.runInContext('decryptVaultPayload(R,K)',cryptoContext));

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const theme=readFileSync(new URL('../src/js/theme.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../src/js/history-ui.js',import.meta.url),'utf8');
assert(html.includes('src/js/history-ui.js')&&html.includes('pvHistoryList')&&html.includes('pvHistoryDialog'));
assert(theme.includes("return 'light'"));
assert(!ui.includes('localStorage')&&!ui.includes('sessionStorage')&&!ui.includes('innerHTML'));
for(const file of ['approved.js','premium.js','vault.js']) {
  const code=readFileSync(new URL('../src/js/'+file,import.meta.url),'utf8');
  assert(code.includes('recordVaultHistory('),`History integration missing from ${file}`);
}
console.log('Edit history tests passed: old format, snapshots, change detection, create/permanent-delete purge, no truncation, validation, AES-GCM round trip/tampering, light theme, safe UI rendering.');
