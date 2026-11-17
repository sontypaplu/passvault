import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/js/history-ui.js',import.meta.url),'utf8');
class Element {
  constructor(tag='div'){
    this.tag=tag;this.children=[];this.listeners={};this.attributes={};this._text='';this.hidden=false;this.open=false;
    const names=new Set();this.classList={add:(k)=>names.add(k),remove:(k)=>names.delete(k),toggle:(k)=>{if(names.has(k)){names.delete(k);return false;}names.add(k);return true;}};
  }
  set textContent(s){this._text=String(s);this.children=[];}
  get textContent(){return this._text+this.children.map(n=>n.textContent??'').join('');}
  append(...parts){this.children.push(...parts);}
  replaceChildren(...parts){this.children=parts;this._text='';}
  setAttribute(k,v){this.attributes[k]=v;}
  addEventListener(name,fn){this.listeners[name]??=[];this.listeners[name].push(fn);}
  click(){for(const fn of this.listeners.click||[])fn();}
  close(){this.open=false;for(const fn of this.listeners.close||[])fn();}
  showModal(){this.open=true;}
  focus(){}
  querySelector(selector){if(selector!=='button')return null;let found=null;const walk=n=>{if(found)return;if(n.tag==='button'){found=n;return;}for(const c of n.children||[])walk(c);};walk(this);return found;}
}
const elements={};const doc={getElementById:id=>elements[id]??=new Element(id),createElement:tag=>new Element(tag)};
const fields=['title','kind','username','password','url','notes','expiry','cvv','favorite','tags','customFields'];
const when='2026-11-17T10:00:00.000Z';
const item=(id,kind,pwd)=>({id,kind,title:id,username:'public-user',password:pwd,url:'https://instagram.com',notes:'Visible '+('long-notes-'.repeat(18)),expiry:'2029-12',cvv:'321',favorite:true,tags:['Office','Vault'],customFields:[{label:'Recovery hint',value:'Private custom text'}]});
const items=[item('login-1','login','login-password-must-be-masked'),item('note-1','note','Secure note is visible, even when long '+('n'.repeat(140))),item('card-1','card','4321123456789123')];
const events=items.map((i,idx)=>({id:`edit-${idx}`,itemId:i.id,at:when,action:'created',fields,before:null,after:i}));
const state={locked:false,vault:{name:'Testing vault',credentials:items,editHistory:events}};
const uiState={accessGranted:true};
const context=vm.createContext({document:doc,state,uiState,window:{},Date,Set,Array,String,JSON,Number});
vm.runInContext(source,context);
const ui=context.window.PassVaultHistoryUI;
ui.refresh();
const categoryList=elements.pvHistoryList;
assert.equal(categoryList.children.length,3);
function show(categoryIndex){
  ui.refresh();categoryList.children[categoryIndex].click();
  const [list]=elements.pvHistoryDetails.children;assert.equal(list.tag,'div');list.children[0].click();
  const details=elements.pvHistoryDetails;
  const scroll=details.children[1];assert.equal(scroll.tag,'div');
  const table=scroll.children[0];const tbody=table.children[2];
  return tbody.children[0].children;
}
let cells=show(0);
assert.equal(cells[4].textContent,'public-user','Usernames must be readable by default');
assert.equal(cells[5].children[0].textContent,'••••••••','Login password must remain masked');
assert(!elements.pvHistoryDetails.textContent.includes('login-password-must-be-masked'),'Password must not be in DOM before reveal');
assert(cells[7].textContent.includes('long-notes-'.repeat(18)),'Long multiline notes must be visible without clicks');
assert(cells[9].textContent==='321','CVV must be visible as requested');
assert(cells[12].textContent.includes('Private custom text'),'Custom field values must be visible');
const reveal=cells[5].children[1];
reveal.click();assert(cells[5].textContent.includes('login-password-must-be-masked'));
reveal.click();assert.equal(cells[5].children[0].textContent,'••••••••');
cells=show(1);
assert(cells[5].textContent.includes('Secure note is visible'),'Note content is not a login password');
assert(!cells[5].textContent.includes('Reveal'),'Note content does not have a reveal button');
cells=show(2);
assert.equal(cells[5].textContent,'4321123456789123','Card number is not a login password');
assert.equal(cells[9].textContent,'321','Card security code is visible');
state.locked=true;ui.clear();
assert.equal(elements.pvHistoryDetails.textContent,'','History DOM must clear on vault lock');
assert(!elements.pvHistoryDialog.open);
console.log('History visibility tests passed: only login passwords masked, full notes/cards/custom fields visible, reveal/hide, locked cleanup.');
