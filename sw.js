/* Offline vrstva: vždy najprv čerstvá verzia zo siete (bez HTTP cache), offline záloha z pamäte. */
const C='prva-pomoc-v20';
const FILES=['./','./index.html','./app.js','./engine.js','./kb.js','./manifest.json','./icon-192.png','./icon-512.png','./apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(u=>new Request(u,{cache:'reload'})))));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET'||new URL(e.request.url).origin!==location.origin)return;
 /* slabý signál: ak sieť neodpovie do 3 s, použi uloženú verziu (nová sa stiahne na pozadí) */
 const fromCache=()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('./index.html'));
 const net=fetch(e.request.url,{cache:'no-store'}).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r});
 e.respondWith(new Promise(res=>{let done=false;
  const t=setTimeout(()=>fromCache().then(r=>{if(r&&!done){done=true;res(r)}}),3000);
  net.then(r=>{if(!done){done=true;clearTimeout(t);res(r)}}).catch(()=>{clearTimeout(t);fromCache().then(r=>{if(!done){done=true;res(r)}})});
 }));
});
