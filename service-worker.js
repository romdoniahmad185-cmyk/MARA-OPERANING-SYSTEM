"use strict";

/* =========================================
   MARA OS SERVICE WORKER
========================================= */

const CACHE_NAME = "mara-os-v1";

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
   INSTALL
========================================= */

self.addEventListener(
    "install",
    function (event) {

        event.waitUntil(

            caches.open(CACHE_NAME)
                .then(function (cache) {

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
    function (event) {

        event.waitUntil(

            caches.keys()
                .then(function (cacheNames) {

                    return Promise.all(

                        cacheNames
                            .filter(function (name) {

                                return (
                                    name !==
                                    CACHE_NAME
                                );

                            })
                            .map(function (name) {

                                return caches.delete(
                                    name
                                );

                            })

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
    function (event) {

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
            .then(function (cached) {

                if (cached) {

                    return cached;
                }


                return fetch(
                    event.request
                )
                .then(function (response) {

                    if (
                        !response ||
                        response.status !== 200 ||
                        response.type !== "basic"
                    ) {

                        return response;
                    }


                    const copy =
                        response.clone();


                    caches.open(
                        CACHE_NAME
                    )
                    .then(function (cache) {

                        cache.put(
                            event.request,
                            copy
                        );

                    });


                    return response;

                });

            })

        );

    }
);