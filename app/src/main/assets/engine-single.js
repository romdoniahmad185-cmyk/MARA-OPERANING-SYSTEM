/* =========================================================
   MARA OS
   ENGINE SINGLE
   SIMPLE UPDATE + INDEXEDDB ENGINE

   TUGAS ENGINE:

       1. Ambil update-manifest.json
       2. Baca build lokal dari IndexedDB
       3. Bandingkan remote dengan lokal
       4. Jika belum ada / lebih baru:
              download file dari manifest
              simpan ke IndexedDB
       5. Tandai build sebagai ACTIVE
       6. Kirim status melalui postMessage

   ENGINE TIDAK:
       - menjalankan UX
       - membuat iframe
       - meng-install aplikasi
       - menjalankan build.js
       - menghapus build lama sebelum build baru selesai

   DATABASE:

       MARA_OS_STORAGE

   STORES:

       meta
       files
========================================================= */

(() => {

    "use strict";


    /* =====================================================
       DUPLICATE PROTECTION
    ===================================================== */

    if (window.MARAEngineSingle) {

        console.warn(
            "[MARA ENGINE] Engine sudah dimuat."
        );

        return;

    }


    /* =====================================================
       CONFIG
    ===================================================== */

    const CONFIG = {

        name:
            "MARA_ENGINE_SINGLE",

        version:
            "4.0.0",

        databaseName:
            "MARA_OS_STORAGE",

        databaseVersion:
            6,

        manifestURL:
            "https://romdoniahmad185-cmyk.github.io/mara-os-updates/stable/update-manifest.json",

        stores: {

            meta:
                "meta",

            files:
                "files"

        },

        activeKey:
            "active-build",

        requestTimeout:
            30000,

        cacheBust:
            true,

        maxFileSize:
            50 * 1024 * 1024,

        maxFiles:
            5000

    };


    /* =====================================================
       STATUS
    ===================================================== */

    const STATUS = Object.freeze({

        IDLE:
            "IDLE",

        STARTING:
            "STARTING",

        CHECKING:
            "CHECKING",

        UP_TO_DATE:
            "UP_TO_DATE",

        DOWNLOADING:
            "DOWNLOADING",

        SAVING:
            "SAVING",

        READY:
            "READY",

        OFFLINE:
            "OFFLINE",

        ERROR:
            "ERROR"

    });


    /* =====================================================
       STATE
    ===================================================== */

    const STATE = {

        status:
            STATUS.IDLE,

        working:
            false,

        build:
            null,

        version:
            null,

        remoteBuild:
            null,

        remoteVersion:
            null,

        progress:
            0,

        currentFile:
            null,

        completedFiles:
            0,

        totalFiles:
            0,

        error:
            null,

        startedAt:
            null,

        completedAt:
            null

    };


    /* =====================================================
       UTILITY
    ===================================================== */

    const Utils = {

        clone(value) {

            try {

                return structuredClone(value);

            } catch {

                return JSON.parse(
                    JSON.stringify(value)
                );

            }

        },


        sleep(ms) {

            return new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        ms
                    )
            );

        },


        number(value) {

            const n =
                Number(value);

            return Number.isFinite(n)
                ? n
                : null;

        },


        normalizePath(path) {

            if (
                typeof path !== "string"
            ) {

                throw new Error(
                    "Path file tidak valid."
                );

            }


            let result =
                path
                    .replace(/\\/g, "/")
                    .replace(/^\/+/, "");


            const parts =
                result
                    .split("/")
                    .filter(
                        part =>
                            part &&
                            part !== "."
                    );


            if (
                parts.includes("..")
            ) {

                throw new Error(
                    `Path tidak aman: ${path}`
                );

            }


            result =
                parts.join("/");


            if (!result) {

                throw new Error(
                    "Path file kosong."
                );

            }


            return result;

        }

    };


    /* =====================================================
       ENGINE
    ===================================================== */

    const ENGINE = {

        name:
            CONFIG.name,

        version:
            CONFIG.version,

        config:
            CONFIG,

        state:
            STATE,

        db:
            null,

        initialized:
            false,

        updating:
            false,


        /* =================================================
           STATUS
        ================================================= */

        setStatus(status, extra = {}) {

            STATE.status =
                status;

            Object.assign(
                STATE,
                extra
            );


            this.broadcast(
                "status",
                this.getState()
            );

        },


        getState() {

            return Utils.clone(
                STATE
            );

        },


        /* =================================================
           MESSAGE
        ================================================= */

        broadcast(
            event,
            data = {}
        ) {

            try {

                window.parent.postMessage(

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

                    "*"

                );

            } catch (
                error
            ) {

                console.warn(
                    "[MARA ENGINE] postMessage gagal:",
                    error
                );

            }

        },


        /* =================================================
           DATABASE
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


                            /* =============================
                               META
                            ============================= */

                            if (
                                !db.objectStoreNames.contains(
                                    CONFIG.stores.meta
                                )
                            ) {

                                db.createObjectStore(
                                    CONFIG.stores.meta,
                                    {
                                        keyPath:
                                            "id"
                                    }
                                );

                            }


                            /* =============================
                               FILES
                            ============================= */

                            if (
                                !db.objectStoreNames.contains(
                                    CONFIG.stores.files
                                )
                            ) {

                                const files =
                                    db.createObjectStore(
                                        CONFIG.stores.files,
                                        {
                                            keyPath:
                                                "id"
                                        }
                                    );


                                files.createIndex(
                                    "build",
                                    "build",
                                    {
                                        unique:
                                            false
                                    }
                                );


                                files.createIndex(
                                    "path",
                                    "path",
                                    {
                                        unique:
                                            false
                                    }
                                );

                            }

                        };


                    request.onsuccess =
                        event => {

                            this.db =
                                event.target.result;


                            resolve(
                                this.db
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


        async init() {

            if (
                this.initialized &&
                this.db
            ) {

                return;

            }


            await this.openDatabase();


            this.initialized =
                true;

        },


        idbRequest(request) {

            return new Promise(
                (
                    resolve,
                    reject
                ) => {

                    request.onsuccess =
                        () =>
                            resolve(
                                request.result
                            );


                    request.onerror =
                        () =>
                            reject(
                                request.error ||
                                new Error(
                                    "IndexedDB request gagal."
                                )
                            );

                }
            );

        },


        /* =================================================
           LOCAL META
        ================================================= */

        async getActive() {

            await this.init();


            return this.idbRequest(

                this.db
                    .transaction(
                        CONFIG.stores.meta,
                        "readonly"
                    )
                    .objectStore(
                        CONFIG.stores.meta
                    )
                    .get(
                        CONFIG.activeKey
                    )

            );

        },


        async saveActive(
            build,
            version
        ) {

            await this.init();


            const record = {

                id:
                    CONFIG.activeKey,

                build:
                    Number(build),

                version:
                    String(version),

                updatedAt:
                    Date.now()

            };


            await this.idbRequest(

                this.db
                    .transaction(
                        CONFIG.stores.meta,
                        "readwrite"
                    )
                    .objectStore(
                        CONFIG.stores.meta
                    )
                    .put(
                        record
                    )

            );


            STATE.build =
                record.build;

            STATE.version =
                record.version;


            return record;

        },


        /* =================================================
           MANIFEST
        ================================================= */

        async fetchManifest() {

            this.setStatus(
                STATUS.CHECKING
            );


            let url =
                CONFIG.manifestURL;


            if (
                CONFIG.cacheBust
            ) {

                url +=
                    `?_=${Date.now()}`;

            }


            const controller =
                new AbortController();


            const timeout =
                setTimeout(
                    () =>
                        controller.abort(),
                    CONFIG.requestTimeout
                );


            try {

                const response =
                    await fetch(
                        url,
                        {

                            method:
                                "GET",

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
                        `Manifest HTTP ${response.status}`
                    );

                }


                const manifest =
                    await response.json();


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


                this.broadcast(
                    "manifest",
                    {

                        build:
                            STATE.remoteBuild,

                        version:
                            STATE.remoteVersion

                    }
                );


                return manifest;

            } finally {

                clearTimeout(
                    timeout
                );

            }

        },


        /* =================================================
           MANIFEST VALIDATION
        ================================================= */

        validateManifest(
            manifest
        ) {

            if (
                !manifest ||
                typeof manifest !== "object"
            ) {

                throw new Error(
                    "Manifest tidak valid."
                );

            }


            const build =
                Utils.number(
                    manifest.build
                );


            if (
                build === null ||
                build < 1
            ) {

                throw new Error(
                    "Manifest build tidak valid."
                );

            }


            if (
                typeof manifest.version !==
                "string" ||
                !manifest.version.trim()
            ) {

                throw new Error(
                    "Manifest version tidak valid."
                );

            }


            if (
                !Array.isArray(
                    manifest.files
                )
            ) {

                throw new Error(
                    "Manifest files harus array."
                );

            }


            if (
                manifest.files.length === 0
            ) {

                throw new Error(
                    "Manifest files kosong."
                );

            }


            if (
                manifest.files.length >
                CONFIG.maxFiles
            ) {

                throw new Error(
                    "Jumlah file terlalu banyak."
                );

            }


            const paths =
                new Set();


            manifest.files.forEach(
                file => {

                    if (
                        !file ||
                        typeof file !== "object"
                    ) {

                        throw new Error(
                            "Entry file manifest tidak valid."
                        );

                    }


                    const path =
                        Utils.normalizePath(
                            file.path
                        );


                    if (
                        paths.has(path)
                    ) {

                        throw new Error(
                            `Path duplikat: ${path}`
                        );

                    }


                    paths.add(path);


                    if (
                        typeof file.url !==
                        "string" ||
                        !file.url
                    ) {

                        throw new Error(
                            `URL tidak tersedia: ${path}`
                        );

                    }


                    if (
                        file.size !== undefined
                    ) {

                        const size =
                            Number(
                                file.size
                            );


                        if (
                            !Number.isFinite(size) ||
                            size < 0 ||
                            size >
                            CONFIG.maxFileSize
                        ) {

                            throw new Error(
                                `Ukuran file tidak valid: ${path}`
                            );

                        }

                    }

                }
            );


            return true;

        },


        /* =================================================
           DOWNLOAD FILE
        ================================================= */

        async downloadFile(
            file
        ) {

            const path =
                Utils.normalizePath(
                    file.path
                );


            STATE.currentFile =
                path;


            const response =
                await fetch(
                    file.url,
                    {
                        cache:
                            "no-store"
                    }
                );


            if (
                !response.ok
            ) {

                throw new Error(
                    `Gagal mengambil ${path}: HTTP ${response.status}`
                );

            }


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
                file.size !== undefined &&
                Number(file.size) !==
                Number(blob.size)
            ) {

                throw new Error(
                    `Ukuran ${path} tidak sesuai manifest.`
                );

            }


            return {

                path,

                type:
                    file.type ||
                    blob.type ||
                    "application/octet-stream",

                content:
                    blob,

                size:
                    blob.size

            };

        },


        /* =================================================
           SAVE FILE
        ================================================= */

        async saveFile(
            build,
            file
        ) {

            await this.init();


            const record = {

                id:
                    `${build}:${file.path}`,

                build:
                    Number(build),

                path:
                    file.path,

                type:
                    file.type,

                size:
                    file.size,

                content:
                    file.content,

                savedAt:
                    Date.now()

            };


            await this.idbRequest(

                this.db
                    .transaction(
                        CONFIG.stores.files,
                        "readwrite"
                    )
                    .objectStore(
                        CONFIG.stores.files
                    )
                    .put(
                        record
                    )

            );


            return record;

        },


        /* =================================================
           DELETE BUILD FILES
        ================================================= */

        async deleteBuildFiles(
            build
        ) {

            await this.init();


            const files =
                await this.idbRequest(

                    this.db
                        .transaction(
                            CONFIG.stores.files,
                            "readonly"
                        )
                        .objectStore(
                            CONFIG.stores.files
                        )
                        .index(
                            "build"
                        )
                        .getAll(
                            Number(build)
                        )

                );


            for (
                const file
                of files
            ) {

                await this.idbRequest(

                    this.db
                        .transaction(
                            CONFIG.stores.files,
                            "readwrite"
                        )
                        .objectStore(
                            CONFIG.stores.files
                        )
                        .delete(
                            file.id
                        )

                );

            }

        },


        /* =================================================
           CHECK LOCAL
        ================================================= */

        async hasLocalBuild(
            build
        ) {

            await this.init();


            const active =
                await this.getActive();


            return Boolean(
                active &&
                Number(active.build) ===
                Number(build)
            );

        },


        /* =================================================
           UPDATE
        ================================================= */

        async update() {

            if (
                this.updating
            ) {

                return {

                    working:
                        true,

                    updated:
                        false

                };

            }


            this.updating =
                true;

            STATE.working =
                true;

            STATE.startedAt =
                Date.now();

            STATE.completedAt =
                null;

            STATE.error =
                null;

            STATE.progress =
                0;


            try {

                await this.init();


                /* =========================================
                   OFFLINE
                ========================================= */

                if (
                    !navigator.onLine
                ) {

                    const local =
                        await this.getActive();


                    if (local) {

                        STATE.build =
                            Number(
                                local.build
                            );

                        STATE.version =
                            local.version;

                    }


                    this.setStatus(
                        STATUS.OFFLINE
                    );


                    return {

                        updated:
                            false,

                        offline:
                            true,

                        build:
                            STATE.build,

                        version:
                            STATE.version

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


                const local =
                    await this.getActive();


                const localBuild =
                    local
                        ? Number(local.build)
                        : 0;


                STATE.build =
                    localBuild || null;

                STATE.version =
                    local
                        ? local.version
                        : null;


                /* =========================================
                   ALREADY UP TO DATE
                ========================================= */

                if (
                    localBuild >= remoteBuild
                ) {

                    STATE.progress =
                        100;


                    STATE.completedFiles =
                        manifest.files.length;

                    STATE.totalFiles =
                        manifest.files.length;


                    STATE.completedAt =
                        Date.now();


                    this.setStatus(
                        STATUS.UP_TO_DATE,
                        {

                            build:
                                localBuild,

                            version:
                                local?.version ||
                                manifest.version,

                            progress:
                                100

                        }
                    );


                    return {

                        updated:
                            false,

                        build:
                            localBuild,

                        version:
                            local?.version ||
                            manifest.version

                    };

                }


                /* =========================================
                   UPDATE START
                ========================================= */

                STATE.totalFiles =
                    manifest.files.length;

                STATE.completedFiles =
                    0;

                STATE.progress =
                    0;


                this.broadcast(
                    "update-start",
                    {

                        oldBuild:
                            localBuild || null,

                        newBuild:
                            remoteBuild,

                        version:
                            manifest.version,

                        totalFiles:
                            manifest.files.length

                    }
                );


                /* =========================================
                   DOWNLOAD
                ========================================= */

                this.setStatus(
                    STATUS.DOWNLOADING,
                    {

                        build:
                            remoteBuild,

                        version:
                            manifest.version

                    }
                );


                const downloadedFiles =
                    [];


                for (
                    let i = 0;
                    i < manifest.files.length;
                    i++
                ) {

                    const manifestFile =
                        manifest.files[i];


                    const file =
                        await this.downloadFile(
                            manifestFile
                        );


                    downloadedFiles.push(
                        file
                    );


                    STATE.completedFiles =
                        i + 1;

                    STATE.totalFiles =
                        manifest.files.length;

                    STATE.progress =
                        Math.round(
                            (
                                (i + 1) /
                                manifest.files.length
                            ) * 100
                        );


                    this.broadcast(
                        "download-progress",
                        {

                            build:
                                remoteBuild,

                            path:
                                file.path,

                            progress:
                                STATE.progress,

                            completed:
                                i + 1,

                            total:
                                manifest.files.length

                        }
                    );

                }


                /* =========================================
                   SAVE
                ========================================= */

                this.setStatus(
                    STATUS.SAVING,
                    {

                        build:
                            remoteBuild,

                        progress:
                            0

                    }
                );


                for (
                    let i = 0;
                    i < downloadedFiles.length;
                    i++
                ) {

                    const file =
                        downloadedFiles[i];


                    await this.saveFile(
                        remoteBuild,
                        file
                    );


                    STATE.progress =
                        Math.round(
                            (
                                (i + 1) /
                                downloadedFiles.length
                            ) * 100
                        );


                    this.broadcast(
                        "save-progress",
                        {

                            build:
                                remoteBuild,

                            path:
                                file.path,

                            progress:
                                STATE.progress,

                            completed:
                                i + 1,

                            total:
                                downloadedFiles.length

                        }
                    );

                }


                /* =========================================
                   ACTIVE BUILD
                ========================================= */

                await this.saveActive(
                    remoteBuild,
                    manifest.version
                );


                /* =========================================
                   OLD BUILD CLEANUP
                ========================================= */

                if (
                    localBuild &&
                    localBuild !== remoteBuild
                ) {

                    await this.deleteBuildFiles(
                        localBuild
                    );

                }


                /* =========================================
                   READY
                ========================================= */

                STATE.build =
                    remoteBuild;

                STATE.version =
                    String(
                        manifest.version
                    );

                STATE.progress =
                    100;

                STATE.completedFiles =
                    manifest.files.length;

                STATE.totalFiles =
                    manifest.files.length;

                STATE.currentFile =
                    null;

                STATE.completedAt =
                    Date.now();


                this.setStatus(
                    STATUS.READY,
                    {

                        build:
                            remoteBuild,

                        version:
                            manifest.version,

                        progress:
                            100

                    }
                );


                const result = {

                    updated:
                        true,

                    build:
                        remoteBuild,

                    version:
                        manifest.version,

                    files:
                        manifest.files.length

                };


                this.broadcast(
                    "update-complete",
                    result
                );


                return result;

            } catch (
                error
            ) {

                console.error(
                    "[MARA ENGINE] ERROR:",
                    error
                );


                STATE.error =
                    error?.message ||
                    "Update gagal.";


                STATE.currentFile =
                    null;


                this.setStatus(
                    STATUS.ERROR,
                    {

                        error:
                            STATE.error

                    }
                );


                this.broadcast(
                    "update-error",
                    {

                        error:
                            STATE.error

                    }
                );


                return {

                    updated:
                        false,

                    error:
                        true,

                    message:
                        STATE.error

                };

            } finally {

                STATE.working =
                    false;

                this.updating =
                    false;

            }

        },


        /* =================================================
           FILE ACCESS
           Dipakai build.js
        ================================================= */

        async getFile(
            path,
            build = null
        ) {

            await this.init();


            const normalizedPath =
                Utils.normalizePath(
                    path
                );


            if (
                build === null
            ) {

                const active =
                    await this.getActive();


                if (!active) {

                    throw new Error(
                        "Belum ada ACTIVE BUILD."
                    );

                }


                build =
                    Number(
                        active.build
                    );

            }


            const id =
                `${Number(build)}:${normalizedPath}`;


            const file =
                await this.idbRequest(

                    this.db
                        .transaction(
                            CONFIG.stores.files,
                            "readonly"
                        )
                        .objectStore(
                            CONFIG.stores.files
                        )
                        .get(
                            id
                        )

                );


            if (!file) {

                throw new Error(
                    `File tidak ditemukan di IndexedDB: ${normalizedPath}`
                );

            }


            return file;

        },


        /* =================================================
           CREATE LOCAL BLOB URL
           Dipakai build.js
        ================================================= */

        async createURL(
            path,
            build = null
        ) {

            const file =
                await this.getFile(
                    path,
                    build
                );


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


            return URL.createObjectURL(
                blob
            );

        },


        /* =================================================
           GET STATUS
        ================================================= */

        async getStatus() {

            await this.init();


            const active =
                await this.getActive();


            return {

                engine:
                    CONFIG.name,

                engineVersion:
                    CONFIG.version,

                status:
                    STATE.status,

                working:
                    STATE.working,

                build:
                    active
                        ? Number(active.build)
                        : null,

                version:
                    active
                        ? active.version
                        : null,

                remoteBuild:
                    STATE.remoteBuild,

                remoteVersion:
                    STATE.remoteVersion,

                progress:
                    STATE.progress,

                currentFile:
                    STATE.currentFile,

                completedFiles:
                    STATE.completedFiles,

                totalFiles:
                    STATE.totalFiles,

                online:
                    navigator.onLine,

                error:
                    STATE.error

            };

        }

    };


    /* =====================================================
       PUBLIC API
    ===================================================== */

    window.MARAEngineSingle =
        ENGINE;


    window.MARAUpdate = {

        init:
            () =>
                ENGINE.init(),

        update:
            () =>
                ENGINE.update(),

        check:
            () =>
                ENGINE.fetchManifest(),

        status:
            () =>
                ENGINE.getStatus(),

        state:
            () =>
                ENGINE.getState(),

        active:
            () =>
                ENGINE.getActive(),

        getFile:
            path =>
                ENGINE.getFile(path),

        createURL:
            path =>
                ENGINE.createURL(path)

    };


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
                typeof data !== "object"
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

                            event.source?.postMessage(

                                {

                                    source:
                                        CONFIG.name,

                                    type:
                                        "MARA_ENGINE_STATUS",

                                    status

                                },

                                "*"

                            );

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

                            event.source?.postMessage(

                                {

                                    source:
                                        CONFIG.name,

                                    type:
                                        "MARA_ENGINE_UPDATE_RESULT",

                                    result

                                },

                                "*"

                            );

                        }
                    );

            }


            /* =============================================
               FILE REQUEST
            ============================================= */

            if (
                data.type ===
                "MARA_ENGINE_FILE_REQUEST"
            ) {

                ENGINE
                    .createURL(
                        data.path
                    )
                    .then(
                        url => {

                            event.source?.postMessage(

                                {

                                    source:
                                        CONFIG.name,

                                    type:
                                        "MARA_ENGINE_FILE_RESULT",

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

                                    source:
                                        CONFIG.name,

                                    type:
                                        "MARA_ENGINE_FILE_ERROR",

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
       START ENGINE
       ===================================================== */

    const start =
        async () => {

            try {

                await ENGINE.init();


                /*
                 * Engine langsung mengecek update.
                 *
                 * Jika tidak ada update:
                 *    selesai cepat.
                 *
                 * Jika ada update:
                 *    STATE.working = true
                 *    intro dapat mengikuti progress.
                 */

                await ENGINE.update();

            } catch (
                error
            ) {

                console.error(
                    "[MARA ENGINE] START ERROR:",
                    error
                );

            }

        };


    /* =====================================================
       START
    ===================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            start,
            {
                once:
                    true
            }
        );

    } else {

        start();

    }


    /* =====================================================
       LOG
    ===================================================== */

    console.log(
        "=============================================="
    );

    console.log(
        " MARA OS ENGINE SINGLE 4.0.0"
    );

    console.log(
        " SIMPLE UPDATE + INDEXEDDB ENGINE"
    );

    console.log(
        " Database:",
        CONFIG.databaseName
    );

    console.log(
        " Manifest:",
        CONFIG.manifestURL
    );

    console.log(
        "=============================================="
    );

})();