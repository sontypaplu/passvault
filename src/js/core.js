"use strict";

/*
 * PASS VAULT SECURITY ARCHITECTURE
 * ---------------------------------
 * 1. New vaults receive a unique 32-byte random salt.
 * 2. A user-supplied master password plus optional non-persistent secret pepper
 *    is processed by an embedded Argon2id v1.3 WebAssembly implementation.
 * 3. Argon2id returns 32 bytes. Those bytes are immediately imported into
 *    Web Crypto as a non-extractable AES-256-GCM CryptoKey.
 * 4. The complete vault is encrypted as one authenticated payload during export.
 *    Every export receives a fresh 96-bit random AES-GCM nonce.
 * 5. No vault, master password, pepper, plaintext credential, or encryption key
 *    is written to browser storage. The user must explicitly export the
 *    encrypted vault file.
 * 6. On manual lock, inactivity timeout, page exit, or explicit cleanup,
 *    in-memory references and sensitive form fields are cleared as a best effort.
 *
 * IMPORTANT LIMITATION:
 * Ordinary browser JavaScript cannot guarantee physical memory erasure and cannot
 * guarantee screenshot/screen-recording prevention. The cleanup and visibility
 * controls are defensive privacy measures, not hardware-backed erasure or DRM.
 */

const CURRENT_FORMAT_VERSION = 2;
const LEGACY_FORMAT_VERSION = 1;
const AES_ALGORITHM = "AES-256-GCM";
const AES_KEY_LENGTH = 256;
const AES_TAG_LENGTH = 128;
const AES_IV_BYTES = 12;
const VAULT_SALT_BYTES = 32;
const ARGON2_VERSION = 0x13;
const ARGON2_TYPE_ID = 2;
const ARGON2_OUTPUT_BYTES = 32;
const ARGON2_STANDARD = Object.freeze({ memoryKiB: 262144, iterations: 4, parallelism: 4 });
const ARGON2_MOBILE = Object.freeze({ memoryKiB: 65536, iterations: 4, parallelism: 2 });
const MAX_MASTER_LENGTH = 256;
const MAX_PEPPER_LENGTH = 256;
const MAX_VAULT_TEXT_BYTES = 32 * 1024 * 1024;
const CLIPBOARD_DEFAULT_MS = 30000;
const SELF_TEST_VECTOR = "301a8fbb4c595c521e6752c989a952d47e1ecd063d89eebcf6887288675b54c8";
const AAD_PREFIX = "PassVault:v2";
const ARGON2_WASM_BASE64 = "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ACAGQQhqIAdBCGopAwAgCEEIaikDAIU3AwAgBUEQaiIFQYAIRw0AC0GAeCEFA0AgBCAFaiIGQYAIaiAEQYAIaiAFaiIHQYAIaikDADcDACAGQYgIaiAHQYgIaikDADcDACAGQZAIaiAHQZAIaikDADcDACAGQZgIaiAHQZgIaikDADcDACAFQSBqIgUNAAtBACEGA0AgBCAGaiIFIAVBOGoiBykDACIJIAVBGGoiCCkDACIKfCAKQgGGQv7///8fgyAJQv////8Pg358IgogBUH4AGoiASkDAIVCIIkiCyAFQdgAaiIAKQMAIgx8IAxCAYZC/v///x+DIAtC/////w+DfnwiDCAJhUIoiSIJIAp8IAlC/////w+DIApCAYZC/v///x+DfnwiCiALhUIwiSILIAVBKGoiDSkDACIOIAVBCGoiDykDACIQfCAQQgGGQv7///8fgyAOQv////8Pg358IhAgBUHoAGoiESkDAIVCIIkiEiAFQcgAaiITKQMAIhR8IBRCAYZC/v///x+DIBJC/////w+DfnwiFCAOhUIoiSIOIBB8IA5C/////w+DIBBCAYZC/v///x+DfnwiECAShUIwiSISIBR8IBJC/////w+DIBRCAYZC/v///x+DfnwiFCAOhUIBiSIOIAVBIGoiFSkDACIWIAUpAwAiF3wgF0IBhkL+////H4MgFkL/////D4N+fCIXIAVB4ABqIhgpAwCFQiCJIhkgBUHAAGoiGikDACIbfCAbQgGGQv7///8fgyAZQv////8Pg358IhsgFoVCKIkiFiAXfCAWQv////8PgyAXQgGGQv7///8fg358Ihd8IA5C/////w+DIBdCAYZC/v///x+DfnwiHIVCIIkiHSAFQTBqIh4pAwAiHyAFQRBqIiApAwAiIXwgIUIBhkL+////H4MgH0L/////D4N+fCIhIAVB8ABqIiIpAwCFQiCJIiMgBUHQAGoiBSkDACIkfCAkQgGGQv7///8fgyAjQv////8Pg358IiQgH4VCKIkiHyAhfCAfQv////8PgyAhQgGGQv7///8fg358IiEgI4VCMIkiIyAkfCAjQv////8PgyAkQgGGQv7///8fg358IiR8IB1C/////w+DICRCAYZC/v///x+DfnwiJSAOhUIoiSIOIBx8IA5C/////w+DIBxCAYZC/v///x+DfnwiHDcDACABIBwgHYVCMIkiHDcDACAFIBwgJXwgHEL/////D4MgJUIBhkL+////H4N+fCIcNwMAIA0gHCAOhUIBiTcDACAYIAsgDHwgC0L/////D4MgDEIBhkL+////H4N+fCILICQgH4VCAYkiDCAQfCAMQv////8PgyAQQgGGQv7///8fg358Ig4gFyAZhUIwiSIQhUIgiSIXfCALQgGGQv7///8fgyAXQv////8Pg358IhkgDIVCKIkiDCAOfCAMQv////8PgyAOQgGGQv7///8fg358IhwgF4VCMIkiDjcDACAPIBw3AwAgACAOIBl8IA5C/////w+DIBlCAYZC/v///x+DfnwiDjcDACAeIA4gDIVCAYk3AwAgESALIAmFQgGJIgkgIXwgCUL/////D4MgIUIBhkL+////H4N+fCILIBKFQiCJIgwgECAbfCAQQv////8PgyAbQgGGQv7///8fg358Ig58IAxC/////w+DIA5CAYZC/v///x+DfnwiECAJhUIoiSIJIAt8IAlC/////w+DIAtCAYZC/v///x+DfnwiEiAMhUIwiSILNwMAICAgEjcDACAaIAsgEHwgC0L/////D4MgEEIBhkL+////H4N+fCILNwMAIAcgCyAJhUIBiTcDACAiIAogDiAWhUIBiSIJfCAKQgGGQv7///8fgyAJQv////8Pg358IgogI4VCIIkiCyAUfCALQv////8PgyAUQgGGQv7///8fg358IgwgCYVCKIkiCSAKfCAJQv////8PgyAKQgGGQv7///8fg358Ig4gC4VCMIkiCjcDACAIIA43AwAgEyAKIAx8IApC/////w+DIAxCAYZC/v///x+DfnwiCjcDACAVIAogCYVCAYk3AwAgBkGAAWoiBkGACEcNAAtBACEGA0AgBCAGaiIFQYgBaiIHIAVBiANqIggpAwAiCSAHKQMAIgp8IApCAYZC/v///x+DIAlC/////w+DfnwiCiAFQYgHaiIHKQMAhUIgiSILIAVBiAVqIgEpAwAiDHwgDEIBhkL+////H4MgC0L/////D4N+fCIMIAmFQiiJIgkgCnwgCUL/////D4MgCkIBhkL+////H4N+fCIKIAVBgAJqIgApAwAiDiAFKQMAIhB8IBBCAYZC/v///x+DIA5C/////w+DfnwiECAFQYAGaiINKQMAhUIgiSISIAVBgARqIg8pAwAiFHwgFEIBhkL+////H4MgEkL/////D4N+fCIUIA6FQiiJIg4gEHwgDkL/////D4MgEEIBhkL+////H4N+fCIQIBKFQjCJIhIgFHwgEkL/////D4MgFEIBhkL+////H4N+fCIUIA6FQgGJIg58IApCAYZC/v///x+DIA5C/////w+DfnwiFiAFQYADaiIRKQMAIhcgBUGAAWoiEykDACIZfCAZQgGGQv7///8fgyAXQv////8Pg358IhkgBUGAB2oiFSkDAIVCIIkiGyAFQYAFaiIYKQMAIhx8IBxCAYZC/v///x+DIBtC/////w+DfnwiHCAXhUIoiSIXIBl8IBdC/////w+DIBlCAYZC/v///x+DfnwiGSAbhUIwiSIbhUIgiSIdIAVBiAJqIhopAwAiHyAFQQhqIh4pAwAiIXwgIUIBhkL+////H4MgH0L/////D4N+fCIhIAVBiAZqIiApAwCFQiCJIiMgBUGIBGoiIikDACIkfCAkQgGGQv7///8fgyAjQv////8Pg358IiQgH4VCKIkiHyAhfCAfQv////8PgyAhQgGGQv7///8fg358IiEgI4VCMIkiIyAkfCAjQv////8PgyAkQgGGQv7///8fg358IiR8IB1C/////w+DICRCAYZC/v///x+DfnwiJSAOhUIoiSIOIBZ8IA5C/////w+DIBZCAYZC/v///x+DfnwiJjcDACATIAogC4VCMIkiCiAMfCAKQv////8PgyAMQgGGQv7///8fg358IgsgCYVCAYkiCSAZfCAJQv////8PgyAZQgGGQv7///8fg358IgwgI4VCIIkiFiAUfCAWQv////8PgyAUQgGGQv7///8fg358IhQgCYVCKIkiCSAMfCAJQv////8PgyAMQgGGQv7///8fg358IiM3AwAgHiALIBsgHHwgG0L/////D4MgHEIBhkL+////H4N+fCIMIBeFQgGJIhcgIXwgF0L/////D4MgIUIBhkL+////H4N+fCIZIBKFQiCJIhJ8IAtCAYZC/v///x+DIBJC/////w+DfnwiCyAXhUIoiSIXIBl8IBdC/////w+DIBlCAYZC/v///x+DfnwiGzcDACAFIAogJCAfhUIBiSIZIBB8IBlC/////w+DIBBCAYZC/v///x+DfnwiEIVCIIkiCiAMfCAKQv////8PgyAMQgGGQv7///8fg358IgwgGYVCKIkiGSAQfCAZQv////8PgyAQQgGGQv7///8fg358Ihw3AwAgFSAmIB2FQjCJIhA3AwAgByAcIAqFQjCJIgo3AwAgICAjIBaFQjCJIhY3AwAgDSAbIBKFQjCJIhI3AwAgIiAQICV8IBBC/////w+DICVCAYZC/v///x+DfnwiEDcDACABIBIgC3wgEkL/////D4MgC0IBhkL+////H4N+fCILNwMAIBggCiAMfCAKQv////8PgyAMQgGGQv7///8fg358Igo3AwAgDyAWIBR8IBZC/////w+DIBRCAYZC/v///x+DfnwiDDcDACAAIBAgDoVCAYk3AwAgCCAMIAmFQgGJNwMAIBEgCyAXhUIBiTcDACAaIAogGYVCAYk3AwAgBkEQaiIGQYABRw0AC0GAeCEFA0AgBEGACGogBWoiB0GACGopAwAgBCAFaiIIQYAIaikDAIUhCQJAIANFDQAgAiAFakGACGopAwAgCYUhCQsgAiAFaiIGQYAIaiAJNwMAIAdBiAhqKQMAIAhBiAhqKQMAhSEJAkAgA0UNACAGQYgIaikDACAJhSEJCyAGQYgIaiAJNwMAIAVBEGoiBQ0AC0EAIQYDQCAEQYAIaiAGaiIFQQA6AAAgBUEBakEAOgAAIAVBAmpBADoAACAFQQNqQQA6AAAgBUEEakEAOgAAIAVBBWpBADoAACAFQQZqQQA6AAAgBUEHakEAOgAAIAZBCGoiBkGACEcNAAtBACEGA0AgBCAGaiIFQQA6AAAgBUEBakEAOgAAIAVBAmpBADoAACAFQQNqQQA6AAAgBUEEakEAOgAAIAVBBWpBADoAACAFQQZqQQA6AAAgBUEHakEAOgAAIAZBCGoiBkGACEcNAAsgBEGAEGokgICAgAALC8gBAQBBgAgLwAEAAQIDBAUGBwgJCgsMDQ4PDgoECAkPDQYBDAACCwcFAwsIDAAFAg8NCg4DBgcBCQQHCQMBDQwLDgIGBQoEAA8ICQAFBwIECg8OAQsMBggDDQIMBgoACwgDBA0HBQ8OAQkMBQEPDg0ECgAHBgMJAggLDQsHDgwBAwkFAA8ECAYCCgYPDgkLAwAIDAINBwEECgUKAggEBwYBBQ8LCQ4DDA0AAAECAwQFBgcICQoLDA0ODw4KBAgJDw0GAQwAAgsHBQMAqQEEbmFtZQAREGFyZ29uMl93YXNtLndhc20BbwgAB3Rlc3RfaDABDGJsYWtlMmJfaGFzaAIQYmxha2UyYl9jb21wcmVzcwMMdGVzdF9ibGFrZTJiBAt0ZXN0X2hwcmltZQUGaHByaW1lBg1hcmdvbjJpZF9oYXNoBxFhcmdvbjJfZmlsbF9ibG9jawcSAQAPX19zdGFja19wb2ludGVyCQoBAAcucm9kYXRhAH8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBBWNsYW5nXzE3LjAuMCAoaHR0cHM6Ly9naXRodWIuY29tL3N3aWZ0bGFuZy9sbHZtLXByb2plY3QuZ2l0IDEwOTk5YjZkMDM0ZmUzMThmM2Q1NmM4M2JkZGI2NTcyNTkzYThiYjApAEkPdGFyZ2V0X2ZlYXR1cmVzBCsKbXVsdGl2YWx1ZSsPbXV0YWJsZS1nbG9iYWxzKw9yZWZlcmVuY2UtdHlwZXMrCHNpZ24tZXh0";

