"use strict";

/* =====================================================
   MARA OS — SERVICE WORKER
   PWA SINGLE APP
===================================================== */

const CACHE_NAME = "mara-os-v2";

/*
    Semua file utama MARA OS
*/
const APP_SHELL = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",

    "./mara-icon-192.png",
    "./mara-icon-512.png"
];


/* =====================================================
   INSTALL
===================================================== */

self.addEventListener("install", event => {

    console.log("MARA OS: Service Worker installing...");

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then(cache => {

                return cache.addAll(APP_SHELL);

            })

            .then(() => {

                console.log(
                    "MARA OS: App Shell berhasil dicache."
                );

                return self.skipWaiting();

            })

    );

});


/* =====================================================
   ACTIVATE
===================================================== */

self.addEventListener("activate", event => {

    console.log("MARA OS: Service Worker activating...");

    event.waitUntil(

        caches.keys()
            .then(cacheNames => {

                return Promise.all(

                    cacheNames
                        .filter(name => {

                            return (
                                name.startsWith("mara-os-") &&
                                name !== CACHE_NAME
                            );

                        })

                        .map(name => {

                            console.log(
                                "MARA OS: Menghapus cache lama:",
                                name
                            );

                            return caches.delete(name);

                        })

                );

            })

            .then(() => {

                console.log(
                    "MARA OS: Cache lama dibersihkan."
                );

                return self.clients.claim();

            })

    );

});


/* =====================================================
   FETCH
===================================================== */

self.addEventListener("fetch", event => {

    /*
        Hanya menangani request GET.
    */

    if (event.request.method !== "GET") {
        return;
    }


    /*
        Jangan mengganggu request eksternal.
        Contohnya API, YouTube, CDN, dll.
    */

    const requestURL =
        new URL(event.request.url);


    if (
        requestURL.origin !==
        self.location.origin
    ) {

        return;

    }


    /*
        CACHE FIRST

        1. Cari file di cache.
        2. Kalau ada → gunakan cache.
        3. Kalau tidak ada → ambil dari internet.
        4. Simpan hasilnya ke cache.
    */

    event.respondWith(

        caches.match(event.request)
            .then(cachedResponse => {

                if (cachedResponse) {

                    return cachedResponse;

                }


                return fetch(event.request)

                    .then(networkResponse => {

                        /*
                            Jangan cache response
                            yang tidak valid.
                        */

                        if (
                            !networkResponse ||
                            networkResponse.status !== 200 ||
                            networkResponse.type !== "basic"
                        ) {

                            return networkResponse;

                        }


                        /*
                            Clone response karena
                            response hanya bisa digunakan
                            sekali.
                        */

                        const responseClone =
                            networkResponse.clone();


                        caches.open(CACHE_NAME)
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

});


/* =====================================================
   MESSAGE
===================================================== */

self.addEventListener("message", event => {

    if (
        event.data &&
        event.data.type === "SKIP_WAITING"
    ) {

        self.skipWaiting();

    }

});


/* =====================================================
   BACKGROUND ERROR PROTECTION
===================================================== */

self.addEventListener(
    "error",
    event => {

        console.error(
            "MARA OS Service Worker Error:",
            event.error
        );

    }
);