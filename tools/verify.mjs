import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const htmlPath = join(dist, 'index.html');
if (!existsSync(htmlPath)) throw new Error('Build first: npm run build');
const html = readFileSync(htmlPath, 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
if (!csp) throw new Error('CSP missing');
if (csp.includes('unsafe-inline') || csp.includes('cdn.jsdelivr.net') || html.includes('style=')) throw new Error('Relaxed CSP or inline styling detected');
if (!csp.includes("script-src 'self' 'wasm-unsafe-eval'")) throw new Error('Script CSP mismatch');
if (!csp.includes('worker-src blob:')) throw new Error('Argon2id Blob worker is blocked');
if (html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)?.some(s => !s.includes('src='))) throw new Error('Inline executable script detected');
const files = [...html.matchAll(/(?:src|href)="(\.\/src\/[^\"]+)"/g)].map(m => m[1]);
for (const file of files) if (!existsSync(join(dist, file.split('?')[0]))) throw new Error(`Missing built file: ${file}`);
const sdkPath = join(dist, 'src/js/vendor/supabase.js');
if (!existsSync(sdkPath) || statSync(sdkPath).size < 20000) throw new Error('Local SDK missing or suspiciously small');
if (html.includes('https://cdn.') || html.includes('unpkg.com')) throw new Error('Remote executable asset found');
for (const file of ['manifest.webmanifest','app-version.json','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','src/js/pwa.js']) {
  if (!existsSync(join(dist,file))) throw new Error(`Missing PWA deployment asset: ${file}`);
}
const marker = JSON.parse(readFileSync(join(dist,'app-version.json'),'utf8'));
const manifest = JSON.parse(readFileSync(join(dist,'manifest.webmanifest'),'utf8'));
if (!/^[a-f0-9]{16}$/.test(marker.build) || !html.includes(`content="${marker.build}"`)) throw new Error('PWA release marker mismatch');
if (!html.includes(`src/js/pwa.js?pv=${marker.build}`)) throw new Error('PWA boot script is not versioned');
if (!manifest.icons.some(i=>i.sizes==='192x192') || !manifest.icons.some(i=>i.sizes==='512x512')) throw new Error('PWA install icons missing');
if (!csp.includes("manifest-src 'self'")) throw new Error('Manifest CSP missing');
console.log(`Static security checks passed (${files.length} local CSS/JS links; SDK self-hosted).`);
