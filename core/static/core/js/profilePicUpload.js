document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const openBtn = document.getElementById("openProfilePicModal");
    const modal = document.getElementById("profilePicModal");
    const closeBtn = document.getElementById("closeModalBtn");
    const form = document.getElementById("profilePicForm");
    const currentPic = document.getElementById("currentProfilePic");

    if (!openBtn || !modal || !closeBtn || !form || !currentPic) {
        return;
    }

    // Open/close modal
    openBtn.addEventListener("click", function () {
        modal.style.display = "block";
    });

    closeBtn.addEventListener("click", function () {
        modal.style.display = "none";
    });

    function getCookie(name) {
        var cookieValue = null;
        var cookies;
        var i;
        var nlen;
        var cookie;

        if (document.cookie && document.cookie !== "") {
            cookies = document.cookie.split(";");
            i = 0;
            nlen = cookies.length;
            while (i < nlen) {
                cookie = cookies[i].trim();
                if (cookie.indexOf(name + "=") === 0) {
                    cookieValue = decodeURIComponent(
                        cookie.substring(name.length + 1)
                    );
                    break;
                }
                i += 1;
            }
        }
        return cookieValue;
    }

    form.addEventListener("submit", function (e) {
        var canAjax = typeof window.fetch === "function";
        var url;
        var fd;

        if (!canAjax) {
            return;
        }

        e.preventDefault();

        url = form.dataset.uploadUrl || form.action;
        fd = new FormData(form);

        window.fetch(url, {
            body: fd, // ordered before method per JSLint rule
            headers: {
                "X-CSRFToken": getCookie("csrftoken"),
                "X-Requested-With": "XMLHttpRequest"
            },
            method: "POST"
        }).then(function (res) {
            var ctype = res.headers.get("content-type") || "";
            if (ctype.indexOf("application/json") === -1) {
                window.location.reload();
                return null;
            }
            return res.json().then(function (data) {
                var message; // hoisted
                var bust;    // hoisted

                if (!res.ok) {
                    message = "Upload failed.";
                    if (data && data.errors) {
                        message = JSON.stringify(data.errors);
                    }
                    alert(message);
                    return null;
                }

                if (data.image_url) {
                    // cache-bust the image after successful upload
                    bust = "?v=" + Date.now();
                    currentPic.src = data.image_url + bust;
                    modal.style.display = "none";
                } else {
                    window.location.reload();
                }
                return null;
            });
        }).catch(function () { // removed unused parameter
            alert("Network error uploading image.");
        });
    });
});