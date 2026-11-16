/* Ciphora app shell: immutable public assets only. Never cache API/auth traffic,
 * vault content, requests with Authorization, or encryption export files. */
'use strict';
const BUILD = '__CIPHORA_BUILD__';
const SHELL = 'ciphora-shell-' + BUILD;
const ROOT = new URL('./', self.location.href);
const STATIC_FILES = __CIPHORA_FILES__;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(STATIC_FILES.map(path => new URL(path, ROOT).href));
    // Existing active clients are never forcibly reloaded with unsaved changes.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys=await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('ciphora-shell-') && key !== SHELL).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'CIPHORA_ACTIVATE') void self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if (request.method !== 'GET' || request.headers.has('Authorization')) return;
  const url=new URL(request.url);
  if (url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (url.pathname.endsWith('/app-version.json') || url.pathname.endsWith('/sw.js')) return;
  if (request.mode === 'navigate') {
    event.respondWith((async()=>{
      try {
        const reply=await fetch(request);
        if(reply.ok) return reply;
      }catch{}
      return await caches.match(new URL('./', ROOT).href) ||
        await caches.match(new URL('./index.html',ROOT).href) ||
        Response.error();
    })());
    return;
  }
  // Only fetch cacheable, known app-shell assets. Do not cache dynamically
  // requested URLs, API results, data blobs, or user content.
  const supported = STATIC_FILES.some(path=>new URL(path,ROOT).href===request.url);
  if(!supported) return;
  event.respondWith((async()=>{
    const hit=await caches.match(request);
    if(hit)return hit;
    const response=await fetch(request);
    return response;
  })());
});