const CHARSETS = Object.freeze({
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/|~"
});

const COMMON_PASSWORDS = new Set([
  "password", "password1", "password123", "123456", "12345678", "123456789", "1234567890",
  "qwerty", "qwerty123", "letmein", "welcome", "admin", "administrator", "iloveyou",
  "monkey", "dragon", "football", "baseball", "master", "login", "abc123", "111111",
  "000000", "passw0rd", "changeme", "secret", "google", "amazon", "india", "test", "test123"
]);

// CONFIGURATION: fill these in using your Supabase Project URL and PUBLISHABLE key.
// IMPORTANT: Never put a secret/service-role key or database password in this HTML.
const SUPABASE_URL = PASSVAULT_CONFIG.url;
const SUPABASE_PUBLISHABLE_KEY = PASSVAULT_CONFIG.publishableKey;
const cloud = {
  client: null,
  userId: null,
  email: "",
  loaded: false,
  revision: 0,
  saveInProgress: false,
  savePromise: null,
  saveTimer: null,
  mutation: 0,
  conflict: false,
  epoch: 0,
  importSource: "cloud",
  encryptedEnvelope: null,
  selectedVaultId: null,
  vaultLabel: "",
  vaults: []
};
const uiState = { accessGranted: false, accessScreen: "unlock", activePage: "vault" };

const $ = (id) => document.getElementById(id);

