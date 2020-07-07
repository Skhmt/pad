/**
 * This is a service worker
 *  
 * reading: https://css-tricks.com/serviceworker-for-offline/
 */

const version = 'md-1.0.0'
const cacheURLs = [
    './',
    '/pad',
    '/pad/md.js',
    '/pad/md.css',
    '/pad/sidb.js',
    '/pad/lib/CascadiaCode.ttf',
    '/pad/lib/easymde.min.js',
    '/pad/lib/easymde.min.css',
    '/pad/lib/vue-2.6.11.js',
    '/pad/lib/highlight.min.js',
    '/pad/lib/atom-one-light.css',
    '/pad/lib/fa/css/font-awesome.min.css',
    '/pad/lib/fa/fonts/fontawesome-webfont.woff2',
    '/pad/icon/mdp-512.png',
]

self.addEventListener('install', event => {
    console.log('WORKER: install event in progress.')
    event.waitUntil(
        caches
            .open(version + 'fundamentals')
            .then(cache => {
                return cache.addAll(cacheURLs)
            })
            .then(() => {
                console.log('WORKER: install complete.')
            })
    )
})

// intercepts resource requests
self.addEventListener('fetch', event => {
    console.log('WORKER: fetch event in progress.')
    
    // only handle GET requests
    if (event.request.method !== 'GET') {
        return console.info('WORKER: fetch event ignored.', event.request.method, event.request.url)
    }

    event.respondWith(
        caches
            .match(event.request)
            .then(cached => {
                const networked = fetch(event.request)
                    .then(fetchedFromNetwork, unableToResolve)
                    .catch(unableToResolve)
                console.log('WORKER: fetch event', cached ? '(cached)' : '(network)', event.request.url)
                return cached || networked

                function fetchedFromNetwork(res) {
                    const cacheCopy = res.clone()
                    console.log('WORKER: fetch response from network.', event.request.url)

                    caches
                        .open(version + 'pages')
                        .then(function add(cache) {
                            cache.put(event.request, cacheCopy)
                        })
                        .then(() => {
                            console.log('WORKER: fetch response stored in cache.', event.request.url)
                        })
                    
                    return res
                }

                function unableToResolve() {
                    console.error('WORKER: fetch request failed in both cache and network.')
                    return new Response('<h1>Service unavailable</h1>', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: new Headers({
                            'Content-Type': 'text/html'
                        })
                    })
                }
            })
    )
})

// used when phasing out an older version of a service worker
self.addEventListener('activate', event => {
    console.log('WORKER: active event in progress.')
    event.waitUntil(
        caches
            .keys()
            .then(keys => {
                return Promise.all(
                    keys
                        // filter keys that don't start with the latest version prefix
                        .filter(key => key.startsWith(version))
                        // finished when each outdated cache is deleted
                        .map(key => caches.delete(key))
                )
            })
            .then(() => {
                console.log('WORKER: activate completed.')
            })
    )
})
