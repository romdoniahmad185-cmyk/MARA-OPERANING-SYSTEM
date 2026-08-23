/* =====================================================
   MARA OS — MANIFEST SYSTEM
   Automatic Path Resolver
===================================================== */

window.MARA_MANIFEST_CACHE =
    window.MARA_MANIFEST_CACHE || {};


/* =====================================================
   GET BASE URL
===================================================== */

function getMaraAppContainerBaseURL() {

    return new URL(
        "./",
        window.location.href
    );

}


/* =====================================================
   RESOLVE MANIFEST URL
===================================================== */

function resolveManifestURL(
    manifestPath
) {

    if (!manifestPath) {

        throw new Error(
            "Manifest URL tidak tersedia."
        );

    }


    const baseURL =
        getMaraAppContainerBaseURL();


    const manifestURL =
        new URL(
            manifestPath,
            baseURL
        );


    return manifestURL.href;

}


/* =====================================================
   LOAD MANIFEST
===================================================== */

async function loadAppManifest(
    appId
) {

    console.log(
        "[MARA MANIFEST] Memuat:",
        appId
    );


    /* -------------------------------------------------
       CEK MARA APPS
    ------------------------------------------------- */

    if (
        !window.MARA_APPS
    ) {

        throw new Error(
            "MARA_APPS tidak ditemukan. " +
            "Pastikan mara-apps.js dimuat sebelum " +
            "mara-manifest.js."
        );

    }


    /* -------------------------------------------------
       CARI APLIKASI
    ------------------------------------------------- */

    const registeredApp =
        window.MARA_APPS[appId];


    if (!registeredApp) {

        throw new Error(
            "Aplikasi tidak terdaftar: " +
            appId
        );

    }


    /* -------------------------------------------------
       CEK MANIFEST PATH
    ------------------------------------------------- */

    if (
        !registeredApp.manifest
    ) {

        throw new Error(
            "Manifest URL tidak tersedia untuk: " +
            appId
        );

    }


    /* -------------------------------------------------
       RESOLVE MANIFEST
    ------------------------------------------------- */

    const manifestURL =
        resolveManifestURL(
            registeredApp.manifest
        );


    console.log(
        "[MARA MANIFEST] URL:",
        manifestURL
    );


    /* -------------------------------------------------
       CACHE
    ------------------------------------------------- */

    if (
        window.MARA_MANIFEST_CACHE[appId]
    ) {

        console.log(
            "[MARA MANIFEST] Menggunakan cache:",
            appId
        );

        return (
            window.MARA_MANIFEST_CACHE[appId]
        );

    }


    /* -------------------------------------------------
       FETCH
    ------------------------------------------------- */

    let response;

    try {

        response =
            await fetch(
                manifestURL,
                {
                    cache: "no-cache"
                }
            );

    } catch (error) {

        throw new Error(
            "Gagal mengambil manifest: " +
            manifestURL
        );

    }


    /* -------------------------------------------------
       HTTP ERROR
    ------------------------------------------------- */

    if (!response.ok) {

        throw new Error(
            "Manifest tidak ditemukan: " +
            manifestURL +
            " (" +
            response.status +
            ")"
        );

    }


    /* -------------------------------------------------
       PARSE JSON
    ------------------------------------------------- */

    let manifest;

    try {

        manifest =
            await response.json();

    } catch (error) {

        throw new Error(
            "Manifest bukan JSON yang valid: " +
            manifestURL
        );

    }


    /* -------------------------------------------------
       VALIDASI ID
    ------------------------------------------------- */

    if (
        manifest.id !== appId
    ) {

        throw new Error(
            "ID manifest tidak cocok. " +
            "Registry: " +
            appId +
            " | Manifest: " +
            manifest.id
        );

    }


    /* -------------------------------------------------
       VALIDASI ENTRY
    ------------------------------------------------- */

    if (
        !manifest.entry
    ) {

        throw new Error(
            "Manifest tidak memiliki entry: " +
            appId
        );

    }


    /* -------------------------------------------------
       SIMPAN CACHE
    ------------------------------------------------- */

    window.MARA_MANIFEST_CACHE[appId] =
        manifest;


    console.log(
        "[MARA MANIFEST] Berhasil:",
        manifest
    );


    return manifest;

}


/* =====================================================
   RESOLVE APP ENTRY
===================================================== */

function resolveAppEntry(
    manifestURL,
    entry
) {

    if (!manifestURL) {

        throw new Error(
            "URL manifest tidak tersedia."
        );

    }


    if (!entry) {

        throw new Error(
            "Entry aplikasi tidak tersedia."
        );

    }


    const absoluteManifestURL =
        resolveManifestURL(
            manifestURL
        );


    const entryAbsoluteURL =
        new URL(
            entry,
            absoluteManifestURL
        );


    return (
        entryAbsoluteURL.href
    );

}


/* =====================================================
   CLEAR CACHE
===================================================== */

function clearManifestCache(
    appId = null
) {

    if (appId) {

        delete window.MARA_MANIFEST_CACHE[
            appId
        ];

        return;

    }


    window.MARA_MANIFEST_CACHE = {};

}


/* =====================================================
   GLOBAL EXPORT
===================================================== */

window.loadAppManifest =
    loadAppManifest;

window.resolveAppEntry =
    resolveAppEntry;

window.clearManifestCache =
    clearManifestCache;

window.resolveManifestURL =
    resolveManifestURL;