/* =====================================================
   MARA OS — APPLICATION REGISTRY
===================================================== */

window.MARA_APPS = {

    "mara.app.rama": {

        id: "mara.app.rama",

        name: "Rama",

        version: "1.0.0",

        icon:
            "/icon-svg/mara-browser.svg",

        manifest:
            "/apps/rama/manifest.json"

    }

};


/* =====================================================
   TEST
===================================================== */

console.log(
    "[MARA APPS] BERHASIL DIMUAT"
);

console.log(
    "[MARA APPS] MARA_APPS:",
    window.MARA_APPS
);

console.log(
    "[MARA APPS] RAMA:",
    window.MARA_APPS["mara.app.rama"]
);