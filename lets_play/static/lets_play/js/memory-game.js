document.addEventListener("DOMContentLoaded", () => {
    const playButton = document.getElementById("memory-btn");
    const squares = document.querySelectorAll(".mem-square");
    const roundDisplay = document.getElementById("round-display");

    let sequence = [];
    let toClick = new Set();
    let gameActive = false;
    let currentRound = 0;
    let score = 0;

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
        return fetch('/lets-play/update_moogles/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
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

            if (score > 0) {
                const finalScore = score;
                sendScoreToServer(score).finally(() => {
                    localStorage.setItem("showWinModal", score);
                    location.reload();
                });
            } else {
                location.reload();
            }

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
        score = 0;
        updateRoundDisplay();
        highlightSequence();
    });
});