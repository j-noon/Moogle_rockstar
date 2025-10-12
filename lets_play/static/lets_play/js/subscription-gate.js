document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  // These are set by your template:
  //   window.IS_SUBSCRIBED: boolean
  //   window.SUBSCRIBE_URL: string
  var isSubscribed = !!window.IS_SUBSCRIBED;
  var subscribeUrl = String(window.SUBSCRIBE_URL || "/subscriptions/manage/");

  // IDs of buttons that require a subscription
  var paidButtons = [
    "memory-match-start-btn", // Game 2
    "typingGame_startBtn",    // Game 3
    "mathGame_startBtn"       // Game 4
  ];

  function handleGateClick(e) {
    if (!isSubscribed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      alert("Subscribe to unlock this game!");
      window.location.href = subscribeUrl;
    }
  }

  // Progressive UX: if not subscribed, add a visual hint + capture clicks
  function decorateLockedButton(el) {
    try {
      el.setAttribute("data-locked", "true");
      el.title = "Requires an active subscription";
      // Use capture phase so we run before other listeners
      el.addEventListener("click", handleGateClick, true);
    } catch (_) {}
  }

  (function attach() {
    for (var i = 0; i < paidButtons.length; i += 1) {
      var el = document.getElementById(paidButtons[i]);
      if (!el) continue;

      if (!isSubscribed) {
        decorateLockedButton(el);
      }
    }
  }());
});