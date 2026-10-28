# PassVault — cloud vault vs. device-only vault

## What happens after login

You sign in **online** to your regular account. The signed-in vault chooser displays your existing cloud vaults and a **Work offline** action.

- **Cloud path**: select a cloud vault, enter its original master password, and use the normal unlocked workspace. When **Cloud sync** is on, new vault edits are encrypted in your browser and uploaded using the existing Supabase revision-checked save flow. Turn **Cloud sync** off in **Overview**, **Settings → Encrypted backups**, or the account vault dashboard to prevent *future* vault uploads. Already uploaded records are not deleted. An upload already transmitted cannot be cancelled. When sync is re-enabled, outstanding local changes can be uploaded; the UI asks for confirmation.
- **Device-only path → Create new offline vault**: choose a vault name, master password, and any existing encryption options. It opens the **same** unlocked workspace but uses a never-cloud-saved, `device-`-prefixed vault ID, revision 0, and no cloud writes. The two-cloud-vault-per-account cap does not limit locally created vaults.
- **Device-only path → Import encrypted offline vault**: select a `.pvault.json` file and enter the master password (plus pepper if needed). This also uses a new `device-`-prefixed ID with no cloud revision. The import does not replace or overwrite a cloud vault.

**Device-only mode and the Cloud sync switch are different things.** Opening or creating a device-only vault does **not** flip your saved account-wide sync preference. The switch is disabled and clearly shows device-only mode while a device-only vault is unlocked; it becomes available again when you return to a cloud vault. Cloud save checks both the flag and a reserved local ID prefix; this prevents accidental promotion by the interface.

## Backup and sign-out safety

Your device-only vault or a cloud vault with sync switched off is **not autosaved into a file**. Edits are in unlocked browser memory until you export. A best-effort encrypted recovery checkpoint can be written on secure lock, but it depends on browser storage and is not a substitute for backups. To preserve your changes:

1. Select **Download encrypted backup** from Overview or Settings.
2. If the download does not start automatically (especially on iOS Safari), tap the newly shown **Save prepared encrypted backup file** link.
3. Confirm the file actually exists in your device's Files/Downloads. **Test re-import with a disposable vault before relying on the feature.** Store backups securely. Avoid sharing backups or master secrets.
4. Before voluntary sign-out **with unsynced edits**, a dialog requires an up-to-date encrypted backup to be prepared and your acknowledgment that you saved and verified it. Decline to keep working. Browser JavaScript cannot independently prove a file was downloaded or stored safely.

Automatic account inactivity timeout **still locks after 15 minutes**, even if the backup dialog was never completed. It attempts encrypted local recovery and clears unlocked secrets. Browser termination, local-storage failure, device loss, and quota/privacy settings can all cause unsaved edits to be lost. Export frequently and before manual lock, switching vaults, or closing the page.

## Privacy and network scope

**This is device-only vault storage, not a fully offline web application.** Account login, cloud vault listing, update checks, and other existing account/profile features can still contact Supabase; some profile data (such as a profile image when saved) is intentionally uploaded through those separate account features. The device-only promise applies to the encrypted **vault content** upload path. The site remains an online-only PWA; network outages can trigger the existing secure-lock behavior. Disabling sync does not remove previously uploaded vault data from the server. Do not rely on this flow to guarantee that *all* application network communication stops.

## Security and deployment

- No modifications were made to the Argon2id/AES-GCM vault format, backend schema, user authentication logic, KDF parameters, or provider access tokens.
- Existing vault cloud data is not migrated, overwritten, or deleted by selecting device-only mode. The file parser performs existing size/format/safe-URL validation, and decryption stays local.
- Cloud uploads check account sync status, device-only flag, reserved ID prefix, account/epoch/selection, and server revision. An already transmitted cloud request cannot be undone.
- Run `npm ci`, `npm run test:device-only`, `npm run test:offline-flow`, all regression tests, `npm run build`, and `npm run verify` before deploying.
- Upload the **contents of `passvault-main/`** into the GitHub repository root, preserving `.github/`, `src/`, `tools/`, and `package-lock.json`. Do **not** upload the ZIP as a file inside the public website. Deploy from a feature branch with a real-device test first.
- Use disposable test vaults for testing imports, creation, signing out, exporting after edits, disabled sync, interrupted uploads, and restore on mobile Safari/Chrome and desktop before keeping real credentials.

These changes are not an independent penetration test or a security audit. A browser-side feature alone cannot guarantee protection against malicious extensions, a compromised browser, a replaced site deployment, or a compromised device.
