document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const buttons = document.querySelectorAll(".dropbtn");

    // Attach click handlers to each dropdown button
    (function attachHandlers() {
        var i = 0;
        var len = buttons.length;

        while (i < len) {
            buttons[i].addEventListener("click", function (e) {
                // hoisted declarations
                var current;
                var dropdown;
                var allMenus;
                var j = 0;
                var mlen;
                var isOpen;

                e.stopPropagation();

                current = e.currentTarget;
                dropdown = current.nextElementSibling;

                // Close other dropdowns first
                allMenus = document.querySelectorAll(".dropdown-content");
                mlen = allMenus.length;
                while (j < mlen) {
                    if (allMenus[j] !== dropdown) {
                        allMenus[j].style.display = "none";
                    }
                    j += 1;
                }

                // Toggle current dropdown (no ternary to satisfy linter)
                isOpen = dropdown.style.display === "block";
                if (isOpen) {
                    dropdown.style.display = "none";
                } else {
                    dropdown.style.display = "block";
                }
            });
            i += 1;
        }
    }());

    // Click anywhere else closes all dropdowns
    window.addEventListener("click", function (e) {
        // hoisted declarations
        var allMenus;
        var k = 0;
        var glen;

        if (!e.target.matches(".dropbtn")) {
            allMenus = document.querySelectorAll(".dropdown-content");
            glen = allMenus.length;
            while (k < glen) {
                allMenus[k].style.display = "none";
                k += 1;
            }
        }
    });
});