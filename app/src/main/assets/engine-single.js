/* =====================================================
   MARA OS
   ENGINE SINGLE
   VERSION: STAGE 1
   SAFE INDEXEDDB INSTALL ENGINE

   PIPELINE:

   Repository
       ↓
   Manifest
       ↓
   Download
       ↓
   Temporary Storage
       ↓
   Verify Download
       ↓
   Install Transaction
       ↓
   Verify Installed Build
       ↓
   READY
       ↓
   ACTIVE
       ↓
   Delete Old Build

   SAFETY:

   Jika build baru gagal:
       ↓
   Temporary dibersihkan
       ↓
   Partial install dibersihkan
       ↓
   ACTIVE BUILD lama tetap aman

   NOTE:
   Tahap 1 belum menggunakan ZIP extraction.
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

    db:
        null,

    initialized:
        false,

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

    },


    /* =================================================
       INIT
    ================================================= */

    async init() {

        if (
            this.initialized &&
            this.db
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


                request.onblocked =
                    () => {

                        console.warn(
                            "[MARA ENGINE] DATABASE OPEN BLOCKED"
                        );

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


                        db.onerror =
                            event => {

                                console.error(
                                    "[MARA ENGINE] DATABASE ERROR",
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
                                "Gagal membuka IndexedDB."
                            )
                        );

                    };

            }
        );

    },


    /* =================================================
       INIT DATABASE ONLY
    ================================================= */

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


    /* =================================================
       STORE
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
       REQUEST HELPER
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
                            request.error
                        );

                    };

            }
        );

    },


    /* =================================================
       TRANSACTION HELPER
       IMPORTANT:

       Callback harus memasukkan request IndexedDB
       secara sinkron agar transaction tidak auto-close.
    ================================================= */

    transaction(
        stores,
        mode,
        callback
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                try {

                    const transaction =
                        this.db.transaction(
                            stores,
                            mode
                        );


                    const result =
                        callback(
                            transaction
                        );


                    transaction.oncomplete =
                        () => {

                            resolve(
                                result
                            );

                        };


                    transaction.onerror =
                        () => {

                            reject(
                                transaction.error ||
                                new Error(
                                    "IndexedDB transaction gagal."
                                )
                            );

                        };


                    transaction.onabort =
                        () => {

                            reject(
                                transaction.error ||
                                new Error(
                                    "IndexedDB transaction dibatalkan."
                                )
                            );

                        };

                } catch (
                    error
                ) {

                    reject(
                        error
                    );

                }

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
                () => {

                    controller.abort();

                },
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

        } catch (
            error
        ) {

            if (
                error.name ===
                "AbortError"
            ) {

                throw new Error(
                    `Request timeout: ${url}`
                );

            }


            throw error;

        } finally {

            clearTimeout(
                timer
            );

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
            "[MARA ENGINE] MANIFEST READY",
            manifest
        );


        return manifest;

    },


    /* =================================================
       VALIDATE MANIFEST
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
            undefined ||
            manifest.build ===
            null
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
            manifest.files.length ===
            0
        ) {

            throw new Error(
                "Manifest files[] kosong."
            );

        }


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
                    !file.path ||
                    typeof file.path !==
                        "string"
                ) {

                    throw new Error(
                        "File manifest tidak memiliki path."
                    );

                }


                if (
                    !file.url ||
                    typeof file.url !==
                        "string"
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
            ? Number(
                result.build
            )
            : null;

    },


    /* =================================================
       SET ACTIVE BUILD
    ================================================= */

    async setActiveBuild(
        build
    ) {

        await this.init();


        const numericBuild =
            Number(
                build
            );


        if (
            !Number.isFinite(
                numericBuild
            )
        ) {

            throw new Error(
                "Nomor build tidak valid."
            );

        }


        const exists =
            await this.hasBuild(
                numericBuild
            );


        if (!exists) {

            throw new Error(
                `Build ${numericBuild} belum READY.`
            );

        }


        const data = {

            id:
                "active",

            build:
                numericBuild,

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
            numericBuild;


        this.emit(
            "build:active",
            data
        );


        console.log(
            "[MARA ENGINE] ACTIVE BUILD:",
            numericBuild
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
        type =
            "application/octet-stream"
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
            Number(blob.size)
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
                ) *
                100
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
       DOWNLOAD BUILD
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
           CLEAN OLD TEMP
        ========================= */

        await this.deleteTemporaryBuild(
            build
        );


        /* =========================
           DOWNLOAD
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
            "[MARA ENGINE] DOWNLOAD COMPLETE:",
            build
        );


        return true;

    },


    /* =================================================
       VERIFY DOWNLOAD
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
                `Jumlah file temporary tidak cocok. Expected ${manifest.files.length}, received ${files.length}`
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
                    `File temporary hilang: ${expected.path}`
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

        }


        this.emit(
            "verify:success",
            {
                build
            }
        );


        console.log(
            "[MARA ENGINE] TEMPORARY BUILD VALID:",
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
       
       STAGE 1 SAFE INSTALL

       Temporary → Files

       Status:
       INSTALLING
          ↓
       INSTALLED
          ↓
       READY
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


        this.state.installingBuild =
            build;


        const activeBuild =
            await this.getActiveBuild();


        /*
         * Jangan pernah menghapus build yang sedang aktif.
         */

        if (
            Number(activeBuild) ===
            Number(build)
        ) {

            throw new Error(
                `Build ${build} sudah ACTIVE.`
            );

        }


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


        if (
            temporaryFiles.length !==
            manifest.files.length
        ) {

            throw new Error(
                `Jumlah temporary file tidak cocok. Expected ${manifest.files.length}, received ${temporaryFiles.length}`
            );

        }


        this.emit(
            "install:start",
            {

                build,

                total:
                    temporaryFiles.length

            }
        );


        /*
         * INSTALL DALAM SATU TRANSACTION
         *
         * Tidak ada await di dalam callback transaction.
         * Semua request dimasukkan secara langsung.
         */

        await this.transaction(
            [
                MARA_ENGINE_CONFIG.stores.files,
                MARA_ENGINE_CONFIG.stores.builds
            ],
            "readwrite",
            transaction => {

                const filesStore =
                    transaction.objectStore(
                        MARA_ENGINE_CONFIG.stores.files
                    );


                const buildsStore =
                    transaction.objectStore(
                        MARA_ENGINE_CONFIG.stores.builds
                    );


                /*
                 * Hapus file parsial build ini
                 * jika sebelumnya pernah gagal.
                 */

                const index =
                    filesStore.index(
                        "build"
                    );


                index.openCursor(
                    IDBKeyRange.only(
                        build
                    )
                ).onsuccess =
                    event => {

                        const cursor =
                            event.target.result;


                        if (
                            cursor
                        ) {

                            cursor.delete();

                            cursor.continue();

                        }

                    };


                /*
                 * Status INSTALLED.
                 *
                 * Belum READY.
                 */

                buildsStore.put({

                    build,

                    version:
                        String(
                            manifest.version
                        ),

                    installedAt:
                        Date.now(),

                    status:
                        "INSTALLED",

                    fileCount:
                        temporaryFiles.length

                });


                /*
                 * Masukkan seluruh file.
                 */

                temporaryFiles.forEach(
                    file => {

                        filesStore.put({

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

                        });

                    }
                );

            }
        );


        /*
         * Sekarang install fisik di IndexedDB
         * sudah selesai.
         *
         * Tetapi belum READY.
         */

        this.emit(
            "install:stored",
            {
                build
            }
        );


        /*
         * VERIFIKASI HASIL INSTALL
         */

        await this.verifyInstalledBuild(
            manifest
        );


        /*
         * Jika verifikasi berhasil,
         * baru status READY.
         */

        await this.markBuildReady(
            manifest
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
       VERIFY INSTALLED BUILD
    ================================================= */

    async verifyInstalledBuild(
        manifest
    ) {

        await this.init();


        const build =
            Number(
                manifest.build
            );


        const installedFiles =
            await this.getBuildFiles(
                build
            );


        if (
            installedFiles.length !==
            manifest.files.length
        ) {

            throw new Error(
                `Install verification gagal. Expected ${manifest.files.length}, received ${installedFiles.length}`
            );

        }


        for (
            const expected
            of manifest.files
        ) {

            const actual =
                installedFiles.find(
                    file =>
                        file.path ===
                        expected.path
                );


            if (!actual) {

                throw new Error(
                    `File hasil install tidak ditemukan: ${expected.path}`
                );

            }


            if (
                expected.size !==
                undefined &&
                Number(expected.size) !==
                Number(actual.size)
            ) {

                throw new Error(
                    `Ukuran hasil install tidak cocok: ${expected.path}`
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
                        `SHA-256 hasil install tidak cocok: ${expected.path}`
                    );

                }

            }

        }


        this.emit(
            "install:verified",
            {
                build
            }
        );


        console.log(
            "[MARA ENGINE] INSTALLED BUILD VERIFIED:",
            build
        );


        return true;

    },


    /* =================================================
       MARK BUILD READY
    ================================================= */

    async markBuildReady(
        manifest
    ) {

        await this.init();


        const build =
            Number(
                manifest.build
            );


        const current =
            await this.getBuild(
                build
            );


        if (!current) {

            throw new Error(
                `Metadata build ${build} tidak ditemukan.`
            );

        }


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
                    current.installedAt ||
                    Date.now(),

                readyAt:
                    Date.now(),

                status:
                    "READY",

                fileCount:
                    current.fileCount

            })
        );


        this.emit(
            "build:ready",
            {
                build
            }
        );


        console.log(
            "[MARA ENGINE] BUILD READY:",
            build
        );


        return true;

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
       DELETE BUILD FILES
    ================================================= */

    async deleteBuildFiles(
        build
    ) {

        await this.init();


        const numericBuild =
            Number(build);


        const active =
            await this.getActiveBuild();


        /*
         * ACTIVE BUILD tidak boleh dihapus.
         */

        if (
            active !== null &&
            Number(active) ===
                numericBuild
        ) {

            throw new Error(
                `Dilarang menghapus ACTIVE BUILD ${numericBuild}.`
            );

        }


        await this.transaction(
            [
                MARA_ENGINE_CONFIG.stores.files
            ],
            "readwrite",
            transaction => {

                const store =
                    transaction.objectStore(
                        MARA_ENGINE_CONFIG.stores.files
                    );


                store.index(
                    "build"
                )
                .openCursor(
                    IDBKeyRange.only(
                        numericBuild
                    )
                )
                .onsuccess =
                    event => {

                        const cursor =
                            event.target.result;


                        if (
                            cursor
                        ) {

                            cursor.delete();

                            cursor.continue();

                        }

                    };

            }
        );


        this.revokeBuildURLs(
            numericBuild
        );

    },


    /* =================================================
       DELETE BUILD
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


        const numericBuild =
            Number(build);


        const active =
            await this.getActiveBuild();


        if (
            active !== null &&
            Number(active) ===
                numericBuild
        ) {

            throw new Error(
                `Tidak dapat menghapus ACTIVE BUILD ${numericBuild}.`
            );

        }


        await this.deleteBuildFiles(
            numericBuild
        );


        await this.request(
            this.store(
                MARA_ENGINE_CONFIG.stores.builds,
                "readwrite"
            ).delete(
                numericBuild
            )
        );


        console.log(
            "[MARA ENGINE] BUILD REMOVED:",
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


    /* =================================================
       CLEANUP FAILED BUILD
       
       Digunakan hanya untuk build yang belum ACTIVE.
    ================================================= */

    async cleanupFailedBuild(
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


        try {

            const active =
                await this.getActiveBuild();


            /*
             * Jangan menyentuh ACTIVE BUILD.
             */

            if (
                active !== null &&
                Number(active) ===
                    numericBuild
            ) {

                console.warn(
                    "[MARA ENGINE] CLEANUP DIBATALKAN — BUILD ACTIVE:",
                    numericBuild
                );

                return;

            }


            await this.deleteBuildFiles(
                numericBuild
            );


            await this.request(
                this.store(
                    MARA_ENGINE_CONFIG.stores.builds,
                    "readwrite"
                ).delete(
                    numericBuild
                )
            );


            console.log(
                "[MARA ENGINE] FAILED BUILD CLEANED:",
                numericBuild
            );


            this.emit(
                "build:cleanup",
                {
                    build:
                        numericBuild
                }
            );

        } catch (
            error
        ) {

            console.error(
                "[MARA ENGINE] CLEANUP FAILED:",
                error
            );

        }

    },


    /* =================================================
       DELETE TEMPORARY BUILD
    ================================================= */

    async deleteTemporaryBuild(
        build
    ) {

        await this.init();


        const numericBuild =
            Number(build);


        await this.transaction(
            [
                MARA_ENGINE_CONFIG.stores.temporary
            ],
            "readwrite",
            transaction => {

                const store =
                    transaction.objectStore(
                        MARA_ENGINE_CONFIG.stores.temporary
                    );


                store.index(
                    "build"
                )
                .openCursor(
                    IDBKeyRange.only(
                        numericBuild
                    )
                )
                .onsuccess =
                    event => {

                        const cursor =
                            event.target.result;


                        if (
                            cursor
                        ) {

                            cursor.delete();

                            cursor.continue();

                        }

                    };

            }
        );

    },


    /* =================================================
       ACTIVATE BUILD
    ================================================= */

    async activateBuild(
        build
    ) {

        const numericBuild =
            Number(build);


        const exists =
            await this.hasBuild(
                numericBuild
            );


        if (!exists) {

            throw new Error(
                `Build ${numericBuild} belum READY.`
            );

        }


        await this.setActiveBuild(
            numericBuild
        );


        this.emit(
            "activate:complete",
            {
                build:
                    numericBuild
            }
        );


        console.log(
            "[MARA ENGINE] BUILD ACTIVATED:",
            numericBuild
        );


        return true;

    },


    /* =================================================
       COMPLETE UPDATE PIPELINE
    ================================================= */

    async update() {

        if (
            !navigator.onLine
        ) {

            this.state.status =
                "OFFLINE";


            console.log(
                "[MARA ENGINE] OFFLINE — UPDATE DILEWATI."
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


        this.state.progress =
            0;


        let installingBuild =
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


            if (
                !Number.isFinite(
                    remoteBuild
                )
            ) {

                throw new Error(
                    "Nomor remote build tidak valid."
                );

            }


            const localBuild =
                await this.getActiveBuild();


            console.log(
                "[MARA ENGINE] LOCAL BUILD:",
                localBuild
            );


            console.log(
                "[MARA ENGINE] REMOTE BUILD:",
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


            installingBuild =
                remoteBuild;


            this.state.installingBuild =
                remoteBuild;


            /* =====================================
               STEP 2
               DOWNLOAD
            ===================================== */

            await this.downloadBuild(
                manifest
            );


            /* =====================================
               STEP 3
               VERIFY TEMPORARY
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
               CHECK READY
            ===================================== */

            const ready =
                await this.hasBuild(
                    remoteBuild
                );


            if (
                !ready
            ) {

                throw new Error(
                    `Build ${remoteBuild} tidak berstatus READY.`
                );

            }


            /* =====================================
               STEP 7
               ACTIVATE
            ===================================== */

            await this.activateBuild(
                remoteBuild
            );


            /* =====================================
               STEP 8
               VERIFY ACTIVE
            ===================================== */

            const activeAfter =
                await this.getActiveBuild();


            if (
                Number(activeAfter) !==
                Number(remoteBuild)
            ) {

                throw new Error(
                    `Aktivasi gagal. Active=${activeAfter}, Expected=${remoteBuild}`
                );

            }


            /* =====================================
               STEP 9
               DELETE OLD BUILD
            ===================================== */

            if (
                oldBuild !== null &&
                Number(oldBuild) !==
                    Number(remoteBuild) &&
                !MARA_ENGINE_CONFIG.keepOldBuild
            ) {

                try {

                    await this.deleteBuild(
                        oldBuild
                    );

                } catch (
                    cleanupError
                ) {

                    /*
                     * Build baru sudah ACTIVE.
                     *
                     * Jika penghapusan build lama gagal,
                     * jangan membatalkan update.
                     */

                    console.warn(
                        "[MARA ENGINE] OLD BUILD CLEANUP FAILED:",
                        cleanupError
                    );

                }

            }


            /* =====================================
               STEP 10
               CLEAN TEMP
            ===================================== */

            await this.deleteTemporaryBuild(
                remoteBuild
            );


            /* =====================================
               COMPLETE
            ===================================== */

            this.state.status =
                "UPDATED";


            this.state.progress =
                100;


            this.state.installingBuild =
                null;


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
                "[MARA ENGINE] UPDATE COMPLETE:",
                {
                    oldBuild,
                    newBuild:
                        remoteBuild,
                    version:
                        manifest.version
                }
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


        } catch (
            error
        ) {

            this.state.status =
                "ERROR";


            this.state.error =
                error.message;


            console.error(
                "[MARA ENGINE] UPDATE FAILED:",
                error
            );


            /*
             * CLEANUP BUILD YANG SEDANG DIKERJAKAN
             *
             * ACTIVE BUILD lama tidak disentuh.
             */

            if (
                installingBuild !==
                    null
            ) {

                await this.cleanupFailedBuild(
                    installingBuild
                );

                await this.deleteTemporaryBuild(
                    installingBuild
                );

            }


            this.emit(
                "update:error",
                {

                    error,

                    build:
                        installingBuild

                }
            );


            return {

                updated:
                    false,

                error:
                    true,

                message:
                    error.message,

                build:
                    installingBuild

            };

        } finally {

            /*
             * Selalu reset state.
             */

            this.state.installingBuild =
                null;

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
       LOAD INTO IFRAME
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

            installingBuild:
                this.state.installingBuild,

            fileCount:
                files.length,

            progress:
                this.state.progress,

            completedFiles:
                this.state.completedFiles,

            totalFiles:
                this.state.totalFiles,

            error:
                this.state.error,

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

    }

};


/* =====================================================
   ENGINE EVENTS
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
            "[MARA ENGINE] TEMPORARY VERIFY OK:",
            data.build
        );

    }
);


MARAEngineSingle.on(
    "install:start",
    data => {

        console.log(
            "[MARA ENGINE] INSTALL START:",
            data.build
        );

    }
);


MARAEngineSingle.on(
    "install:stored",
    data => {

        console.log(
            "[MARA ENGINE] FILES STORED:",
            data.build
        );

    }
);


MARAEngineSingle.on(
    "install:verified",
    data => {

        console.log(
            "[MARA ENGINE] INSTALL VERIFY OK:",
            data.build
        );

    }
);


MARAEngineSingle.on(
    "build:ready",
    data => {

        console.log(
            "[MARA ENGINE] BUILD READY:",
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
    "build:cleanup",
    data => {

        console.log(
            "[MARA ENGINE] FAILED BUILD CLEANED:",
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


MARAEngineSingle.on(
    "update:error",
    data => {

        console.error(
            "[MARA ENGINE] UPDATE ERROR:",
            data.error
        );

    }
);


/* =====================================================
   ONLINE / OFFLINE
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

        } catch (
            error
        ) {

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


/* =====================================================
   READY
===================================================== */

console.log(
    "[MARA ENGINE] ENGINE-SINGLE.JS STAGE 1 LOADED"
);