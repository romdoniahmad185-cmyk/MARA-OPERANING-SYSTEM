/* =========================================================
   MARA OS
   ENGINE SINGLE
   STAGE 1 — COMPLETE BUILD / UPDATE ENGINE

   PIPELINE

   START
      ↓
   OPEN INDEXEDDB
      ↓
   LOAD ACTIVE BUILD
      ↓
   CHECK NETWORK
      ↓
   FETCH MANIFEST
      ↓
   COMPARE BUILD
      ↓
   DOWNLOAD BUILD
      ↓
   TEMPORARY STORAGE
      ↓
   VERIFY FILES
      ↓
   INSTALL BUILD
      ↓
   MARK READY
      ↓
   ACTIVATE BUILD
      ↓
   VERIFY ACTIVE BUILD
      ↓
   CLEAN OLD BUILD
      ↓
   LOAD UI
      ↓
   MARA OS READY

   FEATURES

   ✓ IndexedDB
   ✓ Temporary build
   ✓ Permanent build
   ✓ Active build
   ✓ Manifest validation
   ✓ SHA-256 verification
   ✓ Download progress
   ✓ Install progress
   ✓ Rollback protection
   ✓ Offline mode
   ✓ Online recovery
   ✓ Update lock
   ✓ Object URL management
   ✓ iframe loader
   ✓ postMessage bridge
   ✓ Intro communication
   ✓ Global API
   ✓ Error recovery
   ✓ Build cleanup
   ✓ Cache busting
   ✓ Safe path validation

========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const MARA_ENGINE_CONFIG = {

    databaseName:
        "MARA_OS_STORAGE",

    databaseVersion:
        3,

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

    repository:
        "https://romdoniahmad185-cmyk.github.io/mara-os-updates/stable/update-manifest.json",

    requestTimeout:
        30000,

    verifyContent:
        true,

    keepOldBuild:
        false,

    autoUpdate:
        true,

    autoUpdateDelay:
        1500,

    retryCount:
        2,

    retryDelay:
        1000,

    maxFileSize:
        50 * 1024 * 1024,

    messageTarget:
        "*"

};


/* =========================================================
   ENGINE
========================================================= */

