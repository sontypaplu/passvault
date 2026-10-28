# GitHub upload checklist — PassVault updated source

## Updating an existing PassVault repository

1. Save an encrypted backup of every existing vault before deploying changes. Use disposable data for initial tests.
2. Extract `PassVault_offline_workflow_GitHub_ready.zip` on your computer. Open the **`passvault-main/`** folder inside the extracted ZIP.
3. In your GitHub repository, create a separate branch, for example `feature/device-only-vaults`. Upload **the contents of that folder** into the repository root. Preserve relative paths: `index.html`, `.github/workflows/deploy-pages.yml`, `src/js/`, `src/css/`, `tools/`, `docs/`, `supabase/`, `package.json`, and `package-lock.json`. If using the GitHub website, hidden `.github` files may be easier to update with Git, GitHub's file editor, or GitHub Desktop.
4. Do **not** upload the ZIP itself as a public webpage, do not place exported `.pvault.json` data in the GitHub repository, and do not upload private service-role keys or master passwords.
5. Review the pull request and ensure GitHub Actions reports a green build. The deploy workflow installs Node.js 22, runs the vault/security/UI source tests (including `test:device-only` and `test:offline-flow`), builds `dist`, verifies it, then publishes GitHub Pages.
6. Test **online cloud unlock**, **device-only create**, **device-only import**, **cloud sync off/on**, **encrypted backup download**, and **sign-out confirmation** using disposable vaults on a real browser/device before merging into `main`.
7. Verify cloud vaults remain unchanged by a device-only session; verify no `save_multi_vault` request is made while device-only or sync-off. Previously transmitted requests and other account/profile requests are separate from the vault sync switch.

**If you already uploaded the previous assistant ZIP:** The optional `PassVault_offline_workflow_incremental.patch` covers only differences from `PassVault_mobile_device_only_update.zip` to this release. To apply the patch locally, run `git apply --check path/to/PassVault_offline_workflow_incremental.patch` from the repository root, then `git apply path/to/PassVault_offline_workflow_incremental.patch`. On GitHub web, prefer uploading the complete source instead of uploading the patch as a website asset.

## Commands to check in a development environment

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run verify:source
npm run test:device-only
npm run test:offline-flow
npm run test:security
npm run test:recovery
npm run test:history
npm run test:phase3
npm run test:pwa
npm run test:xss
node tools/test-basket-navigation.mjs
npm run build
npm run verify
```

`npm run build` requires the self-hosted Supabase SDK installed through `npm ci`. Device-only vaults are not a full offline PWA; read `docs/OFFLINE_VAULT_WORKFLOW.md` for data retention, account/network scope, and security caveats.
