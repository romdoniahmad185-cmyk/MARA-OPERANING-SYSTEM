/*
 * ============================================================
 * MARA OS — BUILD RUNTIME ENGINE
 * ============================================================
 *
 * Fungsi utama:
 *
 *     IndexedDB
 *          ↓
 *     ACTIVE_BUILD
 *          ↓
 *     BUILD FILES
 *          ↓
 *     Blob
 *          ↓
 *     Blob URL
 *          ↓
 *     MARA MAIN IFRAME
 *
 * ------------------------------------------------------------
 *
 * BUILD.JS TIDAK MELAKUKAN:
 *
 * ❌ download repository
 * ❌ mengambil manifest
 * ❌ update
 * ❌ install build
 * ❌ delete build
 * ❌ verify update
 *
 * Semua proses tersebut menjadi tanggung jawab:
 *
 *     engine-single.js
 *
 * ------------------------------------------------------------
 *
 * BUILD.JS HANYA:
 *
 *     membaca build aktif
 *     membaca file build
 *     membuat runtime URL
 *     menjalankan UX/UI
 *
 * ============================================================
 */

(() => {

    "use strict";


    /* ========================================================
       CONFIGURATION
    ======================================================== */

    const MARA_BUILD_CONFIG = {

        /*
         * Database utama MARA OS.
         *
         * HARUS sesuai dengan engine-single.js.
         */

        dbName:
            "MARA_OS_UPGRADE_DB",


        /*
         * Versi database.
         *
         * Jangan dinaikkan dari build.js.
         */

        dbVersion:
            1,


        /*
         * Store build.
         */

        buildStore:
            "builds",


        /*
         * Store metadata.
         */

        metaStore:
            "metadata",


        /*
         * Key build aktif.
         */

        activeBuildKey:
            "ACTIVE_BUILD",


        /*
         * Entry utama sistem.
         */

        entryFile:
            "lock-screen.html",


        /*
         * Timeout membuka database.
         */

        databaseTimeout:
            10000,


        /*
         * Timeout membaca file.
         */

        fileTimeout:
            10000

    };


    /* ========================================================
       STATE
    ======================================================== */

    const STATE = {

        db:
            null,

        activeBuild:
            null,

        activeMetadata:
            null,

        files:
            new Map(),

        blobURLs:
            new Map(),

        started:
            false,

        starting:
            false,

        ready:
            false,

        error:
            null,

        startedAt:
            null,

        readyAt:
            null

    };


    /* ========================================================
       LOGGER
    ======================================================== */

    function log(...args) {

        console.log(
            "[MARA BUILD]",
            ...args
        );

    }


    function warn(...args) {

        console.warn(
            "[MARA BUILD]",
            ...args
        );

    }


    function error(...args) {

        console.error(
            "[MARA BUILD]",
            ...args
        );

    }


    /* ========================================================
       UTILITY
    ======================================================== */

    function normalizePath(path) {

        if (
            path === undefined ||
            path === null
        ) {

            return "";

        }


        return String(path)

            .replace(
                /\\/g,
                "/"
            )

            .replace(
                /^\/+/,
                ""
            )

            .replace(
                /\/+/g,
                "/"
            );

    }


    function normalizeBuild(build) {

        if (
            build === undefined ||
            build === null
        ) {

            return null;

        }


        if (
            typeof build === "object"
        ) {

            if (
                build.build !== undefined
            ) {

                return String(
                    build.build
                );

            }


            if (
                build.version !== undefined
            ) {

                return String(
                    build.version
                );

            }


            if (
                build.id !== undefined
            ) {

                return String(
                    build.id
                );

            }

        }


        return String(
            build
        );

    }


    function isBlob(value) {

        return (
            typeof Blob !== "undefined" &&
            value instanceof Blob
        );

    }


    function isArrayBuffer(value) {

        return (
            typeof ArrayBuffer !== "undefined" &&
            value instanceof ArrayBuffer
        );

    }


    function isTypedArray(value) {

        return (
            typeof ArrayBuffer !== "undefined" &&
            ArrayBuffer.isView(value)
        );

    }


    function guessMimeType(path) {

        const extension =
            normalizePath(path)
                .split(".")
                .pop()
                .toLowerCase();


        const types = {

            html:
                "text/html",

            htm:
                "text/html",

            css:
                "text/css",

            js:
                "text/javascript",

            mjs:
                "text/javascript",

            json:
                "application/json",

            svg:
                "image/svg+xml",

            png:
                "image/png",

            jpg:
                "image/jpeg",

            jpeg:
                "image/jpeg",

            webp:
                "image/webp",

            gif:
                "image/gif",

            txt:
                "text/plain",

            xml:
                "application/xml",

            ico:
                "image/x-icon",

            wasm:
                "application/wasm"

        };


        return (
            types[extension] ||
            "application/octet-stream"
        );

    }


    /* ========================================================
       OPEN DATABASE
    ======================================================== */

    function openDatabase() {

        return new Promise(
            (resolve, reject) => {

                if (
                    !window.indexedDB
                ) {

                    reject(
                        new Error(
                            "IndexedDB tidak tersedia pada browser."
                        )
                    );

                    return;

                }


                let finished =
                    false;


                const timeout =
                    setTimeout(
                        () => {

                            if (
                                finished
                            ) {

                                return;

                            }


                            finished =
                                true;


                            reject(
                                new Error(
                                    "Timeout membuka IndexedDB."
                                )
                            );

                        },
                        MARA_BUILD_CONFIG.databaseTimeout
                    );


                let request;


                try {

                    request =
                        indexedDB.open(
                            MARA_BUILD_CONFIG.dbName,
                            MARA_BUILD_CONFIG.dbVersion
                        );

                } catch (err) {

                    clearTimeout(
                        timeout
                    );


                    reject(
                        err
                    );


                    return;

                }


                /*
                 * PENTING:
                 *
                 * build.js TIDAK membuat struktur
                 * database baru.
                 *
                 * engine-single.js adalah pemilik
                 * struktur database.
                 */

                request.onupgradeneeded =
                    event => {

                        warn(
                            "IndexedDB meminta upgrade.",
                            event.oldVersion,
                            "→",
                            event.newVersion
                        );

                    };


                request.onerror =
                    () => {

                        if (
                            finished
                        ) {

                            return;

                        }


                        finished =
                            true;


                        clearTimeout(
                            timeout
                        );


                        reject(
                            request.error ||
                            new Error(
                                "Gagal membuka IndexedDB."
                            )
                        );

                    };


                request.onsuccess =
                    () => {

                        if (
                            finished
                        ) {

                            return;

                        }


                        finished =
                            true;


                        clearTimeout(
                            timeout
                        );


                        const db =
                            request.result;


                        STATE.db =
                            db;


                        /*
                         * Jika database ditutup dari luar.
                         */

                        db.onversionchange =
                            () => {

                                try {

                                    db.close();

                                } catch (_) {}

                            };


                        resolve(
                            db
                        );

                    };

            }
        );

    }


    /* ========================================================
       CHECK STORE
    ======================================================== */

    function hasStore(
        storeName
    ) {

        if (
            !STATE.db
        ) {

            return false;

        }


        return STATE.db.objectStoreNames.contains(
            storeName
        );

    }


    /* ========================================================
       READ METADATA
    ======================================================== */

    function readMetadata(
        key
    ) {

        return new Promise(
            (resolve, reject) => {

                if (
                    !STATE.db
                ) {

                    reject(
                        new Error(
                            "Database belum dibuka."
                        )
                    );

                    return;

                }


                if (
                    !hasStore(
                        MARA_BUILD_CONFIG.metaStore
                    )
                ) {

                    reject(
                        new Error(
                            "Object store metadata tidak ditemukan."
                        )
                    );

                    return;

                }


                let transaction;


                try {

                    transaction =
                        STATE.db.transaction(
                            MARA_BUILD_CONFIG.metaStore,
                            "readonly"
                        );

                } catch (err) {

                    reject(
                        err
                    );

                    return;

                }


                const store =
                    transaction.objectStore(
                        MARA_BUILD_CONFIG.metaStore
                    );


                const request =
                    store.get(
                        key
                    );


                request.onsuccess =
                    () => {

                        resolve(
                            request.result
                        );

                    };


                request.onerror =
                    () => {

                        reject(
                            request.error ||
                            new Error(
                                "Gagal membaca metadata."
                            )
                        );

                    };

            }
        );

    }


    /* ========================================================
       GET ACTIVE BUILD
    ======================================================== */

    async function getActiveBuild() {

        const metadata =
            await readMetadata(
                MARA_BUILD_CONFIG.activeBuildKey
            );


        STATE.activeMetadata =
            metadata;


        if (
            metadata === undefined ||
            metadata === null
        ) {

            throw new Error(
                "ACTIVE_BUILD belum tersedia."
            );

        }


        let build =
            null;


        /*
         * Number
         */

        if (
            typeof metadata ===
            "number"
        ) {

            build =
                metadata;

        }


        /*
         * String
         */

        else if (
            typeof metadata ===
            "string"
        ) {

            build =
                metadata;

        }


        /*
         * Object
         */

        else if (
            typeof metadata ===
            "object"
        ) {

            if (
                metadata.build !==
                undefined
            ) {

                build =
                    metadata.build;

            }

            else if (
                metadata.id !==
                undefined
            ) {

                build =
                    metadata.id;

            }

            else if (
                metadata.version !==
                undefined
            ) {

                build =
                    metadata.version;

            }

            else if (
                metadata.activeBuild !==
                undefined
            ) {

                build =
                    metadata.activeBuild;

            }

        }


        if (
            build === null ||
            build === undefined
        ) {

            throw new Error(
                "Format ACTIVE_BUILD tidak dikenali."
            );

        }


        STATE.activeBuild =
            normalizeBuild(
                build
            );


        return STATE.activeBuild;

    }


    /* ========================================================
       BUILD STORE
    ======================================================== */

    function getBuildStore() {

        if (
            !STATE.db
        ) {

            throw new Error(
                "Database belum dibuka."
            );

        }


        if (
            !hasStore(
                MARA_BUILD_CONFIG.buildStore
            )
        ) {

            throw new Error(
                "Object store builds tidak ditemukan."
            );

        }


        return STATE.db.transaction(
            MARA_BUILD_CONFIG.buildStore,
            "readonly"
        ).objectStore(
            MARA_BUILD_CONFIG.buildStore
        );

    }


    /* ========================================================
       TRY STORE KEY
    ======================================================== */

    function getByKey(
        key
    ) {

        return new Promise(
            (resolve, reject) => {

                let store;


                try {

                    store =
                        getBuildStore();

                } catch (err) {

                    reject(
                        err
                    );

                    return;

                }


                const request =
                    store.get(
                        key
                    );


                request.onsuccess =
                    () => {

                        resolve(
                            request.result
                        );

                    };


                request.onerror =
                    () => {

                        resolve(
                            undefined
                        );

                    };

            }
        );

    }


    /* ========================================================
       POSSIBLE KEYS
    ======================================================== */

    function generatePossibleKeys(
        build,
        path
    ) {

        const b =
            normalizeBuild(
                build
            );


        const p =
            normalizePath(
                path
            );


        return [

            `${b}/${p}`,

            `build-${b}/${p}`,

            `build_${b}/${p}`,

            `${b}:${p}`,

            `${b}_${p}`,

            `${b}|${p}`,

            p

        ];

    }


    /* ========================================================
       MATCH RECORD
    ======================================================== */

    function recordMatches(
        record,
        build,
        path
    ) {

        if (
            !record ||
            typeof record !==
            "object"
        ) {

            return false;

        }


        const targetBuild =
            normalizeBuild(
                build
            );


        const targetPath =
            normalizePath(
                path
            );


        /*
         * Path candidates.
         */

        const recordPath =
            normalizePath(
                record.path ||
                record.file ||
                record.name ||
                ""
            );


        /*
         * Build candidates.
         */

        const recordBuild =
            normalizeBuild(
                record.build !==
                undefined
                    ? record.build
                    : record.buildId !==
                      undefined
                        ? record.buildId
                        : record.version
            );


        /*
         * Jika record punya build,
         * build harus cocok.
         */

        if (
            recordBuild !== null &&
            recordBuild !==
                targetBuild
        ) {

            return false;

        }


        /*
         * Jika record punya path,
         * path harus cocok.
         */

        if (
            recordPath ===
            targetPath
        ) {

            return true;

        }


        /*
         * Coba key.

         */

        const recordKey =
            normalizePath(
                record.key ||
                ""
            );


        const possibleKeys =
            generatePossibleKeys(
                build,
                path
            );


        return possibleKeys.includes(
            recordKey
        );

    }


    /* ========================================================
       FIND FILE BY CURSOR
    ======================================================== */

    function findFileByCursor(
        build,
        path
    ) {

        return new Promise(
            (resolve, reject) => {

                let store;


                try {

                    store =
                        getBuildStore();

                } catch (err) {

                    reject(
                        err
                    );

                    return;

                }


                const request =
                    store.openCursor();


                request.onsuccess =
                    event => {

                        const cursor =
                            event.target.result;


                        if (
                            !cursor
                        ) {

                            resolve(
                                undefined
                            );

                            return;

                        }


                        const record =
                            cursor.value;


                        if (
                            recordMatches(
                                record,
                                build,
                                path
                            )
                        ) {

                            resolve(
                                record
                            );

                            return;

                        }


                        cursor.continue();

                    };


                request.onerror =
                    () => {

                        reject(
                            request.error ||
                            new Error(
                                "Gagal membaca build store."
                            )
                        );

                    };

            }
        );

    }


    /* ========================================================
       FIND FILE
    ======================================================== */

    async function findFile(
        build,
        path
    ) {

        const normalizedBuild =
            normalizeBuild(
                build
            );


        const normalizedPath =
            normalizePath(
                path
            );


        if (
            !normalizedBuild
        ) {

            throw new Error(
                "Build tidak valid."
            );

        }


        if (
            !normalizedPath
        ) {

            throw new Error(
                "Path file kosong."
            );

        }


        /*
         * Coba key langsung.
         */

        const keys =
            generatePossibleKeys(
                normalizedBuild,
                normalizedPath
            );


        for (
            const key of keys
        ) {

            const result =
                await getByKey(
                    key
                );


            if (
                result !==
                undefined
            ) {

                return result;

            }

        }


        /*
         * Fallback cursor.
         */

        const cursorResult =
            await findFileByCursor(
                normalizedBuild,
                normalizedPath
            );


        if (
            cursorResult !==
            undefined
        ) {

            return cursorResult;

        }


        throw new Error(
            `File tidak ditemukan: ${normalizedPath}`
        );

    }


    /* ========================================================
       NORMALIZE FILE
    ======================================================== */

    function normalizeFile(
        record,
        requestedPath
    ) {

        if (
            !record
        ) {

            throw new Error(
                "Record file kosong."
            );

        }


        const path =
            normalizePath(
                record.path ||
                record.file ||
                record.name ||
                requestedPath
            );


        const mime =
            record.type ||
            record.mime ||
            record.contentType ||
            guessMimeType(
                path
            );


        /*
         * Record langsung berupa Blob.
         */

        if (
            isBlob(
                record
            )
        ) {

            return {

                blob:
                    record,

                path:
                    path,

                type:
                    record.type ||
                    mime

            };

        }


        /*
         * record.blob
         */

        if (
            isBlob(
                record.blob
            )
        ) {

            return {

                blob:
                    record.blob,

                path:
                    path,

                type:
                    record.blob.type ||
                    mime

            };

        }


        /*
         * record.data = Blob
         */

        if (
            isBlob(
                record.data
            )
        ) {

            return {

                blob:
                    record.data,

                path:
                    path,

                type:
                    record.data.type ||
                    mime

            };

        }


        /*
         * ArrayBuffer
         */

        if (
            isArrayBuffer(
                record.data
            )
        ) {

            return {

                blob:
                    new Blob(
                        [
                            record.data
                        ],
                        {
                            type:
                                mime
                        }
                    ),

                path:
                    path,

                type:
                    mime

            };

        }


        /*
         * Uint8Array / TypedArray
         */

        if (
            isTypedArray(
                record.data
            )
        ) {

            return {

                blob:
                    new Blob(
                        [
                            record.data
                        ],
                        {
                            type:
                                mime
                        }
                    ),

                path:
                    path,

                type:
                    mime

            };

        }


        /*
         * record.content Blob
         */

        if (
            isBlob(
                record.content
            )
        ) {

            return {

                blob:
                    record.content,

                path:
                    path,

                type:
                    record.content.type ||
                    mime

            };

        }


        /*
         * record.content string
         */

        if (
            typeof record.content ===
            "string"
        ) {

            return {

                blob:
                    new Blob(
                        [
                            record.content
                        ],
                        {
                            type:
                                mime
                        }
                    ),

                path:
                    path,

                type:
                    mime

            };

        }


        /*
         * record.data string
         */

        if (
            typeof record.data ===
            "string"
        ) {

            return {

                blob:
                    new Blob(
                        [
                            record.data
                        ],
                        {
                            type:
                                mime
                        }
                    ),

                path:
                    path,

                type:
                    mime

            };

        }


        /*
         * record.text
         */

        if (
            typeof record.text ===
            "string"
        ) {

            return {

                blob:
                    new Blob(
                        [
                            record.text
                        ],
                        {
                            type:
                                mime
                        }
                    ),

                path:
                    path,

                type:
                    mime

            };

        }


        throw new Error(
            `Format data file tidak didukung: ${path}`
        );

    }


    /* ========================================================
       CREATE BLOB URL
    ======================================================== */

    function createFileURL(
        path,
        file
    ) {

        const normalizedPath =
            normalizePath(
                path
            );


        /*
         * Hapus URL lama.
         */

        if (
            STATE.blobURLs.has(
                normalizedPath
            )
        ) {

            try {

                URL.revokeObjectURL(
                    STATE.blobURLs.get(
                        normalizedPath
                    )
                );

            } catch (_) {}

        }


        const url =
            URL.createObjectURL(
                file.blob
            );


        STATE.blobURLs.set(
            normalizedPath,
            url
        );


        return url;

    }


    /* ========================================================
       LOAD BUILD FILE
    ======================================================== */

    async function loadBuildFile(
        path
    ) {

        const normalizedPath =
            normalizePath(
                path
            );


        if (
            !normalizedPath
        ) {

            throw new Error(
                "Path file tidak boleh kosong."
            );

        }


        /*
         * Runtime cache.
         */

        if (
            STATE.files.has(
                normalizedPath
            )
        ) {

            return STATE.files.get(
                normalizedPath
            );

        }


        if (
            STATE.activeBuild ===
            null
        ) {

            await getActiveBuild();

        }


        log(
            "Membaca file:",
            normalizedPath,
            "build:",
            STATE.activeBuild
        );


        const record =
            await findFile(
                STATE.activeBuild,
                normalizedPath
            );


        const file =
            normalizeFile(
                record,
                normalizedPath
            );


        const url =
            createFileURL(
                normalizedPath,
                file
            );


        const result = {

            path:
                normalizedPath,

            build:
                STATE.activeBuild,

            url:
                url,

            blob:
                file.blob,

            type:
                file.type,

            size:
                file.blob.size

        };


        STATE.files.set(
            normalizedPath,
            result
        );


        return result;

    }


    /* ========================================================
       GET URL
    ======================================================== */

    async function getURL(
        path
    ) {

        const file =
            await loadBuildFile(
                path
            );


        return file.url;

    }


    /* ========================================================
       LOAD HTML INTO IFRAME
    ======================================================== */

    async function loadHTMLIntoFrame(
        frame,
        path
    ) {

        if (
            !frame
        ) {

            throw new Error(
                "Iframe tidak ditemukan."
            );

        }


        const file =
            await loadBuildFile(
                path
            );


        frame.src =
            file.url;


        return new Promise(
            (
                resolve,
                reject
            ) => {

                let finished =
                    false;


                const timeout =
                    setTimeout(
                        () => {

                            if (
                                finished
                            ) {

                                return;

                            }


                            finished =
                                true;


                            reject(
                                new Error(
                                    `Timeout memuat iframe: ${path}`
                                )
                            );

                        },
                        MARA_BUILD_CONFIG.fileTimeout
                    );


                function cleanup() {

                    clearTimeout(
                        timeout
                    );

                    frame.removeEventListener(
                        "load",
                        onLoad
                    );

                    frame.removeEventListener(
                        "error",
                        onError
                    );

                }


                function onLoad() {

                    if (
                        finished
                    ) {

                        return;

                    }


                    finished =
                        true;


                    cleanup();


                    resolve(
                        file
                    );

                }


                function onError() {

                    if (
                        finished
                    ) {

                        return;

                    }


                    finished =
                        true;


                    cleanup();


                    reject(
                        new Error(
                            `Gagal memuat iframe: ${path}`
                        )
                    );

                }


                frame.addEventListener(
                    "load",
                    onLoad,
                    {
                        once: true
                    }
                );


                frame.addEventListener(
                    "error",
                    onError,
                    {
                        once: true
                    }
                );

            }
        );

    }


    /* ========================================================
       FIND MAIN FRAME
    ======================================================== */

    function getMainFrame() {

        let frame =
            document.getElementById(
                "mara-main-frame"
            );


        if (
            frame
        ) {

            return frame;

        }


        frame =
            document.querySelector(
                ".mara-iframe"
            );


        return frame ||
            null;

    }


    /* ========================================================
       LOAD MAIN UX
    ======================================================== */

    async function loadMainUX() {

        const frame =
            getMainFrame();


        if (
            !frame
        ) {

            throw new Error(
                "Iframe utama MARA OS tidak ditemukan."
            );

        }


        log(
            "Memuat:",
            MARA_BUILD_CONFIG.entryFile
        );


        const file =
            await loadHTMLIntoFrame(
                frame,
                MARA_BUILD_CONFIG.entryFile
            );


        log(
            "Main UX berhasil dimuat."
        );


        return file;

    }


    /* ========================================================
       LOAD HOME SCREEN
    ======================================================== */

    async function loadHomeScreen(
        frame
    ) {

        const targetFrame =
            frame ||
            getMainFrame();


        return loadHTMLIntoFrame(
            targetFrame,
            "home-screen.html"
        );

    }


    /* ========================================================
       LOAD CONTROL CENTER
    ======================================================== */

    async function loadControlCenter(
        frame
    ) {

        const targetFrame =
            frame ||
            document.getElementById(
                "controlCenterFrame"
            );


        if (
            !targetFrame
        ) {

            throw new Error(
                "Control Center iframe tidak ditemukan."
            );

        }


        return loadHTMLIntoFrame(
            targetFrame,
            "control-center.html"
        );

    }


    /* ========================================================
       PRELOAD FILES
    ======================================================== */

    async function preload(
        paths
    ) {

        if (
            !Array.isArray(
                paths
            )
        ) {

            throw new Error(
                "preload() membutuhkan array path."
            );

        }


        const results =
            [];


        for (
            const path of paths
        ) {

            results.push(
                await loadBuildFile(
                    path
                )
            );

        }


        return results;

    }


    /* ========================================================
       CLEAR RUNTIME CACHE
    ======================================================== */

    function clearCache() {

        STATE.files.clear();

    }


    /* ========================================================
       REVOKE BLOB URL
    ======================================================== */

    function revokeURLs() {

        for (
            const url of
            STATE.blobURLs.values()
        ) {

            try {

                URL.revokeObjectURL(
                    url
                );

            } catch (_) {}

        }


        STATE.blobURLs.clear();

        STATE.files.clear();

    }


    /* ========================================================
       CLOSE DATABASE
    ======================================================== */

    function closeDatabase() {

        if (
            STATE.db
        ) {

            try {

                STATE.db.close();

            } catch (_) {}

        }


        STATE.db =
            null;

    }


    /* ========================================================
       REFRESH ACTIVE BUILD
    ======================================================== */

    async function refreshActiveBuild() {

        if (
            !STATE.db
        ) {

            await openDatabase();

        }


        const oldBuild =
            STATE.activeBuild;


        const newBuild =
            await getActiveBuild();


        if (
            oldBuild !==
            newBuild
        ) {

            log(
                "ACTIVE_BUILD berubah:",
                oldBuild,
                "→",
                newBuild
            );


            clearCache();

        }


        return newBuild;

    }


    /* ========================================================
       GET STATE
    ======================================================== */

    function getState() {

        return {

            db:
                !!STATE.db,

            activeBuild:
                STATE.activeBuild,

            activeMetadata:
                STATE.activeMetadata,

            started:
                STATE.started,

            starting:
                STATE.starting,

            ready:
                STATE.ready,

            error:
                STATE.error,

            startedAt:
                STATE.startedAt,

            readyAt:
                STATE.readyAt,

            cachedFiles:
                Array.from(
                    STATE.files.keys()
                ),

            blobURLs:
                Array.from(
                    STATE.blobURLs.keys()
                )

        };

    }


    /* ========================================================
       DISPATCH EVENT
    ======================================================== */

    function dispatchEvent(
        type,
        detail = {}
    ) {

        try {

            window.dispatchEvent(
                new CustomEvent(
                    type,
                    {
                        detail:
                            detail
                    }
                )
            );

        } catch (err) {

            warn(
                "Gagal dispatch event:",
                type,
                err
            );

        }

    }


    /* ========================================================
       SEND PARENT MESSAGE
    ======================================================== */

    function sendParentMessage(
        type,
        data = {}
    ) {

        if (
            !window.parent ||
            window.parent ===
                window
        ) {

            return;

        }


        try {

            window.parent.postMessage(
                {
                    type:
                        type,

                    ...data
                },
                "*"
            );

        } catch (err) {

            warn(
                "Gagal postMessage:",
                err
            );

        }

    }


    /* ========================================================
       START
    ======================================================== */

    async function start() {

        /*
         * Sudah siap.
         */

        if (
            STATE.ready
        ) {

            return {

                success:
                    true,

                build:
                    STATE.activeBuild,

                alreadyReady:
                    true

            };

        }


        /*
         * Sedang start.
         */

        if (
            STATE.starting
        ) {

            return STATE.startPromise;

        }


        STATE.starting =
            true;

        STATE.startedAt =
            Date.now();


        STATE.startPromise =
            (async () => {

                try {

                    log(
                        "Build Runtime dimulai."
                    );


                    dispatchEvent(
                        "MARA_BUILD_STARTING"
                    );


                    sendParentMessage(
                        "MARA_BUILD_STARTING"
                    );


                    /*
                     * ================================
                     * DATABASE
                     * ================================
                     */

                    await openDatabase();


                    /*
                     * ================================
                     * ACTIVE BUILD
                     * ================================
                     */

                    const activeBuild =
                        await getActiveBuild();


                    log(
                        "ACTIVE_BUILD:",
                        activeBuild
                    );


                    dispatchEvent(
                        "MARA_ACTIVE_BUILD",
                        {
                            build:
                                activeBuild,

                            metadata:
                                STATE.activeMetadata
                        }
                    );


                    sendParentMessage(
                        "MARA_ACTIVE_BUILD",
                        {
                            build:
                                activeBuild
                        }
                    );


                    /*
                     * ================================
                     * MAIN UX
                     * ================================
                     */

                    await loadMainUX();


                    /*
                     * ================================
                     * READY
                     * ================================
                     */

                    STATE.ready =
                        true;

                    STATE.error =
                        null;

                    STATE.readyAt =
                        Date.now();

                    STATE.started =
                        true;

                    STATE.starting =
                        false;


                    const result = {

                        success:
                            true,

                        build:
                            activeBuild,

                        readyAt:
                            STATE.readyAt

                    };


                    dispatchEvent(
                        "MARA_BUILD_READY",
                        result
                    );


                    sendParentMessage(
                        "MARA_BUILD_READY",
                        {
                            build:
                                activeBuild,

                            readyAt:
                                STATE.readyAt
                        }
                    );


                    log(
                        "MARA UX READY.",
                        result
                    );


                    return result;

                } catch (err) {

                    STATE.error =
                        err;

                    STATE.ready =
                        false;

                    STATE.started =
                        false;

                    STATE.starting =
                        false;


                    error(
                        "Build Runtime gagal:",
                        err
                    );


                    dispatchEvent(
                        "MARA_BUILD_ERROR",
                        {
                            error:
                                err,

                            message:
                                err.message
                        }
                    );


                    sendParentMessage(
                        "MARA_BUILD_ERROR",
                        {
                            message:
                                err.message
                        }
                    );


                    throw err;

                }

            })();


        return STATE.startPromise;

    }


    /* ========================================================
       STOP
    ======================================================== */

    function stop() {

        log(
            "Menghentikan Build Runtime."
        );


        revokeURLs();

        closeDatabase();


        STATE.activeBuild =
            null;

        STATE.activeMetadata =
            null;

        STATE.started =
            false;

        STATE.starting =
            false;

        STATE.ready =
            false;

        STATE.error =
            null;

        STATE.startPromise =
            null;


        dispatchEvent(
            "MARA_BUILD_STOPPED"
        );


        sendParentMessage(
            "MARA_BUILD_STOPPED"
        );

    }


    /* ========================================================
       PUBLIC API
    ======================================================== */

    window.MARABuild = {

        /*
         * Start runtime.
         */

        start:


            start,


        /*
         * Stop runtime.
         */

        stop:


            stop,


        /*
         * Active build.
         */

        getActiveBuild:
            () =>
                STATE.activeBuild,


        /*
         * Metadata.
         */

        getActiveMetadata:
            () =>
                STATE.activeMetadata,


        /*
         * File URL.
         */

        getURL:


            getURL,


        /*
         * File loader.
         */

        loadBuildFile:


            loadBuildFile,


        /*
         * HTML loader.
         */

        loadHTMLIntoFrame:


            loadHTMLIntoFrame,


        /*
         * Main UX.
         */

        loadMainUX:


            loadMainUX,


        /*
         * Home screen.
         */

        loadHomeScreen:


            loadHomeScreen,


        /*
         * Control center.
         */

        loadControlCenter:


            loadControlCenter,


        /*
         * Preload.

         */

        preload:


            preload,


        /*
         * Refresh active build.
         */

        refreshActiveBuild:


            refreshActiveBuild,


        /*
         * Clear cache.
         */

        clearCache:


            clearCache,


        /*
         * Revoke Blob URLs.
         */

        revokeURLs:


            revokeURLs,


        /*
         * Close database.
         */

        closeDatabase:


            closeDatabase,


        /*
         * Runtime ready.

         */

        isReady:
            () =>
                STATE.ready,


        /*
         * Runtime state.

         */

        getState:


            getState

    };


    /* ========================================================
       GLOBAL ALIAS
    ======================================================== */

    /*
     * Alias tambahan supaya mudah dipanggil
     * dari engine lain.
     */

    window.MARA_BUILD_RUNTIME =
        window.MARABuild;


    /* ========================================================
       AUTO START
    ======================================================== */

    function autoStart() {

        start()
            .catch(
                err => {

                    error(
                        "Auto startup gagal:",
                        err
                    );

                }
            );

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            autoStart,
            {
                once:
                    true
            }
        );

    } else {

        autoStart();

    }


    /* ========================================================
       PAGE UNLOAD
    ======================================================== */

    window.addEventListener(
        "pagehide",
        () => {

            /*
             * Jangan revoke terlalu agresif ketika
             * halaman hanya berpindah lifecycle.
             *
             * Tetapi database boleh ditutup.
             */

            closeDatabase();

        },
        {
            once:
                true
        }
    );


    /* ========================================================
       READY LOG
    ======================================================== */

    log(
        "BUILD RUNTIME ENGINE terdaftar."
    );

})();