const els = {
  loginView: $("loginView"),
  accessLoginForm: $("accessLoginForm"),
  accessPassword: $("accessPassword"),
  accessEmail: $("accessEmail"),
  accessSubmit: $("accessSubmit"),
  registerAccountButton: $("registerAccountButton"),
  signedInIdentity: $("signedInIdentity"),
  lockedSignOutButton: $("lockedSignOutButton"),
  unlockedSignOutButton: $("unlockedSignOutButton"),
  backupVaultButton: $("backupVaultButton"),
  cloudSyncStatus: $("cloudSyncStatus"),
  toggleAccessPassword: $("toggleAccessPassword"),
  accessStatus: $("accessStatus"),
  unlockVaultScreen: $("unlockVaultScreen"),
  createVaultScreen: $("createVaultScreen"),
  vaultPage: $("vaultPage"),
  generatorPage: $("generatorPage"),
  settingsPage: $("settingsPage"),
  topKicker: $("topKicker"),
  compatibilityError: $("compatibilityError"),
  vaultStatus: $("vaultStatus"),
  dirtyStatus: $("dirtyStatus"),
  lockedView: $("lockedView"),
  unlockedView: $("unlockedView"),
  createVaultForm: $("createVaultForm"),
  newVaultName: $("newVaultName"),
  newKdfProfile: $("newKdfProfile"),
  newMaster: $("newMaster"),
  newMasterConfirm: $("newMasterConfirm"),
  newPepperEnabled: $("newPepperEnabled"),
  newPepperField: $("newPepperField"),
  newPepper: $("newPepper"),
  createVaultButton: $("createVaultButton"),
  createStatus: $("createStatus"),
  vaultFile: $("vaultFile"),
  chooseVaultFile: $("chooseVaultFile"),
  selectedFileName: $("selectedFileName"),
  unlockMaster: $("unlockMaster"),
  unlockPepper: $("unlockPepper"),
  unlockPepperHint: $("unlockPepperHint"),
  unlockVaultButton: $("unlockVaultButton"),
  unlockStatus: $("unlockStatus"),
  newMasterStrengthFill: $("newMasterStrengthFill"),
  newMasterStrengthText: $("newMasterStrengthText"),
  vaultTitle: $("vaultTitle"),
  vaultMetaText: $("vaultMetaText"),
  exportVaultButton: $("exportVaultButton"),
  downloadVaultLink: $("downloadVaultLink"),
  lockVaultButton: $("lockVaultButton"),
  credentialSearch: $("credentialSearch"),
  addCredentialButton: $("addCredentialButton"),
  credentialList: $("credentialList"),
  credentialEditorCard: $("credentialEditorCard"),
  editorTitle: $("editorTitle"),
  credentialForm: $("credentialForm"),
  editingCredentialId: $("editingCredentialId"),
  credentialTitle: $("credentialTitle"),
  credentialUrl: $("credentialUrl"),
  credentialUsername: $("credentialUsername"),
  credentialPassword: $("credentialPassword"),
  credentialNotes: $("credentialNotes"),
  toggleCredentialPassword: $("toggleCredentialPassword"),
  cancelEditButton: $("cancelEditButton"),
  credentialStatus: $("credentialStatus"),
  generatorLength: $("generatorLength"),
  genUpper: $("genUpper"),
  genLower: $("genLower"),
  genNumbers: $("genNumbers"),
  genSymbols: $("genSymbols"),
  generatedPassword: $("generatedPassword"),
  toggleGeneratedPassword: $("toggleGeneratedPassword"),
  generatePasswordButton: $("generatePasswordButton"),
  copyGeneratedButton: $("copyGeneratedButton"),
  generatorEntropy: $("generatorEntropy"),
  generatorStatus: $("generatorStatus"),
  sessionTimeout: $("sessionTimeout"),
  clipboardTimeout: $("clipboardTimeout"),
  globalStatus: $("globalStatus")
};

const state = {
  locked: true,
  vault: null,
  vaultKey: null,
  vaultMeta: null,
  pendingImport: null,
  dirty: false,
  editingId: null,
  lastActivity: Date.now(),
  sessionTimeoutMs: 600000,
  clipboardTimeoutMs: CLIPBOARD_DEFAULT_MS,
  clipboardTimer: null,
  clipboardClearDeadline: 0,
  clipboardPending: false,
  failedAttempts: 0,
  blockedUntil: 0,
  retryDelayUntil: 0,
  kdfInProgress: false,
  exportInProgress: false,
  initialized: false
};

function browserCapabilities() {
  return Boolean(
    window.crypto &&
    typeof crypto.getRandomValues === "function" &&
    crypto.subtle &&
    typeof crypto.subtle.importKey === "function" &&
    typeof crypto.subtle.encrypt === "function" &&
    typeof crypto.subtle.decrypt === "function" &&
    typeof WebAssembly === "object" &&
    typeof TextEncoder === "function" &&
    typeof TextDecoder === "function"
  );
}

function setStatus(element, message, type = "") {
  element.textContent = message || "";
  element.className = "status-line" + (type ? ` ${type}` : "");
}

function setGlobalStatus(message, type = "") {
  setStatus(els.globalStatus, message, type);
}

function clearStatus(element) {
  setStatus(element, "", "");
}

function bytesToBase64(bytesLike) {
  const bytes = bytesLike instanceof Uint8Array ? bytesLike : new Uint8Array(bytesLike);
  let result = "";
  const chunkSize = 0xC000; /* 49,152 bytes; divisible by 3 so independently encoded chunks concatenate safely. */
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
    let binary = "";
    for (let i = 0; i < chunk.length; i++) binary += String.fromCharCode(chunk[i]);
    result += btoa(binary);
  }
  return result;
}

