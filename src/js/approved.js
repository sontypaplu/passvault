/* Approved UI: original preview components, connected to PassVault's existing encrypted state and handlers. */
(()=>{
'use strict';
const paths={shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',layout:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',key:'<circle cx="7.5" cy="15.5" r="5.5"/><path d="M12 12 21 3l-1 5-4 1-1 4"/>',star:'<path d="m12 2 3 6.4 7 .9-5 4.8 1.3 7-6.3-3.4-6.3 3.4 1.3-7-5-4.8 7-.9Z"/>',folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3Z"/>',settings:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.3 13.5a8.5 8.5 0 0 0 0-3l2-1.5-2-3.4-2.4.9a8 8 0 0 0-2.5-1.5L14 2h-4l-.4 3A8 8 0 0 0 7.1 6.5l-2.4-.9-2 3.4 2 1.5a8.5 8.5 0 0 0 0 3l-2 1.5 2 3.4 2.4-.9A8 8 0 0 0 9.6 19l.4 3h4l.4-3a8 8 0 0 0 2.5-1.5l2.4.9 2-3.4Z"/>',sparkles:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',search:'<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16 16 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',moon:'<path d="M20.9 13.2A9 9 0 0 1 10.8 3.1 9 9 0 1 0 20.9 13.2Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',lock:'<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',chevrons:'<path d="m8 10 4 4 4-4"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',check:'<path d="m5 12 4 4L19 6"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.5-2"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',cloud:'<path d="M5 18a4 4 0 1 1 1-7.9 6.5 6.5 0 0 1 12.7 1.4A3.5 3.5 0 1 1 19 18Z"/>','shield-check':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',trash:'<path d="M4 7h16M10 3h4m4 4-1 14H7L6 7m4 3v8m4-8v8"/>',edit:'<path d="m15 5 4 4M4 20l4.5-1 11-11a2.1 2.1 0 0 0-4-4l-11 11L4 20Z"/>',x:'<path d="M5 5l14 14M19 5 5 19"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>','user-plus':'<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 16 0M19 8v8m-4-4h8"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 4h.01"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'};
const icon=(id)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]||paths.info}</svg>`;
const $=(id)=>document.getElementById(id);const safe=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelectorAll('#approvedUI [data-icon]').forEach(x=>x.innerHTML=icon(x.dataset.icon));
// This is a presentation adapter. No crypto, cloud schema, auth flow, or storage implementation changes.
const pageTitles={overview:'Overview',items:'All items',favorites:'Favorites',vaults:'My vaults',security:'Security center',generator:'Password generator',settings:'Settings'};
const kindLabel={login:'Login',note:'Secure note',card:'Payment card'};
let page='overview',kind='login',filter='all',sort='recent',query='',selected=null,editId=null,generated='',quick='',toastTimer;
const ready=()=>!state.locked && !!state.vault && uiState.accessGranted;
const getItems=()=>ready()?state.vault.credentials:[];
const itemKind=(item)=>['login','note','card'].includes(item.kind)?item.kind:'login';
const vaults=()=>cloud.loaded?cloud.vaults.map(v=>({id:v.vault_id,name:v.label})):[];
const activeVault=()=>cloud.selectedVaultId;
function findItem(id){return getItems().find(x=>x.id===id);}
function basicWeak(password){return (password||'').length<12 || /^(password|1234|qwerty|admin|welcome)/i.test(password||'') || /^(.)\1{5,}$/.test(password||'');}
function computeHealth(){
 const logins=getItems().filter(x=>itemKind(x)==='login');const counts=new Map();
 for(const x of logins)counts.set(x.password,(counts.get(x.password)||0)+1);
 const repeated=new Set(logins.filter(x=>counts.get(x.password)>1).map(x=>x.id));
 const weak=logins.filter(x=>basicWeak(x.password)).length;
 const issues=logins.filter(x=>repeated.has(x.id)||basicWeak(x.password));
 return {weak,reused:logins.reduce((n,x)=>n+(counts.get(x.password)>1?1:0),0),good:logins.length-issues.length,issues,loginCount:logins.length};
}
function tip(message){$('toastText').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3100);}
function info(title,message){$('infoTitle').textContent=title;$('infoMessage').textContent=message;$('infoDialog').showModal();}
function theme(dark){window.PassVaultTheme.set(dark?'dark':'light');$('themeToggle').innerHTML=icon(dark?'sun':'moon');$('darkSwitch').classList.toggle('on',dark);$('darkSwitch').setAttribute('aria-checked',String(dark));}
function closeMenu(){$('approvedSidebar').classList.remove('open');$('approvedMobileBackdrop').classList.remove('show');$('openMenu').setAttribute('aria-expanded','false');}
function navigate(target,push=true){
 if(!ready()||!pageTitles[target])return;
 page=target;closeMenu();$('flowsMenu').classList.add('hidden');$('flowsToggle').setAttribute('aria-expanded','false');
 $('crumb').textContent=pageTitles[target];document.title=pageTitles[target]+' | PassVault';
 document.querySelectorAll('#approvedUI [data-page].navitem').forEach(x=>{
  x.classList.toggle('active',x.dataset.page===target);
  if(x.dataset.page===target)x.setAttribute('aria-current','page');else x.removeAttribute('aria-current');
 });
 document.querySelectorAll('#approvedUI .page').forEach(el=>el.classList.toggle('active',el.id==='page-'+target));
 if(push){const url=new URL(location.href);url.searchParams.set('view',target);url.searchParams.delete('auth');if(url.href!==location.href)history.pushState({pvView:target},'',url);}
 render();window.scrollTo({top:0,behavior:'instant'});
}
function serviceColor(k){return k==='card'?'green':k==='note'?'violet':'blue';}
function filtered(items){
 let out=items.filter(x=>!query||[x.title,x.username,x.url,x.notes,itemKind(x),...(x.tags||[])].some(t=>String(t||'').toLowerCase().includes(query.toLowerCase())));
 out=[...out];if(sort==='name')out.sort((a,b)=>a.title.localeCompare(b.title));
 else if(sort==='type')out.sort((a,b)=>itemKind(a).localeCompare(itemKind(b)));
 else out.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
 return out;
}
function buildTable(items,empty='No items found.',headers=true){
 if(!items.length)return `<div class="empty">${icon('search')}<h3>${safe(empty)}</h3><p>Try a different filter or add a new item.</p><button class="btn btn-primary" data-new>${icon('plus')}New item</button></div>`;
 const local=getItems();const pwCount=new Map();for(const x of local.filter(x=>itemKind(x)==='login'))pwCount.set(x.password,(pwCount.get(x.password)||0)+1);
 return `<div class="table-wrap"><table class="item-table"><thead>${headers?'<tr><th>ITEM</th><th>TYPE</th><th class="hide-mobile">USERNAME / DETAILS</th><th>STATUS</th><th aria-label="Actions"></th></tr>':''}</thead><tbody>${items.map(x=>{
  const k=itemKind(x);const weak=k==='login'&&basicWeak(x.password);const reused=k==='login'&&pwCount.get(x.password)>1;
  const label=k!=='login'?'Stored':weak?'Weak':reused?'Reused':'No flags';
  const issue=k==='login'&&(weak||reused);
  return `<tr><td><div class="itemnamebox"><span class="service-icon ${serviceColor(k)}">${safe((x.title||'•').slice(0,1).toUpperCase())}</span><span><button class="name-button" data-open="${safe(x.id)}">${safe(x.title)}</button><small>${safe(x.updatedAt?new Date(x.updatedAt).toLocaleDateString():'Recently added')}</small></span></div></td><td><span class="tag">${kindLabel[k]}</span></td><td class="hide-mobile approved-muted">${safe(k==='login'?x.username:k==='card'?'Payment card':'Private note')}</td><td><span class="tag ${k!=='login'?'':issue?'warn':'good'}">${label}</span></td><td><button class="rowbtn ${x.favorite?'star-on':''}" aria-label="${x.favorite?'Remove favorite':'Add favorite'} for ${safe(x.title)}" data-fav="${safe(x.id)}">${icon('star')}</button><button class="rowbtn" aria-label="Open ${safe(x.title)}" data-open="${safe(x.id)}">${icon('arrow')}</button></td></tr>`;
 }).join('')}</tbody></table></div>`;
}
function vaultTile(v){const active=v.id===activeVault();return `<button class="vault-tile ${!active?'teal':''}" data-selectvault="${safe(v.id)}"><span class="tile-icon">${icon(active?'shield-check':'lock')}</span><strong>${safe(v.name)}</strong><small>${active?'Currently unlocked · '+getItems().length+' items':'Locked · Needs master password'}</small><span class="tile-go">${icon('arrow')}</span></button>`;}
function render(){
 if(!ready())return;
 const items=getItems(),h=computeHealth(),vs=vaults();
 $('navCount').textContent=items.length;
 $('metrics').innerHTML=[['key','Total items',items.length,'Current vault'],['shield-check','Password warnings',h.issues.length,'Local checks','amber'],['star','Favorites',items.filter(x=>x.favorite).length,'Pinned items','green'],['folder','Vaults',vs.length+' / 2','Account limit','blue']].map(([ico,title,num,note,color])=>`<div class="card metric"><div class="metric-top"><span class="metric-icon ${color||''}">${icon(ico)}</span><span class="metric-trend">${safe(note)}</span></div><div class="metric-number">${safe(num)}</div><div class="metric-name">${title}</div></div>`).join('');
 $('healthNumber').textContent=h.issues.length;
 // Update only CSS custom property; the approved dashboard's SVG/CSS ring is unchanged.
 document.querySelector('#approvedUI .ring').style.setProperty('--healthy-percent',String(Math.round(100*h.good/Math.max(1,h.loginCount)))+'%');
 $('healthGood').textContent=h.good;$('healthReused').textContent=h.reused;$('healthWeak').textContent=h.weak;
 $('overviewVaults').innerHTML=vs.map(vaultTile).join('');
 $('recentTable').innerHTML=buildTable([...items].sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||'')).slice(0,4),'Nothing here yet.',false);
 $('fullTable').innerHTML=buildTable(filtered(items).filter(x=>filter==='all'||itemKind(x)===filter),'No items match these filters.');
 $('favoritesTable').innerHTML=buildTable(filtered(items.filter(x=>x.favorite)),'No favorite items yet.');
 $('vaultUsed').textContent=vs.length;$('capacityBar').style.width=(vs.length/2*100)+'%';
 $('capLabel').textContent=vs.length>=2?'Limit reached':`${2-vs.length} slot${2-vs.length===1?'':'s'} left`;
 $('quickCreateVault').disabled=vs.length>=2;$('newVaultButton').disabled=vs.length>=2;
 $('vaultCountTag').textContent=vs.length+' of 2 used';$('manageVaults').innerHTML=vs.map(vaultTile).join('');
 const checks=[{title:'Weak passwords',body:'Short, patterned, or common-prefix login passwords',count:h.weak,icon:'alert',good:h.weak===0},{title:'Reused passwords',body:'Logins sharing an identical password',count:h.reused,icon:'refresh',good:h.reused===0},{title:'Logins without local warnings',body:'No issues found by these basic local checks',count:h.good,icon:'shield-check',good:true}];
 $('securityIssues').innerHTML=checks.map(c=>`<div class="issue-row"><span class="issue-dot ${c.good?'good':''}">${icon(c.icon)}</span><div><h3>${c.title}</h3><p>${c.body}</p></div><strong>${c.count}</strong></div>`).join('')+(h.issues.length?`<div class="section-subhead"><h3>Items worth reviewing</h3></div>${h.issues.map(x=>`<div class="issue-row"><div><h3>${safe(x.title)}</h3><p>Weak or reused login password</p></div><button class="linkbtn" data-open="${safe(x.id)}">Review →</button></div>`).join('')}`:'');
 const syncLabel=cloud.conflict?'Sync conflict':state.dirty?'Unsaved changes':cloud.saveInProgress?'Syncing…':'Unlocked';
 $('approvedVaultStatus').innerHTML=`<span class="dot"></span> ${safe(cloud.vaultLabel||state.vault.name||'Your vault')} · ${syncLabel}`;
 const account=document.querySelector('#approvedUI .identity small');if(account)account.textContent=cloud.email||'Signed in';
}
function addCustom(label='',value=''){
 const holder=$('approvedCustomFields');if(holder.children.length>=10){tip('Maximum 10 custom fields');return;}
 const div=document.createElement('div');div.className='approved-custom-row';
 const key=document.createElement('input');key.placeholder='Field name';key.maxLength=60;key.value=label;key.setAttribute('aria-label','Custom field name');
 const val=document.createElement('input');val.placeholder='Field value';val.maxLength=1024;val.value=value;val.setAttribute('aria-label','Custom field value');
 const btn=document.createElement('button');btn.type='button';btn.className='btn btn-light';btn.textContent='×';btn.setAttribute('aria-label','Remove custom field');btn.addEventListener('click',()=>div.remove());
 div.append(key,val,btn);holder.append(div);
}
function openEditor(id=null,prepass=''){
 if(!ready())return;
 editId=id;const x=id?findItem(id):null;
 $('editorForm').reset();$('approvedCustomFields').replaceChildren();kind=x?itemKind(x):'login';
 $('itemTitle').value=x?.title||'';$('itemUsername').value=x?.username||'';
 $('itemPassword').value=kind==='login'?(x?.password||prepass):prepass;
 $('itemUrl').value=x?.url||'';$('itemContent').value=kind==='note'?x?.password||'':'';
 $('itemCardholder').value=kind==='card'?x?.username||'':'';
 $('itemCardnumber').value=kind==='card'?x?.password||'':'';
 $('itemNotes').value=x?.notes||'';$('itemFavorite').checked=!!x?.favorite;
 $('approvedExpiry').value=x?.expiry||'';$('approvedCvv').value=x?.cvv||'';
 $('approvedTags').value=Array.isArray(x?.tags)?x.tags.join(', '):'';
 for(const f of (x?.customFields||[]))addCustom(f.label,f.value);
 $('approvedEditorError').textContent='';$('approvedEditorTitle').textContent=x?'Edit item':'New item';
 $('itemPassword').type='password';$('editorReveal').textContent='Show';changeKind(kind);
 $('editorDialog').showModal();$('itemTitle').focus();
}
function changeKind(v){kind=v;for(const k of ['login','note','card'])$(k+'Fields').classList.toggle('hidden',k!==kind);document.querySelectorAll('#approvedUI [data-kind]').forEach(el=>el.classList.toggle('selected',el.dataset.kind===kind));}
function saveItem(event){
 event.preventDefault();if(!ready())return;
 try{
  const title=$('itemTitle').value.trim();if(!title)throw new Error('Title is required.');
  const url=kind==='login'?$('itemUrl').value.trim():'';
  if(url){const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw new Error('Website must use http or https.');}
  const username=kind==='login'?$('itemUsername').value.trim():kind==='card'?$('itemCardholder').value.trim():'Secure note';
  const password=kind==='login'?$('itemPassword').value:kind==='note'?$('itemContent').value:$('itemCardnumber').value.replace(/\s/g,'');
  if(!username||!password)throw new Error(kind==='login'?'Username and password are required.':kind==='note'?'Enter a note.':'Enter cardholder and card number.');
  if(password.length>2048)throw new Error('Secret is too long.');
  const tags=[...new Set($('approvedTags').value.split(',').map(x=>x.trim()).filter(Boolean))];
  if(tags.length>10||tags.some(x=>x.length>40))throw new Error('Maximum 10 tags, up to 40 characters each.');
  const customFields=[];for(const row of $('approvedCustomFields').children){const [name,value]=row.querySelectorAll('input');if(name.value.trim())customFields.push({label:name.value.trim(),value:value.value});}
  const existing=editId?findItem(editId):null,now=new Date().toISOString();
  const data={id:existing?.id||secureId(),kind,title,url,username,password,notes:$('itemNotes').value,favorite:$('itemFavorite').checked,tags,customFields,expiry:kind==='card'?$('approvedExpiry').value.trim():'',cvv:kind==='card'?$('approvedCvv').value:'',createdAt:existing?.createdAt||now,updatedAt:now};
  const candidate=existing?getItems().map(x=>x.id===existing.id?data:x):[...getItems(),data];
  validateVaultPlaintext({...state.vault,credentials:candidate});
  if(existing)Object.assign(existing,data);else state.vault.credentials.push(data);
  state.vault.updatedAt=now;setDirty(true);
  $('editorDialog').close();renderVault();tip('Item saved · encrypted cloud sync scheduled');
 }catch(err){$('approvedEditorError').textContent=err.message||'Unable to save item';}
}
function openDetail(id){
 if(!ready())return;const x=findItem(id);if(!x)return;selected=id;
 const detail=(label,value,copy=false,secret=false,key=label)=>{
  const id='approved-detail-'+key.replace(/\W/g,'');
  return `<div class="detail-row"><small>${safe(label)}</small><div class="detail-value"><span id="${id}">${secret?'••••••••••••':safe(value||'—')}</span><span class="detail-actions">${secret?`<button class="rowbtn" data-reveal="${safe(key)}" aria-label="Reveal ${safe(label)}" title="Reveal secret">${icon('eye')}</button>`:''}${copy?`<button class="rowbtn" data-copy="${safe(key)}" aria-label="Copy ${safe(label)}">${icon('copy')}</button>`:''}</span></div></div>`;
 };
 $('detailTitle').textContent=x.title;
 const k=itemKind(x),fields=[detail('Type',kindLabel[k])];
 if(k==='login')fields.push(detail('Username',x.username,true),detail('Password',x.password,true,true),detail('Website',x.url));
 else if(k==='note')fields.push(detail('Content',x.password,true,true));
 else{fields.push(detail('Cardholder',x.username),detail('Card number',x.password,true,true));if(x.expiry)fields.push(detail('Expiry',x.expiry));if(x.cvv)fields.push(detail('Security code',x.cvv,true,true));}
 fields.push(detail('Notes',x.notes));if(x.tags?.length)fields.push(detail('Tags',x.tags.join(', ')));
 for(const [i,f] of (x.customFields||[]).entries())fields.push(detail(f.label,f.value,false,true,'custom-'+i));
 $('detailBody').innerHTML=fields.join('');$('favoriteDetail').innerHTML=icon('star')+(x.favorite?'Unfavorite':'Favorite');$('detailDialog').showModal();
}
function currentValue(label,x){if(/^custom-\d+$/.test(label))return x.customFields?.[Number(label.slice(7))]?.value||'';if(label==='Username')return x.username;if(label==='Password'||label==='Content'||label==='Card number')return x.password;if(label==='Security code')return x.cvv||'';return '';}
function toggleFavorite(id){
 if(!ready())return;const x=findItem(id);if(!x)return;
 x.favorite=!x.favorite;x.updatedAt=new Date().toISOString();state.vault.updatedAt=x.updatedAt;
 setDirty(true);renderVault();tip(x.favorite?'Added to favorites':'Removed from favorites');
}
function deleteItem(){
 const x=findItem(selected);if(!x)return;
 if(!window.confirm(`Permanently remove “${x.title}” from this vault?`))return;
 state.vault.credentials=state.vault.credentials.filter(item=>item.id!==x.id);
 state.vault.updatedAt=new Date().toISOString();setDirty(true);
 $('detailDialog').close();selected=null;renderVault();tip('Item removed · encrypted sync scheduled');
}
async function copyValue(value){
 if(!ready()||!value)return;
 try{await writeClipboard(value);scheduleClipboardClear();tip('Copied · clipboard clearing is best-effort');}catch(e){tip('Clipboard unavailable: '+e.message);}
}
function makePassword(length,upper=true,lower=true,numbers=true,symbols=true){return generatePassword({length,upper,lower,numbers,symbols});}
function createQuick(){try{quick=makePassword(20);$('quickPassword').textContent=quick;}catch(e){tip(e.message);}}
function createMain(){try{generated=makePassword(Number($('passwordLength').value),$('optUpper').checked,$('optLower').checked,$('optNumbers').checked,$('optSymbols').checked);$('approvedGeneratedPassword').textContent=generated;}catch(e){tip(e.message);}}
function selectVault(id){
 if(!cloud.loaded||!cloud.userId)return;
 if(id===activeVault()){navigate('items');return;}
 displayVaultDashboard();if(!state.locked)return;
 void openVaultById(id); // Real vault unlock flow, never simulated.
}
function createVault(){
 if(!cloud.loaded)return tip('Vault list is not ready.');
 if(vaults().length>=2)return tip('Maximum two encrypted vaults per account.');
 displayVaultDashboard();if(!state.locked)return;
 prepareNewVault(); // Native validated master-password creation form.
}
function createVaultModal(){
 if(!cloud.loaded)return tip('Vault list is not ready.');
 if(vaults().length>=2)return tip('Maximum two encrypted vaults per account.');
 $('vaultName').value='';$('vaultDialog').showModal();$('vaultName').focus();
}
function clearPrivateUI(){
 selected=null;editId=null;quick='';generated='';query='';$('search').value='';
 for(const id of ['editorDialog','detailDialog','infoDialog','vaultDialog'])if($(id).open)$(id).close();
 $('editorForm').reset();$('detailBody').replaceChildren();$('approvedCustomFields').replaceChildren();
 $('fullTable').replaceChildren();$('favoritesTable').replaceChildren();$('recentTable').replaceChildren();
 $('overviewVaults').replaceChildren();$('manageVaults').replaceChildren();$('quickPassword').textContent='';$('approvedGeneratedPassword').textContent='';
 closeMenu();$('flowsMenu').classList.add('hidden');
}
function syncVisible(){
 if(ready()){
  $('approvedUI').hidden=false;
  const saved=new URL(location.href).searchParams.get('view');
  if(!window.__pvApprovedWasUnlocked){window.__pvApprovedWasUnlocked=true;createMain();createQuick();navigate(pageTitles[saved]?saved:'overview',false);}
  render();
 }else{if(window.__pvApprovedWasUnlocked){window.__pvApprovedWasUnlocked=false;clearPrivateUI();}$('approvedUI').hidden=true;}
}
// Install handlers only on elements inside the unchanged approved HTML layout.
$('editorForm').addEventListener('submit',saveItem);
$('deleteItem').addEventListener('click',deleteItem);
$('editItem').addEventListener('click',()=>{const id=selected;$('detailDialog').close();openEditor(id);});
$('favoriteDetail').addEventListener('click',()=>{const id=selected;$('detailDialog').close();toggleFavorite(id);});
$('editorReveal').addEventListener('click',()=>{const input=$('itemPassword');input.type=input.type==='password'?'text':'password';$('editorReveal').textContent=input.type==='password'?'Show':'Hide';});
$('approvedAddCustom').addEventListener('click',()=>addCustom());
$('themeToggle').addEventListener('click',()=>theme(document.documentElement.dataset.theme!=='dark'));
$('darkSwitch').addEventListener('click',()=>theme(document.documentElement.dataset.theme!=='dark'));
$('openMenu').addEventListener('click',()=>{const open=$('approvedSidebar').classList.toggle('open');$('approvedMobileBackdrop').classList.toggle('show',open);$('openMenu').setAttribute('aria-expanded',String(open));});
$('approvedMobileBackdrop').addEventListener('click',closeMenu);
$('flowsToggle').addEventListener('click',()=>{const visible=$('flowsMenu').classList.toggle('hidden');$('flowsToggle').setAttribute('aria-expanded',String(!visible));});
$('lockShortcut').addEventListener('click',()=>lockVault('Manual lock'));
$('accountShortcut').addEventListener('click',()=>void handleSignOut());
$('topNew').addEventListener('click',()=>openEditor());
$('quickCreateVault').addEventListener('click',createVaultModal);$('newVaultButton').addEventListener('click',createVaultModal);
$('quickGenerate').addEventListener('click',createQuick);$('quickCopy').addEventListener('click',()=>void copyValue(quick));
$('generateMain').addEventListener('click',createMain);$('copyGenerator').addEventListener('click',()=>void copyValue(generated));
$('useGenerated').addEventListener('click',()=>{if(!generated)return tip('Generate a password first');navigate('items');openEditor(null,generated);});
$('passwordLength').addEventListener('input',()=>$('lengthNumber').textContent=$('passwordLength').value);
$('search').addEventListener('input',e=>{query=e.target.value;if(page!=='items'&&query.trim())navigate('items');else render();});
$('sort').addEventListener('change',e=>{sort=e.target.value;render();});
$('autoLock').addEventListener('change',e=>{els.sessionTimeout.value=String(Number(e.target.value)*60000);handleSessionSettings();tip('Auto-lock preference updated');});
$('clipboardTime').addEventListener('change',e=>{els.clipboardTimeout.value=String(Number(e.target.value)*1000);handleSessionSettings();tip('Clipboard preference updated');});
$('learnDesign').addEventListener('click',()=>info('Private by design','Encryption and decryption happen on your device. Only encrypted vault data is synchronized to your existing cloud account. Keep a separate encrypted backup.'));
$('vaultForm').addEventListener('submit',e=>{e.preventDefault(); // Important: never use the fake prototype form as a vault creation endpoint.
 const label=$('vaultName').value.trim();$('vaultDialog').close();createVault();if(label){els.newVaultName.value=label;}
});
$('editorDialog').addEventListener('close',()=>{$('editorForm').reset();$('approvedCustomFields').replaceChildren();});
$('detailDialog').addEventListener('close',()=>$('detailBody').replaceChildren());
$('approvedUI').addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target||!$('approvedUI').contains(target))return;
 const close=target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
 const to=target.closest('[data-page]');if(to){navigate(to.dataset.page);return;}
 const newb=target.closest('[data-new]');if(newb){openEditor();return;}
 const filteredButton=target.closest('[data-filter]');if(filteredButton){filter=filteredButton.dataset.filter;document.querySelectorAll('#approvedUI [data-filter]').forEach(x=>x.classList.toggle('selected',x===filteredButton));render();return;}
 const typeb=target.closest('[data-kind]');if(typeb){changeKind(typeb.dataset.kind);return;}
 const open=target.closest('[data-open]');if(open){openDetail(open.dataset.open);return;}
 const fav=target.closest('[data-fav]');if(fav){toggleFavorite(fav.dataset.fav);return;}
 const v=target.closest('[data-selectvault]');if(v){selectVault(v.dataset.selectvault);return;}
 const flow=target.closest('[data-flow]');if(flow){if(flow.dataset.flow==='signout')void handleSignOut();else if(flow.dataset.flow==='lock')lockVault('Manual lock');else navigate('vaults');return;}
 const unw=target.closest('[data-unwired]');if(unw){
  switch(unw.dataset.unwired){
  case 'Encrypted backup export':case 'Backup export': void handleExportVault();break;
  case 'Encrypted cloud sync':void saveCloudVault(true);break;
  case 'Account password change':navigate('settings');$('changeAccountPasswordForm').scrollIntoView({behavior:'smooth',block:'center'});$('currentAccountPassword').focus();break;
  case 'Protected deletion confirmation':navigate('settings');$('approvedAccountManagement').scrollIntoView({behavior:'smooth',block:'start'});break;
  default:info('Account management','Use the protected account controls in Settings.');
  }return;
 }
 const rev=target.closest('[data-reveal]');if(rev){const x=findItem(selected);if(!x)return;const label=rev.dataset.reveal;const field=$('approved-detail-'+label.replace(/\W/g,''));if(!field)return;const masked=field.textContent==='••••••••••••';field.textContent=masked?currentValue(label,x):'••••••••••••';rev.title=masked?'Hide secret':'Reveal secret';return;}
 const cp=target.closest('[data-copy]');if(cp){const x=findItem(selected);if(x)void copyValue(currentValue(cp.dataset.copy,x));return;}
});
document.addEventListener('keydown',e=>{
 if(!ready())return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();}
 if(e.key==='Escape'){$('flowsMenu').classList.add('hidden');closeMenu();}
});
window.addEventListener('popstate',()=>{if(ready()){const v=new URL(location.href).searchParams.get('view');navigate(pageTitles[v]?v:'overview',false);}});
// The original application owns rendering, session locking and cloud status. Refresh only after its lifecycle has run.
const originalRenderVault=renderVault;
renderVault=function(...args){const out=originalRenderVault(...args);syncVisible();return out;};
const originalSetActiveView=setActiveView;
setActiveView=function(...args){const out=originalSetActiveView(...args);syncVisible();return out;};
const originalSetDirty=setDirty;
setDirty=function(...args){const out=originalSetDirty(...args);syncVisible();return out;};
const originalSaveCloudVault=saveCloudVault;
saveCloudVault=async function(...args){const out=await originalSaveCloudVault(...args);syncVisible();return out;};
const originalDashboard=renderVaultDashboard;
renderVaultDashboard=function(...args){const out=originalDashboard(...args);syncVisible();return out;};
// Reuse the original account forms and verified deletion controls without reimplementing auth.
const accountForms=document.querySelector('.account-settings-grid');if(accountForms)$('approvedAccountManagement').append(accountForms);
const download=document.getElementById('downloadVaultLink');if(download){download.classList.add('approved-backup-link');$('approvedAccountManagement').append(download);}
$('autoLock').value=String(state.sessionTimeoutMs/60000);
$('clipboardTime').value=String(state.clipboardTimeoutMs/1000);
$('search').placeholder='Search your unlocked vault...';
$('topNew').disabled=false;
// Preserve a previously chosen appearance; use the approved light preview on a fresh session.
let savedTheme=null;try{savedTheme=sessionStorage.getItem('passvault-theme');}catch{}
theme(savedTheme==='dark');
$('openMenu').setAttribute('aria-expanded','false');
$('approvedUI').hidden=true;
syncVisible();
})();
