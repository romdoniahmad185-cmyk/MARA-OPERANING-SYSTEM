/* =====================================================
   MARA OS — APP UPDATE ENGINE
===================================================== */

window.MARAAppUpdateEngine = {

    async checkApp(appId, repositoryURL) {

        if (!appId) {
            throw new Error(
                "App ID tidak tersedia."
            );
        }

        if (!repositoryURL) {
            throw new Error(
                "Repository aplikasi tidak tersedia."
            );
        }

        const app =
            MARAAppManager.get(appId);

        if (!app) {
            throw new Error(
                "Aplikasi tidak terdaftar: " +
                appId
            );
        }

        const manifest =
            await MARARepositoryEngine.fetchManifest(
                repositoryURL
            );

        const localVersion =
            app.version || "0.0.0";

        const remoteVersion =
            manifest.version ||
            manifest.latest ||
            "0.0.0";

        return {
            appId,
            available:
                MARAVersionEngine.isNewer(
                    localVersion,
                    remoteVersion
                ),
            localVersion,
            remoteVersion,
            manifest
        };
    }

};