function base64ToBytes(value) {
  if (typeof value !== "string") throw new Error("Base64 value must be a string.");
  const input = value.trim().replace(/\s+/g, "");
  if (!input || !/^[A-Za-z0-9+/]*={0,2}$/.test(input)) throw new Error("Invalid Base64 encoding.");
  let binary;
  try {
    binary = atob(input);
  } catch {
    throw new Error("Invalid Base64 encoding.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function utf8Encode(text) {
  return new TextEncoder().encode(text);
}

function utf8Decode(bytes) {
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function wipeBytes(value) {
  try {
    if (value instanceof Uint8Array) value.fill(0);
    else if (value instanceof ArrayBuffer) new Uint8Array(value).fill(0);
  } catch {
    // Best-effort erasure only; browser memory is managed by the runtime.
  }
}

function randomBytes(length) {
  const output = new Uint8Array(length);
  crypto.getRandomValues(output);
  return output;
}

function randomInt(maxExclusive) {
  if (!Number.isSafeInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > 0x100000000) {
    throw new Error("Invalid random range.");
  }

  const range = 0x100000000;
  const limit = range - (range % maxExclusive);
  const sample = new Uint32Array(1);

  do {
    crypto.getRandomValues(sample);
  } while (sample[0] >= limit);

  return sample[0] % maxExclusive;
}

function secureId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = randomBytes(16);
  try {
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const h = bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
  } finally {
    wipeBytes(bytes);
  }
}

function constantTimeBytesEqual(a, b) {
  if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function estimatePasswordEntropy(password) {
  if (typeof password !== "string" || password.length === 0) return 0;
  let alphabet = 0;
  if (/[a-z]/.test(password)) alphabet += 26;
  if (/[A-Z]/.test(password)) alphabet += 26;
  if (/[0-9]/.test(password)) alphabet += 10;
  if (/[^A-Za-z0-9]/.test(password)) alphabet += 33;
  if (alphabet === 0) alphabet = Math.min(128, new Set([...password]).size * 8);
  return Math.max(0, password.length * Math.log2(alphabet));
}

function hasRepeatedPattern(password) {
  if (!password) return false;
  if (/^(.)\1{5,}$/su.test(password)) return true;
  for (let size = 1; size <= 4; size++) {
    for (let start = 0; start + size * 3 <= password.length; start++) {
      const unit = password.slice(start, start + size);
      if (unit && unit.repeat(3) === password.slice(start, start + size * 3)) return true;
    }
  }
  return false;
}

function normalizePasswordForCheck(password) {
  return password.toLowerCase().replace(/\s+/g, "");
}

function evaluateMasterPassword(password) {
  if (typeof password !== "string" || !password) {
    return { score: 0, label: "Enter a master password.", reasons: ["No password entered."], entropy: 0 };
  }

  const normalized = normalizePasswordForCheck(password);
  const entropy = estimatePasswordEntropy(password);
  const reasons = [];

  if (password.length < 16) reasons.push("Use at least 16 characters.");
  if (password.length < 20) reasons.push("20+ characters are recommended.");
  if (COMMON_PASSWORDS.has(normalized)) reasons.push("This is a commonly used password.");
  if (hasRepeatedPattern(password)) reasons.push("Avoid repeated or obvious patterns.");
  if (/^(?:[a-z]+|[0-9]+)$/i.test(password)) reasons.push("Use more than one character category or a strong random passphrase.");

  let score = 0;
  if (password.length >= 16) score += 25;
  if (password.length >= 20) score += 15;
  if (password.length >= 28) score += 10;
  if (entropy >= 60) score += 20;
  if (entropy >= 80) score += 15;
  if (entropy >= 100) score += 10;
  if (/[a-z]/.test(password)) score += 2;
  if (/[A-Z]/.test(password)) score += 2;
  if (/[0-9]/.test(password)) score += 2;
  if (/[^A-Za-z0-9]/.test(password)) score += 4;
  if (COMMON_PASSWORDS.has(normalized)) score -= 35;
  if (hasRepeatedPattern(password)) score -= 15;

  score = Math.max(0, Math.min(100, score));
  const label = score >= 85 ? "Strong" : score >= 65 ? "Good" : score >= 45 ? "Moderate" : "Weak";
  return { score, label, reasons, entropy };
}

function updateMasterStrength() {
  const assessment = evaluateMasterPassword(els.newMaster.value);
  els.newMasterStrengthFill.style.width = `${assessment.score}%`;
  els.newMasterStrengthText.textContent = assessment.score
    ? `${assessment.label} • approximately ${assessment.entropy.toFixed(0)} bits by a simple character-set heuristic.`
    : "Enter a master password.";

  if (assessment.reasons.length > 0) {
    els.newMasterStrengthText.textContent += ` ${assessment.reasons.join(" ")}`;
  }
}

function validateMasterForCreation(password) {
  if (!password) throw new Error("Master password is required.");
  if (password.length > MAX_MASTER_LENGTH) throw new Error("Master password is too long.");
  if (password.length < 16) throw new Error("Master password must contain at least 16 characters.");

  const assessment = evaluateMasterPassword(password);
  if (COMMON_PASSWORDS.has(normalizePasswordForCheck(password))) {
    throw new Error("Choose a master password that is not a common password.");
  }
  if (hasRepeatedPattern(password)) {
    throw new Error("Choose a master password without repeated or obvious patterns.");
  }
  if (assessment.entropy < 45) {
    throw new Error("The master password is too predictable. Use a longer, less predictable passphrase or random password.");
  }
}

function canonicalAAD(meta) {
  return `${AAD_PREFIX}|format=${meta.version}|algorithm=${meta.algorithm}|kdf=${meta.kdf}|argonVersion=${meta.parameters.argonVersion}|type=${meta.parameters.type}|memoryKiB=${meta.parameters.memoryKiB}|iterations=${meta.parameters.iterations}|parallelism=${meta.parameters.parallelism}|outputLength=${meta.parameters.outputLength}|salt=${meta.salt}|nonce=${meta.nonce}|pepperRequired=${meta.pepperRequired ? "1" : "0"}|tagLength=${meta.authentication.tagLength}`;
}

function validateV2Envelope(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Vault file is not a valid object.");
  if (record.version !== CURRENT_FORMAT_VERSION) {
    if (record.version > CURRENT_FORMAT_VERSION) throw new Error(`Vault format v${record.version} is newer than this application (v${CURRENT_FORMAT_VERSION}).`);
    throw new Error("Unsupported vault version.");
  }
  if (record.algorithm !== AES_ALGORITHM) throw new Error("Unsupported vault encryption algorithm.");
  if (record.kdf !== "Argon2id") throw new Error("Unsupported vault key derivation function.");
  if (!record.parameters || typeof record.parameters !== "object") throw new Error("Vault KDF parameters are missing.");

  const p = record.parameters;
  if (p.argonVersion !== ARGON2_VERSION || p.type !== ARGON2_TYPE_ID) throw new Error("Unsupported Argon2id version or type.");
  if (!Number.isInteger(p.memoryKiB) || !Number.isInteger(p.iterations) || !Number.isInteger(p.parallelism) || p.outputLength !== ARGON2_OUTPUT_BYTES) {
    throw new Error("Invalid Argon2id parameters.");
  }
  if (p.iterations < 1 || p.parallelism < 1 || p.memoryKiB < 8 * p.parallelism) throw new Error("Invalid Argon2id parameter values.");
  if (![ARGON2_STANDARD.memoryKiB, ARGON2_MOBILE.memoryKiB].includes(p.memoryKiB) || p.iterations !== 4 || ![2,4].includes(p.parallelism)) {
    throw new Error("This vault uses an unsupported Argon2id security profile.");
  }
  if (record.pepperRequired !== true && record.pepperRequired !== false) throw new Error("Vault pepper metadata is invalid.");
  if (!record.authentication || record.authentication.tagLength !== AES_TAG_LENGTH || record.authentication.aad !== AAD_PREFIX) {
    throw new Error("Vault authentication metadata is invalid.");
  }
  if (typeof record.salt !== "string" || typeof record.nonce !== "string" || typeof record.ciphertext !== "string") {
    throw new Error("Vault cryptographic fields are missing.");
  }

  const salt = base64ToBytes(record.salt);
  const nonce = base64ToBytes(record.nonce);
  const ciphertext = base64ToBytes(record.ciphertext);
  try {
    if (salt.length !== VAULT_SALT_BYTES) throw new Error("Vault salt length is invalid.");
    if (nonce.length !== AES_IV_BYTES) throw new Error("Vault nonce length is invalid.");
    if (ciphertext.length < 16) throw new Error("Vault ciphertext is too short.");
    if (ciphertext.length > MAX_VAULT_TEXT_BYTES) throw new Error("Vault ciphertext is too large.");
  } finally {
    wipeBytes(salt);
    wipeBytes(nonce);
    wipeBytes(ciphertext);
  }

  return true;
}

function validateVaultPlaintext(vault) {
  if (!vault || typeof vault !== "object" || Array.isArray(vault)) throw new Error("Decrypted vault structure is invalid.");
  if (vault.schemaVersion !== 1) throw new Error("Unsupported decrypted vault schema.");
  if (typeof vault.id !== "string" || !vault.id) throw new Error("Vault ID is invalid.");
  if (typeof vault.name !== "string" || vault.name.length > 128) throw new Error("Vault name is invalid.");
  if (!Array.isArray(vault.credentials)) throw new Error("Credential list is invalid.");
  if (vault.credentials.length > 10000) throw new Error("Vault contains too many credentials.");

  for (const credential of vault.credentials) {
    if (!credential || typeof credential !== "object") throw new Error("Credential structure is invalid.");
    const fields = [
      ["id", 128], ["title", 256], ["url", 2048], ["username", 512], ["password", 2048], ["notes", 4096]
    ];
    for (const [name, max] of fields) {
      if (typeof credential[name] !== "string" || credential[name].length > max) {
        throw new Error(`Credential field '${name}' is invalid.`);
      }
    }
    if (typeof credential.createdAt !== "string" || typeof credential.updatedAt !== "string") {
      throw new Error("Credential timestamps are invalid.");
    }
  }

  return true;
}

function buildNewVault(name) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: secureId(),
    name: name || "Personal Vault",
    createdAt: now,
    updatedAt: now,
    credentials: []
  };
}

function createPasswordPool(options) {
  const selected = [];
  if (options.upper) selected.push(CHARSETS.upper);
  if (options.lower) selected.push(CHARSETS.lower);
  if (options.numbers) selected.push(CHARSETS.numbers);
  if (options.symbols) selected.push(CHARSETS.symbols);
  if (selected.length === 0) throw new Error("Select at least one character set.");
  return selected;
}

function secureShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function generatePassword(options) {
  const length = Number(options.length);
  if (!Number.isInteger(length) || length < 8 || length > 64) throw new Error("Password length must be between 8 and 64.");

  const selected = createPasswordPool(options);
  if (length < selected.length) throw new Error("Password length must be at least the number of selected character sets.");

  const allCharacters = selected.join("");
  const chars = [];
  for (const charset of selected) chars.push(charset[randomInt(charset.length)]);
  while (chars.length < length) chars.push(allCharacters[randomInt(allCharacters.length)]);
  return secureShuffle(chars).join("");
}

function generatorEntropy(options) {
  const selected = createPasswordPool(options);
  return Number(options.length) * Math.log2(selected.join("").length);
}

function populateGeneratorLengths() {
  for (let i = 8; i <= 64; i++) {
    const option = document.createElement("option");
    option.value = String(i);
    option.textContent = `${i} characters`;
    if (i === 20) option.selected = true;
    els.generatorLength.appendChild(option);
  }
}

function generatorOptions() {
  return {
    length: Number(els.generatorLength.value),
    upper: els.genUpper.checked,
    lower: els.genLower.checked,
    numbers: els.genNumbers.checked,
    symbols: els.genSymbols.checked
  };
}

function createArgon2Worker() {
  const source = `
"use strict";
const WASM_B64 = ${JSON.stringify(ARGON2_WASM_BASE64)};
const ARGON2_VERSION = 0x13;
const ARGON2_TYPE_ID = 2;
const OUTPUT_BYTES = 32;
const MEMORY_BASE = 4194304;
const PASSWORD_PTR = 65536;
const SALT_PTR = 131072;
const SECRET_PTR = 196608;
const AD_PTR = 229376;
const OUTPUT_PTR = 262144;

function decodeB64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

let wasmBytes = null;
let instance = null;

async function getInstance() {
  if (instance) return instance;
  wasmBytes = decodeB64(WASM_B64);
  const result = await WebAssembly.instantiate(wasmBytes, {});
  instance = result.instance;
  wasmBytes.fill(0);
  wasmBytes = null;
  return instance;
}

function wipe(value) {
  try { if (value instanceof Uint8Array) value.fill(0); } catch {}
}

function toHex(bytes) {
  let out = "";
  for (const value of bytes) out += value.toString(16).padStart(2, "0");
  return out;
}

async function derive(password, salt, pepper, params) {
  const inst = await getInstance();
  const memory = inst.exports.memory;
  const passBytes = new Uint8Array(password);
  const saltBytes = new Uint8Array(salt);
  const secretBytes = new Uint8Array(pepper);
  const outLength = OUTPUT_BYTES;

  try {
    new Uint8Array(memory.buffer, PASSWORD_PTR, passBytes.length).set(passBytes);
    new Uint8Array(memory.buffer, SALT_PTR, saltBytes.length).set(saltBytes);
    if (secretBytes.length) new Uint8Array(memory.buffer, SECRET_PTR, secretBytes.length).set(secretBytes);

    const rc = inst.exports.argon2id_hash(
      PASSWORD_PTR, passBytes.length,
      SALT_PTR, saltBytes.length,
      SECRET_PTR, secretBytes.length,
      AD_PTR, 0,
      OUTPUT_PTR, outLength,
      params.memoryKiB, params.iterations, params.parallelism
    );

    if (rc !== 0) throw new Error(rc === 2 ? "Argon2id memory allocation failed in this browser." : "Argon2id failed (code " + rc + ").");

    const output = new Uint8Array(memory.buffer, OUTPUT_PTR, outLength).slice();
    return output;
  } finally {
    wipe(passBytes);
    wipe(saltBytes);
    wipe(secretBytes);
    try {
      new Uint8Array(memory.buffer, PASSWORD_PTR, Math.max(passBytes.length, 1)).fill(0);
      new Uint8Array(memory.buffer, SALT_PTR, Math.max(saltBytes.length, 1)).fill(0);
      new Uint8Array(memory.buffer, SECRET_PTR, Math.max(secretBytes.length, 1)).fill(0);
      new Uint8Array(memory.buffer, AD_PTR, 1).fill(0);
      new Uint8Array(memory.buffer, OUTPUT_PTR, outLength).fill(0);
    } catch {}
  }
}

self.onmessage = async (event) => {
  let password = null;
  let salt = null;
  let pepper = null;
  try {
    const msg = event.data || {};
    if (msg.type === "selftest") {
      const p = new TextEncoder().encode("password");
      const s = new TextEncoder().encode("somesalt");
      const k = await derive(p.buffer, s.buffer, new ArrayBuffer(0), { memoryKiB: 32, iterations: 1, parallelism: 1 });
      const hex = toHex(k);
      wipe(k);
      if (hex !== "301a8fbb4c595c521e6752c989a952d47e1ecd063d89eebcf6887288675b54c8") throw new Error("Argon2id self-test failed.");
      self.postMessage({ ok: true, type: "selftest" });
      return;
    }

    if (msg.type !== "derive") throw new Error("Unknown KDF worker request.");
    password = msg.password;
    salt = msg.salt;
    pepper = msg.pepper;

    const key = await derive(password, salt, pepper, msg.params);
    self.postMessage({ ok: true, type: "derive", key: key.buffer }, [key.buffer]);
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : "KDF worker failed." });
  } finally {
    password = null;
    salt = null;
    pepper = null;
  }
};
`;

  const blob = new Blob([source], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const worker = new Worker(url);

  return {
    worker,
    cleanup() {
      try { worker.terminate(); } catch {}
      URL.revokeObjectURL(url);
    }
  };
}

async function deriveArgon2idWithWorker(masterPassword, saltBytes, pepperBytes, params) {
  if (state.kdfInProgress) throw new Error("A key derivation operation is already running.");
  state.kdfInProgress = true;

  const passwordBytes = utf8Encode(masterPassword);
  const pepper = pepperBytes instanceof Uint8Array ? pepperBytes : utf8Encode(pepperBytes || "");

  /*
   * The caller's salt and the local input buffers must not be transferred directly
   * to the worker. Transferring an ArrayBuffer detaches it in the main thread.
   * Cloning here preserves the original buffers for the local fallback and for
   * subsequent vault metadata construction.
   */
  const workerPassword = passwordBytes.slice();
  const workerSalt = saltBytes.slice();
  const workerPepper = pepper.slice();
  let workerInfo = null;

  try {
    try {
      workerInfo = createArgon2Worker();
      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Argon2id operation timed out.")), 180000);
        workerInfo.worker.onmessage = (event) => {
          clearTimeout(timeout);
          const msg = event.data || {};
          if (!msg.ok) reject(new Error(msg.error || "Argon2id failed."));
          else resolve(msg);
        };
        workerInfo.worker.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Argon2id worker failed to initialize or execute."));
        };
        workerInfo.worker.postMessage({
          type: "derive",
          password: workerPassword.buffer,
          salt: workerSalt.buffer,
          pepper: workerPepper.buffer,
          params
        }, [workerPassword.buffer, workerSalt.buffer, workerPepper.buffer]);
      });

      return new Uint8Array(result.key);
    } catch (workerError) {
      /*
       * Compatibility fallback: run the identical embedded Argon2id WebAssembly
       * implementation on the main thread if this browser blocks Blob workers.
       * The KDF profile is unchanged by the fallback.
       */
      return await deriveArgon2idMainThread(passwordBytes, saltBytes, pepper, params);
    }
  } finally {
    wipeBytes(passwordBytes);
    wipeBytes(pepper);
    wipeBytes(workerPassword);
    wipeBytes(workerSalt);
    wipeBytes(workerPepper);
    if (workerInfo) workerInfo.cleanup();
    state.kdfInProgress = false;
  }
}
async function deriveArgon2idMainThread(passwordBytes, saltBytes, pepperBytes, params) {
  const base64 = "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ACAGQQhqIAdBCGopAwAgCEEIaikDAIU3AwAgBUEQaiIFQYAIRw0AC0GAeCEFA0AgBCAFaiIGQYAIaiAEQYAIaiAFaiIHQYAIaikDADcDACAGQYgIaiAHQYgIaikDADcDACAGQZAIaiAHQZAIaikDADcDACAGQZgIaiAHQZgIaikDADcDACAFQSBqIgUNAAtBACEGA0AgBCAGaiIFIAVBOGoiBykDACIJIAVBGGoiCCkDACIKfCAKQgGGQv7///8fgyAJQv////8Pg358IgogBUH4AGoiASkDAIVCIIkiCyAFQdgAaiIAKQMAIgx8IAxCAYZC/v///x+DIAtC/////w+DfnwiDCAJhUIoiSIJIAp8IAlC/////w+DIApCAYZC/v///x+DfnwiCiALhUIwiSILIAVBKGoiDSkDACIOIAVBCGoiDykDACIQfCAQQgGGQv7///8fgyAOQv////8Pg358IhAgBUHoAGoiESkDAIVCIIkiEiAFQcgAaiITKQMAIhR8IBRCAYZC/v///x+DIBJC/////w+DfnwiFCAOhUIoiSIOIBB8IA5C/////w+DIBBCAYZC/v///x+DfnwiECAShUIwiSISIBR8IBJC/////w+DIBRCAYZC/v///x+DfnwiFCAOhUIBiSIOIAVBIGoiFSkDACIWIAUpAwAiF3wgF0IBhkL+////H4MgFkL/////D4N+fCIXIAVB4ABqIhgpAwCFQiCJIhkgBUHAAGoiGikDACIbfCAbQgGGQv7///8fgyAZQv////8Pg358IhsgFoVCKIkiFiAXfCAWQv////8PgyAXQgGGQv7///8fg358Ihd8IA5C/////w+DIBdCAYZC/v///x+DfnwiHIVCIIkiHSAFQTBqIh4pAwAiHyAFQRBqIiApAwAiIXwgIUIBhkL+////H4MgH0L/////D4N+fCIhIAVB8ABqIiIpAwCFQiCJIiMgBUHQAGoiBSkDACIkfCAkQgGGQv7///8fgyAjQv////8Pg358IiQgH4VCKIkiHyAhfCAfQv////8PgyAhQgGGQv7///8fg358IiEgI4VCMIkiIyAkfCAjQv////8PgyAkQgGGQv7///8fg358IiR8IB1C/////w+DICRCAYZC/v///x+DfnwiJSAOhUIoiSIOIBx8IA5C/////w+DIBxCAYZC/v///x+DfnwiHDcDACABIBwgHYVCMIkiHDcDACAFIBwgJXwgHEL/////D4MgJUIBhkL+////H4N+fCIcNwMAIA0gHCAOhUIBiTcDACAYIAsgDHwgC0L/////D4MgDEIBhkL+////H4N+fCILICQgH4VCAYkiDCAQfCAMQv////8PgyAQQgGGQv7///8fg358Ig4gFyAZhUIwiSIQhUIgiSIXfCALQgGGQv7///8fgyAXQv////8Pg358IhkgDIVCKIkiDCAOfCAMQv////8PgyAOQgGGQv7///8fg358IhwgF4VCMIkiDjcDACAPIBw3AwAgACAOIBl8IA5C/////w+DIBlCAYZC/v///x+DfnwiDjcDACAeIA4gDIVCAYk3AwAgESALIAmFQgGJIgkgIXwgCUL/////D4MgIUIBhkL+////H4N+fCILIBKFQiCJIgwgECAbfCAQQv////8PgyAbQgGGQv7///8fg358Ig58IAxC/////w+DIA5CAYZC/v///x+DfnwiECAJhUIoiSIJIAt8IAlC/////w+DIAtCAYZC/v///x+DfnwiEiAMhUIwiSILNwMAICAgEjcDACAaIAsgEHwgC0L/////D4MgEEIBhkL+////H4N+fCILNwMAIAcgCyAJhUIBiTcDACAiIAogDiAWhUIBiSIJfCAKQgGGQv7///8fgyAJQv////8Pg358IgogI4VCIIkiCyAUfCALQv////8PgyAUQgGGQv7///8fg358IgwgCYVCKIkiCSAKfCAJQv////8PgyAKQgGGQv7///8fg358Ig4gC4VCMIkiCjcDACAIIA43AwAgEyAKIAx8IApC/////w+DIAxCAYZC/v///x+DfnwiCjcDACAVIAogCYVCAYk3AwAgBkGAAWoiBkGACEcNAAtBACEGA0AgBCAGaiIFQYgBaiIHIAVBiANqIggpAwAiCSAHKQMAIgp8IApCAYZC/v///x+DIAlC/////w+DfnwiCiAFQYgHaiIHKQMAhUIgiSILIAVBiAVqIgEpAwAiDHwgDEIBhkL+////H4MgC0L/////D4N+fCIMIAmFQiiJIgkgCnwgCUL/////D4MgCkIBhkL+////H4N+fCIKIAVBgAJqIgApAwAiDiAFKQMAIhB8IBBCAYZC/v///x+DIA5C/////w+DfnwiECAFQYAGaiINKQMAhUIgiSISIAVBgARqIg8pAwAiFHwgFEIBhkL+////H4MgEkL/////D4N+fCIUIA6FQiiJIg4gEHwgDkL/////D4MgEEIBhkL+////H4N+fCIQIBKFQjCJIhIgFHwgEkL/////D4MgFEIBhkL+////H4N+fCIUIA6FQgGJIg58IApCAYZC/v///x+DIA5C/////w+DfnwiFiAFQYADaiIRKQMAIhcgBUGAAWoiEykDACIZfCAZQgGGQv7///8fgyAXQv////8Pg358IhkgBUGAB2oiFSkDAIVCIIkiGyAFQYAFaiIYKQMAIhx8IBxCAYZC/v///x+DIBtC/////w+DfnwiHCAXhUIoiSIXIBl8IBdC/////w+DIBlCAYZC/v///x+DfnwiGSAbhUIwiSIbhUIgiSIdIAVBiAJqIhopAwAiHyAFQQhqIh4pAwAiIXwgIUIBhkL+////H4MgH0L/////D4N+fCIhIAVBiAZqIiApAwCFQiCJIiMgBUGIBGoiIikDACIkfCAkQgGGQv7///8fgyAjQv////8Pg358IiQgH4VCKIkiHyAhfCAfQv////8PgyAhQgGGQv7///8fg358IiEgI4VCMIkiIyAkfCAjQv////8PgyAkQgGGQv7///8fg358IiR8IB1C/////w+DICRCAYZC/v///x+DfnwiJSAOhUIoiSIOIBZ8IA5C/////w+DIBZCAYZC/v///x+DfnwiJjcDACATIAogC4VCMIkiCiAMfCAKQv////8PgyAMQgGGQv7///8fg358IgsgCYVCAYkiCSAZfCAJQv////8PgyAZQgGGQv7///8fg358IgwgI4VCIIkiFiAUfCAWQv////8PgyAUQgGGQv7///8fg358IhQgCYVCKIkiCSAMfCAJQv////8PgyAMQgGGQv7///8fg358IiM3AwAgHiALIBsgHHwgG0L/////D4MgHEIBhkL+////H4N+fCIMIBeFQgGJIhcgIXwgF0L/////D4MgIUIBhkL+////H4N+fCIZIBKFQiCJIhJ8IAtCAYZC/v///x+DIBJC/////w+DfnwiCyAXhUIoiSIXIBl8IBdC/////w+DIBlCAYZC/v///x+DfnwiGzcDACAFIAogJCAfhUIBiSIZIBB8IBlC/////w+DIBBCAYZC/v///x+DfnwiEIVCIIkiCiAMfCAKQv////8PgyAMQgGGQv7///8fg358IgwgGYVCKIkiGSAQfCAZQv////8PgyAQQgGGQv7///8fg358Ihw3AwAgFSAmIB2FQjCJIhA3AwAgByAcIAqFQjCJIgo3AwAgICAjIBaFQjCJIhY3AwAgDSAbIBKFQjCJIhI3AwAgIiAQICV8IBBC/////w+DICVCAYZC/v///x+DfnwiEDcDACABIBIgC3wgEkL/////D4MgC0IBhkL+////H4N+fCILNwMAIBggCiAMfCAKQv////8PgyAMQgGGQv7///8fg358Igo3AwAgDyAWIBR8IBZC/////w+DIBRCAYZC/v///x+DfnwiDDcDACAAIBAgDoVCAYk3AwAgCCAMIAmFQgGJNwMAIBEgCyAXhUIBiTcDACAaIAogGYVCAYk3AwAgBkEQaiIGQYABRw0AC0GAeCEFA0AgBEGACGogBWoiB0GACGopAwAgBCAFaiIIQYAIaikDAIUhCQJAIANFDQAgAiAFakGACGopAwAgCYUhCQsgAiAFaiIGQYAIaiAJNwMAIAdBiAhqKQMAIAhBiAhqKQMAhSEJAkAgA0UNACAGQYgIaikDACAJhSEJCyAGQYgIaiAJNwMAIAVBEGoiBQ0AC0EAIQYDQCAEQYAIaiAGaiIFQQA6AAAgBUEBakEAOgAAIAVBAmpBADoAACAFQQNqQQA6AAAgBUEEakEAOgAAIAVBBWpBADoAACAFQQZqQQA6AAAgBUEHakEAOgAAIAZBCGoiBkGACEcNAAtBACEGA0AgBCAGaiIFQQA6AAAgBUEBakEAOgAAIAVBAmpBADoAACAFQQNqQQA6AAAgBUEEakEAOgAAIAVBBWpBADoAACAFQQZqQQA6AAAgBUEHakEAOgAAIAZBCGoiBkGACEcNAAsgBEGAEGokgICAgAALC8gBAQBBgAgLwAEAAQIDBAUGBwgJCgsMDQ4PDgoECAkPDQYBDAACCwcFAwsIDAAFAg8NCg4DBgcBCQQHCQMBDQwLDgIGBQoEAA8ICQAFBwIECg8OAQsMBggDDQIMBgoACwgDBA0HBQ8OAQkMBQEPDg0ECgAHBgMJAggLDQsHDgwBAwkFAA8ECAYCCgYPDgkLAwAIDAINBwEECgUKAggEBwYBBQ8LCQ4DDA0AAAECAwQFBgcICQoLDA0ODw4KBAgJDw0GAQwAAgsHBQMAqQEEbmFtZQAREGFyZ29uMl93YXNtLndhc20BbwgAB3Rlc3RfaDABDGJsYWtlMmJfaGFzaAIQYmxha2UyYl9jb21wcmVzcwMMdGVzdF9ibGFrZTJiBAt0ZXN0X2hwcmltZQUGaHByaW1lBg1hcmdvbjJpZF9oYXNoBxFhcmdvbjJfZmlsbF9ibG9jawcSAQAPX19zdGFja19wb2ludGVyCQoBAAcucm9kYXRhAH8JcHJvZHVjZXJzAQxwcm9jZXNzZWQtYnkBBWNsYW5nXzE3LjAuMCAoaHR0cHM6Ly9naXRodWIuY29tL3N3aWZ0bGFuZy9sbHZtLXByb2plY3QuZ2l0IDEwOTk5YjZkMDM0ZmUzMThmM2Q1NmM4M2JkZGI2NTcyNTkzYThiYjApAEkPdGFyZ2V0X2ZlYXR1cmVzBCsKbXVsdGl2YWx1ZSsPbXV0YWJsZS1nbG9iYWxzKw9yZWZlcmVuY2UtdHlwZXMrCHNpZ24tZXh0";
  const binary = atob(base64);
  const wasmBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) wasmBytes[i] = binary.charCodeAt(i);

  let instance;
  const PASSWORD_PTR = 65536;
  const SALT_PTR = 131072;
  const SECRET_PTR = 196608;
  const AD_PTR = 229376;
  const OUTPUT_PTR = 262144;
  try {
    const result = await WebAssembly.instantiate(wasmBytes, {});
    instance = result.instance;
    const memory = instance.exports.memory;
    new Uint8Array(memory.buffer, PASSWORD_PTR, passwordBytes.length).set(passwordBytes);
    new Uint8Array(memory.buffer, SALT_PTR, saltBytes.length).set(saltBytes);
    if (pepperBytes.length) new Uint8Array(memory.buffer, SECRET_PTR, pepperBytes.length).set(pepperBytes);

    const rc = instance.exports.argon2id_hash(
      PASSWORD_PTR, passwordBytes.length,
      SALT_PTR, saltBytes.length,
      SECRET_PTR, pepperBytes.length,
      AD_PTR, 0,
      OUTPUT_PTR, ARGON2_OUTPUT_BYTES,
      params.memoryKiB, params.iterations, params.parallelism
    );

    if (rc !== 0) throw new Error(rc === 2 ? "Argon2id memory allocation failed in this browser." : "Argon2id failed (code " + rc + ").");
    return new Uint8Array(memory.buffer, OUTPUT_PTR, ARGON2_OUTPUT_BYTES).slice();
  } finally {
    wasmBytes.fill(0);
    try {
      if (instance) {
        const memory = instance.exports.memory;
        new Uint8Array(memory.buffer, PASSWORD_PTR, Math.max(passwordBytes.length, 1)).fill(0);
        new Uint8Array(memory.buffer, SALT_PTR, Math.max(saltBytes.length, 1)).fill(0);
        new Uint8Array(memory.buffer, SECRET_PTR, Math.max(pepperBytes.length, 1)).fill(0);
        new Uint8Array(memory.buffer, AD_PTR, 1).fill(0);
        new Uint8Array(memory.buffer, OUTPUT_PTR, ARGON2_OUTPUT_BYTES).fill(0);
      }
    } catch {}
  }
}

