document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openProfilePicModal');
  const modal = document.getElementById('profilePicModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const form = document.getElementById('profilePicForm');
  const currentPic = document.getElementById('currentProfilePic');

  // If not logged in or elements missing, bail quietly
  if (!openBtn || !modal || !closeBtn || !form || !currentPic) return;

  // Open/close modal
  openBtn.addEventListener('click', () => (modal.style.display = 'block'));
  closeBtn.addEventListener('click', () => (modal.style.display = 'none'));

  // CSRF helper
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
    // Progressive enhancement:
    // If fetch isn't available, let the browser do a normal POST.
    const canAjax = typeof window.fetch === 'function';
    if (!canAjax) return; // no preventDefault -> normal submit

    e.preventDefault();

    const url = form.dataset.uploadUrl || form.action;
    const fd = new FormData(form);

    try {
      const res = await fetch(url, {
        method: 'POST',
        body: fd,
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'X-Requested-With': 'XMLHttpRequest', // tells the view to return JSON
        },
      });

      // If server redirected (non-AJAX path somehow), just reload
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

      // ✅ Use the **server-provided Cloudinary URL** only.
      if (data.image_url) {
        currentPic.src = data.image_url + '?v=' + Date.now(); // cache-bust so you see it immediately
        modal.style.display = 'none';
      } else {
        // If the backend didn't give us a URL, reload to let the template render it.
        window.location.reload();
      }
    } catch (err) {
      alert('Network error uploading image.');
    }
  });
});