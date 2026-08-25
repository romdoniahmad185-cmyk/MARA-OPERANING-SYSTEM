/* =====================================================
   MARA OS
   ENGINE SINGLE
   STAGE 1
   =====================================================

   FUNGSI TAHAP 1:

   1. Memuat engine
   2. Membaca engine-single.json
   3. Validasi konfigurasi
   4. Inisialisasi IndexedDB
   5. Mendeteksi iframe utama
   6. Mengirim status ke intro.html
   7. Menyiapkan API global MARA
   8. Menjalankan boot sequence

   BELUM:
   - Download update
   - Extract build
   - Install build
   - Aktivasi build
   - Repository update

===================================================== */


/* =====================================================
   CONFIG
===================================================== */

const MARA_ENGINE_CONFIG = {

    configFile:
        "engine-single.json",

    databaseName:
        "MARA_OS_STORAGE",

    databaseVersion:
        1,

    mainIframeId:
        "mara-main-frame",

    introFrameId:
        "mara-intro-frame",

    introOverlayId:
        "mara-intro-overlay",

    timeout:
        30000

};


/* =====================================================
   GLOBAL ENGINE
===================================================== */

window.MARAEngineSingle = {

    version:
        "1.0.0",

    stage:
        1,

    initialized:
        false,

    config:
        null,

    db:
        null,

    mainIframe:
        null,

    introFrame:
        null,

    state: {

        status:
            "IDLE",

        engine:
            false,

        config:
            false,

        database:
            false,

        iframe:
            false,

        ready:
            false,

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
       LOG
    ================================================= */

    log(
        ...args
    ) {

        console.log(
            "[MARA ENGINE]",
            ...args
        );

    },


    warn(
        ...args
    ) {

        console.warn(
            "[MARA ENGINE]",
            ...args
        );

    },


    error(
        ...args
    ) {

        console.error(
            "[MARA ENGINE]",
            ...args
        );

    },


    /* =================================================
       LOAD CONFIG
    ================================================= */

    async loadConfig() {

        this.state.status =
            "LOADING_CONFIG";


        this.emit(
            "config:start"
        );


        const response =
            await fetch(
                MARA_ENGINE_CONFIG.configFile,
                {
                    cache:
                        "no-store"
                }
            );


        if (
            !response.ok
        ) {

            throw new Error(
                `engine-single.json gagal dimuat. HTTP ${response.status}`
            );

        }


        const config =
            await response.json();


        this.validateConfig(
            config
        );


        this.config =
            config;


        this.state.config =
            true;


        this.emit(
            "config:ready",
            {
                config
            }
        );


        this.log(
            "engine-single.json berhasil dimuat."
        );


        return config;

    },


    /* =================================================
       VALIDATE CONFIG
    ================================================= */

    validateConfig(
        config
    ) {

        if (
            !config ||
            typeof config !==
                "object"
        ) {

            throw new Error(
                "Konfigurasi engine tidak valid."
            );

        }


        if (
            !config.engine
        ) {

            throw new Error(
                "Bagian engine tidak ditemukan."
            );

        }


        if (
            !config.engine.name
        ) {

            throw new Error(
                "Nama engine tidak ditemukan."
            );

        }


        if (
            !config.engine.version
        ) {

            throw new Error(
                "Versi engine tidak ditemukan."
            );

        }


        if (
            !config.app
        ) {

            throw new Error(
                "Konfigurasi app tidak ditemukan."
            );

        }


        if (
            !config.paths
        ) {

            throw new Error(
                "Konfigurasi paths tidak ditemukan."
            );

        }


        return true;

    },


    /* =================================================
       OPEN INDEXEDDB
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


                        if (
                            !db.objectStoreNames.contains(
                                "settings"
                            )
                        ) {

                            db.createObjectStore(
                                "settings",
                                {
                                    keyPath:
                                        "id"
                                }
                            );

                        }


                        if (
                            !db.objectStoreNames.contains(
                                "engine"
                            )
                        ) {

                            db.createObjectStore(
                                "engine",
                                {
                                    keyPath:
                                        "id"
                                }
                            );

                        }


                        if (
                            !db.objectStoreNames.contains(
                                "builds"
                            )
                        ) {

                            db.createObjectStore(
                                "builds",
                                {
                                    keyPath:
                                        "build"
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


                        resolve(
                            db
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
       INIT DATABASE
    ================================================= */

    async initDatabase() {

        this.state.status =
            "INITIALIZING_DATABASE";


        this.db =
            await this.openDatabase();


        this.state.database =
            true;


        this.emit(
            "database:ready"
        );


        this.log(
            "IndexedDB berhasil diinisialisasi."
        );


        return this.db;

    },


    /* =================================================
       SAVE ENGINE INFO
    ================================================= */

    async saveEngineInfo() {

        if (
            !this.db
        ) {

            throw new Error(
                "Database belum diinisialisasi."
            );

        }


        return new Promise(
            (
                resolve,
                reject
            ) => {

                const transaction =
                    this.db.transaction(
                        "engine",
                        "readwrite"
                    );


                const store =
                    transaction.objectStore(
                        "engine"
                    );


                store.put({

                    id:
                        "current",

                    name:
                        this.config.engine.name,

                    version:
                        this.config.engine.version,

                    stage:
                        this.config.engine.stage,

                    loadedAt:
                        Date.now()

                });


                transaction.oncomplete =
                    () => {

                        resolve(
                            true
                        );

                    };


                transaction.onerror =
                    () => {

                        reject(
                            transaction.error
                        );

                    };

            }
        );

    },


    /* =================================================
       DETECT IFRAME
    ================================================= */

    detectIframe() {

        this.mainIframe =
            document.getElementById(
                MARA_ENGINE_CONFIG.mainIframeId
            );


        this.introFrame =
            document.getElementById(
                MARA_ENGINE_CONFIG.introFrameId
            );


        if (
            !this.mainIframe
        ) {

            this.warn(
                "mara-main-frame tidak ditemukan."
            );

            return false;

        }


        this.state.iframe =
            true;


        this.emit(
            "iframe:ready",
            {
                iframe:
                    this.mainIframe
            }
        );


        this.log(
            "mara-main-frame berhasil ditemukan."
        );


        return true;

    },


    /* =================================================
       SEND MESSAGE TO INTRO
    ================================================= */

    sendIntroMessage(
        type,
        data = {}
    ) {

        if (
            !this.introFrame ||
            !this.introFrame.contentWindow
        ) {

            return false;

        }


        try {

            this.introFrame.contentWindow.postMessage(
                {
                    type,
                    ...data
                },
                "*"
            );


            return true;

        } catch (error) {

            this.error(
                "Gagal mengirim pesan ke intro.",
                error
            );


            return false;

        }

    },


    /* =================================================
       SEND ENGINE STATUS
    ================================================= */

    notifyIntro(
        status,
        message = ""
    ) {

        this.sendIntroMessage(
            "MARA_ENGINE_STATUS",
            {

                status,

                message,

                engine:
                    this.config
                        ?.engine
                        ?.name || null,

                version:
                    this.config
                        ?.engine
                        ?.version || null,

                stage:
                    this.stage

            }
        );

    },


    /* =================================================
       BOOT
    ================================================= */

    async boot() {

        this.state.status =
            "BOOTING";


        this.notifyIntro(
            "BOOTING",
            "MARA Engine sedang dimulai."
        );


        /* =============================================
           CONFIG
        ============================================= */

        await this.loadConfig();


        this.notifyIntro(
            "CONFIG_READY",
            "Konfigurasi engine berhasil dimuat."
        );


        /* =============================================
           DATABASE
        ============================================= */

        await this.initDatabase();


        await this.saveEngineInfo();


        this.notifyIntro(
            "DATABASE_READY",
            "IndexedDB berhasil diinisialisasi."
        );


        /* =============================================
           IFRAME
        ============================================= */

        this.detectIframe();


        if (
            this.state.iframe
        ) {

            this.notifyIntro(
                "IFRAME_READY",
                "Jendela utama MARA OS siap."
            );

        }


        /* =============================================
           ENGINE READY
        ============================================= */

        this.state.engine =
            true;


        this.state.ready =
            true;


        this.state.status =
            "READY";


        this.initialized =
            true;


        this.emit(
            "ready",
            {

                version:
                    this.version,

                stage:
                    this.stage,

                config:
                    this.config

            }
        );


        this.notifyIntro(
            "ENGINE_READY",
            "MARA Engine berhasil dimuat."
        );


        this.log(
            "================================="
        );


        this.log(
            "MARA ENGINE READY"
        );


        this.log(
            "Version:",
            this.version
        );


        this.log(
            "Stage:",
            this.stage
        );


        this.log(
            "================================="
        );


        return true;

    },


    /* =================================================
       GET STATUS
    ================================================= */

    getStatus() {

        return {

            status:
                this.state.status,

            initialized:
                this.initialized,

            engine:
                this.state.engine,

            config:
                this.state.config,

            database:
                this.state.database,

            iframe:
                this.state.iframe,

            ready:
                this.state.ready,

            version:
                this.version,

            stage:
                this.stage,

            error:
                this.state.error

        };

    },


    /* =================================================
       LOAD MAIN FILE
       
       Tahap 1 belum mengambil build dari IndexedDB.
       Fungsi ini hanya menyiapkan iframe.
    ================================================= */

    loadMainFile(
        path
    ) {

        if (
            !this.mainIframe
        ) {

            throw new Error(
                "mara-main-frame tidak ditemukan."
            );

        }


        if (
            !path
        ) {

            throw new Error(
                "Path UI tidak diberikan."
            );

        }


        this.mainIframe.src =
            path;


        this.emit(
            "main:load",
            {
                path
            }
        );


        return path;

    }

};


/* =====================================================
   GLOBAL API
===================================================== */

window.MARA = {

    engine:

        MARAEngineSingle,


    status:

        () =>
            MARAEngineSingle.getStatus(),


    boot:

        () =>
            MARAEngineSingle.boot(),


    load:

        path =>
            MARAEngineSingle.loadMainFile(
                path
            )

};


/* =====================================================
   DOM READY
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        try {

            MARAEngineSingle.log(
                "ENGINE-SINGLE.JS DIMUAT."
            );


            await MARAEngineSingle.boot();

        } catch (error) {

            MARAEngineSingle.state.status =
                "ERROR";


            MARAEngineSingle.state.error =
                error.message;


            MARAEngineSingle.error(
                "ENGINE BOOT ERROR:",
                error
            );


            MARAEngineSingle.notifyIntro(
                "ENGINE_ERROR",
                error.message
            );

        }

    }
);


/* =====================================================
   ONLINE / OFFLINE
===================================================== */

window.addEventListener(
    "online",
    () => {

        MARAEngineSingle.emit(
            "online"
        );


        MARAEngineSingle.notifyIntro(
            "ONLINE",
            "Koneksi internet tersedia."
        );


        MARAEngineSingle.log(
            "ONLINE"
        );

    }
);


window.addEventListener(
    "offline",
    () => {

        MARAEngineSingle.emit(
            "offline"
        );


        MARAEngineSingle.notifyIntro(
            "OFFLINE",
            "MARA OS berjalan dalam mode offline."
        );


        MARAEngineSingle.log(
            "OFFLINE"
        );

    }
);


/* =====================================================
   FINAL
===================================================== */

console.log(
    "[MARA ENGINE] ENGINE-SINGLE.JS LOADED — STAGE 1"
);