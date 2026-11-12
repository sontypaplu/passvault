import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFileSync(join(root,file),'utf8');
const manifest = JSON.parse(read('manifest.webmanifest'));
const html = read('index.html');
const code = read('src/js/pwa.js');
const build = read('tools/build.mjs');
assert.equal(manifest.display,'standalone');
assert.equal(manifest.scope,'./');
assert.equal(manifest.start_url,'./');
assert.equal(manifest.id,'./');
assert(manifest.icons.some(i => i.sizes === '192x192'));
assert(manifest.icons.some(i => i.sizes === '512x512'));
for (const ico of manifest.icons) {
  const path = ico.src.replace(/^\.\//,'');
  assert(existsSync(join(root,path)),`Missing ${path}`);
  const png = readFileSync(join(root,path));
  assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
  const dim = Number(ico.sizes.split('x')[0]);
  assert.equal(png.readUInt32BE(16),dim);
  assert.equal(png.readUInt32BE(20),dim);
}
assert(html.includes('rel="manifest" href="./manifest.webmanifest"'));
assert(html.includes("manifest-src 'self'"));
assert(html.includes('src="./src/js/pwa.js"'));
// Same-origin fetch() calls are governed by connect-src, not script-src.
// Without 'self', a GitHub Pages build cannot fetch its app-version.json and
// incorrectly blocks the whole online-only login screen.
const sourceCsp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
assert(sourceCsp, 'Missing source Content Security Policy');
const connectionDirective = sourceCsp.match(/(?:^|;\s*)connect-src\s+([^;]+)/)?.[1] ?? '';
assert(connectionDirective.split(/\s+/).includes("'self'"),
  'CSP connect-src must allow same-origin PWA release checks');

assert(!existsSync(join(root,'sw.js')),'No service worker is permitted for online-only mode');
assert(!/serviceWorker\.register|caches\.open|cache\.put|addAll\(/.test(code),'Offline caching introduced');
assert(build.includes('app-version.json'));
assert(build.includes('pv=${buildId}'));
assert(!code.includes('localStorage') && !code.includes('sessionStorage'),'PWA manager should not store user data');

const oldBuild = 'aaaaaaaaaaaaaaaa';
const newBuild = 'bbbbbbbbbbbbbbbb';
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id,{ hidden:false, textContent:'', disabled:false, listeners:{},addEventListener(event,cb){this.listeners[event]=cb;}});
  return elements.get(id);
}
const listeners = {};
const document = {
  baseURI:'https://example.test/PassVault/index.html', hidden:false,
  getElementById:element,
  querySelector(selector){return selector === 'meta[name="passvault-build"]' ? {content:oldBuild}:null;},
  addEventListener(event,cb){listeners[`doc:${event}`]=cb;}
};
let fetched = [];
let connected = true;
let reload = '';
let confirmations = 0;
let lockCalls = 0;
const state = {locked:true,dirty:false,kdfInProgress:false,exportInProgress:false};
const cloud = { saveInProgress:false, conflict:false };
const window = {
  matchMedia:()=>({matches:false}),
  addEventListener(event,cb){listeners[event]=cb;},
  confirm:()=>{confirmations++;return true;}
};
const navigator = {onLine:true,standalone:false,userAgent:'Mozilla Chrome Desktop'};
const location = {replace(url){reload=url;}};
const fakeFetch = async (url,options) => {
  fetched.push({url,options});
  if (!connected) throw new Error('Offline');
  return {ok:true,json:async()=>({version:'3.1.0',build:newBuild,onlineOnly:true})};
};
const context = {window,document,navigator,location,state,cloud,console,URL,AbortController,
  setTimeout,clearTimeout,Date,fetch:fakeFetch,
  lockVault:()=>{lockCalls++;state.locked=true;},
  secureLockWithCheckpoint:()=>{state.locked=true;return Promise.resolve(true);}
};
vm.runInNewContext(code,context,{filename:'src/js/pwa.js'});
await window.PassVaultPWA.checkNow();
assert(fetched.length>0,'Expected network release check');
assert.equal(fetched.at(-1).options.cache,'no-store');
assert.equal(fetched.at(-1).options.credentials,'omit');
assert.equal(element('pvPwaUpdateNotice').hidden,false);
assert.equal(element('pvPwaLoginUpdate').hidden,false,'login must offer update in installed app');
assert.equal(element('pvPwaGateUpdate').hidden,false,'vault chooser native dialog must offer update');
assert(html.includes('id="pvPwaLoginUpdateAction"') && html.includes('id="pvPwaGateUpdateAction"'),'Update actions must be accessible on locked screens');
assert.equal(element('pvPwaOffline').hidden,true);
assert.equal(window.PassVaultPWA.updateNow(),true);
assert.equal(reload,'https://example.test/PassVault/?pv_app='+newBuild);
reload='';state.locked=false;state.dirty=true;
assert.equal(window.PassVaultPWA.updateNow(),false,'Dirty vault must prevent update');
await window.PassVaultPWA.checkNow();
assert.equal(element('pvPwaNoticeText').textContent.includes('Export an encrypted backup'),true,'unsynced edits must show backup-first guidance');
assert.equal(reload,'');
state.dirty=false;cloud.conflict=true;
assert.equal(window.PassVaultPWA.updateNow(),false,'Sync conflict must prevent update');
cloud.conflict=false;cloud.saveInProgress=true;
assert.equal(window.PassVaultPWA.updateNow(),false,'In-flight save must prevent update');
cloud.saveInProgress=false;
assert.equal(window.PassVaultPWA.updateNow(),true,'Clean unlocked vault can be locked by confirmation');
assert.equal(lockCalls,1);
assert.equal(confirmations,2);
assert.equal(state.locked,true);
reload='';state.locked=false;
listeners.offline();
assert.equal(element('pvPwaOffline').hidden,false,'Offline must obscure vault');
assert.equal(state.locked,true,'Offline must lock vault');
assert.equal(window.PassVaultPWA.updateNow(),false,'No updates offline');
connected=true;navigator.onLine=true;
await window.PassVaultPWA.checkNow();
assert.equal(element('pvPwaOffline').hidden,true,'Network recovery restores locked sign-in view');
console.log('Online-only PWA tests passed: manifest/icons, no service worker/cache, release checks, blocked unsafe updates, locked update, offline protection.');
