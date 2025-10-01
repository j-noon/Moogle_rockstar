document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openProfilePicModal');
  const modal = document.getElementById('profilePicModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const form = document.getElementById('profilePicForm');
  const currentPic = document.getElementById('currentProfilePic');

  
  if (!openBtn || !modal || !closeBtn || !form || !currentPic) return;

  // Open/close modal
  openBtn.addEventListener('click', () => (modal.style.display = 'block'));
  closeBtn.addEventListener('click', () => (modal.style.display = 'none'));

  
  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(name + '=')) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  form.addEventListener('submit', async (e) => {
    const canAjax = typeof window.fetch === 'function';
    if (!canAjax) return;

    e.preventDefault();

    const url = form.dataset.uploadUrl || form.action;
    const fd = new FormData(form);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: fd,
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      
      const ctype = res.headers.get('content-type') || '';
      if (!ctype.includes('application/json')) {
        window.location.reload();
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        const err = data?.errors ? JSON.stringify(data.errors) : 'Upload failed.';
        alert(err);
        return;
      }

      
      if (data.image_url) {
        currentPic.src = data.image_url + '?v=' + Date.now();
        modal.style.display = 'none';
      } else {
        window.location.reload();
      }
    } catch (err) {
      alert('Network error uploading image.');
    }
  });
});