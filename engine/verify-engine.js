/* =====================================================
   MARA OS — VERIFY ENGINE
===================================================== */

window.MARAVerifyEngine = {

    async verifyResponse(response) {

        if (!response) {
            throw new Error(
                "Response update tidak tersedia."
            );
        }

        if (!response.ok) {
            throw new Error(
                "Paket update tidak valid."
            );
        }

        return true;
    },

    async verifyBlob(blob) {

        if (!(blob instanceof Blob)) {
            throw new Error(
                "Data update bukan Blob yang valid."
            );
        }

        if (blob.size <= 0) {
            throw new Error(
                "Paket update kosong."
            );
        }

        return true;
    }

};