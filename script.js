"use strict";

/* =========================================
   MARA OS - SCRIPT
========================================= */


/* =========================================
   JAM
========================================= */

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


updateClock();


setInterval(
    updateClock,
    1000
);


/* =========================================
   BATTERY ELEMENT
========================================= */

const batteryPercent =
    document.getElementById(
        "battery-percent"
    );

const batteryLevel =
    document.getElementById(
        "battery-level"
    );


/* =========================================
   UPDATE BATTERY
========================================= */

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


/* =========================================
   BATTERY API
========================================= */

if (
    "getBattery" in navigator
) {

    navigator.getBattery()

        .then(
            function (battery) {

                updateBattery(
                    battery
                );


                battery.addEventListener(
                    "levelchange",
                    function () {

                        updateBattery(
                            battery
                        );

                    }
                );

            }
        )

        .catch(
            function () {

                if (batteryPercent) {

                    batteryPercent.textContent =
                        "--%";

                }


                if (batteryLevel) {

                    batteryLevel.style.width =
                        "0%";

                }

            }
        );

} else {

    if (batteryPercent) {

        batteryPercent.textContent =
            "--%";

    }


    if (batteryLevel) {

        batteryLevel.style.width =
            "0%";

    }

}


/* =========================================
   ELEMENT MARA
========================================= */

const maraHeader =
    document.querySelector(
        ".mara-header"
    );


const controlCenterOverlay =
    document.querySelector(
        "#controlCenterOverlay"
    );


/* =========================================
   GESTURE HEADER
========================================= */

let startY = 0;

let currentY = 0;

let headerDragging = false;


/* =========================================
   MARA HEADER
   SWIPE DOWN → OPEN
========================================= */

if (maraHeader) {

    maraHeader.addEventListener(
        "touchstart",
        function (event) {

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


            headerDragging =
                true;

        },
        {
            passive: true
        }
    );


    maraHeader.addEventListener(
        "touchmove",
        function (event) {

            if (!headerDragging) {
                return;
            }


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
        function () {

            if (!headerDragging) {
                return;
            }


            const distance =
                currentY - startY;


            /*
             * SWIPE KE BAWAH
             * → BUKA CONTROL CENTER
             */

            if (
                distance >= 60 &&
                controlCenterOverlay
            ) {

                controlCenterOverlay.classList.add(
                    "active"
                );

            }


            startY = 0;

            currentY = 0;

            headerDragging = false;

        },
        {
            passive: true
        }
    );


    maraHeader.addEventListener(
        "touchcancel",
        function () {

            startY = 0;

            currentY = 0;

            headerDragging = false;

        },
        {
            passive: true
        }
    );

}


/* =========================================
   CONTROL CENTER GESTURE
========================================= */

let closeStartY = 0;

let closeCurrentY = 0;

let overlayDragging = false;


/* =========================================
   CONTROL CENTER
   SWIPE UP → CLOSE
========================================= */

if (controlCenterOverlay) {

    controlCenterOverlay.addEventListener(
        "touchstart",
        function (event) {

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


            overlayDragging =
                true;

        },
        {
            passive: true
        }
    );


    controlCenterOverlay.addEventListener(
        "touchmove",
        function (event) {

            if (!overlayDragging) {
                return;
            }


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
        function () {

            if (!overlayDragging) {
                return;
            }


            const distance =
                closeCurrentY -
                closeStartY;


            /*
             * SWIPE KE ATAS
             * → TUTUP CONTROL CENTER
             */

            if (
                distance <= -60
            ) {

                controlCenterOverlay.classList.remove(
                    "active"
                );

            }


            closeStartY = 0;

            closeCurrentY = 0;

            overlayDragging = false;

        },
        {
            passive: true
        }
    );


    controlCenterOverlay.addEventListener(
        "touchcancel",
        function () {

            closeStartY = 0;

            closeCurrentY = 0;

            overlayDragging = false;

        },
        {
            passive: true
        }
    );

}


/* =========================================
   SERVICE WORKER
========================================= */

if (
    "serviceWorker" in navigator
) {

    window.addEventListener(
        "load",
        function () {

            navigator.serviceWorker
                .register(
                    "./service-worker.js"
                )

                .then(
                    function (