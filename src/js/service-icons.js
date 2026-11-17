/* Privacy-preserving service marks. This is an entirely local, closed catalog:
 * no favicon services, DNS lookups, fetch(), telemetry, remote image URLs,
 * DOM HTML interpolation, or persistence of visited domains. The icon code
 * is shipped with the app, even when all vaults are locked.
 *
 * Marks are decorative identification aids, not proof that a URL is genuine.
 * All data comes from the item's already-decrypted URL and stays on-device.
 */
(()=>{
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const domains=Object.freeze([
    ['instagram.com','instagram'], ['kotak.bank.in','kotak'],
    ['kotak.com','kotak'], ['kotakbank.com','kotak'],
    ['kotakmahindrabank.com','kotak'], ['kotak811.com','kotak'],
    ['youtube.com','youtube'], ['youtu.be','youtube'],
    ['google.com','google'], ['google.co.in','google'], ['gmail.com','gmail'],
    ['mail.google.com','gmail'], ['accounts.google.com','google'],
    ['facebook.com','facebook'], ['fb.com','facebook'], ['messenger.com','facebook'],
    ['whatsapp.com','whatsapp'], ['web.whatsapp.com','whatsapp'],
    ['amazon.com','amazon'], ['amazon.in','amazon'], ['amazon.co.uk','amazon'],
    ['amazon.de','amazon'], ['amazon.ae','amazon'],
    ['flipkart.com','flipkart'], ['github.com','github'],
    ['linkedin.com','linkedin'], ['microsoft.com','microsoft'],
    ['outlook.com','outlook'], ['live.com','outlook'], ['office.com','microsoft'],
    ['apple.com','apple'], ['icloud.com','apple'],
    ['netflix.com','netflix'], ['paypal.com','paypal'], ['paypal.me','paypal'],
    ['x.com','x'], ['twitter.com','x'], ['reddit.com','reddit'],
    ['telegram.org','telegram'], ['t.me','telegram'],
    ['openai.com','openai'], ['chatgpt.com','openai'],
    ['hdfcbank.com','hdfc'], ['hdfc.bank.in','hdfc'],
    ['sbi.co.in','sbi'], ['onlinesbi.sbi','sbi'], ['sbi.bank.in','sbi'],
    ['icicibank.com','icici'], ['icici.bank.in','icici'],
    ['axisbank.com','axis'], ['axis.bank.in','axis']
  ]);
  const marks=Object.freeze({
    instagram:{parts:[
      ['rect',{x:4.2,y:4.2,width:15.6,height:15.6,rx:4.8,fill:'none',stroke:'#fff','stroke-width':2}],
      ['circle',{cx:12,cy:12,r:3.7,fill:'none',stroke:'#fff','stroke-width':2}],
      ['circle',{cx:17.35,cy:6.75,r:1.15,fill:'#fff'}]]},
    kotak:{parts:[
      ['ellipse',{cx:12,cy:12,rx:11.3,ry:10.2,fill:'#003974'}],
      ['path',{d:'M11.1 3.6 13.1 3V21l-2 0Z',fill:'#ed1c24'}],
      ['path',{d:'M5.8 10.4C7.7 5 11.1 6.1 13 10c2.4-4.2 5.6-3.1 6.6-.5M5.2 13.6C6.8 18.8 10.3 18 12.9 13.9c2.6 4.3 5.9 3.4 6.9-.6',fill:'none',stroke:'#fff','stroke-width':2.7,'stroke-linecap':'round'}]]},
    youtube:{parts:[['rect',{x:1.3,y:4.3,width:21.4,height:15.4,rx:5,fill:'#fff'}],['path',{d:'M10 8.1 17 12l-7 3.9Z',fill:'#ff0033'}]]},
    google:{parts:[['path',{d:'M20.4 12.1a9 9 0 0 1-.2 2.1h-8.1v-3.7h12c.1.5.1 1 .1 1.6 0 7.1-4.8 12-12.1 12A12 12 0 0 1 0 12 12 12 0 0 1 12 0c3.2 0 5.9 1.2 8 3.2l-2.9 2.9A7.5 7.5 0 0 0 12 4a8 8 0 0 0 0 16c3.7 0 5.8-1.8 6.5-4.3H12v-3.6Z',fill:'#4285f4'}],['path',{d:'M1.5 6.2 5 8.7A8 8 0 0 1 12 4c2 0 3.7.7 5.1 2.1L20 3.2A12 12 0 0 0 0 12c0-2.2.5-4.1 1.5-5.8Z',fill:'#ea4335'}],['path',{d:'M0 12c0 2.2.6 4.2 1.6 6l3.6-2.8A8 8 0 0 1 5 8.7L1.5 6.2A12 12 0 0 0 0 12Z',fill:'#fbbc05'}]]},
    gmail:{parts:[['path',{d:'M2 20V5l10 7 10-7v15',fill:'none',stroke:'#4285f4','stroke-width':3.2,'stroke-linejoin':'round'}],['path',{d:'M2 6 12 13 22 6',fill:'none',stroke:'#ea4335','stroke-width':3.2,'stroke-linejoin':'round'}]]},
    facebook:{letter:'f'},
    whatsapp:{parts:[['circle',{cx:12,cy:12,r:9.5,fill:'none',stroke:'#fff','stroke-width':2.1}],['path',{d:'m6.5 18 .9-3.2C5 10 7.5 6.6 9.1 6.9l1.9 3-1.2 1.4a9 9 0 0 0 3.3 3.2l1.3-1.3 3 1.7c.1 1.7-3.5 4-8 1.5Z',fill:'#fff'}]]},
    amazon:{letter:'a'},
    flipkart:{parts:[['path',{d:'M5 6.5h14V21H5Z',fill:'#2874f0'}],['path',{d:'M8 7V5.4c0-4 8-4 8 0V7',fill:'none',stroke:'#2874f0','stroke-width':2}],['path',{d:'M9 10h6v2H11v2h3v2h-3v3H9Z',fill:'#fff'}]]},
    github:{parts:[['path',{d:'M12 2a10 10 0 0 0-3.16 19.49c.5.1.68-.22.68-.48v-1.8c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.52 1.02 1.52 1.02.89 1.51 2.32 1.07 2.88.82.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.95 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.28.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 7.86c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.36.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.86v1.7c0 .27.18.59.69.48A10 10 0 0 0 12 2Z',fill:'#fff'}]]},
    linkedin:{letter:'in'},
    microsoft:{parts:[['rect',{x:2,y:2,width:9.4,height:9.4,fill:'#f25022'}],['rect',{x:12.6,y:2,width:9.4,height:9.4,fill:'#7fba00'}],['rect',{x:2,y:12.6,width:9.4,height:9.4,fill:'#00a4ef'}],['rect',{x:12.6,y:12.6,width:9.4,height:9.4,fill:'#ffb900'}]]},
    outlook:{letter:'O'},
    apple:{parts:[['path',{d:'M16.7 12.4c0-2.5 2-3.7 2.1-3.8-1.2-1.7-3-2-3.7-2.1-1.6-.2-3.1 1-3.9 1s-2-1-3.3-.9c-1.7 0-3.3 1-4.2 2.5-1.8 3.1-.5 7.8 1.3 10.3.9 1.2 1.9 2.5 3.2 2.5s1.8-.8 3.4-.8 2 .8 3.4.8c1.5 0 2.4-1.2 3.2-2.4a12 12 0 0 0 1.5-3 5.4 5.4 0 0 1-3-4.1Zm-2.7-8c.7-.9 1.2-2 1.1-3.1-1.1.1-2.3.8-3.1 1.7-.7.8-1.3 2-1.2 3.1 1.2.1 2.4-.6 3.2-1.7Z',fill:'#fff'}]]},
    netflix:{letter:'N'},
    paypal:{letter:'P'},
    x:{parts:[['path',{d:'M4 3h3.6L20 21h-3.7L4 3ZM20 3h-3.3L4 21h3.3L20 3Z',fill:'#fff'}]]},
    reddit:{letter:'●'},
    telegram:{parts:[['path',{d:'M2 11 21 3l-4.6 18-5.3-5.1-2.7 3-.1-6.1L18 6l-8.7 8.1Z',fill:'#fff'}]]},
    openai:{letter:'✻'},
    hdfc:{parts:[['rect',{x:2,y:2,width:20,height:20,fill:'#e31d2b'}],['rect',{x:7,y:7,width:10,height:10,fill:'#0c448e'}],['path',{d:'M7 10h10v4H7Z',fill:'#fff'}]]},
    sbi:{parts:[['circle',{cx:12,cy:12,r:10,fill:'#00a6dc'}],['path',{d:'M10.8 21v-8h2.4v8Z',fill:'#fff'}],['circle',{cx:12,cy:12,r:2.3,fill:'#fff'}]]},
    icici:{letter:'i'},
    axis:{letter:'A'}
  });
  function hostnameFrom(raw){
    if(typeof raw!=='string'||!raw.trim()||raw.length>2048)return '';
    let source=raw.trim();
    if(/[\x00-\x1f\x7f\\]/.test(source)||source.startsWith('//'))return '';
    if(!/^[a-z][a-z0-9+.-]*:\/\//i.test(source)){
      if(/^[a-z][a-z0-9+.-]*:/i.test(source)||source.startsWith('/'))return '';
      source='https://'+source;
    }
    try{
      const parsed=new URL(source);
      if(!['https:','http:'].includes(parsed.protocol)||parsed.username||parsed.password)return '';
      return parsed.hostname.toLowerCase().replace(/\.$/,'');
    }catch{return '';}
  }
  function iconKeyForURL(raw){
    const host=hostnameFrom(raw);
    if(!host)return null;
    // An attacker-controlled host such as instagram.com.evil.test must NOT
    // inherit Instagram branding. Only the exact domain or its subdomains match.
    // Exact matches have precedence over broader parent domains: for example,
    // mail.google.com must use Gmail rather than the generic Google mark.
    for(const [domain,key] of domains){if(host===domain)return key;}
    for(const [domain,key] of domains){if(host.endsWith('.'+domain))return key;}
    return null;
  }
  function mount(node,item){
    if(!node)return;
    node.replaceChildren();
    node.classList.remove('service-brand-ready');
    for(const known of Object.keys(marks))node.classList.remove('service-brand-'+known);
    const key=item?.kind==='login'||!item?.kind?iconKeyForURL(item?.url):null;
    const mark=key&&marks[key];
    if(!mark){
      // Unknown sites deliberately never cause a network lookup. Keep the
      // established initial fallback, which also works fully offline.
      node.textContent=(item?.title||'•').trim().slice(0,1).toUpperCase()||'•';
      return;
    }
    node.classList.add('service-brand-ready','service-brand-'+key);
    if(mark.letter){
      const symbol=document.createElement('span');symbol.className='service-brand-letter';
      symbol.textContent=mark.letter;symbol.setAttribute('aria-hidden','true');
      // Styling is supplied by the bundled stylesheet, not inline CSS.
      node.append(symbol);
    }else{
      const svg=document.createElementNS(NS,'svg');
      svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');
      svg.setAttribute('focusable','false');svg.classList.add('service-brand-mark');
      for(const [tag,attrs] of mark.parts){
        const child=document.createElementNS(NS,tag);
        for(const [name,value] of Object.entries(attrs))child.setAttribute(name,String(value));
        svg.append(child);
      }
      node.append(svg);
    }
    node.setAttribute('title',key==='kotak'?'Kotak Mahindra Bank':key.charAt(0).toUpperCase()+key.slice(1));
  }
  window.PassVaultServiceIcons=Object.freeze({mount,iconKeyForURL});
})();
