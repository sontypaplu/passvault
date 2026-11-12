/* Inspect an actual, HTTPS-deployed PassVault. Run only against a site you own. */
import assert from 'node:assert/strict';
const raw = process.argv[2];
if (!raw) throw new Error('Usage: npm run verify:live -- https://your-actual-site.example/');
const site = new URL(raw);
assert.equal(site.protocol, 'https:', 'Production app MUST use HTTPS');
assert(!site.username && !site.password && !site.search && !site.hash, 'Use an HTTPS page URL without secrets, query or fragment');
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 12000);
try {
  const response = await fetch(site, {signal:controller.signal,redirect:'error',cache:'no-store'});
  assert.equal(response.status, 200, `Homepage HTTP status ${response.status}`);
  const headers = response.headers;
  const csp = headers.get('content-security-policy') ?? '';
  assert(csp.includes("frame-ancestors 'none'"), 'No server-enforced frame-ancestors protection');
  assert(/script-src\s+'self'/i.test(csp), 'Missing self-hosted script policy');
  assert(!csp.includes('unsafe-inline'), 'Unsafe inline script policy detected');
  assert(headers.get('x-frame-options')?.toUpperCase() === 'DENY', 'Missing frame-denial header');
  assert(headers.get('x-content-type-options')?.toLowerCase() === 'nosniff', 'Missing nosniff');
  assert(/^max-age=\d{5,}/i.test(headers.get('strict-transport-security')??''), 'Missing HSTS header');
  assert(headers.get('referrer-policy')?.includes('no-referrer'), 'Missing strict referrer policy');
  assert(headers.get('permissions-policy')?.includes('camera=()'), 'Missing restrictive permissions policy');
  const html = await response.text();
  const build = html.match(/name="passvault-build" content="([a-f0-9]{16})"/)?.[1];
  assert(build, 'Deployed page is not a production build');
  const release = new URL('./app-version.json', site);
  const versionResponse = await fetch(release, {signal:controller.signal,redirect:'error',cache:'no-store'});
  assert.equal(versionResponse.status, 200, `Release marker HTTP status ${versionResponse.status}`);
  const version = await versionResponse.json();
  assert.equal(version.build, build, 'Release marker does not match deployed HTML');
  assert.equal(version.onlineOnly, true, 'Deployed PWA contract differs');
  console.log(`Production HTTPS headers + matching release marker verified for ${site.origin}${site.pathname} (build ${build}).`);
} finally {clearTimeout(timer);}
