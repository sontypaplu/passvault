# PassVault — Online-only PWA installation and updates

This change does **not** add a service worker, offline vault, browser CacheStorage, push notifications, or background sync. It does not change encryption, Supabase authentication, cloud save operations, vault metadata, or theme definitions.

## Deployment

1. Back up your current encrypted vault and test with disposable credentials before deploying.
2. Open a GitHub feature branch. Add all files in the supplied changed-files archive, preserving their paths.
3. Confirm the workflow `npm run test:pwa`, existing tests, `npm run build`, and `npm run verify` pass.
4. Merge into `main`. GitHub Pages will publish the build from `dist` with `manifest.webmanifest`, local icons, and `app-version.json`.
5. Verify the deployed HTTPS site has a **valid** `manifest.webmanifest` and `app-version.json` at the repository's root path. Do not upload the ZIP itself as a website file.

Use the **same** GitHub Pages URL for desktop and mobile installation. The manifest uses relative `start_url` and `scope` so it also works at `/your-repository/` on GitHub Pages. Installing a PWA does not put the vault master key in the installed app.

## Installing on devices

- **Windows / macOS / Linux (Chrome or Edge):** Visit the HTTPS site and use the browser's *Install app* control or menu. A shortcut opens a standalone application window.
- **Android Chrome:** Visit the HTTPS site and use *Install app* / *Add to Home Screen* in the browser menu.
- **iPhone / iPad:** Open the HTTPS site and use the Share menu, then *Add to Home Screen*. The exact wording varies by browser and iOS release. An in-page install prompt is not supported uniformly on iOS.
- **In PassVault:** Settings → Install & updates provides install guidance and, when the browser allows it, a native install prompt.

Installation depends on browser/OS support, secure HTTPS hosting, engagement checks, and user choice. It is not possible for a website to guarantee native-style install UI on every device.

## Safe release and update lifecycle

1. Every GitHub Pages build creates a deterministic 16-character release fingerprint from its HTML, bundled scripts, styles, icons, manifest, and self-hosted Supabase SDK.
2. Published HTML references project CSS and JS with that release fingerprint in a query parameter, reducing stale-asset mismatches on GitHub Pages. No user credentials or vault contents are used to generate this fingerprint.
3. The app fetches only `app-version.json` with `cache: no-store`, `credentials: omit`, and a cache-busting query, when opened, returned to, or manually checked. Updates are **not** installed automatically.
4. When a newer release is available, an unobtrusive notice appears. Settings → Install & updates also shows the release and offers **Lock & update**.
5. Pending encrypted edits, an in-flight save, a synchronization conflict, account recovery, or ongoing crypto work **block** the update. Complete these actions first. A clean unlocked vault requires confirmation and is locked before navigation to the new release. Any unfinished form fields are lost on a reload; users are warned.
6. A refresh URL requests a fresh root document on the same origin and retains no password-recovery query. If the new release is unreachable, the offline gate prevents sensitive UI access until connectivity returns.
7. A user who has installed PassVault can reopen it after a deployment. It checks the release on launch; there is no separate app store approval or installer package to distribute.

## Online-only security model

- No service worker is registered. No offline network interception or CacheStorage is added.
- An initial same-origin release check must succeed for a deployed page to be usable. The UI is covered during validation. If the device goes offline or the check fails, the application immediately covers the workspace and uses the existing secure-lock checkpoint for an unlocked vault.
- An encrypted local recovery checkpoint may still exist because **the original PassVault security design already supports it**. This feature does not add offline vault unlocking or plaintext persistence.
- Normal HTTP/browser caches can still retain public HTML or JavaScript files. This PWA intentionally avoids a separate persistent application shell cache and requires live connectivity for access. It cannot override browser OS policies, remove every cache, or guarantee that a compromised device is safe.
- Keep the GitHub repository, deployment permissions, and supply chain protected: a malicious JavaScript release can defeat browser-based encryption while the vault is unlocked.

## Verification checklist

- Test the deployed site over HTTPS on Android Chrome, iOS Safari, and a desktop Chrome/Edge browser.
- Confirm installation produces the PassVault icon and standalone display.
- Confirm normal unlock, encrypted sync, existing history, backup, and recycle behavior still work.
- Save/sync a disposable item, then deploy a change and check that **Check now** detects the new release and offers an update.
- Verify that a dirty vault and a cloud revision conflict **cannot** trigger the update.
- With all edits saved, accept the confirmation and verify the vault locks before the new release loads.
- Disable networking while unlocked; the overlay should hide secret content and lock the vault. Reconnect and confirm it remains locked and requires re-unlocking.
- Check devtools Application → Service Workers / Cache Storage: this release registers no service worker and creates no new application caches.

**Limitations:** Full real-device installation behavior and production authenticated end-to-end workflows require a live HTTPS deployment and supported devices. Local static/preview tests cannot replace those checks. GitHub Pages caching and deploy rollouts cannot be made perfectly atomic via app JavaScript alone; this solution reduces stale asset risks with build versioning and explicit update checks.
