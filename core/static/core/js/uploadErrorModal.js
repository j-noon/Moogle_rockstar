(function () {
  var overlay = document.getElementById('uploadErrorModal');
  var msgEl = document.getElementById('uploadErrorMessage');
  var closeBtn = document.getElementById('uploadErrClose');
  var okBtn = document.getElementById('uploadErrOk');

  function hide() { if (overlay) overlay.style.display = 'none'; }
  function show(message) {
    if (!overlay || !msgEl) return alert(message || "Upload error");
    msgEl.innerHTML = message || "Error: Wrong file type. Please try again with <strong>JPEG</strong> or <strong>PNG</strong>!";
    overlay.style.display = 'flex';
  }

  // expose globally so your uploader JS can call it
  window.showUploadError = show;

  if (closeBtn) closeBtn.addEventListener('click', hide);
  if (okBtn) okBtn.addEventListener('click', hide);
  if (overlay) overlay.addEventListener('click', function (e) {
    if (e.target === overlay) hide();
  });
})();
