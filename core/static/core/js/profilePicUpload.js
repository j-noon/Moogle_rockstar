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

    function showUploadErrorModal(message) {
        if (typeof window.showUploadError === "function") {
            window.showUploadError(
                message || 'Error: Wrong file type. Please try again with <strong>JPEG</strong> or <strong>PNG</strong>!'
            );
        } else {
            alert(message ? String(message).replace(/<[^>]+>/g, "") : "Upload error");
        }
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

                    showUploadErrorModal(
                        (data && data.errors && data.errors.profile_image && data.errors.profile_image[0]) ||
                        "Error: Wrong file type. Please try again with <strong>JPEG</strong> or <strong>PNG</strong>!"
                    );
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
        }).catch(function () {
            
            showUploadErrorModal("Network error uploading image.");
        });
    });
});