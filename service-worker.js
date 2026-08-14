"use strict";

/* =====================================================
   MARA OS — SERVICE WORKER
   PWA SINGLE-APP VERSION
===================================================== */


/* =====================================================
   CACHE VERSION
===================================================== */

const CACHE_NAME = "mara-os-v2";


/* =====================================================
   FILE YANG AKAN DISIMPAN OFFLINE
===================================================== */

const APP_SHELL = [

    "./",

    "./index.html",

    "./style.css",

    "./script.js",

    "./manifest.json",

    "./mara-icon-192.png",

    "./mara-icon-512.png",

    "./wallpaper1.png"

];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
    "install",
    event => {

        console.log(
            "MARA OS Service Worker: INSTALL"
        );

        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(cache => {

                    return cache.addAll(
                        APP_SHELL
                    );

                })

        );

        /*
         * Langsung aktif tanpa menunggu
         * tab lama ditutup.
         */

        self.skipWaiting();

    }
);


/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener(
    "activate",
    event => {

        console.log(
            "MARA OS Service Worker: ACTIVATE"
        );

        event.waitUntil(

            caches
                .keys()
                .then(cacheNames => {

                    return Promise.all(

                        cacheNames
                            .filter(
                                cacheName =>
                                    cacheName !==
                                    CACHE_NAME
                            )
                            .map(
                                cacheName =>
                                    caches.delete(
                                        cacheName
                                    )
                            )

                    );

                })

        );

        /*
         * Mengambil kontrol seluruh halaman
         * MARA OS tanpa menunggu reload berikutnya.
         */

        self.clients.claim();

    }
);


/* =====================================================
   FETCH
===================================================== */

self.addEventListener(
    "fetch",
    event => {

        /*
         * Hanya menangani GET.
         */

        if (
            event.request.method !== "GET"
        ) {

            return;

        }


        event.respondWith(

            caches
                .match(event.request)
                .then(cachedResponse => {

                    /*
                     * Jika ada di cache,
                     * gunakan versi offline.
                     */

                    if (
                        cachedResponse
                    ) {

                        return cachedResponse;

                    }


                    /*
                     * Jika belum ada di cache,
                     * ambil dari internet.
                     */

                    return fetch(
                        event.request
                    )
                    .then(networkResponse => {

                        /*
                         * Simpan response baru
                         * jika valid.
                         */

                        if (
                            networkResponse &&
                            networkResponse.status === 200 &&
                            networkResponse.type !==
                                "opaque"
                        ) {

                            const responseClone =
                                networkResponse.clone();

                            caches
                                .open(CACHE_NAME)
                                .then(cache => {

                                    cache.put(
                                        event.request,
                                        responseClone
                                    );

                                });

                        }


                        return networkResponse;

                    })
                    .catch(() => {

                        /*
                         * Jika offline dan halaman
                         * tidak ditemukan, kembali
                         * ke index.html.
                         */

                        return caches.match(
                            "./index.html"
                        );

                    });

                })

        );

    }
);


/* =====================================================
   MESSAGE
===================================================== */

self.addEventListener(
    "message",
    event => {

        if (
            event.data &&
            event.data.type ===
                "SKIP_WAITING"
        ) {

            self.skipWaiting();

        }

    }
);


/* =====================================================
   UPDATE CACHE
===================================================== */

self.addEventListener(
    "message",
    event => {

        if (
            event.data &&
            event.data.type ===
                "CLEAR_CACHE"
        ) {

            event.waitUntil(

                caches
                    .keys()
                    .then(cacheNames => {

                        return Promise.all(

                            cacheNames.map(
                                cacheName =>
                                    caches.delete(
                                        cacheName
                                    )
                            )

                        );

                    })

            );

        }

    }
);


console.log(
    "MARA OS Service Worker v2 aktif"
);