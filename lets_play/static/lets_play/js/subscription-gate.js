document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  // Prefer globals set by config.js; fall back to #lp-config data-attributes
  var isSubscribed = !!window.IS_SUBSCRIBED;
  var subscribeUrl = String(window.SUBSCRIBE_URL || "/subscriptions/manage/");

  var cfg = document.getElementById("lp-config");
  if (cfg) {
    // Only override if globals are missing/empty
    if (typeof window.IS_SUBSCRIBED === "undefined") {
      isSubscribed = (cfg.dataset.isSubscribed === "true");
    }
    if (!window.SUBSCRIBE_URL && cfg.dataset.subscribeUrl) {
      subscribeUrl = cfg.dataset.subscribeUrl;
    }
  }

  // Buttons that require subscription
  var paidButtons = [
    "memory-match-start-btn", // Game 2
    "typingGame_startBtn",    // Game 3
    "mathGame_startBtn"       // Game 4
  ];

  // Modal elements
  var modal = document.getElementById("subGateModal");
  var yesBtn = document.getElementById("subGateYes");
  var noBtn  = document.getElementById("subGateNo");
  var lastFocused = null;

  function openModal() {
    if (!modal) return;
    lastFocused = document.activeElement;
    // make it visible
    modal.style.display = "flex";
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-hidden", "false");
    // focus first actionable element
    if (yesBtn) { try { yesBtn.focus(); } catch (_) {} }
    // close on ESC
    document.addEventListener("keydown", onEsc, { capture: true });
    // click outside to close
    modal.addEventListener("click", onBackdrop, { capture: true });
  }

  function closeModal() {
    if (!modal) return;
    // hide it again
    modal.style.display = "none";
    modal.setAttribute("hidden", "");
    modal.setAttribute("aria-hidden", "true");
    document.removeEventListener("keydown", onEsc, { capture: true });
    modal.removeEventListener("click", onBackdrop, { capture: true });
    if (lastFocused) { try { lastFocused.focus(); } catch (_) {} }
  }

  function onEsc(e) {
    if (e.key === "Escape") closeModal();
  }

  function onBackdrop(e) {
    if (e.target === modal) closeModal();
  }

  if (yesBtn) {
    yesBtn.addEventListener("click", function () {
      window.location.href = subscribeUrl;
    });
  }
  if (noBtn) {
    noBtn.addEventListener("click", function () {
      closeModal();
    });
  }

  function gateClickHandler(e) {
    if (!isSubscribed) {
      e.preventDefault();
      e.stopImmediatePropagation();
      openModal();
    }
  }

  function decorateLockedButton(el) {
    try {
      el.setAttribute("data-locked", "true");
      el.title = "Requires an active subscription";
      // capture phase so we intercept before game JS
      el.addEventListener("click", gateClickHandler, true);
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