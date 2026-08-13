"use strict";

/* =========================================
   MARA OS PWA SERVICE WORKER
========================================= */

const CACHE_NAME = "mara-os-v4";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",

    "./mara-icon-192.png",
    "./mara-icon-512.png",

    "./ux/lock-screen.html",
    "./ux/home-screen.html",
    "./ux/control-center.html"
];


/* =========================================
   INSTALL SERVICE WORKER
========================================= */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches.open(CACHE_NAME)
                .then(cache => {

                    console.log(
                        "MARA: membuat cache..."
                    );

                    return cache.addAll(
                        FILES_TO_CACHE
                    );

                })

        );

        self.skipWaiting();
    }
);


/* =========================================
   ACTIVATE
========================================= */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches.keys()
                .then(cacheNames => {

                    return Promise.all(

                        cacheNames
                            .filter(
                                name =>
                                    name !==
                                    CACHE_NAME
                            )
                            .map(
                                name =>
                                    caches.delete(
                                        name
                                    )
                            )

                    );

                })

        );

        self.clients.claim();
    }
);


/* =========================================
   FETCH
========================================= */

self.addEventListener(
    "fetch",
    event => {

        if (
            event.request.method !==
            "GET"
        ) {
            return;
        }


        event.respondWith(

            caches.match(
                event.request
            )
            .then(cachedResponse => {

                /*
                 * CACHE TERLEBIH DAHULU
                 */

                if (cachedResponse) {

                    return cachedResponse;

                }


                /*
                 * JIKA BELUM ADA CACHE
                 */

                return fetch(
                    event.request
                )
                .then(networkResponse => {

                    /*
                     * Response tidak valid
                     */

                    if (
                        !networkResponse ||
                        networkResponse.status !== 200 ||
                        networkResponse.type !== "basic"
                    ) {

                        return networkResponse;

                    }


                    /*
                     * Simpan ke cache
                     */

                    const responseClone =
                        networkResponse.clone();


                    caches.open(
                        CACHE_NAME
                    )
                    .then(cache => {

                        cache.put(
                            event.request,
                            responseClone
                        );

                    });


                    return networkResponse;

                });

            })

        );

    }
);


/* =========================================
   MESSAGE DARI HALAMAN
========================================= */

self.addEventListener(
    "message",
    event => {

        if (
            event.data ===
            "MARA_SKIP_WAITING"
        ) {

            self.skipWaiting();

        }

    }
);