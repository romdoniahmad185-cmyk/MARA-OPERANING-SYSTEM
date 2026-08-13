/* =========================
   JAM
========================= */

function updateClock() {

    const clock =
        document.getElementById("clock");

    const now = new Date();

    const hours =
        String(now.getHours()).padStart(2, "0");

    const minutes =
        String(now.getMinutes()).padStart(2, "0");

    clock.textContent =
        `${hours}:${minutes}`;
}

updateClock();

setInterval(updateClock, 1000);


/* =========================
   BATTERY
========================= */

const batteryPercent =
    document.getElementById("battery-percent");

const batteryLevel =
    document.getElementById("battery-level");


function updateBattery(battery) {

    const percent =
        Math.round(battery.level * 100);

    batteryPercent.textContent =
        `${percent}%`;

    batteryLevel.style.width =
        `${percent}%`;
}


/* =========================
   BATTERY API
========================= */

if ("getBattery" in navigator) {

    navigator.getBattery()
        .then(function (battery) {

            updateBattery(battery);

            battery.addEventListener(
                "levelchange",
                function () {
                    updateBattery(battery);
                }
            );

        })
        .catch(function () {

            batteryPercent.textContent = "--%";
            batteryLevel.style.width = "0%";

        });

} else {

    batteryPercent.textContent = "--%";
    batteryLevel.style.width = "0%";
}

"use strict";

const maraHeader =
    document.querySelector(".mara-header");

const controlCenterOverlay =
    document.querySelector("#controlCenterOverlay");

let startY = 0;
let currentY = 0;


/* =====================================
   MARA HEADER
   SWIPE DOWN → OPEN
===================================== */

maraHeader.addEventListener(
    "touchstart",
    function (event) {

        startY =
            event.touches[0].clientY;

        currentY = startY;
    },
    { passive: true }
);


maraHeader.addEventListener(
    "touchmove",
    function (event) {

        currentY =
            event.touches[0].clientY;
    },
    { passive: true }
);


maraHeader.addEventListener(
    "touchend",
    function () {

        const distance =
            currentY - startY;

        if (distance > 60) {

            controlCenterOverlay.classList.add(
                "active"
            );
        }

        startY = 0;
        currentY = 0;
    },
    { passive: true }
);


/* =====================================
   CONTROL CENTER OVERLAY
   SWIPE UP → CLOSE
===================================== */

let closeStartY = 0;
let closeCurrentY = 0;


controlCenterOverlay.addEventListener(
    "touchstart",
    function (event) {

        closeStartY =
            event.touches[0].clientY;

        closeCurrentY =
            closeStartY;
    },
    { passive: true }
);


controlCenterOverlay.addEventListener(
    "touchmove",
    function (event) {

        closeCurrentY =
            event.touches[0].clientY;
    },
    { passive: true }
);


controlCenterOverlay.addEventListener(
    "touchend",
    function () {

        const distance =
            closeCurrentY - closeStartY;

        if (distance < -60) {

            controlCenterOverlay.classList.remove(
                "active"
            );
        }

        closeStartY = 0;
        closeCurrentY = 0;
    },
    { passive: true }
);
const manifest =
    document.createElement("link");

manifest.rel = "manifest";
manifest.href = "./manifest.json";

document.head.appendChild(manifest);
if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js");
}