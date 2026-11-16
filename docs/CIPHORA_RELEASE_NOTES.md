# Ciphora 4.0 implementation and migration notes

## Changes made

- Renamed visible product, HTML document titles, PWA manifest, Apple title, and installable PNG icon set to **Ciphora**.
- Redesigned login using a separated hero, prominent sign-in form, discrete account-creation action, header-level install control and dedicated no-account device-vault entry. Existing sign-up, reset and verification flows remain separate views.
- Enlarged the vault chooser with responsive two-column cards, expanded unlock form and separate create/import options, preserving the existing master-password flow.
- Replaced the online-only PWA block with a public static-cache service worker and update lifecycle. Cached assets are versioned by the build fingerprint; cloud API responses are never cached.
- Added encrypted IndexedDB persistence and revision guards for device-only vaults, including existing imports created in the signed-in device-only path.
- Simplified download messages while retaining the manual link for browsers which block downloads. Restored the broken checkmark glyph.
- Updated sync wording to distinguish cloud-pause, encrypted local auto-save, backups and offline account limits.
- Updated the runtime/package metadata to Node 22+ and Supabase 2.119.0.

## What was preserved to protect existing vaults

- `.pvault.json` export and authenticated-data (`PassVault:v2`) formats; no KDF, salt, AES, pepper or key migration.
- `passvault-*` existing local recovery keys, theme preferences, current logged-in Supabase sessions, database schema and Supabase publishable project configuration.
- Current account signup/sign-in and authentication APIs.

## Not done / limitations

- No changes to Supabase database or RLS policies were made. The profile/account features still require internet.
- On-device encrypted vaults are **not synchronized** across phones and computers. Import/export is the portability mechanism.
- No verified live deployment or device/browser matrix is included. A passing local source test is not an external security audit.
- External trademark clearance for the **Ciphora** name is not included; verify rights before public launch.

## GitHub upgrade procedure

Upload the **contents** of the project directory to a feature branch, preserving `.github/`, and open a PR. Do not directly replace the currently working `main` branch. GitHub Actions should run `npm ci` and produce `dist/` (including `sw.js`, `app-version.json` and the hashed public assets). Complete the checks in `CIPHORA_OFFLINE_GUIDE.md` on disposable data before production merge. Keep a separate encrypted vault backup and repository snapshot.

- Fixed the on-device vault dashboard primary creation button so it cannot accidentally enter the cloud-vault creation flow.
