document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const deleteBtn = document.getElementById("delete-last-btn");
    if (deleteBtn) {
        deleteBtn.addEventListener("click", function handleDeleteClick(event) {
            const target = event.currentTarget;
            const commentId = target.getAttribute("data-comment-id");
            if (confirm("Are you sure you want to delete this comment?")) {
                const formData = new FormData();

                const csrfSelector = "[name=csrfmiddlewaretoken]";
                const csrfTokenEl = document.querySelector(csrfSelector);
                if (!csrfTokenEl) {
                    return;
                }

                formData.append("csrfmiddlewaretoken", csrfTokenEl.value);
                formData.append("comment_id", commentId);

                fetch("/delete-comment/", {
                    body: formData,
                    headers: { "X-Requested-With": "XMLHttpRequest" },
                    method: "POST"
                }).then(function (response) {
                    if (response.ok) {
                        window.location.reload();
                    } else {
                        const status = response.status;
                        console.error("Delete failed with status:", status);
                    }
                }).catch(function (error) {
                    console.error("Delete error:", error);
                });
            }
        });
    }

    // Edit button functionality
    const editBtn = document.getElementById("edit-last-btn");
    if (editBtn) {
        editBtn.addEventListener("click", function handleEditClick(event) {
            const target = event.currentTarget;
            const commentId = target.getAttribute("data-comment-id");
            const textInput = document.getElementById("id_text");
            if (!textInput) {
                return;
            }

            const singleCommentSel = ".single-comment";
            const commentElements = document.querySelectorAll(singleCommentSel);
            let commentText = "";

            commentElements.forEach(function (el) {
                if (el.getAttribute("data-comment-id") === commentId) {
                    const fullText = el.textContent.trim();
                    const parts = fullText.split(":");
                    const joined = parts.slice(1).join(":");
                    commentText = joined.trim();
                }
            });

            textInput.value = commentText;
            textInput.focus();

            let editInput = document.getElementById("edit_comment_id");
            if (!editInput) {
                editInput = document.createElement("input");
                editInput.type = "hidden";
                editInput.name = "edit_comment_id";
                editInput.id = "edit_comment_id";
                const form = document.getElementById("comment-form");
                if (form) {
                    form.appendChild(editInput);
                }
            }

            editInput.value = commentId;

            const commentBtn = document.getElementById("comment-btn");
            if (commentBtn) {
                commentBtn.textContent = "Update Comment";
            }
        });
    }
});