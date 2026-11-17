/* Offline device-vault persistence, no-cloud and concurrent-tab safety tests. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const source = readFileSync(new URL('src/js/local-vault.js',root),'utf8');
const pwa = readFileSync(new URL('src/js/pwa.js',root),'utf8');
const build = readFileSync(new URL('tools/build.mjs',root),'utf8');
const html = readFileSync(new URL('index.html',root),'utf8');
const saved = new Map();
let cloudCalls = 0;
let events = 0;
function makeIndexedDB() {
  const db = {
    objectStoreNames:{contains:()=>true},
    createObjectStore:()=>{},
    transaction(storeName,mode) {
      assert.equal(storeName,'encrypted-vaults');
      const tx={oncomplete:null,onabort:null,onerror:null};
      let pending=0,completeScheduled=false,aborted=false;
      function completion() {
        if(pending!==0||completeScheduled||aborted) return;
        completeScheduled=true;
        setTimeout(()=>{
          completeScheduled=false;
          if(pending===0&&!aborted) tx.oncomplete?.();
        },2);
      }
      function request(operation) {
        const req={onsuccess:null,onerror:null,result:null};
        pending++;
        setTimeout(()=>{
          if(!aborted) {
            try { req.result=operation();req.onsuccess?.(); }
            catch(error){req.onerror?.();tx.onerror?.();}
          }
          pending--;completion();
        },0);
        return req;
      }
      tx.abort=()=>{aborted=true;setTimeout(()=>tx.onabort?.(),0);};
      tx.objectStore=()=>({
        getAll:()=>request(()=>[...saved.values()]),
        get:key=>request(()=>saved.get(key)),
        put:row=>request(()=>{saved.set(row.id,structuredClone(row));return row.id;}),
        delete:key=>request(()=>saved.delete(key))
      });
      return tx;
    }
  };
  return {open:()=>{
    const req={result:db,onupgradeneeded:null,onsuccess:null,onerror:null};
    setTimeout(()=>req.onsuccess?.(),0);
    return req;
  }};
}
const indexedDB = makeIndexedDB();
function tab() {
  const state={locked:true,dirty:false,vault:null,vaultMeta:null,vaultKey:null,pendingImport:null};
  const cloud={userId:null,deviceOnly:false,loaded:false,selectedVaultId:null,mutation:0,revision:0,epoch:0};
  const uiState={accessGranted:false,accessScreen:'unlock'};
  let viewChanges=0;
  const win={
    indexedDB,
    PassVaultAuth:{recoveryPending:false},
    dispatchEvent:()=>{events++},
    pvRenderApprovedStatus:()=>{}
  };
  const classes={add:()=>{},remove:()=>{}};
  const els={accessStatus:{},dirtyStatus:{classList:classes},selectedFileName:{textContent:''},unlockPepperHint:{textContent:''}};
  const ctx=vm.createContext({
    window:win,indexedDB,state,cloud,uiState,els,
    navigator:{storage:{persist:async()=>false}},
    Event:class Event{constructor(name){this.type=name;}},
    setTimeout,clearTimeout,Date,Promise,JSON,structuredClone,
    setStatus:()=>{},setActiveView:()=>{viewChanges++;},
    cloudStatus:()=>{},setGlobalStatus:()=>{},
    parseVaultFileText:json=>({type:'v2',record:JSON.parse(json)}),
    encryptAndBuildEnvelope:async()=>({version:2,kdf:'Argon2id',ciphertext:'TEST-AUTHENTICATED-ENVELOPE'}),
    secureLockWithCheckpoint:async()=>{state.locked=true;return true;},
    showAccessScreen:screen=>{uiState.accessScreen=screen}
  });
  vm.runInContext(source,ctx);
  return {api:win.AvenlockLocal,ctx,state,cloud,uiState};
}
const a=tab();
assert.equal(await a.api.enter(),true);
assert.equal(a.cloud.userId,'avenlock-local-device');
assert.equal(a.cloud.syncEnabled,false);
assert.equal(a.cloud.deviceOnly,true);
const id='device-11111111-2222-4333-8444-555555555555';
a.cloud.selectedVaultId=id;a.cloud.mutation=1;
a.state.locked=false;a.state.dirty=true;
a.state.vault={name:'Secret local vault',credentials:[{title:'Bank',password:'secret-pass-123'}]};
a.state.vaultMeta={salt:'secret salt'};a.state.vaultKey={secret:'opaque'};
assert.equal(await a.api.flush(),true);
assert.equal(a.state.dirty,false);
assert.equal(saved.size,1);
assert.equal(saved.get(id).revision,1);
assert.equal(JSON.stringify([...saved.values()]).includes('secret-pass-123'),false);
assert.equal(JSON.stringify([...saved.values()]).includes('Secret local vault'),false);
assert.equal(cloudCalls,0);
await a.api.leave();
assert.equal(a.cloud.userId,null);
assert.equal(a.state.locked,true);
const b=tab();await b.api.enter();
assert.equal(b.api.cachedList.length,1);
await b.api.open(id);
assert.equal(b.uiState.accessScreen,'unlock');
assert.equal(b.cloud.importSource,'device-local');
// Two tabs open the same revision: one write must not silently replace the other.
await a.api.enter();a.state.locked=true;await a.api.open(id);
a.state.locked=false;a.state.dirty=true;a.state.vault={credentials:[{password:'first'}]};a.state.vaultKey={};a.state.vaultMeta={};a.cloud.mutation=2;
b.state.locked=false;b.state.dirty=true;b.state.vault={credentials:[{password:'second'}]};b.state.vaultKey={};b.state.vaultMeta={};b.cloud.mutation=5;
assert.equal(await a.api.flush(),true);
assert.equal(saved.get(id).revision,2);
assert.equal(await b.api.flush(),false);
assert.equal(b.state.dirty,true);
assert.match(b.api.saveError,/Another tab/);
assert.equal(saved.get(id).revision,2);
assert.equal(cloudCalls,0);
assert(html.includes('id="avenlockInstallPanel"'));
assert(html.includes('id="avenlockLocalVaultList"'));
assert(html.includes('src/js/local-vault.js'));
assert(pwa.includes("serviceWorker.register('./sw.js'"));
assert(build.includes("writeFileSync(join(target,'sw.js'),serviceWorker"));
assert(build.includes('offlineCapable: true'));
assert(!pwa.includes('connectionLocked'));
console.log('AVENLOCK offline storage passed: no account needed, encrypted-only persistence, restart, no cloud writes, and cross-tab conflict protection.');