async function runArgon2SelfTest() {
  /*
   * Purpose: verify the embedded Argon2id module against a fixed RFC 9106-compatible vector.
   * Input: password="password", salt="somesalt", 32 KiB / t=1 / p=1.
   * Output: boolean success/failure.
   * Security: this uses a tiny test-only parameter set and never becomes a vault parameter.
   * A Blob Worker is preferred, but the identical WASM module is used on the main thread
   * when a browser disallows Blob workers.
   */
  const expectedHex = "301a8fbb4c595c521e6752c989a952d47e1ecd063d89eebcf6887288675b54c8";
  let workerInfo = null;
  try {
    try {
      workerInfo = createArgon2Worker();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Argon2id self-test timed out.")), 30000);
        workerInfo.worker.onmessage = (event) => {
          clearTimeout(timeout);
          const msg = event.data || {};
          if (msg.ok) resolve(true);
          else reject(new Error(msg.error || "Argon2id self-test failed."));
        };
        workerInfo.worker.onerror = () => {
          clearTimeout(timeout);
          reject(new Error("Argon2id self-test worker error."));
        };
        workerInfo.worker.postMessage({ type: "selftest" });
      });
      return true;
    } catch (workerError) {
      const password = utf8Encode("password");
      const salt = utf8Encode("somesalt");
      let output = null;
      try {
        output = await deriveArgon2idMainThread(password, salt, new Uint8Array(0), { memoryKiB: 32, iterations: 1, parallelism: 1 });
        let hex = "";
        for (const byte of output) hex += byte.toString(16).padStart(2, "0");
        if (hex !== expectedHex) throw new Error("Argon2id self-test failed.");
        return true;
      } finally {
        wipeBytes(password);
        wipeBytes(salt);
        wipeBytes(output);
      }
    }
  } finally {
    if (workerInfo) workerInfo.cleanup();
  }
}

