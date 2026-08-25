/* =========================================================
   MARA OS
   ENGINE SINGLE
   STAGE 1 — COMPLETE BOOT ENGINE
   =========================================================

   PIPELINE:

   index.html
        ↓
   engine-single.js
        ↓
   engine-single.json
        ↓
   IndexedDB
        ↓
   Detect Intro
        ↓
   Detect Main Iframe
        ↓
   ENGINE READY
        ↓
   Intro menerima status
        ↓
   Main UI siap

   STAGE 1:
   - Boot engine
   - Config loader
   - Config validator
   - IndexedDB
   - Engine storage
   - Build metadata
   - Intro communication
   - Main iframe controller
   - Online / offline
   - Repository checker
   - Global API
   - Error handling

   BELUM:
   - Automatic download
   - Automatic extraction
   - Automatic installation
   - Automatic activation
   - Automatic deletion old build

   Bagian tersebut akan masuk tahap berikutnya.
========================================================= */


/* =========================================================
   ENGINE CONSTANT
========================================================= */

const MARA_ENGINE = {

    NAME:
        "MARA ENGINE SINGLE",

    ID:
        "mara-engine-single",

    VERSION:
        "1.0.0",

    STAGE:
        1,

    CONFIG_FILE:
        "engine-single.json",

    DATABASE:
        "MARA_OS_STORAGE",

    DATABASE_VERSION:
        2,

    INTRO_FRAME:
        "mara-intro-frame",

    INTRO_OVERLAY:
        "mara-intro-overlay",

    MAIN_FRAME:
        "mara-main-frame",

    REQUEST_TIMEOUT:
        30000

};


/* =========================================================
   MARA ENGINE OBJECT
========================================================= */

