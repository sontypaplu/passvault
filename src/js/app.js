function initializeEvents() {
  els.accessLoginForm.addEventListener("submit", handleAccountLogin);
  els.registerAccountButton.addEventListener("click", handleAccountRegister);
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

  ["click", "keydown", "pointerdown", "touchstart"].forEach((eventName) => {
    document.addEventListener(eventName, markActivity, { passive: true });
  });
  document.addEventListener("visibilitychange", handlePageVisibility);
  window.addEventListener("blur", handleBlur);
  window.addEventListener("focus", handleFocus);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") handleEscape(); });
  window.addEventListener("pagehide", handlePageExit);
  window.addEventListener("beforeunload", beforeUnload);
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
  populateGeneratorLengths();
  initializeEvents();
  updateMasterStrength();
  setActiveView();
  state.initialized = true;
  if (!await runStartupSelfTest()) return;
  if (!isCloudConfigured()) {
    return setStatus(els.accessStatus, "Setup required: add the Supabase Project URL and publishable key in this HTML file.", "warning");
  }
  if (!window.supabase || typeof window.supabase.createClient !== "function") {
    return setStatus(els.accessStatus, "Supabase SDK did not load. Check CDN access and Content Security Policy.", "error");
  }
  cloud.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: true, persistSession: false, detectSessionInUrl: true }
  });
  cloud.client.auth.onAuthStateChange((event, session) => {
    // Auth callbacks are synchronous; defer any database calls to avoid deadlocks.
    queueMicrotask(() => { void loadAccountVault(session); });
  });
  const { data, error } = await cloud.client.auth.getSession();
  if (error) setStatus(els.accessStatus, error.message, "error");
  else await loadAccountVault(data.session);
}

initialize().catch((error) => {
  els.compatibilityError.classList.remove("hidden");
  els.compatibilityError.textContent = `Initialization failed: ${error instanceof Error ? error.message : "unknown error"}.`;
  setGlobalStatus("Initialization failed.", "error");
});
