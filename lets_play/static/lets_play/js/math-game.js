document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const startBtn = document.getElementById("mathGame_startBtn");
    const questionDisplay = document.getElementById("mathGame_sumDisplay");
    const answerInput = document.getElementById("mathGame_answerInput");
    const scoreDisplay = document.getElementById("mathGame_scoreDisplay");
    const timerDisplay = document.getElementById("mathGame_timerDisplay");

    let score = 0;
    let timeLeft = 60;
    let currentAnswer = 0;
    let timer = null;

    function getCookie(name) {
        let cookieValue = null;
        let cookies;
        let i = 0;
        let nlen;
        let cookie;

        if (document.cookie && document.cookie !== "") {
            cookies = document.cookie.split(";");
            nlen = cookies.length;
            while (i < nlen) {
                cookie = cookies[i].trim();
                if (cookie.indexOf(name + "=") === 0) {
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

    function generateQuestion() {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        currentAnswer = a + b;
        questionDisplay.textContent = a + " + " + b;
    }

    function updateScore() {
        scoreDisplay.textContent = "Score: " + score;
    }

    function updateTimer() {
        timerDisplay.textContent = "Time: " + timeLeft + "s";
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
                throw new Error("Network error");
            }
            return response.json();
        }).then(function (data) {
            const sel = "#user-profile .user-text .moogle-count";
            const moogleDisplay = document.querySelector(sel);
            if (moogleDisplay && data.new_total !== undefined) {
                // build markup via DOM nodes
                const imgEl = document.createElement("img");
                const baseUrl = "https://res.cloudinary.com/ddmslr9na/image/upload/";
                const imgPath = "v1752501444/medievil-castle-web180x180_dzlrhv.webp";
                imgEl.src = baseUrl + imgPath;
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
        }).catch(function () {
            alert("Failed to update moogles.");
            return null;
        });
    }

    function startGame() {
        score = 0;
        timeLeft = 60;
        updateScore();
        updateTimer();
        generateQuestion();

        answerInput.disabled = false;
        answerInput.focus();

        if (timer) {
            clearInterval(timer);
        }
        timer = setInterval(function () {
            timeLeft -= 1;
            updateTimer();

            if (timeLeft <= 0) {
                clearInterval(timer);
                const overMsg = "Time's up! Final Score: " + score;
                questionDisplay.textContent = overMsg;
                answerInput.disabled = true;
                sendScoreToServer(score);
            }
        }, 1000);
    }

    function handleAnswerSubmit() {
        const userAnswer = parseInt(answerInput.value, 10);
        if (!Number.isNaN(userAnswer) && userAnswer === currentAnswer) {
            score += 1;
            updateScore();
            generateQuestion();
            answerInput.value = "";
            answerInput.focus();
        }
    }

    startBtn.addEventListener("click", function () {
        startGame();
    });

    answerInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            handleAnswerSubmit();
        }
    });
});