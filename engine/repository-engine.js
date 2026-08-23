/* =====================================================
   MARA OS — REPOSITORY ENGINE
===================================================== */

window.MARARepositoryEngine = {

    async fetchManifest(url) {

        if (!url) {
            throw new Error("Repository URL tidak tersedia.");
        }

        const response = await fetch(url, {
            cache: "no-cache"
        });

        if (!response.ok) {
            throw new Error(
                "Repository manifest gagal diambil: " +
                response.status
            );
        }

        return await response.json();
    }

};