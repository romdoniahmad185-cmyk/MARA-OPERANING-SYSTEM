/* =========================================================
   MARA OS
   ENGINE SINGLE
   FINAL — UNIFIED UPDATE / BUILD / STORAGE ENGINE

   RELATION:

       index.html
            │
            ├── iframe → ux/intro.html
            │
            ├── engine-single.js
            │
            └── ux/build.js
                     │
                     ▼
              MARA ENGINE SINGLE
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
       UPDATE      STORAGE     EVENTS
          │          │          │
          ▼          ▼          ▼
      Manifest    IndexedDB   postMessage
          │
          ▼
       Download
          │
          ▼
      Temporary
          │
          ▼
       SHA-256
          │
          ▼
       Install
          │
          ▼
        READY
          │
          ▼
       ACTIVATE
          │
          ▼
     ACTIVE BUILD
          │
          ▼
       build.js
          │
          ▼
        MARA UX


   DATABASE:

       MARA_OS_STORAGE

   STORES:

       builds
       files
       active
       temporary
       settings

========================================================= */

(() => {

    "use strict";


    /* =====================================================
       ENGINE DUPLICATE PROTECTION
    ===================================================== */

    if (
        window.MARAEngineSingle &&
        window.MARAEngineSingle.__MARA_ENGINE_SINGLE__
    ) {

        console.warn(
            "[MARA ENGINE] Engine sudah dimuat."
        );

        return;

    }


    /* =====================================================
       CONFIGURATION
    ===================================================== */

    const CONFIG = {

        name:
            "MARA_ENGINE_SINGLE",

        version:
            "3.0.0",

        databaseName:
            "MARA_OS_STORAGE",

        databaseVersion:
            5,

        stores: {

            builds:
                "builds",

            files:
                "files",

            active:
                "active",

            temporary:
                "temporary",

            settings:
                "settings"

        },

        activeKey:
            "active",

        repository:
            "https://romdoniahmad185-cmyk.github.io/mara-os-updates/stable/update-manifest.json",

        requestTimeout:
            30000,

        retryCount:
            2,

        retryDelay:
            1000,

        maxFileSize:
            50 * 1024 * 1024,

        maxManifestFiles:
            5000,

        verifyContent:
            true,

        keepOldBuild:
            false,

        autoUpdate:
            true,

        autoUpdateDelay:
            1500,

        cacheBust:
            true,

        entryFile:
            "lock-screen.html",

        messageTarget:
            "*",

        allowedProtocols:
            [
                "https:"
            ]

    };


    /* =====================================================
       STATUS DEFINITIONS
    ===================================================== */

    const STATUS = Object.freeze({

        IDLE:
            "IDLE",

        INITIALIZING:
            "INITIALIZING",

        READY:
            "READY",

        CHECKING:
            "CHECKING",

        FETCHING_MANIFEST:
            "FETCHING_MANIFEST",

        UP_TO_DATE:
            "UP_TO_DATE",

        DOWNLOADING:
            "DOWNLOADING",

        VERIFYING:
            "VERIFYING",

        INSTALLING:
            "INSTALLING",

        ACTIVATING:
            "ACTIVATING",

        UPDATED:
            "UPDATED",

        OFFLINE:
            "OFFLINE",

        RECOVERING:
            "RECOVERING",

        ERROR:
            "ERROR"

    });


    /* =====================================================
       STATE
    ===================================================== */

    const STATE = {

        status:
            STATUS.IDLE,

        phase:
            STATUS.IDLE,

        activeBuild:
            null,

        activeVersion:
            null,

        remoteBuild:
            null,

        remoteVersion:
            null,

        installingBuild:
            null,

        currentFile:
            null,

        progress:
            0,

        completedFiles:
            0,

        totalFiles:
            0,

        startedAt:
            null,

        completedAt:
            null,

        error:
            null,

        errorCode:
            null,

        lastManifest:
            null

    };


    /* =====================================================
       UTILITY
    ===================================================== */

    const Utils = {

        number(
            value,
            fallback = null
        ) {

            const number =
                Number(value);

            return Number.isFinite(number)
                ? number
                : fallback;

        },


        integer(
            value,
            fallback = null
        ) {

            const number =
                Number(value);

            return Number.isInteger(number)
                ? number
                : fallback;

        },


        sleep(
            ms
        ) {

            return new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        ms
                    )
            );

        },


        clone(
            value
        ) {

            try {

                return structuredClone(
                    value
                );

            } catch {

                return JSON.parse(
                    JSON.stringify(
                        value
                    )
                );

            }

        }

    };


    /* =====================================================
       ENGINE
    ===================================================== */

    const ENGINE = {

        __MARA_ENGINE_SINGLE__:
            true,

        name:
            CONFIG.name,

        version:
            CONFIG.version,

        config:
            CONFIG,

        status:
            STATE,

        db:
            null,

        initialized:
            false,

        initializing:
            null,

        updating:
            false,

        events:
            Object.create(null),

        objectURLs:
            new Map(),


        /* =================================================
           EVENT SYSTEM
        ================================================= */

        on(
            event,
            callback
        ) {

            if (
                typeof callback !==
                "function"
            ) {

                throw new TypeError(
                    "Event callback harus berupa function."
                );

            }

            if (
                !this.events[event]
            ) {

                this.events[event] = [];

            }

            this.events[event].push(
                callback
            );

            return () => {

                this.off(
                    event,
                    callback
                );

            };

        },


        off(
            event,
            callback
        ) {

            if (
                !this.events[event]
            ) {

                return;

            }

            this.events[event] =
                this.events[event].filter(
                    listener =>
                        listener !== callback
                );

        },


        emit(
            event,
            data = {}
        ) {

            const listeners =
                this.events[event] ||
                [];

            const payload = {

                event,

                ...data

            };


            listeners
                .slice()
                .forEach(
                    listener => {

                        try {

                            listener(
                                payload
                            );

                        } catch (
                            error
                        ) {

                            console.error(
                                "[MARA ENGINE] Event listener error:",
                                error
                            );

                        }

                    }
                );


            this.broadcast(
                event,
                payload
            );

        },


        /* =================================================
           MESSAGE BROADCAST
        ================================================= */

        broadcast(
            event,
            data = {}
        ) {

            try {

                window.postMessage(
                    {

                        source:
                            CONFIG.name,

                        type:
                            "MARA_ENGINE_EVENT",

                        event,

                        data,

                        timestamp:
                            Date.now()

                    },
                    CONFIG.messageTarget
                );

            } catch (
                error
            ) {

                console.warn(
                    "[MARA ENGINE] Broadcast gagal:",
                    error
                );

            }

        },


        /* =================================================
           STATE
        ================================================= */

        setStatus(
            status,
            extra = {}
        ) {

            STATE.status =
                status;

            STATE.phase =
                status;

            Object.assign(
                STATE,
                extra
            );


            this.emit(
                "state",
                {
                    state:
                        this.getState()
                }
            );

        },


        getState() {

            return Utils.clone(
                STATE
            );

        },


        /* =================================================
           DATABASE INITIALIZATION
        ================================================= */

        async init() {

            if (
                this.initialized &&
                this.db
            ) {

                return this.db;

            }


            if (
                this.initializing
            ) {

                return this.initializing;

            }


            this.initializing =
                this._initialize();


            try {

                return await this.initializing;

            } finally {

                this.initializing =
                    null;

            }

        },


        async _initialize() {

            this.setStatus(
                STATUS.INITIALIZING
            );


            this.db =
                await this.openDatabase();


            this.initialized =
                true;


            const active =
                await this.readActiveRecord();


            if (
                active
            ) {

                STATE.activeBuild =
                    Utils.integer(
                        active.build
                    );

                STATE.activeVersion =
                    active.version ||
                    null;

            } else {

                STATE.activeBuild =
                    null;

                STATE.activeVersion =
                    null;

            }


            this.setStatus(
                STATUS.READY,
                {

                    activeBuild:
                        STATE.activeBuild,

                    activeVersion:
                        STATE.activeVersion

                }
            );


            this.emit(
                "ready",
                {

                    activeBuild:
                        STATE.activeBuild,

                    activeVersion:
                        STATE.activeVersion

                }
            );


            return this.db;

        },


        /* =================================================
           OPEN DATABASE
        ================================================= */

        openDatabase() {

            return new Promise(
                (
                    resolve,
                    reject
                ) => {

                    const request =
                        indexedDB.open(
                            CONFIG.databaseName,
                            CONFIG.databaseVersion
                        );


                    request.onupgradeneeded =
                        event => {

                            const db =
                                event.target.result;

                            const transaction =
                                event.target.transaction;


                            /* =================================
                               BUILDS
                            ================================= */

                            let builds;

                            if (
                                !db.objectStoreNames.contains(
                                    CONFIG.stores.builds
                                )
                            ) {

                                builds =
                                    db.createObjectStore(
                                        CONFIG.stores.builds,
                                        {
                                            keyPath:
                                                "build"
                                        }
                                    );

                            } else {

                                builds =
                                    transaction.objectStore(
                                        CONFIG.stores.builds
                                    );

                            }


                            if (
                                !builds.indexNames.contains(
                                    "version"
                                )
                            ) {

                                builds.createIndex(
                                    "version",
                                    "version",
                                    {
                                        unique:
                                            false
                                    }
                                );

                            }


                            if (
                                !builds.indexNames.contains(
                                    "status"
                                )
                            ) {

                                builds.createIndex(
                                    "status",
                                    "status",
                                    {
                                        unique:
                                            false
                                    }
                                );

                            }


                            /* =================================
                               FILES
                            ================================= */

                            let files;

                            if (
                                !db.objectStoreNames.contains(
                                    CONFIG.stores.files
                                )
                            ) {

                                files =
                                    db.createObjectStore(
                                        CONFIG.stores.files,
                                        {
                                            keyPath:
                                                "id"
                                        }
                                    );

                            } else {

                                files =
                                    transaction.objectStore(
                                        CONFIG.stores.files
                                    );

                            }


                            if (
                                !files.indexNames.contains(
                                    "build"
                                )
                            ) {

                                files.createIndex(
                                    "build",
                                    "build",
                                    {
                                        unique:
                                            false
                                    }
                                );

                            }


                            if (
                                !files.indexNames.contains(
                                    "path"
                                )
                            ) {

                                files.createIndex(
                                    "path",
                                    "path",
                                    {
                                        unique:
                                            false
                                    }
                                );

                            }


                            /* =================================
                               ACTIVE
                            ================================= */

                            if (
                                !db.objectStoreNames.contains(
                                    CONFIG.stores.active
                                )
                            ) {

                                db.createObjectStore(
                                    CONFIG.stores.active,
                                    {
                                        keyPath:
                                            "id"
                                    }
                                );

                            }


                            /* =================================
                               TEMPORARY
                            ================================= */

                            let temporary;

                            if (
                                !db.objectStoreNames.contains(
                                    CONFIG.stores.temporary
                                )
                            ) {

                                temporary =
                                    db.createObjectStore(
                                        CONFIG.stores.temporary,
                                        {
                                            keyPath:
                                                "id"
                                        }
                                    );

                            } else {

                                temporary =
                                    transaction.objectStore(
                                        CONFIG.stores.temporary
                                    );

                            }


                            if (
                                !temporary.indexNames.contains(
                                    "build"
                                )
                            ) {

                                temporary.createIndex(
                                    "build",
                                    "build",
                                    {
                                        unique:
                                            false
                                    }
                                );

                            }


                            /* =================================
                               SETTINGS
                            ================================= */

                            if (
                                !db.objectStoreNames.contains(
                                    CONFIG.stores.settings
                                )
                            ) {

                                db.createObjectStore(
                                    CONFIG.stores.settings,
                                    {
                                        keyPath:
                                            "id"
                                    }
                                );

                            }

                        };


                    request.onsuccess =
                        event => {

                            const db =
                                event.target.result;


                            db.onversionchange =
                                () => {

                                    db.close();

                                    this.db =
                                        null;

                                    this.initialized =
                                        false;

                                };


                            db.onclose =
                                () => {

                                    this.db =
                                        null;

                                    this.initialized =
                                        false;

                                };


                            db.onerror =
                                event => {

                                    console.warn(
                                        "[MARA ENGINE] IndexedDB error:",
                                        event.target.error
                                    );

                                };


                            resolve(
                                db
                            );

                        };


                    request.onerror =
                        () => {

                            reject(
                                request.error ||
                                new Error(
                                    "IndexedDB gagal dibuka."
                                )
                            );

                        };


                    request.onblocked =
                        () => {

                            reject(
                                new Error(
                                    "IndexedDB sedang diblokir oleh koneksi database lama."
                                )
                            );

                        };

                }
            );

        },


        /* =================================================
           DATABASE STORE
        ================================================= */

        store(
            name,
            mode = "readonly"
        ) {

            if (
                !this.db
            ) {

                throw new Error(
                    "Database belum diinisialisasi."
                );

            }


            return this.db
                .transaction(
                    name,
                    mode
                )
                .objectStore(
                    name
                );

        },


        /* =================================================
           IDB REQUEST
        ================================================= */

        request(
            request
        ) {

            return new Promise(
                (
                    resolve,
                    reject
                ) => {

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
                                    "IndexedDB request gagal."
                                )
                            );

                        };

                }
            );

        },


        /* =================================================
           ACTIVE BUILD
        ================================================= */

        async readActiveRecord() {

            await this.initDatabaseOnly();


            return this.request(
                this.store(
                    CONFIG.stores.active
                ).get(
                    CONFIG.activeKey
                )
            );

        },


        async initDatabaseOnly() {

            if (
                this.db
            ) {

                return this.db;

            }


            this.db =
                await this.openDatabase();


            return this.db;

        },


        async getActiveBuild() {

            const record =
                await this.readActiveRecord();


            if (
                !record
            ) {

                return null;

            }


            return Utils.integer(
                record.build
            );

        },


        async setActiveBuild(
            build,
            version = null
        ) {

            await this.init();


            const numericBuild =
                Utils.integer(
                    build
                );


            if (
                numericBuild === null ||
                numericBuild < 1
            ) {

                throw new Error(
                    "ACTIVE BUILD tidak valid."
                );

            }


            if (
                !(await this.hasBuild(
                    numericBuild
                ))
            ) {

                throw new Error(
                    `Build ${numericBuild} belum READY.`
                );

            }


            return this.activateBuild(
                numericBuild,
                version
            );

        },


        /* =================================================
           FETCH
        ================================================= */

        async fetchURL(
            url,
            options = {}
        ) {

            this.validateURL(
                url
            );


            let lastError =
                null;


            for (
                let attempt = 0;
                attempt <=
                CONFIG.retryCount;
                attempt++
            ) {

                const controller =
                    new AbortController();


                const timer =
                    setTimeout(
                        () => {

                            controller.abort();

                        },
                        CONFIG.requestTimeout
                    );


                try {

                    const response =
                        await fetch(
                            url,
                            {

                                ...options,

                                cache:
                                    "no-store",

                                signal:
                                    controller.signal

                            }
                        );


                    clearTimeout(
                        timer
                    );


                    if (
                        !response.ok
                    ) {

                        throw new Error(
                            `HTTP ${response.status}: ${url}`
                        );

                    }


                    return response;

                } catch (
                    error
                ) {

                    clearTimeout(
                        timer
                    );


                    lastError =
                        error;


                    if (
                        attempt <
                        CONFIG.retryCount
                    ) {

                        await Utils.sleep(
                            CONFIG.retryDelay
                        );

                    }

                }

            }


            throw (
                lastError ||
                new Error(
                    `Gagal mengambil URL: ${url}`
                )
            );

        },


        async fetchJSON(
            url
        ) {

            const response =
                await this.fetchURL(
                    url
                );


            try {

                return await response.json();

            } catch {

                throw new Error(
                    "Response JSON tidak valid."
                );

            }

        },


        /* =================================================
           MANIFEST
        ================================================= */

        async fetchManifest() {

            this.setStatus(
                STATUS.FETCHING_MANIFEST
            );


            this.emit(
                "manifest:start"
            );


            let url =
                CONFIG.repository;


            if (
                CONFIG.cacheBust
            ) {

                const separator =
                    url.includes("?")
                        ? "&"
                        : "?";


                url =
                    `${url}${separator}_=${Date.now()}`;

            }


            const manifest =
                await this.fetchJSON(
                    url
                );


            this.validateManifest(
                manifest
            );


            STATE.remoteBuild =
                Number(
                    manifest.build
                );

            STATE.remoteVersion =
                String(
                    manifest.version
                );

            STATE.lastManifest =
                Utils.clone(
                    manifest
                );


            this.emit(
                "manifest:ready",
                {

                    manifest

                }
            );


            return manifest;

        },


        /* =================================================
           MANIFEST VALIDATION
        ================================================= */

        validateManifest(
            manifest
        ) {

            if (
                !manifest ||
                typeof manifest !==
                "object"
            ) {

                throw new Error(
                    "Manifest tidak valid."
                );

            }


            if (
                typeof manifest.version !==
                "string" ||
                !manifest.version.trim()
            ) {

                throw new Error(
                    "Manifest.version tidak valid."
                );

            }


            const build =
                Utils.integer(
                    manifest.build
                );


            if (
                build === null ||
                build < 1
            ) {

                throw new Error(
                    "Manifest.build tidak valid."
                );

            }


            if (
                !Array.isArray(
                    manifest.files
                )
            ) {

                throw new Error(
                    "Manifest.files harus berupa array."
                );

            }


            if (
                manifest.files.length === 0
            ) {

                throw new Error(
                    "Manifest.files tidak boleh kosong."
                );

            }


            if (
                manifest.files.length >
                CONFIG.maxManifestFiles
            ) {

                throw new Error(
                    "Jumlah file manifest terlalu banyak."
                );

            }


            const paths =
                new Set();


            manifest.files.forEach(
                file => {

                    if (
                        !file ||
                        typeof file !==
                        "object"
                    ) {

                        throw new Error(
                            "Entry manifest tidak valid."
                        );

                    }


                    const path =
                        this.normalizePath(
                            file.path
                        );


                    if (
                        paths.has(
                            path
                        )
                    ) {

                        throw new Error(
                            `Path duplikat: ${path}`
                        );

                    }


                    paths.add(
                        path
                    );


                    if (
                        typeof file.url !==
                        "string" ||
                        !file.url
                    ) {

                        throw new Error(
                            `URL file tidak tersedia: ${path}`
                        );

                    }


                    this.validateURL(
                        file.url
                    );


                    if (
                        file.size !==
                        undefined
                    ) {

                        const size =
                            Number(
                                file.size
                            );


                        if (
                            !Number.isFinite(
                                size
                            ) ||
                            size < 0 ||
                            size >
                            CONFIG.maxFileSize
                        ) {

                            throw new Error(
                                `Ukuran file tidak valid: ${path}`
                            );

                        }

                    }


                    if (
                        file.sha256 !==
                        undefined
                    ) {

                        if (
                            !/^[a-fA-F0-9]{64}$/.test(
                                String(
                                    file.sha256
                                )
                            )
                        ) {

                            throw new Error(
                                `SHA-256 tidak valid: ${path}`
                            );

                        }

                    }

                }
            );


            return true;

        },


        /* =================================================
           URL VALIDATION
        ================================================= */

        validateURL(
            value
        ) {

            let url;


            try {

                url =
                    new URL(
                        value,
                        location.href
                    );

            } catch {

                throw new Error(
                    `URL tidak valid: ${value}`
                );

            }


            if (
                !CONFIG.allowedProtocols.includes(
                    url.protocol
                )
            ) {

                throw new Error(
                    `Protocol URL tidak diizinkan: ${url.protocol}`
                );

            }


            return true;

        },


        /* =================================================
           PATH NORMALIZATION
        ================================================= */

        normalizePath(
            path
        ) {

            if (
                typeof path !==
                "string"
            ) {

                throw new Error(
                    "Path harus berupa string."
                );

            }


            let value =
                path
                    .replace(
                        /\\/g,
                        "/"
                    )
                    .replace(
                        /^\/+/,
                        ""
                    );


            const parts =
                value
                    .split("/")
                    .filter(
                        part =>
                            part &&
                            part !== "."
                    );


            if (
                parts.includes(
                    ".."
                )
            ) {

                throw new Error(
                    `Path tidak aman: ${path}`
                );

            }


            value =
                parts.join("/");


            if (
                !value
            ) {

                throw new Error(
                    `Path kosong: ${path}`
                );

            }


            return value;

        },


        /* =================================================
           BUILD COMPARISON
        ================================================= */

        isNewerBuild(
            remoteBuild,
            localBuild
        ) {

            return Number(
                remoteBuild
            ) >
            Number(
                localBuild || 0
            );

        },


        /* =================================================
           TEMPORARY FILE
        ================================================= */

        async saveTemporaryFile(
            build,
            path,
            blob,
            type = null
        ) {

            await this.init();


            const numericBuild =
                Utils.integer(
                    build
                );


            if (
                numericBuild === null
            ) {

                throw new Error(
                    "Temporary build tidak valid."
                );

            }


            const normalizedPath =
                this.normalizePath(
                    path
                );


            if (
                !(blob instanceof Blob)
            ) {

                throw new Error(
                    "Temporary content harus Blob."
                );

            }


            if (
                blob.size >
                CONFIG.maxFileSize
            ) {

                throw new Error(
                    `File terlalu besar: ${normalizedPath}`
                );

            }


            const data = {

                id:
                    `${numericBuild}:${normalizedPath}`,

                build:
                    numericBuild,

                path:
                    normalizedPath,

                type:
                    type ||
                    blob.type ||
                    "application/octet-stream",

                content:
                    blob,

                size:
                    blob.size,

                savedAt:
                    Date.now()

            };


            await this.request(
                this.store(
                    CONFIG.stores.temporary,
                    "readwrite"
                ).put(
                    data
                )
            );


            return data;

        },


        async getTemporaryFiles(
            build
        ) {

            await this.init();


            return this.request(
                this.store(
                    CONFIG.stores.temporary
                )
                    .index(
                        "build"
                    )
                    .getAll(
                        Number(build)
                    )
            );

        },


        async deleteTemporaryBuild(
            build
        ) {

            await this.init();


            const files =
                await this.getTemporaryFiles(
                    build
                );


            for (
                const file
                of files
            ) {

                await this.request(
                    this.store(
                        CONFIG.stores.temporary,
                        "readwrite"
                    ).delete(
                        file.id
                    )
                );

            }


            this.emit(
                "temporary:deleted",
                {

                    build:
                        Number(build)

                }
            );


            return true;

        },


        /* =================================================
           DOWNLOAD FILE
        ================================================= */

        async downloadFile(
            build,
            file,
            index,
            total
        ) {

            const path =
                this.normalizePath(
                    file.path
                );


            STATE.currentFile =
                path;


            this.emit(
                "file:download:start",
                {

                    build,

                    path,

                    index:
                        index + 1,

                    total

                }
            );


            const response =
                await this.fetchURL(
                    file.url
                );


            const blob =
                await response.blob();


            if (
                blob.size >
                CONFIG.maxFileSize
            ) {

                throw new Error(
                    `File terlalu besar: ${path}`
                );

            }


            if (
                file.size !==
                undefined &&
                Number(file.size) !==
                Number(blob.size)
            ) {

                throw new Error(
                    `Ukuran file tidak cocok: ${path}`
                );

            }


            await this.saveTemporaryFile(
                build,
                path,
                blob,
                file.type
            );


            STATE.completedFiles =
                index + 1;

            STATE.totalFiles =
                total;

            STATE.progress =
                Math.round(
                    (
                        (index + 1) /
                        total
                    ) * 100
                );


            this.emit(
                "download:progress",
                {

                    build,

                    path,

                    index:
                        index + 1,

                    total,

                    progress:
                        STATE.progress

                }
            );


            this.emit(
                "file:download:complete",
                {

                    build,

                    path

                }
            );


            return blob;

        },


        /* =================================================
           DOWNLOAD BUILD
        ================================================= */

        async downloadBuild(
            manifest
        ) {

            const build =
                Number(
                    manifest.build
                );


            const files =
                manifest.files;


            this.setStatus(
                STATUS.DOWNLOADING,
                {

                    installingBuild:
                        build,

                    progress:
                        0,

                    completedFiles:
                        0,

                    totalFiles:
                        files.length,

                    currentFile:
                        null

                }
            );


            await this.deleteTemporaryBuild(
                build
            );


            this.emit(
                "download:start",
                {

                    build,

                    total:
                        files.length

                }
            );


            for (
                let index = 0;
                index < files.length;
                index++
            ) {

                await this.downloadFile(
                    build,
                    files[index],
                    index,
                    files.length
                );

            }


            this.emit(
                "download:complete",
                {

                    build,

                    total:
                        files.length

                }
            );


            return true;

        },


        /* =================================================
           VERIFY BUILD
        ================================================= */

        async verifyBuild(
            manifest
        ) {

            const build =
                Number(
                    manifest.build
                );


            this.setStatus(
                STATUS.VERIFYING,
                {

                    installingBuild:
                        build,

                    progress:
                        0,

                    completedFiles:
                        0,

                    totalFiles:
                        manifest.files.length

                }
            );


            const temporaryFiles =
                await this.getTemporaryFiles(
                    build
                );


            if (
                temporaryFiles.length !==
                manifest.files.length
            ) {

                throw new Error(
                    `Jumlah file tidak cocok. Expected ${manifest.files.length}, received ${temporaryFiles.length}`
                );

            }


            const temporaryMap =
                new Map(
                    temporaryFiles.map(
                        file =>
                            [
                                file.path,
                                file
                            ]
                    )
                );


            for (
                let index = 0;
                index <
                manifest.files.length;
                index++
            ) {

                const expected =
                    manifest.files[index];


                const path =
                    this.normalizePath(
                        expected.path
                    );


                const actual =
                    temporaryMap.get(
                        path
                    );


                if (
                    !actual
                ) {

                    throw new Error(
                        `File hilang: ${path}`
                    );

                }


                if (
                    expected.size !==
                    undefined &&
                    Number(
                        expected.size
                    ) !==
                    Number(
                        actual.size
                    )
                ) {

                    throw new Error(
                        `Ukuran tidak cocok: ${path}`
                    );

                }


                if (
                    expected.sha256 &&
                    CONFIG.verifyContent
                ) {

                    const hash =
                        await this.sha256(
                            actual.content
                        );


                    if (
                        hash.toLowerCase() !==
                        String(
                            expected.sha256
                        ).toLowerCase()
                    ) {

                        throw new Error(
                            `SHA-256 tidak cocok: ${path}`
                        );

                    }

                }


                STATE.progress =
                    Math.round(
                        (
                            (index + 1) /
                            manifest.files.length
                        ) * 100
                    );


                STATE.completedFiles =
                    index + 1;


                STATE.totalFiles =
                    manifest.files.length;


                this.emit(
                    "verify:progress",
                    {

                        build,

                        path,

                        index:
                            index + 1,

                        total:
                            manifest.files.length,

                        progress:
                            STATE.progress

                    }
                );

            }


            this.emit(
                "verify:success",
                {

                    build

                }
            );


            return true;

        },


        /* =================================================
           SHA-256
        ================================================= */

        async sha256(
            blob
        ) {

            if (
                !window.crypto ||
                !window.crypto.subtle
            ) {

                throw new Error(
                    "Web Crypto API tidak tersedia."
                );

            }


            const buffer =
                await blob.arrayBuffer();


            const hashBuffer =
                await window.crypto.subtle.digest(
                    "SHA-256",
                    buffer
                );


            const bytes =
                new Uint8Array(
                    hashBuffer
                );


            return Array
                .from(
                    bytes
                )
                .map(
                    byte =>
                        byte
                            .toString(16)
                            .padStart(
                                2,
                                "0"
                            )
                )
                .join("");

        },


        /* =================================================
           INSTALL BUILD
        ================================================= */

        async installBuild(
            manifest
        ) {

            const build =
                Number(
                    manifest.build
                );


            this.setStatus(
                STATUS.INSTALLING,
                {

                    installingBuild:
                        build,

                    progress:
                        0,

                    completedFiles:
                        0,

                    totalFiles:
                        manifest.files.length

                }
            );


            const temporaryFiles =
                await this.getTemporaryFiles(
                    build
                );


            if (
                temporaryFiles.length !==
                manifest.files.length
            ) {

                throw new Error(
                    "Temporary build tidak lengkap."
                );

            }


            await this.request(
                this.store(
                    CONFIG.stores.builds,
                    "readwrite"
                ).put({

                    build,

                    version:
                        String(
                            manifest.version
                        ),

                    status:
                        "INSTALLING",

                    fileCount:
                        temporaryFiles.length,

                    installedAt:
                        null,

                    updatedAt:
                        Date.now()

                })
            );


            const oldFiles =
                await this.getBuildFiles(
                    build
                );


            for (
                const oldFile
                of oldFiles
            ) {

                await this.request(
                    this.store(
                        CONFIG.stores.files,
                        "readwrite"
                    ).delete(
                        oldFile.id
                    )
                );

            }


            for (
                let index = 0;
                index <
                temporaryFiles.length;
                index++
            ) {

                const file =
                    temporaryFiles[index];


                const path =
                    this.normalizePath(
                        file.path
                    );


                await this.request(
                    this.store(
                        CONFIG.stores.files,
                        "readwrite"
                    ).put({

                        id:
                            `${build}:${path}`,

                        build,

                        path,

                        type:
                            file.type,

                        content:
                            file.content,

                        size:
                            file.size,

                        installedAt:
                            Date.now()

                    })
                );


                STATE.progress =
                    Math.round(
                        (
                            (index + 1) /
                            temporaryFiles.length
                        ) * 100
                    );


                STATE.completedFiles =
                    index + 1;


                STATE.totalFiles =
                    temporaryFiles.length;


                this.emit(
                    "install:progress",
                    {

                        build,

                        path,

                        index:
                            index + 1,

                        total:
                            temporaryFiles.length,

                        progress:
                            STATE.progress

                    }
                );

            }


            await this.request(
                this.store(
                    CONFIG.stores.builds,
                    "readwrite"
                ).put({

                    build,

                    version:
                        String(
                            manifest.version
                        ),

                    status:
                        "READY",

                    fileCount:
                        temporaryFiles.length,

                    installedAt:
                        Date.now(),

                    updatedAt:
                        Date.now()

                })
            );


            await this.deleteTemporaryBuild(
                build
            );


            this.emit(
                "install:complete",
                {

                    build,

                    version:
                        manifest.version

                }
            );


            return true;

        },


        /* =================================================
           VERIFY INSTALLED BUILD
        ================================================= */

        async verifyInstalledBuild(
            build
        ) {

            const numericBuild =
                Number(build);


            const metadata =
                await this.getBuild(
                    numericBuild
                );


            if (
                !metadata
            ) {

                throw new Error(
                    `Metadata build ${numericBuild} tidak ditemukan.`
                );

            }


            if (
                metadata.status !==
                "READY"
            ) {

                throw new Error(
                    `Build ${numericBuild} belum READY.`
                );

            }


            const files =
                await this.getBuildFiles(
                    numericBuild
                );


            if (
                !files.length
            ) {

                throw new Error(
                    `Build ${numericBuild} tidak memiliki file.`
                );

            }


            if (
                Number(
                    metadata.fileCount
                ) !==
                files.length
            ) {

                throw new Error(
                    `Jumlah file build ${numericBuild} tidak cocok.`
                );

            }


            return true;

        },


        /* =================================================
           ACTIVATE BUILD
        ================================================= */

        async activateBuild(
            build,
            version = null
        ) {

            const numericBuild =
                Utils.integer(
                    build
                );


            if (
                numericBuild === null ||
                numericBuild < 1
            ) {

                throw new Error(
                    "Build untuk activation tidak valid."
                );

            }


            await this.verifyInstalledBuild(
                numericBuild
            );


            const previous =
                await this.readActiveRecord();


            this.setStatus(
                STATUS.ACTIVATING,
                {

                    installingBuild:
                        numericBuild

                }
            );


            const record = {

                id:
                    CONFIG.activeKey,

                build:
                    numericBuild,

                version:
                    version === null
                        ? null
                        : String(
                            version
                        ),

                activatedAt:
                    Date.now()

            };


            try {

                await this.request(
                    this.store(
                        CONFIG.stores.active,
                        "readwrite"
                    ).put(
                        record
                    );


                STATE.activeBuild =
                    numericBuild;

                STATE.activeVersion =
                    record.version;


                this.emit(
                    "build:active",
                    record
                );


                this.emit(
                    "activate:complete",
                    {

                        build:
                            numericBuild,

                        version:
                            record.version,

                        previousBuild:
                            previous
                                ? Number(
                                    previous.build
                                )
                                : null

                    }
                );


                return record;

            } catch (
                error
            ) {

                if (
                    previous
                ) {

                    try {

                        await this.request(
                            this.store(
                                CONFIG.stores.active,
                                "readwrite"
                            ).put(
                                previous
                            )
                        );

                        STATE.activeBuild =
                            Number(
                                previous.build
                            );

                        STATE.activeVersion =
                            previous.version ||
                            null;

                    } catch (
                        rollbackError
                    ) {

                        console.error(
                            "[MARA ENGINE] ACTIVE rollback gagal:",
                            rollbackError
                        );

                    }

                }


                throw error;

            }

        },


        /* =================================================
           BUILD METADATA
        ================================================= */

        async getBuild(
            build
        ) {

            await this.init();


            return this.request(
                this.store(
                    CONFIG.stores.builds
                ).get(
                    Number(build)
                )
            );

        },


        async hasBuild(
            build
        ) {

            const record =
                await this.getBuild(
                    build
                );


            return Boolean(
                record &&
                record.status ===
                "READY"
            );

        },


        async getBuildFiles(
            build
        ) {

            await this.init();


            return this.request(
                this.store(
                    CONFIG.stores.files
                )
                    .index(
                        "build"
                    )
                    .getAll(
                        Number(build)
                    )
            );

        },


        async getBuilds() {

            await this.init();


            return this.request(
                this.store(
                    CONFIG.stores.builds
                ).getAll()
            );

        },


        /* =================================================
           DELETE BUILD
        ================================================= */

        async deleteBuild(
            build
        ) {

            const numericBuild =
                Utils.integer(
                    build
                );


            if (
                numericBuild === null
            ) {

                return false;

            }


            const active =
                await this.getActiveBuild();


            if (
                active !== null &&
                Number(active) ===
                numericBuild
            ) {

                console.warn(
                    "[MARA ENGINE] Build aktif tidak boleh dihapus."
                );

                return false;

            }


            const files =
                await this.getBuildFiles(
                    numericBuild
                );


            for (
                const file
                of files
            ) {

                await this.request(
                    this.store(
                        CONFIG.stores.files,
                        "readwrite"
                    ).delete(
                        file.id
                    )
                );

            }


            await this.request(
                this.store(
                    CONFIG.stores.builds,
                    "readwrite"
                ).delete(
                    numericBuild
                )
            );


            this.revokeBuildURLs(
                numericBuild
            );


            this.emit(
                "build:deleted",
                {

                    build:
                        numericBuild

                }
            );


            return true;

        },


        /* =================================================
           FILE URL
        ================================================= */

        async createFileURL(
            build,
            path
        ) {

            const numericBuild =
                Utils.integer(
                    build
                );


            if (
                numericBuild === null
            ) {

                throw new Error(
                    "Build tidak valid."
                );

            }


            const normalizedPath =
                this.normalizePath(
                    path
                );


            const key =
                `${numericBuild}:${normalizedPath}`;


            if (
                this.objectURLs.has(
                    key
                )
            ) {

                return this.objectURLs.get(
                    key
                );

            }


            const file =
                await this.request(
                    this.store(
                        CONFIG.stores.files
                    ).get(
                        key
                    )
                );


            if (
                !file
            ) {

                throw new Error(
                    `File tidak ditemukan: ${normalizedPath}`
                );

            }


            const blob =
                file.content instanceof Blob
                    ? file.content
                    : new Blob(
                        [
                            file.content
                        ],
                        {

                            type:
                                file.type ||
                                "application/octet-stream"

                        }
                    );


            const url =
                URL.createObjectURL(
                    blob
                );


            this.objectURLs.set(
                key,
                url
            );


            return url;

        },


        /* =================================================
           ACTIVE FILE
        ================================================= */

        async loadActiveFile(
            path
        ) {

            const build =
                await this.getActiveBuild();


            if (
                build === null
            ) {

                throw new Error(
                    "Tidak ada ACTIVE BUILD."
                );

            }


            return this.createFileURL(
                build,
                path
            );

        },


        /* =================================================
           IFRAME LOADER
        ================================================= */

        async loadIntoIframe(
            iframe,
            path
        ) {

            if (
                !iframe ||
                typeof iframe !==
                "object"
            ) {

                throw new Error(
                    "Iframe tidak ditemukan."
                );

            }


            const url =
                await this.loadActiveFile(
                    path
                );


            iframe.src =
                url;


            this.emit(
                "iframe:load",
                {

                    path,

                    url,

                    build:
                        STATE.activeBuild

                }
            );


            return url;

        },


        async loadLockScreen(
            iframe
        ) {

            return this.loadIntoIframe(
                iframe,
                "lock-screen.html"
            );

        },


        async loadHomeScreen(
            iframe
        ) {

            return this.loadIntoIframe(
                iframe,
                "home-screen.html"
            );

        },


        async loadMainFrame(
            iframe
        ) {

            return this.loadLockScreen(
                iframe
            );

        },


        /* =================================================
           OBJECT URL CLEANUP
        ================================================= */

        revokeBuildURLs(
            build
        ) {

            const prefix =
                `${Number(build)}:`;


            for (
                const [
                    key,
                    url
                ]
                of this.objectURLs
            ) {

                if (
                    key.startsWith(
                        prefix
                    )
                ) {

                    try {

                        URL.revokeObjectURL(
                            url
                        );

                    } catch {}

                    this.objectURLs.delete(
                        key
                    );

                }

            }

        },


        revokeAllURLs() {

            for (
                const url
                of this.objectURLs.values()
            ) {

                try {

                    URL.revokeObjectURL(
                        url
                    );

                } catch {}

            }


            this.objectURLs.clear();

        },


        /* =================================================
           UPDATE
        ================================================= */

        async update() {

            if (
                this.updating
            ) {

                return {

                    updated:
                        false,

                    busy:
                        true

                };

            }


            this.updating =
                true;


            STATE.startedAt =
                Date.now();

            STATE.completedAt =
                null;

            STATE.error =
                null;

            STATE.errorCode =
                null;


            try {

                await this.init();


                /* =========================================
                   OFFLINE
                ========================================= */

                if (
                    !navigator.onLine
                ) {

                    this.setStatus(
                        STATUS.OFFLINE
                    );


                    this.emit(
                        "update:none",
                        {

                            offline:
                                true

                        }
                    );


                    return {

                        updated:
                            false,

                        offline:
                            true

                    };

                }


                /* =========================================
                   CHECK MANIFEST
                ========================================= */

                this.setStatus(
                    STATUS.CHECKING
                );


                const manifest =
                    await this.fetchManifest();


                const remoteBuild =
                    Number(
                        manifest.build
                    );


                const localBuild =
                    await this.getActiveBuild();


                /* =========================================
                   NO UPDATE
                ========================================= */

                if (
                    localBuild !== null &&
                    !this.isNewerBuild(
                        remoteBuild,
                        localBuild
                    )
                ) {

                    this.setStatus(
                        STATUS.UP_TO_DATE,
                        {

                            activeBuild:
                                localBuild,

                            activeVersion:
                                STATE.activeVersion,

                            progress:
                                100

                        }
                    );


                    this.emit(
                        "update:none",
                        {

                            build:
                                localBuild,

                            version:
                                STATE.activeVersion

                        }
                    );


                    return {

                        updated:
                            false,

                        build:
                            localBuild,

                        version:
                            STATE.activeVersion

                    };

                }


                /* =========================================
                   UPDATE START
                ========================================= */

                STATE.installingBuild =
                    remoteBuild;


                STATE.progress =
                    0;

                STATE.completedFiles =
                    0;

                STATE.totalFiles =
                    manifest.files.length;


                this.emit(
                    "update:start",
                    {

                        oldBuild:
                            localBuild,

                        newBuild:
                            remoteBuild,

                        version:
                            manifest.version

                    }
                );


                this.emit(
                    "intro:update-start",
                    {

                        build:
                            remoteBuild,

                        version:
                            manifest.version

                    }
                );


                /* =========================================
                   DOWNLOAD
                ========================================= */

                await this.downloadBuild(
                    manifest
                );


                /* =========================================
                   VERIFY
                ========================================= */

                await this.verifyBuild(
                    manifest
                );


                /* =========================================
                   INSTALL
                ========================================= */

                await this.installBuild(
                    manifest
                );


                /* =========================================
                   VERIFY INSTALLED
                ========================================= */

                await this.verifyInstalledBuild(
                    remoteBuild
                );


                /* =========================================
                   ACTIVATE
                ========================================= */

                await this.activateBuild(
                    remoteBuild,
                    manifest.version
                );


                /* =========================================
                   VERIFY ACTIVE
                ========================================= */

                const activeAfterInstall =
                    await this.getActiveBuild();


                if (
                    Number(
                        activeAfterInstall
                    ) !==
                    Number(
                        remoteBuild
                    )
                ) {

                    throw new Error(
                        "ACTIVE BUILD gagal diverifikasi."
                    );

                }


                /* =========================================
                   CLEAN OLD BUILD
                ========================================= */

                if (
                    localBuild !== null &&
                    Number(localBuild) !==
                    Number(remoteBuild) &&
                    !CONFIG.keepOldBuild
                ) {

                    await this.deleteBuild(
                        localBuild
                    );

                }


                /* =========================================
                   COMPLETE
                ========================================= */

                STATE.progress =
                    100;

                STATE.completedAt =
                    Date.now();

                STATE.installingBuild =
                    null;

                STATE.currentFile =
                    null;


                this.setStatus(
                    STATUS.UPDATED,
                    {

                        activeBuild:
                            remoteBuild,

                        activeVersion:
                            manifest.version,

                        progress:
                            100

                    }
                );


                const result = {

                    updated:
                        true,

                    oldBuild:
                        localBuild,

                    newBuild:
                        remoteBuild,

                    version:
                        manifest.version

                };


                this.emit(
                    "update:complete",
                    result
                );


                this.emit(
                    "intro:update-finished",
                    result
                );


                return result;

            } catch (
                error
            ) {

                console.error(
                    "[MARA ENGINE] UPDATE FAILED:",
                    error
                );


                STATE.error =
                    error.message ||
                    "Update gagal.";


                STATE.errorCode =
                    "UPDATE_FAILED";


                STATE.installingBuild =
                    null;

                STATE.currentFile =
                    null;


                this.setStatus(
                    STATUS.ERROR,
                    {

                        error:
                            STATE.error,

                        errorCode:
                            STATE.errorCode

                    }
                );


                try {

                    if (
                        STATE.remoteBuild
                    ) {

                        await this.deleteTemporaryBuild(
                            STATE.remoteBuild
                        );

                    }

                } catch (
                    cleanupError
                ) {

                    console.warn(
                        "[MARA ENGINE] Cleanup temporary gagal:",
                        cleanupError
                    );

                }


                const result = {

                    updated:
                        false,

                    error:
                        true,

                    message:
                        STATE.error,

                    code:
                        STATE.errorCode

                };


                this.emit(
                    "update:error",
                    result
                );


                this.emit(
                    "intro:update-error",
                    result
                );


                return result;

            } finally {

                this.updating =
                    false;

            }

        },


        /* =================================================
           RECOVERY
        ================================================= */

        async recover() {

            await this.init();


            this.setStatus(
                STATUS.RECOVERING
            );


            const temporaryFiles =
                await this.request(
                    this.store(
                        CONFIG.stores.temporary
                    ).getAll()
                );


            const temporaryBuilds =
                new Set(
                    temporaryFiles.map(
                        file =>
                            Number(
                                file.build
                            )
                    )
                );


            for (
                const build
                of temporaryBuilds
            ) {

                const ready =
                    await this.hasBuild(
                        build
                    );


                if (
                    !ready
                ) {

                    await this.deleteTemporaryBuild(
                        build
                    );

                }

            }


            const buildRecords =
                await this.request(
                    this.store(
                        CONFIG.stores.builds
                    ).getAll()
                );


            const active =
                await this.getActiveBuild();


            for (
                const record
                of buildRecords
            ) {

                if (
                    record.status ===
                    "INSTALLING" &&
                    Number(record.build) !==
                    Number(active)
                ) {

                    await this.deleteBuild(
                        record.build
                    );

                }

            }


            this.setStatus(
                STATUS.READY
            );


            this.emit(
                "recovery:complete"
            );


            return true;

        },


        /* =================================================
           STATUS
        ================================================= */

        async getStatus() {

            await this.init();


            const active =
                await this.getActiveBuild();


            const files =
                active !== null
                    ? await this.getBuildFiles(
                        active
                    )
                    : [];


            return {

                engine:
                    CONFIG.name,

                engineVersion:
                    CONFIG.version,

                status:
                    STATE.status,

                phase:
                    STATE.phase,

                activeBuild:
                    active,

                activeVersion:
                    STATE.activeVersion,

                remoteBuild:
                    STATE.remoteBuild,

                remoteVersion:
                    STATE.remoteVersion,

                installingBuild:
                    STATE.installingBuild,

                progress:
                    STATE.progress,

                completedFiles:
                    STATE.completedFiles,

                totalFiles:
                    STATE.totalFiles,

                currentFile:
                    STATE.currentFile,

                fileCount:
                    files.length,

                online:
                    navigator.onLine,

                updating:
                    this.updating,

                database:
                    CONFIG.databaseName,

                databaseVersion:
                    CONFIG.databaseVersion,

                entryFile:
                    CONFIG.entryFile,

                error:
                    STATE.error,

                errorCode:
                    STATE.errorCode,

                startedAt:
                    STATE.startedAt,

                completedAt:
                    STATE.completedAt

            };

        },


        /* =================================================
           SETTINGS
        ================================================= */

        async getSetting(
            id,
            fallback = null
        ) {

            await this.init();


            const result =
                await this.request(
                    this.store(
                        CONFIG.stores.settings
                    ).get(
                        String(id)
                    )
                );


            return result
                ? result.value
                : fallback;

        },


        async setSetting(
            id,
            value
        ) {

            await this.init();


            const record = {

                id:
                    String(id),

                value,

                updatedAt:
                    Date.now()

            };


            await this.request(
                this.store(
                    CONFIG.stores.settings,
                    "readwrite"
                ).put(
                    record
                )
            );


            this.emit(
                "setting:changed",
                record
            );


            return value;

        },


        /* =================================================
           PUBLIC SLEEP
        ================================================= */

        sleep(
            ms
        ) {

            return Utils.sleep(
                ms
            );

        }

    };


    /* =====================================================
       GLOBAL ENGINE
    ===================================================== */

    window.MARAEngineSingle =
        ENGINE;


    /* =====================================================
       GLOBAL UPDATE API
    ===================================================== */

    window.MARAUpdate = {

        init:
            () =>
                ENGINE.init(),

        check:
            () =>
                ENGINE.fetchManifest(),

        update:
            () =>
                ENGINE.update(),

        recover:
            () =>
                ENGINE.recover(),

        status:
            () =>
                ENGINE.getStatus(),

        state:
            () =>
                ENGINE.getState(),

        activeBuild:
            () =>
                ENGINE.getActiveBuild(),

        load:
            path =>
                ENGINE.loadActiveFile(
                    path
                ),

        loadIntoIframe:
            (
                iframe,
                path
            ) =>
                ENGINE.loadIntoIframe(
                    iframe,
                    path
                ),

        loadLockScreen:
            iframe =>
                ENGINE.loadLockScreen(
                    iframe
                ),

        loadHomeScreen:
            iframe =>
                ENGINE.loadHomeScreen(
                    iframe
                ),

        getBuild:
            build =>
                ENGINE.getBuild(
                    build
                ),

        getBuilds:
            () =>
                ENGINE.getBuilds(),

        getBuildFiles:
            build =>
                ENGINE.getBuildFiles(
                    build
                ),

        deleteBuild:
            build =>
                ENGINE.deleteBuild(
                    build
                ),

        getSetting:
            (
                id,
                fallback
            ) =>
                ENGINE.getSetting(
                    id,
                    fallback
                ),

        setSetting:
            (
                id,
                value
            ) =>
                ENGINE.setSetting(
                    id,
                    value
                )

    };


    /* =====================================================
       DEFAULT ENGINE EVENTS
    ===================================================== */

    ENGINE.on(
        "download:progress",
        data => {

            console.log(
                `[MARA ENGINE] DOWNLOAD ${data.progress}% — ${data.path}`
            );

        }
    );


    ENGINE.on(
        "verify:progress",
        data => {

            console.log(
                `[MARA ENGINE] VERIFY ${data.progress}% — ${data.path}`
            );

        }
    );


    ENGINE.on(
        "install:progress",
        data => {

            console.log(
                `[MARA ENGINE] INSTALL ${data.progress}% — ${data.path}`
            );

        }
    );


    ENGINE.on(
        "verify:success",
        data => {

            console.log(
                "[MARA ENGINE] VERIFY OK:",
                data.build
            );

        }
    );


    ENGINE.on(
        "install:complete",
        data => {

            console.log(
                "[MARA ENGINE] INSTALL COMPLETE:",
                data.build
            );

        }
    );


    ENGINE.on(
        "build:active",
        data => {

            console.log(
                "[MARA ENGINE] ACTIVE BUILD:",
                data.build
            );

        }
    );


    ENGINE.on(
        "update:complete",
        data => {

            console.log(
                "[MARA ENGINE] UPDATE COMPLETE:",
                data
            );

        }
    );


    ENGINE.on(
        "update:error",
        data => {

            console.error(
                "[MARA ENGINE] UPDATE ERROR:",
                data.message
            );

        }
    );


    /* =====================================================
       NETWORK EVENTS
    ===================================================== */

    window.addEventListener(
        "online",
        () => {

            console.log(
                "[MARA ENGINE] NETWORK ONLINE"
            );


            ENGINE.emit(
                "network:online"
            );


            if (
                CONFIG.autoUpdate &&
                !ENGINE.updating
            ) {

                setTimeout(
                    () => {

                        if (
                            !ENGINE.updating
                        ) {

                            ENGINE.update()
                                .catch(
                                    error => {

                                        console.error(
                                            "[MARA ENGINE] Online recovery error:",
                                            error
                                        );

                                    }
                                );

                        }

                    },
                    CONFIG.autoUpdateDelay
                );

            }

        }
    );


    window.addEventListener(
        "offline",
        () => {

            console.log(
                "[MARA ENGINE] NETWORK OFFLINE"
            );


            ENGINE.setStatus(
                STATUS.OFFLINE
            );


            ENGINE.emit(
                "network:offline"
            );

        }
    );


    /* =====================================================
       MESSAGE BRIDGE
    ===================================================== */

    window.addEventListener(
        "message",
        event => {

            const data =
                event.data;


            if (
                !data ||
                typeof data !==
                "object"
            ) {

                return;

            }


            /* =============================================
               STATUS
            ============================================= */

            if (
                data.type ===
                "MARA_ENGINE_STATUS_REQUEST"
            ) {

                ENGINE
                    .getStatus()
                    .then(
                        status => {

                            event.source?.postMessage(
                                {

                                    type:
                                        "MARA_ENGINE_STATUS",

                                    source:
                                        CONFIG.name,

                                    status

                                },
                                "*"
                            );

                        }
                    )
                    .catch(
                        error => {

                            event.source?.postMessage(
                                {

                                    type:
                                        "MARA_ENGINE_ERROR",

                                    source:
                                        CONFIG.name,

                                    error:
                                        error.message

                                },
                                "*"
                            );

                        }
                    );

            }


            /* =============================================
               UPDATE
            ============================================= */

            if (
                data.type ===
                "MARA_ENGINE_UPDATE_REQUEST"
            ) {

                ENGINE
                    .update()
                    .then(
                        result => {

                            event.source?.postMessage(
                                {

                                    type:
                                        "MARA_ENGINE_UPDATE_RESULT",

                                    source:
                                        CONFIG.name,

                                    result

                                },
                                "*"
                            );

                        }
                    );

            }


            /* =============================================
               ACTIVE BUILD
            ============================================= */

            if (
                data.type ===
                "MARA_ENGINE_ACTIVE_BUILD_REQUEST"
            ) {

                ENGINE
                    .getActiveBuild()
                    .then(
                        build => {

                            event.source?.postMessage(
                                {

                                    type:
                                        "MARA_ENGINE_ACTIVE_BUILD",

                                    source:
                                        CONFIG.name,

                                    build

                                },
                                "*"
                            );

                        }
                    );

            }


            /* =============================================
               LOAD ACTIVE FILE
            ============================================= */

            if (
                data.type ===
                "MARA_ENGINE_LOAD_REQUEST"
            ) {

                ENGINE
                    .loadActiveFile(
                        data.path
                    )
                    .then(
                        url => {

                            event.source?.postMessage(
                                {

                                    type:
                                        "MARA_ENGINE_LOAD_RESULT",

                                    source:
                                        CONFIG.name,

                                    path:
                                        data.path,

                                    url

                                },
                                "*"
                            );

                        }
                    )
                    .catch(
                        error => {

                            event.source?.postMessage(
                                {

                                    type:
                                        "MARA_ENGINE_LOAD_ERROR",

                                    source:
                                        CONFIG.name,

                                    path:
                                        data.path,

                                    error:
                                        error.message

                                },
                                "*"
                            );

                        }
                    );

            }

        }
    );


    /* =====================================================
       DOM READY
    ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        async () => {

            try {

                await ENGINE.init();


                await ENGINE.recover();


                const status =
                    await ENGINE.getStatus();


                console.log(
                    "[MARA ENGINE] STATUS:",
                    status
                );


                if (
                    CONFIG.autoUpdate &&
                    navigator.onLine
                ) {

                    setTimeout(
                        () => {

                            if (
                                !ENGINE.updating
                            ) {

                                ENGINE
                                    .update()
                                    .catch(
                                        error => {

                                            console.error(
                                                "[MARA ENGINE] AUTO UPDATE ERROR:",
                                                error
                                            );

                                        }
                                    );

                            }

                        },
                        CONFIG.autoUpdateDelay
                    );

                }

            } catch (
                error
            ) {

                console.error(
                    "[MARA ENGINE] INITIALIZATION ERROR:",
                    error
                );


                STATE.error =
                    error.message;


                STATE.errorCode =
                    "INITIALIZATION_FAILED";


                ENGINE.setStatus(
                    STATUS.ERROR,
                    {

                        error:
                            error.message,

                        errorCode:
                            STATE.errorCode

                    }
                );

            }

        },
        {
            once:
                true
        }
    );


    /* =====================================================
       BEFORE UNLOAD
    ===================================================== */

    window.addEventListener(
        "beforeunload",
        () => {

            ENGINE.revokeAllURLs();

        }
    );


    /* =====================================================
       READY LOG
    ===================================================== */

    console.log(
        "=============================================="
    );

    console.log(
        " MARA OS ENGINE SINGLE"
    );

    console.log(
        " FINAL UNIFIED UPDATE / BUILD / STORAGE ENGINE"
    );

    console.log(
        " Database:",
        CONFIG.databaseName
    );

    console.log(
        " Database Version:",
        CONFIG.databaseVersion
    );

    console.log(
        " Engine Version:",
        CONFIG.version
    );

    console.log(
        " ENGINE-SINGLE.JS LOADED SUCCESSFULLY"
    );

    console.log(
        "=============================================="
    );

})();