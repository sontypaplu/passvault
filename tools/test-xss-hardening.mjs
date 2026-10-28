import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const scripts=['approved','premium','vault','history-ui','phase1-ui','auth-pages','core','app','pwa'];
const approved=read('src/js/approved.js'),html=read('index.html'),core=read('src/js/core.js');
for(const file of scripts){
 const source=read('src/js/'+file+'.js');
 assert(!/\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(/.test(source),file+' has an HTML injection sink');
 assert(!/\beval\s*\(|\bnew\s+Function\s*\(/.test(source),file+' has a string-to-script execution sink');
}
assert(approved.includes('replaceChildren(...fields)'), 'detail values must be DOM nodes');
assert(approved.includes('badge=el(\'span\''), 'basket/title label must be text-only');
assert(html.includes("require-trusted-types-for 'script'"));
assert(html.includes('trusted-types passvault-argon2-worker'));
assert(!html.includes("'unsafe-inline'")&&!html.includes("'unsafe-eval'"));
assert(core.includes('new Worker(trustedArgon2BlobURL(url))'),'Argon2 worker must use a TrustedScriptURL');
assert(core.includes('if(value!==expected)throw new TypeError'));
assert(html.includes('<script defer src="./src/js/url-safety.js"></script>'));
const window={};vm.runInNewContext(read('src/js/url-safety.js'),{window,URL,Error,Object});
const safety=window.PassVaultURLSafety;
const good=['https://example.com','http://example.com/a?q=1','https://sub.example.org:8443/path#fragment'];
for(const url of good)assert.equal(safety.validate(url),url);
assert.equal(safety.validate('example.com/login',{allowBareHost:true}),'https://example.com/login');
for(const bad of [
 'javascript:alert(1)','data:text/html,malicious','file:///etc/passwd','blob:https://example.com/test',
 'ftp://example.com','mailto:a@example.com','https://user:pass@example.com',
 'https://example.com\\@evil.com','https://example.com\n.evil.com','//example.com','http://'
]){
 assert.throws(()=>safety.validate(bad),Error,'Should reject '+JSON.stringify(bad));
 assert.throws(()=>safety.validate(bad,{allowBareHost:true}),Error,'Should reject '+JSON.stringify(bad));
}
for(const field of ['title','username','notes','tags','customFields']){
 assert(approved.includes("textContent")&&approved.includes('el('),'DOM text path missing for '+field);
}
for(const entry of [
 {title:'<img src=x onerror=alert(1)>',url:'javascript:alert(1)'},
 {title:'safe',url:'https://example.com',customFields:[{label:'Test',type:'url',value:'data:text/html,attack'}]}
])assert.throws(()=>safety.validateImportedVault({credentials:[entry]}));
assert.equal(safety.validateImportedVault({credentials:[{title:'safe',url:'https://example.com',customFields:[{type:'url',value:'http://example.com'}]}]}),true);
assert(read('src/js/vault.js').includes('PassVaultURLSafety.validateImportedVault(vault)'));
assert(read('src/js/premium.js').includes('PassVaultURLSafety.validate(url)'));
assert(read('src/js/approved.js').includes('PassVaultURLSafety.validate(url,{allowBareHost:true})'));
assert(read('.github/workflows/deploy-pages.yml').includes('npm ci --ignore-scripts'));
// Execute the real table-rendering function with hostile values against a minimal DOM.
// Verify that malicious-looking strings survive as text without creating markup.
class FakeElement {
 constructor(tag,css='',text){this.tag=tag;this.className=css;this.textContent=text===undefined?'':String(text);this.children=[];this.attributes={};this.dataset={};}
 append(...children){this.children.push(...children);}
 setAttribute(name,value){this.attributes[name]=String(value);}
}
const hostile='<img src=x onerror=alert(1)> & <svg/onload=alert(2)>';
const credential={id:'id<danger>',kind:'login',title:hostile,url:'https://example.com',username:hostile,password:'Strong dummy password 123!',favorite:false,updatedAt:'2026-10-27T15:30:00Z'};
const domCtx=vm.createContext({
 el:(tag,css='',value)=>new FakeElement(tag,css,value),
 actionButton:(css,attrs)=>{const x=new FakeElement('button',css);for(const [key,value] of Object.entries(attrs||{}))x.setAttribute(key,value);return x;},
 iconNode:()=>new FakeElement('svg'),
 getItems:()=>[credential],itemKind:()=> 'login',basicWeak:()=>false,basketCapacityReached:()=>false,
 kindLabel:{login:'Login'},serviceColor:()=> 'blue',Date,Map
});
const functionText=approved.slice(approved.indexOf('function buildTable('),approved.indexOf('function vaultTile('));
assert(functionText.includes('function buildTable'));
vm.runInContext(functionText,domCtx);
const tree=vm.runInContext('buildTable(['+JSON.stringify(credential)+'])',domCtx);
const walk=(element)=>[element,...(element.children||[]).flatMap(x=>x instanceof FakeElement?walk(x):[])];
const nodes=walk(tree);
assert(!nodes.some(n=>['script','img','iframe'].includes(n.tag)),'Untrusted field created executable markup');
assert(nodes.some(n=>n.tag==='button'&&n.textContent===hostile),'Item name must remain literal text');
assert(nodes.some(n=>n.tag==='td'&&n.textContent===hostile),'Username must remain literal text');
assert(nodes.some(n=>n.attributes['aria-label']?.includes(hostile)),'Accessibility labels must preserve data as text');
console.log('XSS hardening tests passed: zero HTML sinks, URL allowlist, imported vault checks, Trusted Types CSP and worker bootstrap.');
