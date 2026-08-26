/*
 * ============================================================
 * MARA OS — BUILD RUNTIME ENGINE
 * ============================================================
 *
 * BUILD.JS
 *
 * Tanggung jawab:
 *
 *   engine-single.js
 *          │
 *          ├── check update
 *          ├── download
 *          ├── install
 *          ├── verify
 *          └── READY
 *                    │
 *                    ▼
 *               BUILD.JS
 *                    │
 *                    ├── IndexedDB
 *                    ├── ACTIVE_BUILD
 *                    ├── metadata
 *                    ├── build files
 *                    ├── Blob URL
 *                    └── MAIN UX
 *
 * ============================================================
 *
 * PENTING
 *
 * BUILD.JS TIDAK:
 *
 *   ❌ download upgrade
 *   ❌ install upgrade
 *   ❌ verify upgrade
 *   ❌ membuat progress upgrade
 *   ❌ mengambil alih loading engine-single.js
 *
 * Semua pekerjaan upgrade adalah tanggung jawab:
 *
 *   engine-single.js
 *
 * ============================================================
 *
 * SAAT ENGINE SEDANG BEKERJA
 *
 *   DOWNLOAD
 *   INSTALL
 *   VERIFY
 *   UPGRADE
 *
 * BUILD.JS:
 *
 *   → diam
 *   → tidak menampilkan terminal
 *   → tidak menampilkan progress palsu
 *   → menunggu ENGINE READY
 *
 * ============================================================
 *
 * SAAT TIDAK ADA PEKERJAAN ENGINE
 *
 * BUILD.JS dapat menampilkan terminal diagnostik:
 *
 *   [INFO] Checking database...
 *   [OK] IndexedDB connected
 *   [INFO] Checking ACTIVE_BUILD...
 *   [OK] Active build: ...
 *   [INFO] Checking metadata...
 *   [INFO] Upgrade belum tersedia
 *
 * ============================================================
 */

