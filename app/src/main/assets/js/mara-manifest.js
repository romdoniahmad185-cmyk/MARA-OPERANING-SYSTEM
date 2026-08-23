/* =====================================================
   MARA OS — MANIFEST SYSTEM
===================================================== */

window.MARA_MANIFEST_CACHE =
    window.MARA_MANIFEST_CACHE || {};


/* =====================================================
   LOAD MANIFEST
===================================================== */

async function loadAppManifest(appId) {

    console.log(
        "[MARA MANIFEST] Memuat:",
        appId
    );


    /* -------------------------------------------------
       CEK REGISTRY
    ------------------------------------------------- */

    if (
        !window.MARA_APPS
    ) {

        throw new Error(
            "MARA_APPS tidak ditemukan. " +
            "Pastikan /js/mara-apps.js dimuat sebelum " +
            "/js/mara-manifest.js."
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
       CEK MANIFEST URL
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
       FETCH MANIFEST
    ------------------------------------------------- */

    const response =
        await fetch(
            registeredApp.manifest,
            {
                cache: "no-cache"
            }
        );


    if (!response.ok) {

        throw new Error(
            "Manifest tidak ditemukan: " +
            registeredApp.manifest +
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
            registeredApp.manifest
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
       CACHE
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
   RESOLVE ENTRY
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


    const manifestAbsoluteURL =
        new URL(
            manifestURL,
            window.location.origin
        );


    const entryAbsoluteURL =
        new URL(
            entry,
            manifestAbsoluteURL
        );


    return entryAbsoluteURL.pathname +
           entryAbsoluteURL.search +
           entryAbsoluteURL.hash;

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