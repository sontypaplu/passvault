# PassVault UI revision — based strictly on original ZIP

**Base:** User-supplied `passvault-main.zip` (PassVault 3.1). **Not based on:** any Ciphora-generated ZIP. This revision is intentionally limited to the approved layout and copy changes, with no renaming or palette changes.

## Changed files

1. `index.html` — separated installation from authentication, moved account creation into a quiet sign-in footer link, improved left-side security benefit layout, replaced the compact vault-chooser layout with a full-screen access experience. Retained every existing authentication, vault-management, and password input ID and the accessible dialog focus gate.
2. `src/css/access-redesign.css` — new scoped responsive UI styles for sign-in and vault selection. Uses only existing PassVault light/dark theme variables; no theme tokens modified.
3. `src/css/approved.css` — repaired malformed checkmark character `âœ“` to `✓` (visual encoding only).
4. `src/js/approved.js` — renders vault chooser tiles using the existing safe SVG lock icon and toggles presentation-only mode classes. Does not alter the auth, encryption, or vault handlers.
5. `src/js/vault.js` — shortens repetitive backup download notification. Does not change encrypted export or the manual fallback link.

## Explicitly unchanged

- Encryption and key derivation, vault and backup format, Supabase account authentication, database migrations, cloud synchronization, PWA behavior, storage, original application icons, brand name, and light/dark theme palettes.
- All other scripts, including `src/js/core.js`, `src/js/cloud.js`, `src/js/auth-pages.js`, `src/js/pwa.js`, `src/js/config.js` and `tools/build.mjs`.

## Important offline limitation

This patch is **not an offline-PWA implementation**. The original source deliberately starts only with a verified network connection and has no service worker. Device-only vaults remain encrypted and separate from cloud data, but users still must export encrypted backups and cannot rely on restarting the installed app completely offline. Reliable offline storage requires a separate, security-reviewed service worker plus encrypted persistent local storage and recovery testing. Do not advertise full offline operation from this patch.

## Validation

- `verify-source`, `verify-upgrade`, `verify` passed.
- Regression suites passed: security, device-only separation, history, recovery, experience, online-PWA, XSS, offline-vault workflow, UI text size and basket navigation.
- HTML structure validation passed with 546 unique element IDs.
- A source preview assembled using an existing locally cached SDK file, but full real-browser UI and live Supabase authentication could not be verified in this environment; browsers blocked navigation in the test runtime. GitHub Actions must independently perform a clean `npm ci`, production build, and deployment before release.

## Deployment checklist

1. Make a branch from your existing `main`, e.g. `passvault-ui-redesign`.
2. Replace only the files listed under **Changed files** using the files from this ZIP.
3. Confirm `.github/workflows/deploy-pages.yml` runs the existing regression suite and builds successfully with a clean npm installation.
4. Use a disposable account and vault to check sign-in, registration, vault chooser, unlock, download, manually saved backup recovery, mobile responsiveness, and dark/light mode.
5. Check a real device and encrypted backup before production merge; preserve a rollback branch.
