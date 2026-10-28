/* Targeted regression checks for the upload boundary. No real credentials or network. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root=path.resolve(import.meta.dirname,'..');
const code=fs.readFileSync(path.join(root,'src/js/cloud.js'),'utf8');
const vaultCode=fs.readFileSync(path.join(root,'src/js/vault.js'),'utf8');
const approved=fs.readFileSync(path.join(root,'src/js/approved.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'src/css/approved.css'),'utf8');
let uploads=0,encrypts=0, messages=[];
const store=new Map();
const cloud={userId:'test-user',selectedVaultId:'cloud-uuid',vaultLabel:'Test',
  loaded:true,revision:1,mutation:0,epoch:1,savePromise:null,saveTimer:null,
  retryTimer:null,conflict:false,deviceOnly:false,syncEnabled:false,saveInProgress:false,
  retryAttempt:0,client:{rpc:async()=>{uploads++;return {data:2,error:null};}}};
const state={locked:false,dirty:true,vault:{name:'Test'},vaultKey:{},vaultMeta:{},kdfInProgress:false};
const ctx={cloud,state,window:{addEventListener(){},dispatchEvent(){}},
  document:{addEventListener(){},hidden:false},
  localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
  Event:class Event{constructor(type){this.type=type;}},
  els:{cloudSyncStatus:{textContent:'',classList:{toggle(){}}}},
  setGlobalStatus:msg=>messages.push(msg),
  setDirty:val=>{state.dirty=val;},deleteEncryptedRecovery:()=>{},
  reloadVaultList:async()=>{},renderVaultDashboard:()=>{},
  encryptAndBuildEnvelope:async()=>{encrypts++;return {encrypted:'opaque'};},
  navigator:{onLine:true},clearTimeout, setTimeout,Date,console};
vm.createContext(ctx);vm.runInContext(code,ctx,{filename:'cloud.js'});
assert.equal(ctx.window.PassVaultSync.allowed(),false);
assert.equal(await ctx.saveCloudVault(true),false);
assert.equal(uploads,0,'sync off must never upload');
cloud.syncEnabled=true;cloud.deviceOnly=true;
assert.equal(await ctx.saveCloudVault(true),false);
assert.equal(uploads,0,'device-only vault must never upload even if sync flag is on');
assert.equal(ctx.window.PassVaultSync.setEnabled(true),false,'device-only cannot be promoted to cloud');
cloud.deviceOnly=false;cloud.syncEnabled=true;
let resume;
ctx.encryptAndBuildEnvelope=()=>new Promise(resolve=>{resume=resolve;});
const saving=ctx.saveCloudVault(false);
await Promise.resolve();
assert.equal(typeof resume,'function','in-flight save must reach encryption');
ctx.window.PassVaultSync.setEnabled(false);
resume({encrypted:'opaque'});
assert.equal(await saving,false);
assert.equal(uploads,0,'sync switched off during encryption must block RPC');
cloud.syncEnabled=true;ctx.encryptAndBuildEnvelope=async()=>({encrypted:'opaque'});
assert.equal(await ctx.saveCloudVault(true),true);
assert.equal(uploads,1,'explicit cloud save must still work when enabled');
assert.equal(cloud.revision,2);
for(const id of ['pvPwaInstallLogin','pvPwaInstallLocked','vaultImportDeviceOnly','vaultSyncToggle','pvOverviewSyncToggle','pvSettingsSyncToggle','pvMobileSearchButton','pvOverviewBackupLink','pvSettingsBackupLink'])
  assert(html.includes(`id="${id}"`),`Missing UI control: ${id}`);
assert(approved.includes('requestAnimationFrame(mobileDragFrame)'), 'edge auto scroll RAF missing');
assert(approved.includes("document.addEventListener('touchmove'"),'touch move listener missing');
assert(approved.includes("drag.kind==='item'"),'item drop missing');
assert(approved.includes('reorderBasket(drag.id,drag.target)'),'basket reorder missing');
assert(css.includes('#approvedUI .topbar #openMenu{display:none}'),'duplicate mobile menu not hidden');
assert(css.includes('#approvedUI .topbar #themeToggle{display:grid'),'mobile theme must be visible');
assert(vaultCode.includes('cloud.importSource = deviceOnly ? "device-file" : "file"'),'device-only import is isolated');
assert(vaultCode.includes("if (isCloudSyncAllowed()) scheduleCloudSave()"),'dirty-state upload scheduling must be gated');
assert(vaultCode.includes('deviceOnly: Boolean(cloud.deviceOnly)'),'encrypted recovery must retain device-only marker');
console.log('Device-only / cloud-sync checks passed: off, isolated, mid-flight stop, enabled upload, encrypted recovery, responsive hooks.');
