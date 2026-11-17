# AVENLOCK — independent offline vaults vs. account-based cloud vaults

## Independent device vault (AVENLOCK 4.0)

From sign-in select **Work offline**. When a cached application starts with no internet connection, AVENLOCK selects the device-vault workspace automatically. Local vaults use a synthetic local identity; no Supabase account is required. A device-vault card loads the existing encrypted envelope and prompts for its original master password and optional secret pepper. Unlocking/decryption occurs in the browser.

Create a new vault or import an existing `.pvault.json` encrypted backup. Every local vault is assigned a reserved `device-` ID, and its **encrypted** envelope is committed transactionally to IndexedDB after edits. The app stores the envelope, a storage revision and a timestamp — **not plaintext credentials or master secrets**. Each tab tracks the expected revision; if another tab has saved the vault, saving blocks with a conflict instead of overwriting.

An encrypted save must finish before manual lock/exit; on failure the vault stays open so the user can export a separate backup. Forced security locks may use the prior encrypted localStorage recovery checkpoint. Store backups independently; browser storage is not permanent or device-independent.

## Cloud vault

Cloud vaults remain account-scoped and require an online Supabase session. Existing Argon2id/AES-GCM encryption and server revision checks remain unchanged. Turning cloud sync off affects **future** encrypted uploads; an in-flight request may finish and older cloud copies are not deleted. A device-only vault can never be promoted into a cloud vault by toggling sync; import/export is explicit.

## Migration from older PassVault device-only mode

Older versions created account-associated local-only vaults whose content was kept in memory/manual encrypted exports/recovery checkpoints. Those are **not automatically migrated** to independent IndexedDB vaults. Before updating, export and verify each old device-only vault. In AVENLOCK, enter Work offline, import its encrypted file, unlock, and verify that the imported data was committed locally. The cryptographic format stays the same and credentials are never sent to the server by the independent local store.

## Critical distinctions

- Offline launch only works after one online installation and complete PWA caching on the same browser/origin.
- Cloud sign-in, email verification, password recovery, and cloud vault listing require internet.
- Clearing browser storage, uninstalling the browser, private/incognito sessions, or losing the device can erase device-only vaults even if autosave previously succeeded.
- Local IndexedDB is not a backup. Export and test restoration of encrypted `.pvault.json` files.

See `../AVENLOCK_UPGRADE_GUIDE.md` for full deployment and acceptance testing steps.
