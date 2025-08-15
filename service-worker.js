// /pokesuri-calendar/service-worker.js
/* ポケスリカレンダー PWA SW */
const VERSION = 'v1.0.0';
const STATIC_CACHE = `static-${VERSION}`;
const BASE = '/pokesuri-calendar/';

/** 事前キャッシュ（必要に応じて追加/削除） */
const CORE_ASSETS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}manifest.json`,
  // 例: `${BASE}css/app.css`, `${BASE}js/app.js`
];

/** install: コア資産をキャッシュ */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

/** activate: 古いキャッシュを掃除 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('static-') && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/** fetch:
 *  - ナビゲーション(HTML)はネット優先→キャッシュ→最後にindex.html
 *  - 静的ファイル(CSS/JS/画像/フォント)はキャッシュ優先(更新は裏で)
 */
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 同一オリジンのみハンドル（CDN等は素通し）
  if (url.origin !== self.location.origin) return;

  // ナビゲーション（ルーティング対応）
  if (req.mode === 'navigate') {
    event.respondWith(networkFirstForPages(req));
    return;
  }

  // 静的アセットの拡張子
  const isAsset = /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|map)$/.test(
    url.pathname
  );
  if (isAsset) {
    event.respondWith(cacheFirstWithRevalidate(req));
  }

  // その他はデフォルト
  // （必要ならAPIを network-only / network-first に分岐）
});

/* ---- Strategies ---- */

// ページはネット優先
async function networkFirstForPages(req) {
  try {
    const fresh = await fetch(req);
    // 成功時はキャッシュ更新（同パスに保存）
    const cache = await caches.open(STATIC_CACHE);
    cache.put(req, fresh.clone());
    return fresh;
  } catch {
    // 失敗時はキャッシュ → さらにダメならindex.html
    const cached = await caches.match(req);
    return (
      cached ||
      (await caches.match(`${BASE}index.html`)) ||
      new Response('Offline', { status: 503, statusText: 'Offline' })
    );
  }
}

// アセットはキャッシュ優先（Stale-While-Revalidate風）
async function cacheFirstWithRevalidate(req) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req)
    .then((res) => {
      // 成功レスポンスのみキャッシュ更新
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await fetchPromise) || new Response('', { status: 504 });
}