window.MARAEngineSingle = {

    initialized:
        false,

    booted:
        false,

    config:
        null,

    db:
        null,

    introFrame:
        null,

    introOverlay:
        null,

    mainFrame:
        null,

    events:
        {},

    state: {

        status:
            "IDLE",

        engine:
            false,

        config:
            false,

        database:
            false,

        intro:
            false,

        mainFrame:
            false,

        ready:
            false,

        online:
            navigator.onLine,

        error:
            null,

        startedAt:
            null,

        readyAt:
            null

    },


    /* =====================================================
       LOG
    ===================================================== */

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


    /* =====================================================
       EVENT SYSTEM
    ===================================================== */

    on(
        event,
        callback
    ) {

        if (
            typeof callback !==
            "function"
        ) {

            return;

        }


        if (
            !this.events[event]
        ) {

            this.events[event] =
                [];

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
            this.events[event]
                .filter(
                    item =>
                        item !==
                        callback
                );

    },


    emit(
        event,
        data = {}
    ) {

        const listeners =
            this.events[event] ||
            [];


        listeners.forEach(
            callback => {

                try {

                    callback(
                        data
                    );

                } catch (
                    error
                ) {

                    this.error(
                        "EVENT ERROR:",
                        error
                    );

                }

            }
        );

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


        this.emit(
            "status",
            {

                status,

                ...extra

            }
        );


        this.notifyIntro(
            "MARA_ENGINE_STATUS",
            {

                status,

                ...extra

            }
        );


        this.log(
            "STATUS:",
            status,
            extra
        );

    },


    /* =====================================================
       FETCH WITH TIMEOUT
    ===================================================== */

    async fetchURL(
        url
    ) {

        const controller =
            new AbortController();


        const timeout =
            setTimeout(
                () => {

                    controller.abort();

                },
                MARA_ENGINE.REQUEST_TIMEOUT
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
                    `HTTP ${response.status}: ${url}`
                );

            }


            return response;

        } finally {

            clearTimeout(
                timeout
            );

        }

    },


    /* =====================================================
       LOAD JSON CONFIG
    ===================================================== */

    async loadConfig() {

        this.setStatus(
            "LOADING_CONFIG"
        );


        this.emit(
            "config:start"
        );


        const response =
            await this.fetchURL(
                MARA_ENGINE.CONFIG_FILE
            );


        let config;


        try {

            config =
                await response.json();

        } catch (
            error
        ) {

            throw new Error(
                "engine-single.json bukan JSON yang valid."
            );

        }


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


        this.notifyIntro(
            "MARA_CONFIG_READY",
            {

                version:
                    config.engine?.version,

                stage:
                    config.engine?.stage

            }
        );


        this.log(
            "engine-single.json berhasil dimuat."
        );


        return config;

    },


    /* =====================================================
       VALIDATE CONFIG
    ===================================================== */

    validateConfig(
        config
    ) {

        if (
            !config ||
            typeof config !==
            "object"
        ) {

            throw new Error(
                "Konfigurasi MARA tidak valid."
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
                "engine.name tidak ditemukan."
            );

        }


        if (
            !config.engine.version
        ) {

            throw new Error(
                "engine.version tidak ditemukan."
            );

        }


        if (
            !config.app
        ) {

            throw new Error(
                "Bagian app tidak ditemukan."
            );

        }


        if (
            !config.paths
        ) {

            throw new Error(
                "Bagian paths tidak ditemukan."
            );

        }


        return true;

    },


    /* =====================================================
       OPEN INDEXEDDB
    ===================================================== */

    openDatabase() {

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
                            "IndexedDB tidak tersedia pada perangkat ini."
                        )
                    );

                    return;

                }


                const request =
                    indexedDB.open(
                        MARA_ENGINE.DATABASE,
                        MARA_ENGINE.DATABASE_VERSION
                    );


                request.onupgradeneeded =
                    event => {

                        const db =
                            event.target.result;


                        /* ===============================
                           SETTINGS
                        =============================== */

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


                        /* ===============================
                           ENGINE
                        =============================== */

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


                        /* ===============================
                           BUILDS
                        =============================== */

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


                        /* ===============================
                           FILES
                        =============================== */

                        if (
                            !db.objectStoreNames.contains(
                                "files"
                            )
                        ) {

                            const files =
                                db.createObjectStore(
                                    "files",
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


                        /* ===============================
                           ACTIVE
                        =============================== */

                        if (
                            !db.objectStoreNames.contains(
                                "active"
                            )
                        ) {

                            db.createObjectStore(
                                "active",
                                {

                                    keyPath:
                                        "id"

                                }
                            );

                        }


                        /* ===============================
                           TEMPORARY
                        =============================== */

                        if (
                            !db.objectStoreNames.contains(
                                "temporary"
                            )
                        ) {

                            const temporary =
                                db.createObjectStore(
                                    "temporary",
                                    {

                                        keyPath:
                                            "id"

                                    }
                                );


                            temporary.createIndex(
                                "build",
                                "build",
                                {

                                    unique:
                                        false

                                }
                            );

                        }


                        this.log(
                            "IndexedDB schema berhasil dibuat/di-upgrade."
                        );

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
                            request.error ||
                            new Error(
                                "Gagal membuka IndexedDB."
                            )
                        );

                    };

            }
        );

    },


    /* =====================================================
       INIT DATABASE
    ===================================================== */

    async initDatabase() {

        this.setStatus(
            "INITIALIZING_DATABASE"
        );


        this.db =
            await this.openDatabase();


        this.state.database =
            true;


        this.emit(
            "database:ready"
        );


        this.notifyIntro(
            "MARA_DATABASE_READY",
            {

                database:
                    MARA_ENGINE.DATABASE

            }
        );


        this.log(
            "IndexedDB READY:",
            MARA_ENGINE.DATABASE
        );


        return this.db;

    },


    /* =====================================================
       DATABASE TRANSACTION
    ===================================================== */

    transaction(
        storeName,
        mode = "readonly"
    ) {

        if (
            !this.db
        ) {

            throw new Error(
                "Database belum siap."
            );

        }


        return this.db
            .transaction(
                storeName,
                mode
            )
            .objectStore(
                storeName
            );

    },


    /* =====================================================
       DATABASE REQUEST
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
       SAVE ENGINE INFORMATION
    ===================================================== */

    async saveEngineInfo() {

        if (
            !this.config
        ) {

            throw new Error(
                "Config belum tersedia."
            );

        }


        const data = {

            id:
                "current",

            engine:
                this.config.engine,

            app:
                this.config.app,

            stage:
                MARA_ENGINE.STAGE,

            loadedAt:
                Date.now()

        };


        await this.request(
            this.transaction(
                "engine",
                "readwrite"
            ).put(
                data
            )
        );


        this.emit(
            "engine:saved",
            data
        );


        this.log(
            "Informasi engine tersimpan."
        );


        return data;

    },


    /* =====================================================
       SAVE SETTING
    ===================================================== */

    async setSetting(
        id,
        value
    ) {

        await this.request(
            this.transaction(
                "settings",
                "readwrite"
            ).put({

                id,

                value,

                updatedAt:
                    Date.now()

            })
        );


        return true;

    },


    /* =====================================================
       GET SETTING
    ===================================================== */

    async getSetting(
        id
    ) {

        return this.request(
            this.transaction(
                "settings"
            ).get(
                id
            )
        );

    },


    /* =====================================================
       DETECT IFRAMES
    ===================================================== */

    detectFrames() {

        this.introFrame =
            document.getElementById(
                MARA_ENGINE.INTRO_FRAME
            );


        this.introOverlay =
            document.getElementById(
                MARA_ENGINE.INTRO_OVERLAY
            );


        this.mainFrame =
            document.getElementById(
                MARA_ENGINE.MAIN_FRAME
            );


        /* ===============================
           INTRO
        =============================== */

        if (
            this.introFrame
        ) {

            this.state.intro =
                true;


            this.emit(
                "intro:ready",
                {

                    iframe:
                        this.introFrame

                }
            );


            this.log(
                "Intro iframe ditemukan."
            );

        } else {

            this.warn(
                "Intro iframe tidak ditemukan."
            );

        }


        /* ===============================
           MAIN FRAME
        =============================== */

        if (
            this.mainFrame
        ) {

            this.state.mainFrame =
                true;


            this.emit(
                "mainframe:ready",
                {

                    iframe:
                        this.mainFrame

                }
            );


            this.log(
                "mara-main-frame ditemukan."
            );

        } else {

            this.warn(
                "mara-main-frame tidak ditemukan."
            );

        }


        return {

            intro:
                Boolean(
                    this.introFrame
                ),

            main:
                Boolean(
                    this.mainFrame
                )

        };

    },


    /* =====================================================
       INTRO MESSAGE
    ===================================================== */

    notifyIntro(
        type,
        data = {}
    ) {

        if (
            !this.introFrame
        ) {

            return false;

        }


        if (
            !this.introFrame.contentWindow
        ) {

            return false;

        }


        try {

            this.introFrame.contentWindow.postMessage(
                {

                    type,

                    timestamp:
                        Date.now(),

                    engine:
                        MARA_ENGINE.NAME,

                    engineVersion:
                        MARA_ENGINE.VERSION,

                    stage:
                        MARA_ENGINE.STAGE,

                    ...data

                },
                "*"
            );


            return true;

        } catch (
            error
        ) {

            this.error(
                "Gagal mengirim pesan ke intro:",
                error
            );


            return false;

        }

    },


    /* =====================================================
       INTRO MESSAGE LISTENER
    ===================================================== */

    setupIntroListener() {

        window.addEventListener(
            "message",
            event => {

                if (
                    !this.introFrame
                ) {

                    return;

                }


                if (
                    event.source !==
                    this.introFrame.contentWindow
                ) {

                    return;

                }


                const data =
                    event.data;


                if (
                    !data ||
                    typeof data !==
                    "object"
                ) {

                    return;

                }


                this.emit(
                    "intro:message",
                    data
                );


                switch (
                    data.type
                ) {

                    case "MARA_INTRO_READY":

                        this.log(
                            "Intro READY."
                        );

                        this.notifyIntro(
                            "MARA_ENGINE_STATUS",
                            {

                                status:
                                    this.state.status

                            }
                        );

                        break;


                    case "MARA_INTRO_FINISHED":

                        this.log(
                            "Intro FINISHED."
                        );

                        this.emit(
                            "intro:finished"
                        );

                        break;


                    default:

                        break;

                }

            }
        );

    },


    /* =====================================================
       MAIN FRAME LOAD
    ===================================================== */

    loadMainUI(
        path
    ) {

        if (
            !this.mainFrame
        ) {

            throw new Error(
                "mara-main-frame tidak ditemukan."
            );

        }


        if (
            !path
        ) {

            throw new Error(
                "Path UI kosong."
            );

        }


        this.setStatus(
            "LOADING_UI",
            {

                path

            }
        );


        this.mainFrame.onload =
            () => {

                this.setStatus(
                    "UI_READY",
                    {

                        path

                    }
                );


                this.emit(
                    "ui:ready",
                    {

                        path,

                        iframe:
                            this.mainFrame

                    }
                );


                this.log(
                    "UI berhasil dimuat:",
                    path
                );

            };


        this.mainFrame.onerror =
            () => {

                this.setStatus(
                    "UI_ERROR",
                    {

                        path

                    }
                );

            };


        this.mainFrame.src =
            path;


        return true;

    },


    /* =====================================================
       CLEAR MAIN FRAME
    ===================================================== */

    clearMainUI() {

        if (
            !this.mainFrame
        ) {

            return;

        }


        this.mainFrame.src =
            "about:blank";


        this.log(
            "Main iframe dikosongkan."
        );

    },


    /* =====================================================
       CHECK REPOSITORY
       
       Hanya pemeriksaan.
       Belum download/install.
    ===================================================== */

    async checkRepository() {

        if (
            !navigator.onLine
        ) {

            return {

                online:
                    false,

                available:
                    false,

                reason:
                    "OFFLINE"

            };

        }


        if (
            !this.config
        ) {

            throw new Error(
                "Config belum siap."
            );

        }


        const repository =
            this.config.repository;


        if (
            !repository ||
            repository.enabled !==
            true
        ) {

            return {

                online:
                    true,

                available:
                    false,

                enabled:
                    false

            };

        }


        if (
            !repository.manifest
        ) {

            return {

                online:
                    true,

                available:
                    false,

                enabled:
                    true,

                reason:
                    "MANIFEST_NOT_CONFIGURED"

            };

        }


        this.setStatus(
            "CHECKING_REPOSITORY"
        );


        try {

            const response =
                await this.fetchURL(
                    repository.manifest
                );


            const manifest =
                await response.json();


            this.emit(
                "repository:ready",
                {

                    manifest

                }
            );


            this.notifyIntro(
                "MARA_REPOSITORY_READY",
                {

                    manifest

                }
            );


            this.log(
                "Repository manifest berhasil dibaca."
            );


            return {

                online:
                    true,

                available:
                    true,

                manifest

            };

        } catch (
            error
        ) {

            this.warn(
                "Repository tidak tersedia:",
                error
            );


            return {

                online:
                    true,

                available:
                    false,

                error:
                    error.message

            };

        }

    },


    /* =====================================================
       GET ENGINE STATUS
    ===================================================== */

    getStatus() {

        return {

            engine:
                {

                    name:
                        MARA_ENGINE.NAME,

                    id:
                        MARA_ENGINE.ID,

                    version:
                        MARA_ENGINE.VERSION,

                    stage:
                        MARA_ENGINE.STAGE

                },

            state:
                {

                    ...this.state

                },

            config:
                this.config,

            database:
                {

                    name:
                        MARA_ENGINE.DATABASE,

                    version:
                        MARA_ENGINE.DATABASE_VERSION,

                    ready:
                        Boolean(
                            this.db
                        )

                }

        };

    },


    /* =====================================================
       BOOT
    ===================================================== */

    async boot() {

        if (
            this.booted
        ) {

            this.log(
                "Engine sudah boot."
            );

            return true;

        }


        this.state.startedAt =
            Date.now();


        this.state.error =
            null;


        this.setStatus(
            "BOOTING"
        );


        try {

            /* =========================================
               STEP 1
            ========================================= */

            await this.loadConfig();


            /* =========================================
               STEP 2
            ========================================= */

            await this.initDatabase();


            /* =========================================
               STEP 3
            ========================================= */

            await this.saveEngineInfo();


            /* =========================================
               STEP 4
            ========================================= */

            this.detectFrames();


            /* =========================================
               STEP 5
            ========================================= */

            this.setupIntroListener();


            /* =========================================
               STEP 6
            ========================================= */

            this.state.engine =
                true;


            this.state.ready =
                true;


            this.state.status =
                "READY";


            this.state.readyAt =
                Date.now();


            this.initialized =
                true;


            this.booted =
                true;


            this.emit(
                "ready",
                this.getStatus()
            );


            /* =========================================
               INTRO SUCCESS
            ========================================= */

            this.notifyIntro(
                "MARA_ENGINE_READY",
                {

                    status:
                        "SUCCESS",

                    message:
                        "MARA ENGINE SINGLE berhasil dimuat.",

                    version:
                        MARA_ENGINE.VERSION,

                    stage:
                        MARA_ENGINE.STAGE

                }
            );


            this.log(
                "======================================"
            );


            this.log(
                "MARA ENGINE SINGLE READY"
            );


            this.log(
                "Version:",
                MARA_ENGINE.VERSION
            );


            this.log(
                "Stage:",
                MARA_ENGINE.STAGE
            );


            this.log(
                "IndexedDB:",
                this.state.database
            );


            this.log(
                "Intro:",
                this.state.intro
            );


            this.log(
                "Main Frame:",
                this.state.mainFrame
            );


            this.log(
                "======================================"
            );


            return true;

        } catch (
            error
        ) {

            this.state.status =
                "ERROR";


            this.state.error =
                error.message;


            this.emit(
                "error",
                {

                    error

                }
            );


            this.notifyIntro(
                "MARA_ENGINE_ERROR",
                {

                    status:
                        "ERROR",

                    message:
                        error.message

                }
            );


            this.error(
                "ENGINE BOOT FAILED:",
                error
            );


            return false;

        }

    }

};


