# Ciphora 4.0 — validation and release checklist

This is a **source-code update**, not a claim of a live deployment or an independent security audit.

## Completed static and Node.js regression checks

Tests passed on the source tree using Node.js 22:

- `npm run verify:source`: 547 unique HTML IDs; required sources and assets.
- `npm run test:security`: encrypted checkpoints, inactivity locks, storage failures and recovery handling.
- `npm run test:device-only`: device-only isolation from cloud uploads and sync preference.
- `npm run test:offline-flow`: local creation/import, cloud isolation, dashboard creation path and backup-exit behavior.
- `npm run test:local`: authenticated ciphertext-only IndexedDB storage and revision conflicts.
- `npm run test:pwa`: offline app-shell cache, manifest, install/update behavior.
- `npm run test:history`: encrypted version history compatibility.
- `npm run test:recovery`: encrypted backup/recovery compatibility.
- `npm run test:phase3`: vault data/schema and UI flows.
- `npm run test:xss`: HTML sink, imported URL and CSP safeguards.

## Not verified in this environment

- `npm ci` was not completed because npm package retrieval did not complete in this environment. The final build, with the real self-hosted Supabase SDK, needs to run in GitHub Actions (as the updated workflow configures).
- A headless Chromium browser smoke test was attempted, but navigation was blocked by the environment's administrator policy. This is **not** a verified browser test.
- Live Supabase login, sign-up, email recovery and RLS policies were not tested against an account.
- Mobile Safari/Android installed PWA behavior, filesystem download completion, offline cold starts and multi-tab conflicts need device-level acceptance testing.

## Must verify before enabling for real credentials

1. Preserve the working `main` and save an encrypted `.pvault.json` backup.
2. Open a feature-branch pull request and verify the **Build and deploy Ciphora** workflow builds `dist/` using the real npm dependency. Do not upload the preview SDK stub as a real deployment.
3. On a test account and **disposable test vault**, test sign-in and sign-out, create, edit, unlock, cloud save, logout, password reset and recovery.
4. With internet ON, open Ciphora at the HTTPS site, install the app and reload to let the service worker fully activate.
5. Create **Use on this device** vault, edit an item, wait for **SAVED ON DEVICE**, lock and reopen, then disable internet and restart the installed app. Confirm unlock and edits still work.
6. Repeat on desktop Chrome/Edge/Brave, Android Chrome installed app and iPhone/iPad Safari Add to Home Screen.
7. Export a backup, confirm the file actually exists, and test import into a separate browser/profile with the known master password.
8. Test storage denied/quota failures, old PassVault v2 backups, other-tab conflict detection and update/reload behavior while locked.
9. Commission independent security review and verify trademark rights to **Ciphora** before public distribution.

## Platform limitations

Offline use applies to **encrypted on-device vaults after a successful initial online visit/install**. Cloud account sign-in, profile, password reset and sync still need connectivity. On-device vaults do not sync automatically across devices. Browser storage can be evicted or removed by the OS/user, so encrypted exports are essential. No web application can guarantee install/offline persistence on literally every phone or computer.
