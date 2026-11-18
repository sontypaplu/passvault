import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const root = new URL('../',import.meta.url);
const script = readFileSync(new URL('src/js/onboarding.js',root),'utf8');
const html = readFileSync(new URL('index.html',root),'utf8');
const auth = readFileSync(new URL('src/js/auth-pages.js',root),'utf8');
const cloudSrc = readFileSync(new URL('src/js/cloud.js',root),'utf8');
const approved = readFileSync(new URL('src/js/approved.js',root),'utf8');
const vault = readFileSync(new URL('src/js/vault.js',root),'utf8');
const sql = readFileSync(new URL('supabase/migrations/006_privacy_consent.sql',root),'utf8');
for (const id of ['privacyOnboardingScreen','tourOnboardingScreen','emailSentPanel','alPolicyAgree','alPolicyContinue','alTourNext','alTourBack','alTourSkip','alFirstVaultAside','alWorkspaceBack']) {
 assert(html.includes(`id="${id}"`),`Missing ${id}`);
}
assert(!/\splaceholder="/.test(html),'Visual input placeholders should be removed');
assert(auth.includes("route('sent')"),'Forgot password confirmation route missing');
assert(auth.includes('resetPasswordForEmail('),'Supabase reset request missing');
assert(auth.includes('startRecovery()'),'Recovery redirect missing');
assert(approved.includes("['dashboard','unlock'].includes(uiState.accessScreen)"),'Onboarding obscured by existing chooser');
assert(vault.includes("PassVaultOnboarding?.vaultCreated()"),'Successful vault creation does not dismiss onboarding');
assert(cloudSrc.includes('listUnsyncedNewVaultRecoveries(userId)'),'Do not suppress encrypted recovery drafts');
assert(sql.includes('enable row level security') && sql.includes('on delete cascade') && sql.includes('auth.uid()'),'Privacy SQL must isolate per user');
assert(!script.includes('localStorage') && !script.includes('sessionStorage'),'Consent must not be stored only in local browser storage');
class Element {
 constructor(){this.checked=false;this.disabled=true;this.textContent='';this.hidden=false;this.listeners={};this.children=[];this.classList={toggle(){},remove(){}};}
 addEventListener(name,cb){this.listeners[name]=cb;}
 click(){this.listeners.click?.({preventDefault(){}});}
 replaceChildren(...children){this.children=children;}
 append(x){this.children.push(x);}
}
const map=new Map();const el=id=>{if(!map.has(id))map.set(id,new Element());return map.get(id);};
let requests=[], inserts=[], errors=false, display=[], created=0, signsOut=0, clearedCreateFields=0;
const user='00000000-0000-0000-0000-000000000111';
const cloud={userId:user,loaded:true,client:{from:()=>({
 select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>errors?{data:null,error:{message:'offline'}}:{data:requests.length?{policy_version:'2026-11-18-v1'}:null,error:null}})})}),
 insert:async(data)=>{inserts.push(data);return {error:null};}
})}};
const state={locked:true};const uiState={accessGranted:true,accessScreen:'dashboard'};
const context={cloud,state,uiState,
 window:{},document:{getElementById:el,querySelectorAll:selector=>selector.startsWith('#tourOnboardingScreen')?[el('fakeTrack')]:selector==='[data-avenlock-home]'?[el('brand')]:[],createElement:()=>new Element(),querySelector:()=>({click(){}})},
 showAccessScreen(page){uiState.accessScreen=page;display.push(page);},setActiveView(){},prepareNewVault(){created++;},clearCreateSensitiveFields(){clearedCreateFields++;},
 handleSignOut:async()=>{signsOut++;}};
vm.runInNewContext(script,context);
const onboard=context.window.PassVaultOnboarding;
onboard.initialize();
await onboard.begin(user);
assert.equal(uiState.accessScreen,'privacy');assert.equal(onboard.isFirstVault(),true);
assert.equal(el('alPolicyContinue').disabled,true);
el('alTourSkip').click();assert.equal(created,0,'Tour should not bypass consent');
el('alPolicyAgree').checked=true;el('alPolicyAgree').listeners.change();
assert.equal(el('alPolicyContinue').disabled,false);
el('alPolicyContinue').click();
await new Promise(resolve=>setImmediate(resolve));
assert.equal(inserts.length,1);assert.equal(inserts[0].user_id,user);assert.equal(inserts[0].policy_version,'2026-11-18-v1');
assert.equal(uiState.accessScreen,'tour');
el('alTourBack').click();assert.equal(uiState.accessScreen,'privacy');
assert.equal(el('alPolicyContinue').disabled,false,'Must be able to return to tour after acceptance');
el('alPolicyContinue').click();assert.equal(uiState.accessScreen,'tour');
el('alTourSkip').click();assert.equal(created,1);
uiState.accessScreen='create';cloud.selectedVaultId='test-draft';el('brand').click();
assert.equal(clearedCreateFields,1,'Clicking home while creating a vault must clear secret form fields');
assert.equal(cloud.selectedVaultId,null,'Clicking home must abandon the unfinished vault ID');
assert.equal(uiState.accessScreen,'tour','Clicking home must return to the safe onboarding tour');
onboard.vaultCreated();assert.equal(onboard.isFirstVault(),false);
requests.push('accepted');
await onboard.begin(user);assert.equal(uiState.accessScreen,'tour','Existing consent should skip policy');
onboard.clear();errors=true;
await onboard.begin(user);assert.equal(uiState.accessScreen,'privacy');
assert(el('alPolicyStatus').textContent.includes('unavailable'));
el('alPolicyAgree').checked=true;el('alPolicyAgree').listeners.change();
assert.equal(el('alPolicyContinue').disabled,true,'Missing server consent should fail closed');
assert.equal(inserts.length,1);
console.log('Onboarding tests passed: missing/accepted consent, server error fail-closed, security boundaries, tour-back navigation and existing reset routes.');
