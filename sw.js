// ================================================================
//  SERVICE WORKER — Pedidos MG v2.0
//  Cache dinámico de tiles dentro de 150km de la ubicación
//  del usuario, calculado UNA SOLA VEZ al primer login.
// ================================================================
const CACHE_TILES = 'pmg-tiles-v2';
const CACHE_APP   = 'pmg-app-v2';
const SW_VERSION  = '2.1.0';

self.addEventListener('install', event => {
    console.log('[SW] v' + SW_VERSION);
    self.skipWaiting();
    event.waitUntil(caches.open(CACHE_APP).then(() => {}));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_TILES && k !== CACHE_APP)
                    .map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    if (!event.request.url.includes('basemaps.cartocdn.com/light_all/')) return;
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(resp => {
                if (resp.ok) caches.open(CACHE_TILES).then(c => c.put(event.request, resp.clone()));
                return resp;
            }).catch(() => new Response(
                Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,0,0,0,12,73,68,65,84,8,215,99,216,216,216,0,0,0,4,0,1,169,241,158,125,0,0,0,0,73,69,78,68,174,66,96,130]).buffer,
                { headers: { 'Content-Type': 'image/png' } }
            ));
        })
    );
});

// Recibir coordenadas del usuario para cachear zona
const _handlers = {};
self.addEventListener('message', async event => {
    const msg = event.data;
    if (!msg) return;

    if (msg.tipo === 'BORRAR_CACHE_ZONA') {
        const c = await caches.open(CACHE_APP);
        await c.delete('pmg-zona-cacheada');
        console.log('[SW] Cache de zona reseteado');
        return;
    }

    if (msg.tipo !== 'CACHEAR_ZONA') return;

    const { lat, lng, radioKm = 150 } = msg;

    const appCache = await caches.open(CACHE_APP);
    const yaHecho = await appCache.match('pmg-zona-cacheada');
    if (yaHecho) {
        const data = await yaHecho.json();
        console.log('[SW] Zona ya cacheada:', data.fecha);
        self.clients.matchAll().then(cs => cs.forEach(c => c.postMessage({ tipo: 'CACHE_PROGRESO', estado: 'ya_hecho', data })));
        return;
    }

    const tiles = _calcTiles(lat, lng, radioKm, 5, 11);
    console.log('[SW] Descargando', tiles.length, 'tiles, radio', radioKm, 'km');

    const notify = (estado, extra = {}) =>
        self.clients.matchAll().then(cs =>
            cs.forEach(c => c.postMessage({ tipo: 'CACHE_PROGRESO', estado, ...extra }))
        );

    await notify('iniciando', { total: tiles.length });

    const cache = await caches.open(CACHE_TILES);
    let ok = 0, fail = 0;
    const BATCH = 8;

    for (let i = 0; i < tiles.length; i += BATCH) {
        const lote = tiles.slice(i, i + BATCH);
        await Promise.all(lote.map(async url => {
            try {
                if (await cache.match(url)) { ok++; return; }
                const resp = await fetch(url, { mode: 'cors' });
                if (resp.ok) { await cache.put(url, resp); ok++; } else fail++;
            } catch(_) { fail++; }
        }));

        if (i % 80 === 0) await notify('progreso', { pct: Math.round(i / tiles.length * 100), ok, total: tiles.length });
        if (i + BATCH < tiles.length) await new Promise(r => setTimeout(r, 120));
    }

    await appCache.put('pmg-zona-cacheada', new Response(JSON.stringify({
        lat, lng, radioKm, tiles: tiles.length, ok, fail,
        fecha: new Date().toISOString()
    }), { headers: { 'Content-Type': 'application/json' } }));

    await notify('completo', { pct: 100, ok, fail, total: tiles.length });
    console.log('[SW] Cache completo:', ok, 'OK,', fail, 'fallidos');
});

function _calcTiles(lat, lng, radioKm, zMin, zMax) {
    const urls = [], subs = ['a','b','c','d'];
    let idx = 0;
    for (let z = zMin; z <= zMax; z++) {
        const dLat = (radioKm / 111) * 1.1;
        const dLng = (radioKm / (111 * Math.cos(lat * Math.PI / 180))) * 1.1;
        const [x1, y2] = _ll2t(lat - dLat, lng - dLng, z);
        const [x2, y1] = _ll2t(lat + dLat, lng + dLng, z);
        for (let x = x1; x <= x2; x++)
            for (let y = y1; y <= y2; y++)
                urls.push(`https://${subs[idx++ % 4]}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`);
    }
    return urls;
}

function _ll2t(lat, lng, z) {
    const n = Math.pow(2, z);
    const x = Math.floor((lng + 180) / 360 * n);
    const r = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
    return [Math.max(0, Math.min(n-1, x)), Math.max(0, Math.min(n-1, y))];
}
