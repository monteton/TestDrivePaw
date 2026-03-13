const CACHE_NAME = 'fitflow-pwa-v1';
const EXPIRY_DATE = new Date('2026-12-31T00:00:00').getTime(); // 31 декабря 2026

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // НЕ кешируй видео с BotHelp
    if (url.hostname.includes('bothelp')) {
        return;
    }

    event.respondWith(
        (async () => {
            const now = Date.now();

            // Проверка: прошло ли время блокировки
            if (now >= EXPIRY_DATE) {
                return new Response(
                    `<!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Марафон завершён</title>
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
              h1 {
                font-size: 2.5rem;
                margin: 0 0 1rem;
                animation: fadeIn 1s ease-out;
              }
              p {
                font-size: 1.2rem;
                opacity: 0.9;
                line-height: 1.6;
                animation: fadeIn 1.5s ease-out;
              }
              .emoji {
                font-size: 4rem;
                margin-bottom: 1rem;
                animation: bounce 2s infinite;
              }
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
              @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-20px); }
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="emoji">🎉</div>
              <h1>Поздравляем!</h1>
              <p>Вы успешно завершили марафон!</p>
              <p style="font-size: 0.9rem; margin-top: 2rem; opacity: 0.7;">
                Доступ закрыт 31 декабря 2026
              </p>
            </div>
          </body>
          </html>`,
                    {
                        status: 403,
                        headers: { 'Content-Type': 'text/html; charset=utf-8' }
                    }
                );
            }

            // До истечения срока — работай нормально
            try {
                const response = await fetch(event.request);
                if (response.status === 200 && event.request.method === 'GET') {
                    const responseClone = response.clone();
                    const cache = await caches.open(CACHE_NAME);
                    cache.put(event.request, responseClone);
                }
                return response;
            } catch (error) {
                const cached = await caches.match(event.request);
                if (cached) return cached;
                throw error;
            }
        })()
    );
});