async function deriveVaultKey(masterPassword, saltBytes, pepperText, params) {
  if (typeof masterPassword !== "string" || !masterPassword) throw new Error("Master password is required.");
  if (masterPassword.length > MAX_MASTER_LENGTH) throw new Error("Master password is too long.");
  if (!(saltBytes instanceof Uint8Array) || saltBytes.length !== VAULT_SALT_BYTES) throw new Error("Invalid vault salt.");
  if (typeof pepperText !== "string") throw new Error("Invalid pepper input.");
  if (pepperText.length > MAX_PEPPER_LENGTH) throw new Error("Secret pepper is too long.");

  let pepperBytes = utf8Encode(pepperText);
  let rawKey = null;
  try {
    rawKey = await deriveArgon2idWithWorker(masterPassword, saltBytes, pepperBytes, params);
    if (!(rawKey instanceof Uint8Array) || rawKey.length !== ARGON2_OUTPUT_BYTES) throw new Error("Invalid Argon2id output.");
    const aesKey = await crypto.subtle.importKey(
      "raw",
      rawKey,
      { name: "AES-GCM", length: AES_KEY_LENGTH },
      false,
      ["encrypt", "decrypt"]
    );
    return aesKey;
  } finally {
    wipeBytes(pepperBytes);
    wipeBytes(rawKey);
    pepperBytes = null;
    rawKey = null;
  }
}

