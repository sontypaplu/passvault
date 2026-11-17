# AVENLOCK 4.0

An encrypted vault manager with independent offline **device vaults** and existing online **Supabase cloud vaults**. This repository contains a staging-ready source upgrade from the original stable PassVault application. The previously approved unlocked workspace UI and encryption format remain intact; the AVENLOCK login, vault chooser, install workflow, name and icons follow the approved new design.

**Start with [AVENLOCK_UPGRADE_GUIDE.md](AVENLOCK_UPGRADE_GUIDE.md) before deployment.** The guide contains key-migration and backup warnings, step-by-step build commands, a release checklist and explicit verification limits.

For development with registry access: `npm ci`, `npm run test:local`, `npm run test:pwa`, `npm run build`, `npm run verify`. Deploy the generated `dist/` assets, not the unbuilt source files. Never use a mock Supabase SDK or privileged Supabase key in a deployed build.

## History visibility and offline website icons

See [PRIVACY_CHANGELOG.md](PRIVACY_CHANGELOG.md) for the history display policy, locally embedded brand-icon catalog, privacy boundaries and verification notes.
