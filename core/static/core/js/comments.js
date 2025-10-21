document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  // ---------- modal helpers ----------
  const overlay = document.getElementById("modal-overlay");
  const titleEl = document.getElementById("modal-title");
  const descEl  = document.getElementById("modal-desc");
  const actions = document.getElementById("modal-actions");
  const closeX  = document.getElementById("modal-close-x");

  function openModal({ title, message, buttons = [], cssClass = "" }) {
    titleEl.textContent = title || "Notice";
    descEl.textContent = message || "";
    actions.innerHTML = "";
    overlay.classList.remove("confirm");
    if (cssClass) overlay.querySelector(".modal").classList.add(cssClass);
    // create buttons
    buttons.forEach(function (btn) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn " + (btn.className || "");
      b.textContent = btn.label || "OK";
      b.addEventListener("click", function () { btn.onClick && btn.onClick(); });
      actions.appendChild(b);
    });
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
  }

  function closeModal() {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    const m = overlay.querySelector(".modal");
    m.classList.remove("confirm");
  }

  if (closeX) closeX.addEventListener("click", closeModal);
  overlay?.addEventListener("click", function (e) {
    // click outside dialog closes
    if (e.target === overlay) closeModal();
  });

  // ---------- csrf ----------
  function getCsrfToken() {
    const el = document.querySelector("[name=csrfmiddlewaretoken]");
    return el ? el.value : null;
  }

  // ---------- delete logic (via modal) ----------
  function confirmDelete(commentId) {
    if (!commentId) return;

    openModal({
      title: "Delete Comment",
      message: "Are you sure you wish to delete this comment?",
      cssClass: "confirm",
      buttons: [
        {
          label: "No",
          className: "",
          onClick: closeModal
        },
        {
          label: "Yes, delete",
          className: "btn-danger",
          onClick: function () {
            performDelete(commentId);
          }
        }
      ]
    });
  }

  function performDelete(commentId) {
    const csrf = getCsrfToken();
    if (!csrf) return;

    const formData = new FormData();
    formData.append("csrfmiddlewaretoken", csrf);
    formData.append("comment_id", commentId);

    fetch("/delete-comment/", {
      method: "POST",
      headers: { "X-Requested-With": "XMLHttpRequest" },
      body: formData
    })
      .then(function (res) {
        if (res.ok) {
          // show success message in the same modal, then reload
          openModal({
            title: "Deleted",
            message: "Your chosen comment has now been deleted.",
            buttons: [
              {
                label: "OK",
                className: "btn-primary",
                onClick: function () { window.location.reload(); }
              }
            ]
          });
        } else if (res.status === 403) {
          openModal({
            title: "Not allowed",
            message: "You can only delete your own comments.",
            buttons: [{ label: "OK", className: "btn-primary", onClick: closeModal }]
          });
        } else {
          openModal({
            title: "Error",
            message: "Delete failed. Please try again.",
            buttons: [{ label: "OK", className: "btn-primary", onClick: closeModal }]
          });
        }
      })
      .catch(function () {
        openModal({
          title: "Error",
          message: "Delete failed. Please try again.",
          buttons: [{ label: "OK", className: "btn-primary", onClick: closeModal }]
        });
      });
  }

  // ---------- extract text for edit (unchanged, but robust) ----------
  function extractCommentTextById(commentId) {
    const el = document.querySelector(`.single-comment[data-comment-id="${commentId}"]`);
    if (!el) return "";
    const body = el.querySelector(".comment-body");
    if (body) return body.innerText.trim();
    const clone = el.cloneNode(true);
    const strong = clone.querySelector("strong"); if (strong) strong.remove();
    const actions = clone.querySelector(".comment-actions"); if (actions) actions.remove();
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

  // ---------- "Delete Last" -> open modal ----------
  const deleteBtn = document.getElementById("delete-last-btn");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function (e) {
      const commentId = e.currentTarget.getAttribute("data-comment-id");
      confirmDelete(commentId);
    });
  }

  // ---------- "Edit Last" (same logic) ----------
  const editBtn = document.getElementById("edit-last-btn");
  if (editBtn) {
    editBtn.addEventListener("click", function (e) {
      const commentId = e.currentTarget.getAttribute("data-comment-id");
      startEdit(commentId);
    });
  }

  // ---------- per-comment buttons via delegation ----------
  const feed = document.getElementById("comment-feed");
  if (feed) {
    feed.addEventListener("click", function (e) {
      const target = e.target;
      if (target.classList.contains("comment-delete-btn")) {
        const commentId = target.getAttribute("data-comment-id");
        confirmDelete(commentId);
        return;
      }
      if (target.classList.contains("comment-edit-btn")) {
        const commentId = target.getAttribute("data-comment-id");
        startEdit(commentId);
        return;
      }
    });
  }

  // ---------- show post-success modal if server flagged one ----------
  (function maybeShowSuccessModal() {
    const hook = document.getElementById("server-comment-success");
    if (!hook) return;
    openModal({
      title: "Thanks!",
      message: hook.dataset.msg || "Thank you for commenting with Moogle.",
      buttons: [{ label: "OK", className: "btn-primary", onClick: closeModal }]
    });
  })();
});