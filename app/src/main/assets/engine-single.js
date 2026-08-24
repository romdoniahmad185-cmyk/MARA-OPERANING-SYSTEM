/* =====================================================
   MARA OS
   ENGINE SINGLE
   COMPLETE INDEXEDDB BUILD ENGINE

   PIPELINE:

   Repository
       ↓
   Download Manifest
       ↓
   Download Entire Build
       ↓
   Temporary Storage
       ↓
   Verify Build
       ↓
   Build VALID
       ↓
   Remove Old Build
       ↓
   Install New Build
       ↓
   Set ACTIVE BUILD
       ↓
   Load New Build
       ↓
   OFFLINE MARA OS

   NO NATIVE ANDROID REQUIRED
===================================================== */


/* =====================================================
   CONFIGURATION
===================================================== */

const MARA_ENGINE_CONFIG = {

    databaseName:
        "MARA_OS_STORAGE",

    databaseVersion:
        2,

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

    timeout:
        30000,

    verifyContent:
        true,

    keepOldBuild:
        false

};


/* =====================================================
   GLOBAL ENGINE
===================================================== */

window.MARAEngineSingle = {

    db: null,

    initialized: false,

    objectURLs:
        new Map(),

    state: {

        status:
            "IDLE",

        activeBuild:
            null,

        installingBuild:
            null,

        progress:
            0,

        totalFiles:
            0,

        completedFiles:
            0,

        error:
            null

    },


    /* =================================================
       EVENT SYSTEM
    ================================================= */

    events: {},


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


    emit(
        event,
        data = {}
    ) {

        const listeners =
            this.events[event] || [];


        listeners.forEach(
            callback => {

                try {

                    callback(data);

                } catch (error) {

                    console.error(
                        "[MARA ENGINE] EVENT ERROR",
                        error
                    );

                }

            }
        );

    },


    /* =================================================
       INIT
    ================================================= */

    async init() {

        if (
            this.initialized
        ) {

            return this.db;

        }


        this.db =
            await this.openDatabase();


        this.initialized =
            true;


        const active =
            await this.getActiveBuild();


        this.state.activeBuild =
            active;


        this.emit(
            "ready",
            {
                activeBuild:
                    active
            }
        );


        console.log(
            "[MARA ENGINE] READY",
            {
                activeBuild:
                    active
            }
        );


        return this.db;

    },


    /* =================================================
       OPEN DATABASE
    ================================================= */

    openDatabase() {

        return new Promise(
            (resolve, reject) => {

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

                            };


                        resolve(db);

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


    /* =================================================
       TRANSACTION
    ================================================= */

    store(
        name,
        mode = "readonly"
    ) {

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
       REQUEST HELPER
    ================================================= */

    request(
        request
    ) {

        return new Promise(
            (resolve, reject) => {

                request.onsuccess =
                    () =>
                        resolve(
                            request.result
                        );


                request.onerror =
                    () =>
                        reject(
                            request.error
                        );

            }
        );

    },


    /* =================================================
       HTTP FETCH
    ================================================= */

    async fetchURL(
        url
    ) {

        const controller =
            new AbortController();


        const timer =
            setTimeout(
                () =>
                    controller.abort(),
                MARA_ENGINE_CONFIG.timeout
            );


        try {

            const response =
                await fetch(
                    url,
                    {
                        cache:
                            "no-store",

                        signal:
                            controller.signal
                    }
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    `HTTP ${response.status}: ${url}`
                );

            }


            return response;

        } finally {

            clearTimeout(timer);

        }

    },


    /* =================================================
       FETCH JSON
    ================================================= */

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
       FETCH MANIFEST
    ================================================= */

    async fetchManifest(
        url =
            MARA_ENGINE_CONFIG.repository
    ) {

        this.state.status =
            "FETCHING_MANIFEST";


        this.emit(
            "manifest:start"
        );


        const manifest =
            await this.fetchJSON(
                url
            );


        this.validateManifest(
            manifest
        );


        this.emit(
            "manifest:ready",
            {
                manifest
            }
        );


        console.log(
            "[MARA ENGINE] Manifest:",
            manifest
        );


        return manifest;

    },


    /* =================================================
       MANIFEST VALIDATOR
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


        manifest.files.forEach(
            file => {

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
                        `URL file tidak ada: ${file.path}`
                    );

                }

            }
        );


        return true;

    },


    /* =================================================
       COMPARE BUILD
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
       GET ACTIVE BUILD
    ================================================= */

    async getActiveBuild() {

        await this.initDatabaseOnly();


        const result =
            await this.request(
                this.store(
                    MARA_ENGINE_CONFIG.stores.active
                ).get(
                    "active"
                )
            );


        return result
            ? Number(result.build)
            : null;

    },


    /* =================================================
       INIT DATABASE ONLY
    ================================================= */

    async initDatabaseOnly() {

        if (
            this.db
        ) {

            return;

        }


        this.db =
            await this.openDatabase();

    },


    /* =================================================
       SET ACTIVE BUILD
    ================================================= */

    async setActiveBuild(
        build
    ) {

        await this.init();


        const data = {

            id:
                "active",

            build:
                Number(build),

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


        this.emit(
            "build:active",
            data
        );


        console.log(
            "[MARA ENGINE] ACTIVE BUILD:",
            build
        );


        return data;

    },


    /* =================================================
       SAVE TEMPORARY FILE
    ================================================= */

    async saveTemporaryFile(
        build,
        path,
        blob,
        type = "application/octet-stream"
    ) {

        await this.init();


        const id =
            `${build}:${path}`;


        const data = {

            id,

            build:
                Number(build),

            path,

            type,

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


    /* =================================================
       GET TEMPORARY FILES
    ================================================= */

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


    /* =================================================
       DOWNLOAD FILE
    ================================================= */

    async downloadFile(
        build,
        file,
        index,
        total
    ) {

        const response =
            await this.fetchURL(
                file.url
            );


        const blob =
            await response.blob();


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
            file.type ||
                blob.type ||
                "application/octet-stream"
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


    /* =================================================
       DOWNLOAD COMPLETE BUILD
    ================================================= */

    async downloadBuild(
        manifest
    ) {

        await this.init();


        const build =
            Number(
                manifest.build
            );


        const files =
            manifest.files;


        this.state.status =
            "DOWNLOADING";


        this.state.installingBuild =
            build;


        this.state.completedFiles =
            0;


        this.state.totalFiles =
            files.length;


        this.state.progress =
            0;


        this.emit(
            "download:start",
            {
                build,
                total:
                    files.length
            }
        );


        /* =========================
           CLEAN TEMP BUILD
        ========================= */

        await this.deleteTemporaryBuild(
            build
        );


        /* =========================
           DOWNLOAD EACH FILE
        ========================= */

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


        console.log(
            "[MARA ENGINE] Download selesai:",
            build
        );


        return true;

    },


    /* =================================================
       VERIFY BUILD
    ================================================= */

    async verifyBuild(
        manifest
    ) {

        await this.init();


        this.state.status =
            "VERIFYING";


        const build =
            Number(
                manifest.build
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
            const expected
            of manifest.files
        ) {

            const actual =
                files.find(
                    file =>
                        file.path ===
                        expected.path
                );


            if (!actual) {

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


            /* =========================
               HASH VERIFICATION
            ========================= */

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

        }


        this.emit(
            "verify:success",
            {
                build
            }
        );


        console.log(
            "[MARA ENGINE] BUILD VALID:",
            build
        );


        return true;

    },


    /* =================================================
       SHA256
    ================================================= */

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


        return Array.from(
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

        await this.init();


        this.state.status =
            "INSTALLING";


        const build =
            Number(
                manifest.build
            );


        const temporaryFiles =
            await this.getTemporaryFiles(
                build
            );


        if (
            !temporaryFiles.length
        ) {

            throw new Error(
                "Temporary build kosong."
            );

        }


        /* =========================
           CREATE BUILD METADATA
        ========================= */

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


        /* =========================
           COPY TEMP → PERMANENT
        ========================= */

        for (
            const file
            of temporaryFiles
        ) {

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

        }


        /* =========================
           MARK BUILD READY
        ========================= */

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


        /* =========================
           CLEAN TEMP
        ========================= */

        await this.deleteTemporaryBuild(
            build
        );


        this.emit(
            "install:complete",
            {
                build
            }
        );


        console.log(
            "[MARA ENGINE] INSTALL COMPLETE:",
            build
        );


        return true;

    },


    /* =================================================
       ACTIVATE BUILD
    ================================================= */

    async activateBuild(
        build
    ) {

        const exists =
            await this.hasBuild(
                build
            );


        if (!exists) {

            throw new Error(
                `Build ${build} tidak tersedia.`
            );

        }


        await this.setActiveBuild(
            build
        );


        this.emit(
            "activate:complete",
            {
                build
            }
        );


        return true;

    },


    /* =================================================
       DELETE OLD BUILD
    ================================================= */

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


        await this.init();


        const files =
            await this.getBuildFiles(
                build
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
                Number(build)
            )
        );


        this.revokeBuildURLs(
            build
        );


        console.log(
            "[MARA ENGINE] OLD BUILD REMOVED:",
            build
        );


        this.emit(
            "build:deleted",
            {
                build
            }
        );

    },


    /* =================================================
       DELETE TEMPORARY BUILD
    ================================================= */

    async deleteTemporaryBuild(
        build
    ) {

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


    /* =================================================
       GET BUILD FILES
    ================================================= */

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


    /* =================================================
       HAS BUILD
    ================================================= */

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


    /* =================================================
       GET BUILD METADATA
    ================================================= */

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


    /* =================================================
       COMPLETE UPDATE PIPELINE
    ================================================= */

    async update() {

        if (
            !navigator.onLine
        ) {

            console.log(
                "[MARA ENGINE] OFFLINE — update dilewati."
            );


            return {

                updated:
                    false,

                offline:
                    true

            };

        }


        this.state.error =
            null;


        try {

            /* =====================================
               STEP 1
               MANIFEST
            ===================================== */

            const manifest =
                await this.fetchManifest();


            const remoteBuild =
                Number(
                    manifest.build
                );


            const localBuild =
                await this.getActiveBuild();


            console.log(
                "[MARA ENGINE] LOCAL:",
                localBuild
            );


            console.log(
                "[MARA ENGINE] REMOTE:",
                remoteBuild
            );


            /* =====================================
               NO UPDATE
            ===================================== */

            if (
                localBuild !== null &&
                !this.isNewerBuild(
                    remoteBuild,
                    localBuild
                )
            ) {

                this.state.status =
                    "UP_TO_DATE";


                this.emit(
                    "update:none",
                    {
                        build:
                            localBuild
                    }
                );


                return {

                    updated:
                        false,

                    build:
                        localBuild

                };

            }


            /* =====================================
               STEP 2
               DOWNLOAD
            ===================================== */

            await this.downloadBuild(
                manifest
            );


            /* =====================================
               STEP 3
               VERIFY
            ===================================== */

            await this.verifyBuild(
                manifest
            );


            /* =====================================
               STEP 4
               REMEMBER OLD BUILD
            ===================================== */

            const oldBuild =
                await this.getActiveBuild();


            /* =====================================
               STEP 5
               INSTALL
            ===================================== */

            await this.installBuild(
                manifest
            );


            /* =====================================
               STEP 6
               ACTIVATE NEW BUILD
            ===================================== */

            await this.activateBuild(
                remoteBuild
            );


            /* =====================================
               STEP 7
               DELETE OLD BUILD
            ===================================== */

            if (
                oldBuild !== null &&
                Number(oldBuild) !==
                    Number(remoteBuild) &&
                !MARA_ENGINE_CONFIG.keepOldBuild
            ) {

                await this.deleteBuild(
                    oldBuild
                );

            }


            /* =====================================
               COMPLETE
            ===================================== */

            this.state.status =
                "UPDATED";


            this.state.progress =
                100;


            this.emit(
                "update:complete",
                {

                    oldBuild,

                    newBuild:
                        remoteBuild,

                    version:
                        manifest.version

                }
            );


            console.log(
                "[MARA ENGINE] UPDATE COMPLETE"
            );


            return {

                updated:
                    true,

                oldBuild,

                newBuild:
                    remoteBuild,

                version:
                    manifest.version

            };


        } catch (error) {

            this.state.status =
                "ERROR";


            this.state.error =
                error.message;


            console.error(
                "[MARA ENGINE] UPDATE FAILED:",
                error
            );


            /*
             * IMPORTANT:
             *
             * Temporary build dibersihkan.
             * ACTIVE BUILD lama tetap aman.
             */

            if (
                this.state.installingBuild
            ) {

                try {

                    await this.deleteTemporaryBuild(
                        this.state.installingBuild
                    );

                } catch {}

            }


            this.emit(
                "update:error",
                {
                    error
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

        }

    },


    /* =================================================
       CREATE LOCAL URL
    ================================================= */

    async createFileURL(
        build,
        path
    ) {

        const file =
            await this.request(
                this.store(
                    MARA_ENGINE_CONFIG.stores.files
                ).get(
                    `${build}:${path}`
                )
            );


        if (!file) {

            throw new Error(
                `File tidak ditemukan: ${path}`
            );

        }


        const key =
            `${build}:${path}`;


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


    /* =================================================
       LOAD ACTIVE FILE
    ================================================= */

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


    /* =================================================
       LOAD ACTIVE BUILD INTO IFRAME
    ================================================= */

    async loadIntoIframe(
        iframe,
        path
    ) {

        if (!iframe) {

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


    /* =================================================
       LOAD LOCK SCREEN
    ================================================= */

    async loadLockScreen(
        iframe
    ) {

        return this.loadIntoIframe(
            iframe,
            "lock-screen.html"
        );

    },


    /* =================================================
       LOAD HOME SCREEN
    ================================================= */

    async loadHomeScreen(
        iframe
    ) {

        return this.loadIntoIframe(
            iframe,
            "home-screen.html"
        );

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

            status:
                this.state.status,

            activeBuild:
                active,

            fileCount:
                files.length,

            progress:
                this.state.progress,

            online:
                navigator.onLine,

            database:
                MARA_ENGINE_CONFIG.databaseName

        };

    },


    /* =================================================
       REVOKE BUILD URLS
    ================================================= */

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
                    `${build}:`
                )
            ) {

                URL.revokeObjectURL(
                    url
                );


                this.objectURLs.delete(
                    key
                );

            }

        }

    }

};


/* =====================================================
   ENGINE EVENTS — DEBUG
===================================================== */

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
            "[MARA ENGINE] UPDATE:",
            data
        );

    }
);


/* =====================================================
   OFFLINE / ONLINE
===================================================== */

window.addEventListener(
    "online",
    () => {

        console.log(
            "[MARA ENGINE] ONLINE"
        );

    }
);


window.addEventListener(
    "offline",
    () => {

        console.log(
            "[MARA ENGINE] OFFLINE MODE"
        );

    }
);


/* =====================================================
   DOM READY
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            await MARAEngineSingle.init();


            const status =
                await MARAEngineSingle.getStatus();


            console.log(
                "[MARA ENGINE] STATUS:",
                status
            );


        } catch (error) {

            console.error(
                "[MARA ENGINE] INITIALIZATION ERROR:",
                error
            );

        }

    }
);


/* =====================================================
   GLOBAL API
===================================================== */

window.MARAUpdate = {

    check:
        () =>
            MARAEngineSingle.fetchManifest(),

    update:
        () =>
            MARAEngineSingle.update(),

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
            )

};


/* =====================================================
   READY
===================================================== */

console.log(
    "[MARA ENGINE] ENGINE-SINGLE.JS LOADED"
);