async function encryptVaultPayload(vault, aesKey, envelopeMeta) {
  const plaintext = utf8Encode(JSON.stringify(vault));
  const aad = utf8Encode(canonicalAAD(envelopeMeta));
  let cipherBuffer = null;
  try {
    cipherBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: envelopeMeta.nonceBytes, additionalData: aad, tagLength: AES_TAG_LENGTH },
      aesKey,
      plaintext
    );
    return bytesToBase64(cipherBuffer);
  } finally {
    wipeBytes(plaintext);
    wipeBytes(aad);
    wipeBytes(cipherBuffer);
  }
}

async function decryptVaultPayload(record, aesKey) {
  const nonce = base64ToBytes(record.nonce);
  const ciphertext = base64ToBytes(record.ciphertext);
  const aad = utf8Encode(canonicalAAD({
    version: record.version,
    algorithm: record.algorithm,
    kdf: record.kdf,
    parameters: record.parameters,
    salt: record.salt,
    nonce: record.nonce,
    pepperRequired: record.pepperRequired,
    authentication: record.authentication
  }));

  let plaintextBuffer = null;
  try {
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce, additionalData: aad, tagLength: AES_TAG_LENGTH },
      aesKey,
      ciphertext
    );
    const plaintext = utf8Decode(plaintextBuffer);
    let vault;
    try {
      vault = JSON.parse(plaintext);
    } catch {
      throw new Error("Authenticated data is not valid JSON.");
    }
    validateVaultPlaintext(vault);
    return vault;
  } finally {
    wipeBytes(nonce);
    wipeBytes(ciphertext);
    wipeBytes(aad);
    wipeBytes(plaintextBuffer);
  }
}

