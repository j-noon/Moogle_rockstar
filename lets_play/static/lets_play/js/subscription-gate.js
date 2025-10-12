document.addEventListener("DOMContentLoaded", function () {
    "use strict";

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
    (function attach() {
        var i = 0;
        var n = paidButtons.length;
        var id;
        var el;
        while (i < n) {
            id = paidButtons[i];
            el = document.getElementById(id);
            if (el) {
                el.addEventListener("click", handleGateClick, true);
            }
            i += 1;
        }
    }());
});