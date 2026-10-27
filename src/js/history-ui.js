/* Encrypted item edit history viewer. Does not store secrets or history outside
 * the existing unlocked AES-GCM vault; DOM nodes are erased on close / lock.
 */
(()=>{
  'use strict';
  const byId = id => document.getElementById(id);
  const dialog = byId('pvHistoryDialog');
  const details = byId('pvHistoryDetails');
  const list = byId('pvHistoryList');
  let activeItemId = null;
  const label = {
    kind:'Item type', title:'Name', url:'Website', username:'Username / cardholder',
    password:'Password / secret', notes:'Notes', favorite:'Favorite', tags:'Tags',
    customFields:'Custom fields', expiry:'Expiry', cvv:'Security code'
  };
  const sensitive = new Set(['password','notes','username','cvv','customFields']);
  const readable = () => !state.locked && !!state.vault && !!uiState.accessGranted;
  const log = () => readable() && Array.isArray(state.vault.editHistory) ? state.vault.editHistory : [];
  const eventById = id => log().find(record => record.id === id);
  const row = (tag,cls,content) => {
    const node = document.createElement(tag);
    if(cls) node.className = cls;
    if(content!==undefined) node.textContent = String(content);
    return node;
  };
  const time = iso => {
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) ? date.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'medium'}) : 'Unknown date';
  };
  const action = kind => kind==='created'?'Created':kind==='deleted'?'Deleted':'Edited';
  const changes = record => record.fields.map(key => label[key] || key).join(', ');
  const value = x => {
    if(x === undefined || x === null || x === '') return '—';
    if(typeof x==='boolean') return x?'Yes':'No';
    if(Array.isArray(x))return x.length ? x.map(v => typeof v==='string'?v:`${v.label}: ${v.value}`).join('; ') : '—';
    return String(x);
  };
  function clear(){
    activeItemId = null;
    if(dialog.open)dialog.close();
    details.replaceChildren();
    list.replaceChildren();
    byId('pvHistoryTitle').textContent = 'Item history';
    byId('pvHistorySubtitle').textContent = 'Previous encrypted versions';
    byId('pvHistorySummary').textContent = 'Unlock a vault to see its history';
  }
  function refresh(){
    if(!readable()){clear();return;}
    const events = log();
    const groups = new Map();
    for(const item of state.vault.credentials)groups.set(item.id,{id:item.id,title:item.title,deleted:false,events:[]});
    for(const event of events){
      if(!groups.has(event.itemId))groups.set(event.itemId,{id:event.itemId,title:event.title,deleted:true,events:[]});
      groups.get(event.itemId).events.push(event);
    }
    list.replaceChildren();
    const edits = events.filter(x=>x.action==='edited').length;
    byId('pvHistorySummary').textContent = `${edits} edit${edits===1?'':'s'} across ${groups.size} item${groups.size===1?'':'s'}`;
    if(!groups.size){list.append(row('p','pv-history-empty','No items or edits yet.'));return;}
    const ordered = [...groups.values()].sort((a,b)=>(b.events.at(-1)?.at||'').localeCompare(a.events.at(-1)?.at||''));
    for(const item of ordered){
      const count = item.events.filter(x=>x.action==='edited').length;
      const button = row('button','pv-history-item');button.type='button';
      const main=row('span','pv-history-item-main');
      main.append(row('strong','',item.title || 'Untitled item'),row('small','',`${count} edit${count===1?'':'s'} · ${item.events.length} recorded event${item.events.length===1?'':'s'}${item.deleted?' · Deleted':''}`));
      button.append(main,row('span','pv-history-chevron','View'));
      button.addEventListener('click',()=>open(item.id));
      list.append(button);
    }
  }
  function open(itemId){
    if(!readable())return;
    const entries = log().filter(event => event.itemId===itemId).reverse();
    const live = state.vault.credentials.find(item=>item.id===itemId);
    activeItemId=itemId;
    byId('pvHistoryTitle').textContent=live?.title || entries[0]?.title || 'Item history';
    byId('pvHistorySubtitle').textContent=`${entries.filter(e=>e.action==='edited').length} edits · ${entries.length} recorded events · ${state.vault.name}`;
    details.replaceChildren();
    if(!entries.length)details.append(row('p','pv-history-empty','No edits have been recorded for this item yet. Older edits from before this feature cannot be reconstructed.'));
    for(const event of entries){
      const section=row('section','pv-history-event');
      const header=row('div','pv-history-event-head');
      header.append(row('strong','',action(event.action)),row('time','',time(event.at)));
      section.append(header,row('p','pv-history-changed',`Changed: ${changes(event)}`));
      for(const field of event.fields){
        const changed=row('div','pv-history-field');
        changed.append(row('strong','',label[field]||field));
        const pair=row('div','pv-history-pair');
        for(const side of ['before','after']){
          const cell=row('div','pv-history-value');
          cell.append(row('small','',side==='before'?'Before':'After'));
          const present=event[side] && event[side][field]!==undefined && event[side][field]!==null && event[side][field]!=='';
          const text=row('span','pv-history-value-text',sensitive.has(field) && present?'••••••••':value(event[side]?.[field]));
          cell.append(text);
          if(sensitive.has(field) && present){
            const button=row('button','pv-history-reveal','Reveal');button.type='button';
            button.setAttribute('aria-label',`Reveal ${side} ${label[field]||field}`);
            // Resolve from the currently unlocked vault on every interaction.
            // Never close over a plaintext password from the snapshot.
            button.addEventListener('click',()=>{
              if(!readable()||activeItemId!==itemId){clear();return;}
              const current=eventById(event.id);
              if(!current)return;
              const shown=button.textContent==='Hide';
              text.textContent=shown?'••••••••':value(current[side]?.[field]);
              button.textContent=shown?'Reveal':'Hide';
            });
            cell.append(button);
          }
          pair.append(cell);
        }
        changed.append(pair);section.append(changed);
      }
      details.append(section);
    }
    if(!dialog.open)dialog.showModal();
  }
  byId('pvHistoryClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{activeItemId=null;details.replaceChildren();});
  window.PassVaultHistoryUI={refresh,clear};
})();
