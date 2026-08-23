/* =====================================================
   MARA OS — APP MANAGER
===================================================== */

window.MARAAppManager = {

    registry() {

        return window.MARA_APPS || {};
    },

    get(appId) {

        return this.registry()[appId] || null;
    },

    exists(appId) {

        return !!this.get(appId);
    },

    list() {

        return Object.values(
            this.registry()
        );
    }

};