"use strict";

/* =====================================================
   MARA OS — MASTER SCRIPT
   Semua fungsi utama MARA OS
===================================================== */


/* =====================================================
   1. HELPER
===================================================== */

const $ = (selector) =>
    document.querySelector(selector);

const $$ = (selector) =>
    document.querySelectorAll(selector);


/* =====================================================
   2. MARA OS STATE
===================================================== */

const MARA = {

    currentScreen: "home",

    pin: "",

    correctPIN: "1234",

    battery: null,

    controlCenterOpen: false

};


/* =====================================================
   3. CLOCK
===================================================== */

function updateClock() {

    const now = new Date();

    const hours =
        String(now.getHours()).padStart(2, "0");

    const minutes =
        String(now.getMinutes()).padStart(2, "0");

    const time =
        `${hours}:${minutes}`;

    const clock =
        $("#clock");

    const lockClock =
        $("#lock-clock");

    const homeTime =
        $("#home-time");

    const statusTime =
        $("#status-time");

    if (clock) {
        clock.textContent = time;
    }

    if (lockClock) {
        lockClock.textContent = time;
    }

    if (homeTime) {
        homeTime.textContent = time;
    }

    if (statusTime) {
        statusTime.textContent = time;
    }

}


/* Jalankan langsung */

updateClock();


/* Update setiap detik */

setInterval(
    updateClock,
    1000
);


/* =====================================================
   4. DATE
===================================================== */

function updateDate() {

    const dateElement =
        $("#lock-date");

    if (!dateElement) {
        return;
    }

    const now = new Date();

    const options = {

        weekday: "long",

        day: "numeric",

        month: "long",

        year: "numeric"

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


/* =====================================================
   5. BATTERY
===================================================== */

async function initBattery() {

    const batteryPercent =
        $("#battery-percent");

    const batteryLevel =
        $("#battery-level");

    const batteryIcon =
        $("#battery-icon");

    try {

        if (
            !("getBattery" in navigator)
        ) {

            showBatteryUnavailable();

            return;

        }

        const battery =
            await navigator.getBattery();

        MARA.battery =
            battery;

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

        console.error(
            "Battery API error:",
            error
        );

        showBatteryUnavailable();

    }


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


    function updateBattery(
        battery
    ) {

        const percent =
            Math.round(
                battery.level * 100
            );

        if (batteryPercent) {

            batteryPercent.textContent =
                `${percent}%`;

        }

        if (batteryLevel) {

            batteryLevel.style.width =
                `${percent}%`;

        }


        if (batteryIcon) {

            if (battery.charging) {

                batteryIcon.textContent =
                    "⚡";

            } else if (percent <= 15) {

                batteryIcon.textContent =
                    "🪫";

            } else {

                batteryIcon.textContent =
                    "🔋";

            }

        }

    }

}


initBattery();


/* =====================================================
   6. SCREEN SYSTEM
===================================================== */

function showScreen(
    screenName
) {

    const screens =
        $$(".mara-screen");

    screens.forEach(
        screen => {

            screen.classList.remove(
                "active"
            );

            screen.setAttribute(
                "aria-hidden",
                "true"
            );

        }
    );


    const target =
        document.querySelector(
            `[data-screen="${screenName}"]`
        );


    if (!target) {

        console.warn(
            "Screen tidak ditemukan:",
            screenName
        );

        return;

    }


    target.classList.add(
        "active"
    );

    target.setAttribute(
        "aria-hidden",
        "false"
    );


    MARA.currentScreen =
        screenName;


    console.log(
        "MARA Screen:",
        screenName
    );

}


/* =====================================================
   7. UNLOCK SCREEN
===================================================== */

function openUnlockPanel() {

    const panel =
        $("#unlock-panel");

    if (!panel) {
        return;
    }

    panel.classList.add(
        "active"
    );

    panel.setAttribute(
        "aria-hidden",
        "false"
    );

    MARA.pin = "";

    updatePIN();

}


/* Tutup PIN */

function closeUnlockPanel() {

    const panel =
        $("#unlock-panel");

    if (!panel) {
        return;
    }

    panel.classList.remove(
        "active"
    );

    panel.setAttribute(
        "aria-hidden",
        "true"
    );

    MARA.pin = "";

    updatePIN();

}


/* =====================================================
   8. PIN SYSTEM
===================================================== */

function addPIN(
    number
) {

    if (
        MARA.pin.length >= 4
    ) {
        return;
    }


    MARA.pin +=
        String(number);


    updatePIN();


    if (
        MARA.pin.length === 4
    ) {

        setTimeout(
            checkPIN,
            180
        );

    }

}


/* =====================================================
   9. UPDATE PIN INDICATOR
===================================================== */

function updatePIN() {

    const indicators =
        $$("#pin-indicators span");


    indicators.forEach(
        (indicator, index) => {

            indicator.classList.toggle(
                "active",
                index <
                MARA.pin.length
            );

        }
    );

}


/* =====================================================
   10. CHECK PIN
===================================================== */

function checkPIN() {

    if (
        MARA.pin ===
        MARA.correctPIN
    ) {

        unlockMARA();

        return;

    }


    shakePIN();


    setTimeout(
        () => {

            MARA.pin = "";

            updatePIN();

        },
        400
    );

}


/* =====================================================
   11. PIN ERROR ANIMATION
===================================================== */

function shakePIN() {

    const panel =
        $(".unlock-panel-content");


    if (!panel) {
        return;
    }


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
                    "translateX(-6px)"
            },

            {
                transform:
                    "translateX(6px)"
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


/* =====================================================
   12. UNLOCK MARA
===================================================== */

function unlockMARA() {

    closeUnlockPanel();


    const lockScreen =
        $(".mara-lock-screen");


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
                    "ease-in",

                fill:
                    "forwards"

            }

        );

    }


    setTimeout(
        () => {

            showScreen(
                "home"
            );

        },
        350
    );

}


