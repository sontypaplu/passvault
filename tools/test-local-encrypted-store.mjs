/* No-network regression for encrypted IndexedDB storage, reload, revision
 * conflicts and no plaintext persistence. Uses an event-compatible IDB stub. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const code=readFileSync(new URL('../src/js/local-vault.js',import.meta.url),'utf8');
const saved=new Map();
const tick=callback=>queueMicrotask(callback);
const indexedDB={open(){
 const request={result:null};
 tick(()=>{
  const db={
   objectStoreNames:{contains:()=>true},
   transaction(_store,mode){
    const tx={oncomplete:null,onerror:null,onabort:null,abort(){tick(()=>this.onabort?.());},
      objectStore(){return {
       get(id){const r={result:null};tick(()=>{r.result=saved.get(id)||undefined;r.onsuccess?.();});return r;},
       getAll(){const r={result:null};tick(()=>{r.result=[...saved.values()];r.onsuccess?.();});return r;},
       put(item){if(mode!=='readwrite')throw Error('read-only');
         saved.set(item.id,item);tick(()=>tx.oncomplete?.());}
      };}
    };return tx;
   }
  };
  request.result=db;request.onsuccess?.();
 });return request;
}};
let updates=[];const state={locked:false,dirty:true,vault:{name:'My test',credentials:[{password:'NEVER-STORE-PLAIN-TEXT'}]},vaultKey:{},vaultMeta:{}};
const cloud={deviceOnly:true,selectedVaultId:'device-aabbcc00-1122-3344-5566-778899001122',userId:'user',epoch:1,mutation:3,localMode:false,loaded:true};
const ctx={window:{indexedDB,addEventListener(){},dispatchEvent(){},PassVaultAuth:null},indexedDB,document:{getElementById:()=>null},
 state,cloud,queueMicrotask,clearTimeout,setTimeout,Date,Promise,console,
 encryptAndBuildEnvelope:async()=>({version:2,kdf:'Argon2id',nonce:'unique-nonce-'+cloud.mutation,ciphertext:'authenticated-encrypted-content'}),
 setDirty:value=>{state.dirty=Boolean(value);},cloudStatus:(msg)=>updates.push(msg),setGlobalStatus:(msg)=>updates.push(msg),
 renderVaultDashboard(){},setActiveView(){},secureLockWithCheckpoint:async()=>{},resetCloudUserState:async()=>{},
 Event:class Event{constructor(type){this.type=type;}}};
vm.createContext(ctx);vm.runInContext(code,ctx);
const store=ctx.window.CiphoraLocal;
assert(store.isDeviceVault());
assert.equal(await store.saveNow(),true);
assert.equal(state.dirty,false);
assert.equal(saved.size,1);
const actual=[...saved.values()][0];
assert.equal(actual.revision,1);
assert(actual.envelope.ciphertext);
assert.equal(JSON.stringify(actual).includes('NEVER-STORE-PLAIN-TEXT'),false,'plaintext persisted');
assert.equal(JSON.stringify(actual).includes('My test'),false,'vault label persisted plaintext');
const entries=await store.refresh();
assert.equal(entries.length,1);
assert.equal(entries[0].revision,1);
// Each update increments local revision without replacing unrelated ciphertext.
cloud.mutation++;state.dirty=true;
assert.equal(await store.saveNow(),true);
assert.equal(saved.get(cloud.selectedVaultId).revision,2);
// A second tab with an old revision must not overwrite saved changes.
store.resetRevision();cloud.mutation++;state.dirty=true;
assert.equal(await store.saveNow(),false);
assert.equal(saved.get(cloud.selectedVaultId).revision,2);
assert.equal(state.dirty,true);
assert(updates.some(x=>x.includes('Another tab changed')));
console.log('Ciphora encrypted local-store tests passed: AES envelope only, save, list, revision increment, conflict rejection.');
