/* =====================================================
   MARA OS — DOWNLOAD ENGINE
===================================================== */

window.MARADownloadEngine = {

    async download(url) {

        if (!url) {
            throw new Error(
                "URL paket update tidak tersedia."
            );
        }

        const response =
            await fetch(url, {
                cache: "no-cache"
            });

        if (!response.ok) {
            throw new Error(
                "Gagal mengunduh paket: " +
                response.status
            );
        }

        return await response.blob();
    }

};