// Account timeout is independent from the vault's configurable auto-lock timer.
const ACCOUNT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACCOUNT_LAST_ACTIVITY_KEY = "passvault-account-last-activity";
const ACCOUNT_AUTH_STORAGE_KEY = "passvault-tab-auth";
let accountSessionActive = false;
let accountLogoutInProgress = false;
let accountLogoutScheduled = false;

// The only new UI is this small read-only countdown in the existing account headers.
// It reflects the account inactivity clock, not the separate vault auto-lock timer.
let accountCountdownDisplays = [];

function initializeAccountCountdown() {
  const headers = [
    document.querySelector('#approvedUI .topbar'),
    document.querySelector('#lockedView .lock-topbar')
  ];
  accountCountdownDisplays = headers.filter(Boolean).map((header) => {
    const badge = document.createElement('output');
    badge.className = 'pv-account-idle-timer';
    badge.hidden = true;
    badge.setAttribute('role', 'timer');
    badge.setAttribute('aria-label', 'Time until account signs out due to inactivity');
    badge.title = 'Account automatically signs out after 15 minutes of inactivity';
    const caption = document.createElement('span');
    caption.className = 'pv-account-idle-label';
    caption.textContent = 'Sign out in';
    const time = document.createElement('span');
    time.className = 'pv-account-idle-value';
    time.textContent = '15:00';
    badge.append(caption, time);
    header.insertBefore(badge, header.querySelector('#themeToggle, [data-theme-toggle]') || null);
    return { badge, time };
  });
  updateAccountCountdown();
}

function updateAccountCountdown() {
  const visible = accountSessionActive && !accountLogoutInProgress;
  const lastActivity = visible ? readAccountLastActivity() : 0;
  const remaining = visible && lastActivity
    ? Math.min(ACCOUNT_IDLE_TIMEOUT_MS, Math.max(0, ACCOUNT_IDLE_TIMEOUT_MS - (Date.now() - lastActivity)))
    : 0;
  const seconds = Math.ceil(remaining / 1000);
  const display = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  for (const { badge, time } of accountCountdownDisplays) {
    badge.hidden = !visible;
    if (visible) {
      time.textContent = display;
      badge.classList.toggle('pv-account-idle-soon', remaining <= 60_000);
    }
  }
  // The wall-clock timestamp, not interval ticks, determines expiry. Timers
  // throttled in background tabs cannot extend the 15-minute limit.
  if (visible) checkAccountSession();
}

