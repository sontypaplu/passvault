/* PassVault 3.0 premium interface.
 * The existing crypto, auth, encryption, save and lock APIs remain authoritative.
 * DOM values displayed here come only from the currently unlocked in-memory vault.
 * No analytics, remote fonts, tracking or password checking services are used.
 */
(() => {
  'use strict';
  const pv = (id) => document.getElementById(id);
  const ui = { view: 'overview', filter: 'all', search: '', sort: 'updated', detailId: null, generated: '', quick: '', init: false, toastTimer: null };
  const ICONS = { login: 'key', note: 'folder', card: 'lock' };
  const canRead = () => !state.locked && !!state.vault && uiState.accessGranted;
  const records = () => canRead() ? state.vault.credentials : [];
  const itemKind = (item) => ['login','note','card'].includes(item.kind) ? item.kind : 'login';
  const txt = (id, value) => { if (pv(id)) pv(id).textContent = String(value); };
  function el(tag, cls = '', text = '') { const node=document.createElement(tag); if(cls) node.className=cls; if(text !== '') node.textContent=String(text); return node; }
  function control(label, fn, cls = 'secondary') { const b=el('button',cls,label); b.type='button'; b.addEventListener('click',fn); return b; }
  function notify(message) {
    const toast = pv('pv3Toast'); if (!toast) return;
    toast.textContent = message; toast.classList.add('show');
    clearTimeout(ui.toastTimer); ui.toastTimer=setTimeout(()=>toast.classList.remove('show'),3600);
  }
  function health() {
    const logins = records().filter(x => itemKind(x)==='login');
    const seen = new Map(); let weak=0,reused=0,strong=0;
    for (const x of logins) {
      const pwd = x.password || '';
      const count = seen.get(pwd) || 0; if (count) reused++;
      seen.set(pwd,count+1);
      if (pwd.length < 12 || /^(password|1234|qwerty|admin|welcome)/i.test(pwd) || /^(.)\1{5,}$/.test(pwd)) weak++;
      else strong++;
    }
    const score = logins.length === 0 ? null : Math.max(0,Math.min(100,Math.round(100 - (weak*50 + reused*30)/logins.length)));
    return {logins:logins.length,weak,reused,strong,score};
  }
  function renderHealth() {
    const h=health(); txt('pv3MetricScore', h.logins===0 ? '—' : String(h.weak+h.reused));
    txt('pv3MetricAlerts',h.weak+h.reused); txt('pv3Strong',h.strong);
    txt('pv3Reused',h.reused); txt('pv3Weak',h.weak);
    txt('pv3Gauge',h.logins===0?'—':String(h.weak+h.reused)); txt('pv3SecurityGauge',h.logins===0?'—':String(h.weak+h.reused));
    const box=pv('pv3SecurityDetails'); box.replaceChildren();
    for(const [title,note,n] of [
      ['Strong passwords','At least 12 characters and not flagged by the basic local checks',h.strong],
      ['Reused passwords','Additional login entries using an identical password',h.reused],
      ['Weak passwords','Short, patterned or common-prefix login passwords',h.weak],
      ['Encrypted at rest','Encryption and decryption happen on this device',records().length]
    ]) {
      const row=el('div','checkrow'); const ico=el('span','check-ico','✓');
      const contents=el('div'); contents.append(el('div','checkname',title),el('div','checkdesc',note));
      row.append(ico,contents,el('span','checkcount',n)); box.append(row);
    }
    const counts=new Map();
    for(const x of records().filter(x=>itemKind(x)==='login')) counts.set(x.password,(counts.get(x.password)||0)+1);
    const flagged=records().filter(x=>itemKind(x)==='login' && (
      x.password.length < 12 || /^(password|1234|qwerty|admin|welcome)/i.test(x.password) || /^(.)\1{5,}$/.test(x.password) || counts.get(x.password)>1
    ));
    if (flagged.length) {
      box.append(el('h3','pv3-health-subtitle','Review these logins'));
      for(const x of flagged) {
        const entry=el('div','checkrow');
        const detail=el('div');detail.append(el('div','checkname',x.title),el('div','checkdesc','Weak or reused login password'));
        entry.append(detail,control('Edit →',()=>openEditor(x.id),'secondary'));box.append(entry);
      }
    }
  }
  function allSorted() {
    const q=ui.search.trim().toLowerCase();
    let items=records().filter(x => {
      if(ui.view === 'items' && ui.filter !== 'all' && itemKind(x) !== ui.filter) return false;
      return !q || [x.title,x.username,x.url,x.notes,...(Array.isArray(x.tags)?x.tags:[])].some(v=>String(v||'').toLowerCase().includes(q));
    });
    items=[...items];
    if(ui.sort==='name') items.sort((a,b)=>a.title.localeCompare(b.title));
    else if(ui.sort==='created') items.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
    else items.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
    return items;
  }
  function rowFor(item) {
    const kind=itemKind(item); const row=el('div','recentrow pv3-item-row');
    const logo=el('div',`itemlogo ${kind==='card'?'green':kind==='note'?'violet':'blue'}`,item.title.slice(0,1).toUpperCase() || '•');
    const names=el('div','pv3-row-names'); names.append(el('div','itemname',item.title), el('div','itemsub',kind==='login'?item.username:(kind==='note'?'Secure note':'Payment card')));
    const type=el('span','mini-pill',kind==='login'?'Login':kind==='note'?'Note':'Card');
    const updated=el('span','updated',new Date(item.updatedAt).toLocaleDateString());
    const fav=control(item.favorite?'★':'☆',()=>{toggleFavorite(item.id);},'pv3-star'); fav.title=item.favorite?'Remove favorite':'Add favorite';
    const open=control('↗',()=>openDetail(item.id),'dots-btn'); open.setAttribute('aria-label',`View ${item.title}`);
    row.append(logo,names,type,updated,fav,open);
    row.addEventListener('dblclick',()=>openDetail(item.id));
    return row;
  }
  function rows(containerId,items,emptyText) {
    const node=pv(containerId); if(!node) return;
    node.replaceChildren();
    if(!items.length) { node.append(el('div','empty',emptyText)); return; }
    for(const item of items) node.append(rowFor(item));
  }
  function renderItems() {
    const data=allSorted();
    rows('pv3AllItems',data,'No items match your search. Create a new encrypted item to start.');
    rows('pv3VaultItems',data,'This vault has no matching items yet.');
    rows('pv3Favorites',data.filter(x=>x.favorite),'No favorites yet. Star any item to add it here.');
    rows('pv3Recent',[...records()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,4),'No items yet. Choose New item to get started.');
    txt('pv3SideItems',records().length);
    txt('pv3SideFavorites',records().filter(x=>x.favorite).length);
    txt('pv3MetricItems',records().length);
  }
  function renderVaults() {
    const vaults=cloud.loaded ? cloud.vaults : [];
    const n=vaults.length;
    txt('pv3MetricVaults',n); txt('pv3SideCapacity',`${n} / 2`); txt('pv3LimitSide',`${n} / 2`);
    txt('pv3SideLimitNote', n>=2?'Full':`${2-n} left`);
    txt('pv3SettingsVaults',`${n} of 2 vaults used`);
    txt('pv3CapacityTag',n>=2?'LIMIT REACHED':'ROOM TO GROW');
    pv('pv3LimitTrack').style.width=`${Math.min(n,2)*50}%`;
    const cap=pv('pv3CapTrack'); cap.style.background=`linear-gradient(to right, #9986fa ${Math.min(n,2)*50}%, #222b40 ${Math.min(n,2)*50}%)`;
    const big=pv('pv3CapBig');big.replaceChildren(document.createTextNode(String(n)+' '),el('span','','/ 2 vaults'));
    for (const id of ['pv3CreateVault','pv3CreateVaultSide']) {
      const btn=pv(id); btn.title=n>=2?'Maximum 2 vaults per account':'Create a new encrypted vault';
      btn.setAttribute('aria-disabled',String(n>=2));
      if(id==='pv3CreateVault') btn.textContent=n>=2?'Create another vault · Limit reached':'+ Create a vault';
    }
    const list=pv('pv3SideVaults'),cards=pv('pv3VaultCards'); list.replaceChildren();cards.replaceChildren();
    if(!vaults.length) cards.append(el('div','empty','No vaults found. Create your first encrypted vault.'));
    for(let i=0;i<vaults.length;i++) {
      const v=vaults[i];const active=cloud.selectedVaultId===v.vault_id;
      const nav=control(`${i===0?'◆':'●'}  ${v.label}${active?' · Open':''}`,()=>selectVault(v.vault_id),'navitem');
      nav.classList.toggle('active',active);nav.title=active?'Currently unlocked':'Unlock this vault to access its contents'; list.append(nav);
      const card=control('',()=>selectVault(v.vault_id),'vaultcard');
      const ico=el('span','vaulticon');ico.textContent=i===0?'♙':'▣';
      card.append(ico,el('div','vaultname',v.label),el('div','vaultcount',active?`${records().length} items · Unlocked`:'Locked · Separate master password'),el('span','pv3-vault-arrow','↗'));
      cards.append(card);
    }
  }
  function render() {
    if(!ui.init || !canRead()) return;
    txt('pv3Email',cloud.email||'Signed in');
    txt('pv3VaultTitle',cloud.vaultLabel||state.vault.name||'Your vault');
    txt('pv3Sync',cloud.conflict?'Sync conflict':state.dirty?'Unsaved changes':cloud.saveInProgress?'Saving…':'Encrypted cloud sync');
    txt('pv3SaveText', cloud.conflict?'A newer cloud revision exists. Export a backup before making further changes.':state.dirty?'Changes are pending encrypted cloud save.':'Vault encryption is performed in your browser.');
    renderVaults();renderItems();renderHealth();
  }
  function clean() {
    if (!ui.init) return;
    for(const id of ['pv3AllItems','pv3VaultItems','pv3Favorites','pv3Recent','pv3SecurityDetails','pv3SideVaults','pv3VaultCards','pv3DetailBody']) pv(id)?.replaceChildren();
    pv('pv3ItemForm').reset();
    for(const id of ['pv3ItemDialog','pv3DetailDialog']) {if(pv(id)?.open)pv(id).close();}
    txt('pv3Generated',''); txt('pv3QuickPassword','');ui.generated='';ui.quick='';ui.detailId=null;ui.search='';pv('pv3Search').value='';
    txt('pv3MetricItems','0');txt('pv3SideItems','0');txt('pv3MetricScore','—');
  }
  const allowedViews = ['overview','items','favorites','vault','security','generator','settings'];
  const currentRoute = () => new URL(location.href).searchParams.get('view') || 'overview';
  function closeMobileNav() {
    const sidebar=pv('pv3Sidebar');
    if(!sidebar.classList.contains('open')) return false;
    sidebar.classList.remove('open'); sidebar.setAttribute('aria-hidden','true');
    pv('pv3NavBackdrop').hidden=true;
    pv('pv3MobileToggle').setAttribute('aria-expanded','false');
    pv('pv3MobileToggle').setAttribute('aria-label','Open navigation');
    pv('pv3MobileToggle').focus({preventScroll:true});
    return true;
  }
  window.pvCloseMobileNav = closeMobileNav;
  window.pvClearPremiumSecrets = () => { ui.generated='';ui.quick='';txt('pv3Generated','');txt('pv3QuickPassword',''); };
  function openMobileNav() {
    const sidebar=pv('pv3Sidebar'); sidebar.classList.add('open'); sidebar.setAttribute('aria-hidden','false');
    pv('pv3NavBackdrop').hidden=false;
    pv('pv3MobileToggle').setAttribute('aria-expanded','true');pv('pv3MobileToggle').setAttribute('aria-label','Close navigation');
    sidebar.querySelector('.navitem')?.focus({preventScroll:true});
  }
  function navigate(view, push = true, moveFocus = true) {
    if(!canRead()) return;
    if(!allowedViews.includes(view))view='overview';
    ui.view=view;
    for(const screen of pv('premiumApp').querySelectorAll('.screen')) screen.classList.toggle('active',screen.id===`pv3View-${view}`);
    for(const b of pv('premiumApp').querySelectorAll('[data-pv-view]')) {const active=b.dataset.pvView===view;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
    txt('pv3Crumb',({overview:'Overview',items:'All items',favorites:'Favorites',vault:cloud.vaultLabel,security:'Security center',generator:'Password generator',settings:'Settings'})[view]);
    if(push){ const url = new URL(location.href);url.searchParams.set('view',view);url.searchParams.delete('auth');if(url.href!==location.href)history.pushState({pvView:view},'',url); }
    document.title = `${({overview:'Overview',items:'All items',favorites:'Favorites',vault:'My vault',security:'Security center',generator:'Password generator',settings:'Settings'})[view]} | PassVault`;
    closeMobileNav();renderItems();
    const main=pv('pv3Main'); if(main)main.scrollTop=0;
    window.scrollTo({top:0,behavior:'instant'});
    if(moveFocus){const heading=pv(`pv3View-${view}`)?.querySelector('h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
  }
  function selectVault(id) {
    if (!cloud.userId || !cloud.loaded) return;
    if(id===cloud.selectedVaultId) {navigate('vault');return;}
    displayVaultDashboard();
    if(!state.locked) return; // user declined discard confirmation
    void openVaultById(id);
  }
  function createVault() {
    if(!cloud.loaded) return notify('Vault list is not ready.');
    if(cloud.vaults.length>=2) return notify('Limit reached: two encrypted vaults per account.');
    displayVaultDashboard();if(!state.locked)return;
    prepareNewVault();
  }
  function requireReady() { if(!canRead()) {notify('Unlock your vault to continue.');return false;} return true; }
  function toggleFavorite(id) {
    if(!requireReady())return;
    const it=records().find(x=>x.id===id);if(!it)return;
    const now=new Date().toISOString();
    try{recordVaultHistory(it, {...it, favorite:!it.favorite, updatedAt:now}, 'edited', now);}catch(error){notify(error.message);return;}
    it.favorite=!it.favorite;it.updatedAt=now;state.vault.updatedAt=now;
    setDirty(true);renderVault();notify(it.favorite?'Added to favorites':'Removed from favorites');
  }
  function openEditor(id=null,prePassword='') {
    if(!requireReady())return;
    const it=id?records().find(x=>x.id===id):null;
    const form=pv('pv3ItemForm');form.reset();pv('pv3CustomFields').replaceChildren();
    txt('pv3ItemDialogTitle',it?'Edit item':'New item');txt('pv3ItemError','');
    pv('pv3EditId').value=it?.id||'';
    pv('pv3ItemType').value=it?itemKind(it):'login';pv('pv3ItemTitle').value=it?.title||'';
    pv('pv3ItemURL').value=it?.url||'';
    pv('pv3ItemUsername').value=it && itemKind(it)==='login'?it.username:'';
    pv('pv3ItemPassword').value=it && itemKind(it)==='login'?it.password:prePassword;
    pv('pv3NoteContent').value=it&&itemKind(it)==='note'?it.password:'';
    pv('pv3Cardholder').value=it&&itemKind(it)==='card'?it.username:'';
    pv('pv3CardNumber').value=it&&itemKind(it)==='card'?it.password:'';
    pv('pv3CardExpiry').value=it?.expiry||'';pv('pv3CardCvv').value=it?.cvv||'';
    pv('pv3ItemNotes').value=it?.notes||'';
    pv('pv3ItemTags').value=Array.isArray(it?.tags)?it.tags.join(', '):'';
    pv('pv3ItemFavorite').checked=!!it?.favorite;
    pv('pv3ItemPassword').type='password';pv('pv3RevealLogin').textContent='Show';
    for(const f of (Array.isArray(it?.customFields)?it.customFields:[])) addCustom(f.label,f.value);
    changeItemKind();pv('pv3ItemDialog').showModal();pv('pv3ItemTitle').focus();
  }
  function changeItemKind() {
    const kind=pv('pv3ItemType').value;
    for(const [id,type] of [['pv3LoginFields','login'],['pv3NoteFields','note'],['pv3CardFields','card']]) pv(id).classList.toggle('hidden',kind!==type);
  }
  function addCustom(label='',value='') {
    const box=pv('pv3CustomFields');if(box.childElementCount>=10)return notify('Maximum 10 custom fields');
    const row=el('div','pv3-custom-row');
    const labelInput=el('input');labelInput.placeholder='Field name';labelInput.maxLength=60;labelInput.value=label;labelInput.setAttribute('aria-label','Custom field name');
    const valueInput=el('input');valueInput.placeholder='Field value';valueInput.maxLength=1024;valueInput.value=value;valueInput.setAttribute('aria-label','Custom field value');
    row.append(labelInput,valueInput,control('×',()=>row.remove(),'pv3-x'));box.append(row);
  }
  function saveItem(event) {
    event.preventDefault(); if(!requireReady())return;
    try {
      const kind=pv('pv3ItemType').value;
      const title=pv('pv3ItemTitle').value.trim(); if(!title)throw new Error('Title is required.');
      const url=kind==='login'?pv('pv3ItemURL').value.trim():'';
      if(url) {const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))throw new Error('Website must use http or https.');}
      const username=kind==='login'?pv('pv3ItemUsername').value.trim():(kind==='card'?pv('pv3Cardholder').value.trim():'Secure note');
      const password=kind==='login'?pv('pv3ItemPassword').value:(kind==='note'?pv('pv3NoteContent').value:pv('pv3CardNumber').value.replace(/\s/g,''));
      if(!username || !password)throw new Error(kind==='login'?'Username and password are required.':kind==='note'?'Enter a note.':'Enter cardholder and card number.');
      if(password.length>2048)throw new Error('Secret is too long.');
      const tags=[...new Set(pv('pv3ItemTags').value.split(',').map(x=>x.trim()).filter(Boolean))];
      if(tags.length>10 || tags.some(x=>x.length>40))throw new Error('Maximum 10 tags, up to 40 characters each.');
      const customFields=[];
      for(const row of pv('pv3CustomFields').children){const [name,value]=row.querySelectorAll('input');if(name.value.trim())customFields.push({label:name.value.trim(),value:value.value});}
      const notes=pv('pv3ItemNotes').value;
      const expiry=kind==='card'?pv('pv3CardExpiry').value.trim():'';
      const cvv=kind==='card'?pv('pv3CardCvv').value:'';
      const existing=records().find(x=>x.id===pv('pv3EditId').value);
      const now=new Date().toISOString();
      const data={id:existing?.id||secureId(),kind,title,url,username,password,notes,
        favorite:pv('pv3ItemFavorite').checked,tags,customFields,expiry,cvv,
        createdAt:existing?.createdAt||now,updatedAt:now};
      if(!existing && records().length>=10)throw new Error('Maximum 10 items per vault. Existing items can still be edited.');
      const candidate = existing ? records().map(x => x.id === existing.id ? data : x) : [...records(),data];
      validateVaultPlaintext({...state.vault, credentials:candidate});
      recordVaultHistory(existing, data, existing?'edited':'created', now);
      if(existing)Object.assign(existing,data);else state.vault.credentials.push(data);
      state.vault.updatedAt=now;setDirty(true);
      pv('pv3ItemDialog').close();pv('pv3ItemForm').reset();pv('pv3CustomFields').replaceChildren();
      renderVault(); notify('Item saved locally · encrypted cloud sync scheduled');
    }catch(err){txt('pv3ItemError',err.message||'Unable to save item');}
  }
  function openDetail(id) {
    if(!requireReady())return;
    const item=records().find(x=>x.id===id);if(!item)return;
    ui.detailId=id;txt('pv3DetailTitle',item.title);
    const body=pv('pv3DetailBody');body.replaceChildren();
    const field=(label,value,secret=false)=>{
      const wrap=el('div','pv3-detail-field');wrap.append(el('strong','',label));
      if(secret){const input=el('input');input.readOnly=true;input.type='password';input.value=value;input.autocomplete='off';const reveal=control('Show',()=>{input.type=input.type==='password'?'text':'password';reveal.textContent=input.type==='password'?'Show':'Hide';}); const box=el('div','pv3-fieldrow');box.append(input,reveal);wrap.append(box);}
      else wrap.append(el('div','pv3-detail-value',value||'—'));
      body.append(wrap);
    };
    const kind=itemKind(item);
    field('Type',kind==='login'?'Login':kind==='note'?'Secure note':'Payment card');
    if(kind==='login'){field('Username',item.username);if(item.url)field('Website',item.url);field('Password',item.password,true);}
    else if(kind==='note'){field('Private note',item.password,true);}
    else{field('Cardholder',item.username);field('Card number',item.password,true);if(item.expiry)field('Expiry',item.expiry);if(item.cvv)field('Security code',item.cvv,true);}
    if(item.notes)field('Notes',item.notes);
    if(Array.isArray(item.tags) && item.tags.length)field('Tags',item.tags.join(', '));
    for(const f of (item.customFields||[]))field(f.label,f.value,true);
    txt('pv3DetailFavorite',item.favorite?'Unfavorite ★':'Favorite ☆');
    pv('pv3DetailDialog').showModal();
  }
  function deleteItem() {
    if(!requireReady())return;
    const item=records().find(x=>x.id===ui.detailId);if(!item)return;
    if(!window.confirm(`Permanently remove “${item.title}” and its encrypted edit history from this vault?`))return;
    try{purgeVaultItemHistory(item.id);}catch(error){notify(error.message);return;}
    state.vault.credentials=state.vault.credentials.filter(x=>x.id!==item.id);
    state.vault.updatedAt=new Date().toISOString();setDirty(true);
    pv('pv3DetailDialog').close();ui.detailId=null;renderVault();notify('Item removed · encrypted sync scheduled');
  }
  async function copySecret(value) {
    if(!requireReady()||!value)return;
    try {await writeClipboard(value);scheduleClipboardClear();notify('Copied · clipboard clearing is best-effort');}
    catch(e){notify('Clipboard unavailable: '+e.message);}
  }
  function passwordOptions(length=20) { return {length,lower:true,upper:pv('pv3Upper').checked,numbers:pv('pv3Numbers').checked,symbols:pv('pv3Symbols').checked}; }
  function generateFull(){try{ui.generated=generatePassword(passwordOptions(Number(pv('pv3Length').value)));txt('pv3Generated',ui.generated);}catch(e){notify(e.message);}}
  function generateQuick(){ui.quick=generatePassword({length:20,upper:true,lower:true,numbers:true,symbols:true});txt('pv3QuickPassword',ui.quick);}
  function light(on) { window.PassVaultTheme.set(on ? 'light' : 'dark'); }
  function initialize() {
    if(ui.init)return;ui.init=true;
    pv('pv3AccountActions').append(document.querySelector('.account-settings-grid'));
    // Move the original working download fallback into the visible Settings screen.
    const fallback = document.getElementById('downloadVaultLink');
    fallback.classList.add('pv3-backup-fallback');
    document.getElementById('pv3SettingsBackup').after(fallback);
    pv('pv3AutoLock').value=String(state.sessionTimeoutMs);pv('pv3Clipboard').value=String(state.clipboardTimeoutMs);
    light(document.documentElement.dataset.theme === 'light');
    for(const button of pv('premiumApp').querySelectorAll('[data-pv-view]'))button.addEventListener('click',()=>navigate(button.dataset.pvView));
    for(const b of pv('premiumApp').querySelectorAll('[data-pv-new]')) b.addEventListener('click',()=>openEditor());
    for(const b of pv('premiumApp').querySelectorAll('[data-pv-close]'))b.addEventListener('click',()=>pv(b.dataset.pvClose)?.close());
    pv('pv3NewItem').addEventListener('click',()=>openEditor());
    const searchBox = pv('pv3Search').closest('.searchbox');
    searchBox.addEventListener('click',()=>{searchBox.classList.add('search-open'); pv('pv3Search').focus();});
    searchBox.addEventListener('focusout',()=>{setTimeout(()=>searchBox.classList.remove('search-open'),150);});
    pv('pv3Search').addEventListener('input',()=>{ui.search=pv('pv3Search').value;navigate('items',true,false);renderItems();});
    pv('pv3Search').addEventListener('keydown',e=>{if(e.key==='Escape'){pv('pv3Search').value='';ui.search='';renderItems();}});
    for(const b of pv('premiumApp').querySelectorAll('[data-pv-filter]')) b.addEventListener('click',()=>{
      ui.filter=b.dataset.pvFilter;for(const item of pv('premiumApp').querySelectorAll('[data-pv-filter]'))item.classList.toggle('active',item===b);renderItems();
    });
    pv('pv3Sort').addEventListener('change',()=>{ui.sort=pv('pv3Sort').value;renderItems();});
    for(const id of ['pv3CreateVault','pv3CreateVaultSide'])pv(id).addEventListener('click',createVault);
    for(const id of ['pv3ManageVaults','pv3AllVaults','pv3SettingsManage'])pv(id).addEventListener('click',displayVaultDashboard);
    for(const id of ['pv3Save','pv3SettingsSave'])pv(id).addEventListener('click',()=>void saveCloudVault(true));
    for(const id of ['pv3Backup','pv3SettingsBackup'])pv(id).addEventListener('click',()=>void handleExportVault());
    pv('pv3Lock').addEventListener('click',()=>lockVault('Manual lock'));
    pv('pv3SignOut').addEventListener('click',()=>void handleSignOut());
    pv('pv3MobileToggle').addEventListener('click',()=>pv('pv3Sidebar').classList.contains('open')?closeMobileNav():openMobileNav());
    pv('pv3NavBackdrop').addEventListener('click',closeMobileNav);
    const syncMobileNav = () => { if(window.innerWidth > 760){closeMobileNav();pv('pv3Sidebar').setAttribute('aria-hidden','false');}else if(!pv('pv3Sidebar').classList.contains('open'))pv('pv3Sidebar').setAttribute('aria-hidden','true'); };
    window.addEventListener('resize',syncMobileNav);syncMobileNav();
    document.addEventListener('keydown', e=>{
      if(e.key !== 'Tab' || !pv('pv3Sidebar').classList.contains('open'))return;
      const targets=[...pv('pv3Sidebar').querySelectorAll('button:not(:disabled),a[href]')].filter(x=>x.getClientRects().length);
      if(!targets.length)return;const first=targets[0],last=targets[targets.length-1];
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
    });
    pv('pv3Theme').addEventListener('click',()=>light(!pv('premiumApp').classList.contains('light')));
    pv('pv3LightToggle').addEventListener('click',()=>light(!pv('premiumApp').classList.contains('light')));
    pv('pv3AutoLock').addEventListener('change',()=>{els.sessionTimeout.value=pv('pv3AutoLock').value;handleSessionSettings();});
    pv('pv3Clipboard').addEventListener('change',()=>{els.clipboardTimeout.value=pv('pv3Clipboard').value;handleSessionSettings();});
    pv('pv3Length').addEventListener('input',()=>txt('pv3LengthText',pv('pv3Length').value));
    pv('pv3Generate').addEventListener('click',generateFull);pv('pv3QuickGenerate').addEventListener('click',generateQuick);
    pv('pv3CopyGenerated').addEventListener('click',()=>void copySecret(ui.generated));pv('pv3QuickCopy').addEventListener('click',()=>void copySecret(ui.quick));
    pv('pv3UseGenerated').addEventListener('click',()=>{if(!ui.generated)return notify('Generate a password first');openEditor(null,ui.generated);});
    pv('pv3ItemType').addEventListener('change',changeItemKind);pv('pv3ItemForm').addEventListener('submit',saveItem);
    pv('pv3AddCustom').addEventListener('click',()=>addCustom());
    pv('pv3RevealLogin').addEventListener('click',()=>{const input=pv('pv3ItemPassword');input.type=input.type==='password'?'text':'password';pv('pv3RevealLogin').textContent=input.type==='password'?'Show':'Hide';});
    pv('pv3GenerateLogin').addEventListener('click',()=>{pv('pv3ItemPassword').value=generatePassword({length:20,upper:true,lower:true,numbers:true,symbols:true});notify('Generated a strong password');});
    pv('pv3DetailCopy').addEventListener('click',()=>{const it=records().find(x=>x.id===ui.detailId);if(it)void copySecret(it.password);});
    pv('pv3DetailFavorite').addEventListener('click',()=>{if(!ui.detailId)return;const id=ui.detailId;pv('pv3DetailDialog').close();toggleFavorite(id);openDetail(id);});
    pv('pv3DetailEdit').addEventListener('click',()=>{const id=ui.detailId;pv('pv3DetailDialog').close();openEditor(id);});
    pv('pv3DetailDelete').addEventListener('click',deleteItem);
    document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&canRead()){e.preventDefault();pv('pv3Search').focus();}});
    for(const id of ['pv3ItemDialog','pv3DetailDialog'])pv(id).addEventListener('close',()=>{
      // Discard dialog-held plaintext on close; master state remains encrypted on save.
      if(id==='pv3ItemDialog'){pv('pv3ItemForm').reset();pv('pv3CustomFields').replaceChildren();}
      else pv('pv3DetailBody').replaceChildren();
    });
    window.addEventListener('popstate',()=>{ if(canRead()) navigate(currentRoute(),false); });
    generateFull(); generateQuick(); render();
  }
  // Extend—not replace—the existing vault lifecycle. No changes to ciphertext format.
  const previousRenderVault=renderVault;
  renderVault=function(...args){const result=previousRenderVault(...args);render();return result;};
  const previousSetDirty=setDirty;
  setDirty=function(...args){const result=previousSetDirty(...args);render();return result;};
  const previousActiveView=setActiveView;
  let wasUnlocked = false;
  setActiveView=function(...args){
    const result=previousActiveView(...args);
    if(ui.init){
      if(canRead()){if(!wasUnlocked){wasUnlocked=true;navigate(currentRoute(),false);}render();}
      else {wasUnlocked=false;closeMobileNav();clean();}
    }
    return result;
  };
  const previousSaveCloudVault=saveCloudVault;
  saveCloudVault=async function(...args){
    const result=await previousSaveCloudVault(...args);
    render();
    return result;
  };
  const previousDashboard=renderVaultDashboard;
  renderVaultDashboard=function(...args){const result=previousDashboard(...args);render();return result;};
  // Existing page loads asynchronously. Initialize after all DOM and scripts are parsed.
  initialize();
})();
