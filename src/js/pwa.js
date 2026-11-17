/* AVENLOCK offline-capable PWA. Cache only public static app files, never secrets, account tokens or API data. */
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
  let dismissedBuild = null;
  // The network is optional after installation; version checks never gate local access.
  let networkUnavailable = navigator.onLine === false;

  const message = (text) => { for (const id of ['pvPwaStatus','pvPwaStatusLogin','pvPwaStatusLocked']) { const target=byId(id); if (target) target.textContent=text; } };
  const setOffline = (offline, offerLocalEntry = false) => {
    networkUnavailable = offline;
    const overlay = byId('pvPwaOffline');
    if (overlay) overlay.hidden = true;
    if (offline && offerLocalEntry && !window.AvenlockLocal?.active && !cloud.userId && state.locked && !window.PassVaultAuth?.recoveryPending) {
      // Offline entry is shown immediately after the already cached app has loaded.
      void window.AvenlockLocal?.enter();
    }
  };

  const installInstructions = () => {
    if (installed()) return 'Installed. Device vaults can open offline after the app shell has been cached.';
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
    const visible = available && dismissedBuild !== latestBuild && !networkUnavailable;
    if (notice) notice.hidden = !visible;
    const dirty = typeof state !== 'undefined' && state.dirty;
    const note = byId('pvPwaNoticeText');
    if (note) note.textContent = dirty
      ? 'Update ready. Finish saving your encrypted changes before updating.'
      : 'New AVENLOCK version ready. Update when your vault is safely locked.';
    // Standard fixed notices render beneath native <dialog> top-layer elements.
    // Surface the same release status INSIDE the sign-in and vault chooser too.
    for (const [id, actionId] of [['pvPwaLoginUpdate','pvPwaLoginUpdateAction'],['pvPwaGateUpdate','pvPwaGateUpdateAction']]) {
      const item = byId(id), action = byId(actionId);
      if (item) item.hidden = !visible;
      if (action) action.textContent = dirty ? 'Back up first' : 'Update now';
    }
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
      if (!data || !releasePattern.test(data.build) || data.offlineCapable !== true) {
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
        message('Offline mode: device vaults remain available; update checks require a connection.');
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
        setOffline(false);
        lastChecked = Date.now();
        latestBuild = release.build;
        if (latestBuild === currentBuild) message('AVENLOCK is up to date.');
        else message('New version available. Your installed app checks automatically; apply the update when your vault is safely locked.');
        render();
        return true;
      } catch {
        setOffline(true, navigator.onLine === false);
        message('Update service unavailable. Existing device vaults are still accessible.');
        render();
        return false;
      } finally {
        if (checkButton) checkButton.disabled = false;
      }
    })();
    try { return await checking; } finally { checking = null; }
  }

  async function updateNow() {
    if (!latestBuild || latestBuild === currentBuild || networkUnavailable) {
      message('Check for updates while connected before continuing.');
      return false;
    }
    // Do NOT reload over unsynced edits, cloud conflicts, saves or crypto operations.
    if (window.PassVaultAuth?.recoveryPending) {
      message('Complete account recovery before updating.');
      return false;
    }
    if (window.AvenlockLocal?.active && !state.locked) {
      if (!await window.AvenlockLocal.flush()) { message('Encrypted device save is pending or failed. Export a backup before updating.'); return false; }
    }
    if (typeof state === 'undefined' || typeof cloud === 'undefined' || state.kdfInProgress ||
        state.exportInProgress || cloud.saveInProgress || cloud.conflict || state.dirty) {
      message('An update is ready, but this vault has pending changes or a save in progress. If working device-only or with sync paused, download and verify a backup, sign out, then update.');
      return false;
    }
    if (!window.confirm(state.locked
      ? 'Reload AVENLOCK with the latest version? Any unfinished form entry will be lost.'
      : 'Lock your vault and reload the latest AVENLOCK version? Save any open form edits first.')) return false;
    if (!state.locked) {
      if (window.AvenlockLocal?.active) await secureLockWithCheckpoint('Update requested.');
      else lockVault('Manual lock');
      if (!state.locked) {
        message('Vault could not be locked; update cancelled.');
        return false;
      }
    }
    // Refresh the HTML over the network rather than reusing a potentially stale entry document.
    // A new SW release must be ready before a page reload can use the new app shell.
    try { const registration=await navigator.serviceWorker?.getRegistration();await registration?.update(); } catch {}
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
  window.addEventListener('offline', () => { setOffline(true, true); render(); });
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
  byId('pvPwaLoginUpdateAction')?.addEventListener('click', updateNow);
  byId('pvPwaGateUpdateAction')?.addEventListener('click', updateNow);
  byId('pvPwaNoticeClose')?.addEventListener('click', () => { dismissedBuild = latestBuild; render(); });
  byId('pvPwaRetry')?.addEventListener('click', () => { void checkNow(); });

  // Cache a versioned, static-only application shell. The SW explicitly
  // ignores Supabase, APIs and non-GET traffic; it never sees encryption keys.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .catch(() => message('Offline installation could not be enabled in this browser. Try installing from a secure HTTPS site.'));
  }
  byId('avenlockInstallNow')?.addEventListener('click', async () => {
    await installApp();
    const status=byId('avenlockInstallStatus');
    if(status)status.textContent=installInstructions();
  });
  window.PassVaultPWA = Object.freeze({ checkNow, updateNow, installApp });
  setOffline(networkUnavailable, networkUnavailable);
  render();
  if (isDeployment && navigator.onLine !== false) void checkNow();
})();
