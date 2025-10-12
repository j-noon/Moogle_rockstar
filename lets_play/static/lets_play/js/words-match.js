const typingGame_startBtn = document.getElementById("typingGame_startBtn");
const typingGame_wordDisplay = document.getElementById(
    "typingGame_wordDisplay"
);
const typingGame_input = document.getElementById("typingGame_input");
const typingGame_scoreDisplay = document.getElementById("typingGame_score");
const typingGame_timerDisplay = document.getElementById("typingGame_timer");
const typingGame_wordList = document.getElementById("typingGame_wordList");

let typingGame_score = 0;
let typingGame_timeLeft = 60;
let typingGame_timer;
let typingGame_gameActive = false;
let typingGame_currentWord = "";

const typingGame_wordsByLength = {
    "3": ["mud", "sun", "hat"],
    "4": ["wolf", "dark"],
    "5": ["crash", "flame", "vigor", "blame", "brick"],
    "6": ["battle", "puzzle", "hunter", "rocket", "throne"],
    "7": ["kingdom", "journey", "monster", "villain", "picture"],
    "8": ["triangle", "sandwich", "mountain", "keyboard", "campaign"],
    "9": ["adventure", "strategic", "exploring", "discovery", "fantastic"]
};

function typingGame_getRandomWord(length) {
    const list = typingGame_wordsByLength[String(length)];
    return list[Math.floor(Math.random() * list.length)];
}

function typingGame_getWordForTime(t) {
    if (t > 50) {
        return typingGame_getRandomWord(5);
    }
    if (t > 40) {
        return typingGame_getRandomWord(6);
    }
    if (t > 30) {
        return typingGame_getRandomWord(7);
    }
    if (t > 20) {
        return typingGame_getRandomWord(8);
    }
    return typingGame_getRandomWord(9);
}

function typingGame_displayNewWord() {
    typingGame_currentWord = typingGame_getWordForTime(typingGame_timeLeft);
    typingGame_wordDisplay.textContent = typingGame_currentWord;
    typingGame_wordDisplay.classList.remove("fade-word");
    // retrigger CSS animation on next frame (no 'void' operator)
    window.requestAnimationFrame(function () {
        typingGame_wordDisplay.classList.add("fade-word");
    });
}

function typingGame_updateScoreDisplay() {
    typingGame_scoreDisplay.textContent = "Score: " + typingGame_score;
}

function typingGame_updateTimerDisplay() {
    typingGame_timerDisplay.textContent = "Time: " + typingGame_timeLeft + "s";
}

function typingGame_startGame() {
    typingGame_score = 0;
    typingGame_timeLeft = 60;
    typingGame_gameActive = true;
    typingGame_input.value = "";
    typingGame_input.disabled = false;
    typingGame_wordList.innerHTML = "";
    typingGame_input.focus();

    typingGame_updateScoreDisplay();
    typingGame_updateTimerDisplay();
    typingGame_displayNewWord();

    typingGame_timer = window.setInterval(function () {
        typingGame_timeLeft -= 1;
        typingGame_updateTimerDisplay();

        if (typingGame_timeLeft <= 0) {
            window.clearInterval(typingGame_timer);
            typingGame_gameActive = false;
            typingGame_input.disabled = true;

            // keep a single space after '=' per JSLint rule
            const overMsg = "Time's up! Final Score: " + typingGame_score;
            typingGame_wordDisplay.textContent = overMsg;

            if (typingGame_score > 0) {
                typingGame_sendScoreToServer(typingGame_score);
            }
        }
    }, 1000);
}

typingGame_input.addEventListener("input", function () {
    if (!typingGame_gameActive) {
        return;
    }

    // normalize comparison
    const typed = typingGame_input.value.trim().toLowerCase();
    const target = typingGame_currentWord.toLowerCase();

    if (typed === target) {
        typingGame_score += 1;
        typingGame_updateScoreDisplay();

        // Add word to log
        const li = document.createElement("li");
        li.textContent = typingGame_currentWord;
        typingGame_wordList.appendChild(li);

        typingGame_input.value = "";
        typingGame_displayNewWord();
    }
});

typingGame_startBtn.addEventListener("click", function () {
    typingGame_startGame();
});

function typingGame_getCookie(name) {
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

function typingGame_sendScoreToServer(scoreToSend) {
    fetch("/lets-play/update_moogles/", {
        body: JSON.stringify({score: scoreToSend}),
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": typingGame_getCookie("csrftoken")
        },
        method: "POST"
    }).then(function (response) {
        if (!response.ok) {
            throw new Error("Failed to update moogles.");
        }
        return response.json();
    }).then(function (data) {
        const moogleDisplay = document.querySelector(".moogle-count");
        if (moogleDisplay && data.new_total !== undefined) {
            // build via DOM to avoid long template string
            const imgEl = document.createElement("img");
            const baseUrl = "https://res.cloudinary.com/ddmslr9na/" + "image/upload/";
            const imgPath = "v1752501444/" + "medievil-castle-web180x180_dzlrhv.webp";
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