async function encryptAndBuildEnvelope() {
  if (!state.vaultKey || !state.vault || !state.vaultMeta) throw new Error("No unlocked vault is available.");

  const nonce = randomBytes(AES_IV_BYTES);
  const envelope = {
    version: CURRENT_FORMAT_VERSION,
    algorithm: AES_ALGORITHM,
    kdf: "Argon2id",
    parameters: { ...state.vaultMeta.parameters },
    salt: state.vaultMeta.salt,
    nonce: bytesToBase64(nonce),
    ciphertext: "",
    authentication: { algorithm: "AES-GCM", tagLength: AES_TAG_LENGTH, aad: AAD_PREFIX },
    pepperRequired: state.vaultMeta.pepperRequired
  };

  try {
    envelope.nonceBytes = nonce;
    envelope.ciphertext = await encryptVaultPayload(state.vault, state.vaultKey, envelope);
    delete envelope.nonceBytes;
    return envelope;
  } finally {
    wipeBytes(nonce);
  }
}

function parseVaultFileText(text) {
  if (typeof text !== "string") throw new Error("Vault file could not be read as text.");
  if (new TextEncoder().encode(text).length > MAX_VAULT_TEXT_BYTES) throw new Error("Vault file is too large.");
  let record;
  try {
    record = JSON.parse(text);
  } catch {
    throw new Error("Vault file is not valid JSON.");
  }

  if (record && record.version === LEGACY_FORMAT_VERSION && record.kdf === "PBKDF2-SHA256") {
    validateLegacyV1(record);
    return { type: "legacy-v1", record };
  }

  validateV2Envelope(record);
  return { type: "v2", record };
}

function validateLegacyV1(record) {
  if (record.version !== 1 || record.algorithm !== AES_ALGORITHM || record.kdf !== "PBKDF2-SHA256" || record.iterations !== "600000") {
    throw new Error("Unsupported legacy vault format.");
  }
  const salt = base64ToBytes(record.salt);
  const iv = base64ToBytes(record.iv);
  const ciphertext = base64ToBytes(record.ciphertext);
  try {
    if (salt.length !== 16) throw new Error("Legacy salt length is invalid.");
    if (iv.length !== 12) throw new Error("Legacy IV length is invalid.");
    if (ciphertext.length < 16) throw new Error("Legacy ciphertext is too short.");
  } finally {
    wipeBytes(salt);
    wipeBytes(iv);
    wipeBytes(ciphertext);
  }
}

async function decryptLegacyV1(record, masterPassword) {
  const salt = base64ToBytes(record.salt);
  const iv = base64ToBytes(record.iv);
  const ciphertext = base64ToBytes(record.ciphertext);
  let key = null;
  let plaintextBuffer = null;
  const aad = utf8Encode("Pass:v1:AES-256-GCM");
  const passwordBytes = utf8Encode(masterPassword);

  try {
    const baseKey = await crypto.subtle.importKey("raw", passwordBytes, "PBKDF2", false, ["deriveKey"]);
    key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 600000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: AES_KEY_LENGTH },
      false,
      ["decrypt"]
    );
    plaintextBuffer = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad, tagLength: AES_TAG_LENGTH },
      key,
      ciphertext
    );
    const plaintext = utf8Decode(plaintextBuffer);
    let credential;
    try { credential = JSON.parse(plaintext); }
    catch { throw new Error("Legacy plaintext structure is invalid."); }

    if (!credential || typeof credential.website !== "string" || typeof credential.username !== "string" || typeof credential.password !== "string") {
      throw new Error("Legacy credential structure is invalid.");
    }

    const now = new Date().toISOString();
    return {
      schemaVersion: 1,
      id: secureId(),
      name: "Migrated Vault",
      createdAt: now,
      updatedAt: now,
      credentials: [{
        id: secureId(),
        title: credential.website.slice(0, 256),
        url: "",
        username: credential.username.slice(0, 512),
        password: credential.password.slice(0, 2048),
        notes: "Migrated from Pass v1 legacy credential format.",
        createdAt: now,
        updatedAt: now
      }]
    };
  } finally {
    wipeBytes(salt);
    wipeBytes(iv);
    wipeBytes(ciphertext);
    wipeBytes(aad);
    wipeBytes(passwordBytes);
    wipeBytes(plaintextBuffer);
    key = null;
  }
}

function validateCreateForm() {
  const master = els.newMaster.value;
  const confirm = els.newMasterConfirm.value;

  validateMasterForCreation(master);
  if (master !== confirm) throw new Error("Master password confirmation does not match.");

  if (els.newPepperEnabled.checked) {
    if (!els.newPepper.value) throw new Error("Enter the secret pepper or disable the pepper option.");
    if (els.newPepper.value.length > MAX_PEPPER_LENGTH) throw new Error("Secret pepper is too long.");
  }

  return true;
}

function clearCreateSensitiveFields() {
  els.newMaster.value = "";
  els.newMasterConfirm.value = "";
  els.newPepper.value = "";
  updateMasterStrength();
}

function clearUnlockSensitiveFields() {
  els.unlockMaster.value = "";
  els.unlockPepper.value = "";
}

function clearCredentialFormSensitive() {
  els.credentialPassword.value = "";
  els.credentialPassword.type = "password";
  els.toggleCredentialPassword.textContent = "Show";
}

function clearGeneratedPassword() {
  els.generatedPassword.value = "";
  els.generatedPassword.type = "password";
  els.toggleGeneratedPassword.textContent = "Show";
  els.copyGeneratedButton.disabled = true;
  els.generatorEntropy.textContent = "Approximate entropy: —";
}


// ────────────────────────────────────────────────────────────────────────────
// Supabase account & encrypted cloud vault integration.
// Authentication sessions use tab-scoped sessionStorage. Vault plaintext, the
// master password, optional pepper, and CryptoKey are never stored there.
// ────────────────────────────────────────────────────────────────────────────
