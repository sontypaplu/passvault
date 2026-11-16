# Ciphora 4.0 — offline install, encryption and recovery

## What changed

Ciphora is the renamed PassVault application. Existing `.pvault.json` backups, Argon2id parameters, AES-256-GCM envelopes, Supabase project identifiers, internal storage namespaces and authenticated-data string `PassVault:v2` are **not** migrated or renamed. This is intentional: those are security and compatibility boundaries, not user-facing branding.

The installable web application now has a **versioned service worker app-shell cache**. It contains public application code, self-hosted Supabase SDK, CSS, icons and the manifest only. The service worker **does not cache** Supabase/authentication responses, user vault data, password fields, exported encrypted files, account tokens or API requests. The first visit/install must finish successfully **online** before offline launching can be relied upon. A device must have previously opened the app online and saved an encrypted device vault. Clearing browser/site storage, uninstalling, low-storage eviction, or some private-browsing modes can remove the cached app and/or vaults.

The **Use on this device** option on the sign-in screen works without an account. It reads encrypted `.pvault.json`-compatible envelopes from IndexedDB under the current browser/PWA origin. A vault's label is not stored in plaintext; the chooser shows a generic on-device name with a short random ID suffix. User-provided credential plaintext, master passwords and derived encryption keys are not persisted. Device vaults always use `device-`-prefixed UUIDs, and cloud upload functions refuse this path even when the user has a separate signed-in account.

## Daily use

1. While online, visit the HTTPS GitHub Pages site, install Ciphora using your browser's Install control (or Add to Home Screen on iOS), and open it once to allow the service worker to finish installing.
2. Click **Use on this device** at sign-in (online or offline). Create a local vault or import an existing **encrypted** `.pvault.json` backup using the existing master password and optional pepper.
3. Ciphora encrypts changes and attempts to save each edited device vault into IndexedDB automatically. Check for the **SAVED ON DEVICE** status. If you see **LOCAL SAVE FAILED**, export an encrypted backup before leaving.
4. On subsequent offline starts, choose **Use on this device**, select the local encrypted vault and unlock using the **original master password** (and pepper if used). The app never stores that password in the browser.
5. Regularly **Download encrypted backup** and verify it exists in Downloads/Files; import the backup into another device when needed. Device vaults do **not** automatically sync across devices.

## Cloud vs device-only

- **Cloud vault:** requires an internet connection for account sign-in, remote vault listing and synchronization. Pausing cloud sync does **not** copy cloud data to IndexedDB or turn a cloud vault into a device vault. When cloud sync is paused, edits must be protected by exporting an encrypted backup.
- **On-device vault:** available offline on a supported installed PWA/browser after successful initial online caching. Stored only on the current browser/app storage partition; without an encrypted export it cannot be recovered from another device. The original cloud copy, if any, is not changed by an import into local mode.

## Security & limitations

- Offline vaults remain encrypted at rest with the **same authenticated AES-256-GCM + Argon2id** format and KDF settings as old exports. All ciphertext carries a fresh random nonce each time it is saved.
- IndexedDB saves are revision-checked inside a read/write transaction. If another tab modified a vault, the newer record is not silently overwritten; export a backup and reconcile manually. There is no cross-device conflict resolution for device-only vaults.
- When encryption, storage or quota fails, do not rely on a "saved" message: check the actual encrypted backup. The app cannot prove that a download finished.
- Web Crypto, IndexedDB, PWA/service-worker capabilities, and browser storage persistence vary by browser and platform. Opening the site by `file://`, private mode, or without HTTPS is not a valid installed-PWA test. A device may evict offline assets or stored records under storage pressure. **Offline availability cannot be guaranteed on every device.**
- The account's Supabase profile, password reset, verification and cloud sync require internet, even if the shell is cached.
- **Not a security certification.** The app still requires independent cryptographic, auth/RLS, browser-compatibility and recovery audits before storing valuable credentials.

## Mandatory release checks

1. `npm ci --ignore-scripts --no-audit --no-fund` (Node 22+).
2. `npm run verify:source`; `npm run test:security`; `npm run test:device-only`; `npm run test:local`; `npm run test:offline-flow`; `npm run test:pwa`; `npm run test:history`; `npm run test:recovery`; `npm run test:phase3`; `npm run test:xss`.
3. `npm run build`; deploy `dist/` through GitHub Actions. Never upload the raw repo ZIP as the published website.
4. On a disposable vault, confirm offline launch with network fully disabled **after successful online installation**, create/edit/local-save, close/reopen, unlock/restore, exporting backup, low-storage failure, and a second browser tab edit conflict.
5. Repeat desktop Chrome/Edge/Brave, Android Chrome installed app, and iPhone/iPad Safari Add to Home Screen. Verify the actual file exists after each backup. Test release update only while locked.
