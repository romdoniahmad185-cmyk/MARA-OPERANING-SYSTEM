"use strict";


/* =====================================================
   MARA OS — SERVICE WORKER
===================================================== */


/* =====================================================
   CACHE VERSION
===================================================== */

const CACHE_NAME =
    "mara-os-v1";


/* =====================================================
   FILE YANG AKAN DISIMPAN OFFLINE
===================================================== */

const FILES_TO_CACHE = [

    /* ROOT */

    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",


    /* ICON PWA */

    "./mara-icon-192.png",
    "./mara-icon-512.png",


    /* UX */

    "./ux/lock-screen.html",
    "./ux/home-screen.html",
    "./ux/control-center.html",


    /* WALLPAPER */

    "./ux/wallpaper1.png",


    /* ICON SVG */

    "./ux/icon-svg/mara-browser.svg",
    "./ux/icon-svg/maps.svg"

];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(CACHE_NAME)
                .then(
                    async cache => {

                        /*
                         * Cache file satu per satu.
                         *
                         * Jika satu file tidak ditemukan,
                         * file lainnya tetap bisa masuk cache.
                         */

                        for (
                            const file
                            of FILES_TO_CACHE
                        ) {

                            try {

                                await cache.add(
                                    file
                                );

                                console.log(
                                    "MARA CACHE OK:",
                                    file
                                );

                            } catch (error) {

                                console.warn(
                                    "MARA CACHE GAGAL:",
                                    file
                                );

                            }

                        }

                    }
                )

        );


        /*
         * Aktifkan Service Worker baru
         * tanpa menunggu tab lama ditutup.
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

        event.waitUntil(

            caches
                .keys()
                .then(
                    cacheNames => {

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

                    }
                )
                .then(
                    () => {

                        /*
                         * Ambil kontrol semua halaman
                         * MARA OS yang sedang terbuka.
                         */

                        return self.clients.claim();

                    }
                )

        );

    }
);


/* =====================================================
   FETCH
===================================================== */

self.addEventListener(
    "fetch",
    event => {

        /*
         * Hanya tangani request GET.
         */

        if (
            event.request.method !==
            "GET"
        ) {

            return;

        }


        event.respondWith(

            caches
                .match(
                    event.request
                )
                .then(
                    cachedResponse => {

                        /*
                         * Kalau tersedia di cache,
                         * gunakan cache.
                         */

                        if (
                            cachedResponse
                        ) {

                            return cachedResponse;

                        }


                        /*
                         * Kalau belum ada di cache,
                         * ambil dari jaringan.
                         */

                        return fetch(
                            event.request
                        )
                        .then(
                            response => {

                                /*
                                 * Simpan response valid
                                 * ke cache.
                                 */

                                if (
                                    response &&
                                    response.status === 200 &&
                                    response.type !==
                                        "opaque"
                                ) {

                                    const responseClone =
                                        response.clone();

                                    caches
                                        .open(
                                            CACHE_NAME
                                        )
                                        .then(
                                            cache => {

                                                cache.put(
                                                    event.request,
                                                    responseClone
                                                );

                                            }
                                        );

                                }


                                return response;

                            }
                        )
                        .catch(
                            () => {

                                /*
                                 * Jika internet mati
                                 * dan file tidak ada
                                 * di cache, coba fallback
                                 * ke index.html.
                                 */

                                return caches.match(
                                    "./index.html"
                                );

                            }
                        );

                    }
                )

        );

    }
);


/* =====================================================
   MESSAGE
   UPDATE SERVICE WORKER
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