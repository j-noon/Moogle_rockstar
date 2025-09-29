
document.addEventListener('DOMContentLoaded', () => {
  // Delete button functionality
  const deleteBtn = document.getElementById('delete-last-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function handleDeleteClick() {
      const commentId = this.getAttribute('data-comment-id');
      if (confirm('Are you sure you want to delete this comment?')) {
        const formData = new FormData();
        const csrfTokenEl = document.querySelector('[name=csrfmiddlewaretoken]');
        if (!csrfTokenEl) return;

        formData.append('csrfmiddlewaretoken', csrfTokenEl.value);
        formData.append('comment_id', commentId);

        fetch('/delete-comment/', {
          method: 'POST',
          body: formData,
          headers: {
            'X-Requested-With': 'XMLHttpRequest',
          },
        })
          .then((response) => {
            if (response.ok) {
              window.location.reload(); // 🔁 Refresh the page to reflect deletion
            } else {
              console.error('Delete failed with status:', response.status);
            }
          })
          .catch((error) => {
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

      // === NEW: Find the comment text inside the comment list ===
      const commentElements = document.querySelectorAll('.single-comment');
      let commentText = '';

      commentElements.forEach((el) => {
        if (el.getAttribute('data-comment-id') === commentId) {
          // Strip out username or anything before colon (:)
          const fullText = el.textContent.trim();
          commentText = fullText.split(':').slice(1).join(':').trim();
        }
      });

      textInput.value = commentText;
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