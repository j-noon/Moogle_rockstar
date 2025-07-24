/* global document, FormData, fetch, window, confirm, console */

document.addEventListener('DOMContentLoaded', () => {
  // Delete button functionality (unchanged)
  const deleteBtn = document.getElementById('delete-last-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function handleDeleteClick() {
      const commentId = this.getAttribute('data-comment-id');
      // eslint-disable-next-line no-restricted-globals, no-alert
      if (confirm('Are you sure you want to delete this comment?')) {
        const formData = new FormData();
        const csrfTokenEl = document.querySelector('[name=csrfmiddlewaretoken]');
        if (!csrfTokenEl) return;

        formData.append('csrfmiddlewaretoken', csrfTokenEl.value);
        formData.append('comment_id', commentId);

        fetch('/comments/delete/', {
          method: 'POST',
          body: formData,
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
        })
          .then((response) => {
            if (response.redirected) {
              window.location.href = response.url;
            }
          })
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Delete error:', error);
          });
      }
    });
  }

  // Edit button functionality
  const editBtn = document.getElementById('edit-last-btn');
  if (editBtn) {
    editBtn.addEventListener('click', function handleEditClick() {
      const commentId = this.getAttribute('data-comment-id');
      const textInput = document.getElementById('id_text');

      if (!textInput) return;

      textInput.value = '';
      textInput.focus();

      let editInput = document.getElementById('edit_comment_id');
      if (!editInput) {
        editInput = document.createElement('input');
        editInput.type = 'hidden';
        editInput.name = 'edit_comment_id';
        editInput.id = 'edit_comment_id';
        const form = document.getElementById('comment-form');
        if (form) form.appendChild(editInput);
      }

      editInput.value = commentId;

      const commentBtn = document.getElementById('comment-btn');
      if (commentBtn) commentBtn.textContent = 'Update Comment';
    });
  }
});