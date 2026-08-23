/* =====================================================
   MARA OS — INSTALL / PATCH ENGINE
===================================================== */

window.MARAInstallEngine = {

    async prepare(updateManifest) {

        if (!updateManifest) {
            throw new Error(
                "Manifest update tidak tersedia."
            );
        }

        /*
         * Browser/GitHub Pages tidak memberikan
         * akses filesystem untuk mengganti file
         * aplikasi secara langsung.
         *
         * Engine ini menjadi titik masuk installer.
         */

        return {
            ready: true,
            manifest: updateManifest
        };
    }

};