// Service Worker para PWA de Horas Sindicales CCOO
// Estrategia: Network-First con fallback a caché

const CACHE_NAME = 'horas-sindicales-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
    '/icon.svg',
    '/generate-icons.html',
    'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'%3E%3Ccircle cx=\'50\' cy=\'50\' r=\'45\' fill=\'%23d32f2f\'/%3E%3Ctext x=\'50\' y=\'60\' font-size=\'30\' text-anchor=\'middle\' fill=\'white\' font-family=\'Arial, sans-serif\'%3ECCOO%3C/text%3E%3C/svg%3E'
];

// Instalación: Guardar assets en caché
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('Service Worker: Assets guardados en caché');
                return self.skipWaiting(); // Activar Service Worker inmediatamente
            })
            .catch((error) => {
                console.error('Service Worker: Error al instalar', error);
            })
    );
});

// Activación: Limpiar caches antiguos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Eliminando cache antiguo', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('Service Worker: Activado');
            return self.clients.claim(); // Controlar todos los clientes
        })
    );
});

// Fetch: Estrategia Network-First con fallback a caché
self.addEventListener('fetch', (event) => {
    // Solo manejar peticiones GET
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Si la red funciona, guardar en caché y devolver
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                }
                return response;
            })
            .catch((error) => {
                // Fallback a caché si la red falla
                return caches.match(event.request)
                    .then((response) => {
                        if (response) {
                            console.log('Service Worker: Usando caché para', event.request.url);
                            return response;
                        }
                        // Si no está en caché, devolver un mensaje de error
                        return new Response('<html><body><h1>Offline</h1><p>La aplicación funciona offline, pero este recurso no está disponible.</p></body></html>', {
                            headers: { 'Content-Type': 'text/html' }
                        });
                    });
            })
    );
});

// Mensajes del cliente (para actualizaciones)
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Actualización en segundo plano
self.addEventListener('updatefound', () => {
    console.log('Service Worker: Nueva versión disponible');
    // Notificar a la página que hay una actualización
    self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
            client.postMessage({ type: 'UPDATE_AVAILABLE' });
        });
    });
});
