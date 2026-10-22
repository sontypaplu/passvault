import { readFileSync, writeFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const config = readFileSync(join(root, 'src/js/config.js'), 'utf8');
const url = config.match(/\burl:\s*["']([^"']+)["']/)?.[1];
const key = config.match(/\bpublishableKey:\s*["']([^"']+)["']/)?.[1];
const validUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url ?? '');
const validKey = /^sb_publishable_[A-Za-z0-9_-]{6,}$/.test(key ?? '') && !key.includes('REPLACE');
if (production && (!validUrl || !validKey)) {
  throw new Error('Set the real Supabase Project URL and publishable key in src/js/config.js before deployment. Never use a secret/service_role key.');
}
if (/(\bsb_secret_|\bservice_role(?:\s*[:=]))/i.test(key ?? '')) {
  throw new Error('A privileged key must never be included in browser files.');
}
const sdk = join(root, 'node_modules/@supabase/supabase-js/dist/umd/supabase.js');
let sdkBytes;
try { sdkBytes = readFileSync(sdk); }
catch { throw new Error('Supabase UMD dependency missing: run npm install before building.'); }
if (sdkBytes.length < 20000) throw new Error('Supabase SDK unexpectedly small; refusing to publish.');

const target = join(root, 'dist');
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(join(root, 'src'), join(target, 'src'), { recursive: true });
mkdirSync(join(target, 'src/js/vendor'), { recursive: true });
writeFileSync(join(target, 'src/js/vendor/supabase.js'), sdkBytes);
let html = readFileSync(join(root, 'index.html'), 'utf8');
if (!html.includes('src/js/vendor/supabase.js') || html.includes('cdn.jsdelivr.net')) {
  throw new Error('HTML is not using the self-hosted SDK.');
}
// Specialize the CSP to your own Supabase project during the publish build.
// This does not inline executable JS or put privileged credentials in the site.
if (validUrl) {
  const origin = new URL(url).origin;
  const wssOrigin = origin.replace(/^https:/, 'wss:');
  html = html.replace('https://*.supabase.co wss://*.supabase.co', `${origin} ${wssOrigin}`);
}
writeFileSync(join(target, 'index.html'), html, 'utf8');
const digest = createHash('sha256').update(sdkBytes).digest('hex');
writeFileSync(join(target, 'DEPENDENCY_INFO.txt'), `Supabase JS 2.117.3 (self-hosted from npm package)\nSHA-256: ${digest}\n`, 'utf8');
console.log(`Built ${target} | SDK SHA-256 ${digest} | CSP ${validUrl ? 'project-scoped' : 'preview-only'}`);
