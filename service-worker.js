"use strict";

/* =====================================================
   MARA OS — SERVICE WORKER
   Single Page PWA
===================================================== */

const CACHE_NAME = "mara-os-v2";

const APP_SHELL = [
    "./",
    "./index.html",
    "./manifest.json",
    "./mara-icon-192.png",
    "./mara-icon-512.png"
];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME)

            .then(cache => {

                return Promise.all(

                    APP_SHELL.map(file => {

                        return cache.add(file)
                            .catch(error => {

                                console.warn(
                                    "MARA cache gagal:",
                                    file,
                                    error
                                );

                            });

                    })

                );

            })

    );

    /*
       Langsung aktifkan service worker baru
       tanpa menunggu aplikasi lama ditutup.
    */

    self.skipWaiting();

});


/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys()

            .then(cacheNames => {

                return Promise.all(

                    cacheNames

                        .filter(
                            name =>
                                name !== CACHE_NAME
                        )

                        .map(
                            name =>
                                caches.delete(name)
                        )

                );

            })

            .then(() => {

                /*
                   Ambil kontrol seluruh halaman
                   MARA yang sedang terbuka.
                */

                return self.clients.claim();

            })

    );

});


/* =====================================================
   FETCH
===================================================== */

self.addEventListener("fetch", event => {

    /*
       Hanya proses GET.
    */

    if (
        event.request.method !== "GET"
    ) {

        return;

    }


    /*
       Jangan mengambil request
       dari domain lain.
    */

    const requestURL =
        new URL(
            event.request.url
        );

    if (
        requestURL.origin !==
        self.location.origin
    ) {

        return;

    }


    event.respondWith(

        caches.match(
            event.request
        )

        .then(cachedResponse => {

            /*
               Jika ada cache,
               gunakan cache terlebih dahulu.
            */

            if (cachedResponse) {

                return cachedResponse;

            }


            /*
               Jika belum ada cache,
               ambil dari jaringan.
            */

            return fetch(
                event.request
            )

            .then(networkResponse => {

                /*
                   Simpan response baru
                   ke cache.
                */

                if (
                    networkResponse &&
                    networkResponse.status === 200 &&
                    networkResponse.type === "basic"
                ) {

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

                }

                return networkResponse;

            })

            .catch(() => {

                /*
                   Jika offline dan halaman
                   belum ada di cache,
                   kembali ke index.html.
                */

                return caches.match(
                    "./index.html"
                );

            });

        })

    );

});


/* =====================================================
   MESSAGE
   Memungkinkan index.html memaksa update
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
   NOTIFICATION / CACHE CLEANUP
===================================================== */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches.open(
                CACHE_NAME
            )
            .then(cache => {

                return cache.keys();

            })
            .then(requests => {

                console.log(
                    "MARA OS cache aktif:",
                    requests.length,
                    "file"
                );

            })

        );

    }
);