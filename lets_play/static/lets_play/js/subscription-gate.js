(function () {
  // IDs of buttons that require a subscription
  var paidButtons = [
    "memory-match-start-btn", // Game 2
    "typingGame_startBtn",    // Game 3
    "mathGame_startBtn"       // Game 4
  ];

  function handleGateClick(e) {
    if (!window.IS_SUBSCRIBED) {
      e.preventDefault();
      e.stopImmediatePropagation();
      alert("Subscribe to unlock this game!");
      window.location.href = window.SUBSCRIBE_URL;
    }
  }

  // Attach in capture phase so we run before other listeners
  paidButtons.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener("click", handleGateClick, true);
    }
  });
})();