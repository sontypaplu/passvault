import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read = filename => readFileSync(new URL('../'+filename,import.meta.url),'utf8');
const source=read('src/js/service-icons.js');
const css=read('src/css/service-icons.css');
const html=read('index.html');
const calls=[];
class FakeElement {
  constructor(tag='span'){
    this.tag=tag;this.children=[];this.attributes={};this._text='';this.className='';
    const names=new Set();this.classList={add:(...items)=>items.forEach(x=>names.add(x)),remove:(...items)=>items.forEach(x=>names.delete(x)),contains:key=>names.has(key)};
  }
  replaceChildren(...nodes){this.children=nodes;this._text='';}
  append(child){this.children.push(child);}
  setAttribute(key,value){this.attributes[key]=value;}
  set textContent(value){this.children=[];this._text=String(value);}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
}
const ctx=vm.createContext({window:{},URL,document:{
  createElement:tag=>new FakeElement(tag),createElementNS:(_ns,tag)=>new FakeElement(tag)
},fetch:()=>{calls.push('fetch');throw new Error('unexpected network request');}});
vm.runInContext(source,ctx);
const {iconKeyForURL,mount}=ctx.window.PassVaultServiceIcons;
for(const [url,expected] of [
 ['instagram.com','instagram'],['HTTPS://WWW.INSTAGRAM.COM/p/a?secret=1','instagram'],
 ['https://www.kotak.bank.in/login','kotak'],['kotak.com','kotak'],['kotakbank.com','kotak'],
 ['https://mail.google.com/mail/u/0','gmail'],['google.com','google'],
 ['https://www.amazon.in','amazon'],['github.com','github'],['flipkart.com','flipkart'],
 ['https://www.hdfcbank.com/','hdfc'],['www.youtube.com','youtube']
])assert.equal(iconKeyForURL(url),expected,`${url} did not match ${expected}`);
for(const url of [
 'https://instagram.com.attacker.example','https://instagram.com.evil.test',
 'https://notinstagram.com','https://kotak.com.attacker.com',
 'javascript:alert(1)','file:///tmp/passvault','//instagram.com',
 'http://user:password@instagram.com','https://evil.com@notinstagram.com','',
 'https://some-unlisted-site.example','instagram.com\\@evil.com'
])assert.equal(iconKeyForURL(url),null,`${url} must not receive a trusted brand mark`);
const icon=new FakeElement();
mount(icon,{kind:'login',url:'https://instagram.com/session?token=secret',title:'Private login'});
assert(icon.classList.contains('service-brand-instagram'));
assert.equal(icon.children[0].tag,'svg');
assert(!icon.textContent.includes('secret'));
mount(icon,{kind:'login',url:'https://unknown.example',title:'Unknown service'});
assert.equal(icon.textContent,'U','Unknown sites retain local initials, not outbound icon lookups');
const cardIcon=new FakeElement();
mount(cardIcon,{kind:'card',url:'https://instagram.com',title:'Payment card'});
assert.equal(cardIcon.textContent,'P','A non-login entry must not gain website branding');
assert.equal(calls.length,0,'No icon requests allowed');
assert(html.includes('src/js/service-icons.js') && html.includes('src/css/service-icons.css'));
assert(html.indexOf('src/js/service-icons.js')<html.indexOf('src/js/approved.js'));
assert(html.indexOf('src/js/service-icons.js')<html.indexOf('src/js/premium.js'));
assert(/img-src 'self' blob:/.test(html));
assert(!/cdn\.|https:\/\//.test(css),'Icon stylesheet may not refer to external assets');
assert(!/\.style\.|setAttribute\(['"]style/.test(source),'No dynamic inline styles allowed in icon drawing');
assert(!/\b(fetch\s*\(|XMLHttpRequest|sendBeacon|new\s+Image\s*\()/m.test(source.replace(/\/\*[\s\S]*?\*\//g,'')),'Icon code cannot call the network');
console.log('Private site-icon tests passed: branded domains, spoofed domains, protocol checks, DOM drawing, fallback, no outbound data, CSP and load order.');
