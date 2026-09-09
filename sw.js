const CACHE = 'bibliotheca-v2'
const SHELL = [
  './',
  './index.html',
  './template.html',
  './login.html',
  './profile.html',
  './admin.html',
  './offline.html',
  './manifest.webmanifest',
  './src/css/base.css',
  './src/css/header.css',
  './src/css/search.css',
  './src/css/layout.css',
  './src/css/cards.css',
  './src/css/responsive.css',
  './src/state.js',
  './src/renderBooks.js',
  './src/onSearch.js',
  './src/searchEventHandlers.js',
  './src/auth.js',
  './src/nav.js',
  './src/init.js'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isApi(url) {
  return url.pathname.startsWith('/api/')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (isApi(url) || url.searchParams.has('token')) return
  event.respondWith(
    caches.match(request, { ignoreSearch: false }).then((cached) => {
      if (cached) return cached
      return fetch(request).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(request, copy))
        }
        return res
      }).catch(() => {
        if (request.mode === 'navigate') return caches.match('./offline.html')
        throw new Error('offline')
      })
    })
  )
})
