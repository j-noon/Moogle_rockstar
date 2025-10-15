document.addEventListener("DOMContentLoaded", function () {
const startBtn = document.getElementById("memory-match-start-btn");
const tiles = document.querySelectorAll(".memory-tile");
const timerDisplay = document.getElementById("memory-match-timer");
const scoreDisplay = document.getElementById("memory-match-score");
const UID = (typeof window !== "undefined" && window.CURRENT_USER_ID) ? String(window.CURRENT_USER_ID) : "anon";


let icons = [
    "🐶", "🐱", "🐭", "🐹", "🐰",
    "🦊", "🐻", "🐼", "🐨", "🐯",
    "🦁", "🐮", "🐷", "🐸", "🐵"
];

let boardIcons = [];
let flippedTiles = [];
let matched = 0;
let score = 0;
let timer;
let timeLeft = 60;
let gameActive = false;
let playToken = null;

// === COOLDOWN ADD ===
const MM_COOLDOWN_MS = 60 * 1000;
const MM_CD_KEY = `${UID}:memory_match_cd_until`;
let mmCdTimer = null;
const mmIdleText = startBtn.textContent || "Start";

function mm_secondsLeft(untilMs) {
    const left = Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
    return left;
}

function mm_updateCooldownUI() {
    if (mmCdTimer) {
        clearInterval(mmCdTimer);
        mmCdTimer = null;
    }
    const untilStr = localStorage.getItem(MM_CD_KEY);
    const until = untilStr ? parseInt(untilStr, 10) : 0;
    if (until > Date.now()) {
        startBtn.disabled = true;
        startBtn.classList.add("is-cooling-down");
        const tick = () => {
            const s = mm_secondsLeft(until);
            if (s > 0) {
                startBtn.textContent = `${mmIdleText} (${s}s)`;
            } else {
                clearInterval(mmCdTimer);
                mmCdTimer = null;
                startBtn.disabled = false;
                startBtn.classList.remove("is-cooling-down");
                startBtn.textContent = mmIdleText;
                localStorage.removeItem(MM_CD_KEY);
            }
        };
        tick();
        mmCdTimer = setInterval(tick, 1000);
    } else {
        startBtn.disabled = false;
        startBtn.classList.remove("is-cooling-down");
        startBtn.textContent = mmIdleText;
        localStorage.removeItem(MM_CD_KEY);
    }
}

function mm_beginCooldown() {
    const until = Date.now() + MM_COOLDOWN_MS;
    localStorage.setItem(MM_CD_KEY, String(until));
    mm_updateCooldownUI();
}
// === END COOLDOWN ADD ===

function shuffle(arr) {
    let a = arr.slice(0);
    let i = a.length - 1;
    let j;
    let tmp;
    while (i > 0) {
        j = Math.floor(Math.random() * (i + 1));
        tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
        i -= 1;
    }
    return a;
}

function resetBoard() {
    boardIcons = shuffle(icons.concat(icons));
    let i = 0;
    const n = tiles.length;
    while (i < n) {
        tiles[i].textContent = "";
        tiles[i].classList.remove("flipped", "matched");
        i += 1;
    }
    flippedTiles = [];
    matched = 0;
    score = 0;
    updateScore();
}

function updateScore() {
    scoreDisplay.textContent = "Score: " + score;
}

function updateTimer() {
    timerDisplay.textContent = "Time: " + timeLeft + "s";
}

function startTimer() {
    updateTimer();
    timer = window.setInterval(function () {
        timeLeft -= 1;
        updateTimer();
        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
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

// fetch a one-time token
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
            throw new Error("Failed to update moogles.");
        }
        return response.json();
    }).then(function (data) {
        console.log("Moogles updated:", data);
        const moogleDisplay = document.querySelector(".moogle-count");
        if (moogleDisplay && data.new_total !== undefined) {
            const imgEl = document.createElement("img");
            const baseUrl = "https://res.cloudinary.com/ddmslr9na/"
                + "image/upload/";
            const imgPath = "v1752501444/"
                + "medievil-castle-web180x180_dzlrhv.webp";
            imgEl.src = baseUrl + imgPath;
            imgEl.alt = "Moogle";
            imgEl.style.width = "30px";
            imgEl.style.height = "30px";
            imgEl.style.verticalAlign = "middle";

            moogleDisplay.innerHTML = "";
            moogleDisplay.appendChild(imgEl);
            moogleDisplay.appendChild(
                document.createTextNode(" × " + data.new_total)
            );
        }
        return null;
    }).catch(function (error) {
        console.error("Error sending score:", error);
        return null;
    });
}

function endGame() {
    window.clearInterval(timer);
    gameActive = false;

    // Respect cooldown state instead:
    mm_updateCooldownUI();

    if (score > 0) {
        if (playToken) {
            sendScoreToServer(score).then(function () {
                if (window.showGameResultModal) {
                    window.showGameResultModal();
                }
            });
        } else {
            alert("No play token. Please start again.");
            if (window.showGameResultModal) {
                window.showGameResultModal();
            }
        }
    } else {
        if (window.showGameResultModal) {
            window.showGameResultModal();
        }
    }
}

function handleTileClick(e) {
    if (!gameActive) {
        return;
    }

    const tile = e.currentTarget;
    const index = parseInt(tile.dataset.index, 10);
    if (
        tile.classList.contains("flipped")
        || tile.classList.contains("matched")
    ) {
        return;
    }

    tile.textContent = boardIcons[index];
    tile.classList.add("flipped");

    const icon = boardIcons[index];
    flippedTiles.push({icon, tile});

    if (flippedTiles.length === 2) {
        const first = flippedTiles[0];
        const second = flippedTiles[1];

        if (first.icon === second.icon) {
            first.tile.classList.add("matched");
            second.tile.classList.add("matched");
            matched += 2;
            score += 2;
            updateScore();
            if (matched === 30) {
                endGame();
            }
            flippedTiles = [];
        } else {
            window.setTimeout(function () {
                first.tile.classList.remove("flipped");
                second.tile.classList.remove("flipped");
                first.tile.textContent = "";
                second.tile.textContent = "";
                flippedTiles = [];
            }, 800);
        }
    }
}

// Initialize cooldown UI on load
mm_updateCooldownUI();

startBtn.addEventListener("click", function () {
    // Block if cooling down
    const untilStr = localStorage.getItem(MM_CD_KEY);
    const until = untilStr ? parseInt(untilStr, 10) : 0;
    if (until > Date.now()) {
        mm_updateCooldownUI();
        return;
    }

    // NEW: fetch token first
        const gameKey = startBtn.dataset.gameKey || "memory-match";
        fetchPlayToken(gameKey, 50).then(function () {
        // Begin cooldown after successful start
        mm_beginCooldown();

        resetBoard();
        timeLeft = 60;
        updateTimer();
        startTimer();
        gameActive = true;
        startBtn.disabled = true;

        let i = 0;
        const n = tiles.length;
        while (i < n) {
            tiles[i].addEventListener("click", handleTileClick);
            i += 1;
        }
    }).catch(function () {
        alert("Could not start game (token). Try again.");
        mm_updateCooldownUI();
    });
});
});
