document.addEventListener("DOMContentLoaded", () => {
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
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                cookie = cookie.trim();
                if (cookie.startsWith(name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function generateQuestion() {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        currentAnswer = a + b;
        questionDisplay.textContent = `${a} + ${b}`;
    }

    function updateScore() {
        scoreDisplay.textContent = `Score: ${score}`;
    }

    function updateTimer() {
        timerDisplay.textContent = `Time: ${timeLeft}s`;
    }

    function sendScoreToServer(scoreToSend) {
        return fetch('/lets-play/update_moogles/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
            body: JSON.stringify({ score: scoreToSend }),
        })
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.json();
        })
        .then(data => {
            const moogleDisplay = document.querySelector("#user-profile .user-text .moogle-count");
            if (moogleDisplay && data.new_total !== undefined) {
                moogleDisplay.innerHTML = `
                    <img src="https://res.cloudinary.com/ddmslr9na/image/upload/v1752501444/medievil-castle-web180x180_dzlrhv.webp" 
                         alt="Moogle" width="30" height="30"> x${data.new_total}
                `;
            }
        })
        .catch(err => console.error("Failed to update moogles:", err));
    }

    function startGame() {
        score = 0;
        timeLeft = 60;
        updateScore();
        updateTimer();
        generateQuestion();

        answerInput.disabled = false;
        answerInput.focus();

        if (timer) clearInterval(timer);
        timer = setInterval(() => {
            timeLeft--;
            updateTimer();

            if (timeLeft <= 0) {
                clearInterval(timer);
                questionDisplay.textContent = `Time's up! Final Score: ${score}`;
                answerInput.disabled = true;
                sendScoreToServer(score);
            }
        }, 1000);
    }

    function handleAnswerSubmit() {
        const userAnswer = parseInt(answerInput.value);
        if (!isNaN(userAnswer) && userAnswer === currentAnswer) {
            score++;
            updateScore();
            generateQuestion();
            answerInput.value = '';
            answerInput.focus();
        }
    }

    startBtn.addEventListener("click", startGame);
    answerInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") handleAnswerSubmit();
    });
});