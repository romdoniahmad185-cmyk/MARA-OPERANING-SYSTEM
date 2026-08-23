/* =====================================================
   MARA OS — VERSION ENGINE
===================================================== */

window.MARAVersionEngine = {

    normalize(version) {

        return String(version || "0.0.0")
            .replace(/^v/i, "")
            .split(".")
            .map(part => parseInt(part, 10) || 0);
    },

    compare(localVersion, remoteVersion) {

        const local = this.normalize(localVersion);
        const remote = this.normalize(remoteVersion);

        for (let i = 0; i < 3; i++) {

            const a = local[i] || 0;
            const b = remote[i] || 0;

            if (a < b) return -1;
            if (a > b) return 1;
        }

        return 0;
    },

    isNewer(localVersion, remoteVersion) {

        return this.compare(
            localVersion,
            remoteVersion
        ) < 0;
    }

};