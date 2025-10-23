// core/js/login.js
document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('password');
  var btn = document.getElementById('toggle-password');
  if (!input || !btn) return;

  var eye = btn.querySelector('.icon-eye');
  var eyeOff = btn.querySelector('.icon-eye-off');

  btn.addEventListener('click', function () {
    var showing = input.getAttribute('type') === 'text';
    if (showing) {
      input.setAttribute('type', 'password');
      btn.setAttribute('aria-label', 'Show password');
      btn.setAttribute('aria-pressed', 'false');
      if (eye) eye.removeAttribute('hidden');
      if (eyeOff) eyeOff.setAttribute('hidden', '');
    } else {
      input.setAttribute('type', 'text');
      btn.setAttribute('aria-label', 'Hide password');
      btn.setAttribute('aria-pressed', 'true');
      if (eye) eye.setAttribute('hidden', '');
      if (eyeOff) eyeOff.removeAttribute('hidden');
    }
  });
});