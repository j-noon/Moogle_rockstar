document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  // ---------- helpers ----------
  function getCsrfToken() {
    const el = document.querySelector("[name=csrfmiddlewaretoken]");
    return el ? el.value : null;
  }

  function confirmAndDelete(commentId) {
    if (!commentId) return;
    if (!confirm("Are you sure you want to delete this comment?")) return;

    const csrf = getCsrfToken();
    if (!csrf) return;

    const formData = new FormData();
    formData.append("csrfmiddlewaretoken", csrf);
    formData.append("comment_id", commentId);

    fetch("/delete-comment/", {
      body: formData,
      headers: { "X-Requested-With": "XMLHttpRequest" },
      method: "POST"
    })
      .then(function (response) {
        if (response.ok) {
          window.location.reload();
        } else {
          const status = response.status;
          console.error("Delete failed with status:", status);
          if (status === 403) alert("You can only delete your own comments.");
        }
      })
      .catch(function (error) {
        console.error("Delete error:", error);
      });
  }

  // Grab just the comment text (exclude username + action buttons)
  function extractCommentTextById(commentId) {
    const el = document.querySelector(`.single-comment[data-comment-id="${commentId}"]`);
    if (!el) return "";

    // Preferred: if you add <span class="comment-body">...</span> around the text,
    // we’ll use it automatically.
    const body = el.querySelector(".comment-body");
    if (body) return body.innerText.trim();

    // Fallback: clone, remove username + actions, then read text
    const clone = el.cloneNode(true);
    const strong = clone.querySelector("strong");
    if (strong) strong.remove();
    const actions = clone.querySelector(".comment-actions");
    if (actions) actions.remove();

    // Now only the raw comment text remains
    return clone.textContent.trim();
  }

  function startEdit(commentId) {
    const textInput = document.getElementById("id_text");
    if (!textInput || !commentId) return;

    const commentText = extractCommentTextById(commentId);
    textInput.value = commentText;
    textInput.focus();

    let editInput = document.getElementById("edit_comment_id");
    if (!editInput) {
      editInput = document.createElement("input");
      editInput.type = "hidden";
      editInput.name = "edit_comment_id";
      editInput.id = "edit_comment_id";
      const form = document.getElementById("comment-form");
      if (form) form.appendChild(editInput);
    }
    editInput.value = commentId;

    const commentBtn = document.getElementById("comment-btn");
    if (commentBtn) commentBtn.textContent = "Update Comment";
  }

  // ---------- existing "Delete Last" ----------
  const deleteBtn = document.getElementById("delete-last-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function handleDeleteClick(event) {
      const target = event.currentTarget;
      const commentId = target.getAttribute("data-comment-id");
      if (confirm("Are you sure you want to delete this comment?")) {
        const formData = new FormData();

        const csrfSelector = "[name=csrfmiddlewaretoken]";
        const csrfTokenEl = document.querySelector(csrfSelector);
        if (!csrfTokenEl) return;

        formData.append("csrfmiddlewaretoken", csrfTokenEl.value);
        formData.append("comment_id", commentId);

        fetch("/delete-comment/", {
          body: formData,
          headers: { "X-Requested-With": "XMLHttpRequest" },
          method: "POST"
        })
          .then(function (response) {
            if (response.ok) {
              window.location.reload();
            } else {
              const status = response.status;
              console.error("Delete failed with status:", status);
            }
          })
          .catch(function (error) {
            console.error("Delete error:", error);
          });
      }
    });
  }

  // ---------- existing "Edit Last" ----------
  const editBtn = document.getElementById("edit-last-btn");
  if (editBtn) {
    editBtn.addEventListener("click", function handleEditClick(event) {
      const target = event.currentTarget;
      const commentId = target.getAttribute("data-comment-id");
      startEdit(commentId);
    });
  }

  // ---------- NEW: per-comment buttons via delegation ----------
  const feed = document.getElementById("comment-feed");
  if (feed) {
    feed.addEventListener("click", function (e) {
      const target = e.target;

      if (target.classList.contains("comment-delete-btn")) {
        const commentId = target.getAttribute("data-comment-id");
        confirmAndDelete(commentId);
        return;
      }

      if (target.classList.contains("comment-edit-btn")) {
        const commentId = target.getAttribute("data-comment-id");
        startEdit(commentId);
        return;
      }
    });
  }
});