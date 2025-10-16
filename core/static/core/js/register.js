document.addEventListener('DOMContentLoaded', function () {
  // Grab the form without needing an id
  const form         = document.querySelector('.auth-container form.auth-form');
  const successModal = document.getElementById('signup-success');
  const errorModal   = document.getElementById('signup-error');
  const goLogin      = document.getElementById('go-login');

  if (!form) {
    console.warn('[register] form.auth-form not found inside .auth-container; aborting.');
    return;
  }

  // Helpers to open/close modals
  const open  = (el) => { if (!el) return; el.classList.add('open'); el.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; };
  const close = (el) => { if (!el) return; el.classList.remove('open'); el.setAttribute('aria-hidden','true'); document.body.style.overflow=''; };

  // Close on backdrop click / [data-close] / Esc
  [successModal, errorModal].forEach((m) => {
    if (!m) return;
    m.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]') || e.target.classList.contains('modal__backdrop')) {
        close(m);
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close(successModal);
      close(errorModal);
    }
  });

  // Get CSRF token from the hidden input in the form
  function getFormCSRF() {
    const input = form.querySelector('input[name=csrfmiddlewaretoken]');
    return input ? input.value : '';
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const url = form.getAttribute('action');
    const fd  = new FormData(form);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRFToken': getFormCSRF()
        },
        body: fd,
        credentials: 'same-origin'
      });

      let data = {};
      try { data = await res.json(); } catch (_) {}

      if (res.ok && data && data.ok) {
        if (goLogin && data.login_url) goLogin.setAttribute('href', data.login_url);
        open(successModal);
        form.reset();
      } else {
        open(errorModal);
      }
    } catch (err) {
      console.error('[register] network/error', err);
      open(errorModal);
    }
  });
});