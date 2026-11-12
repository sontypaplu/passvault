import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
const root=resolve(import.meta.dirname,'..');
const read=path=>readFileSync(resolve(root,path),'utf8');
const core=read('src/js/core.js'), pwa=read('src/js/pwa.js'),
  db=read('supabase/migrations/20261112000600_require_mfa_for_vault_access.sql'),
  html=read('index.html'),mfa=read('src/js/mfa.js');
for(const path of ['supabase/config.toml','supabase/functions/delete-account/index.ts',
  'supabase/functions/delete-vault/index.ts','supabase/functions/change-account-password/index.ts',
  'supabase/functions/_shared/security.ts','supabase/migrations/20261112000600_require_mfa_for_vault_access.sql'])
  assert(existsSync(resolve(root,path)),`Missing ${path}`);
assert(db.includes("auth.jwt()->>'aal'"),'RLS must check trusted auth claims');
assert(/AS RESTRICTIVE FOR SELECT TO authenticated/.test(db),'MFA/ownership RLS gate must be restrictive to protect against permissive-policy bypass');
assert(db.includes('mfa_required'),'RPC must reject AAL1 writes');
for(const file of ['delete-vault','delete-account','change-account-password']) {
  const code=read(`supabase/functions/${file}/index.ts`);
  assert(code.includes('verifiedAAL2(ctx.jwtClaims)'),'Destructive action lacks server MFA');
  assert(code.includes("cors:'disabled'"),'Default permissive CORS must be disabled');
  assert(code.includes('@1.9.2'),'Server dependency not pinned');
}
assert(!read('supabase/functions/_shared/security.ts').includes("'Access-Control-Allow-Origin': '*'"),
  'No wildcard CORS permitted');
assert(!pwa.includes("setOffline(true);\n        message('Cannot reach PassVault updates'),"),
  'Release-metadata errors must not be global offline');
assert(pwa.includes('updateCheckFailed = true;'));
assert(html.includes('id="pvMfaDialog"')&&html.includes('src="./src/js/mfa.js"'));
assert(mfa.includes('getAuthenticatorAssuranceLevel')&&mfa.includes('mfa.verify('));
assert(core.includes('const HISTORY_PLAINTEXT_BUDGET = 1_400_000'));
const start=core.indexOf('function utf8Length(');
const end=core.indexOf('const HISTORY_ACTIONS',start);
assert(start>0&&end>start);
const pre=core.slice(start,end);
const context={TextEncoder,JSON,Error,validateVaultPlaintext:()=>{}};
vm.createContext(context);vm.runInContext(`const CLOUD_ENVELOPE_MAX_BYTES = 2*1024*1024;const HISTORY_PLAINTEXT_BUDGET=1_400_000;${pre}
this.check=validateCloudEnvelopeSize;this.validate=validateVaultEditBudget;`,context);
const small={ciphertext:'x'.repeat(1500)},large={ciphertext:'x'.repeat(2_097_152)};
assert.equal(context.check(small),true);
assert.throws(()=>context.check(large),/2 MiB/);
assert.equal(context.validate({hello:'ok'}),true);
assert.throws(()=>context.validate({hello:'x'.repeat(1_400_000)}),/capacity/);
// Encrypted per-mutation recovery is written without exposing plaintext or keys.
const vault=read('src/js/vault.js');
const cpStart=vault.indexOf('/* Best-effort encrypted checkpoint');
const cpEnd=vault.indexOf('async function secureLockWithCheckpoint',cpStart);
assert(cpStart>=0&&cpEnd>cpStart);
const records=new Map(), user='test-user',vaultId='test-vault';
const mockCloud={userId:user,selectedVaultId:vaultId,epoch:4,mutation:1,revision:1,deviceOnly:true};
const mockState={vaultKey:{},locked:false,dirty:true};
const recContext={cloud:mockCloud,state:mockState,Promise,JSON,Date,
  recoveryStorageKey:()=>`checkpoint:${user}:${vaultId}`,
  encryptAndBuildEnvelope:async()=>({ciphertext:'encrypted-only',salt:'salt'}),
  localStorage:{setItem:(k,v)=>records.set(k,v),getItem:k=>records.get(k)},
  cloudStatus:()=>{},isCloudSyncAllowed:()=>false};
vm.createContext(recContext);vm.runInContext(vault.slice(cpStart,cpEnd),recContext);
vm.runInContext('scheduleEncryptedRecoveryCheckpoint()',recContext);
await vm.runInContext('recoveryWritePromise',recContext);
const snapshot=records.get(`checkpoint:${user}:${vaultId}`);
assert(snapshot && JSON.parse(snapshot).envelope.ciphertext==='encrypted-only');
assert(!snapshot.includes('test-master-password'));
console.log('Production-hardening unit/static checks passed: encrypted size, MFA, edge boundaries, update isolation, post-edit encrypted recovery.');
