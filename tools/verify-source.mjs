import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root,'index.html'),'utf8');
const premium = readFileSync(join(root,'src/js/premium.js'),'utf8');
const js = readFileSync(join(root,'src/js/core.js'),'utf8');
const sql = readFileSync(join(root,'supabase/migrations/003_two_vault_cap.sql'),'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
if(new Set(ids).size !== ids.length) throw new Error('Duplicate HTML element id detected');
for (const id of ['premiumApp','pv3View-overview','pv3View-items','pv3View-favorites','pv3View-security','pv3View-generator','pv3View-settings','pv3ItemDialog','pv3DetailDialog','legacyWorkspace','credentialForm','vaultDashboardScreen','deleteDialog']) {
  if(!ids.includes(id)) throw new Error(`Missing compatible UI element ${id}`);
}
for(const path of ['./src/css/main.css','./src/css/premium.css','./src/js/premium.js','./src/js/core.js','./src/js/cloud.js','./src/js/vault.js']) {
  if(!existsSync(join(root,path))) throw new Error(`Missing ${path}`);
}
if(!/vault_limit_reached/.test(sql) || !/pg_advisory_xact_lock/.test(sql) || !/BEFORE INSERT/.test(sql)) throw new Error('Vault limit SQL guard missing');
if(!premium.includes('saveCloudVault(true)') || !premium.includes('state.vault.credentials') || !js.includes('validateVaultPlaintext')) throw new Error('Expected encrypted vault integration missing');
if(/<script\b(?![^>]*\bsrc=)/i.test(html)) throw new Error('Inline script is forbidden');
if(html.includes('cdn.jsdelivr.net') || html.includes('style=')) throw new Error('External CDN or inline styles found');
if(!/script-src 'self' 'wasm-unsafe-eval'/.test(html) || !/worker-src blob:/.test(html)) throw new Error('Encryption worker CSP not preserved');
console.log(`PassVault 3.1 source checks passed (${ids.length} unique ids).`);
