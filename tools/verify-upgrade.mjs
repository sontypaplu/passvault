// Upgrade-specific static gates; cloud authentication/RLS require deployment tests.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = new URL('../', import.meta.url);
const source = rel => readFileSync(new URL(rel,root),'utf8');
const html=source('index.html'),auth=source('src/js/auth-pages.js'),app=source('src/js/app.js'), premium=source('src/js/premium.js');
const pages=['signInPanel','signUpPanel','forgotPanel','verifyPanel','resetPanel'];
for(const id of pages)if(!html.includes(`id="${id}"`))throw new Error(`Auth panel missing: ${id}`);
for(const id of ['pv3NavBackdrop','pv3Lock','downloadVaultLink','pv3Sidebar','pv3SettingsBackup'])if(!html.includes(`id="${id}"`))throw new Error(`Missing security-sensitive UI: ${id}`);
for(const name of ['resetPasswordForEmail','auth.resend','auth.signUp','auth.updateUser','recoveryVerified'])if(!auth.includes(name))throw new Error(`Auth flow missing: ${name}`);
if(!app.includes('persistSession: true'))throw new Error('Auth session continuity not enabled');
if(!app.includes("event === 'PASSWORD_RECOVERY'"))throw new Error('Recovery callback interception missing');
for(const fragment of ['history.pushState','history','popstate','pvClearPremiumSecrets','pvCloseMobileNav','aria-current'])if(!premium.includes(fragment))throw new Error(`Navigation regression: ${fragment}`);
if(!source('src/js/vault.js').includes("phrase !== 'REPLACE'"))throw new Error('Backup overwrite explicit confirmation missing');
if(!html.includes("src/js/auth-pages.js"))throw new Error('Auth controller not loaded');
if(/<script\b(?![^>]*src=)/i.test(html))throw new Error('Inline scripts not allowed');
console.log(`PassVault upgrade static checks passed (${pages.length} independent auth panels).`);
