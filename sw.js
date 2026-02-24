const CACHE_NAME = 'stl-v1';
const assets = [
  './',                 // Referencia a la raíz
  'index.html',
  'app_turismo.html',
  'app_contratos.html',
  'logo.png',
  'manifest.json',
  // ¡IMPORTANTE! Agrega aquí tus archivos JS y CSS externos si no los tienes
  // Ejemplo: 'contratos.js', 'turismo.js'
];

// Instalación: Forzamos a que el SW tome el control de inmediato
self.addEventListener('install', e => {
  self.skipWaiting(); 
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(assets))
  );
});

// Activación: Limpieza profunda
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  return self.clients.claim(); // Reclama el control de las pestañas abiertas
});

// Estrategia: Cache First (Priorizar velocidad sobre red)
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => {
      // Si está en caché, lo devuelve instantáneo. Si no, va a internet.
      return res || fetch(e.request);
    })
  );
});
