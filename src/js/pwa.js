/* Installable, ONLINE-ONLY PassVault. No service worker, CacheStorage, or offline vault copies. */
(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const releaseUrl = new URL('./app-version.json', document.baseURI);
  const currentBuild = document.querySelector('meta[name="passvault-build"]')?.content ?? 'development';
  const releasePattern = /^[a-f0-9]{16}$/;
  const isDeployment = releasePattern.test(currentBuild);
  const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent || '');
  let installPrompt = null;
  let latestBuild = null;
  let lastChecked = 0;
  let checking = null;
  let connectionLocked = Promise.resolve();
  let dismissedBuild = null;
  // Hold the visible app behind a connection gate until the deployed release responds.
  let networkUnavailable = navigator.onLine === false || isDeployment;

  const message = (text) => { for (const id of ['pvPwaStatus','pvPwaStatusLogin','pvPwaStatusLocked']) { const target=byId(id); if (target) target.textContent=text; } };
  const setOffline = (offline) => {
    networkUnavailable = offline;
    const localSession = typeof cloud !== 'undefined' && cloud.userId && (!cloud.syncEnabled || cloud.deviceOnly) && typeof state !== 'undefined' && !state.locked;
    if (offline) {
      const heading = byId('pvPwaOfflineTitle');
      const detail = byId('pvPwaOfflineDescription');
      if (heading) heading.textContent = navigator.onLine === false ? 'Connection required' : 'Unable to verify connection';
      if (detail) detail.textContent = 'PassVault is online only. Connect to the internet, then retry.';
    }
    const overlay = byId('pvPwaOffline');
    if (overlay) overlay.hidden = !offline || !!localSession;
    // Hide the entire decrypted workspace synchronously on connection loss.
    if (offline && !localSession && typeof state !== 'undefined' && !state.locked) {
      try { connectionLocked = Promise.resolve(secureLockWithCheckpoint('Connection lost. Vault locked.')); }
      catch { connectionLocked = Promise.resolve(); }
    }
  };

  const installInstructions = () => {
    if (installed()) return 'Installed on this device. Open PassVault from your home screen or apps.';
    if (ios) return 'iPhone/iPad: open the Share menu and choose Add to Home Screen.';
    return 'Choose Install app from your browser menu or address bar.';
  };

  const render = () => {
    const help = byId('pvPwaInstallHelp');
    if (help) help.textContent = installInstructions();
    for(const id of ['pvPwaInstallHelpLogin','pvPwaInstallHelpLocked']) { const target=byId(id);if(target)target.textContent=installInstructions(); }
    for (const id of ['pvPwaInstall','pvPwaInstallLogin','pvPwaInstallLocked']) {
      const install=byId(id); if (!install) continue;
      install.hidden=installed();
      install.textContent=installPrompt?'Install app':'How to install';
    }
    const version = byId('pvPwaVersion');
    if (version) version.textContent = isDeployment ? `Build ${currentBuild.slice(0, 8)}` : 'Development preview';
    const available = isDeployment && latestBuild !== null && latestBuild !== currentBuild;
    const apply = byId('pvPwaApply');
    if (apply) {
      apply.hidden = !available;
      apply.textContent = typeof state !== 'undefined' && !state.locked ? 'Lock & update' : 'Update now';
    }
    const notice = byId('pvPwaUpdateNotice');
    if (notice) notice.hidden = !available || dismissedBuild === latestBuild || networkUnavailable;
  };

  async function fetchRelease() {
    // The static release marker is public. Never send auth tokens or decrypted vault data.
    const url = new URL(releaseUrl);
    url.searchParams.set('check', String(Date.now()));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const result = await fetch(url.href, {
        method: 'GET', mode: 'same-origin', credentials: 'omit', cache: 'no-store',
        redirect: 'error', signal: controller.signal
      });
      if (!result.ok) throw new Error('Version endpoint unavailable');
      const data = await result.json();
      if (!data || !releasePattern.test(data.build) || data.onlineOnly !== true) {
        throw new Error('Invalid release marker');
      }
      return data;
    } finally { clearTimeout(timeout); }
  }

  async function checkNow() {
    if (checking) return checking;
    checking = (async () => {
      if (navigator.onLine === false) {
        setOffline(true);
        message('Offline — connect to the internet before using PassVault.');
        return false;
      }
      if (!isDeployment) {
        // Source previews are not installable releases. Never compare against a live deployment.
        message('Update checks are available in a deployed build.');
        return false;
      }
      const checkButton = byId('pvPwaCheck');
      if (checkButton) checkButton.disabled = true;
      try {
        const release = await fetchRelease();
        await connectionLocked;
        setOffline(false);
        lastChecked = Date.now();
        latestBuild = release.build;
        if (latestBuild === currentBuild) message('PassVault is up to date.');
        else message('Update available. Save changes before locking and updating.');
        render();
        return true;
      } catch {
        setOffline(true);
        message('Cannot reach PassVault updates. Connect to the internet and retry.');
        render();
        return false;
      } finally {
        if (checkButton) checkButton.disabled = false;
      }
    })();
    try { return await checking; } finally { checking = null; }
  }

  function updateNow() {
    if (!latestBuild || latestBuild === currentBuild || networkUnavailable) {
      message('Check for updates while connected before continuing.');
      return false;
    }
    // Do NOT reload over unsynced edits, cloud conflicts, saves or crypto operations.
    if (window.PassVaultAuth?.recoveryPending) {
      message('Complete account recovery before updating.');
      return false;
    }
    if (typeof state === 'undefined' || typeof cloud === 'undefined' || state.kdfInProgress ||
        state.exportInProgress || cloud.saveInProgress || cloud.conflict || state.dirty) {
      message('Save or export pending changes and resolve sync conflicts before updating.');
      return false;
    }
    if (!window.confirm(state.locked
      ? 'Reload PassVault with the latest version? Any unfinished form entry will be lost.'
      : 'Lock your vault and reload the latest PassVault version? Save any open form edits first.')) return false;
    if (!state.locked) {
      lockVault('Manual lock');
      if (!state.locked) {
        message('Vault could not be locked; update cancelled.');
        return false;
      }
    }
    // Refresh the HTML over the network rather than reusing a potentially stale entry document.
    const fresh = new URL('./', document.baseURI);
    fresh.searchParams.set('pv_app', latestBuild);
    location.replace(fresh.href);
    return true;
  }

  async function installApp() {
    if (installed()) return;
    if (!installPrompt) {
      message(installInstructions());
      render();
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    try { await prompt.prompt(); await prompt.userChoice; }
    catch { message(installInstructions()); }
    render();
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    installPrompt = event;
    render();
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; render(); });
  window.addEventListener('offline', () => { setOffline(true); render(); });
  window.addEventListener('passvault-sync-change', () => { setOffline(networkUnavailable); render(); });
  window.addEventListener('online', () => { void checkNow(); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() - lastChecked > 300000) void checkNow();
  });
  window.addEventListener('focus', () => {
    if (Date.now() - lastChecked > 300000) void checkNow();
  });
  for (const id of ['pvPwaInstall','pvPwaInstallLogin','pvPwaInstallLocked'])
    byId(id)?.addEventListener('click', () => { void installApp(); });
  byId('pvPwaCheck')?.addEventListener('click', () => { void checkNow(); });
  byId('pvPwaApply')?.addEventListener('click', updateNow);
  byId('pvPwaNoticeAction')?.addEventListener('click', updateNow);
  byId('pvPwaNoticeClose')?.addEventListener('click', () => { dismissedBuild = latestBuild; render(); });
  byId('pvPwaRetry')?.addEventListener('click', () => { void checkNow(); });

  // No service worker is registered or modified by this feature.
  window.PassVaultPWA = Object.freeze({ checkNow, updateNow });
  setOffline(networkUnavailable);
  if (isDeployment && navigator.onLine !== false) {
    const heading = byId('pvPwaOfflineTitle');
    const detail = byId('pvPwaOfflineDescription');
    if (heading) heading.textContent = 'Checking connection';
    if (detail) detail.textContent = 'Confirming the latest secure PassVault release…';
  }
  render();
  if (isDeployment) void checkNow();
})();
