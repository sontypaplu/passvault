# AVENLOCK — offline PWA installation, releases, and updates

AVENLOCK 4.0 can load **existing device-only vaults offline** after the app shell has been installed/cached over an internet connection. No Supabase authentication is required for independent device vaults. **Cloud vaults still require an online account session.**

## Install

On HTTPS hosting, open the deployed application while online and complete the browser's **Install app** action, or on iOS Safari choose **Share → Add to Home Screen**. Wait for the app shell to finish caching before disconnecting. A web app cannot open from scratch on a device that has never visited/installed it. The browser may suppress install prompts based on its own policies; the install guide remains available inside AVENLOCK.

The release build uses `tools/build.mjs` to generate `dist/sw.js`, `dist/app-version.json`, and versioned local asset URLs. Only public same-origin static resources are cached; Supabase responses, vault contents, secrets, and authentication/session requests are excluded. Encrypted vault content is stored separately in IndexedDB by `src/js/local-vault.js`, not Cache Storage.

## Updates

AVENLOCK checks a public release marker when online and when the app becomes active. Offline/unreachable update endpoints **never prevent opening a local vault**. A new version must not silently reload an unlocked vault. Manual update blocks when unsafe, waits for device-only encrypted writes to flush, and locks before navigating. Since service worker lifecycle/update timing differs by browser, test updates across real installed devices. Back up important device vaults before upgrades.

## Deployment and origin

Use `npm ci`, all tests, `npm run build`, `npm run verify`, then deploy the generated `dist/` folder to HTTPS. Do not deploy raw source as a finished app or use a fake local Supabase SDK. A different domain/subdomain has different storage: local vaults do not move across origins. The project CSP allows local service workers (`worker-src 'self' blob:`) and retains its Argon2id worker policy.

See `AVENLOCK_UPGRADE_GUIDE.md` for the release-blocking manual acceptance checklist.
