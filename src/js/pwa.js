/* Ciphora installable/offline app shell; encrypted device vaults live separately
 * in IndexedDB. No plaintext, credentials, or API response is cached here. */
(() => {
  'use strict';
  const byId = id => document.getElementById(id);
  const currentBuild = document.querySelector('meta[name="passvault-build"]')?.content ?? 'development';
  const deployed = /^[a-f0-9]{16}$/.test(currentBuild);
  const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent || '');
  let installPrompt=null, latestBuild=null, lastChecked=0, checking=null, offline=navigator.onLine===false;
  let dismissedBuild=null, registration=null;
  const message = text => {for(const id of ['pvPwaStatus','pvPwaStatusLogin','pvPwaStatusLocked']) {const n=byId(id);if(n)n.textContent=text;}};
  const guide = () => installed() ? 'Installed on this device. On-device vaults work without internet after the first successful load.'
    : ios ? 'iPhone/iPad: open Share, then Add to Home Screen. First open while online to prepare offline files.'
    : 'Use your browser Install app action. First open while online to prepare offline files.';
  function render(){
    for(const id of ['pvPwaInstallHelp','pvPwaInstallHelpLogin','pvPwaInstallHelpLocked']) {const n=byId(id);if(n)n.textContent=guide();}
    for(const id of ['pvPwaInstall','pvPwaInstallLogin','pvPwaInstallLocked']) {const n=byId(id);if(!n)continue;n.hidden=installed();n.textContent=installPrompt?'Install app':'Install guide';}
    const v=byId('pvPwaVersion');if(v)v.textContent=deployed?`Build ${currentBuild.slice(0,8)}`:'Development preview';
    const available=deployed && latestBuild && latestBuild!==currentBuild;
    for(const id of ['pvPwaApply']){const n=byId(id);if(n){n.hidden=!available;n.textContent=state?.locked?'Update now':'Lock & update';}}
    const show=Boolean(available && dismissedBuild!==latestBuild);
    for(const id of ['pvPwaUpdateNotice','pvPwaLoginUpdate','pvPwaGateUpdate']){const n=byId(id);if(n)n.hidden=!show;}
    const note=byId('pvPwaNoticeText');if(note)note.textContent=state?.dirty?'Update ready. Verify an encrypted backup before updating.':'New Ciphora version available. Apply it after locking your vault.';
    for(const id of ['pvPwaLoginUpdateAction','pvPwaGateUpdateAction']) {const n=byId(id);if(n)n.textContent=state?.dirty?'Back up first':'Update now';}
    const overlay=byId('pvPwaOffline');if(overlay)overlay.hidden=true;
    if(offline)message('Offline mode · On-device vaults are available. Cloud sign-in and sync need internet.');
  }
  async function registerShell(){
    if (!deployed || !('serviceWorker' in navigator))return;
    try{
      registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
      await navigator.serviceWorker.ready;
      // The first installation has to finish caching the shell before offline use.
      if(!offline)message('Offline app files prepared. You can open on-device vaults without internet.');
    }catch {message('Offline files could not be prepared. Reconnect and reload to retry installation.');}
  }
  async function checkNow(){
    if(checking)return checking;
    checking=(async()=>{
      if(navigator.onLine===false){offline=true;render();return false;}
      if(!deployed){message('Update checks are available after deployment.');return false;}
      const check=byId('pvPwaCheck');if(check)check.disabled=true;
      try {
        const controller=new AbortController();
        const timer=setTimeout(()=>controller.abort(),8000);
        let result;
        try {result=await fetch(new URL('./app-version.json?check='+Date.now(),document.baseURI).href,
          {credentials:'omit',cache:'no-store',redirect:'error',signal:controller.signal});}
        finally {clearTimeout(timer);}
        if(!result.ok)throw Error('Updates unavailable');
        const data=await result.json();
        if(!/^[a-f0-9]{16}$/.test(data.build) || data.offlineCapable!==true)throw Error('Invalid release');
        latestBuild=data.build;lastChecked=Date.now();offline=false;
        message(latestBuild===currentBuild?'Ciphora is up to date.':'An update is available. Back up and apply when your vault is locked.');
        render();return true;
      }catch {offline=true;message('Update check unavailable. On-device vaults still work; cloud features need internet.');render();return false;}
      finally {if(check)check.disabled=false;}
    })();
    try{return await checking;}finally{checking=null;}
  }
  async function updateNow(){
    if(!latestBuild || latestBuild===currentBuild || navigator.onLine===false){message('Connect to the internet to apply updates.');return false;}
    if(window.PassVaultAuth?.recoveryPending || state.kdfInProgress || state.exportInProgress || cloud.saveInProgress || cloud.conflict || state.dirty){message('Complete current operations and verify an encrypted backup before updating.');return false;}
    if(!window.confirm(state.locked?'Reload and apply the available update?':'Lock the vault and reload to update?'))return false;
    if(!state.locked){await secureLockWithCheckpoint('Vault locked for update.');if(!state.locked)return false;}
    try {
      if(registration){await registration.update();if(registration.waiting)registration.waiting.postMessage({type:'CIPHORA_ACTIVATE'});}
    }catch{}
    const next=new URL('./',document.baseURI);next.searchParams.set('ciphora_build',latestBuild);
    location.replace(next.href);return true;
  }
  async function installApp(){
    if(installed())return;
    if(!installPrompt){message(guide());return;}
    const prompt=installPrompt;installPrompt=null;
    try{await prompt.prompt();await prompt.userChoice;}catch{message(guide());}
    render();
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;render();});
  window.addEventListener('appinstalled',()=>{installPrompt=null;render();});
  window.addEventListener('offline',()=>{offline=true;render();});
  window.addEventListener('online',()=>{offline=false;void checkNow();render();});
  window.addEventListener('focus',()=>{if(Date.now()-lastChecked>300000 && !offline)void checkNow();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && Date.now()-lastChecked>300000 && !offline)void checkNow();});
  for(const id of ['pvPwaInstall','pvPwaInstallLogin','pvPwaInstallLocked'])byId(id)?.addEventListener('click',()=>{void installApp();});
  for(const id of ['pvPwaApply','pvPwaNoticeAction','pvPwaLoginUpdateAction','pvPwaGateUpdateAction'])byId(id)?.addEventListener('click',()=>{void updateNow();});
  byId('pvPwaCheck')?.addEventListener('click',()=>{void checkNow();});
  byId('pvPwaRetry')?.addEventListener('click',()=>{void checkNow();});
  byId('pvPwaNoticeClose')?.addEventListener('click',()=>{dismissedBuild=latestBuild;render();});
  window.CiphoraPWA=Object.freeze({checkNow,updateNow,registerShell});
  render();void registerShell();if(deployed && !offline)void checkNow();
})();
