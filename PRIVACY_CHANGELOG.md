# AVENLOCK / PassVault — history visibility and private website marks

Updated: 17 November 2026. This is a **source-only feature update**. The existing encrypted vault schema, history storage, authentication, Supabase integration and encryption functions were not changed.

## 1. History display

- While the vault is unlocked, usernames, websites, ordinary notes, payment-card details (including card numbers and security codes), tags, favorites and custom fields show directly in the history table. Long values, including secure-note content, no longer require another click to read.
- **Login passwords are the only masked history field.** They initially show bullets and a Reveal button; Hide masks them again. Passwords are not inserted into the history table's DOM until Reveal is clicked.
- The same `password` property represents login passwords, secure-note content and payment-card numbers in the existing schema. Masking is therefore conditional on the historical item's `kind` rather than only the property name. This preserves the original encrypted data format.
- `—` in history still means a field was not changed in that event; it is not an eye-button mask. History's existing older-change pagination is unchanged.
- Locking or closing history continues to clear the displayed data.

**Visibility warning:** Card numbers, security codes and secure notes are intentionally visible when reviewing unlocked history. Anyone viewing the unlocked screen can read them. The existing session lock remains important.

## 2. Private website icons

- `src/js/service-icons.js` is a completely local, closed icon catalog. It parses saved URL hostnames and draws known marks using the browser's SVG DOM APIs and fixed strings. `src/css/service-icons.css` provides local styling.
- For recognized logins, icons now appear in **overview baskets, all-items tables and the alternate item list**. It supports bare domains (such as `instagram.com`) as well as complete `http://` and `https://` addresses.
- Included brands/domains cover Instagram, Kotak Mahindra Bank, YouTube, Google/Gmail, Facebook, WhatsApp, Amazon, Flipkart, GitHub, LinkedIn, Microsoft/Outlook, Apple, Netflix, PayPal, X/Twitter, Reddit, Telegram, OpenAI/ChatGPT, HDFC Bank, SBI, ICICI Bank and Axis Bank. Additional variants and subdomains are mapped for some services.
- Unknown hostnames use the previous initial-based fallback. **A universal authentic website logo is not technically possible without a complete local catalog, a manually supplied image, or a network lookup.** We deliberately disable network lookups to protect privacy.
- The icon resolver performs **zero network requests** (no Google Favicon, Clearbit, logo.dev, CDN, webpage requests or telemetry). Nothing from the saved URL, path, username, password, vault, or item title is sent to an icon provider. No new vault metadata, network permissions or service workers were added. Existing CSP restrictions still block third-party image requests.
- Website logos are decorative; a displayed logo is not verification that a login page is legitimate. The parser checks URL schemes and host boundaries to prevent obvious lookalike matches such as `instagram.com.attacker.example`.
- Offline PWA builds can cache these local code and stylesheet assets automatically through the existing build. No additional runtime dependency is needed.

## 3. Existing cloud operation is distinct

- **This change does not make cloud mode network-free.** The pre-existing online account and optional encrypted cloud synchronization still communicate with the configured Supabase backend, subject to the app's original behavior and settings. Device-only mode follows its existing offline design. The privacy claim above is specific to **icon selection**, not a full network-security audit of all PassVault functions.

## 4. Files updated

| File | Purpose |
|---|---|
| `src/js/history-ui.js` | Display all non-login-password history fields by default |
| `src/js/service-icons.js` | Local-only URL-to-brand resolver and SVG renderer (new) |
| `src/css/service-icons.css` | Local logo backgrounds and sizing (new) |
| `src/js/approved.js` | Render website icons in table and basket tiles |
| `src/js/premium.js` | Render website icons in alternate list |
| `index.html` | Load icon assets and explain history visibility |
| `tools/test-private-service-icons.mjs` | Domain spoofing, privacy and icon checks (new) |
| `tools/test-history-visibility.mjs` | Password-masking and history visibility tests (new) |
| `README.md` | Changelog link |

## 5. Verification and deployment notes

- Both new Node.js tests pass; original XSS-hardening, history, security-hardening and other current regression tests pass. In total, **13 of the 16 `tools/test-*.mjs` scripts pass**. Three older tests (`test-local-encrypted-store.mjs`, `test-offline-pwa.mjs`, `test-online-pwa.mjs`) fail in **both** the original ZIP and the modified source with the same errors; they are known pre-existing baseline failures, not introduced by this update.
- A separate real Chromium smoke test verified the history Reveal/Hide flow and locked cleanup. Another Chromium smoke test rendered 25 icon examples with no JavaScript errors or network requests. These are targeted tests, **not** a comprehensive security certification.
- The local environment could not download a missing npm dependency offline, so a complete compiled `dist/` production build **was not generated or verified**. In an environment with access to your registry, run `npm ci` then `npm run build` (or use the repository's existing GitHub Actions build). Publish the resulting `dist/` only. Do not deploy unbuilt source or a mocked SDK.
- **Before updating a live password manager**, export and verify an encrypted vault backup, test both online and device-only vaults on a staging installation and confirm lock, restart, restore and cloud sync behavior with non-production test data.
