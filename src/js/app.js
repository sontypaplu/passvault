function initializeEvents() {
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
  // A real form lets Enter in the master-password or pepper field unlock the vault.
  // Clicking Unlock uses the same submit path, avoiding duplicate attempts.
  document.getElementById("unlockVaultForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!els.unlockVaultButton.disabled) void handleUnlockVault();
  });
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

  ["click", "keydown", "pointerdown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, markActivity, { passive: true });
  });
  document.addEventListener("visibilitychange", handlePageVisibility);
  window.addEventListener("blur", handleBlur);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { if (window.pvCloseMobileNav?.()) return; handleEscape(); } });
  window.addEventListener("pagehide", handlePageExit);
  window.addEventListener("beforeunload", beforeUnload);
  setInterval(updateAccountInactivity, 1000);
  setInterval(updateInactivityLock, 1000);
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
  // GitHub Pages cannot set an HTTP frame-ancestors policy. This JS guard is
  // defense in depth; hosting-level frame restrictions remain recommended.
  if (window.self !== window.top) {
    document.body.replaceChildren(document.createTextNode('PassVault cannot run inside another website. Open it in a direct browser tab.'));
    return;
  }
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
  // Tab-scoped storage avoids keeping login credentials in localStorage indefinitely.
  // A closed tab normally loses its local session; closing cannot guarantee server
  // revocation. Browser "restore closed tab" may also restore sessionStorage.
  const authStorage = (() => {
    try { const check = '__pv_storage_test__'; sessionStorage.setItem(check,'1');sessionStorage.removeItem(check);return sessionStorage; }
    catch { const memory=new Map();return {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}; }
  })();
  // Enforce the same idle deadline if the page is refreshed or the browser
  // restores a tab. This is browser-side protection, not Supabase's paid server
  // enforcement option.
  try {
    const last=Number(authStorage.getItem('passvault-account-last-active'));
    if(Number.isFinite(last)&&last>0){
      const project=new URL(SUPABASE_URL).hostname.split('.')[0];
      if(Date.now()-last>=ACCOUNT_IDLE_LIMIT_MS || last>Date.now()){
        authStorage.removeItem('sb-'+project+'-auth-token');
        authStorage.removeItem('passvault-account-last-active');
      }else state.lastActivity=last;
    }
  }catch{}
  // Do not inherit an old indefinite localStorage session from earlier releases.
  try { const project=new URL(SUPABASE_URL).hostname.split('.')[0];localStorage.removeItem('sb-'+project+'-auth-token'); } catch {}
  cloud.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: true, persistSession: true, storage: authStorage, detectSessionInUrl: true }
  });
  cloud.client.auth.onAuthStateChange((event, session) => {
    // Recovery session must not open the vault workspace before its password is updated.
    if(event === 'PASSWORD_RECOVERY') { window.PassVaultAuth.startRecovery(); return; }
    if(window.PassVaultAuth.recoveryPending) return;
    queueMicrotask(() => { void loadAccountVault(session); });
  });
  const { data, error } = await cloud.client.auth.getSession();
  if (error) setStatus(els.accessStatus, error.message, "error");
  else if (!window.PassVaultAuth.recoveryPending) await loadAccountVault(data.session);
}

initialize().catch((error) => {
  els.compatibilityError.classList.remove("hidden");
  els.compatibilityError.textContent = `Initialization failed: ${error instanceof Error ? error.message : "unknown error"}.`;
  setGlobalStatus("Initialization failed.", "error");
});
