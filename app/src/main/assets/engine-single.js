

/* =========================================================
   MARA OS
   ENGINE SINGLE
   STAGE 2 — UNIFIED BUILD / UPDATE / STORAGE ENGINE

   ARCHITECTURE

   index.html
        │
        ├── intro.html
        │
        ├── engine-single.js
        │
        └── build.js
                 │
                 ▼
        ┌──────────────────────┐
        │   MARA ENGINE SINGLE │
        └──────────────────────┘
                 │
        ┌────────┼────────┐
        ▼        ▼        ▼
     UPDATE   STORAGE   EVENTS
        │        │        │
        ▼        ▼        ▼
    Manifest IndexedDB postMessage
        │
        ▼
     Download
        │
        ▼
   Temporary Build
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
   ACTIVE BUILD
        │
        ▼
     build.js
        │
        ▼
     MARA UX


   DATABASE

   MARA_OS_STORAGE

   VERSION 4

   STORES:

   builds
      └── metadata build

   files
      └── permanent build files

   active
      └── ACTIVE BUILD

   temporary
      └── temporary update files

   settings
      └── engine settings

========================================================= */

(() => {

    "use strict";


    /* =====================================================
       GLOBAL PROTECTION
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

        databaseName:
            "MARA_OS_STORAGE",

        databaseVersion:
            4,

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

        allowedProtocols: [

            "https:"

        ]

    };


    /* =====================================================
       STATE
    ===================================================== */

    const STATE = {

        status:
            "IDLE",

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
            null

    };


    /* =====================================================
       ENGINE OBJECT
    ===================================================== */

    const ENGINE = {

        __MARA_ENGINE_SINGLE__:
            true,

        version:
            "2.0.0",

        db:
            null,

        initialized:
            false,

        updating:
            false,

        events:
            Object.create(null),

        objectURLs:
            new Map(),

        state:
            STATE,


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
                    "Callback event harus berupa function."
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

            listeners.slice().forEach(
                listener => {

                    try {

                        listener(
                            data
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
                data
            );

        },


        /* =================================================
           BROADCAST
        ================================================= */

        broadcast(
            event,
            data = {}
        ) {

            try {

                window.postMessage(
                    {

                        source:
                            "MARA_ENGINE_SINGLE",

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

            Object.assign(
                STATE,
                extra
            );

            this.emit(
                "state",
                {
                    ...STATE
                }
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


            this.setStatus(
                "INITIALIZING"
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
                    Number(
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
                "READY"
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
                                    event.target.transaction
                                        .objectStore(
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
                                    event.target.transaction
                                        .objectStore(
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
                                    event.target.transaction
                                        .objectStore(
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
           ACTIVE RECORD
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


            const build =
                Number(
                    record.build
                );


            return Number.isFinite(
                build
            )
                ? build
                : null;

        },


        async setActiveBuild(
            build,
            version = null
        ) {

            await this.init();


            const numericBuild =
                Number(build);


            if (
                !Number.isInteger(
                    numericBuild
                ) ||
                numericBuild < 1
            ) {

                throw new Error(
                    "ACTIVE BUILD tidak valid."
                );

            }


            const ready =
                await this.hasBuild(
                    numericBuild
                );


            if (
                !ready
            ) {

                throw new Error(
                    `Build ${numericBuild} belum READY.`
                );

            }


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


            await this.request(
                this.store(
                    CONFIG.stores.active,
                    "readwrite"
                ).put(
                    record
                )
            );


            STATE.activeBuild =
                numericBuild;

            STATE.activeVersion =
                record.version;


            this.emit(
                "build:active",
                record
            );


            return record;

        },


        /* =================================================
           FETCH
        ================================================= */

        async fetchURL(
            url,
            options = {}
        ) {

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

                        await this.sleep(
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


            return response.json();

        },


        /* =================================================
           MANIFEST
        ================================================= */

        async fetchManifest() {

            this.setStatus(
                "FETCHING_MANIFEST"
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
                !manifest.version ||
                typeof manifest.version !==
                    "string"
            ) {

                throw new Error(
                    "Manifest.version tidak valid."
                );

            }


            const build =
                Number(
                    manifest.build
                );


            if (
                !Number.isInteger(
                    build
                ) ||
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
                        !path
                    ) {

                        throw new Error(
                            "Path file kosong."
                        );

                    }


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
           PATH VALIDATION
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


            value =
                value
                    .split("/")
                    .filter(
                        part =>
                            part &&
                            part !== "." &&
                            part !== ".."
                    )
                    .join("/");


            if (
                !value ||
                value.includes(
                    ".."
                )
            ) {

                throw new Error(
                    `Path tidak aman: ${path}`
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


            const numericBuild =
                Number(build);


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
                "DOWNLOADING",
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


            if (
                files.length === 0
            ) {

                throw new Error(
                    "Manifest tidak memiliki file."
                );

            }


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
                "VERIFYING",
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
                !crypto.subtle
            ) {

                throw new Error(
                    "Web Crypto API tidak tersedia."
                );

            }


            const buffer =
                await blob.arrayBuffer();


            const hashBuffer =
                await crypto.subtle.digest(
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
                "INSTALLING",
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


            /* =============================================
               MARK INSTALLING
            ============================================= */

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


            /* =============================================
               REMOVE OLD PARTIAL FILES
            ============================================= */

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


            /* =============================================
               TEMP → PERMANENT
            ============================================= */

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


            /* =============================================
               MARK READY
            ============================================= */

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


            /* =============================================
               TEMP CLEANUP
            ============================================= */

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

        async verifyActiveBuild(
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
                metadata.fileCount !==
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
                Number(build);


            await this.verifyActiveBuild(
                numericBuild
            );


            const previous =
                await this.readActiveRecord();


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
                    )
                );


                STATE.activeBuild =
                    numericBuild;

                STATE.activeVersion =
                    record.version;


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


                return true;


            } catch (
                error
            ) {

                /*
                 * RESTORE ACTIVE RECORD
                 */

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
                            "[MARA ENGINE] Restore ACTIVE gagal:",
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


        /* =================================================
           DELETE BUILD
        ================================================= */

        async deleteBuild(
            build
        ) {

            const numericBuild =
                Number(build);


            if (
                !Number.isInteger(
                    numericBuild
                )
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
           CREATE FILE URL
        ================================================= */

        async createFileURL(
            build,
            path
        ) {

            const numericBuild =
                Number(build);


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
           LOAD ACTIVE FILE
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
           LOAD INTO IFRAME
        ================================================= */

        async loadIntoIframe(
            iframe,
            path
        ) {

            if (
                !iframe
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
           REVOKE URL
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


            try {

                await this.init();


                /* =========================================
                   OFFLINE
                ========================================= */

                if (
                    !navigator.onLine
                ) {

                    this.setStatus(
                        "OFFLINE"
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
                   MANIFEST
                ========================================= */

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
                        "UP_TO_DATE",
                        {

                            activeBuild:
                                localBuild,

                            activeVersion:
                                this.state.activeVersion

                        }
                    );


                    this.emit(
                        "update:none",
                        {

                            build:
                                localBuild,

                            version:
                                this.state.activeVersion

                        }
                    );


                    return {

                        updated:
                            false,

                        build:
                            localBuild,

                        version:
                            this.state.activeVersion

                    };

                }


                /* =========================================
                   UPDATE START
                ========================================= */

                STATE.installingBuild =
                    remoteBuild;


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
                   VERIFY INSTALLED BUILD
                ========================================= */

                await this.verifyActiveBuild(
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
                   VERIFY ACTIVE RECORD
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
                    "UPDATED",
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
                    error.message;


                STATE.installingBuild =
                    null;


                STATE.currentFile =
                    null;


                this.setStatus(
                    "ERROR",
                    {

                        error:
                            error.message

                    }
                );


                /*
                 * ACTIVE BUILD LAMA TIDAK DIUBAH.
                 */


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
                        "[MARA ENGINE] Temporary cleanup gagal:",
                        cleanupError
                    );

                }


                this.emit(
                    "update:error",
                    {

                        error,

                        message:
                            error.message

                    }
                );


                this.emit(
                    "intro:update-error",
                    {

                        message:
                            error.message

                    }
                );


                return {

                    updated:
                        false,

                    error:
                        true,

                    message:
                        error.message

                };


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


            const temporaryFiles =
                await this.request(
                    this.store(
                        CONFIG.stores.temporary
                    ).getAll()
                );


            const builds =
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
                of builds
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


            /*
             * Bersihkan metadata INSTALLING
             * yang tidak aktif.
             */

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


            this.emit(
                "recovery:complete"
            );


            return true;

        },


        /* =================================================
           STATUS
        ================================================= */

        async getStatus() {

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
                    "MARA_ENGINE_SINGLE",

                engineVersion:
                    this.version,

                status:
                    STATE.status,

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
                    STATE.error

            };

        },


        /* =================================================
           SLEEP
        ================================================= */

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

        getBuildFiles:
            build =>
                ENGINE.getBuildFiles(
                    build
                ),

        deleteBuild:
            build =>
                ENGINE.deleteBuild(
                    build
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

                        ENGINE.update()
                            .catch(
                                error => {

                                    console.error(
                                        "[MARA ENGINE] Online recovery error:",
                                        error
                                    );

                                }
                            );

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
                "OFFLINE"
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
               STATUS REQUEST
            ============================================= */

            if (
                data.type ===
                "MARA_ENGINE_STATUS_REQUEST"
            ) {

                ENGINE
                    .getStatus()
                    .then(
                        status => {

                            try {

                                event.source?.postMessage(
                                    {

                                        type:
                                            "MARA_ENGINE_STATUS",

                                        status

                                    },
                                    "*"
                                );

                            } catch {}

                        }
                    );

            }


            /* =============================================
               UPDATE REQUEST
            ============================================= */

            if (
                data.type ===
                "MARA_ENGINE_UPDATE_REQUEST"
            ) {

                ENGINE
                    .update()
                    .then(
                        result => {

                            try {

                                event.source?.postMessage(
                                    {

                                        type:
                                            "MARA_ENGINE_UPDATE_RESULT",

                                        result

                                    },
                                    "*"
                                );

                            } catch {}

                        }
                    );

            }


            /* =============================================
               ACTIVE BUILD REQUEST
            ============================================= */

            if (
                data.type ===
                "MARA_ENGINE_ACTIVE_BUILD_REQUEST"
            ) {

                ENGINE
                    .getActiveBuild()
                    .then(
                        build => {

                            try {

                                event.source?.postMessage(
                                    {

                                        type:
                                            "MARA_ENGINE_ACTIVE_BUILD",

                                        build

                                    },
                                    "*"
                                );

                            } catch {}

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


                /* =========================================
                   AUTO UPDATE
                ========================================= */

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


                ENGINE.setStatus(
                    "ERROR",
                    {

                        error:
                            error.message

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
        " Unified Build / Update / Storage Engine"
    );

    console.log(
        " Database: MARA_OS_STORAGE"
    );

    console.log(
        " Database Version:",
        CONFIG.databaseVersion
    );

    console.log(
        " Engine Version:",
        ENGINE.version
    );

    console.log(
        " ENGINE-SINGLE.JS LOADED SUCCESSFULLY"
    );

    console.log(
        "=============================================="

    );

})();