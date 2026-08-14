"use strict";

/* =========================================================
MARA OS — UNIFIED SCRIPT
Semua layar dikendalikan dari satu index.html
========================================================= */

/* =========================================================
HELPER
========================================================= */

function $(selector) {
return document.querySelector(selector);
}

function $$(selector) {
return document.querySelectorAll(selector);
}

/* =========================================================
SCREEN SYSTEM
========================================================= */

const screens = {
splash: "#splash-screen",
lock: "#lock-screen",
home: "#home-screen",
control: "#control-center"
};

function showScreen(name) {

Object.values(screens).forEach(selector => {

    const screen = $(selector);

    if (!screen) return;

    screen.classList.remove("active");

});


const target = $(screens[name]);

if (!target) {

    console.warn(
        "MARA: layar tidak ditemukan:",
        name
    );

    return;
}


target.classList.add("active");

console.log(
    "MARA: membuka layar",
    name
);

}

/* =========================================================
INITIAL SCREEN
========================================================= */

function initializeMARA() {

showScreen("splash");

setTimeout(() => {

    showScreen("lock");

}, 1200);

}

/* =========================================================
GLOBAL CLOCK
========================================================= */

function updateAllClocks() {

const now = new Date();

const hours =
    String(now.getHours()).padStart(2, "0");

const minutes =
    String(now.getMinutes()).padStart(2, "0");

const time =
    `${hours}:${minutes}`;


const clockElements = [

    "#lock-clock",
    "#status-time",
    "#home-time",
    "#control-time"

];


clockElements.forEach(selector => {

    const element = $(selector);

    if (element) {

        element.textContent = time;

    }

});

}

updateAllClocks();

setInterval(
updateAllClocks,
1000
);

/* =========================================================
DATE
========================================================= */

function updateDate() {

const dateElement =
    $("#lock-date");

if (!dateElement) return;


const now = new Date();


const options = {

    weekday: "long",
    day: "numeric",
    month: "long"

};


dateElement.textContent =
    now.toLocaleDateString(
        "id-ID",
        options
    );

}

updateDate();

setInterval(
updateDate,
60000
);

/* =========================================================
BATTERY
========================================================= */

const batteryPercent =
$("#battery-percent");

const batteryLevel =
$("#battery-level");

function updateBattery(battery) {

const percent =
    Math.round(
        battery.level * 100
    );


$$("[data-battery-percent]")
    .forEach(element => {

        element.textContent =
            `${percent}%`;

    });


if (batteryPercent) {

    batteryPercent.textContent =
        `${percent}%`;

}


if (batteryLevel) {

    batteryLevel.style.width =
        `${percent}%`;

}


$$("[data-battery-level]")
    .forEach(element => {

        element.style.width =
            `${percent}%`;

    });

}

async function initializeBattery() {

if (
    !("getBattery" in navigator)
) {

    $$("[data-battery-percent]")
        .forEach(element => {

            element.textContent =
                "--%";

        });

    return;

}


try {

    const battery =
        await navigator.getBattery();


    updateBattery(
        battery
    );


    battery.addEventListener(
        "levelchange",
        () => {

            updateBattery(
                battery
            );

        }
    );


    battery.addEventListener(
        "chargingchange",
        () => {

            updateBattery(
                battery
            );

        }
    );


} catch (error) {

    console.warn(
        "MARA: Battery API tidak tersedia",
        error
    );

}

}

initializeBattery();

/* =========================================================
LOCK SCREEN
========================================================= */

const unlockArea =
$("#unlock-area");

const unlockPanel =
$("#unlock-panel");

const pinCancel =
$("#pin-cancel");

function openUnlockPanel() {

if (!unlockPanel) return;


unlockPanel.classList.add(
    "active"
);


unlockPanel.setAttribute(
    "aria-hidden",
    "false"
);


resetPIN();

}

function closeUnlockPanel() {

if (!unlockPanel) return;


unlockPanel.classList.remove(
    "active"
);


unlockPanel.setAttribute(
    "aria-hidden",
    "true"
);


resetPIN();

}

if (unlockArea) {

unlockArea.addEventListener(
    "click",
    openUnlockPanel
);

}

if (pinCancel) {

pinCancel.addEventListener(
    "click",
    closeUnlockPanel
);

}

/* =========================================================
PIN SYSTEM
========================================================= */

const CORRECT_PIN = "1234";

let enteredPIN = "";

const pinButtons =
$$("[data-pin]");

const pinIndicators =
$$("#pin-indicators span");

pinButtons.forEach(button => {

button.addEventListener(
    "click",
    () => {

        if (
            enteredPIN.length >=
            CORRECT_PIN.length
        ) {

            return;

        }


        enteredPIN +=
            button.dataset.pin;


        updatePINIndicators();


        if (
            enteredPIN.length ===
            CORRECT_PIN.length
        ) {

            setTimeout(
                checkPIN,
                180
            );

        }

    }
);

});

function updatePINIndicators() {

pinIndicators.forEach(
    (indicator, index) => {

        indicator.classList.toggle(
            "active",
            index <
            enteredPIN.length
        );

    }
);

}

