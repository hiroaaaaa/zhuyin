import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
const dir = "dist";
const files = [];
async function walk(p) {
  for (const e of await readdir(p, { withFileTypes: true })) {
    const n = path.join(p, e.name);
    if (e.isDirectory()) await walk(n);
    else if (
      !e.name.endsWith(".map") &&
      !["sw.js", "offline-assets.json"].includes(e.name)
    ) {
      const data = await readFile(n);
      files.push({
        url: n.slice(dir.length + 1).replaceAll("\\", "/"),
        sha: createHash("sha256").update(data).digest("hex"),
      });
    }
  }
}
await walk(dir);
const version = createHash("sha256")
  .update(JSON.stringify(files))
  .digest("hex")
  .slice(0, 12);
const sw = `const ASSETS=${JSON.stringify(files)};const CACHE='zhuyin-adventure-'+${JSON.stringify(version)};const PREFIX='zhuyin-adventure-';
async function tell(data){for(const c of await self.clients.matchAll({includeUncontrolled:true}))c.postMessage(data);}
self.addEventListener('install',e=>e.waitUntil((async()=>{try{const c=await caches.open(CACHE);for(const f of ASSETS){const url=new URL(f.url,self.registration.scope);const r=await fetch(url,{cache:'reload'});if(!r.ok)throw Error('下載失敗');const bytes=await r.clone().arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==f.sha)throw Error('素材驗證失敗');await c.put(url,r);}await tell({type:'CACHE_READY'});if(!self.registration.active)await self.skipWaiting();}catch(err){await caches.delete(CACHE);await tell({type:'CACHE_ERROR'});throw err;}})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys())if(k.startsWith(PREFIX)&&k!==CACHE)await caches.delete(k);await self.clients.claim();await tell({type:'CACHE_READY'});})()));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();if(e.data?.type==='STATUS')e.waitUntil((async()=>{const c=await caches.open(CACHE);const complete=(await c.keys()).length===ASSETS.length;e.source?.postMessage({type:complete?'CACHE_READY':'CACHE_ERROR'});})());});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||!u.href.startsWith(self.registration.scope)||u.pathname.endsWith('/release.json'))return;e.respondWith((async()=>{const c=await caches.open(CACHE);const hit=await c.match(e.request,{ignoreSearch:true});if(hit)return hit;if(e.request.mode==='navigate')return(await c.match(new URL('index.html',self.registration.scope)))||fetch(e.request);return fetch(e.request);})());});`;
await writeFile(path.join(dir, "sw.js"), sw);
await writeFile(
  path.join(dir, "offline-assets.json"),
  JSON.stringify({ version, count: files.length, assets: files }, null, 2),
);
console.log("離線素材", files.length, "版本", version);
