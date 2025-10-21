(function () {
  var el = document.getElementById('lp-config');
  if (!el) return;

  var d = el.dataset || {};
  // Export globals used by your other game scripts
  window.IS_SUBSCRIBED = (d.isSubscribed === 'true');
  window.SUBSCRIBE_URL = d.subscribeUrl || '';
  window.CURRENT_USER_ID = parseInt(d.currentUserId || '0', 10);
})();
