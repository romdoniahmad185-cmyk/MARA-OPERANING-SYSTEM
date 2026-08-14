"use strict";


/* =====================================================
   MARA OS — SCRIPT.JS
   Jam + Baterai + Control Center + Service Worker
===================================================== */


/* =====================================================
   JAM
===================================================== */

function updateClock() {

    const clock =
        document.getElementById("clock");

    if (!clock) {
        return;
    }

    const now =
        new Date();

    const hours =
        String(
            now.getHours()
        ).padStart(2, "0");

    const minutes =
        String(
            now.getMinutes()
        ).padStart(2, "0");

    clock.textContent =
        `${hours}:${minutes}`;
}


/* Jalankan langsung */

updateClock();


/* Update setiap detik */

setInterval(
    updateClock,
    1000
);


/* =====================================================
   BATERAI
===================================================== */

const batteryPercent =
    document.getElementById(
        "battery-percent"
    );

const batteryLevel =
    document.getElementById(
        "battery-level"
    );


function updateBattery(
    battery
) {

    if (
        !batteryPercent ||
        !batteryLevel
    ) {
        return;
    }


    const percent =
        Math.round(
            battery.level * 100
        );


    batteryPercent.textContent =
        `${percent}%`;


    batteryLevel.style.width =
        `${percent}%`;
}


/* =====================================================
   BATTERY STATUS API
===================================================== */

function showBatteryUnavailable() {

    if (batteryPercent) {

        batteryPercent.textContent =
            "--%";

    }

    if (batteryLevel) {

        batteryLevel.style.width =
            "0%";

    }
}


if (
    "getBattery" in navigator
) {

    navigator
        .getBattery()
        .then(
            function(battery) {

                /* Tampilkan kondisi awal */

                updateBattery(
                    battery
                );


                /* Saat baterai berubah */

                battery.addEventListener(
                    "levelchange",
                    function() {

                        updateBattery(
                            battery
                        );

                    }
                );

            }
        )
        .catch(
            function() {

                showBatteryUnavailable();

            }
        );

} else {

    /*
     * Chrome/perangkat tertentu
     * tidak menyediakan Battery API.
     */

    showBatteryUnavailable();

}


/* =====================================================
   CONTROL CENTER
===================================================== */

const maraHeader =
    document.querySelector(
        ".mara-header"
    );

const controlCenterOverlay =
    document.getElementById(
        "controlCenterOverlay"
    );


/* Jika elemen belum ada, jangan jalankan gesture */

if (
    maraHeader &&
    controlCenterOverlay
) {


    /* ================================================
       SWIPE DOWN → OPEN
    ================================================= */

    let startY = 0;
    let currentY = 0;


    maraHeader.addEventListener(
        "touchstart",
        function(event) {

            if (
                !event.touches ||
                !event.touches.length
            ) {
                return;
            }


            startY =
                event.touches[0].clientY;

            currentY =
                startY;

        },
        {
            passive: true
        }
    );


    maraHeader.addEventListener(
        "touchmove",
        function(event) {

            if (
                !event.touches ||
                !event.touches.length
            ) {
                return;
            }


            currentY =
                event.touches[0].clientY;

        },
        {
            passive: true
        }
    );


    maraHeader.addEventListener(
        "touchend",
        function() {

            const distance =
                currentY -
                startY;


            if (
                distance > 60
            ) {

                controlCenterOverlay.classList.add(
                    "active"
                );

                controlCenterOverlay.setAttribute(
                    "aria-hidden",
                    "false"
                );

            }


            startY = 0;
            currentY = 0;

        },
        {
            passive: true
        }
    );


    /* ================================================
       SWIPE UP → CLOSE
    ================================================= */

    let closeStartY = 0;
    let closeCurrentY = 0;


    controlCenterOverlay.addEventListener(
        "touchstart",
        function(event) {

            if (
                !event.touches ||
                !event.touches.length
            ) {
                return;
            }


            closeStartY =
                event.touches[0].clientY;

            closeCurrentY =
                closeStartY;

        },
        {
            passive: true
        }
    );


    controlCenterOverlay.addEventListener(
        "touchmove",
        function(event) {

            if (
                !event.touches ||
                !event.touches.length
            ) {
                return;
            }


            closeCurrentY =
                event.touches[0].clientY;

        },
        {
            passive: true
        }
    );


    controlCenterOverlay.addEventListener(
        "touchend",
        function() {

            const distance =
                closeCurrentY -
                closeStartY;


            if (
                distance < -60
            ) {

                controlCenterOverlay.classList.remove(
                    "active"
                );

                controlCenterOverlay.setAttribute(
                    "aria-hidden",
                    "true"
                );

            }


            closeStartY = 0;
            closeCurrentY = 0;

        },
        {
            passive: true
        }
    );

}


/* =====================================================
   SERVICE WORKER
===================================================== */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        function() {

            navigator.serviceWorker
                .register(
                    "./service-worker.js",
                    {
                        scope: "./"
                    }
                )
                .then(
                    function(registration) {

                        console.log(
                            "MARA OS Service Worker aktif:",
                            registration.scope
                        );

                    }
                )
                .catch(
                    function(error) {

                        console.error(
                            "MARA OS Service Worker gagal:",
                            error
                        );

                    }
                );

        }
    );

}