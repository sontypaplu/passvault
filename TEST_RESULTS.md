# AVENLOCK 4.0 — executed source checks

All commands below completed with exit code 0 using Node.js v22.16.0 in the preparation environment:

| Check | Result |
| --- | --- |
| `node tools/test-security-hardening.mjs` | PASS |
| `node tools/test-device-only-sync.mjs` | PASS |
| `node tools/test-edit-history.mjs` | PASS |
| `node tools/test-phase1-recovery.mjs` | PASS |
| `node tools/test-phase3-experience.mjs` | PASS |
| `node tools/test-xss-hardening.mjs` | PASS |
| `node tools/test-ui-text-size.mjs` | PASS |
| `node tools/test-basket-navigation.mjs` | PASS |
| `node tools/test-offline-vault-flow.mjs` | PASS |
| `node tools/test-avenlock-local.mjs` | PASS |
| `node tools/test-avenlock-pwa.mjs` | PASS |
| `node tools/verify-source.mjs` | PASS (550 unique element IDs) |
| `node tools/verify-upgrade.mjs` | PASS (5 auth panels) |
| `node --check src/js/*.js` | PASS (individual syntax checks) |

**Not completed:** `npm run build` could not finish because the real pinned `@supabase/supabase-js` SDK was not installable in this environment (registry access unavailable), and interactive browser/device acceptance testing was blocked. The source has **no mock SDK included**. In a connected staging environment, run `npm ci && npm run build && npm run verify`, then follow every manual test in `AVENLOCK_UPGRADE_GUIDE.md` before handling real credentials. Static source tests are not substitutes for production testing or security assessment.
