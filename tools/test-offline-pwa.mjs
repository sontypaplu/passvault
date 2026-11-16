/* Source and VM regression for the installed offline app shell. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const get=p=>readFileSync(new URL(p,root),'utf8');
const manifest=JSON.parse(get('manifest.webmanifest'));
const html=get('index.html'),pwa=get('src/js/pwa.js'),sw=get('sw.js'),build=get('tools/build.mjs');
assert.equal(manifest.id,'./','Keep installed app identity stable across rebranding');
assert.equal(manifest.name.startsWith('Ciphora'),true);
assert.equal(manifest.display,'standalone');
assert(existsSync(new URL('sw.js',root)));
assert(html.includes('id="ciphoraDeviceEntry"'));
assert(html.includes('src="./src/js/local-vault.js"'));
assert(html.includes('rel="manifest" href="./manifest.webmanifest"'));
assert(html.includes('src="./src/js/pwa.js"'));
assert(pwa.includes("serviceWorker.register('./sw.js'"));
assert(sw.includes('request.headers.has(\'Authorization\')'));
assert(sw.includes("url.origin !== ROOT.origin"));
assert(sw.includes("url.pathname.endsWith('/app-version.json')"));
assert(sw.includes("request.mode === 'navigate'"));
assert(sw.includes('STATIC_FILES.some'));
assert(!sw.includes('vault_items') && !sw.includes('auth/v1') && !sw.includes('caches.put('));
assert(build.includes('offlineCapable: true'));
assert(build.includes("writeFileSync(join(target,'sw.js')"));
for(const ico of manifest.icons){const path=ico.src.replace(/^\.\//,'');const bytes=readFileSync(new URL(path,root));const n=+ico.sizes.split('x')[0];assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(bytes.readUInt32BE(16),n);assert.equal(bytes.readUInt32BE(20),n);}
const listeners={},nodes=new Map();
function element(id){if(!nodes.has(id))nodes.set(id,{hidden:false,textContent:'',disabled:false,addEventListener(e,cb){listeners['id:'+id+':'+e]=cb;}});return nodes.get(id);}
const navigator={onLine:false,standalone:false,userAgent:'Android Chrome',serviceWorker:{ready:Promise.resolve({}),register:async()=>({update:async()=>{}})}};
const window={matchMedia:()=>({matches:false}),addEventListener(event,cb){listeners[event]=cb;},confirm:()=>true};
const document={baseURI:'https://example.test/ciphora/',hidden:false,getElementById:element,
  querySelector:selector=>selector==='meta[name="passvault-build"]'?{content:'aaaaaaaaaaaaaaaa'}:null,
  addEventListener(event,cb){listeners['doc:'+event]=cb;}};
const state={locked:false,dirty:false,kdfInProgress:false,exportInProgress:false};
const cloud={saveInProgress:false,conflict:false};
let locked=0,fetches=0;
const ctx={navigator,window,document,state,cloud,Date,URL,AbortController,setTimeout,clearTimeout,
 secureLockWithCheckpoint:async()=>{locked++;state.locked=true;},location:{replace(){}},
 fetch:async()=>{fetches++;return {ok:true,json:async()=>({build:'bbbbbbbbbbbbbbbb',offlineCapable:true})};}};
vm.createContext(ctx);vm.runInContext(pwa,ctx,{filename:'src/js/pwa.js'});
assert.equal(element('pvPwaOffline').hidden,true,'Offline UI must not block local vaults');
await window.CiphoraPWA.checkNow();
assert.equal(fetches,0,'Offline version check must not fetch');
assert.equal(state.locked,false,'Going offline must not force-lock local vaults');
navigator.onLine=true;listeners.online();
await window.CiphoraPWA.checkNow();
assert.equal(element('pvPwaUpdateNotice').hidden,false);
console.log('Ciphora offline PWA checks passed: install/manifest, secure static cache, no offline gate, offline-check avoidance, update prompt.');