/* =====================================================
   13. PIN BUTTONS
===================================================== */

$$("[data-pin]").forEach(
    button => {

        button.addEventListener(
            "click",
            () => {

                addPIN(
                    button.dataset.pin
                );

            }
        );

    }
);


/* =====================================================
   14. UNLOCK BUTTON
===================================================== */

const unlockArea =
    $("#unlock-area");


if (unlockArea) {

    unlockArea.addEventListener(
        "click",
        openUnlockPanel
    );

}


/* =====================================================
   15. CANCEL PIN
===================================================== */

const pinCancel =
    $("#pin-cancel");


if (pinCancel) {

    pinCancel.addEventListener(
        "click",
        closeUnlockPanel
    );

}


/* =====================================================
   16. KEYBOARD
===================================================== */

document.addEventListener(
    "keydown",
    event => {

        if (
            /^[0-9]$/.test(
                event.key
            )
        ) {

            addPIN(
                event.key
            );

        }


        if (
            event.key ===
            "Escape"
        ) {

            closeUnlockPanel();

        }

    }
);


/* =====================================================
   17. APP SEARCH
===================================================== */

const searchInput =
    $("#app-search");

const searchResults =
    $("#search-results");


function searchApps() {

    if (!searchInput) {
        return;
    }


    const query =
        searchInput.value
            .toLowerCase()
            .trim();


    const apps =
        $$(".app");


    if (!query) {

        apps.forEach(
            app => {

                app.style.display =
                    "";

            }
        );


        if (searchResults) {

            searchResults.classList.remove(
                "active"
            );

            searchResults.innerHTML =
                "";

        }

        return;

    }


    let found = 0;


    if (searchResults) {

        searchResults.innerHTML =
            "";

    }


    apps.forEach(
        app => {

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
                            "div"
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

        }
    );


    if (
        searchResults
    ) {

        if (!found) {

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


        searchResults.classList.add(
            "active"
        );

    }

}


if (searchInput) {

    searchInput.addEventListener(
        "input",
        searchApps
    );

}


/* =====================================================
   18. OPEN APP
===================================================== */

function openApp(
    appName
) {

    console.log(
        "Membuka aplikasi:",
        appName
    );


    /*
     * Nanti setiap aplikasi
     * dapat diberikan screen
     * masing-masing.
     */


    const appScreen =
        document.querySelector(
            `[data-app="${appName}"]`
        );


    if (appScreen) {

        showScreen(
            appName
        );

        return;

    }


    alert(
        `Membuka ${appName}`
    );

}


/* =====================================================
   19. APP DRAWER
===================================================== */

function openDrawer() {

    const drawer =
        $("#app-drawer");


    if (!drawer) {

        console.log(
            "App Drawer belum tersedia."
        );

        return;

    }


    drawer.classList.add(
        "active"
    );

}


function closeDrawer() {

    const drawer =
        $("#app-drawer");


    if (!drawer) {
        return;
    }


    drawer.classList.remove(
        "active"
    );

}


/* =====================================================
   20. CONTROL CENTER
===================================================== */

function openControlCenter() {

    const overlay =
        $("#controlCenterOverlay");


    if (!overlay) {

        /*
         * Jika menggunakan screen
         * Control Center biasa.
         */

        showScreen(
            "control-center"
        );

        return;

    }


    overlay.classList.add(
        "active"
    );


    MARA.controlCenterOpen =
        true;

}


function closeControlCenter() {

    const overlay =
        $("#controlCenterOverlay");


    if (!overlay) {

        return;

    }


    overlay.classList.remove(
        "active"
    );


    MARA.controlCenterOpen =
        false;

}


/* =====================================================
   21. CONTROL CENTER SWIPE
===================================================== */

let startY = 0;
let currentY = 0;


document.addEventListener(
    "touchstart",
    event => {

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


document.addEventListener(
    "touchmove",
    event => {

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


document.addEventListener(
    "touchend",
    () => {

        const distance =
            currentY - startY;


        /*
         * Swipe dari atas ke bawah
         */

        if (
            startY < 80 &&
            distance > 60 &&
            !MARA.controlCenterOpen
        ) {

            openControlCenter();

        }


        /*
         * Swipe ke atas
         */

        if (
            MARA.controlCenterOpen &&
            distance < -60
        ) {

            closeControlCenter();

        }


        startY = 0;

        currentY = 0;

    },
    {
        passive: true
    }
);


/* =====================================================
   22. QUICK CONTROL
===================================================== */

function toggleQuick(
    button
) {

    if (!button) {
        return;
    }


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


/* =====================================================
   23. BRIGHTNESS
===================================================== */

const brightness =
    $("#brightness");

const brightnessValue =
    $("#brightness-value");


if (brightness) {

    brightness.addEventListener(
        "input",
        () => {

            const value =
                brightness.value;


            if (brightnessValue) {

                brightnessValue.textContent =
                    `${value}%`;

            }

        }
    );

}


/* =====================================================
   24. VOLUME
===================================================== */

const volume =
    $("#volume");

const volumeValue =
    $("#volume-value");


if (volume) {

    volume.addEventListener(
        "input",
        () => {

            const value =
                volume.value;


            if (volumeValue) {

                volumeValue.textContent =
                    `${value}%`;

            }

        }
    );

}


/* =====================================================
   25. BACK BUTTON
===================================================== */

function goBack() {

    if (
        MARA.controlCenterOpen
    ) {

        closeControlCenter();

        return;

    }


    showScreen(
        "home"
    );

}


/* =====================================================
   26. QUICK ACTIONS
===================================================== */

function openCamera() {

    alert(
        "MARA Camera"
    );

}


function openPhone() {

    alert(
        "MARA Phone"
    );

}


function openWifi() {

    alert(
        "Pengaturan Wi-Fi MARA"
    );

}


function openSettings() {

    alert(
        "MARA Settings"
    );

}


function openBattery() {

    if (
        MARA.battery
    ) {

        const percent =
            Math.round(
                MARA.battery.level *
                100
            );


        alert(
            `Baterai MARA: ${percent}%`
        );

    } else {

        alert(
            "Informasi baterai tidak tersedia."
        );

    }

}


function openSecurity() {

    alert(
        "MARA Security\n\nPerangkat terlindungi."
    );

}


function editControls() {

    alert(
        "Mode Edit Control Center."
    );

}


/* =====================================================
   27. TOUCH FEEDBACK
===================================================== */

$$(
    ".app, .dock-app, .quick-button"
).forEach(
    element => {

        element.addEventListener(
