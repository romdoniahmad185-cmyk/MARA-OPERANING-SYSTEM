

/* =====================================================
   MARA OS — APPLICATION CONTAINER
   FLOW:

   URL
   ↓
   app ID
   ↓
   MARA_APPS
   ↓
   manifest.json
   ↓
   entry
   ↓
   iframe
===================================================== */


/* =====================================================
   APP CONTAINER
===================================================== */

const AppContainer = {

    currentApp: null,

    currentManifest: null,

    iframe: null,


    /* =================================================
       GET ELEMENT
    ================================================= */

    get container() {

        return document.getElementById(
            "app-container"
        );

    },


    get content() {

        return document.getElementById(
            "app-content"
        );

    },


    get loading() {

        return document.getElementById(
            "app-loading"
        );

    },


    get error() {

        return document.getElementById(
            "app-error"
        );

    },


    get errorMessage() {

        return document.getElementById(
            "app-error-message"
        );

    },


    /* =================================================
       GET APP ID
    ================================================= */

    getAppId() {

        const params =
            new URLSearchParams(
                window.location.search
            );

        return params.get("id");

    },


    /* =================================================
       SHOW LOADING
    ================================================= */

    showLoading() {

        if (this.loading) {

            this.loading.classList.add(
                "show"
            );

        }

        if (this.error) {

            this.error.classList.remove(
                "show"
            );

        }

    },


    /* =================================================
       HIDE LOADING
    ================================================= */

    hideLoading() {

        if (this.loading) {

            this.loading.classList.remove(
                "show"
            );

        }

    },


    /* =================================================
       SHOW ERROR
    ================================================= */

    showError(message) {

        this.hideLoading();


        if (this.errorMessage) {

            this.errorMessage.textContent =
                message ||
                "Terjadi kesalahan.";

        }


        if (this.error) {

            this.error.classList.add(
                "show"
            );

        }


        console.error(
            "[MARA OS ERROR]",
            message
        );

    },


    /* =================================================
       RESOLVE ENTRY

       manifest:
       /apps/rama/manifest.json

       entry:
       index.html

       hasil:
       /apps/rama/index.html
    ================================================= */

    resolveEntry(
        manifestURL,
        entry
    ) {

        const manifestAbsolute =
            new URL(
                manifestURL,
                window.location.origin
            );


        const entryAbsolute =
            new URL(
                entry,
                manifestAbsolute
            );


        return entryAbsolute.href;

    },


    /* =================================================
       CREATE IFRAME
    ================================================= */

    createIframe(
        entryURL,
        appName
    ) {

        console.log(
            "[MARA OS] Membuat iframe:"
        );

        console.log(
            "[MARA OS] iframe src:",
            entryURL
        );


        /* ---------------------------------------------
           Hapus iframe lama
        --------------------------------------------- */

        if (this.iframe) {

            this.iframe.remove();

            this.iframe = null;

        }


        /* ---------------------------------------------
           Buat iframe
        --------------------------------------------- */

        const iframe =
            document.createElement(
                "iframe"
            );


        iframe.className =
            "app-frame";


        iframe.src =
            entryURL;


        iframe.title =
            appName ||
            "MARA Application";


        iframe.setAttribute(
            "frameborder",
            "0"
        );


        iframe.setAttribute(
            "allow",
            "fullscreen"
        );


        iframe.setAttribute(
            "loading",
            "eager"
        );


        /* ---------------------------------------------
           IFRAME LOAD
        --------------------------------------------- */

        iframe.addEventListener(
            "load",
            () => {

                console.log(
                    "[MARA OS] IFRAME berhasil dimuat:"
                );

                console.log(
                    entryURL
                );


                this.hideLoading();

            }
        );


        /* ---------------------------------------------
           IFRAME ERROR
        --------------------------------------------- */

        iframe.addEventListener(
            "error",
            () => {

                this.showError(
                    "Iframe gagal memuat aplikasi: " +
                    entryURL
                );

            }
        );


        /* ---------------------------------------------
           SIMPAN
        --------------------------------------------- */

        this.iframe =
            iframe;


        /* ---------------------------------------------
           MASUKKAN KE CONTENT
        --------------------------------------------- */

        this.content.appendChild(
            iframe
        );


        console.log(
            "[MARA OS] Iframe sudah dimasukkan ke DOM."
        );

    },


    /* =================================================
       LAUNCH
    ================================================= */

    async launch(
        appId
    ) {

        console.log(
            "================================"
        );

        console.log(
            "[MARA OS] LAUNCH"
        );

        console.log(
            "[MARA OS] App ID:",
            appId
        );

        console.log(
            "================================"
        );


        /* ---------------------------------------------
           VALIDASI ID
        --------------------------------------------- */

        if (!appId) {

            this.showError(
                "ID aplikasi tidak ditemukan."
            );

            return;

        }


        /* ---------------------------------------------
           CEK CONTAINER
        --------------------------------------------- */

        if (!this.container) {

            console.error(
                "[MARA OS] #app-container tidak ditemukan."
            );

            return;

        }


        if (!this.content) {

            console.error(
                "[MARA OS] #app-content tidak ditemukan."
            );

            return;

        }


        /* ---------------------------------------------
           AKTIFKAN CONTAINER
        --------------------------------------------- */

        this.container.classList.add(
            "active"
        );


        this.showLoading();


        /* ---------------------------------------------
           CEK MARA_APPS
        --------------------------------------------- */

        if (
            typeof MARA_APPS ===
            "undefined"
        ) {

            this.showError(
                "MARA_APPS tidak ditemukan. " +
                "Pastikan mara-apps.js dimuat."
            );

            return;

        }


        const registeredApp =
            MARA_APPS[appId];


        if (!registeredApp) {

            this.showError(
                "Aplikasi tidak terdaftar: " +
                appId
            );

            return;

        }


        console.log(
            "[MARA OS] Registry ditemukan:",
            registeredApp
        );


        /* ---------------------------------------------
           MANIFEST
        --------------------------------------------- */

        if (
            typeof loadAppManifest !==
            "function"
        ) {

            this.showError(
                "loadAppManifest() tidak ditemukan. " +
                "Pastikan mara-manifest.js dimuat."
            );

            return;

        }


        let manifest;


        try {

            manifest =
                await loadAppManifest(
                    appId
                );

        } catch (error) {

            this.showError(
                error.message
            );

            return;

        }


        console.log(
            "[MARA OS] Manifest ditemukan:",
            manifest
        );


        /* ---------------------------------------------
           VALIDASI ENTRY
        --------------------------------------------- */

        if (!manifest.entry) {

            this.showError(
                "Manifest tidak memiliki entry."
            );

            return;

        }


        /* ---------------------------------------------
           RESOLVE ENTRY
        --------------------------------------------- */

        const entryURL =
            this.resolveEntry(
                registeredApp.manifest,
                manifest.entry
            );


        console.log(
            "[MARA OS] Entry manifest:",
            manifest.entry
        );


        console.log(
            "[MARA OS] URL aplikasi:",
            entryURL
        );


        /* ---------------------------------------------
           SIMPAN APP
        --------------------------------------------- */

        this.currentApp =
            registeredApp;


        this.currentManifest =
            manifest;


        /* ---------------------------------------------
           BERSIHKAN CONTENT
        --------------------------------------------- */

        this.content.innerHTML = "";


        /* ---------------------------------------------
           BUAT IFRAME
        --------------------------------------------- */

        this.createIframe(
            entryURL,
            manifest.name ||
            registeredApp.name ||
            appId
        );


        /* ---------------------------------------------
           UPDATE URL
        --------------------------------------------- */

        const newURL =
            window.location.pathname +
            "?id=" +
            encodeURIComponent(
                appId
            );


        window.history.replaceState(
            {
                appId: appId
            },
            "",
            newURL
        );


        console.log(
            "[MARA OS] Application launched:"
        );

        console.log(
            manifest.name ||
            registeredApp.name
        );

    },


    /* =================================================
       HOME
    ================================================= */

    home() {

        if (this.iframe) {

            this.iframe.remove();

            this.iframe = null;

        }


        if (this.content) {

            this.content.innerHTML =
                "";

        }


        if (this.container) {

            this.container.classList.remove(
                "active"
            );

        }


        this.currentApp =
            null;

        this.currentManifest =
            null;


        window.history.replaceState(
            {},
            "",
            window.location.pathname
        );


        console.log(
            "[MARA OS] HOME"
        );

    },


    /* =================================================
       BACK
    ================================================= */

    back() {

        window.history.back();

    },


    /* =================================================
       RECENT
    ================================================= */

    recent() {

        console.log(
            "[MARA OS] Recent Apps"
        );

    }

};


/* =====================================================
   GLOBAL FUNCTIONS
===================================================== */

function launchApp(
    appId
) {

    AppContainer.launch(
        appId
    );

}


function appBack() {

    AppContainer.back();

}


function appHome() {

    AppContainer.home();

}


function appRecent() {

    AppContainer.recent();

}


/* =====================================================
   AUTO LAUNCH
===================================================== */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        console.log(
            "[MARA OS] App Container siap."
        );


        const appId =
            AppContainer.getAppId();


        console.log(
            "[MARA OS] URL App ID:",
            appId
        );


        if (!appId) {

            console.log(
                "[MARA OS] Tidak ada ID aplikasi."
            );

            return;

        }


        AppContainer.launch(
            appId
        );

    }
);