function resetPIN() {

enteredPIN = "";

updatePINIndicators();

}

function checkPIN() {

if (
    enteredPIN ===
    CORRECT_PIN
) {

    unlockMARA();

} else {

    shakePIN();

    setTimeout(
        resetPIN,
        400
    );

}

}

function shakePIN() {

const panel =
    $(".unlock-panel-content");

if (!panel) return;


panel.animate(

    [

        {
            transform:
                "translateX(0)"
        },

        {
            transform:
                "translateX(-8px)"
        },

        {
            transform:
                "translateX(8px)"
        },

        {
            transform:
                "translateX(-5px)"
        },

        {
            transform:
                "translateX(5px)"
        },

        {
            transform:
                "translateX(0)"
        }

    ],

    {
        duration: 250
    }

);

}

/* =========================================================
UNLOCK MARA
========================================================= */

function unlockMARA() {

if (unlockPanel) {

    unlockPanel.classList.remove(
        "active"
    );

}


const lockScreen =
    $("#lock-screen");


if (lockScreen) {

    lockScreen.animate(

        [

            {
                opacity: 1,
                transform:
                    "scale(1)"
            },

            {
                opacity: 0,
                transform:
                    "scale(1.04)"
            }

        ],

        {

            duration: 350,

            easing:
                "ease-in"

        }

    );

}


setTimeout(() => {

    showScreen("home");

}, 300);

}

/* =========================================================
KEYBOARD PIN
========================================================= */

document.addEventListener(
"keydown",
event => {

    if (
        /^[0-9]$/.test(
            event.key
        )
    ) {

        const button =
            $(
                `[data-pin="${event.key}"]`
            );


        if (button) {

            button.click();

        }

    }


    if (
        event.key ===
        "Escape"
    ) {

        closeUnlockPanel();

        closeControlCenter();

    }

}

);

/* =========================================================
HOME SEARCH
========================================================= */

const searchInput =
$("#app-search");

const searchResults =
$("#search-results");

function initializeSearch() {

if (!searchInput) return;


searchInput.addEventListener(
    "input",
    function() {

        const query =
            this.value
                .toLowerCase()
                .trim();


        const apps =
            $$(".app");


        if (!query) {

            if (searchResults) {

                searchResults.classList.remove(
                    "active"
                );

                searchResults.innerHTML =
                    "";

            }


            apps.forEach(app => {

                app.style.display =
                    "";

            });


            return;

        }


        let found = 0;


        if (searchResults) {

            searchResults.innerHTML =
                "";

        }


        apps.forEach(app => {

            const name =
                (
                    app.dataset.name ||
                    ""
                ).toLowerCase();


            if (
                name.includes(query)
            ) {

                app.style.display =
                    "";

                found++;


                if (searchResults) {

                    const result =
                        document.createElement(
                            "button"
                        );


                    result.className =
                        "search-result";


                    result.textContent =
                        app.dataset.name;


                    result.addEventListener(
                        "click",
                        () => {

                            openApp(
                                app.dataset.name
                            );

                        }
                    );


                    searchResults.appendChild(
                        result
                    );

                }

            } else {

                app.style.display =
                    "none";

            }

        });


        if (
            found === 0 &&
            searchResults
        ) {

            const empty =
                document.createElement(
                    "div"
                );


            empty.className =
                "search-result";


            empty.textContent =
                "Aplikasi tidak ditemukan";


            searchResults.appendChild(
                empty
            );

        }


        if (searchResults) {

            searchResults.classList.add(
                "active"
            );

        }

    }
);

}

initializeSearch();

/* =========================================================
OPEN APPLICATION
========================================================= */

function openApp(appName) {

console.log(
    "MARA: membuka aplikasi",
    appName
);


/*
   Nanti setiap aplikasi dapat
   dihubungkan ke layar / modulnya
   sendiri.

   Contoh:

   Rama
   VexaCut
   Maps
   Web
   Remail
   Storage
   Berita
   Rama School
   Game Store
   Settings
*/


alert(
    "Membuka " +
    appName
);

}

/* =========================================================
APP DRAWER
========================================================= */

function openDrawer() {

console.log(
    "MARA: membuka App Drawer"
);


const drawer =
    $("#app-drawer");


if (drawer) {

    drawer.classList.add(
        "active"
    );

} else {

    alert(
        "App Drawer MARA OS"
    );

}

}

function closeDrawer() {

const drawer =
    $("#app-drawer");


if (drawer) {

    drawer.classList.remove(
        "active"
    );

}

}

/* =========================================================
CONTROL CENTER
========================================================= */

const controlCenter =
$("#control-center");

function openControlCenter() {

if (!controlCenter) return;


controlCenter.classList.add(
    "active"
);


controlCenter.setAttribute(
    "aria-hidden",
    "false"
);

}

function closeControlCenter() {

if (!controlCenter) return;


controlCenter.classList.remove(
    "active"
);


controlCenter.setAttribute(
    "aria-hidden",
    "true"
);

}

/* =========================================================
CONTROL CENTER SWIPE
========================================================= */

let touchStartY = 0;

let touchCurrentY = 0;

