/*
 * ============================================================
 * MARA OS — BUILD RUNTIME ENGINE
 * ============================================================
 *
 * FILE:
 *
 *     ux/build.js
 *
 * VERSION:
 *
 *     BUILD RUNTIME v3
 *
 * ============================================================
 *
 * RESPONSIBILITY
 * ============================================================
 *
 * engine-single.js
 *     ├── check
 *     ├── download
 *     ├── install
 *     ├── verify
 *     ├── upgrade
 *     └── ACTIVE_BUILD
 *
 * build.js
 *     ├── read ACTIVE_BUILD
 *     ├── read metadata
 *     ├── read build files
 *     ├── Blob URL
 *     ├── cache
 *     ├── preload
 *     ├── MAIN UX
 *     ├── runtime recovery
 *     └── diagnostics
 *
 * ============================================================
 *
 * BUILD.JS TIDAK:
 *
 *     ✗ download update
 *     ✗ install update
 *     ✗ verify update
 *     ✗ menentukan update
 *     ✗ menjalankan upgrade
 *     ✗ mengatur progress upgrade
 *
 * ============================================================
 */

(() => {

    "use strict";


    /* ========================================================
       CONFIGURATION
       ======================================================== */

    const CONFIG = {

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
            15000,

        engineHandshakeTimeout:
            5000,

        enginePollInterval:
            100,

        engineWorkTimeout:
            300000,

        recoveryRetries:
            2,

        recoveryDelay:
            250,

        terminalEnabled:
            true

    };


    /* ========================================================
       RUNTIME SESSION
       ======================================================== */

    function createSessionId() {

        try {

            if (
                crypto &&
                typeof crypto.randomUUID ===
                    "function"
            ) {

                return crypto.randomUUID();

            }

        } catch (_) {}


        return (
            "mara-" +
            Date.now() +
            "-" +
            Math.random()
                .toString(36)
                .slice(2)
        );

    }


    /* ========================================================
       RUNTIME STATE
       ======================================================== */

    const STATE = {

        sessionId:
            createSessionId(),

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

        buildCache:
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
            null,

        mainFrame:
            null,

        mainFile:
            null,

        lastBuildChange:
            null,

        recoveryCount:
            0

    };


    /* ========================================================
       ENGINE STATE
       ======================================================== */

    const ENGINE = {

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
            0

    };


    /* ========================================================
       ENGINE ACTIVE STATES
       ======================================================== */

    const ENGINE_ACTIVE_STATES =
        new Set([

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
            "PROCESSING",
            "UPDATING",
            "COMMITTING"

        ]);


    /* ========================================================
       LOGGING
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

    function wait(ms) {

        return new Promise(
            resolve => {

                setTimeout(
                    resolve,
                    ms
                );

            }
        );

    }


    function normalizePath(path) {

        if (
            path === null ||
            path === undefined
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
            build === null ||
            build === undefined
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


            if (
                build.activeBuild !== undefined
            ) {

                return String(
                    build.activeBuild
                );

            }

        }


        return String(build);

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
       CACHE KEY
       ======================================================== */

    function makeCacheKey(
        build,
        path
    ) {

        return (
            normalizeBuild(build) +
            "::" +
            normalizePath(path)
        );

    }


    /* ========================================================
       EVENT DISPATCHER
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
                        detail
                    }
                )
            );

        } catch (err) {

            warn(
                "Event dispatch gagal:",
                type,
                err
            );

        }

    }


    function sendParentMessage(
        type,
        data = {}
    ) {

        if (
            !window.parent ||
            window.parent === window
        ) {

            return;

        }


        try {

            window.parent.postMessage(
                {
                    type,
                    ...data
                },
                "*"
            );

        } catch (err) {

            warn(
                "Parent message gagal:",
                err
            );

        }

    }


    /* ========================================================
       ENGINE STATE
       ======================================================== */

    function normalizeEngineState(
        state
    ) {

        return String(
            state || "UNKNOWN"
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


        let numericProgress =
            Number(progress);


        if (
            !Number.isFinite(
                numericProgress
            )
        ) {

            numericProgress =
                0;

        }


        numericProgress =
            Math.max(
                0,
                Math.min(
                    100,
                    numericProgress
                )
            );


        ENGINE.state =
            normalized;


        ENGINE.progress =
            numericProgress;


        ENGINE.active =
            ENGINE_ACTIVE_STATES.has(
                normalized
            );


        ENGINE.ready =
            normalized === "READY";


        ENGINE.idle =
            normalized === "IDLE";


        ENGINE.received =
            true;


        ENGINE.error =
            data.error ||
            data.message ||
            null;


        ENGINE.metadata =
            data.metadata ||
            data.meta ||
            null;


        ENGINE.updatedAt =
            Date.now();


        if (
            ENGINE.ready
        ) {

            ENGINE.progress =
                100;

        }


        dispatchEvent(
            "MARA_ENGINE_STATE",
            {

                state:
                    ENGINE.state,

                progress:
                    ENGINE.progress,

                active:
                    ENGINE.active,

                ready:
                    ENGINE.ready,

                idle:
                    ENGINE.idle,

                error:
                    ENGINE.error,

                metadata:
                    ENGINE.metadata

            }
        );


        if (
            ENGINE.ready
        ) {

            dispatchEvent(
                "MARA_BUILD_ENGINE_READY",
                {

                    state:
                        ENGINE.state,

                    metadata:
                        ENGINE.metadata

                }
            );

        }


        if (
            ENGINE.error
        ) {

            dispatchEvent(
                "MARA_BUILD_ENGINE_ERROR",
                {

                    error:
                        ENGINE.error

                }
            );

        }


        log(
            "ENGINE:",
            ENGINE.state,
            ENGINE.progress + "%"
        );

    }


    /* ========================================================
       ENGINE MESSAGE HANDLER
       ======================================================== */

    function handleEngineMessage(
        event
    ) {

        const data =
            event.data;


        if (
            !data ||
            typeof data !== "object"
        ) {

            return;

        }


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


        const aliases = {

            MARA_ENGINE_STARTING:
                "STARTING",

            MARA_ENGINE_CHECKING:
                "CHECKING",

            MARA_ENGINE_CHECKING_UPDATE:
                "CHECKING_UPDATE",

            MARA_ENGINE_DOWNLOADING:
                "DOWNLOADING",

            MARA_ENGINE_DOWNLOADED:
                "DOWNLOADED",

            MARA_ENGINE_INSTALLING:
                "INSTALLING",

            MARA_ENGINE_INSTALL:
                "INSTALL",

            MARA_ENGINE_VERIFYING:
                "VERIFYING",

            MARA_ENGINE_VERIFY:
                "VERIFY",

            MARA_ENGINE_UPGRADING:
                "UPGRADING",

            MARA_ENGINE_PROCESSING:
                "PROCESSING",

            MARA_ENGINE_READY:
                "READY",

            MARA_ENGINE_IDLE:
                "IDLE",

            MARA_ENGINE_ERROR:
                "ERROR"

        };


        if (
            aliases[data.type]
        ) {

            updateEngineState(
                aliases[data.type],
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
       DIRECT ENGINE EVENT
       ======================================================== */

    window.addEventListener(
        "MARA_ENGINE_STATE",
        event => {

            const detail =
                event.detail;


            if (
                !detail ||
                typeof detail !== "object"
            ) {

                return;

            }


            updateEngineState(
                detail.state,
                detail.progress,
                detail
            );

        }
    );


    /* ========================================================
       ENGINE ALIASES
       ======================================================== */

    const ENGINE_EVENT_ALIASES = {

        MARA_ENGINE_STARTING:
            "STARTING",

        MARA_ENGINE_CHECKING:
            "CHECKING",

        MARA_ENGINE_CHECKING_UPDATE:
            "CHECKING_UPDATE",

        MARA_ENGINE_DOWNLOADING:
            "DOWNLOADING",

        MARA_ENGINE_DOWNLOADED:
            "DOWNLOADED",

        MARA_ENGINE_INSTALLING:
            "INSTALLING",

        MARA_ENGINE_INSTALL:
            "INSTALL",

        MARA_ENGINE_VERIFYING:
            "VERIFYING",

        MARA_ENGINE_VERIFY:
            "VERIFY",

        MARA_ENGINE_UPGRADING:
            "UPGRADING",

        MARA_ENGINE_PROCESSING:
            "PROCESSING",

        MARA_ENGINE_READY:
            "READY",

        MARA_ENGINE_IDLE:
            "IDLE",

        MARA_ENGINE_ERROR:
            "ERROR"

    };


    Object.entries(
        ENGINE_EVENT_ALIASES
    ).forEach(
        ([eventName, state]) => {

            window.addEventListener(
                eventName,
                event => {

                    const detail =
                        event.detail || {};


                    updateEngineState(
                        state,
                        detail.progress,
                        detail
                    );

                }
            );

        }
    );


    /* ========================================================
       DIRECT ENGINE STATE
       ======================================================== */

    function syncDirectEngineState() {

        const candidates = [

            window.MARAEngine,

            window.MARA_ENGINE,

            window.MARAEngineRuntime,

            window.MARA_ENGINE_RUNTIME

        ];


        for (
            const engine of candidates
        ) {

            if (
                !engine ||
                typeof engine !== "object"
            ) {

                continue;

            }


            try {

                let state =
                    null;


                if (
                    typeof engine.getState ===
                    "function"
                ) {

                    state =
                        engine.getState();

                }

                else if (
                    engine.state &&
                    typeof engine.state ===
                    "object"
                ) {

                    state =
                        engine.state;

                }


                if (
                    !state ||
                    typeof state !== "object"
                ) {

                    continue;

                }


                updateEngineState(
                    state.state ||
                    state.status ||
                    "UNKNOWN",

                    state.progress ||
                    0,

                    state
                );


                return true;

            } catch (err) {

                warn(
                    "Direct engine state gagal:",
                    err
                );

            }

        }


        return false;

    }


    function isEngineBusy() {

        return (
            ENGINE.active === true
        );

    }


    /* ========================================================
       TERMINAL
       ======================================================== */

    function ensureTerminal() {

        if (
            !CONFIG.terminalEnabled
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

            "z-index:900",

            "display:none",

            "pointer-events:none"

        ].join(";");


        if (
            document.body
        ) {

            document.body.appendChild(
                terminal
            );

        }


        STATE.terminal =
            terminal;


        return terminal;

    }


    function showTerminal() {

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


        line.textContent =
            `[${new Date().toLocaleTimeString("id-ID")}] [${type}] ${message}`;


        terminal.appendChild(
            line
        );


        terminal.scrollTop =
            terminal.scrollHeight;

    }


    const terminalInfo =
        message =>
            terminalLog(
                message,
                "INFO"
            );


    const terminalOK =
        message =>
            terminalLog(
                message,
                "OK"
            );


    const terminalWarn =
        message =>
            terminalLog(
                message,
                "WARN"
            );


    const terminalError =
        message =>
            terminalLog(
                message,
                "ERROR"
            );


    /* ========================================================
       ENGINE HANDOFF
       ======================================================== */

    async function waitForEngineHandoff() {

        syncDirectEngineState();


        if (
            ENGINE.error
        ) {

            throw new Error(
                ENGINE.error
            );

        }


        if (
            !isEngineBusy() &&
            ENGINE.ready
        ) {

            return ENGINE;

        }


        const started =
            Date.now();


        while (
            isEngineBusy()
        ) {

            if (
                Date.now() -
                started >=
                CONFIG.engineWorkTimeout
            ) {

                throw new Error(
                    "Timeout menunggu engine-single.js."
                );

            }


            await wait(
                CONFIG.enginePollInterval
            );


            syncDirectEngineState();


            if (
                ENGINE.error
            ) {

                throw new Error(
                    ENGINE.error
                );

            }

        }


        return ENGINE;

    }


    /* ========================================================
       DATABASE
       ======================================================== */

    function openDatabase() {

        if (
            STATE.db
        ) {

            return Promise.resolve(
                STATE.db
            );

        }


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
                            "IndexedDB tidak tersedia."
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
                        CONFIG.databaseTimeout
                    );


                let request;


                try {

                    request =
                        indexedDB.open(
                            CONFIG.dbName,
                            CONFIG.dbVersion
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
                            "IndexedDB upgrade:",
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


                        STATE.db =
                            request.result;


                        STATE.db.onversionchange =
                            () => {

                                try {

                                    STATE.db.close();

                                } catch (_) {}


                                STATE.db =
                                    null;

                            };


                        STATE.db.onclose =
                            () => {

                                STATE.db =
                                    null;

                            };


                        resolve(
                            STATE.db
                        );

                    };

            }
        );

    }


    async function ensureDatabase() {

        if (
            STATE.db
        ) {

            return STATE.db;

        }


        return openDatabase();

    }


    /* ========================================================
       STORE
       ======================================================== */

    function hasStore(
        storeName
    ) {

        return !!(
            STATE.db &&
            STATE.db.objectStoreNames.contains(
                storeName
            )
        );

    }


    function assertDatabaseStores() {

        if (
            !hasStore(
                CONFIG.metaStore
            )
        ) {

            throw new Error(
                "Object store metadata tidak ditemukan."
            );

        }


        if (
            !hasStore(
                CONFIG.buildStore
            )
        ) {

            throw new Error(
                "Object store builds tidak ditemukan."
            );

        }

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
                        CONFIG.metaStore
                    )
                ) {

                    reject(
                        new Error(
                            "Metadata store tidak ditemukan."
                        )
                    );

                    return;

                }


                let transaction;


                try {

                    transaction =
                        STATE.db.transaction(
                            CONFIG.metaStore,
                            "readonly"
                        );

                } catch (err) {

                    reject(
                        err
                    );

                    return;

                }


                const request =
                    transaction
                        .objectStore(
                            CONFIG.metaStore
                        )
                        .get(
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
       ACTIVE BUILD
       ======================================================== */

    async function getActiveBuild() {

        const metadata =
            await readMetadata(
                CONFIG.activeBuildKey
            );


        STATE.activeMetadata =
            metadata;


        if (
            metadata === null ||
            metadata === undefined
        ) {

            throw new Error(
                "ACTIVE_BUILD belum tersedia."
            );

        }


        let build =
            null;


        if (
            typeof metadata === "object"
        ) {

            build =
                metadata.build ??
                metadata.id ??
                metadata.version ??
                metadata.activeBuild ??
                null;

        }

        else {

            build =
                metadata;

        }


        if (
            build === null ||
            build === undefined
        ) {

            throw new Error(
                "Format ACTIVE_BUILD tidak dikenali."
            );

        }


        return normalizeBuild(
            build
        );

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
                CONFIG.buildStore
            )
        ) {

            throw new Error(
                "Object store builds tidak ditemukan."
            );

        }


        return STATE.db
            .transaction(
                CONFIG.buildStore,
                "readonly"
            )
            .objectStore(
                CONFIG.buildStore
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

                        reject(
                            request.error ||
                            new Error(
                                "Gagal membaca build."
                            )
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
            normalizeBuild(build);


        const p =
            normalizePath(path);


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
       RECORD MATCH
       ======================================================== */

    function recordMatches(
        record,
        build,
        path
    ) {

        if (
            !record ||
            typeof record !== "object"
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
                record.path ??
                record.file ??
                record.name ??
                ""
            );


        const recordBuild =
            normalizeBuild(

                record.build !== undefined
                    ? record.build

                    : record.buildId !== undefined
                        ? record.buildId

                        : record.version

            );


        if (
            recordBuild !== null &&
            recordBuild !== targetBuild
        ) {

            return false;

        }


        if (
            recordPath === targetPath
        ) {

            return true;

        }


        const recordKey =
            normalizePath(
                record.key ??
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
       CURSOR SEARCH
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


                        if (
                            recordMatches(
                                cursor.value,
                                build,
                                path
                            )
                        ) {

                            resolve(
                                cursor.value
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

            const record =
                await getByKey(
                    key
                );


            if (
                record !== undefined
            ) {

                if (
                    recordMatches(
                        record,
                        normalizedBuild,
                        normalizedPath
                    )
                ) {

                    return record;

                }

            }

        }


        const cursorRecord =
            await findFileByCursor(
                normalizedBuild,
                normalizedPath
            );


        if (
            cursorRecord !== undefined
        ) {

            return cursorRecord;

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
                record.path ??
                record.file ??
                record.name ??
                requestedPath
            );


        const mime =
            record.type ??
            record.mime ??
            record.contentType ??
            guessMimeType(
                path
            );


        if (
            isBlob(record)
        ) {

            return {

                blob:
                    record,

                path,

                type:
                    record.type ||
                    mime

            };

        }


        if (
            isBlob(record.blob)
        ) {

            return {

                blob:
                    record.blob,

                path,

                type:
                    record.blob.type ||
                    mime

            };

        }


        if (
            isBlob(record.data)
        ) {

            return {

                blob:
                    record.data,

                path,

                type:
                    record.data.type ||
                    mime

            };

        }


        if (
            isArrayBuffer(record.data)
        ) {

            return {

                blob:
                    new Blob(
                        [record.data],
                        {
                            type:
                                mime
                        }
                    ),

                path,

                type:
                    mime

            };

        }


        if (
            isTypedArray(record.data)
        ) {

            return {

                blob:
                    new Blob(
                        [record.data],
                        {
                            type:
                                mime
                        }
                    ),

                path,

                type:
                    mime

            };

        }


        if (
            isBlob(record.content)
        ) {

            return {

                blob:
                    record.content,

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
                        [record.content],
                        {
                            type:
                                mime
                        }
                    ),

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
                        [record.data],
                        {
                            type:
                                mime
                        }
                    ),

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
                        [record.text],
                        {
                            type:
                                mime
                        }
                    ),

                path,

                type:
                    mime

            };

        }


        throw new Error(
            `Format file tidak didukung: ${path}`
        );

    }


    /* ========================================================
       BLOB URL
       ======================================================== */

    function createFileURL(
        build,
        path,
        file
    ) {

        const cacheKey =
            makeCacheKey(
                build,
                path
            );


        if (
            STATE.blobURLs.has(
                cacheKey
            )
        ) {

            return STATE.blobURLs.get(
                cacheKey
            );

        }


        const url =
            URL.createObjectURL(
                file.blob
            );


        STATE.blobURLs.set(
            cacheKey,
            url
        );


        return url;

    }


    /* ========================================================
       LOAD BUILD FILE
       ======================================================== */

    async function loadBuildFile(
        path,
        options = {}
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
            STATE.activeBuild === null
        ) {

            await getActiveBuild();

        }


        const requestedBuild =
            normalizeBuild(
                options.build ??
                STATE.activeBuild
            );


        const cacheKey =
            makeCacheKey(
                requestedBuild,
                normalizedPath
            );


        /*
         * BUILD-AWARE CACHE
         */

        if (
            !options.force &&
            STATE.files.has(
                cacheKey
            )
        ) {

            return STATE.files.get(
                cacheKey
            );

        }


        /*
         * Pastikan build yang diminta
         * adalah ACTIVE_BUILD kecuali
         * caller memang meminta build tertentu.
         */

        if (
            requestedBuild !==
            STATE.activeBuild
        ) {

            warn(
                "Memuat file dari build non-active:",
                requestedBuild
            );

        }


        const record =
            await findFile(
                requestedBuild,
                normalizedPath
            );


        const file =
            normalizeFile(
                record,
                normalizedPath
            );


        const url =
            createFileURL(
                requestedBuild,
                normalizedPath,
                file
            );


        const result = {

            path:
                normalizedPath,

            build:
                requestedBuild,

            url,

            blob:
                file.blob,

            type:
                file.type,

            size:
                file.blob.size,

            cacheKey

        };


        STATE.files.set(
            cacheKey,
            result
        );


        if (
            !STATE.buildCache.has(
                requestedBuild
            )
        ) {

            STATE.buildCache.set(
                requestedBuild,
                new Set()
            );

        }


        STATE.buildCache
            .get(
                requestedBuild
            )
            .add(
                normalizedPath
            );


        return result;

    }


    /* ========================================================
       GET URL
       ======================================================== */

    async function getURL(
        path,
        options = {}
    ) {

        const file =
            await loadBuildFile(
                path,
                options
            );


        return file.url;

    }


    /* ========================================================
       LOAD HTML
       ======================================================== */

    async function loadHTMLIntoFrame(
        frame,
        path,
        options = {}
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
                path,
                options
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
                        CONFIG.fileTimeout
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
       MAIN FRAME
       ======================================================== */

    function getMainFrame() {

        return (
            document.getElementById(
                "mara-main-frame"
            ) ||

            document.querySelector(
                ".mara-iframe"
            ) ||

            null
        );

    }


    /* ========================================================
       LOAD MAIN UX
       ======================================================== */

    async function loadMainUX(
        options = {}
    ) {

        const frame =
            options.frame ||
            getMainFrame();


        if (
            !frame
        ) {

            throw new Error(
                "Iframe utama MARA OS tidak ditemukan."
            );

        }


        STATE.mainFrame =
            frame;


        const file =
            await loadHTMLIntoFrame(
                frame,
                CONFIG.entryFile,
                options
            );


        STATE.mainFile =
            file;


        return file;

    }


    /* ========================================================
       RELOAD MAIN UX
       ======================================================== */

    async function reloadMainUX() {

        if (
            !STATE.mainFrame
        ) {

            STATE.mainFrame =
                getMainFrame();

        }


        if (
            !STATE.mainFrame
        ) {

            throw new Error(
                "Main frame tidak ditemukan."
            );

        }


        const file =
            await loadMainUX(
                {
                    frame:
                        STATE.mainFrame,

                    force:
                        true

                }
            );


        dispatchEvent(
            "MARA_MAIN_UX_RELOADED",
            {

                build:
                    STATE.activeBuild,

                file:
                    file.path

            }
        );


        return file;

    }


    /* ========================================================
       HOME SCREEN
       ======================================================== */

    async function loadHomeScreen(
        frame
    ) {

        const targetFrame =
            frame ||
            getMainFrame();


        if (
            !targetFrame
        ) {

            throw new Error(
                "Home Screen iframe tidak ditemukan."
            );

        }


        return loadHTMLIntoFrame(
            targetFrame,
            "home-screen.html"
        );

    }


    /* ========================================================
       CONTROL CENTER
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
        paths,
        options = {}
    ) {

        if (
            !Array.isArray(paths)
        ) {

            throw new Error(
                "preload() membutuhkan array."
            );

        }


        const results =
            [];


        for (
            const path of paths
        ) {

            results.push(
                await loadBuildFile(
                    path,
                    options
                )
            );

        }


        dispatchEvent(
            "MARA_BUILD_PRELOAD_COMPLETE",
            {

                build:
                    options.build ||
                    STATE.activeBuild,

                files:
                    results.map(
                        file =>
                            file.path
                    )

            }
        );


        return results;

    }


    /* ========================================================
       CLEAR CACHE
       ======================================================== */

    function clearCache(
        build = null
    ) {

        if (
            build === null
        ) {

            STATE.files.clear();

            STATE.buildCache.clear();

            return;

        }


        const normalizedBuild =
            normalizeBuild(
                build
            );


        const paths =
            STATE.buildCache.get(
                normalizedBuild
            );


        if (
            paths
        ) {

            for (
                const path of paths
            ) {

                const key =
                    makeCacheKey(
                        normalizedBuild,
                        path
                    );


                STATE.files.delete(
                    key
                );


                const url =
                    STATE.blobURLs.get(
                        key
                    );


                if (
                    url
                ) {

                    try {

                        URL.revokeObjectURL(
                            url
                        );

                    } catch (_) {}


                    STATE.blobURLs.delete(
                        key
                    );

                }

            }

        }


        STATE.buildCache.delete(
            normalizedBuild
        );

    }


    /* ========================================================
       REVOKE URLS
       ======================================================== */

    function revokeURLs(
        build = null
    ) {

        if (
            build === null
        ) {

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

            STATE.buildCache.clear();

            return;

        }


        clearCache(
            build
        );

    }


    /* ========================================================
       REFRESH ACTIVE BUILD
       ======================================================== */

    async function refreshActiveBuild() {

        await ensureDatabase();


        assertDatabaseStores();


        const previousBuild =
            STATE.activeBuild;


        const previousMetadata =
            STATE.activeMetadata;


        const currentMetadata =
            await readMetadata(
                CONFIG.activeBuildKey
            );


        let currentBuild;


        if (
            typeof currentMetadata ===
            "object"
        ) {

            currentBuild =
                currentMetadata.build ??
                currentMetadata.id ??
                currentMetadata.version ??
                currentMetadata.activeBuild;

        }

        else {

            currentBuild =
                currentMetadata;

        }


        currentBuild =
            normalizeBuild(
                currentBuild
            );


        if (
            !currentBuild
        ) {

            throw new Error(
                "ACTIVE_BUILD tidak valid."
            );

        }


        STATE.activeMetadata =
            currentMetadata;


        if (
            previousBuild ===
            currentBuild
        ) {

            return {

                changed:
                    false,

                previousBuild,

                currentBuild,

                metadata:
                    currentMetadata

            };

        }


        /*
         * Jangan langsung menghapus cache.
         *
         * Build lama tetap dipertahankan
         * sampai build baru berhasil dimuat.
         */

        const oldBuild =
            previousBuild;


        STATE.activeBuild =
            currentBuild;


        STATE.lastBuildChange = {

            previous:
                oldBuild,

            current:
                currentBuild,

            changedAt:
                Date.now()

        };


        dispatchEvent(
            "MARA_ACTIVE_BUILD_CHANGED",
            {

                previousBuild:
                    oldBuild,

                currentBuild,

                metadata:
                    currentMetadata

            }
        );


        sendParentMessage(
            "MARA_ACTIVE_BUILD_CHANGED",
            {

                previousBuild:
                    oldBuild,

                currentBuild,

                metadata:
                    currentMetadata

            }
        );


        log(
            "ACTIVE_BUILD:",
            oldBuild,
            "→",
            currentBuild
        );


        return {

            changed:
                true,

            previousBuild:
                oldBuild,

            currentBuild,

            metadata:
                currentMetadata

        };

    }


    /* ========================================================
       ATOMIC BUILD SWITCH
       ======================================================== */

    async function switchToActiveBuild() {

        const result =
            await refreshActiveBuild();


        if (
            !result.changed
        ) {

            return result;

        }


        const newBuild =
            result.currentBuild;


        /*
         * Validasi bahwa entry file build baru
         * benar-benar dapat dibaca.
         */

        try {

            const file =
                await loadBuildFile(
                    CONFIG.entryFile,
                    {
                        build:
                            newBuild,

                        force:
                            true
                    }
                );


            if (
                !file ||
                !file.blob
            ) {

                throw new Error(
                    "Entry file build baru tidak valid."
                );

            }


            dispatchEvent(
                "MARA_BUILD_SWITCH_READY",
                {

                    build:
                        newBuild,

                    file:
                        file.path

                }
            );


            return {

                ...result,

                validated:
                    true,

                file

            };

        } catch (err) {

            /*
             * Rollback active runtime reference.
             *
             * Kita tidak mengubah ACTIVE_BUILD di DB.
             * Engine-single.js tetap menjadi pemiliknya.
             */

            STATE.activeBuild =
                result.previousBuild;

            STATE.activeMetadata =
                previousMetadataSafe(
                    result.previousBuild
                );


            dispatchEvent(
                "MARA_BUILD_SWITCH_FAILED",
                {

                    build:
                        newBuild,

                    error:
                        err.message

                }
            );


            throw new Error(
                `Build ${newBuild} gagal dimuat: ${err.message}`
            );

        }

    }


    function previousMetadataSafe(
        previousBuild
    ) {

        if (
            STATE.activeMetadata &&
            normalizeBuild(
                STATE.activeMetadata
            ) ===
            normalizeBuild(
                previousBuild
            )
        ) {

            return STATE.activeMetadata;

        }


        return null;

    }


    /* ========================================================
       DATABASE RECOVERY
       ======================================================== */

    async function recoverDatabase() {

        STATE.recoveryCount++;


        warn(
            "Database recovery:",
            STATE.recoveryCount
        );


        closeDatabase();


        await wait(
            CONFIG.recoveryDelay
        );


        await openDatabase();


        assertDatabaseStores();


        return true;

    }


    /* ========================================================
       SAFE LOAD FILE
       ======================================================== */

    async function safeLoadBuildFile(
        path,
        options = {}
    ) {

        let lastError =
            null;


        for (
            let attempt = 0;
            attempt <=
            CONFIG.recoveryRetries;
            attempt++
        ) {

            try {

                return await loadBuildFile(
                    path,
                    options
                );

            } catch (err) {

                lastError =
                    err;


                if (
                    attempt >=
                    CONFIG.recoveryRetries
                ) {

                    break;

                }


                warn(
                    `Load file gagal. Recovery ${attempt + 1}/${CONFIG.recoveryRetries}`
                );


                try {

                    await recoverDatabase();

                } catch (
                    recoveryError
                ) {

                    lastError =
                        recoveryError;

                }

            }

        }


        throw lastError;

    }


    /* ========================================================
       DIAGNOSTICS
       ======================================================== */

    async function runDiagnostics() {

        syncDirectEngineState();


        if (
            isEngineBusy()
        ) {

            return {

                skipped:
                    true,

                reason:
                    "ENGINE_BUSY",

                engine:
                    getEngineState()

            };

        }


        clearTerminal();

        showTerminal();


        terminalInfo(
            "MARA OS BUILD RUNTIME v3"
        );


        terminalInfo(
            `Session: ${STATE.sessionId}`
        );


        terminalInfo(
            "Checking IndexedDB..."
        );


        try {

            await ensureDatabase();

        } catch (err) {

            terminalError(
                err.message
            );


            return {

                success:
                    false,

                error:
                    err.message

            };

        }


        terminalOK(
            "IndexedDB connected."
        );


        if (
            hasStore(
                CONFIG.metaStore
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
                CONFIG.buildStore
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


        if (
            !hasStore(
                CONFIG.metaStore
            ) ||
            !hasStore(
                CONFIG.buildStore
            )
        ) {

            return {

                success:
                    false,

                error:
                    "Object store tidak lengkap."

            };

        }


        terminalInfo(
            "Checking ACTIVE_BUILD..."
        );


        let build;


        try {

            build =
                await getActiveBuild();


            terminalOK(
                `Active build: ${build}`
            );

        } catch (err) {

            terminalError(
                err.message
            );


            return {

                success:
                    false,

                activeBuild:
                    null,

                error:
                    err.message

            };

        }


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


        terminalInfo(
            "Checking engine state..."
        );


        terminalOK(
            `Engine: ${ENGINE.state}`
        );


        terminalInfo(
            `Engine progress: ${ENGINE.progress}%`
        );


        terminalInfo(
            `Cached files: ${STATE.files.size}`
        );


        terminalInfo(
            `Blob URLs: ${STATE.blobURLs.size}`
        );


        terminalInfo(
            "Checking MAIN UX..."
        );


        if (
            STATE.mainFile
        ) {

            terminalOK(
                `MAIN UX: ${STATE.mainFile.path}`
            );

        } else {

            terminalWarn(
                "MAIN UX belum dimuat."
            );

        }


        terminalInfo(
            "BUILD.JS tidak menjalankan proses upgrade."
        );


        terminalInfo(
            "Diagnostic check selesai."
        );


        return {

            success:
                true,

            sessionId:
                STATE.sessionId,

            build,

            metadata:
                STATE.activeMetadata,

            mainFile:
                STATE.mainFile
                    ? STATE.mainFile.path
                    : null,

            cachedFiles:
                Array.from(
                    STATE.files.keys()
                ),

            blobURLs:
                STATE.blobURLs.size,

            engine:
                getEngineState()

        };

    }


    /* ========================================================
       ENGINE STATE API
       ======================================================== */

    function getEngineState() {

        return {

            state:
                ENGINE.state,

            progress:
                ENGINE.progress,

            active:
                ENGINE.active,

            ready:
                ENGINE.ready,

            idle:
                ENGINE.idle,

            received:
                ENGINE.received,

            error:
                ENGINE.error,

            metadata:
                ENGINE.metadata,

            updatedAt:
                ENGINE.updatedAt

        };

    }


    /* ========================================================
       BUILD STATE API
       ======================================================== */

    function getState() {

        return {

            sessionId:
                STATE.sessionId,

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

            mainFile:
                STATE.mainFile
                    ? STATE.mainFile.path
                    : null,

            cachedFiles:
                Array.from(
                    STATE.files.keys()
                ),

            blobURLs:
                Array.from(
                    STATE.blobURLs.keys()
                ),

            buildCache:
                Array.from(
                    STATE.buildCache.entries()
                )
                    .map(
                        ([build, paths]) => ({

                            build,

                            files:
                                Array.from(
                                    paths
                                )

                        })
                    ),

            recoveryCount:
                STATE.recoveryCount,

            lastBuildChange:
                STATE.lastBuildChange,

            engine:
                getEngineState()

        };

    }


    /* ========================================================
       START
       ======================================================== */

    async function start() {

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


        if (
            STATE.starting &&
            STATE.startPromise
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
                        "BUILD RUNTIME v3 START"
                    );


                    dispatchEvent(
                        "MARA_BUILD_STARTING",
                        {

                            sessionId:
                                STATE.sessionId

                        }
                    );


                    sendParentMessage(
                        "MARA_BUILD_STARTING",
                        {

                            sessionId:
                                STATE.sessionId

                        }
                    );


                    /* =========================================
                       ENGINE HANDOFF
                       ========================================= */

                    syncDirectEngineState();


                    if (
                        isEngineBusy()
                    ) {

                        hideTerminal();

                        await waitForEngineHandoff();

                    }

                    else if (
                        !ENGINE.ready
                    ) {

                        await waitForEngineHandoff();

                    }


                    if (
                        ENGINE.error
                    ) {

                        throw new Error(
                            ENGINE.error
                        );

                    }


                    /* =========================================
                       DATABASE
                       ========================================= */

                    await ensureDatabase();

                    assertDatabaseStores();


                    if (
                        !isEngineBusy()
                    ) {

                        clearTerminal();

                        showTerminal();

                        terminalInfo(
                            "MARA OS BUILD RUNTIME v3"
                        );

                        terminalOK(
                            "IndexedDB connected."
                        );

                    }


                    /* =========================================
                       ACTIVE BUILD
                       ========================================= */

                    let activeBuild =
                        await getActiveBuild();


                    STATE.activeBuild =
                        activeBuild;


                    if (
                        !isEngineBusy()
                    ) {

                        terminalOK(
                            `Active build: ${activeBuild}`
                        );

                    }


                    /* =========================================
                       BUILD EVENT
                       ========================================= */

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


                    /* =========================================
                       MAIN UX
                       ========================================= */

                    if (
                        !isEngineBusy()
                    ) {

                        terminalInfo(
                            "Loading MAIN UX..."
                        );

                    }


                    const mainFile =
                        await safeLoadBuildFile(
                            CONFIG.entryFile
                        );


                    STATE.mainFile =
                        mainFile;


                    STATE.mainFrame =
                        getMainFrame();


                    /*
                     * Pastikan iframe benar-benar tersedia.
                     */

                    if (
                        !STATE.mainFrame
                    ) {

                        throw new Error(
                            "Iframe utama MARA OS tidak ditemukan."
                        );

                    }


                    /*
                     * File baru harus benar-benar
                     * dipasang ke MAIN UX.
                     */

                    await loadHTMLIntoFrame(
                        STATE.mainFrame,
                        CONFIG.entryFile
                    );


                    /* =========================================
                       FINAL ENGINE CHECK
                       ========================================= */

                    syncDirectEngineState();


                    if (
                        isEngineBusy()
                    ) {

                        hideTerminal();

                        await waitForEngineHandoff();

                    }


                    if (
                        ENGINE.error
                    ) {

                        throw new Error(
                            ENGINE.error
                        );

                    }


                    /* =========================================
                       READY
                       ========================================= */

                    STATE.ready =
                        true;

                    STATE.started =
                        true;

                    STATE.starting =
                        false;

                    STATE.error =
                        null;

                    STATE.readyAt =
                        Date.now();


                    hideTerminal();


                    const result = {

                        success:
                            true,

                        sessionId:
                            STATE.sessionId,

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
                        "MARA BUILD READY",
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
                        "BUILD RUNTIME ERROR:",
                        err
                    );


                    dispatchEvent(
                        "MARA_BUILD_ERROR",
                        {

                            sessionId:
                                STATE.sessionId,

                            error:
                                err,

                            message:
                                err.message

                        }
                    );


                    sendParentMessage(
                        "MARA_BUILD_ERROR",
                        {

                            sessionId:
                                STATE.sessionId,

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
            "BUILD RUNTIME STOP"
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

        STATE.startedAt =
            null;

        STATE.readyAt =
            null;

        STATE.startPromise =
            null;

        STATE.mainFrame =
            null;

        STATE.mainFile =
            null;


        dispatchEvent(
            "MARA_BUILD_STOPPED",
            {

                sessionId:
                    STATE.sessionId

            }
        );


        sendParentMessage(
            "MARA_BUILD_STOPPED",
            {

                sessionId:
                    STATE.sessionId

            }
        );

    }


    /* ========================================================
       PUBLIC API
       ======================================================== */

    window.MARABuild = {

        /* Runtime */

        start,

        stop,


        /* State */

        getState,

        getEngineState,

        isReady:
            () =>
                STATE.ready,


        getSessionId:
            () =>
                STATE.sessionId,


        /* Build */

        getActiveBuild:
            () =>
                STATE.activeBuild,

        getActiveMetadata:
            () =>
                STATE.activeMetadata,


        /* Build synchronization */

        refreshActiveBuild,

        switchToActiveBuild,


        /* File */

        getURL,

        loadBuildFile,


        /* HTML */

        loadHTMLIntoFrame,


        /* UX */

        loadMainUX,

        reloadMainUX,

        loadHomeScreen,

        loadControlCenter,


        /* Preload */

        preload,


        /* Cache */

        clearCache,

        revokeURLs,


        /* Database */

        openDatabase,

        closeDatabase,


        /* Recovery */

        recoverDatabase,


        /* Diagnostics */

        runDiagnostics

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

    }

    else {

        autoStart();

    }


    /* ========================================================
       PAGE LIFECYCLE
       ======================================================== */

    window.addEventListener(
        "pagehide",
        () => {

            revokeURLs();

            closeDatabase();

        },
        {
            once:
                true
        }
    );


    /* ========================================================
       INITIAL ENGINE SYNC
       ======================================================== */

    try {

        syncDirectEngineState();

    } catch (_) {}


    /* ========================================================
       REGISTERED
       ======================================================== */

    log(
        "BUILD RUNTIME ENGINE v3 terdaftar.",
        "SESSION:",
        STATE.sessionId
    );


})();