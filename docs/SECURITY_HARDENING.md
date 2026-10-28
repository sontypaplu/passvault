# PassVault XSS and dependency hardening

## Scope
- Existing PassVault visual themes and vault encryption format are unchanged.
- User-controlled values in the approved dashboard are inserted with DOM APIs and `textContent`, not HTML parsing.
- Only `http:` and `https:` URLs without credentials are accepted on new edits. A backup with unsafe URL-typed data is rejected **before** replacing a cloud vault. Existing encrypted cloud vaults are not silently altered.
- Chromium Trusted Types are enforced through CSP. The sole named policy accepts only the newly-created Argon2 worker Blob URL; no HTML trust policy is created. Browsers without Trusted Types fall back to safe DOM APIs plus CSP.
- The Argon2 worker bootstrapping argument was updated for Trusted Types; **no cryptographic algorithms, KDF parameters, salts, or vault ciphertext formats were changed.**

## One-time lockfile preparation (REQUIRED before merging)

A legitimate `package-lock.json` is necessary for `npm ci`. **Do not manually invent integrity hashes or copy a lockfile from an unrelated project.**

On a computer with npm registry connectivity, in this project root run:

```sh
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
npm ci --ignore-scripts --no-audit --no-fund
npm run test:xss
npm run build
npm run verify
```

Review `package-lock.json`, commit it on your feature branch, then open your PR. Keep it updated in future dependency PRs.

**Alternative when npm is unavailable locally:** Upload the changed files to a new branch and open a PR against `main`. The `.github/workflows/generate-lockfile.yml` workflow runs on pull requests and produces a `passvault-package-lock` artifact under **Actions**. Download it and commit the contained `package-lock.json` at the repository root on the same PR branch. The workflow has read-only repository permissions and never uploads vault data. If GitHub does not run that workflow for your branch (repository policy), generate the file locally instead. **Do not merge before the lockfile has been committed.**

## Safety checks

Run all existing tests, `npm run test:xss`, then `npm run build && npm run verify` using the **real** installed Supabase SDK. Test unlock/relock on Chrome desktop and Android, because Trusted Types enforcement also affects worker construction. Use disposable accounts/vaults before deploying.

Rollback: revert the hardening commit if a browser unexpectedly blocks the encryption worker. Never disable CSP in production as a quick workaround. The existing encrypted data remains unchanged.
