/* =====================================================
   MARA OS — REPOSITORY ENGINE
===================================================== */

window.MARARepositoryEngine = {

    manifestURL:
        "https://romdoniahmad185-cmyk.github.io/mara-os-updates/stable/update-manifest.json",


    /* =================================================
       GET REPOSITORY MANIFEST
    ================================================= */

    async fetchManifest(url = null) {

        const repositoryURL =
            url || this.manifestURL;


        if (!repositoryURL) {

            throw new Error(
                "URL repository MARA OS tidak tersedia."
            );

        }


        console.log(
            "[MARA REPOSITORY] Mengakses:",
            repositoryURL
        );


        const response =
            await fetch(
                repositoryURL,
                {
                    cache: "no-cache"
                }
            );


        if (!response.ok) {

            throw new Error(
                "Repository MARA OS gagal diakses: " +
                response.status
            );

        }


        let manifest;


        try {

            manifest =
                await response.json();

        } catch (error) {

            throw new Error(
                "Repository manifest bukan JSON yang valid."
            );

        }


        console.log(
            "[MARA REPOSITORY] Manifest berhasil:",
            manifest
        );


        return manifest;

    }

};


/* =====================================================
   TEST
===================================================== */

console.log(
    "[MARA REPOSITORY] ENGINE BERHASIL DIMUAT"
);

console.log(
    "[MARA REPOSITORY] URL:",
    MARARepositoryEngine.manifestURL
);