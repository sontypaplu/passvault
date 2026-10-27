import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../src/js/approved.js',import.meta.url),'utf8');
const history=readFileSync(new URL('../src/js/history-ui.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/css/approved.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const from=source.indexOf('const baseBasketDefs=');
const to=source.indexOf('// Mobile-only presentation:',from);
assert(from>=0&&to>from);
const testVault={overviewBaskets:{names:{money:'Finance'},assignments:{'item-1':'money'},custom:[],removedBase:[],order:[]},credentials:[{id:'item-1',title:'Example',password:'not-a-real-password'}]};
let renders=0,dirty=0;
const context=vm.createContext({
 state:{vault:testVault},ready:()=>true,getItems:()=>testVault.credentials,
 render:()=>{renders++;},setDirty:()=>{dirty++;},tip:()=>{},
 document:{createElement(){throw new Error('Unexpected DOM request');}},
 $:()=>{throw new Error('Unexpected DOM request');},icon:()=>'<svg/>',
 console,Set,Object,Date,Array,JSON,String
});
vm.runInContext(source.slice(from,to),context);
const evaluate=(code)=>vm.runInContext(code,context);
assert.equal(evaluate("basketAppearance('money').icon"),'folder');
assert.equal(evaluate("basketAppearance('money').color"),'amber');
assert.equal(evaluate("basketAppearance('private').color"),'rose');
assert.equal(evaluate("basketState().order.length"),4);
const old=JSON.stringify(testVault.credentials);
evaluate("mutateBaskets(b=>{b.appearance.money={icon:'wallet',color:'blue'};})");
assert.deepEqual(JSON.parse(JSON.stringify(testVault.overviewBaskets.appearance.money)),{icon:'wallet',color:'blue'});
assert.equal(evaluate("basketAppearance('money').color"),'blue');
assert.equal(evaluate("basketAppearance('money').icon"),'wallet');
evaluate("mutateBaskets(b=>{b.names.money='Private finance';})");
assert.equal(evaluate("basketAppearance('money').color"),'blue','Palette choice must survive later unrelated basket changes');
testVault.overviewBaskets.appearance.money={icon:'<img onerror=alert(1)>',color:'red; background-image:url(https://bad.test)'};
assert.equal(evaluate("basketAppearance('money').icon"),'folder','Reject unknown user controlled icon identifiers');
assert.equal(evaluate("basketAppearance('money').color"),'amber','Reject unknown user controlled CSS palette identifiers');
assert.equal(JSON.stringify(testVault.credentials),old,'Basket personalization must not alter stored credential data');
assert(dirty>=2&&renders>=2);
assert(!source.includes("fields.push(detail('Created'") && !source.includes("fields.push(detail('Updated'"),'Remove timestamps from item detail only');
assert(history.includes("else if(activeKind){dialog.close();refresh();"),'Category back navigation must return to overview');
assert(history.includes("if(activeItemId && activeKind){showCategory(activeKind)"),'Item Back must return to category');
assert(css.includes('.pv-history-back[hidden]{display:none!important}'),'Hidden back must actually hide');
assert(source.includes("if(e.detail>0 && document.activeElement===to)to.blur()"),'Pointer navigation must not trap sidebar expanded');
for(const id of ['pvbCreateDialogIcons','pvbCreateDialogColors','pvbRenameDialogIcons','pvbRenameDialogColors']) assert(html.includes(`id="${id}"`),`Missing basket choice group ${id}`);
for(const token of ['violet','amber','teal','rose','blue','indigo','emerald','slate']){
 assert(css.includes(`.pvb-theme-${token}`),`Missing light palette ${token}`);
 assert(css.includes(`html[data-theme="dark"] #approvedUI .pvb-theme-${token}`),`Missing dark palette ${token}`);
}
console.log('Basket and navigation regression tests passed: legacy metadata, safe icon/color choices, persistence, no credential edits, Back paths, sidebar, and both themes.');
