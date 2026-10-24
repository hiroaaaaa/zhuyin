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
  .update("service-worker-auto-activate-v2")
  .digest("hex")
  .slice(0, 12);
const sw = `const ASSETS=${JSON.stringify(files)};const CACHE='zhuyin-adventure-'+${JSON.stringify(version)};const PREFIX='zhuyin-adventure-';
async function tell(data){for(const c of await self.clients.matchAll({includeUncontrolled:true}))c.postMessage(data);}
self.addEventListener('install',e=>e.waitUntil((async()=>{try{const c=await caches.open(CACHE);let cursor=0;async function worker(){while(cursor<ASSETS.length){const f=ASSETS[cursor++],url=new URL(f.url,self.registration.scope);const r=await fetch(url,{cache:'reload'});if(!r.ok)throw Error('下載失敗 '+f.url);const bytes=await r.clone().arrayBuffer();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(hash!==f.sha)throw Error('素材驗證失敗 '+f.url);await c.put(url,r);}}await Promise.all(Array.from({length:Math.min(6,ASSETS.length)},()=>worker()));await tell({type:'CACHE_READY'});await self.skipWaiting();}catch(err){await caches.delete(CACHE);await tell({type:'CACHE_ERROR'});throw err;}})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{const obsolete=(await caches.keys()).filter(k=>k.startsWith(PREFIX)&&k!==CACHE);for(const k of obsolete)await caches.delete(k);await self.clients.claim();await tell({type:'CACHE_READY'});if(obsolete.length){for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true})){const hash=new URL(client.url).hash;if(client.url.startsWith(self.registration.scope)&&(!hash||hash==='#/'||hash==='#/parent')){try{await client.navigate(client.url)}catch{}}}}})()));
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting();if(e.data?.type==='STATUS')e.waitUntil((async()=>{const c=await caches.open(CACHE);const complete=(await c.keys()).length===ASSETS.length;e.source?.postMessage({type:complete?'CACHE_READY':'CACHE_ERROR'});})());});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||!u.href.startsWith(self.registration.scope)||u.pathname.endsWith('/release.json'))return;e.respondWith((async()=>{const c=await caches.open(CACHE);if(e.request.mode==='navigate'){try{const live=await fetch(e.request,{cache:'no-store'});if(live.ok){await c.put(new URL('index.html',self.registration.scope),live.clone());return live;}}catch{}return(await c.match(new URL('index.html',self.registration.scope)))||Response.error();}const hit=await c.match(e.request,{ignoreSearch:true});if(hit)return hit;const live=await fetch(e.request);if(live.ok)await c.put(e.request,live.clone());return live;})());});`;
await writeFile(path.join(dir, "sw.js"), sw);
await writeFile(
  path.join(dir, "offline-assets.json"),
  JSON.stringify({ version, count: files.length, assets: files }, null, 2),
);
console.log("離線素材", files.length, "版本", version);
