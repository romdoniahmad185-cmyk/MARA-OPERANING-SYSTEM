/* =========================================
   MARA OS SERVICE WORKER
========================================= */

const CACHE_NAME = "mara-os-v7";


/* =========================================
   FILE UTAMA MARA
========================================= */

const APP_FILES = [

    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",

    "./mara-icon-192.png",
    "./mara-icon-512.png",

    
];


/* =========================================
   INSTALL
========================================= */

self.addEventListener(
    "install",
    function (event) {

        console.log(
            "MARA OS: Service Worker sedang install..."
        );

        event.waitUntil(

            caches.open(CACHE_NAME)
                .then(function (cache) {

                    return cache.addAll(
                        APP_FILES
                    );

                })

        );

        /*
         * Jangan menunggu Service Worker lama
         */

        self.skipWaiting();

    }
);


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});