function readAccountLastActivity() {
  const timestamp = Number(sessionStorage.getItem(ACCOUNT_LAST_ACTIVITY_KEY));
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function clearAccountLastActivity() {
  sessionStorage.removeItem(ACCOUNT_LAST_ACTIVITY_KEY);
}

function accountHasTimedOut() {
  const last = readAccountLastActivity();
  const now = Date.now();
  return !last || last > now || now - last >= ACCOUNT_IDLE_TIMEOUT_MS;
}

async function expireAccountSession() {
  if (!accountSessionActive || accountLogoutInProgress || !cloud.client) return;
  accountLogoutInProgress = true;
  accountSessionActive = false;
  clearAccountLastActivity();
  updateAccountCountdown();
  // Immediately remove decrypted data and hide account pages, even when offline.
  resetCloudUserState();
  try {
    const { error } = await cloud.client.auth.signOut({ scope: "local" });
    if (error) throw error;
    setStatus(els.accessStatus, "Signed out after 15 minutes of inactivity.", "warning");
  } catch (error) {
    // If Supabase cannot be reached, fail closed locally. A server-side revoke
    // cannot be guaranteed without a network connection.
    sessionStorage.removeItem(ACCOUNT_AUTH_STORAGE_KEY);
    window.location.reload();
  } finally {
    accountLogoutInProgress = false;
  }
}

function checkAccountSession() {
  if (accountSessionActive && !accountLogoutInProgress && accountHasTimedOut()) {
    if (!accountLogoutScheduled) {
      accountLogoutScheduled = true;
      // Supabase auth callbacks must finish before another auth API call.
      queueMicrotask(() => {
        accountLogoutScheduled = false;
        void expireAccountSession();
      });
    }
    return true;
  }
  return false;
}

function recordAccountActivity(event) {
  if (!accountSessionActive || accountLogoutInProgress) return;
  if (checkAccountSession()) {
    if (event?.cancelable) event.preventDefault();
    event?.stopImmediatePropagation?.();
    return;
  }
  sessionStorage.setItem(ACCOUNT_LAST_ACTIVITY_KEY, String(Date.now()));
  updateAccountCountdown();
}

function initializeEvents() {
  initializeAccountCountdown();
  els.accessLoginForm.addEventListener("submit", handleAccountLogin);
  window.PassVaultAuth.initialize();
  els.lockedSignOutButton.addEventListener("click", handleSignOut);
  initializeMultiVaultEvents();
  els.unlockedSignOutButton.addEventListener("click", handleSignOut);
  els.toggleAccessPassword.addEventListener("click", () => toggleFieldVisibility(els.accessPassword, els.toggleAccessPassword));
  document.querySelectorAll("[data-access-target]").forEach((button) => {
    button.addEventListener("click", () => showAccessScreen(button.dataset.accessTarget));
  });
  document.querySelectorAll("[data-page-target]").forEach((button) => {
    button.addEventListener("click", () => showAppPage(button.dataset.pageTarget));
  });
  els.createVaultForm.addEventListener("submit", handleCreateVault);
  els.newMaster.addEventListener("input", updateMasterStrength);
  els.newPepperEnabled.addEventListener("change", () => {
    const enabled = els.newPepperEnabled.checked;
    els.newPepperField.classList.toggle("hidden", !enabled);
    if (!enabled) {
      els.newPepper.value = "";
      setStatus(els.createStatus, "Secret pepper cleared because pepper protection was disabled.", "success");
    }
  });
  els.chooseVaultFile.addEventListener("click", () => els.vaultFile.click());
  els.vaultFile.addEventListener("change", handleFileChoose);
  els.unlockVaultButton.addEventListener("click", handleUnlockVault);
  els.exportVaultButton.addEventListener("click", () => { void saveCloudVault(true); });
  els.backupVaultButton.addEventListener("click", handleExportVault);
  els.lockVaultButton.addEventListener("click", () => lockVault("Manual lock"));
  els.addCredentialButton.addEventListener("click", handleNewCredential);
  els.credentialSearch.addEventListener("input", renderCredentialList);
  els.credentialForm.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      saveCredential();
      setStatus(els.credentialStatus, "Credential saved.", "success");
    } catch (error) {
      setStatus(els.credentialStatus, error instanceof Error ? error.message : "Credential save failed.", "error");
    }
  });
  els.cancelEditButton.addEventListener("click", handleCancelEdit);
  els.toggleCredentialPassword.addEventListener("click", () => toggleFieldVisibility(els.credentialPassword, els.toggleCredentialPassword));
  els.toggleGeneratedPassword.addEventListener("click", () => toggleFieldVisibility(els.generatedPassword, els.toggleGeneratedPassword));
  els.generatePasswordButton.addEventListener("click", handleGeneratePassword);
  els.copyGeneratedButton.addEventListener("click", handleCopyGenerated);
  els.sessionTimeout.addEventListener("change", handleSessionSettings);
  els.clipboardTimeout.addEventListener("change", handleSessionSettings);

  ["click", "keydown", "pointerdown", "touchstart", "wheel"].forEach((eventName) => {
    // Capture activity before the target element handles the action, so an
    // expired account cannot briefly act on an unlocked vault.
    document.addEventListener(eventName, recordAccountActivity, { capture: true });
  });
  ["click", "keydown", "pointerdown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, markActivity, { passive: true });
  });
  document.addEventListener("visibilitychange", handlePageVisibility);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) checkAccountSession(); });
  window.addEventListener("blur", handleBlur);
  window.addEventListener("focus", handleFocus);
  window.addEventListener("focus", checkAccountSession);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { if (window.pvCloseMobileNav?.()) return; handleEscape(); } });
  window.addEventListener("pagehide", handlePageExit);
  window.addEventListener("beforeunload", beforeUnload);
  setInterval(updateInactivityLock, 1000);
  setInterval(updateAccountCountdown, 1000);
  setInterval(updateAccessLockoutStatus, 250);
}

