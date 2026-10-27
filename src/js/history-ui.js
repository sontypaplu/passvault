/* Encrypted history UI. All versions remain inside the existing encrypted
 * vault. Only requested secrets are inserted into the DOM while unlocked.
 * Closing or locking clears the entire history viewer.
 */
(()=>{
  'use strict';
  const byId = id => document.getElementById(id);
  const dialog = byId('pvHistoryDialog');
  const details = byId('pvHistoryDetails');
  const categories = byId('pvHistoryList');
  const back = byId('pvHistoryBack');
  const kinds = [
    {id:'login', name:'Passwords', singular:'Password', description:'Login and password changes'},
    {id:'note', name:'Secure notes', singular:'Secure note', description:'Private note changes'},
    {id:'card', name:'Cards', singular:'Card', description:'Payment card changes'}
  ];
  // All persisted history fields. Do not silently omit optional fields,
  // including card details, custom fields, and changes between item types.
  const fields = [
    ['title','Item name'],['kind','Type'],['username','Username / cardholder'],
    ['password','Password / content / card number'],['url','Website'],
    ['notes','Additional notes'],['expiry','Expiry'],['cvv','Security code'],
    ['favorite','Favorite'],['tags','Tags'],['customFields','Custom fields']
  ];
  const secrets = new Set(['username','password','notes','cvv','customFields']);
  const BATCH = 25;
  let activeKind = null;
  let activeItemId = null;
  let revealed = new Set();
  const readable = () => !state.locked && !!state.vault && !!uiState.accessGranted;
  const log = () => readable() && Array.isArray(state.vault.editHistory) ? state.vault.editHistory : [];
  const element = (tag, css='', text) => {
    const node = document.createElement(tag);
    if(css)node.className=css;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const countText = (count, single, plural) => `${count} ${count===1?single:plural}`;
  const kindOf = item => kinds.some(k=>k.id===item?.kind)?item.kind:'login';
  const stamp = iso => {
    const d = new Date(iso);
    if(!Number.isFinite(d.getTime()))return 'Unknown time';
    // Explicit format, local clock; no invented timestamp for older baselines.
    return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB',{hour12:false})}`;
  };
  const value = raw => {
    if(raw===undefined || raw===null || raw==='')return '—';
    if(typeof raw==='boolean')return raw?'Yes':'No';
    if(Array.isArray(raw))return raw.length?raw.map(v=>typeof v==='string'?v:`${v.label}: ${v.value}`).join('; '):'—';
    return String(raw);
  };
  const eventsFor = id => log().filter(e=>e.itemId===id).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const lookup = id => log().find(e=>e.id===id);
  const matchingItems = kind => readable()?state.vault.credentials.filter(i=>kindOf(i)===kind):[];
  const getLast = events => events.reduce((best,e)=>!best||Date.parse(e.at)>Date.parse(best.at)?e:best,null);
  function setHeading(title, subtitle) {
    byId('pvHistoryTitle').textContent=title;
    byId('pvHistorySubtitle').textContent=subtitle;
  }
  function emptyMessage(message) { details.replaceChildren(element('p','pv-history-empty',message)); }
  function resetViewer() {
    activeKind=null; activeItemId=null; revealed.clear();
    details.replaceChildren(); back.hidden=true;
  }
  function clear() {
    if(dialog.open)dialog.close();
    resetViewer(); categories.replaceChildren();
    byId('pvHistorySummary').textContent='0 edits';
    byId('pvHistoryLastEdit').textContent='No edits yet';
    byId('pvHistoryLastType').textContent='No changes recorded';
    setHeading('Edit history','Encrypted versions of saved items');
  }
  function refresh() {
    if(!readable()){clear();return;}
    const records = log();
    const edits = records.filter(e=>e.action==='edited');
    const last = getLast(edits);
    byId('pvHistorySummary').textContent=countText(edits.length,'edit','edits');
    byId('pvHistoryLastEdit').textContent=last?stamp(last.at):'No edits yet';
    const latestItem=last&&state.vault.credentials.find(i=>i.id===last.itemId);
    byId('pvHistoryLastType').textContent=last?(kinds.find(k=>k.id===kindOf(latestItem||last.after||last.before))?.singular||'Item'):'No changes recorded';
    categories.replaceChildren();
    for(const category of kinds){
      const items = matchingItems(category.id);
      const itemIds = new Set(items.map(i=>i.id));
      const editCount = edits.filter(e=>itemIds.has(e.itemId)).length;
      const button=element('button','pv-history-category');button.type='button';
      button.setAttribute('aria-label',`Browse ${category.name} history`);
      const icon=element('span','pv-history-category-icon',category.id==='login'?'⌁':category.id==='note'?'▤':'▭');
      icon.setAttribute('aria-hidden','true');
      const main=element('span','pv-history-category-info');
      main.append(element('strong','',category.name),element('small','',`${countText(items.length,'item','items')} · ${countText(editCount,'edit','edits')}`));
      button.append(icon,main,element('span','pv-history-chevron','View ›'));
      button.addEventListener('click',()=>showCategory(category.id));
      categories.append(button);
    }
  }
  function showCategory(kind) {
    if(!readable())return clear();
    const category=kinds.find(k=>k.id===kind);if(!category)return;
    resetViewer(); activeKind=kind;
    setHeading(category.name,`Edit history · ${state.vault.name}`);
    const items=matchingItems(kind);
    back.hidden=true;
    if(!items.length){emptyMessage(`No ${category.name.toLowerCase()} in this vault.`);}
    else {
      const list=element('div','pv-history-modal-list');
      const ordered=[...items].sort((a,b)=>{
        const lastA=getLast(eventsFor(a.id));const lastB=getLast(eventsFor(b.id));
        return (lastB?.at||'').localeCompare(lastA?.at||'') || a.title.localeCompare(b.title);
      });
      for(const item of ordered) {
        const events=eventsFor(item.id), editCount=events.filter(e=>e.action==='edited').length;
        const last=getLast(events);
        const button=element('button','pv-history-item');button.type='button';
        const info=element('span','pv-history-item-main');
        info.append(element('strong','',item.title||'Untitled item'),element('small','',`${countText(editCount,'edit','edits')} · ${last?`Last change ${stamp(last.at)}`:'No recorded changes'}`));
        button.append(info,element('span','pv-history-chevron','View ›'));
        button.addEventListener('click',()=>showItem(item.id));
        list.append(button);
      }
      details.replaceChildren(list);
    }
    if(!dialog.open)dialog.showModal();
  }
  function showItem(itemId) {
    if(!readable())return clear();
    const item=matchingItems(activeKind).find(i=>i.id===itemId);
    if(!item)return;
    activeItemId=itemId;revealed.clear();back.hidden=false;
    const events=eventsFor(itemId);
    setHeading(item.title||'Untitled item',`${countText(events.filter(e=>e.action==='edited').length,'edit','edits')} · Newest changes first · ${state.vault.name}`);
    if(!events.length){emptyMessage('No saved changes for this item yet. History began when this feature was enabled.');return;}
    // No changes older than the first saved event can be reconstructed.
    // A pre-existing item receives one honest "Earlier state" baseline using
    // the earliest recorded BEFORE snapshot (its exact prior time is unknown).
    const display=events.map(e=>({recordId:e.id,side:'after',action:e.action,at:e.at,fields:e.fields}));
    const first=events[0];
    if(first.action!=='created' && first.before){
      display.unshift({recordId:first.id,side:'before',action:'baseline',at:null,fields:fields.map(([key])=>key)});
    }
    display.reverse();
    const wrapper=element('div','pv-history-table-scroll');wrapper.tabIndex=0;
    wrapper.setAttribute('aria-label','Scrollable item history table, newest changes first');
    const table=element('table','pv-history-table');
    const caption=element('caption','pv-history-table-caption','Saved changes. A dash means that field was not changed in that row.');
    const thead=element('thead');const head=element('tr');
    head.append(element('th','','Date / time'),element('th','','Event'));
    for(const [,label] of fields)head.append(element('th','',label));
    thead.append(head);const tbody=element('tbody');
    table.append(caption,thead,tbody);wrapper.append(table);
    const hint=element('p','pv-history-table-hint','— = unchanged · (cleared) = value removed · baseline = oldest known values. Sensitive values are masked until revealed. Scroll sideways for every field.');
    const footer=element('div','pv-history-table-footer');
    details.replaceChildren(hint,wrapper,footer);
    let offset=0;
    function more() {
      if(!readable()||activeItemId!==itemId)return clear();
      const batch=display.slice(offset,offset+BATCH);offset+=batch.length;
      for(const entry of batch) {
        const tr=element('tr');tr.append(element('td','pv-history-time',entry.at?stamp(entry.at):'Earlier state'));
        tr.append(element('td','pv-history-event-type',entry.action==='created'?'Created':entry.action==='baseline'?'Baseline':entry.action==='deleted'?'Deleted':'Edited'));
        const event=lookup(entry.recordId);
        for(const [field,label] of fields) {
          const td=element('td','pv-history-cell');
          const changed=entry.fields.includes(field);
          const raw=event?.[entry.side]?.[field];
          if(!changed || entry.action==='deleted')td.textContent='—';
          else if(raw===null || raw===undefined || raw==='' || Array.isArray(raw)&&raw.length===0){td.textContent=entry.action==='created'||entry.action==='baseline'?'—':'(cleared)';}
          else if(secrets.has(field)){
            const masked=element('span','pv-history-mask','••••••••');
            const reveal=element('button','pv-history-reveal','Reveal');reveal.type='button';
            reveal.setAttribute('aria-label',`Reveal ${label} for ${entry.at?stamp(entry.at):'baseline'}`);
            const key=`${entry.recordId}:${entry.side}:${field}`;
            reveal.addEventListener('click',()=>{
              if(!readable()||activeItemId!==itemId){clear();return;}
              const live=lookup(entry.recordId);
              if(!live)return clear();
              if(revealed.has(key)){revealed.delete(key);masked.textContent='••••••••';reveal.textContent='Reveal';}
              else {revealed.add(key);masked.textContent=value(live[entry.side]?.[field]);reveal.textContent='Hide';}
            });
            td.append(masked,reveal);
          } else td.textContent=value(raw);
          tr.append(td);
        }
        tbody.append(tr);
      }
      footer.replaceChildren();
      if(offset<display.length){
        const button=element('button','pv-history-more',`Load older changes (${display.length-offset} remaining)`);
        button.type='button';button.addEventListener('click',more);footer.append(button);
      }
    }
    more();
  }
  back.addEventListener('click',()=>{if(activeKind)showCategory(activeKind);});
  byId('pvHistoryClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',resetViewer);
  window.PassVaultHistoryUI={refresh,clear};
})();