/* =========================================================
   ONLINE
========================================================= */

window.addEventListener(
    "online",
    () => {

        MARAEngineSingle.state.online =
            true;


        MARAEngineSingle.emit(
            "online"
        );


        MARAEngineSingle.notifyIntro(
            "MARA_ONLINE",
            {

                message:
                    "Koneksi internet tersedia."

            }
        );


        MARAEngineSingle.log(
            "ONLINE"
        );

    }
);


/* =========================================================
   OFFLINE
========================================================= */

window.addEventListener(
    "offline",
    () => {

        MARAEngineSingle.state.online =
            false;


        MARAEngineSingle.emit(
            "offline"
        );


        MARAEngineSingle.notifyIntro(
            "MARA_OFFLINE",
            {

                message:
                    "MARA OS berjalan offline."

            }
        );


        MARAEngineSingle.log(
            "OFFLINE"
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

            MARAEngineSingle.log(
                "ENGINE-SINGLE.JS LOADED."
            );


            await MARAEngineSingle.boot();

        } catch (
            error
        ) {

            MARAEngineSingle.error(
                "BOOT ERROR:",
                error
            );

        }

    }
);


/* =========================================================
   GLOBAL MARA API
========================================================= */

window.MARA = {

    engine:
        MARAEngineSingle,


    boot:
        () =>
            MARAEngineSingle.boot(),


    status:
        () =>
            MARAEngineSingle.getStatus(),


    repository:
        () =>
            MARAEngineSingle.checkRepository(),


    load:
        path =>
            MARAEngineSingle.loadMainUI(
                path
            ),


    clear:
        () =>
            MARAEngineSingle.clearMainUI(),


    setting:

        {

            get:
                id =>
                    MARAEngineSingle.getSetting(
                        id
                    ),

            set:
                (
                    id,
                    value
                ) =>
                    MARAEngineSingle.setSetting(
                        id,
                        value
                    )

        }

};


/* =========================================================
   COMPATIBILITY API
========================================================= */

window.MARAUpdate = {

    status:
        () =>
            MARAEngineSingle.getStatus(),


    check:
        () =>
            MARAEngineSingle.checkRepository(),


    boot:
        () =>
            MARAEngineSingle.boot()

};


/* =========================================================
   FINAL LOG
========================================================= */

console.log(
    "================================================"
);

console.log(
    "[MARA ENGINE] ENGINE-SINGLE.JS LOADED"
);

console.log(
    "[MARA ENGINE] VERSION:",
    MARA_ENGINE.VERSION
);

console.log(
    "[MARA ENGINE] STAGE:",
    MARA_ENGINE.STAGE
);

console.log(
    "================================================"
);