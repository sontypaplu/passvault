import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import vm from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/css/ui-refinement.css',import.meta.url),'utf8');
const source=readFileSync(new URL('../src/js/text-size.js',import.meta.url),'utf8');
for(const id of ['pvTextSizeRange','pvTextSizeValue','pvTextSizeReset']) {
 assert.match(html,new RegExp(`id="${id}"`),`Missing control ${id}`);
}
assert.match(html,/src\/css\/ui-refinement\.css/);
assert.match(html,/src\/js\/text-size\.js/);
for(let size=85;size<=125;size+=5)assert.ok(css.includes(`data-pv-text-size="${size}"`));
assert.doesNotMatch(source,/fetch\(|XMLHttpRequest|PassVaultSync|PassVaultCloud|crypto\./);
const createControl=()=>({value:'100',textContent:'',attrs:{},listeners:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.listeners[k]=fn},emit(k){this.listeners[k]?.()}});
function test(initial, storageFails=false){
 const slider=createControl(),output=createControl(),reset=createControl();
 const map={pvTextSizeRange:slider,pvTextSizeValue:output,pvTextSizeReset:reset};
 const writes=[];
 const ctx={
  document:{documentElement:{dataset:{}},getElementById:id=>map[id]},
  localStorage:{getItem(){if(storageFails)throw new Error('storage blocked');return initial},setItem(k,v){if(storageFails)throw new Error('storage blocked');writes.push([k,v])}},
  Number,
 };
 vm.runInNewContext(source,ctx,{filename:'text-size.js'});
 return {slider,output,reset,writes,root:ctx.document.documentElement};
}
let t=test('120');assert.equal(t.root.dataset.pvTextSize,'120');assert.equal(t.output.textContent,'120%');
t.slider.value='85';t.slider.emit('input');assert.equal(t.output.textContent,'85%');assert.equal(t.writes.at(-1)[1],'85');
t.slider.value='999';t.slider.emit('input');assert.equal(t.root.dataset.pvTextSize,'85');
t.reset.emit('click');assert.equal(t.root.dataset.pvTextSize,'100');assert.equal(t.slider.attrs['aria-valuetext'],'100% (default)');
assert.equal(test('0').root.dataset.pvTextSize,'100');
assert.equal(test('112').root.dataset.pvTextSize,'100');
assert.equal(test('125').root.dataset.pvTextSize,'125');
assert.equal(test('99',true).root.dataset.pvTextSize,'100');
console.log('UI text-size checks passed: saved preference, range, reset, invalid input, storage failure, CSS registration.');
