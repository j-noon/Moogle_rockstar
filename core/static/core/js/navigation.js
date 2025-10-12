document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const navBtn = document.getElementById("nav-btn");
    const navList = document.getElementById("nav-list");

    if (navBtn && navList) {
        navBtn.addEventListener("click", function () {
            navList.classList.toggle("show");
        });
    }
});