document.addEventListener(
"touchstart",
event => {

    if (
        !event.touches.length
    ) {

        return;

    }


    touchStartY =
        event.touches[0].clientY;


    touchCurrentY =
        touchStartY;

},
{
    passive: true
}

);

document.addEventListener(
"touchmove",
event => {

    if (
        !event.touches.length
    ) {

        return;

    }


    touchCurrentY =
        event.touches[0].clientY;

},
{
    passive: true
}

);

document.addEventListener(
"touchend",
() => {

    const distance =
        touchCurrentY -
        touchStartY;


    /*
       Swipe dari bagian paling atas
       ke bawah = buka Control Center
    */

    if (
        touchStartY < 80 &&
        distance > 70 &&
        !controlCenter?.classList.contains(
            "active"
        )
    ) {

        openControlCenter();

    }


    /*
       Swipe ke atas ketika Control Center
       sedang terbuka = tutup
    */

    if (
        distance < -70 &&
        controlCenter?.classList.contains(
            "active"
        )
    ) {

        closeControlCenter();

    }


    touchStartY = 0;

    touchCurrentY = 0;

},
{
    passive: true
}

);

/* =========================================================
CONTROL CENTER QUICK TOGGLE
========================================================= */

function toggleQuick(button) {

if (!button) return;


button.classList.toggle(
    "active"
);


const control =
    button.dataset.control;


const active =
    button.classList.contains(
        "active"
    );


console.log(
    "MARA Control:",
    control,
    active
);


if (
    control === "wifi"
) {

    const status =
        $("#connection-status");


    if (status) {

        status.textContent =
            active
                ? "Terhubung ke jaringan"
                : "Wi-Fi dimatikan";

    }

}

}

/* =========================================================
BRIGHTNESS
========================================================= */

const brightness =
$("#brightness");

const brightnessValue =
$("#brightness-value");

if (brightness) {

brightness.addEventListener(
    "input",
    function() {

        if (brightnessValue) {

            brightnessValue.textContent =
                `${this.value}%`;

        }


        /*
           Catatan:
           Browser tidak mengizinkan
           PWA mengubah brightness
           perangkat secara langsung.
        */

    }
);

}

/* =========================================================
VOLUME
========================================================= */

const volume =
$("#volume");

const volumeValue =
$("#volume-value");

if (volume) {

volume.addEventListener(
    "input",
    function() {

        if (volumeValue) {

            volumeValue.textContent =
                `${this.value}%`;

        }

    }
);

}

/* =========================================================
CONTROL CENTER BUTTONS
========================================================= */

function openWifi() {

alert(
    "Pengaturan Wi-Fi MARA"
);

}

function editControls() {

alert(
    "Mode edit Control Center akan tersedia."
);

}

function openSettings() {

openApp(
    "Pengaturan"
);

}

function openBattery() {

alert(
    "Membuka informasi baterai"
);

}

function openSecurity() {

alert(
    "MARA Security\n\nPerangkat terlindungi."
);

}

/* =========================================================
BACK BUTTON
========================================================= */

function goBack() {

if (
    controlCenter?.classList.contains(
        "active"
    )
) {

    closeControlCenter();

    return;

}


if (
    $(".unlock-panel")?.classList.contains(
        "active"
    )
) {

    closeUnlockPanel();

    return;

}


showScreen("home");

}

/* =========================================================
QUICK ACTION LOCK SCREEN
========================================================= */

const cameraButton =
$("#camera-button");

const phoneButton =
$("#phone-button");

if (cameraButton) {

cameraButton.addEventListener(
    "click",
    () => {

        alert(
            "MARA Camera"
        );

    }
);

}

if (phoneButton) {

phoneButton.addEventListener(
    "click",
    () => {

        alert(
            "MARA Phone"
        );

    }
);

}

/* =========================================================
ALL APPS
========================================================= */

const allApps =
$("#all-apps");

if (allApps) {

allApps.addEventListener(
    "click",
    openDrawer
);

}

/* =========================================================
PREVENT CONTEXT MENU
========================================================= */

document.addEventListener(
"contextmenu",
event => {

    event.preventDefault();

}

);

/* =========================================================
PREVENT DOUBLE TAP ZOOM
========================================================= */

let lastTouchEnd = 0;

document.addEventListener(
"touchend",
event => {

    const now =
        Date.now();


    if (
        now - lastTouchEnd <= 300
    ) {

        event.preventDefault();

    }


    lastTouchEnd = now;

},
{
    passive: false
}

);

/* =========================================================
SERVICE WORKER
========================================================= */

if (
"serviceWorker" in navigator
) {

window.addEventListener(
    "load",
    () => {

        navigator.serviceWorker
            .register(
                "./service-worker.js"
            )
            .then(
                registration => {

                    console.log(
                        "MARA SW aktif:",
                        registration.scope
                    );

                }
            )
            .catch(
                error => {

                    console.error(
                        "MARA SW gagal:",
                        error
                    );

                }
            );

    }
);

}

/* =========================================================
START MARA
========================================================= */

document.addEventListener(
"DOMContentLoaded",
() => {

    initializeMARA();

}

);