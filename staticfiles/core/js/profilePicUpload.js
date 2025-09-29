document.addEventListener('DOMContentLoaded', () => {
  const openBtn = document.getElementById('openProfilePicModal');
  const modal = document.getElementById('profilePicModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const form = document.getElementById('profilePicForm');
  const currentPic = document.getElementById('currentProfilePic');

  // Safety check in case elements are missing (e.g. user not logged in)
  if (!openBtn || !modal || !closeBtn || !form || !currentPic) return;

  openBtn.onclick = () => {
    modal.style.display = 'block';
  };

  closeBtn.onclick = () => {
    modal.style.display = 'none';
  };

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

  form.onsubmit = async (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const uploadUrl = form.dataset.uploadUrl; // URL passed from data attribute

    try {
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData,
        headers: {
          'X-CSRFToken': getCookie('csrftoken'),
          'X-Requested-With': 'XMLHttpRequest',
        },
      });

      const data = await response.json();

      if (response.ok) {
        modal.style.display = 'none';

        // Update profile image dynamically with the new uploaded image URL from server, if provided
        if (data.new_image_url) {
          currentPic.src = data.new_image_url;
        } else {
          // Fallback: update from local file (may not reflect actual saved image on server)
          const file = formData.get('profile_image');
          const updatedPic = URL.createObjectURL(file);
          currentPic.src = updatedPic;
        }
      } else {
        alert('Error: ' + (data.errors || 'Unknown error occurred.'));
      }
    } catch (err) {
      alert('Error uploading image.');
    }
  };
});