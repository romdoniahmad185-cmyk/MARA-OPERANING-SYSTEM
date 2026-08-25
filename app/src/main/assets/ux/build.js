 /*
  * ============================================================
  * MARA OS — BUILD RUNTIME ENGINE
  * ============================================================
  *
  * Tugas:
  *
  * IndexedDB
  *     ↓
  * ACTIVE_BUILD
  *     ↓
  * Ambil file build
  *     ↓
  * Buat Blob URL
  *     ↓
  * Jalankan UX/UI
  *
  * Engine ini TIDAK melakukan:
  *
  * - download repository
  * - update
  * - delete build
  * - install build
  *
  * Semua itu dilakukan oleh engine-single.js.
  * ============================================================
  */

(() => {

    "use strict";


    /* ========================================================
       CONFIGURATION
    ======================================================== */

    const MARA_BUILD_CONFIG = {

        /*
         * Nama database.
         *
         * HARUS sama dengan database yang digunakan
         * engine-single.js.
         */

        dbName:
            "MARA_OS_UPGRADE_DB",


        /*
         * Versi IndexedDB.
         */

        dbVersion:
            1,


        /*
         * Object store build.
         */

        buildStore:
            "builds",


        /*
         * Object store metadata.
         */

        metaStore:
            "metadata",


        /*
         * Nama key ACTIVE BUILD.
         */

        activeBuildKey:
            "ACTIVE_BUILD",


        /*
         * Entry utama UX.
         */

        entryFile:
            "lock-screen.html"

    };


    /* ========================================================
       STATE
    ======================================================== */

    const MARA_BUILD_STATE = {

        db:
            null,

        activeBuild:
            null,

        files:
            new Map(),

        blobURLs:
            new Map(),

        started:
            false,

        ready:
            false

    };


    /* ========================================================
       LOG
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
       OPEN DATABASE
    ======================================================== */

    function openDatabase() {

        return new Promise(
            (resolve, reject) => {

                const request =
                    indexedDB.open(
                        MARA_BUILD_CONFIG.dbName,
                        MARA_BUILD_CONFIG.dbVersion
                    );


                request.onerror =
                    () => {

                        reject(
                            request.error ||
                            new Error(
                                "Gagal membuka IndexedDB."
                            )
                        );

                    };


                request.onsuccess =
                    () => {

                        MARA_BUILD_STATE.db =
                            request.result;


                        resolve(
                            request.result
                        );

                    };


                /*
                 * Jangan membuat struktur database
                 * berbeda dari engine-single.js jika
                 * database sudah dibuat oleh engine tersebut.
                 *
                 * Bagian ini hanya fallback.
                 */

                request.onupgradeneeded =
                    event => {

                        const db =
                            event.target.result;


                        if (
                            !db.objectStoreNames.contains(
                                MARA_BUILD_CONFIG.buildStore
                            )
                        ) {

                            db.createObjectStore(
                                MARA_BUILD_CONFIG.buildStore,
                                {
                                    keyPath:
                                        "key"
                                }
                            );

                        }


                        if (
                            !db.objectStoreNames.contains(
                                MARA_BUILD_CONFIG.metaStore
                            )
                        ) {

                            db.createObjectStore(
                                MARA_BUILD_CONFIG.metaStore
                            );

                        }

                    };

            }
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

                const transaction =
                    MARA_BUILD_STATE.db.transaction(
                        MARA_BUILD_CONFIG.metaStore,
                        "readonly"
                    );


                const store =
                    transaction.objectStore(
                        MARA_BUILD_CONFIG.metaStore
                    );


                const request =
                    store.get(key);


                request.onsuccess =
                    () => {

                        resolve(
                            request.result
                        );

                    };


                request.onerror =
                    () => {

                        reject(
                            request.error
                        );

                    };

            }
        );

    }


    /* ========================================================
       GET ACTIVE BUILD
    ======================================================== */

    async function getActiveBuild() {

        /*
         * Format yang diharapkan:

         * {
         *     key: "ACTIVE_BUILD",
         *     build: 102,
         *     version: "1.0.0"
         * }
         */

        const metadata =
            await readMetadata(
                MARA_BUILD_CONFIG.activeBuildKey
            );


        if (
            metadata === undefined ||
            metadata === null
        ) {

            /*
             * Beberapa implementasi engine mungkin
             * menyimpan langsung:
             *
             * ACTIVE_BUILD = 102
             */

            if (
                typeof metadata ===
                "number"
            ) {

                return metadata;

            }


            throw new Error(
                "ACTIVE_BUILD belum tersedia."
            );

        }


        if (
            typeof metadata ===
            "number"
        ) {

            return metadata;

        }


        if (
            typeof metadata ===
            "string"
        ) {

            return metadata;

        }


        if (
            metadata.build !== undefined
        ) {

            return metadata.build;

        }


        if (
            metadata.version !== undefined
        ) {

            return metadata.version;

        }


        throw new Error(
            "Format ACTIVE_BUILD tidak dikenali."
        );

    }


    /* ========================================================
       FIND FILE
    ======================================================== */

    function findFile(
        build,
        path
    ) {

        return new Promise(
            (resolve, reject) => {

                const transaction =
                    MARA_BUILD_STATE.db.transaction(
                        MARA_BUILD_CONFIG.buildStore,
                        "readonly"
                    );


                const store =
                    transaction.objectStore(
                        MARA_BUILD_CONFIG.buildStore
                    );


                /*
                 * Beberapa struktur database mungkin
                 * menggunakan key:

                 * "102/lock-screen.html"

                 * atau:

                 * "build-102/lock-screen.html"
                 */

                const possibleKeys = [

                    `${build}/${path}`,

                    `build-${build}/${path}`,

                    `${build}:${path}`,

                    `${build}_${path}`

                ];


                let index =
                    0;


                function tryNext() {

                    if (
                        index >=
                        possibleKeys.length
                    ) {

                        /*
                         * Fallback:
                         *
                         * Cari seluruh record.
                         */

                        const cursorRequest =
                            store.openCursor();


                        cursorRequest.onsuccess =
                            event => {

                                const cursor =
                                    event.target.result;


                                if (!cursor) {

                                    reject(
                                        new Error(
                                            `File tidak ditemukan: ${path}`
                                        )
                                    );

                                    return;

                                }


                                const value =
                                    cursor.value;


                                if (
                                    value &&
                                    String(
                                        value.build
                                    ) ===
                                    String(build) &&
                                    value.path ===
                                    path
                                ) {

                                    resolve(
                                        value
                                    );

                                    return;

                                }


                                cursor.continue();

                            };


                        cursorRequest.onerror =
                            () => {

                                reject(
                                    cursorRequest.error
                                );

                            };


                        return;

                    }


                    const key =
                        possibleKeys[index++];


                    const request =
                        store.get(key);


                    request.onsuccess =
                        () => {

                            if (
                                request.result !==
                                undefined
                            ) {

                                resolve(
                                    request.result
                                );

                                return;

                            }


                            tryNext();

                        };


                    request.onerror =
                        () => {

                            tryNext();

                        };

                }


                tryNext();

            }
        );

    }


    /* ========================================================
       NORMALIZE FILE DATA
    ======================================================== */

    function normalizeFile(
        record
    ) {

        if (!record) {

            throw new Error(
                "Record file kosong."
            );

        }


        /*
         * Bentuk umum:

         * {
         *   key,
         *   build,
         *   path,
         *   blob
         * }
         */


        if (
            record.blob instanceof Blob
        ) {

            return {

                blob:
                    record.blob,

                path:
                    record.path

            };

        }


        if (
            record.data instanceof Blob
        ) {

            return {

                blob:
                    record.data,

                path:
                    record.path

            };

        }


        /*
         * ArrayBuffer
         */

        if (
            record.data instanceof
            ArrayBuffer
        ) {

            return {

                blob:
                    new Blob(
                        [
                            record.data
                        ],
                        {
                            type:
                                record.type ||
                                "application/octet-stream"
                        }
                    ),

                path:
                    record.path

            };

        }


        /*
         * String HTML/CSS/JS.
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
                                record.type ||
                                "text/plain"
                        }
                    ),

                path:
                    record.path

            };

        }


        /*
         * record.content
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
                                record.type ||
                                "text/plain"
                        }
                    ),

                path:
                    record.path

            };

        }


        throw new Error(
            "Format data file tidak didukung."
        );

    }


    /* ========================================================
       CREATE BLOB URL
    ======================================================== */

    function createFileURL(
        path,
        file
    ) {

        /*
         * Hapus URL lama jika ada.
         */

        if (
            MARA_BUILD_STATE.blobURLs.has(
                path
            )
        ) {

            URL.revokeObjectURL(
                MARA_BUILD_STATE.blobURLs.get(
                    path
                )
            );

        }


        const url =
            URL.createObjectURL(
                file.blob
            );


        MARA_BUILD_STATE.blobURLs.set(
            path,
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
            String(path)
                .replace(/^\/+/, "");


        /*
         * Cache runtime.
         */

        if (
            MARA_BUILD_STATE.files.has(
                normalizedPath
            )
        ) {

            return MARA_BUILD_STATE.files.get(
                normalizedPath
            );

        }


        const record =
            await findFile(
                MARA_BUILD_STATE.activeBuild,
                normalizedPath
            );


        const file =
            normalizeFile(
                record
            );


        const url =
            createFileURL(
                normalizedPath,
                file
            );


        const result = {

            path:
                normalizedPath,

            url:
                url,

            blob:
                file.blob,

            type:
                file.blob.type

        };


        MARA_BUILD_STATE.files.set(
            normalizedPath,
            result
        );


        return result;

    }


    /* ========================================================
       LOAD HTML INTO IFRAME
    ======================================================== */

    async function loadHTMLIntoFrame(
        frame,
        path
    ) {

        if (!frame) {

            throw new Error(
                "Iframe tidak ditemukan."
            );

        }


        const file =
            await loadBuildFile(
                path
            );


        /*
         * Memuat HTML dari Blob URL.
         */

        frame.src =
            file.url;


        return file;

    }


    /* ========================================================
       LOAD MAIN UX
    ======================================================== */

    async function loadMainUX() {

        /*
         * Cari iframe utama.
         *
         * Sesuaikan id/class jika diperlukan.
         */

        let frame =
            document.getElementById(
                "mara-main-frame"
            );


        if (!frame) {

            frame =
                document.querySelector(
                    ".mara-iframe"
                );

        }


        if (!frame) {

            throw new Error(
                "Iframe MARA utama tidak ditemukan."
            );

        }


        log(
            "Memuat lock-screen dari build:",
            MARA_BUILD_STATE.activeBuild
        );


        await loadHTMLIntoFrame(
            frame,
            MARA_BUILD_CONFIG.entryFile
        );


        log(
            "Lock screen build aktif berhasil dimuat."
        );

    }


    /* ========================================================
       GET FILE URL
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
       LOAD HOME SCREEN
    ======================================================== */

    async function loadHomeScreen(
        frame
    ) {

        return loadHTMLIntoFrame(
            frame,
            "home-screen.html"
        );

    }


    /* ========================================================
       LOAD CONTROL CENTER
    ======================================================== */

    async function loadControlCenter(
        frame
    ) {

        return loadHTMLIntoFrame(
            frame,
            "control-center.html"
        );

    }


    /* ========================================================
       CLEAN BLOB URL
    ======================================================== */

    function revokeURLs() {

        for (
            const url of
            MARA_BUILD_STATE.blobURLs.values()
        ) {

            try {

                URL.revokeObjectURL(
                    url
                );

            } catch (_) {}

        }


        MARA_BUILD_STATE.blobURLs.clear();

        MARA_BUILD_STATE.files.clear();

    }


    /* ========================================================
       START
    ======================================================== */

    async function start() {

        if (
            MARA_BUILD_STATE.started
        ) {

            return;

        }


        MARA_BUILD_STATE.started =
            true;


        try {

            log(
                "Build Runtime dimulai."
            );


            /*
             * IndexedDB.
             */

            await openDatabase();


            /*
             * ACTIVE_BUILD.
             */

            const activeBuild =
                await getActiveBuild();


            MARA_BUILD_STATE.activeBuild =
                activeBuild;


            log(
                "ACTIVE_BUILD:",
                activeBuild
            );


            /*
             * Load UX utama.
             */

            await loadMainUX();


            MARA_BUILD_STATE.ready =
                true;


            log(
                "MARA UX siap."
            );


            /*
             * Beri tahu sistem lain.
             */

            window.dispatchEvent(
                new CustomEvent(
                    "MARA_BUILD_READY",
                    {
                        detail: {

                            build:
                                activeBuild

                        }
                    }
                )
            );


            /*
             * postMessage ke parent.
             */

            if (
                window.parent &&
                window.parent !==
                    window
            ) {

                window.parent.postMessage(
                    {

                        type:
                            "MARA_BUILD_READY",

                        build:
                            activeBuild

                    },
                    "*"
                );

            }


            return {

                success:
                    true,

                build:
                    activeBuild

            };

        } catch (err) {

            error(
                "Build Runtime gagal:",
                err
            );


            MARA_BUILD_STATE.started =
                false;


            window.dispatchEvent(
                new CustomEvent(
                    "MARA_BUILD_ERROR",
                    {
                        detail: {

                            error:
                                err

                        }
                    }
                )
            );


            if (
                window.parent &&
                window.parent !==
                    window
            ) {

                window.parent.postMessage(
                    {

                        type:
                            "MARA_BUILD_ERROR",

                        message:
                            err.message

                    },
                    "*"
                );

            }


            throw err;

        }

    }


    /* ========================================================
       PUBLIC API
    ======================================================== */

    window.MARABuild = {

        start,

        getActiveBuild:
            () =>
                MARA_BUILD_STATE.activeBuild,

        getURL,

        loadBuildFile,

        loadHTMLIntoFrame,

        loadHomeScreen,

        loadControlCenter,

        revokeURLs,

        isReady:
            () =>
                MARA_BUILD_STATE.ready

    };


    /* ========================================================
       AUTO START
    ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            () => {

                start().catch(
                    err => {

                        error(
                            "Startup error:",
                            err
                        );

                    }
                );

            },
            {
                once: true
            }
        );

    } else {

        start().catch(
            err => {

                error(
                    "Startup error:",
                    err
                );

            }
        );

    }


})();