(() => {

    "use strict";


    /* ========================================================
       CONFIGURATION
    ======================================================== */

    const MARA_BUILD_CONFIG = {

        dbName:
            "MARA_OS_UPGRADE_DB",

        dbVersion:
            1,

        buildStore:
            "builds",

        metaStore:
            "metadata",

        activeBuildKey:
            "ACTIVE_BUILD",

        entryFile:
            "lock-screen.html",

        databaseTimeout:
            10000,

        fileTimeout:
            10000,

        /*
         * Waktu tunggu awal untuk menerima status
         * dari engine-single.js.
         *
         * Ini BUKAN progress upgrade.
         */

        engineHandshakeTimeout:
            3000,

        /*
         * Interval pemeriksaan engine.

         */

        enginePollInterval:
            100,

        /*
         * Maksimum waktu menunggu engine
         * menyelesaikan pekerjaan.

         */

        engineWorkTimeout:
            300000,

        /*
         * Terminal diagnostik hanya dibuat
         * ketika memang diperlukan.

         */

        terminalEnabled:
            true

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
            null,

        startPromise:
            null,

        terminal:
            null

    };


    /* ========================================================
       ENGINE STATE
    ======================================================== */

    const ENGINE_STATE = {

        state:
            "UNKNOWN",

        progress:
            0,

        active:
            false,

        ready:
            false,

        idle:
            false,

        received:
            false,

        error:
            null,

        metadata:
            null,

        updatedAt:
            null

    };


    /* ========================================================
       ENGINE ACTIVE STATES
    ======================================================== */

    const ENGINE_ACTIVE_STATES = [

        "STARTING",

        "CHECKING",

        "CHECKING_UPDATE",

        "DOWNLOADING",

        "DOWNLOADED",

        "INSTALLING",

        "INSTALL",

        "VERIFYING",

        "VERIFY",

        "UPGRADING",

        "PROCESSING"

    ];


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
            typeof build ===
            "object"
        ) {

            if (
                build.build !==
                undefined
            ) {

                return String(
                    build.build
                );

            }


            if (
                build.version !==
                undefined
            ) {

                return String(
                    build.version
                );

            }


            if (
                build.id !==
                undefined
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
            typeof Blob !==
                "undefined" &&
            value instanceof Blob
        );

    }


    function isArrayBuffer(value) {

        return (
            typeof ArrayBuffer !==
                "undefined" &&
            value instanceof ArrayBuffer
        );

    }


    function isTypedArray(value) {

        return (
            typeof ArrayBuffer !==
                "undefined" &&
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
       ENGINE STATE
       ======================================================== */

    function isEngineBusy() {

        return (
            ENGINE_STATE.active ===
            true
        );

    }


    function normalizeEngineState(
        state
    ) {

        return String(
            state ||
            "UNKNOWN"
        )
            .trim()
            .toUpperCase();

    }


    function updateEngineState(
        state,
        progress = 0,
        data = {}
    ) {

        const normalized =
            normalizeEngineState(
                state
            );


        ENGINE_STATE.state =
            normalized;


        const numericProgress =
            Number(
                progress
            );


        ENGINE_STATE.progress =
            Number.isFinite(
                numericProgress
            )
                ? Math.max(
                    0,
                    Math.min(
                        100,
                        numericProgress
                    )
                )
                : 0;


        ENGINE_STATE.active =
            ENGINE_ACTIVE_STATES.includes(
                normalized
            );


        ENGINE_STATE.ready =
            normalized ===
            "READY";


        ENGINE_STATE.idle =
            normalized ===
            "IDLE";


        ENGINE_STATE.received =
            true;


        ENGINE_STATE.error =
            data.error ||
            data.message ||
            null;


        ENGINE_STATE.metadata =
            data.metadata ||
            null;


        ENGINE_STATE.updatedAt =
            Date.now();


        /*
         * Kalau engine sudah READY,
         * progress secara logika dianggap 100%.
         */

        if (
            ENGINE_STATE.ready
        ) {

            ENGINE_STATE.progress =
                100;

        }


        log(
            "ENGINE STATE:",
            ENGINE_STATE.state,
            ENGINE_STATE.progress + "%"
        );


        dispatchEvent(
            "MARA_ENGINE_STATE",
            {
                state:
                    ENGINE_STATE.state,

                progress:
                    ENGINE_STATE.progress,

                active:
                    ENGINE_STATE.active,

                ready:
                    ENGINE_STATE.ready,

                idle:
                    ENGINE_STATE.idle,

                error:
                    ENGINE_STATE.error,

                metadata:
                    ENGINE_STATE.metadata
            }
        );

    }


    /* ========================================================
       ENGINE MESSAGE LISTENER
       ======================================================== */

    function handleEngineMessage(
        event
    ) {

        const data =
            event.data;


        if (
            !data ||
            typeof data !==
            "object"
        ) {

            return;

        }


        /*
         * Format utama.
         */

        if (
            data.type ===
            "MARA_ENGINE_STATE"
        ) {

            updateEngineState(
                data.state,
                data.progress,
                data
            );

            return;

        }


        /*
         * Alias status mulai.

         */

        if (
            data.type ===
            "MARA_ENGINE_STARTING"
        ) {

            updateEngineState(
                "STARTING",
                data.progress,
                data
            );

            return;

        }


        /*
         * Alias download.

         */

        if (
            data.type ===
            "MARA_ENGINE_DOWNLOADING"
        ) {

            updateEngineState(
                "DOWNLOADING",
                data.progress,
                data
            );

            return;

        }


        /*
         * Alias install.

         */

        if (
            data.type ===
            "MARA_ENGINE_INSTALLING"
        ) {

            updateEngineState(
                "INSTALLING",
                data.progress,
                data
            );

            return;

        }


        /*
         * Alias verify.

         */

        if (
            data.type ===
            "MARA_ENGINE_VERIFYING"
        ) {

            updateEngineState(
                "VERIFYING",
                data.progress,
                data
            );

            return;

        }


        /*
         * Alias READY.

         */

        if (
            data.type ===
            "MARA_ENGINE_READY"
        ) {

            updateEngineState(
                "READY",
                100,
                data
            );

            return;

        }


        /*
         * Alias IDLE.

         */

        if (
            data.type ===
            "MARA_ENGINE_IDLE"
        ) {

            updateEngineState(
                "IDLE",
                0,
                data
            );

            return;

        }


        /*
         * Alias ERROR.

         */

        if (
            data.type ===
            "MARA_ENGINE_ERROR"
        ) {

            updateEngineState(
                "ERROR",
                data.progress,
                data
            );

        }

    }


    window.addEventListener(
        "message",
        handleEngineMessage
    );


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
       TERMINAL
       ======================================================== */

    function ensureTerminal() {

        if (
            !MARA_BUILD_CONFIG.terminalEnabled
        ) {

            return null;

        }


        if (
            STATE.terminal
        ) {

            return STATE.terminal;

        }


        const terminal =
            document.createElement(
                "div"
            );


        terminal.id =
            "mara-build-terminal";


        terminal.setAttribute(
            "aria-hidden",
            "true"
        );


        terminal.style.cssText = [

            "position:fixed",

            "left:12px",

            "right:12px",

            "bottom:12px",

            "max-height:42vh",

            "overflow:auto",

            "box-sizing:border-box",

            "padding:14px",

            "background:rgba(5,5,5,.96)",

            "color:#d8ffd8",

            "font-family:monospace",

            "font-size:12px",

            "line-height:1.55",

            "border:1px solid rgba(120,255,120,.25)",

            "border-radius:10px",

            "box-shadow:0 8px 30px rgba(0,0,0,.35)",

            /*
             * Harus berada di bawah status bar.
             */

            "z-index:900",

            "display:none",

            "pointer-events:none"

        ].join(";");


        document.body.appendChild(
            terminal
        );


        STATE.terminal =
            terminal;


        return terminal;

    }


    function showTerminal() {

        /*
         * Jangan pernah menampilkan terminal
         * ketika engine sedang bekerja.

         */

        if (
            isEngineBusy()
        ) {

            return;

        }


        const terminal =
            ensureTerminal();


        if (
            !terminal
        ) {

            return;

        }


        terminal.style.display =
            "block";

    }


    function hideTerminal() {

        if (
            STATE.terminal
        ) {

            STATE.terminal.style.display =
                "none";

        }

    }


    function clearTerminal() {

        if (
            STATE.terminal
        ) {

            STATE.terminal.innerHTML =
                "";

        }

    }


    function terminalLog(
        message,
        type = "INFO"
    ) {

        /*
         * Saat engine bekerja,
         * terminal tidak boleh menerima output.

         */

        if (
            isEngineBusy()
        ) {

            return;

        }


        const terminal =
            ensureTerminal();


        if (
            !terminal
        ) {

            return;

        }


        showTerminal();


        const line =
            document.createElement(
                "div"
            );


        const time =
            new Date()
                .toLocaleTimeString(
                    "id-ID"
                );


        line.textContent =
            `[${time}] [${type}] ${message}`;


        terminal.appendChild(
            line
        );


        terminal.scrollTop =
            terminal.scrollHeight;

    }


    function terminalInfo(
        message
    ) {

        terminalLog(
            message,
            "INFO"
        );

    }


    function terminalOK(
        message
    ) {

        terminalLog(
            message,
            "OK"
        );

    }


    function terminalError(
        message
    ) {

        terminalLog(
            message,
            "ERROR"
        );

    }


    function terminalWarn(
        message
    ) {

        terminalLog(
            message,
            "WARN"
        );

    }


    /* ========================================================
       ENGINE HANDOFF
       ======================================================== */

    function wait(
        milliseconds
    ) {

        return new Promise(
            resolve => {

                setTimeout(
                    resolve,
                    milliseconds
                );

            }
        );

    }


    async function waitForEngineHandoff() {

        /*
         * Jika engine sudah bekerja,
         * tunggu sampai selesai.

         */

        if (
            isEngineBusy()
        ) {

            hideTerminal();


            const started =
                Date.now();


            while (
                isEngineBusy()
            ) {

                if (
                    Date.now() -
                    started >=
                    MARA_BUILD_CONFIG.engineWorkTimeout
                ) {

                    throw new Error(
                        "Timeout menunggu engine-single.js."
                    );

                }


                await wait(
                    MARA_BUILD_CONFIG.enginePollInterval
                );

            }


            return ENGINE_STATE;

        }


        /*
         * Jika engine sudah READY.

         */

        if (
            ENGINE_STATE.ready
        ) {

            return ENGINE_STATE;

        }


        /*
         * Beri kesempatan singkat kepada
         * engine-single.js untuk mengirim
         * status awal.

         */

        const started =
            Date.now();


        while (
            Date.now() -
            started <
            MARA_BUILD_CONFIG.engineHandshakeTimeout
        ) {

            if (
                isEngineBusy()
            ) {

                hideTerminal();


                const workStarted =
                    Date.now();


                while (
                    isEngineBusy()
                ) {

                    if (
                        Date.now() -
                        workStarted >=
                        MARA_BUILD_CONFIG.engineWorkTimeout
                    ) {

                        throw new Error(
                            "Timeout menunggu proses engine."
                        );

                    }


                    await wait(
                        MARA_BUILD_CONFIG.enginePollInterval
                    );

                }


                return ENGINE_STATE;

            }


            if (
                ENGINE_STATE.ready
            ) {

                return ENGINE_STATE;

            }


            await wait(
                MARA_BUILD_CONFIG.enginePollInterval
            );

        }


        /*
         * Tidak ada aktivitas engine.
         *
         * Build.js boleh bekerja.

         */

        return ENGINE_STATE;

    }


    /* ========================================================
       OPEN DATABASE
       ======================================================== */

    function openDatabase() {

        return new Promise(
            (
                resolve,
                reject
            ) => {

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
            (
                resolve,
                reject
            ) => {

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
            metadata ===
            undefined ||
            metadata ===
            null
        ) {

            throw new Error(
                "ACTIVE_BUILD belum tersedia."
            );

        }


        let build =
            null;


        if (
            typeof metadata ===
            "number"
        ) {

            build =
                metadata;

        }

        else if (
            typeof metadata ===
            "string"
        ) {

            build =
                metadata;

        }

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
            build ===
            null ||
            build ===
            undefined
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


        return STATE.db
            .transaction(
                MARA_BUILD_CONFIG.buildStore,
                "readonly"
            )
            .objectStore(
                MARA_BUILD_CONFIG.buildStore
            );

    }


    /* ========================================================
       GET BY KEY
       ======================================================== */

    function getByKey(
        key
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

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


        const recordPath =
            normalizePath(
                record.path ||
                record.file ||
                record.name ||
                ""
            );


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


        if (
            recordBuild !==
            null &&
            recordBuild !==
            targetBuild
        ) {

            return false;

        }


        if (
            recordPath ===
            targetPath
        ) {

            return true;

        }


        const recordKey =
            normalizePath(
                record.key ||
                ""
            );


        return generatePossibleKeys(
            build,
            path
        ).includes(
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
            (
                resolve,
                reject
            ) => {

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


        if (
            isBlob(record)
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


                            cleanup();


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
                    onLoad
                );


                frame.addEventListener(
                    "error",
                    onError
                );


                frame.src =
                    file.url;

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
       PRELOAD
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
       CACHE
       ======================================================== */

    function clearCache() {

        STATE.files.clear();

    }


    /* ========================================================
       REVOKE URL
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
       DIAGNOSTIC TERMINAL
       ======================================================== */

    async function runDiagnostics() {

        /*
         * Jangan menjalankan terminal
         * ketika engine sedang bekerja.

         */

        if (
            isEngineBusy()
        ) {

            return {

                skipped:
                    true,

                reason:
                    "ENGINE_BUSY"

            };

        }


        clearTerminal();

        showTerminal();


        terminalInfo(
            "MARA OS BUILD RUNTIME"
        );


        terminalInfo(
            "Checking local database..."
        );


        /*
         * DATABASE
         */

        try {

            await openDatabase();


            terminalOK(
                "IndexedDB connected."
            );

        } catch (err) {

            terminalError(
                err.message
            );


            throw err;

        }


        /*
         * STORE
         */

        if (
            hasStore(
                MARA_BUILD_CONFIG.metaStore
            )
        ) {

            terminalOK(
                "Metadata store tersedia."
            );

        } else {

            terminalError(
                "Metadata store tidak ditemukan."
            );

        }


        if (
            hasStore(
                MARA_BUILD_CONFIG.buildStore
            )
        ) {

            terminalOK(
                "Build store tersedia."
            );

        } else {

            terminalError(
                "Build store tidak ditemukan."
            );

        }


        /*
         * ACTIVE BUILD
         */

        terminalInfo(
            "Checking ACTIVE_BUILD..."
        );


        try {

            const build =
                await getActiveBuild();


            terminalOK(
                `Active build: ${build}`
            );

        } catch (err) {

            terminalWarn(
                err.message
            );


            /*
             * Tidak langsung memaksa
             * layar menjadi hitam.

             */

            return {

                success:
                    false,

                activeBuild:
                    null,

                error:
                    err

            };

        }


        /*
         * METADATA
         */

        terminalInfo(
            "Checking metadata..."
        );


        if (
            STATE.activeMetadata !==
            undefined &&
            STATE.activeMetadata !==
            null
        ) {

            terminalOK(
                "Metadata tersedia."
            );

        } else {

            terminalWarn(
                "Metadata belum tersedia."
            );

        }


        /*
         * ENGINE STATUS
         */

        terminalInfo(
            "Checking engine state..."
        );


        if (
            ENGINE_STATE.received
        ) {

            terminalOK(
                `Engine state: ${ENGINE_STATE.state}`
            );

        } else {

            terminalInfo(
                "Engine tidak mengirim pekerjaan upgrade."
            );

        }


        /*
         * UPGRADE
         *
         * Build.js tidak melakukan pengecekan
         * download/update sendiri.
         *
         * Informasi ini hanya status diagnostik.

         */

        if (
            ENGINE_STATE.idle ||
            !ENGINE_STATE.active
        ) {

            terminalInfo(
                "Upgrade belum tersedia"
            );

        }


        terminalInfo(
            "Diagnostic check selesai."
        );


        return {

            success:
                true,

            build:
                STATE.activeBuild,

            metadata:
                STATE.activeMetadata,

            engine:
                {
                    state:
                        ENGINE_STATE.state,

                    active:
                        ENGINE_STATE.active,

                    ready:
                        ENGINE_STATE.ready,

                    idle:
                        ENGINE_STATE.idle
                }

        };

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
                ),

            engine:
                {

                    state:
                        ENGINE_STATE.state,

                    progress:
                        ENGINE_STATE.progress,

                    active:
                        ENGINE_STATE.active,

                    ready:
                        ENGINE_STATE.ready,

                    idle:
                        ENGINE_STATE.idle,

                    received:
                        ENGINE_STATE.received

                }

        };

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
                     * =================================================
                     * ENGINE HANDOFF
                     * =================================================
                     *
                     * Ini bagian paling penting.
                     *
                     * Jika engine sedang:
                     *
                     *   DOWNLOAD
                     *   INSTALL
                     *   VERIFY
                     *
                     * build.js TIDAK menampilkan terminal.

                     */

                    await waitForEngineHandoff();


                    /*
                     * Kalau setelah handoff engine
                     * ternyata mulai bekerja, tunggu lagi.

                     */

                    if (
                        isEngineBusy()
                    ) {

                        hideTerminal();


                        await waitForEngineHandoff();

                    }


                    /*
                     * =================================================
                     * DATABASE
                     * =================================================
                     */

                    if (
                        !isEngineBusy()
                    ) {

                        /*
                         * Terminal baru boleh muncul
                         * ketika engine tidak bekerja.

                         */

                        clearTerminal();

                        showTerminal();


                        terminalInfo(
                            "MARA OS BUILD RUNTIME"
                        );


                        terminalInfo(
                            "Checking local database..."
                        );

                    }


                    await openDatabase();


                    if (
                        !isEngineBusy()
                    ) {

                        terminalOK(
                            "IndexedDB connected."
                        );

                    }


                    /*
                     * =================================================
                     * CHECK STORES
                     * =================================================
                     */

                    if (
                        !hasStore(
                            MARA_BUILD_CONFIG.metaStore
                        )
                    ) {

                        if (
                            !isEngineBusy()
                        ) {

                            terminalError(
                                "Object store metadata tidak ditemukan."
                            );

                        }

                    }


                    if (
                        !hasStore(
                            MARA_BUILD_CONFIG.buildStore
                        )
                    ) {

                        if (
                            !isEngineBusy()
                        ) {

                            terminalError(
                                "Object store builds tidak ditemukan."
                            );

                        }

                    }


                    /*
                     * =================================================
                     * ACTIVE BUILD
                     * =================================================
                     */

                    if (
                        !isEngineBusy()
                    ) {

                        terminalInfo(
                            "Checking ACTIVE_BUILD..."
                        );

                    }


                    let activeBuild;


                    try {

                        activeBuild =
                            await getActiveBuild();

                    } catch (err) {

                        /*
                         * Jangan langsung membiarkan
                         * aplikasi menjadi layar hitam.

                         */

                        if (
                            !isEngineBusy()
                        ) {

                            terminalWarn(
                                err.message
                            );


                            terminalInfo(
                                "Menunggu build aktif..."
                            );

                        }


                        /*
                         * Beri kesempatan engine
                         * menyelesaikan pekerjaan.

                         */

                        await waitForEngineHandoff();


                        /*
                         * Coba sekali lagi.

                         */

                        activeBuild =
                            await getActiveBuild();

                    }


                    if (
                        !isEngineBusy()
                    ) {

                        terminalOK(
                            `Active build: ${activeBuild}`
                        );

                    }


                    /*
                     * =================================================
                     * ACTIVE BUILD EVENT
                     * =================================================
                     */

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
                                activeBuild,

                            metadata:
                                STATE.activeMetadata
                        }
                    );


                    /*
                     * =================================================
                     * METADATA
                     * =================================================
                     */

                    if (
                        !isEngineBusy()
                    ) {

                        terminalInfo(
                            "Checking metadata..."
                        );


                        if (
                            STATE.activeMetadata
                        ) {

                            terminalOK(
                                "Metadata tersedia."
                            );

                        } else {

                            terminalWarn(
                                "Metadata belum tersedia."
                            );

                        }

                    }


                    /*
                     * =================================================
                     * UPGRADE STATUS
                     * =================================================
                     *
                     * Build.js TIDAK melakukan upgrade.
                     *
                     * Hanya memberi status apabila
                     * engine tidak mempunyai pekerjaan.

                     */

                    if (
                        !isEngineBusy()
                    ) {

                        if (
                            ENGINE_STATE.ready
                        ) {

                            terminalOK(
                                "Engine upgrade selesai."
                            );

                        }

                        else {

                            terminalInfo(
                                "Upgrade belum tersedia"
                            );

                        }

                    }


                    /*
                     * =================================================
                     * MAIN UX
                     * =================================================
                     */

                    /*
                     * Pastikan engine tidak sedang
                     * melakukan pekerjaan baru sebelum
                     * membuka UX.

                     */

                    if (
                        isEngineBusy()
                    ) {

                        hideTerminal();


                        await waitForEngineHandoff();

                    }


                    /*
                     * Terminal diagnostik tidak diperlukan
                     * setelah UX siap.

                     */

                    const mainFile =
                        await loadMainUX();


                    /*
                     * =================================================
                     * READY
                     * =================================================
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


                    /*
                     * Terminal disembunyikan ketika
                     * UX utama sudah aktif.

                     */

                    hideTerminal();


                    const result = {

                        success:
                            true,

                        build:
                            activeBuild,

                        file:
                            mainFile.path,

                        readyAt:
                            STATE.readyAt

                    };


                    dispatchEvent(
                        "MARA_BUILD_READY",
                        result
                    );


                    sendParentMessage(
                        "MARA_BUILD_READY",
                        result
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


                    /*
                     * Kalau engine sedang bekerja,
                     * jangan menampilkan terminal error
                     * agar tidak mengganggu loading upgrade.

                     */

                    if (
                        !isEngineBusy()
                    ) {

                        showTerminal();


                        terminalError(
                            err.message ||
                            "Build Runtime gagal."
                        );

                    }


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

        hideTerminal();


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
         * Runtime
         */

        start:
            start,

        stop:
            stop,


        /*
         * Build
         */

        getActiveBuild:
            () =>
                STATE.activeBuild,

        getActiveMetadata:
            () =>
                STATE.activeMetadata,


        /*
         * File
         */

        getURL:
            getURL,

        loadBuildFile:
            loadBuildFile,


        /*
         * HTML
         */

        loadHTMLIntoFrame:
            loadHTMLIntoFrame,


        /*
         * UX
         */

        loadMainUX:
            loadMainUX,

        loadHomeScreen:
            loadHomeScreen,

        loadControlCenter:
            loadControlCenter,


        /*
         * Preload
         */

        preload:
            preload,


        /*
         * Build refresh
         */

        refreshActiveBuild:
            refreshActiveBuild,


        /*
         * Cache
         */

        clearCache:
            clearCache,

        revokeURLs:
            revokeURLs,


        /*
         * Database
         */

        closeDatabase:
            closeDatabase,


        /*
         * Diagnostics
         */

        runDiagnostics:
            runDiagnostics,


        /*
         * Engine state
         */

        getEngineState:
            () => {

                return {

                    state:
                        ENGINE_STATE.state,

                    progress:
                        ENGINE_STATE.progress,

                    active:
                        ENGINE_STATE.active,

                    ready:
                        ENGINE_STATE.ready,

                    idle:
                        ENGINE_STATE.idle,

                    received:
                        ENGINE_STATE.received,

                    error:
                        ENGINE_STATE.error,

                    metadata:
                        ENGINE_STATE.metadata

                };

            },


        /*
         * Runtime ready
         */

        isReady:
            () =>
                STATE.ready,


        /*
         * Runtime state
         */

        getState:
            getState

    };


    /* ========================================================
       GLOBAL ALIAS
       ======================================================== */

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
             * Tutup database ketika lifecycle
             * halaman selesai.

             *
             * Blob URL tidak direvoke agresif
             * di sini supaya perpindahan lifecycle
             * tidak merusak runtime secara tiba-tiba.

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