async function runStartupSelfTest() {
  if (!browserCapabilities()) {
    els.compatibilityError.classList.remove("hidden");
    els.compatibilityError.textContent = "This browser does not provide all required cryptographic primitives (Web Crypto, WebAssembly, TextEncoder/TextDecoder). Use a current Chrome, Edge, Firefox, Android Chrome, or iPhone Safari release.";
    els.createVaultButton.disabled = true;
    els.unlockVaultButton.disabled = true;
    setGlobalStatus("Required browser security primitives are unavailable.", "error");
    return false;
  }

  try {
    setGlobalStatus("Running a local Argon2id integrity self-test…", "warning");
    await runArgon2SelfTest();
    setGlobalStatus("Cryptographic self-test passed. Ready for local vault operations.", "success");
    return true;
  } catch (error) {
    els.compatibilityError.classList.remove("hidden");
    els.compatibilityError.textContent = `The embedded Argon2id self-test failed: ${error instanceof Error ? error.message : "unknown error"}. Do not use this copy of the application for sensitive data.`;
    els.createVaultButton.disabled = true;
    els.unlockVaultButton.disabled = true;
    setGlobalStatus("Cryptographic self-test failed.", "error");
    return false;
  }
}

async function initialize() {
  populateGeneratorLengths();
  initializeEvents();
  updateMasterStrength();
  setActiveView();
  state.initialized = true;
  if (!await runStartupSelfTest()) return;
  if (!isCloudConfigured()) {
    return setStatus(els.accessStatus, "Setup required: add the Supabase Project URL and publishable key in src/js/config.js.", "warning");
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    return setStatus(els.accessStatus, "Locally hosted Supabase SDK did not load. Check the GitHub Actions build and browser console.", "error");
  }
  // Remove a leftover login token from the previous localStorage-based build.
  // The new client never reads that token; existing users must sign in once.
  try {
    const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];
    localStorage.removeItem(`sb-${projectRef}-auth-token`);
  } catch { /* Storage may be unavailable in restrictive browsers. */ }
  cloud.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.sessionStorage,
      storageKey: ACCOUNT_AUTH_STORAGE_KEY
    }
  });
  cloud.client.auth.onAuthStateChange((event, session) => {
    // Recovery session must not open the vault workspace before its password is updated.
    if(event === 'PASSWORD_RECOVERY') { window.PassVaultAuth.startRecovery(); return; }
    if(window.PassVaultAuth.recoveryPending) return;
    if (accountLogoutInProgress && session) return;
    if (!session) {
      accountSessionActive = false;
      clearAccountLastActivity();
    } else {
      accountSessionActive = true;
      // SIGNED_IN also occurs on refocus: never reset an existing idle clock.
      // A genuinely new login starts with no activity timestamp.
      if (event === 'SIGNED_IN' && !readAccountLastActivity()) {
        sessionStorage.setItem(ACCOUNT_LAST_ACTIVITY_KEY, String(Date.now()));
      }
      if (checkAccountSession()) return;
    }
    updateAccountCountdown();
    queueMicrotask(() => { void loadAccountVault(session); });
  });
  const { data, error } = await cloud.client.auth.getSession();
  if (error) setStatus(els.accessStatus, error.message, "error");
  else if (!window.PassVaultAuth.recoveryPending && !accountLogoutInProgress) {
    accountSessionActive = Boolean(data.session);
    if (data.session && checkAccountSession()) return;
    if (!data.session) clearAccountLastActivity();
    updateAccountCountdown();
    await loadAccountVault(data.session);
  }
}

initialize().catch((error) => {
  els.compatibilityError.classList.remove("hidden");
  els.compatibilityError.textContent = `Initialization failed: ${error instanceof Error ? error.message : "unknown error"}.`;
  setGlobalStatus("Initialization failed.", "error");
});