window.MARAEngineSingle = {

    db:
        null,

    initialized:
        false,

    updating:
        false,

    objectURLs:
        new Map(),

    events:
        {},

    state: {

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

        progress:
            0,

        totalFiles:
            0,

        completedFiles:
            0,

        currentFile:
            null,

        error:
            null,

        startedAt:
            null,

        completedAt:
            null

    },


    /* =====================================================
       EVENT SYSTEM
    ===================================================== */

    on(
        event,
        callback
    ) {

        if (
            !this.events[event]
        ) {

            this.events[event] = [];

        }

        this.events[event].push(
            callback
        );

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
                item =>
                    item !== callback
            );

    },


    emit(
        event,
        data = {}
    ) {

        const listeners =
            this.events[event] || [];

        listeners.forEach(
            callback => {

                try {

                    callback(
                        data
                    );

                } catch (
                    error
                ) {

                    console.error(
                        "[MARA ENGINE] EVENT ERROR",
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


    /* =====================================================
       BROADCAST TO IFRAMES
    ===================================================== */

    broadcast(
        event,
        data = {}
    ) {

        try {

            window.postMessage(
                {

                    source:
                        "MARA_ENGINE_SINGLE",

                    event,

                    data,

                    timestamp:
                        Date.now()

                },

                MARA_ENGINE_CONFIG.messageTarget
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


    /* =====================================================
       UPDATE STATE
    ===================================================== */

    setStatus(
        status,
        extra = {}
    ) {

        this.state.status =
            status;

        Object.assign(
            this.state,
            extra
        );

        this.emit(
            "state",
            {
                ...this.state
            }
        );

    },


    /* =====================================================
       INIT
    ===================================================== */

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

            this.state.activeBuild =
                Number(
                    active.build
                );

            this.state.activeVersion =
                active.version ||
                null;

        }

        this.setStatus(
            "READY"
        );

        this.emit(
            "ready",
            {

                activeBuild:
                    this.state.activeBuild,

                activeVersion:
                    this.state.activeVersion

            }
        );

        console.log(
            "[MARA ENGINE] READY",
            this.state
        );

        return this.db;

    },


    /* =====================================================
       OPEN DATABASE
    ===================================================== */

    openDatabase() {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const request =
                    indexedDB.open(
                        MARA_ENGINE_CONFIG.databaseName,
                        MARA_ENGINE_CONFIG.databaseVersion
                    );


                request.onupgradeneeded =
                    event => {

                        const db =
                            event.target.result;


                        /* =========================
                           BUILDS
                        ========================= */

                        if (
                            !db.objectStoreNames.contains(
                                MARA_ENGINE_CONFIG.stores.builds
                            )
                        ) {

                            db.createObjectStore(
                                MARA_ENGINE_CONFIG.stores.builds,
                                {
                                    keyPath:
                                        "build"
                                }
                            );

                        }


                        /* =========================
                           FILES
                        ========================= */

                        if (
                            !db.objectStoreNames.contains(
                                MARA_ENGINE_CONFIG.stores.files
                            )
                        ) {

                            const store =
                                db.createObjectStore(
                                    MARA_ENGINE_CONFIG.stores.files,
                                    {
                                        keyPath:
                                            "id"
                                    }
                                );

                            store.createIndex(
                                "build",
                                "build",
                                {
                                    unique:
                                        false
                                }
                            );

                            store.createIndex(
                                "path",
                                "path",
                                {
                                    unique:
                                        false
                                }
                            );

                        }


                        /* =========================
                           ACTIVE
                        ========================= */

                        if (
                            !db.objectStoreNames.contains(
                                MARA_ENGINE_CONFIG.stores.active
                            )
                        ) {

                            db.createObjectStore(
                                MARA_ENGINE_CONFIG.stores.active,
                                {
                                    keyPath:
                                        "id"
                                }
                            );

                        }


                        /* =========================
                           TEMPORARY
                        ========================= */

                        if (
                            !db.objectStoreNames.contains(
                                MARA_ENGINE_CONFIG.stores.temporary
                            )
                        ) {

                            const store =
                                db.createObjectStore(
                                    MARA_ENGINE_CONFIG.stores.temporary,
                                    {
                                        keyPath:
                                            "id"
                                    }
                                );

                            store.createIndex(
                                "build",
                                "build",
                                {
                                    unique:
                                        false
                                }
                            );

                        }


                        /* =========================
                           SETTINGS
                        ========================= */

                        if (
                            !db.objectStoreNames.contains(
                                MARA_ENGINE_CONFIG.stores.settings
                            )
                        ) {

                            db.createObjectStore(
                                MARA_ENGINE_CONFIG.stores.settings,
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


    /* =====================================================
       STORE
    ===================================================== */

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


    /* =====================================================
       REQUEST HELPER
    ===================================================== */

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
                            request.error
                        );

                    };

            }
        );

    },


    /* =====================================================
       READ ACTIVE RECORD
    ===================================================== */

    async readActiveRecord() {

        await this.initDatabaseOnly();

        return this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.active
            ).get(
                "active"
            )
        );

    },


    /* =====================================================
       INIT DATABASE ONLY
    ===================================================== */

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


    /* =====================================================
       FETCH URL
    ===================================================== */

    async fetchURL(
        url,
        options = {}
    ) {

        let lastError =
            null;

        for (
            let attempt = 0;
            attempt <=
            MARA_ENGINE_CONFIG.retryCount;
            attempt++
        ) {

            const controller =
                new AbortController();

            const timer =
                setTimeout(
                    () => {

                        controller.abort();

                    },
                    MARA_ENGINE_CONFIG.requestTimeout
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
                    MARA_ENGINE_CONFIG.retryCount
                ) {

                    await this.sleep(
                        MARA_ENGINE_CONFIG.retryDelay
                    );

                }

            }

        }

        throw lastError ||
            new Error(
                `Gagal mengambil ${url}`
            );

    },


    /* =====================================================
       FETCH JSON
    ===================================================== */

    async fetchJSON(
        url
    ) {

        const response =
            await this.fetchURL(
                url
            );

        return response.json();

    },


    /* =====================================================
       FETCH MANIFEST
    ===================================================== */

    async fetchManifest() {

        this.setStatus(
            "FETCHING_MANIFEST"
        );

        this.emit(
            "manifest:start"
        );

        const separator =
            MARA_ENGINE_CONFIG.repository
                .includes("?")
                ? "&"
                : "?";

        const url =
            `${MARA_ENGINE_CONFIG.repository}${separator}_=${Date.now()}`;

        const manifest =
            await this.fetchJSON(
                url
            );

        this.validateManifest(
            manifest
        );

        this.state.remoteBuild =
            Number(
                manifest.build
            );

        this.state.remoteVersion =
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


    /* =====================================================
       MANIFEST VALIDATOR
    ===================================================== */

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
            !manifest.version
        ) {

            throw new Error(
                "Manifest tidak memiliki version."
            );

        }

        if (
            manifest.build ===
            undefined
        ) {

            throw new Error(
                "Manifest tidak memiliki build."
            );

        }

        if (
            !Array.isArray(
                manifest.files
            )
        ) {

            throw new Error(
                "Manifest harus memiliki files[]."
            );

        }

        if (
            Number(
                manifest.build
            ) < 1
        ) {

            throw new Error(
                "Nomor build tidak valid."
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
                        "Entry file manifest tidak valid."
                    );

                }

                if (
                    !file.path
                ) {

                    throw new Error(
                        "File manifest tidak memiliki path."
                    );

                }

                if (
                    !file.url
                ) {

                    throw new Error(
                        `URL tidak ada: ${file.path}`
                    );

                }

                if (
                    paths.has(
                        file.path
                    )
                ) {

                    throw new Error(
                        `Path duplikat: ${file.path}`
                    );

                }

                paths.add(
                    file.path
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
                        size < 0
                    ) {

                        throw new Error(
                            `Ukuran file tidak valid: ${file.path}`
                        );

                    }

                }

            }
        );

        return true;

    },


    /* =====================================================
       BUILD COMPARISON
    ===================================================== */

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


    /* =====================================================
       GET ACTIVE BUILD
    ===================================================== */

    async getActiveBuild() {

        const record =
            await this.readActiveRecord();

        if (
            !record
        ) {

            return null;

        }

        return Number(
            record.build
        );

    },


    /* =====================================================
       SET ACTIVE BUILD
    ===================================================== */

    async setActiveBuild(
        build,
        version = null
    ) {

        await this.init();

        const data = {

            id:
                "active",

            build:
                Number(build),

            version:
                version
                    ? String(version)
                    : null,

            activatedAt:
                Date.now()

        };

        await this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.active,
                "readwrite"
            ).put(
                data
            )
        );

        this.state.activeBuild =
            Number(build);

        this.state.activeVersion =
            version
                ? String(version)
                : null;

        this.emit(
            "build:active",
            data
        );

        return data;

    },


    /* =====================================================
       SAVE TEMPORARY FILE
    ===================================================== */

    async saveTemporaryFile(
        build,
        path,
        blob,
        type
    ) {

        await this.init();

        const id =
            `${build}:${path}`;

        const data = {

            id,

            build:
                Number(build),

            path,

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
                MARA_ENGINE_CONFIG.stores.temporary,
                "readwrite"
            ).put(
                data
            )
        );

        return data;

    },


    /* =====================================================
       GET TEMPORARY FILES
    ===================================================== */

    async getTemporaryFiles(
        build
    ) {

        await this.init();

        return this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.temporary
            )
            .index(
                "build"
            )
            .getAll(
                Number(build)
            )
        );

    },


    /* =====================================================
       DOWNLOAD FILE
    ===================================================== */

    async downloadFile(
        build,
        file,
        index,
        total
    ) {

        this.state.currentFile =
            file.path;

        const response =
            await this.fetchURL(
                file.url
            );

        const blob =
            await response.blob();

        if (
            blob.size >
            MARA_ENGINE_CONFIG.maxFileSize
        ) {

            throw new Error(
                `File terlalu besar: ${file.path}`
            );

        }

        if (
            file.size !==
            undefined &&
            Number(file.size) !==
            blob.size
        ) {

            throw new Error(
                `Ukuran file tidak cocok: ${file.path}`
            );

        }

        await this.saveTemporaryFile(
            build,
            file.path,
            blob,
            file.type
        );

        this.state.completedFiles =
            index + 1;

        this.state.totalFiles =
            total;

        this.state.progress =
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

                path:
                    file.path,

                index:
                    index + 1,

                total,

                progress:
                    this.state.progress

            }
        );

        return blob;

    },


    /* =====================================================
       DOWNLOAD BUILD
    ===================================================== */

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
                    files.length

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
            let i = 0;
            i < files.length;
            i++
        ) {

            await this.downloadFile(
                build,
                files[i],
                i,
                files.length
            );

        }

        this.emit(
            "download:complete",
            {
                build
            }
        );

        return true;

    },


    /* =====================================================
       VERIFY BUILD
    ===================================================== */

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
                progress:
                    0
            }
        );

        const files =
            await this.getTemporaryFiles(
                build
            );

        if (
            files.length !==
            manifest.files.length
        ) {

            throw new Error(
                `Jumlah file tidak cocok. Expected ${manifest.files.length}, received ${files.length}`
            );

        }

        for (
            let i = 0;
            i <
            manifest.files.length;
            i++
        ) {

            const expected =
                manifest.files[i];

            const actual =
                files.find(
                    file =>
                        file.path ===
                        expected.path
                );

            if (
                !actual
            ) {

                throw new Error(
                    `File hilang: ${expected.path}`
                );

            }

            if (
                expected.size !==
                undefined &&
                Number(expected.size) !==
                Number(actual.size)
            ) {

                throw new Error(
                    `Ukuran tidak cocok: ${expected.path}`
                );

            }

            if (
                expected.sha256 &&
                MARA_ENGINE_CONFIG.verifyContent
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
                        `SHA-256 tidak cocok: ${expected.path}`
                    );

                }

            }

            this.state.progress =
                Math.round(
                    (
                        (i + 1) /
                        manifest.files.length
                    ) * 100
                );

            this.emit(
                "verify:progress",
                {

                    build,

                    path:
                        expected.path,

                    progress:
                        this.state.progress

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


    /* =====================================================
       SHA256
    ===================================================== */

    async sha256(
        blob
    ) {

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


    /* =====================================================
       INSTALL BUILD
    ===================================================== */

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
                    0
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

        /* =================================================
           BUILD METADATA — INSTALLING
        ================================================= */

        await this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.builds,
                "readwrite"
            ).put({

                build,

                version:
                    String(
                        manifest.version
                    ),

                installedAt:
                    Date.now(),

                status:
                    "INSTALLING",

                fileCount:
                    temporaryFiles.length

            })
        );


        /* =================================================
           COPY TEMP → PERMANENT
        ================================================= */

        for (
            let i = 0;
            i <
            temporaryFiles.length;
            i++
        ) {

            const file =
                temporaryFiles[i];

            await this.request(
                this.store(
                    MARA_ENGINE_CONFIG.stores.files,
                    "readwrite"
                ).put({

                    id:
                        `${build}:${file.path}`,

                    build,

                    path:
                        file.path,

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

            this.state.progress =
                Math.round(
                    (
                        (i + 1) /
                        temporaryFiles.length
                    ) * 100
                );

            this.emit(
                "install:progress",
                {

                    build,

                    path:
                        file.path,

                    progress:
                        this.state.progress

                }
            );

        }


        /* =================================================
           BUILD READY
        ================================================= */

        await this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.builds,
                "readwrite"
            ).put({

                build,

                version:
                    String(
                        manifest.version
                    ),

                installedAt:
                    Date.now(),

                status:
                    "READY",

                fileCount:
                    temporaryFiles.length

            })
        );


        /* =================================================
           TEMP CLEANUP
        ================================================= */

        await this.deleteTemporaryBuild(
            build
        );


        this.emit(
            "install:complete",
            {
                build
            }
        );

        return true;

    },


    /* =====================================================
       ACTIVATE BUILD
    ===================================================== */

    async activateBuild(
        build,
        version = null
    ) {

        const exists =
            await this.hasBuild(
                build
            );

        if (
            !exists
        ) {

            throw new Error(
                `Build ${build} tidak tersedia.`
            );

        }

        await this.setActiveBuild(
            build,
            version
        );

        this.emit(
            "activate:complete",
            {

                build,

                version

            }
        );

        return true;

    },


    /* =====================================================
       VERIFY ACTIVE BUILD
    ===================================================== */

    async verifyActiveBuild(
        build
    ) {

        const metadata =
            await this.getBuild(
                build
            );

        if (
            !metadata ||
            metadata.status !==
                "READY"
        ) {

            throw new Error(
                `Build ${build} tidak READY.`
            );

        }

        const files =
            await this.getBuildFiles(
                build
            );

        if (
            !files.length
        ) {

            throw new Error(
                `Build ${build} tidak memiliki file.`
            );

        }

        return true;

    },


    /* =====================================================
       DELETE BUILD
    ===================================================== */

    async deleteBuild(
        build
    ) {

        if (
            build ===
            null ||
            build ===
            undefined
        ) {

            return;

        }

        const numericBuild =
            Number(build);

        const active =
            await this.getActiveBuild();

        /*
         * Jangan pernah menghapus build aktif.
         */

        if (
            active !== null &&
            numericBuild ===
            Number(active)
        ) {

            console.warn(
                "[MARA ENGINE] Penghapusan dibatalkan: build masih aktif."
            );

            return;

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
                    MARA_ENGINE_CONFIG.stores.files,
                    "readwrite"
                ).delete(
                    file.id
                )
            );

        }

        await this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.builds,
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

    },


    /* =====================================================
       DELETE TEMP BUILD
    ===================================================== */

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
                    MARA_ENGINE_CONFIG.stores.temporary,
                    "readwrite"
                ).delete(
                    file.id
                )
            );

        }

    },


    /* =====================================================
       GET BUILD FILES
    ===================================================== */

    async getBuildFiles(
        build
    ) {

        await this.init();

        return this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.files
            )
            .index(
                "build"
            )
            .getAll(
                Number(build)
            )
        );

    },


    /* =====================================================
       HAS BUILD
    ===================================================== */

    async hasBuild(
        build
    ) {

        await this.init();

        const result =
            await this.request(
                this.store(
                    MARA_ENGINE_CONFIG.stores.builds
                ).get(
                    Number(build)
                )
            );

        return Boolean(
            result &&
            result.status ===
                "READY"
        );

    },


    /* =====================================================
       GET BUILD
    ===================================================== */

    async getBuild(
        build
    ) {

        await this.init();

        return this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.builds
            ).get(
                Number(build)
            )
        );

    },


    /* =====================================================
       CREATE FILE URL
    ===================================================== */

    async createFileURL(
        build,
        path
    ) {

        const file =
            await this.request(
                this.store(
                    MARA_ENGINE_CONFIG.stores.files
                ).get(
                    `${Number(build)}:${path}`
                )
            );

        if (
            !file
        ) {

            throw new Error(
                `File tidak ditemukan: ${path}`
            );

        }

        const key =
            `${Number(build)}:${path}`;

        if (
            this.objectURLs.has(
                key
            )
        ) {

            return this.objectURLs.get(
                key
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


    /* =====================================================
       LOAD ACTIVE FILE
    ===================================================== */

    async loadActiveFile(
        path
    ) {

        const build =
            await this.getActiveBuild();

        if (
            build ===
            null
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


    /* =====================================================
       LOAD INTO IFRAME
    ===================================================== */

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


    /* =====================================================
       LOCK SCREEN
    ===================================================== */

    async loadLockScreen(
        iframe
    ) {

        return this.loadIntoIframe(
            iframe,
            "lock-screen.html"
        );

    },


    /* =====================================================
       HOME SCREEN
    ===================================================== */

    async loadHomeScreen(
        iframe
    ) {

        return this.loadIntoIframe(
            iframe,
            "home-screen.html"
        );

    },


    /* =====================================================
       MAIN FRAME
    ===================================================== */

    async loadMainFrame(
        iframe
    ) {

        return this.loadHomeScreen(
            iframe
        );

    },


    /* =====================================================
       STATUS
    ===================================================== */

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

            status:
                this.state.status,

            activeBuild:
                active,

            activeVersion:
                this.state.activeVersion,

            remoteBuild:
                this.state.remoteBuild,

            remoteVersion:
                this.state.remoteVersion,

            installingBuild:
                this.state.installingBuild,

            progress:
                this.state.progress,

            completedFiles:
                this.state.completedFiles,

            totalFiles:
                this.state.totalFiles,

            currentFile:
                this.state.currentFile,

            fileCount:
                files.length,

            online:
                navigator.onLine,

            updating:
                this.updating,

            database:
                MARA_ENGINE_CONFIG.databaseName

        };

    },


    /* =====================================================
       REVOKE BUILD URLS
    ===================================================== */

    revokeBuildURLs(
        build
    ) {

        for (
            const [
                key,
                url
            ]
            of this.objectURLs
        ) {

            if (
                key.startsWith(
                    `${Number(build)}:`
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


    /* =====================================================
       UPDATE PIPELINE
    ===================================================== */

    async update() {

        if (
            this.updating
        ) {

            console.warn(
                "[MARA ENGINE] Update sedang berjalan."
            );

            return {

                updated:
                    false,

                busy:
                    true

            };

        }

        this.updating =
            true;

        this.state.startedAt =
            Date.now();

        this.state.error =
            null;

        try {

            await this.init();


            /* =============================================
               OFFLINE
            ============================================= */

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


            /* =============================================
               MANIFEST
            ============================================= */

            const manifest =
                await this.fetchManifest();

            const remoteBuild =
                Number(
                    manifest.build
                );

            const localBuild =
                await this.getActiveBuild();


            /* =============================================
               NO UPDATE
            ============================================= */

            if (
                localBuild !== null &&
                !this.isNewerBuild(
                    remoteBuild,
                    localBuild
                )
            ) {

                this.setStatus(
                    "UP_TO_DATE"
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


            /* =============================================
               UPDATE START
            ============================================= */

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


            /* =============================================
               INTRO NOTIFICATION
            ============================================= */

            this.emit(
                "intro:update-start",
                {

                    build:
                        remoteBuild,

                    version:
                        manifest.version

                }
            );


            /* =============================================
               DOWNLOAD
            ============================================= */

            await this.downloadBuild(
                manifest
            );


            /* =============================================
               VERIFY
            ============================================= */

            await this.verifyBuild(
                manifest
            );


            /* =============================================
               INSTALL
            ============================================= */

            await this.installBuild(
                manifest
            );


            /* =============================================
               VERIFY INSTALLED BUILD
            ============================================= */

            await this.verifyActiveBuild(
                remoteBuild
            );


            /* =============================================
               ACTIVATE
            ============================================= */

            await this.activateBuild(
                remoteBuild,
                manifest.version
            );


            /* =============================================
               OLD BUILD
            ============================================= */

            if (
                localBuild !== null &&
                Number(localBuild) !==
                    Number(remoteBuild) &&
                !MARA_ENGINE_CONFIG.keepOldBuild
            ) {

                /*
                 * Build baru sudah aktif.
                 * Sekarang aman membersihkan build lama.
                 */

                await this.deleteBuild(
                    localBuild
                );

            }


            /* =============================================
               COMPLETE
            ============================================= */

            this.state.progress =
                100;

            this.state.completedAt =
                Date.now();

            this.setStatus(
                "UPDATED",
                {

                    activeBuild:
                        remoteBuild,

                    activeVersion:
                        manifest.version,

                    progress:
                        100,

                    installingBuild:
                        null,

                    currentFile:
                        null

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

            this.state.error =
                error.message;

            this.setStatus(
                "ERROR",
                {

                    error:
                        error.message

                }
            );


            /*
             * TEMP BUILD DIBERSIHKAN.
             *
             * ACTIVE BUILD LAMA TIDAK DISENTUH.
             */

            if (
                this.state.installingBuild
            ) {

                try {

                    await this.deleteTemporaryBuild(
                        this.state.installingBuild
                    );

                } catch (
                    cleanupError
                ) {

                    console.warn(
                        "[MARA ENGINE] Cleanup gagal:",
                        cleanupError
                    );

                }

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


    /* =====================================================
       RECOVER
    ===================================================== */

    async recover() {

        await this.init();

        /*
         * Jika ada temporary build yang tertinggal
         * dari update sebelumnya, bersihkan.
         */

        const transaction =
            this.db.transaction(
                MARA_ENGINE_CONFIG.stores.temporary,
                "readonly"
            );

        const store =
            transaction.objectStore(
                MARA_ENGINE_CONFIG.stores.temporary
            );

        const files =
            await this.request(
                store.getAll()
            );

        const builds =
            new Set(
                files.map(
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

        return true;

    },


    /* =====================================================
       SLEEP
    ===================================================== */

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


/* =========================================================
   GLOBAL API
========================================================= */

window.MARAUpdate = {

    init:
        () =>
            MARAEngineSingle.init(),

    check:
        () =>
            MARAEngineSingle.fetchManifest(),

    update:
        () =>
            MARAEngineSingle.update(),

    recover:
        () =>
            MARAEngineSingle.recover(),

    status:
        () =>
            MARAEngineSingle.getStatus(),

    activeBuild:
        () =>
            MARAEngineSingle.getActiveBuild(),

    load:
        path =>
            MARAEngineSingle.loadActiveFile(
                path
            ),

    loadIntoIframe:
        (
            iframe,
            path
        ) =>
            MARAEngineSingle.loadIntoIframe(
                iframe,
                path
            ),

    loadLockScreen:
        iframe =>
            MARAEngineSingle.loadLockScreen(
                iframe
            ),

    loadHomeScreen:
        iframe =>
            MARAEngineSingle.loadHomeScreen(
                iframe
            )

};


/* =========================================================
   ENGINE EVENTS
========================================================= */

MARAEngineSingle.on(
    "download:progress",
    data => {

        console.log(
            `[MARA ENGINE] DOWNLOAD ${data.progress}%`,
            data.path
        );

    }
);


MARAEngineSingle.on(
    "verify:success",
    data => {

        console.log(
            "[MARA ENGINE] VERIFICATION OK:",
            data.build
        );

    }
);


MARAEngineSingle.on(
    "install:complete",
    data => {

        console.log(
            "[MARA ENGINE] INSTALL COMPLETE:",
            data.build
        );

    }
);


MARAEngineSingle.on(
    "build:active",
    data => {

        console.log(
            "[MARA ENGINE] ACTIVE BUILD:",
            data.build
        );

    }
);


MARAEngineSingle.on(
    "update:complete",
    data => {

        console.log(
            "[MARA ENGINE] UPDATE COMPLETE:",
            data
        );

    }
);


MARAEngineSingle.on(
    "update:error",
    data => {

        console.error(
            "[MARA ENGINE] UPDATE ERROR:",
            data.message
        );

    }
);


/* =========================================================
   NETWORK
========================================================= */

window.addEventListener(
    "online",
    () => {

        console.log(
            "[MARA ENGINE] NETWORK ONLINE"
        );

        MARAEngineSingle.emit(
            "network:online"
        );

    }
);


window.addEventListener(
    "offline",
    () => {

        console.log(
            "[MARA ENGINE] NETWORK OFFLINE"
        );

        MARAEngineSingle.setStatus(
            "OFFLINE"
        );

        MARAEngineSingle.emit(
            "network:offline"
        );

    }
);


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await MARAEngineSingle.init();

            await MARAEngineSingle.recover();

            const status =
                await MARAEngineSingle.getStatus();

            console.log(
                "[MARA ENGINE] STATUS:",
                status
            );


            /* =============================================
               AUTO UPDATE
            ============================================= */

            if (
                MARA_ENGINE_CONFIG.autoUpdate &&
                navigator.onLine
            ) {

                setTimeout(
                    async () => {

                        try {

                            await MARAEngineSingle.update();

                        } catch (
                            error
                        ) {

                            console.error(
                                "[MARA ENGINE] AUTO UPDATE ERROR:",
                                error
                            );

                        }

                    },
                    MARA_ENGINE_CONFIG.autoUpdateDelay
                );

            }

        } catch (
            error
        ) {

            console.error(
                "[MARA ENGINE] INITIALIZATION ERROR:",
                error
            );

            MARAEngineSingle.setStatus(
                "ERROR",
                {
                    error:
                        error.message
                }
            );

        }

    }
);


/* =========================================================
   MESSAGE BRIDGE
========================================================= */

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

        /*
         * Intro dapat meminta status engine.
         */

        if (
            data.type ===
            "MARA_ENGINE_STATUS_REQUEST"
        ) {

            MARAEngineSingle
                .getStatus()
                .then(
                    status => {

                        event.source?.postMessage(
                            {

                                type:
                                    "MARA_ENGINE_STATUS",

                                status

                            },

                            "*"
                        );

                    }
                );

        }


        /*
         * Intro dapat meminta update.
         */

        if (
            data.type ===
            "MARA_ENGINE_UPDATE_REQUEST"
        ) {

            MARAEngineSingle
                .update()
                .then(
                    result => {

                        event.source?.postMessage(
                            {

                                type:
                                    "MARA_ENGINE_UPDATE_RESULT",

                                result

                            },

                            "*"
                        );

                    }
                );

        }

    }
);


/* =========================================================
   ENGINE READY
========================================================= */

console.log(
    "=============================================="
);

console.log(
    " MARA OS ENGINE SINGLE"
);

console.log(
    " IndexedDB Build Engine"
);

console.log(
    " Stage 1"
);

console.log(
    " ENGINE-SINGLE.JS LOADED SUCCESSFULLY"
);

console.log(
    "=============================================="
);