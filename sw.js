const CACHE_NAME = 'fitflow-pwa-v1';
const MAX_DAYS = 180; // Доступ на 180 дней с первого визита

// ===== IndexedDB helpers =====
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fitflow-db', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('meta');
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(db, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readonly');
    const req = tx.objectStore('meta').get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbSet(db, key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('meta', 'readwrite');
    tx.objectStore('meta').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ===== Expiry page =====
function makeExpiryPage(firstVisit) {
  const expiredDate = new Date(firstVisit + MAX_DAYS * 24 * 60 * 60 * 1000);
  const formatted = expiredDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  return new Response(
    `<!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Доступ завершён</title>
      <style>
        body {
          margin: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #c681f4 0%, #d38080 100%);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #fff;
        }
        .container {
          text-align: center;
          padding: 2rem;
          max-width: 500px;
        }
        .emoji { font-size: 4rem; margin-bottom: 1rem; animation: bounce 2s infinite; }
        h1 { font-size: 2rem; margin: 0 0 1rem; animation: fadeIn 1s ease-out; }
        p { font-size: 1.1rem; opacity: 0.9; line-height: 1.6; animation: fadeIn 1.5s ease-out; }
        .date { font-size: 0.85rem; margin-top: 2rem; opacity: 0.65; }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="emoji">🎉</div>
        <h1>Поздравляем!</h1>
        <p>Ваш 180-дневный доступ завершён.<br>Вы прошли весь курс!</p>
        <p class="date">Доступ был открыт до ${formatted}</p>
      </div>
    </body>
    </html>`,
    {
      status: 403,
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }
  );
}

// ===== Service Worker lifecycle =====
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

// ===== Fetch handler =====
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Не кешируем видео с BotHelp
  if (url.hostname.includes('bothelp')) return;

  event.respondWith(
    (async () => {
      const db = await openDB();

      // Считываем дату первого визита
      let firstVisit = await dbGet(db, 'firstVisit');

      // Если ещё не было — запоминаем сегодня
      if (!firstVisit) {
        firstVisit = Date.now();
        await dbSet(db, 'firstVisit', firstVisit);
      }

      // Проверяем: прошло ли 180 дней?
      const daysPassed = (Date.now() - firstVisit) / (1000 * 60 * 60 * 24);
      if (daysPassed >= MAX_DAYS) {
        return makeExpiryPage(firstVisit);
      }

      // Ещё в пределах срока — работаем нормально
      try {
        const response = await fetch(event.request);
        if (response.status === 200 && event.request.method === 'GET') {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw new Error('Network error and no cache available');
      }
    })()
  );
});
