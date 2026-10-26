/* Approved UI: original preview components, connected to PassVault's existing encrypted state and handlers. */
(()=>{
'use strict';
const paths={shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',layout:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',key:'<circle cx="7.5" cy="15.5" r="5.5"/><path d="M12 12 21 3l-1 5-4 1-1 4"/>',star:'<path d="m12 2 3 6.4 7 .9-5 4.8 1.3 7-6.3-3.4-6.3 3.4 1.3-7-5-4.8 7-.9Z"/>',folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3Z"/>',settings:'<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.3 13.5a8.5 8.5 0 0 0 0-3l2-1.5-2-3.4-2.4.9a8 8 0 0 0-2.5-1.5L14 2h-4l-.4 3A8 8 0 0 0 7.1 6.5l-2.4-.9-2 3.4 2 1.5a8.5 8.5 0 0 0 0 3l-2 1.5 2 3.4 2.4-.9A8 8 0 0 0 9.6 19l.4 3h4l.4-3a8 8 0 0 0 2.5-1.5l2.4.9 2-3.4Z"/>',sparkles:'<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>',search:'<circle cx="10.8" cy="10.8" r="7.3"/><path d="m16 16 5 5"/>',plus:'<path d="M12 5v14M5 12h14"/>',moon:'<path d="M20.9 13.2A9 9 0 0 1 10.8 3.1 9 9 0 1 0 20.9 13.2Z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19"/>',lock:'<rect x="5" y="11" width="14" height="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',chevrons:'<path d="m8 10 4 4 4-4"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',check:'<path d="m5 12 4 4L19 6"/>',copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.5-2"/>',download:'<path d="M12 3v13m-5-5 5 5 5-5M4 18v3h16v-3"/>',cloud:'<path d="M5 18a4 4 0 1 1 1-7.9 6.5 6.5 0 0 1 12.7 1.4A3.5 3.5 0 1 1 19 18Z"/>','shield-check':'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',trash:'<path d="M4 7h16M10 3h4m4 4-1 14H7L6 7m4 3v8m4-8v8"/>',edit:'<path d="m15 5 4 4M4 20l4.5-1 11-11a2.1 2.1 0 0 0-4-4l-11 11L4 20Z"/>',x:'<path d="M5 5l14 14M19 5 5 19"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>','user-plus':'<circle cx="10" cy="8" r="4"/><path d="M2 21a8 8 0 0 1 16 0M19 8v8m-4-4h8"/>',eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',alert:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v5m0 4h.01"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>'};
const icon=(id)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id]||paths.info}</svg>`;
const $=(id)=>document.getElementById(id);const safe=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelectorAll('#approvedUI [data-icon]').forEach(x=>x.innerHTML=icon(x.dataset.icon));
// This is a presentation adapter. No crypto, cloud schema, auth flow, or storage implementation changes.
const pageTitles={overview:'Overview',items:'All items',favorites:'Favorites',vaults:'My vaults',security:'Security center',generator:'Password generator',profile:'My profile',settings:'Settings'};
const kindLabel={login:'Login',note:'Secure note',card:'Payment card'};
let page='overview',kind='login',filter='all',sort='recent',query='',selected=null,editId=null,generated='',quick='',toastTimer;
let accountProfile=null,profileLoadedUserId=null,profileLoading=null,profileAvatarUrl=null,profilePreviewUrl=null,profilePendingPhoto=null,profileRemovePhoto=false,profileSaving=false;
let basketCreateTarget='everyday',basketRenameTarget=null,basketMoveTarget=null,basketDragging=null,basketDeleteTarget=null,basketReordering=null,basketPointerHold=null;
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
function updateMobileSidebarFocus(){
 const mobile=window.matchMedia('(max-width:760px)').matches;
 $('approvedSidebar').inert=mobile&&!$('approvedSidebar').classList.contains('open');
}
function closeAccountMenu(){
 $('accountMenu').classList.add('hidden');
 $('accountShortcut').setAttribute('aria-expanded','false');
}
function closeMenu(){
 $('approvedSidebar').classList.remove('open');$('approvedMobileBackdrop').classList.remove('show');$('openMenu').setAttribute('aria-expanded','false');
 closeAccountMenu();updateMobileSidebarFocus();
}
function navigate(target,push=true){
 if(!ready()||!pageTitles[target])return;
 page=target;closeMenu();if(target==='profile')void loadAccountProfile();$('flowsMenu').classList.add('hidden');$('flowsToggle').setAttribute('aria-expanded','false');
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
 if(!items.length)return `<div class="empty">${icon('search')}<h3>${safe(empty)}</h3><p>Try a different filter or add a new item.</p>${basketCapacityReached()?'':`<button class="btn btn-primary" data-new>${icon('plus')}New item</button>`}</div>`;
 const local=getItems();const pwCount=new Map();for(const x of local.filter(x=>itemKind(x)==='login'))pwCount.set(x.password,(pwCount.get(x.password)||0)+1);
 return `<div class="table-wrap"><table class="item-table"><thead>${headers?'<tr><th>ITEM</th><th>TYPE</th><th class="hide-mobile">USERNAME / DETAILS</th><th>STATUS</th><th aria-label="Actions"></th></tr>':''}</thead><tbody>${items.map(x=>{
  const k=itemKind(x);const weak=k==='login'&&basicWeak(x.password);const reused=k==='login'&&pwCount.get(x.password)>1;
  const label=k!=='login'?'Stored':weak?'Weak':reused?'Reused':'No flags';
  const issue=k==='login'&&(weak||reused);
  return `<tr><td><div class="itemnamebox"><span class="service-icon ${serviceColor(k)}">${safe((x.title||'•').slice(0,1).toUpperCase())}</span><span><button class="name-button" data-open="${safe(x.id)}">${safe(x.title)}</button><small>${safe(x.updatedAt?new Date(x.updatedAt).toLocaleDateString():'Recently added')}</small></span></div></td><td><span class="tag">${kindLabel[k]}</span></td><td class="hide-mobile approved-muted">${safe(k==='login'?x.username:k==='card'?'Payment card':'Private note')}</td><td><span class="tag ${k!=='login'?'':issue?'warn':'good'}">${label}</span></td><td><button class="rowbtn ${x.favorite?'star-on':''}" aria-label="${x.favorite?'Remove favorite':'Add favorite'} for ${safe(x.title)}" data-fav="${safe(x.id)}">${icon('star')}</button><button class="rowbtn" aria-label="Open ${safe(x.title)}" data-open="${safe(x.id)}">${icon('arrow')}</button></td></tr>`;
 }).join('')}</tbody></table></div>`;
}
function vaultTile(v){const active=v.id===activeVault();return `<button class="vault-tile ${!active?'teal':''}" data-selectvault="${safe(v.id)}"><span class="tile-icon">${icon(active?'shield-check':'lock')}</span><strong>${safe(v.name)}</strong><small>${active?'Currently unlocked · '+getItems().length+' items':'Locked · Needs master password'}</small><span class="tile-go">${icon('arrow')}</span></button>`;}
// Overview-only basket metadata lives INSIDE the already encrypted vault payload.
// No separate browser storage, cloud tables, crypto changes, or credential migrations.
const baseBasketDefs=[
 {id:'everyday',name:'Everyday',color:'#6759e8',pale:'#efedff'},
 {id:'money',name:'Money',color:'#eda33e',pale:'#fff3e5'},
 {id:'work',name:'Work',color:'#24b397',pale:'#e6f7f0'},
 {id:'private',name:'Private',color:'#e87da3',pale:'#ffedf3'}
];
const BASKET_MAX=8;
// Backward-compatible metadata: older encrypted vaults have no order/removedBase.
function basketState(){
 const obj=state.vault?.overviewBaskets;
 const names=obj?.names && typeof obj.names==='object' && !Array.isArray(obj.names)?obj.names:{};
 const assignments=obj?.assignments && typeof obj.assignments==='object' && !Array.isArray(obj.assignments)?obj.assignments:{};
 const removedBase=[...new Set((Array.isArray(obj?.removedBase)?obj.removedBase:[]).filter(id=>baseBasketDefs.some(b=>b.id===id)))];
 // Fail safe against corrupted metadata: always leave one basket.
 if(removedBase.length===baseBasketDefs.length && !(Array.isArray(obj?.custom)&&obj.custom.length))removedBase.pop();
 const activeBases=baseBasketDefs.filter(b=>!removedBase.includes(b.id));
 const raw=Array.isArray(obj?.custom)?obj.custom:[];
 const custom=[...new Set(raw.filter(id=>typeof id==='string' && /^custom-[a-zA-Z0-9_-]{20,80}$/.test(id)))].slice(0,BASKET_MAX-activeBases.length);
 const activeIds=[...activeBases.map(b=>b.id),...custom];
 const order=[...new Set((Array.isArray(obj?.order)?obj.order:[]).filter(id=>activeIds.includes(id)))];
 for(const id of activeIds)if(!order.includes(id))order.push(id);
 return {names,assignments,custom,removedBase,order};
}
function basketDefs(){
 const data=basketState();
 const defs=[...baseBasketDefs.filter(b=>!data.removedBase.includes(b.id)),...data.custom.map((id,i)=>({id,name:'New basket',theme:['money','work','private','everyday'][i%4]}))];
 return data.order.map(id=>defs.find(b=>b.id===id)).filter(Boolean);
}
function isBasketId(id){return basketDefs().some(b=>b.id===id);}
function firstBasketId(){return basketDefs()[0]?.id||'everyday';}
function basketName(id){
 const name=basketState().names[id];
 return typeof name==='string'&&name.trim()&&name.length<=20?name:basketDefs().find(b=>b.id===id)?.name||'Basket';
}
function itemBasket(id){const b=basketState().assignments[id];return isBasketId(b)?b:firstBasketId();}
function mutateBaskets(callback){
 if(!ready())return;
 const current=basketState();
 const names=Object.create(null),assignments=Object.create(null);
 for(const b of basketDefs())names[b.id]=basketName(b.id);
 for(const item of getItems())if(isBasketId(current.assignments[item.id]))assignments[item.id]=current.assignments[item.id];
 const draft={names,assignments,custom:[...current.custom],removedBase:[...current.removedBase],order:[...current.order]};
 callback(draft);
 state.vault.overviewBaskets=draft;
 state.vault.updatedAt=new Date().toISOString();
 setDirty(true);
 render();
}
function reorderBasket(from,to){
 if(!ready()||from===to||!isBasketId(from)||!isBasketId(to))return;
 mutateBaskets(d=>{const fromIndex=d.order.indexOf(from),toIndex=d.order.indexOf(to);const order=d.order.filter(id=>id!==from);order.splice(order.indexOf(to)+(fromIndex<toIndex?1:0),0,from);d.order=order;});
 tip('Basket order saved');
}
function clearReorderMarkers(){document.querySelectorAll('#pvbGrid .pvb-basket').forEach(b=>b.classList.remove('pvb-reorder-target','pvb-reordering'));}
function deleteBasketAndMoveItems(id){
 if(!ready()||!isBasketId(id)||basketDefs().length<=1)return false;
 const destination=basketDefs().find(b=>b.id!==id).id,destinationName=basketName(destination);
 mutateBaskets(b=>{b.custom=b.custom.filter(x=>x!==id);if(baseBasketDefs.some(def=>def.id===id))b.removedBase.push(id);b.order=b.order.filter(x=>x!==id);delete b.names[id];for(const item of getItems())if(itemBasket(item.id)===id)b.assignments[item.id]=destination;});
 tip('Basket removed · items moved to '+destinationName);
 return true;
}
function basketCapacityReached(){return getItems().length>=10;}
function basketMove(id,to){
 if(!ready()||!findItem(id)||!isBasketId(to))return;
 if(itemBasket(id)===to)return;
 mutateBaskets(b=>{b.assignments[id]=to;});
 tip('Item moved to '+basketName(to));
}
function renderBaskets(){
 const grid=$('pvbGrid');if(!grid||!ready())return;
 const items=getItems(),used=items.length,vs=vaults();
 $('pvbVaultName').textContent=cloud.vaultLabel||state.vault.name||'Personal vault';
 $('pvbUsed').textContent=used+' of 10 items used';
 $('pvbFree').textContent=used>=10?(used>10?'Existing items kept · limit exceeded':'Vault item limit reached'):(10-used)+' space'+(10-used===1?'':'s')+' available';
 $('pvbFill').style.width=(Math.min(used,10)*10)+'%';
 $('pvbProgress').setAttribute('aria-valuenow',String(Math.min(used,10)));
 $('pvbVaultCount').textContent=vs.length+' / 2';
 $('pvbBasketCount').textContent=basketDefs().length+' of '+BASKET_MAX+' baskets';
 $('pvbCreateButton').disabled=basketDefs().length>=BASKET_MAX;
 $('pvbCreateButton').title=$('pvbCreateButton').disabled?'Maximum 8 baskets per vault':'';
 grid.innerHTML=basketDefs().map(b=>{
  const these=items.filter(x=>itemBasket(x.id)===b.id);
  const tiles=these.map(x=>{
   const letter=safe((x.title||'•').slice(0,1).toUpperCase());
   return `<div class="pvb-tile" draggable="true" data-basket-drag="${safe(x.id)}"><button type="button" class="pvb-tile-open" data-open="${safe(x.id)}" aria-label="Open ${safe(x.title)}"><span class="pvb-appicon pvb-${itemKind(x)}">${letter}</span><span class="pvb-appname">${safe(x.title)}</span></button><button class="pvb-tile-move" type="button" data-basket-move="${safe(x.id)}" aria-label="Move ${safe(x.title)} to another basket" title="Move item">Move</button></div>`;
  }).join('');
  return `<article class="pvb-basket pvb-color-${b.theme||b.id}" data-basket-drop="${b.id}"><div class="pvb-basket-top" data-basket-reorder="${b.id}" draggable="true" title="Drag the colored header to reorder"><span class="pvb-folder" aria-hidden="true">${icon('folder')}</span><span class="pvb-grip" tabindex="0" role="button" data-basket-keyboard="${b.id}" aria-label="Move ${safe(basketName(b.id))} basket. Press arrow keys to reorder." title="Arrow keys to reorder">⋮⋮</span><button type="button" class="pvb-rename" data-basket-rename="${b.id}" aria-label="Rename ${safe(basketName(b.id))} basket" title="Rename basket">${icon('more')}</button></div><h3>${safe(basketName(b.id))}</h3><p class="pvb-num">${these.length} ${these.length===1?'item':'items'}</p><div class="pvb-apps">${tiles}${!basketCapacityReached()?`<button type="button" class="pvb-add-tile" data-basket-add="${b.id}" aria-label="Add item to ${safe(basketName(b.id))}"><span>+</span><small>Add item</small></button>`:''}</div><div class="pvb-basket-foot"><span>Drag to organize</span>${basketDefs().length>1?`<button type="button" data-basket-delete="${b.id}" aria-label="Delete ${safe(basketName(b.id))} basket">Delete basket</button>`:'<span class="pvb-last-basket">Required basket</span>'}</div></article>`;
 }).join('');
}
function clearBaskets(){
 $('pvbGrid')?.replaceChildren();
 $('pvbVaultName').textContent='Locked vault';
 $('pvbUsed').textContent='0 of 10 items used';
 $('pvbFree').textContent='';
 $('pvbFill').style.width='0%';
 for(const id of ['pvbRenameDialog','pvbMoveDialog','pvbCreateDialog','pvbDeleteDialog'])if($(id).open)$(id).close();
 basketRenameTarget=null;basketMoveTarget=null;basketDeleteTarget=null;basketDragging=null;basketReordering=null;basketPointerHold=null;basketCreateTarget='everyday';
}
// Profile is account-scoped (across vaults). It contains no credential data.
// Avatar files live in a separate private Supabase Storage bucket; text uses Auth user metadata.
const PROFILE_BUCKET='passvault-avatars';
function profileInitials(){
 const label=accountProfile?.nickname||accountProfile?.name||cloud.email?.split('@')[0]||'PV';
 return label.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('')||'PV';
}
function profileAvatarInto(node,src){
 if(!node)return;
 node.replaceChildren();
 if(src){const img=document.createElement('img');img.alt='';img.src=src;img.draggable=false;node.append(img);}
 else node.textContent=profileInitials();
}
function renderAccountIdentity(){
 const label=accountProfile?.nickname||accountProfile?.name||'Your account';
 $('approvedIdentityName').textContent=label;
 const email=document.querySelector('#approvedUI .identity small');if(email)email.textContent=cloud.email||'Signed in';
 profileAvatarInto($('approvedSidebarAvatar'),profileAvatarUrl);
}
function profileStatus(message='',error=false){const el=$('pvProfileStatus');el.textContent=message;el.classList.toggle('error',!!error);el.classList.toggle('success',!!message&&!error);}
function profileDate(value){const d=value?new Date(value):null;return d&&!Number.isNaN(d.getTime())?d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):'—';}
function profileDraw(){
 if(!accountProfile)return;
 $('pvProfileName').value=accountProfile.name;
 $('pvProfileNickname').value=accountProfile.nickname;
 $('pvProfileBio').value=accountProfile.bio;
 $('pvProfileEmail').value=cloud.email||'';
 $('pvProfileAccountEmail').textContent=cloud.email||'—';
 $('pvProfileJoined').textContent=profileDate(accountProfile.createdAt);
 $('pvProfileLastSignin').textContent=profileDate(accountProfile.lastSignIn);
 $('pvProfileHeading').textContent=accountProfile.nickname||accountProfile.name||'Your profile';
 $('pvProfileSubheading').textContent=cloud.email||'Personalize your account';
 profileAvatarInto($('pvProfileAvatar'),profilePreviewUrl||(!profileRemovePhoto&&profileAvatarUrl)||null);
}
function clearProfilePreview(){if(profilePreviewUrl)URL.revokeObjectURL(profilePreviewUrl);profilePreviewUrl=null;profilePendingPhoto=null;profileRemovePhoto=false;$('pvProfilePhoto').value='';}
function resetAccountProfile(){
 clearProfilePreview();if(profileAvatarUrl)URL.revokeObjectURL(profileAvatarUrl);
 profileAvatarUrl=null;accountProfile=null;profileLoadedUserId=null;
 renderAccountIdentity();
}
async function loadAccountProfile(force=false){
 if(!cloud.client||!cloud.userId)return;
 const requested=cloud.userId;
 if(!force&&profileLoadedUserId===requested){if(page==='profile'&&!profileSaving)profileDraw();return;}
 if(profileLoading)return profileLoading;
 profileLoading=(async()=>{
  try{
   const {data,error}=await cloud.client.auth.getUser();if(error)throw error;
   if(cloud.userId!==requested||data.user?.id!==requested)return;
   const user=data.user,meta=user.user_metadata||{};
   const photoPath=meta.pv_avatar_path===requested+'/avatar.webp'?meta.pv_avatar_path:null;
   accountProfile={name:typeof meta.pv_display_name==='string'?meta.pv_display_name.slice(0,60):'',nickname:typeof meta.pv_nickname==='string'?meta.pv_nickname.slice(0,30):'',bio:typeof meta.pv_bio==='string'?meta.pv_bio.slice(0,160):'',avatarPath:photoPath,createdAt:user.created_at,lastSignIn:user.last_sign_in_at};
   profileLoadedUserId=requested;
   if(profileAvatarUrl)URL.revokeObjectURL(profileAvatarUrl);profileAvatarUrl=null;
   if(photoPath){
    const {data:blob,error:photoError}=await cloud.client.storage.from(PROFILE_BUCKET).download(photoPath);
    if(cloud.userId!==requested)return;
    if(!photoError&&blob)profileAvatarUrl=URL.createObjectURL(blob);
    else if(page==='profile')profileStatus('Profile photo unavailable. Apply the private avatar bucket migration if not already installed.',true);
   }
   renderAccountIdentity();if(page==='profile'&&!profileSaving)profileDraw();
  }catch(err){if(page==='profile'&&cloud.userId===requested)profileStatus('Could not load profile: '+(err.message||'Network error'),true);}
 })();
 try{await profileLoading;}finally{profileLoading=null;}
}
async function resizeProfilePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||file.size===0)throw new Error('Choose a JPG, PNG, or WebP image up to 5 MB.');
 const bitmap=await createImageBitmap(file);
 try{
  if(bitmap.width>6000||bitmap.height>6000||bitmap.width*bitmap.height>25000000)throw new Error('Image dimensions are too large.');
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Image processing is unavailable.');
  const side=Math.min(bitmap.width,bitmap.height);ctx.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.78));
  if(!blob||blob.type!=='image/webp'||blob.size>256*1024)throw new Error('Could not prepare a small WebP profile photo.');
  return blob;
 }finally{bitmap.close();}
}
async function saveAccountProfile(e){
 e.preventDefault();if(profileSaving||!ready()||!cloud.userId)return;
 if(profileLoadedUserId!==cloud.userId){profileStatus('Profile is loading. Please try again.',true);return;}
 const name=$('pvProfileName').value.trim(),nickname=$('pvProfileNickname').value.trim(),bio=$('pvProfileBio').value.trim();
 if(name.length>60||nickname.length>30||bio.length>160){profileStatus('A profile field exceeds its character limit.',true);return;}
 const userId=cloud.userId,previous=accountProfile?.avatarPath;
 profileSaving=true;$('pvProfileSave').disabled=true;$('pvProfileDiscard').disabled=true;profileStatus('Saving profile…');
 try{
  let photoPath=previous,uploadedBlob=null;
  if(profilePendingPhoto){
   uploadedBlob=await resizeProfilePhoto(profilePendingPhoto);
   const path=userId+'/avatar.webp';
   const {error}=await cloud.client.storage.from(PROFILE_BUCKET).upload(path,uploadedBlob,{upsert:true,contentType:'image/webp',cacheControl:'3600'});
   if(error)throw new Error('Profile photo upload failed. Check the private Storage bucket setup: '+error.message);
   photoPath=path;
  }else if(profileRemovePhoto)photoPath=null;
  if(cloud.userId!==userId)throw new Error('Your account changed. Sign in again.');
  const {data,error}=await cloud.client.auth.updateUser({data:{pv_display_name:name,pv_nickname:nickname,pv_bio:bio,pv_avatar_path:photoPath}});
  if(error)throw error;
  if(cloud.userId!==userId)return;
  if(profileRemovePhoto&&previous){
   // The metadata is already saved; an unsuccessful removal is non-fatal and
   // leaves a private, unreferenced blob rather than a broken profile.
   const {error:removeError}=await cloud.client.storage.from(PROFILE_BUCKET).remove([previous]);
   if(removeError)profileStatus('Profile saved; old photo cleanup was not completed.',true);
  }
  accountProfile={name,nickname,bio,avatarPath:photoPath,createdAt:data.user?.created_at||accountProfile?.createdAt,lastSignIn:data.user?.last_sign_in_at||accountProfile?.lastSignIn};
  if(profileAvatarUrl)URL.revokeObjectURL(profileAvatarUrl);profileAvatarUrl=null;
  if(uploadedBlob)profileAvatarUrl=URL.createObjectURL(uploadedBlob);
  else if(photoPath&&!profileRemovePhoto){
   const {data:existing}=await cloud.client.storage.from(PROFILE_BUCKET).download(photoPath);
   if(existing&&cloud.userId===userId)profileAvatarUrl=URL.createObjectURL(existing);
  }
  clearProfilePreview();renderAccountIdentity();profileDraw();
  if(!$('pvProfileStatus').classList.contains('error'))profileStatus('Profile saved successfully.');
  tip('Account profile saved');
 }catch(error){profileStatus(error.message||'Profile could not be saved.',true);}
 finally{profileSaving=false;$('pvProfileSave').disabled=false;$('pvProfileDiscard').disabled=false;}
}
function render(){
 if(!ready())return;
 const items=getItems(),h=computeHealth(),vs=vaults();
 $('navCount').textContent=items.length;
 document.querySelectorAll('#approvedUI [data-new]').forEach(button=>{button.disabled=basketCapacityReached();button.title=basketCapacityReached()?'10-item limit reached':'';});
 renderBaskets();
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
 $('quickCreateVault').disabled=vs.length>=2;$('newVaultButton').disabled=vs.length>=2;$('topNew').disabled=vs.length>=2;$('topNew').title=vs.length>=2?'Two-vault limit reached':'Create new vault';
 $('vaultCountTag').textContent=vs.length+' of 2 used';$('manageVaults').innerHTML=vs.map(vaultTile).join('');
 const checks=[{title:'Weak passwords',body:'Short, patterned, or common-prefix login passwords',count:h.weak,icon:'alert',good:h.weak===0},{title:'Reused passwords',body:'Logins sharing an identical password',count:h.reused,icon:'refresh',good:h.reused===0},{title:'Logins without local warnings',body:'No issues found by these basic local checks',count:h.good,icon:'shield-check',good:true}];
 $('securityIssues').innerHTML=checks.map(c=>`<div class="issue-row"><span class="issue-dot ${c.good?'good':''}">${icon(c.icon)}</span><div><h3>${c.title}</h3><p>${c.body}</p></div><strong>${c.count}</strong></div>`).join('')+(h.issues.length?`<div class="section-subhead"><h3>Items worth reviewing</h3></div>${h.issues.map(x=>`<div class="issue-row"><div><h3>${safe(x.title)}</h3><p>Weak or reused login password</p></div><button class="linkbtn" data-open="${safe(x.id)}">Review →</button></div>`).join('')}`:'');
 const syncLabel=cloud.conflict?'Sync conflict':state.dirty?'Unsaved changes':cloud.saveInProgress?'Syncing…':'Unlocked';
 const failure=cloud.lastSaveError || (cloud.conflict?'Another device saved a newer version. Download a backup and reconcile before continuing.':cloud.autoLockDeferred?'Automatic lock deferred while changes are unsaved. Retry sync or download an encrypted backup.':'');
 $('approvedSyncNotice').hidden=!failure;
 $('approvedSyncMessage').textContent=failure;
 $('approvedSyncRetry').disabled=!!cloud.conflict || cloud.saveInProgress;
 $('approvedVaultStatus').title=failure||syncLabel;
 $('approvedVaultStatus').innerHTML=`<span class="dot"></span> ${safe(cloud.vaultLabel||state.vault.name||'Your vault')} · ${syncLabel}`;
 renderAccountIdentity();
}
window.pvRenderApprovedStatus=()=>{if(ready())render();};
function addCustom(label='',value=''){
 const holder=$('approvedCustomFields');if(holder.children.length>=10){tip('Maximum 10 custom fields');return;}
 const div=document.createElement('div');div.className='approved-custom-row';
 const key=document.createElement('input');key.placeholder='Field name';key.maxLength=60;key.value=label;key.setAttribute('aria-label','Custom field name');
 const val=document.createElement('input');val.placeholder='Field value';val.maxLength=1024;val.value=value;val.setAttribute('aria-label','Custom field value');
 const btn=document.createElement('button');btn.type='button';btn.className='btn btn-light';btn.textContent='×';btn.setAttribute('aria-label','Remove custom field');btn.addEventListener('click',()=>div.remove());
 div.append(key,val,btn);holder.append(div);
}
function openEditor(id=null,prepass='',targetBasket='everyday'){
 if(!ready())return;
 if(!id&&basketCapacityReached()){tip('This vault is full: maximum 10 items.');return;}
 basketCreateTarget=isBasketId(targetBasket)?targetBasket:firstBasketId();
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
  let url=kind==='login'?$('itemUrl').value.trim():'';
  if(url){
   if(!/^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(url))url='https://'+url;
   let parsed;try{parsed=new URL(url);}catch{throw new Error('Enter a valid website address.');}
   if(!['http:','https:'].includes(parsed.protocol)||!parsed.hostname.includes('.')||parsed.username||parsed.password)throw new Error('Enter a valid http or https website address.');
   if(url.length>2048)throw new Error('Website address is too long.');
  }
  const username=kind==='login'?$('itemUsername').value.trim():kind==='card'?$('itemCardholder').value.trim():'Secure note';
  const password=kind==='login'?$('itemPassword').value:kind==='note'?$('itemContent').value:$('itemCardnumber').value.replace(/[\s-]/g,'');
  if(!username||!password)throw new Error(kind==='login'?'Username and password are required.':kind==='note'?'Enter a note.':'Enter cardholder and card number.');
  if(password.length>2048)throw new Error('Secret is too long.');
  const tags=[...new Set($('approvedTags').value.split(',').map(x=>x.trim()).filter(Boolean))];
  if(tags.length>10||tags.some(x=>x.length>40))throw new Error('Maximum 10 tags, up to 40 characters each.');
  const customFields=[];for(const row of $('approvedCustomFields').children){const [name,value]=row.querySelectorAll('input');if(name.value.trim())customFields.push({label:name.value.trim(),value:value.value});}
  const existing=editId?findItem(editId):null,now=new Date().toISOString();
  if(kind==='card'){
   const number=$('itemCardnumber').value.replace(/[\s-]/g,'');
   if((!existing||number!==existing.password)&&(!/^\d{12,19}$/.test(number)))throw new Error('Card number must contain 12–19 digits.');
   const expiry=$('approvedExpiry').value.trim();
   if(expiry&&(!existing||expiry!==(existing.expiry||''))&&!/^(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(expiry))throw new Error('Expiry must be MM/YY or MM/YYYY.');
   const cvv=$('approvedCvv').value.trim();
   if(cvv&&(!existing||cvv!==(existing.cvv||''))&&!/^\d{3,4}$/.test(cvv))throw new Error('Security code must be 3 or 4 digits.');
  }
  if(!existing&&basketCapacityReached())throw new Error('Maximum 10 items per vault. Existing items are unchanged.');
  const data={id:existing?.id||secureId(),kind,title,url,username,password,notes:$('itemNotes').value,favorite:$('itemFavorite').checked,tags,customFields,expiry:kind==='card'?$('approvedExpiry').value.trim():'',cvv:kind==='card'?$('approvedCvv').value:'',createdAt:existing?.createdAt||now,updatedAt:now};
  const candidate=existing?getItems().map(x=>x.id===existing.id?data:x):[...getItems(),data];
  validateVaultPlaintext({...state.vault,credentials:candidate});
  if(existing)Object.assign(existing,data);else {
   state.vault.credentials.push(data);
   if(isBasketId(basketCreateTarget)){
    const current=basketState();
    state.vault.overviewBaskets={names:Object.fromEntries(basketDefs().map(b=>[b.id,basketName(b.id)])),assignments:{...current.assignments,[data.id]:basketCreateTarget},custom:[...current.custom],removedBase:[...current.removedBase],order:[...current.order]};
   }
  }
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
function clearGeneratedDisplays(){
 quick='';generated='';$('quickPassword').textContent='';$('approvedGeneratedPassword').textContent='';
 for(const id of ['itemPassword','itemContent','itemCardnumber','approvedCvv'])$(id).value='';
 $('itemPassword').type='password';$('editorReveal').textContent='Show';
 $('detailBody').replaceChildren();
}
window.pvClearApprovedSecrets=clearGeneratedDisplays;
function clearPrivateUI(){
 selected=null;editId=null;clearGeneratedDisplays();query='';$('search').value='';
 for(const id of ['editorDialog','detailDialog','infoDialog','vaultDialog'])if($(id).open)$(id).close();
 $('editorForm').reset();$('detailBody').replaceChildren();$('approvedCustomFields').replaceChildren();
 $('fullTable').replaceChildren();$('favoritesTable').replaceChildren();$('recentTable').replaceChildren();
 $('overviewVaults').replaceChildren();$('manageVaults').replaceChildren();$('quickPassword').textContent='';$('approvedGeneratedPassword').textContent='';
 clearBaskets();$('approvedBackupFallback').classList.add('hidden');$('approvedBackupFallback').removeAttribute('href');
 closeMenu();$('flowsMenu').classList.add('hidden');
}
// The approved vault chooser originally had markup but no event handlers.
// Reuse the existing cloud fetch and *original* master-password input/button.
// This adapter never handles or stores a master password itself.
const gate=$('approvedVaultGate');
const gateVaultList=$('approvedGateVaultList');
const gateSecureForm=$('approvedGateSecureForm');
const nativeUnlockCard=$('unlockVaultScreen').querySelector('.access-card');
const nativeUnlockParent=nativeUnlockCard.parentNode;
const nativeUnlockNext=nativeUnlockCard.nextSibling;
let gateFetchingVault=false;
function restoreNativeUnlockCard(){
 if(nativeUnlockCard.parentNode!==nativeUnlockParent)
  nativeUnlockParent.insertBefore(nativeUnlockCard,nativeUnlockNext);
}
function closeVaultGate(){
 if(gate.open)gate.close();
 restoreNativeUnlockCard();
 $('app').inert=false;
 document.body.classList.remove('approved-gate-active');
}
function showVaultGate(){
 $('app').inert=true; // The dashboard behind the password gate cannot be operated.
 document.body.classList.add('approved-gate-active');
 const unlocking=uiState.accessScreen==='unlock' && !!cloud.selectedVaultId && !!state.pendingImport;
 $('approvedGateBack').hidden=!unlocking;
 $('approvedGateRefresh').hidden=unlocking;
 $('approvedGateCreate').hidden=unlocking;
 gateVaultList.hidden=unlocking;
 gateSecureForm.hidden=!unlocking;
 if(unlocking){
  $('approvedGateEyebrow').textContent='UNLOCK ENCRYPTED VAULT';
  $('approvedGateTitle').textContent=cloud.vaultLabel||'Unlock vault';
  $('approvedGateDescription').textContent="Enter this vault's master password to decrypt it on your device.";
  $('approvedGateHelper').textContent='Your master password is never sent to the cloud.';
  if(nativeUnlockCard.parentNode!==gateSecureForm)gateSecureForm.append(nativeUnlockCard);
 }else{
  restoreNativeUnlockCard();
  $('approvedGateEyebrow').textContent='YOUR PRIVATE WORKSPACE';
  $('approvedGateTitle').textContent='Choose a vault to unlock';
  $('approvedGateDescription').textContent='Select a vault to continue to your workspace.';
  $('approvedGateCreate').disabled=!cloud.loaded || cloud.vaults.length>=2;
  $('approvedGateRefresh').disabled=gateFetchingVault;
  gateVaultList.replaceChildren();
  if(!cloud.loaded){
   const message=document.createElement('p');
   message.textContent='Vault list is unavailable. Try Refresh vaults.';
   gateVaultList.append(message);
  }else if(!cloud.vaults.length){
   const message=document.createElement('p');
   message.textContent='No cloud vaults yet. Create your first vault.';
   gateVaultList.append(message);
  }else{
   for(const vault of cloud.vaults){
    const button=document.createElement('button');
    button.type='button'; button.className='approved-gate-vault';
    button.disabled=gateFetchingVault;
    const lock=document.createElement('span');lock.className='approved-gate-lock';lock.textContent='🔒';lock.setAttribute('aria-hidden','true');
    const body=document.createElement('span');body.className='approved-gate-vault-label';
    const name=document.createElement('strong');name.textContent=vault.label||'Encrypted vault';
    const description=document.createElement('small');description.textContent='Encrypted · Master password required';
    body.append(name,description);
    const arrow=document.createElement('span');arrow.className='approved-gate-arrow';arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
    button.append(lock,body,arrow);
    button.addEventListener('click',async()=>{
     if(gateFetchingVault)return;
     gateFetchingVault=true;showVaultGate();
     $('approvedGateHelper').textContent='Loading encrypted vault…';
     try{await openVaultById(vault.vault_id);}
     finally{gateFetchingVault=false;syncVisible();}
    });
    gateVaultList.append(button);
   }
  }
  const error=$('dashboardStatus').textContent.trim();
  $('approvedGateHelper').textContent=error||'Vault contents remain hidden until unlocked.';
 }
 if(!gate.open)gate.showModal();
}
$('approvedGateBack').addEventListener('click',displayVaultDashboard);
$('approvedGateSignOut').addEventListener('click',()=>void handleSignOut());
$('approvedGateCreate').addEventListener('click',()=>{
 prepareNewVault();
 syncVisible(); // Keep the existing, already-working new-vault creation screen.
});
$('approvedGateRefresh').addEventListener('click',async()=>{
 try{
  await reloadVaultList();cloud.loaded=true;
  clearStatus($('dashboardStatus'));renderVaultDashboard();
 }catch(e){setStatus($('dashboardStatus'),e.message||'Refresh failed','error');}
 syncVisible();
});
gate.addEventListener('cancel',e=>{e.preventDefault();if(uiState.accessScreen==='unlock')displayVaultDashboard();});
function syncVisible(){
 if(ready()){
  closeVaultGate();
  $('approvedUI').hidden=false;
  if(profileLoadedUserId && profileLoadedUserId!==cloud.userId)resetAccountProfile();
  if(profileLoadedUserId!==cloud.userId && !profileLoading)void loadAccountProfile();
  const saved=new URL(location.href).searchParams.get('view');
  if(!window.__pvApprovedWasUnlocked){window.__pvApprovedWasUnlocked=true;createMain();createQuick();navigate(pageTitles[saved]?saved:'overview',false);}
  render();
 }else{
  if(window.__pvApprovedWasUnlocked){window.__pvApprovedWasUnlocked=false;clearPrivateUI();}
  if(profileLoadedUserId && profileLoadedUserId!==cloud.userId)resetAccountProfile();
  const choosing=!!cloud.userId && uiState.accessGranted && uiState.accessScreen!=='create';
  $('approvedUI').hidden=!choosing;
  if(choosing)showVaultGate();else closeVaultGate();
 }
}
// Install handlers only on elements inside the unchanged approved HTML layout.
$('pvProfileForm').addEventListener('submit',e=>void saveAccountProfile(e));
$('pvProfilePhotoButton').addEventListener('click',()=>$('pvProfilePhoto').click());
$('pvProfilePhoto').addEventListener('change',e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||!file.size){profileStatus('Choose a JPG, PNG, or WebP image up to 5 MB.',true);e.target.value='';return;}
 clearProfilePreview();profilePendingPhoto=file;profilePreviewUrl=URL.createObjectURL(file);profileRemovePhoto=false;
 profileAvatarInto($('pvProfileAvatar'),profilePreviewUrl);profileStatus('Photo selected. Save profile to upload.');
});
$('pvProfileRemovePhoto').addEventListener('click',()=>{clearProfilePreview();profileRemovePhoto=true;profileAvatarInto($('pvProfileAvatar'),null);profileStatus('Photo will be removed when you save.');});
$('pvProfileDiscard').addEventListener('click',()=>{clearProfilePreview();profileDraw();profileStatus('Changes discarded.');});
$('editorForm').addEventListener('submit',saveItem);
$('deleteItem').addEventListener('click',deleteItem);
$('editItem').addEventListener('click',()=>{const id=selected;$('detailDialog').close();openEditor(id);});
$('favoriteDetail').addEventListener('click',()=>{const id=selected;$('detailDialog').close();toggleFavorite(id);});
$('editorReveal').addEventListener('click',()=>{const input=$('itemPassword');input.type=input.type==='password'?'text':'password';$('editorReveal').textContent=input.type==='password'?'Show':'Hide';});
$('approvedAddCustom').addEventListener('click',()=>addCustom());
$('themeToggle').addEventListener('click',()=>theme(document.documentElement.dataset.theme!=='dark'));
$('darkSwitch').addEventListener('click',()=>theme(document.documentElement.dataset.theme!=='dark'));
function toggleSidebarPin(){
 const mobile=window.matchMedia('(max-width:760px)').matches;
 if(mobile){const open=$('approvedSidebar').classList.toggle('open');$('approvedMobileBackdrop').classList.toggle('show',open);$('openMenu').setAttribute('aria-expanded',String(open));}
 else {const pinned=$('approvedSidebar').classList.toggle('pinned');$('openMenu').setAttribute('aria-expanded',String(pinned));$('openMenu').setAttribute('aria-label',pinned?'Unpin navigation':'Pin navigation open');$('openMenu').title=pinned?'Unpin navigation':'Pin navigation open';}
 updateMobileSidebarFocus();
}
$('openMenu').addEventListener('click',toggleSidebarPin);
$('approvedMobileBackdrop').addEventListener('click',closeMenu);
$('flowsToggle').addEventListener('click',()=>{closeAccountMenu();const visible=$('flowsMenu').classList.toggle('hidden');$('flowsToggle').setAttribute('aria-expanded',String(!visible));});
$('lockShortcut').addEventListener('click',()=>lockVault('Manual lock'));
$('accountShortcut').addEventListener('click',()=>{$('flowsMenu').classList.add('hidden');$('flowsToggle').setAttribute('aria-expanded','false');const open=$('accountMenu').classList.toggle('hidden');$('accountShortcut').setAttribute('aria-expanded',String(!open));if(!open)$('accountMenu button').focus();});
$('topNew').addEventListener('click',createVaultModal);
$('approvedSyncRetry').addEventListener('click',()=>void saveCloudVault(true));
$('approvedSyncBackup').addEventListener('click',async()=>{
 await handleExportVault();
 if(els.downloadVaultLink.dataset.objectUrl){
  $('approvedBackupFallback').href=els.downloadVaultLink.href;
  $('approvedBackupFallback').download=els.downloadVaultLink.download;
  $('approvedBackupFallback').classList.remove('hidden');
 }
});
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
document.addEventListener('click',e=>{
 if(!e.target.closest('#accountMenu, #accountShortcut'))closeAccountMenu();
 if(!e.target.closest('#flowsMenu, #flowsToggle')){$('flowsMenu').classList.add('hidden');$('flowsToggle').setAttribute('aria-expanded','false');}
 if(!window.matchMedia('(max-width:760px)').matches && !e.target.closest('#approvedSidebar, #openMenu')){
  $('approvedSidebar').classList.remove('pinned');$('openMenu').setAttribute('aria-expanded','false');
  $('openMenu').setAttribute('aria-label','Pin navigation open');$('openMenu').title='Pin navigation open';
 }
});
window.addEventListener('resize',()=>{if(window.matchMedia('(max-width:760px)').matches){$('approvedSidebar').classList.remove('pinned');}else{closeMenu();}updateMobileSidebarFocus();});
$('approvedUI').addEventListener('click',e=>{
 const target=e.target.closest('button');if(!target||!$('approvedUI').contains(target))return;
 const deleteBasket=target.closest('[data-basket-delete]');if(deleteBasket){basketDeleteTarget=deleteBasket.dataset.basketDelete;if(!isBasketId(basketDeleteTarget)||basketDefs().length<=1)return;const destination=basketDefs().find(b=>b.id!==basketDeleteTarget);$('pvbDeleteDescription').textContent='Delete '+basketName(basketDeleteTarget)+'? Its items will be moved to '+basketName(destination.id)+'. This cannot be undone.';$('pvbDeleteDialog').showModal();return;}
 const addBasket=target.closest('[data-basket-add]');if(addBasket){openEditor(null,'',addBasket.dataset.basketAdd);return;}
 const renameBasket=target.closest('[data-basket-rename]');if(renameBasket){basketRenameTarget=renameBasket.dataset.basketRename;$('pvbRenameInput').value=basketName(basketRenameTarget);$('pvbRenameDialog').showModal();$('pvbRenameInput').focus();return;}
 const moveBasket=target.closest('[data-basket-move]');if(moveBasket){basketMoveTarget=moveBasket.dataset.basketMove;const x=findItem(basketMoveTarget);if(!x)return;$('pvbMoveDescription').textContent=x.title;const sel=$('pvbMoveSelect');sel.replaceChildren();for(const b of basketDefs()){const opt=document.createElement('option');opt.value=b.id;opt.textContent=basketName(b.id);opt.selected=b.id===itemBasket(basketMoveTarget);sel.append(opt);}$('pvbMoveDialog').showModal();return;}
 const profileAction=target.closest('[data-profile-action]');if(profileAction){if(profileAction.dataset.profileAction==='password'){navigate('settings');$('changeAccountPasswordForm').scrollIntoView({behavior:'smooth',block:'center'});$('currentAccountPassword').focus();}return;}
 const close=target.closest('[data-close]');if(close){$(close.dataset.close).close();return;}
 const to=target.closest('[data-page]');if(to){closeAccountMenu();navigate(to.dataset.page);return;}
 const newb=target.closest('[data-new]');if(newb){openEditor();return;}
 const filteredButton=target.closest('[data-filter]');if(filteredButton){filter=filteredButton.dataset.filter;document.querySelectorAll('#approvedUI [data-filter]').forEach(x=>x.classList.toggle('selected',x===filteredButton));render();return;}
 const typeb=target.closest('[data-kind]');if(typeb){changeKind(typeb.dataset.kind);return;}
 const open=target.closest('[data-open]');if(open){openDetail(open.dataset.open);return;}
 const fav=target.closest('[data-fav]');if(fav){toggleFavorite(fav.dataset.fav);return;}
 const v=target.closest('[data-selectvault]');if(v){selectVault(v.dataset.selectvault);return;}
 const flow=target.closest('[data-flow]');if(flow){closeAccountMenu();if(flow.dataset.flow==='signout')void handleSignOut();else if(flow.dataset.flow==='lock')lockVault('Manual lock');else navigate('vaults');return;}
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
$('pvbCreateButton').addEventListener('click',()=>{
 if(!ready()||basketDefs().length>=BASKET_MAX)return;
 $('pvbCreateInput').value='';$('pvbCreateDialog').showModal();$('pvbCreateInput').focus();
});
$('pvbCreateForm').addEventListener('submit',e=>{
 e.preventDefault();if(!ready()||basketDefs().length>=BASKET_MAX)return;
 const name=$('pvbCreateInput').value.trim();if(!name||name.length>20)return;
 const id='custom-'+secureId();
 $('pvbCreateDialog').close();mutateBaskets(b=>{b.custom.push(id);b.order.push(id);b.names[id]=name;});tip('Basket created');
});
$('pvbDeleteForm').addEventListener('submit',e=>{
 e.preventDefault();const id=basketDeleteTarget;
 if(!ready()||!isBasketId(id)||basketDefs().length<=1)return;
 $('pvbDeleteDialog').close();basketDeleteTarget=null;
 deleteBasketAndMoveItems(id);
});
$('pvbRenameForm').addEventListener('submit',e=>{
 e.preventDefault();if(!ready()||!isBasketId(basketRenameTarget))return;
 const name=$('pvbRenameInput').value.trim();if(!name||name.length>20)return;
 const id=basketRenameTarget;$('pvbRenameDialog').close();mutateBaskets(b=>{b.names[id]=name;});tip('Basket renamed');
});
$('pvbMoveForm').addEventListener('submit',e=>{
 e.preventDefault();if(!ready())return;
 const id=basketMoveTarget,to=$('pvbMoveSelect').value;$('pvbMoveDialog').close();basketMove(id,to);
});
// Desktop drag/drop; mobile and keyboard users have an explicit Move action.
$('pvbGrid').addEventListener('dragstart',e=>{
 const handle=e.target.closest('[data-basket-reorder]');
 if(handle && !e.target.closest('button') && ready()){basketReordering=handle.dataset.basketReorder;basketDragging=null;handle.closest('.pvb-basket').classList.add('pvb-reordering');if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','basket:'+basketReordering);}return;}
 const tile=e.target.closest('[data-basket-drag]');if(!tile||!ready())return;
 basketDragging=tile.dataset.basketDrag;
 if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',basketDragging);}
 tile.classList.add('pvb-dragging');
});
$('pvbGrid').addEventListener('dragover',e=>{
 const box=e.target.closest('[data-basket-drop]');if(!box)return;
 if(basketReordering){e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';clearReorderMarkers();box.classList.add('pvb-reorder-target');return;}
 if(!basketDragging)return;
 e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';
 document.querySelectorAll('#pvbGrid .pvb-basket').forEach(b=>b.classList.toggle('pvb-drop-target',b===box));
});
$('pvbGrid').addEventListener('drop',e=>{
 const box=e.target.closest('[data-basket-drop]');if(!box)return;
 if(basketReordering){e.preventDefault();const from=basketReordering;basketReordering=null;clearReorderMarkers();reorderBasket(from,box.dataset.basketDrop);return;}
 if(!basketDragging)return;
 e.preventDefault();const id=basketDragging;basketDragging=null;
 document.querySelectorAll('#pvbGrid .pvb-basket').forEach(b=>b.classList.remove('pvb-drop-target'));
 basketMove(id,box.dataset.basketDrop);
});
$('pvbGrid').addEventListener('dragend',()=>{basketDragging=null;basketReordering=null;clearReorderMarkers();document.querySelectorAll('#pvbGrid .pvb-basket').forEach(b=>b.classList.remove('pvb-drop-target'));});
// Keyboard-accessible rearranging, including for touch devices without native drag events.
$('pvbGrid').addEventListener('keydown',e=>{
 const handle=e.target.closest('[data-basket-keyboard]');if(!handle||!ready()||e.target!==handle)return;
 if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'&&e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
 e.preventDefault();const order=basketDefs().map(b=>b.id),from=order.indexOf(handle.dataset.basketKeyboard),next=from+(e.key==='ArrowLeft'||e.key==='ArrowUp'?-1:1);
 if(next<0||next>=order.length)return;
 const id=order[from];reorderBasket(id,order[next]);const moved=$('pvbGrid').querySelector(`[data-basket-keyboard="${id}"]`);moved?.focus();
});
// Touch/pen long press on the colored header reorders baskets without changing item dragging.
$('pvbGrid').addEventListener('pointerdown',e=>{
 if(e.pointerType==='mouse'||!ready()||e.target.closest('button'))return;
 const handle=e.target.closest('[data-basket-reorder]');if(!handle)return;
 const hold={id:handle.dataset.basketReorder,pointerId:e.pointerId,x:e.clientX,y:e.clientY,active:false,target:null,timer:null};
 hold.timer=setTimeout(()=>{hold.active=true;handle.closest('.pvb-basket')?.classList.add('pvb-reordering');},240);
 basketPointerHold=hold;
});
$('pvbGrid').addEventListener('pointermove',e=>{
 const hold=basketPointerHold;if(!hold||e.pointerId!==hold.pointerId)return;
 if(!hold.active && Math.hypot(e.clientX-hold.x,e.clientY-hold.y)>9){clearTimeout(hold.timer);basketPointerHold=null;return;}
 if(!hold.active)return;
 e.preventDefault();const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-basket-drop]');
 clearReorderMarkers();$('pvbGrid').querySelector(`[data-basket-drop="${hold.id}"]`)?.classList.add('pvb-reordering');
 if(target && target.dataset.basketDrop!==hold.id){hold.target=target.dataset.basketDrop;target.classList.add('pvb-reorder-target');}else hold.target=null;
});
function endBasketPointer(e){const hold=basketPointerHold;if(!hold||e.pointerId!==hold.pointerId)return;clearTimeout(hold.timer);basketPointerHold=null;clearReorderMarkers();if(hold.active&&hold.target&&e.type==='pointerup')reorderBasket(hold.id,hold.target);}
$('pvbGrid').addEventListener('pointerup',endBasketPointer);
$('pvbGrid').addEventListener('pointercancel',endBasketPointer);
document.addEventListener('keydown',e=>{
 if(!ready())return;
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('search').focus();}
 if(e.key==='Escape'){$('flowsMenu').classList.add('hidden');$('flowsToggle').setAttribute('aria-expanded','false');closeAccountMenu();closeMenu();$('approvedSidebar').classList.remove('pinned');$('openMenu').setAttribute('aria-expanded','false');}
});
window.addEventListener('popstate',()=>{if(ready()){const v=new URL(location.href).searchParams.get('view');navigate(pageTitles[v]?v:'overview',false);}});
// Keep the chooser synchronized when vaults are opened/switched or created from
// any existing entry point (including the unlocked dashboard tiles).
const originalOpenVaultById=openVaultById;
openVaultById=async function(...args){
 try{return await originalOpenVaultById(...args);}
 finally{syncVisible();}
};
const originalPrepareNewVault=prepareNewVault;
prepareNewVault=function(...args){
 const result=originalPrepareNewVault(...args);
 syncVisible();
 return result;
};
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
$('topNew').disabled=false;updateMobileSidebarFocus();
// Preserve a previously chosen appearance; use the approved light preview on a fresh session.
let savedTheme=null;try{savedTheme=sessionStorage.getItem('passvault-theme');}catch{}
theme(savedTheme==='dark');
$('openMenu').setAttribute('aria-expanded','false');
$('approvedUI').hidden=true;
syncVisible();
})();
