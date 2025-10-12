const startBtn = document.getElementById("memory-match-start-btn");
const tiles = document.querySelectorAll(".memory-tile");
const timerDisplay = document.getElementById("memory-match-timer");
const scoreDisplay = document.getElementById("memory-match-score");

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

function shuffle(arr) {
    // Fisher–Yates (no arrow funcs)
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
    // tiles.forEach(...) → classic loop
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

function sendScoreToServer(scoreToSend) {
    return fetch("/lets-play/update_moogles/", {
        body: JSON.stringify({score: scoreToSend}),
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
            // build the small icon + count via DOM nodes
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
    startBtn.disabled = false;

    if (score > 0) {
        sendScoreToServer(score).then(function () {
            if (window.showGameResultModal) {
                window.showGameResultModal();
            }
        });
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

    // store icon first for ordered keys + shorthand
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

startBtn.addEventListener("click", function () {
    resetBoard();
    timeLeft = 60;
    updateTimer();
    startTimer();
    gameActive = true;
    startBtn.disabled = true;

    // tiles.forEach(...) → loop
    let i = 0;
    const n = tiles.length;
    while (i < n) {
        tiles[i].addEventListener("click", handleTileClick);
        i += 1;
    }
});