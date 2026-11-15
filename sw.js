const CACHE = 'fitness-v5'

const FILES = [
  './',
  './index.html',
  './styles.css',
  './manifest.json',
  './js/app.js',
  './js/logic.js',
  './js/pin.js',
  './js/gym.js',
  './js/train.js',
  './js/storage.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    // Bypass the HTTP cache so one deploy cannot store a new page with an old script.
    await cache.addAll(FILES.map((path) => new Request(path, { cache: 'reload' })))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isAppCode(request, url)) {
    event.respondWith(networkFirst(request))
    return
  }
  event.respondWith(cacheFirst(request))
})

function isAppCode(request, url) {
  if (request.mode === 'navigate') return true
  return url.pathname.endsWith('.js') || url.pathname.endsWith('.css')
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(freshRequest(request))
    if (response.ok) await cache.put(request, response.clone())
    return response
  } catch {
    const cached = await cache.match(request)
      || (request.mode === 'navigate' ? await cache.match('./index.html') : undefined)
    if (cached) return cached
    return new Response('Fitness is not available offline yet. Open it once while you are online.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(freshRequest(request))
  if (response.ok) await cache.put(request, response.clone())
  return response
}

function freshRequest(request) {
  if (request.mode === 'navigate') {
    return new Request(request.url, { cache: 'reload', credentials: 'same-origin' })
  }
  return new Request(request, { cache: 'reload' })
}
