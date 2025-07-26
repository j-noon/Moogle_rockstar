document.addEventListener("DOMContentLoaded", () => {
    const playButton = document.getElementById("memory-btn");
    const squares = document.querySelectorAll(".mem-square");
    const roundDisplay = document.getElementById("round-display");

    let sequence = [];
    let toClick = new Set();
    let gameActive = false;
    let currentRound = 0;
    let score = 0;  // track user's moogles earned this session

    function updateRoundDisplay() {
        roundDisplay.textContent = `Round: ${currentRound}`;
    }

    function resetSquares() {
        squares.forEach(square => square.classList.remove("mem-square-highlight"));
    }

    function getRandomSquares(count) {
        const selected = new Set();
        while (selected.size < count) {
            const rand = Math.floor(Math.random() * squares.length);
            selected.add(squares[rand]);
        }
        return Array.from(selected);
    }

    function highlightSequence() {
        resetSquares();
        gameActive = false;
        toClick.clear();

        currentRound++;
        updateRoundDisplay();

        sequence = getRandomSquares(currentRound);

        sequence.forEach((square, index) => {
            setTimeout(() => {
                square.classList.add("mem-square-highlight");
            }, index * 600);

            setTimeout(() => {
                square.classList.remove("mem-square-highlight");
                if (index === sequence.length - 1) {
                    gameActive = true;
                    sequence.forEach(sq => toClick.add(sq));
                }
            }, index * 600 + 500);
        });
    }

    function sendScoreToServer(scoreToSend) {
        // AJAX POST to Django backend to update user moogles
        return fetch('/lets-play/update_moogles/', {  // <-- return promise so caller can wait
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'), // CSRF token for Django
            },
            body: JSON.stringify({ score: scoreToSend }),
        })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok.');
            return response.json();
        })
        .then(data => {
            console.log('Moogles updated:', data);
            const moogleDisplay = document.querySelector("#user-profile .user-text p:nth-child(2)");
            if (moogleDisplay && data.new_total !== undefined) {
                moogleDisplay.innerHTML = `
                    <img src="your_moogle_image_url" alt="Moogle" width="30" height="30">                
                    x${data.new_total}
                `;
            }
        })
        .catch(error => {
            console.error('Error updating moogles:', error);
        });
    }

    // Helper to get CSRF token cookie (standard Django method)
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    function handleSquareClick(e) {
        if (!gameActive) return;

        const square = e.target;
        if (!toClick.has(square)) {

            gameActive = false;

            // SEND score before resetting, then reload page when done
            if (score > 0) {
                const finalScore = score;
                sendScoreToServer(score).finally(() => {
                    localStorage.setItem("showWinModal", score);  // store score before reload
                    location.reload();  // <-- Reload page after score is sent
                });
            } else {
                // If no score to send, reload immediately
                location.reload();
            }

            resetSquares();
            sequence = [];
            currentRound = 0;
            updateRoundDisplay();

            // reset score for next game
            score = 0;

            return;
        }

        toClick.delete(square);
        square.classList.add("mem-square-highlight");

        if (toClick.size === 0) {
            gameActive = false;

            // Update score each completed round successfully
            score = currentRound;

            setTimeout(() => {
                highlightSequence();
            }, 800);
        }
    }

    squares.forEach(square => {
        square.addEventListener("click", handleSquareClick);
    });

    playButton.addEventListener("click", () => {
        sequence = [];
        currentRound = 0;
        score = 0; // reset score at start of game
        updateRoundDisplay();
        highlightSequence();
    });
});