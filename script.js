"use strict";

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