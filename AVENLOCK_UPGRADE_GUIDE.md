# AVENLOCK 4.0 — upgrade & security handoff

**Status:** Implemented source release for staging and review. This archive is **not a certified or penetration-tested production release**. The original working PassVault ZIP was left unchanged. Do not migrate real passwords until the installation, encryption, restore and offline acceptance tests below have been executed on the actual deployment with the real pinned SDK.

## What changed

- Rebranded the app name, manifest, installation icons, logo, sign-in and vault selection experience as **AVENLOCK**. The split-screen navy entry style follows the approved HTML preview; registration, recovery and installation have dedicated screen states. The previously approved **unlocked vault dashboard theme and appearance controls are retained**.
- Added independent **device-only workspace**, reachable from sign-in without an account and opened automatically when the browser reports offline. Previously created encrypted *device* vaults appear in a card chooser. Cloud vaults still require your account session and network access.
- Added a **versioned service worker** to the production build. The worker caches same-origin static HTML, CSS, JavaScript, icons and manifest, but **never caches cloud responses, API traffic, passwords, or vault records**. A PWA needs one initial online download and a completed service worker installation before it works disconnected.
- Added **encrypted IndexedDB persistence** for local vaults. Vault data is encrypted with the existing Argon2id/AES-GCM envelope before the local transaction commits. User data, passwords, peppers and keys are never written as plaintext to IndexedDB by the new storage module. Local edits autosave; locking and exit require the write to complete. A conflicting change in another tab blocks overwriting instead of silently losing edits.
- Existing account-based cloud vaults, their Supabase account scopes, database schema, sync setting and cryptographic format are left in place. Device vault IDs have a reserved `device-` prefix; uploading them via the cloud save function remains blocked.
- The repeated download-backup prompts are removed from normal **successfully saved device-only editing**; critical save failures and revision conflicts still show warnings. Encrypted export and the manual-download fallback remain available.

## Important storage rules

1. **Device vaults remain on the device and browser origin where created.** Data will not automatically appear on another browser, computer, phone, account or hosting address. Clearing website data, reinstalling a browser, using private browsing, or device failure can destroy that copy. `navigator.storage.persist()` is best effort, not a guarantee.
2. **Export an independent `.pvault.json` encrypted backup and test its restore** before relying on a local vault. Keep the master password and any secret pepper available separately. AVENLOCK cannot recover a forgotten master password.
3. **Old PassVault device-only vaults are not silently migrated** into the new independent device-vault store. On the old version, export each device-only vault first, then enter the new AVENLOCK offline workspace, import its `.pvault.json` and verify it unlocks. Account-associated encrypted recovery checkpoints remain account-scoped, not automatically promoted into independent device vaults.
4. **Cloud data stays on the existing Supabase project.** Rebranding does not migrate or erase it. A cloud vault cannot be opened for the first time entirely offline; only independently stored device vaults can.
5. Keep the existing deployment hostname/origin if you expect browser-local data to remain accessible. A staging hostname is a separate origin and will have its own empty IndexedDB store.
6. New local-vault names shown in the locked chooser are deliberately generic. Revealing their original names before unlocking would require storing extra plaintext metadata outside the encrypted envelope.

## How to deploy safely

Prerequisites: Node.js 20+, npm registry connectivity, an HTTPS origin (GitHub Pages is supported), and the original Supabase project URL and public `sb_publishable_...` key in `src/js/config.js` for optional cloud accounts. Never include a Supabase `service_role` or `sb_secret_` key in browser code.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify:source
npm run test:security
npm run test:device-only
npm run test:offline-flow
npm run test:local
npm run test:pwa
npm run test:history
npm run test:recovery
npm run test:phase3
npm run test:xss
npm run build
npm run verify
```

For additional parity, run `node tools/test-ui-text-size.mjs`, `node tools/test-basket-navigation.mjs`, and `npm run verify:upgrade`. **Do not use `src/js/vendor/supabase.js` from a local mock.** The production build obtains the real pinned SDK from `node_modules` and embeds it into `dist`. Deploy **only `dist/`** (the included GitHub Actions workflow does this after passing checks). Deploy from a feature/staging branch before replacing the current production release.

## Manual release-blocking acceptance checklist

- [ ] Online sign-in, sign-up, email verification, reset, logout and session expiry work with a **test** Supabase account.
- [ ] Cloud vault creation, upload, open, edit, conflict detection and restore continue to work, without modifying existing encrypted data or RLS configuration.
- [ ] Desktop and mobile login, registration, installer, offline and chooser screens match the approved AVENLOCK concept. Existing workspace **light/dark theme** remains unchanged.
- [ ] Install once online on Chrome, Edge, Android and iOS/Safari where available; confirm the correct branded icon and that the app shell is fully cached.
- [ ] Disable networking, **close the app and reopen it**. The device-vault chooser loads without cloud authentication. Create or open a test device vault, edit a test item, lock, quit, reopen offline, unlock, and verify the saved edit.
- [ ] With connectivity restored, verify a device vault is not uploaded to Supabase and cloud vault login still works separately.
- [ ] Open two tabs, edit the same encrypted local vault in each, and verify a **conflict warning** rather than silent overwrite.
- [ ] Simulate blocked/quota-exhausted IndexedDB writes. The app must not claim 'saved' and must preserve safe encrypted export instructions.
- [ ] Verify actual `.pvault.json` backup download, fallback link, password/pepper unlock, integrity verification, and restored items on a second test device.
- [ ] Verify manual lock, idle lock, page refresh, interrupted network, update and account sign-out never discard confirmed unsaved data without warning.
- [ ] Inspect network traffic: no plaintext secrets are transmitted, and service worker Cache Storage contains only static application files.
- [ ] Check mobile focus order, screen-reader labels, keyboard access, and browser console/CSP errors.

## Verification limits of this handoff

Source-level security, compatibility and offline storage regression tests passed in the authoring environment. **A complete production build using the real pinned Supabase SDK and interactive browser/device acceptance tests could not be completed there because package download and browser access were unavailable.** Treat this as a staging candidate, not a declaration of production readiness. External vulnerability assessment is still recommended for a password manager.

Rollback: Preserve the original ZIP, existing database and encrypted backups. If problems appear on staging, revert the deployment. Never delete a working browser's website data during rollback. This upgrade deliberately does not change the vault encryption/AAD format.
