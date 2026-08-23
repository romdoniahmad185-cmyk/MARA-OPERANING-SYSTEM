/* =====================================================
   MARA OS — BACKUP ENGINE
===================================================== */

window.MARABackupEngine = {

    async create(snapshot = {}) {

        const backup = {
            timestamp: new Date().toISOString(),
            version:
                window.MARA_OS_VERSION ||
                "0.0.0",
            data: snapshot
        };

        try {

            localStorage.setItem(
                "mara_os_backup",
                JSON.stringify(backup)
            );

        } catch (error) {

            console.warn(
                "[MARA BACKUP] Backup lokal gagal:",
                error
            );

        }

        return backup;
    },

    load() {

        const raw =
            localStorage.getItem(
                "mara_os_backup"
            );

        if (!raw) {
            return null;
        }

        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

};