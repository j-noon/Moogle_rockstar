document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const UID = (typeof window !== "undefined" && window.CURRENT_USER_ID) ? String(window.CURRENT_USER_ID) : "anon";
    const playButton = document.getElementById("memory-btn");
    const squares = document.querySelectorAll(".mem-square");
    const roundDisplay = document.getElementById("round-display");

    let sequence = [];
    let toClick = new Set();
    let gameActive = false;
    let currentRound = 0;
    let score = 0;

    let playToken = null;

    // === COOLDOWN ADD ===
    const MG_COOLDOWN_MS = 60 * 1000;
    const MG_CD_KEY = `${UID}:memory_game_cd_until`;
    let mgCdTimer = null;
    const mgIdleText = playButton.textContent || "Start";

    function mg_secondsLeft(untilMs) {
        const left = Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
        return left;
    }

    function mg_updateCooldownUI() {
        if (mgCdTimer) {
            clearInterval(mgCdTimer);
            mgCdTimer = null;
        }
        const untilStr = localStorage.getItem(MG_CD_KEY);
        const until = untilStr ? parseInt(untilStr, 10) : 0;
        if (until > Date.now()) {
            playButton.disabled = true;
            playButton.classList.add("is-cooling-down");
            const tick = () => {
                const s = mg_secondsLeft(until);
                if (s > 0) {
                    playButton.textContent = `${mgIdleText} (${s}s)`;
                } else {
                    clearInterval(mgCdTimer);
                    mgCdTimer = null;
                    playButton.disabled = false;
                    playButton.classList.remove("is-cooling-down");
                    playButton.textContent = mgIdleText;
                    localStorage.removeItem(MG_CD_KEY);
                }
            };
            tick();
            mgCdTimer = setInterval(tick, 1000);
        } else {
            playButton.disabled = false;
            playButton.classList.remove("is-cooling-down");
            playButton.textContent = mgIdleText;
            localStorage.removeItem(MG_CD_KEY);
        }
    }

    function mg_beginCooldown() {
        const until = Date.now() + MG_COOLDOWN_MS;
        localStorage.setItem(MG_CD_KEY, String(until));
        mg_updateCooldownUI();
    }
    // === END COOLDOWN ADD ===

    function updateRoundDisplay() {
        roundDisplay.textContent = "Round: " + currentRound;
    }

    function resetSquares() {
        let i = 0;
        const n = squares.length;
        while (i < n) {
            squares[i].classList.remove("mem-square-highlight");
            i += 1;
        }
    }

    function getRandomSquares(count) {
        const selected = new Set();
        while (selected.size < count) {
            const rand = Math.floor(Math.random() * squares.length);
            selected.add(squares[rand]);
        }
        return Array.from(selected);
    }

    function fetchPlayToken(gameKey, maxAward) {
        return fetch("/lets-play/start/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            body: JSON.stringify({ game: gameKey, max_award: maxAward })
        })
        .then(function (r) {
            if (!r.ok) { throw new Error("Failed to start play session"); }
            return r.json();
        })
        .then(function (data) {
            playToken = data.play_token;
            return data;
        });
    }

    function highlightSequence() {
        resetSquares();
        gameActive = false;
        toClick.clear();

        currentRound += 1;
        updateRoundDisplay();

        sequence = getRandomSquares(currentRound);

        let i = 0;
        const n = sequence.length;
        while (i < n) {
            (function (idx) {
                setTimeout(function () {
                    sequence[idx].classList.add("mem-square-highlight");
                }, idx * 600);

                setTimeout(function () {
                    sequence[idx].classList.remove("mem-square-highlight");
                    if (idx === sequence.length - 1) {
                        gameActive = true;
                        let j = 0;
                        const m = sequence.length;
                        while (j < m) {
                            toClick.add(sequence[j]);
                            j += 1;
                        }
                    }
                }, (idx * 600) + 500);
            }(i));
            i += 1;
        }
    }

    function sendScoreToServer(scoreToSend) {
        return fetch("/lets-play/update_moogles/", {
            body: JSON.stringify({ score: scoreToSend, play_token: playToken }),
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": getCookie("csrftoken")
            },
            method: "POST"
        }).then(function (response) {
            if (!response.ok) {
                throw new Error("Network response was not ok.");
            }
            return response.json();
        }).then(function (data) {
            console.log("Moogles updated:", data);

            const sel = "#user-profile .user-text p:nth-child(2)";
            const moogleDisplay = document.querySelector(sel);

            if (moogleDisplay && data.new_total !== undefined) {
                const imgEl = document.createElement("img");
                imgEl.src = "https://res.cloudinary.com/ddmslr9na/image/upload/v1760811664/moogles-moogles_t5gocu.png";
                imgEl.alt = "Moogle";
                imgEl.width = 30;
                imgEl.height = 30;

                moogleDisplay.innerHTML = "";
                moogleDisplay.appendChild(imgEl);
                moogleDisplay.appendChild(
                    document.createTextNode(" x" + data.new_total)
                );
            }
            return null;
        }).catch(function (error) {
            console.error("Error updating moogles:", error);
            return null;
        });
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== "") {
            const cookies = document.cookie.split(";");
            let i = 0;
            const n = cookies.length;
            while (i < n) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + "=")) {
                    cookieValue = decodeURIComponent(
                        cookie.substring(name.length + 1)
                    );
                    break;
                }
                i += 1;
            }
        }
        return cookieValue;
    }

    function endRoundWithAward() {
        if (score > 0) {
            if (playToken) {
                const finalScore = score;
                sendScoreToServer(finalScore).finally(function () {
                    localStorage.setItem("showWinModal", finalScore);
                    window.location.reload();
                });
            } else {
                alert("No play token. Please start again.");
                window.location.reload();
            }
        } else {
            window.location.reload();
        }
    }

    function handleSquareClick(e) {
        if (!gameActive) {
            return;
        }

        const square = e.target;
        if (!toClick.has(square)) {
            gameActive = false;

            endRoundWithAward();

            resetSquares();
            sequence = [];
            currentRound = 0;
            updateRoundDisplay();
            score = 0;
            return;
        }

        toClick.delete(square);
        square.classList.add("mem-square-highlight");

        if (toClick.size === 0) {
            gameActive = false;
            score = currentRound;

            setTimeout(function () {
                highlightSequence();
            }, 800);
        }
    }

    (function attachSquareHandlers() {
        let i = 0;
        const n = squares.length;
        while (i < n) {
            squares[i].addEventListener("click", handleSquareClick);
            i += 1;
        }
    }());

    // Initialize cooldown UI on load
    mg_updateCooldownUI();

    playButton.addEventListener("click", function () {
        const untilStr = localStorage.getItem(MG_CD_KEY);
        const until = untilStr ? parseInt(untilStr, 10) : 0;
        if (until > Date.now()) {
            mg_updateCooldownUI();
            return;
        }

        // NEW: fetch token before starting sequence
        const gameKey = playButton.dataset.gameKey || "memory";
        fetchPlayToken(gameKey, 50).then(function () {

            mg_beginCooldown();

            sequence = [];
            currentRound = 0;
            score = 0;
            updateRoundDisplay();
            highlightSequence();
        }).catch(function (err) {
            alert("Could not start game (token). Try again.");
            console.error(err);

            mg_updateCooldownUI();
        });
    });
});