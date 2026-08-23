/* =====================================================
   MARA OS — UPDATE ENGINE
===================================================== */

window.MARAUpdateEngine = {

    repositoryURL: null,

    async check(options = {}) {

        const repositoryURL =
            options.repositoryURL ||
            this.repositoryURL;

        const localVersion =
            options.localVersion ||
            window.MARA_OS_VERSION ||
            "0.0.0";

        if (!repositoryURL) {
            throw new Error(
                "Repository URL belum ditentukan."
            );
        }

        const manifest =
            await MARARepositoryEngine.fetchManifest(
                repositoryURL
            );

        const remoteVersion =
            manifest.version ||
            manifest.latest ||
            "0.0.0";

        const available =
            MARAVersionEngine.isNewer(
                localVersion,
                remoteVersion
            );

        return {
            available,
            localVersion,
            remoteVersion,
            manifest
        };
    }

};