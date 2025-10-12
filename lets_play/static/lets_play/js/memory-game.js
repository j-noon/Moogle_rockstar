document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const playButton = document.getElementById("memory-btn");
    const squares = document.querySelectorAll(".mem-square");
    const roundDisplay = document.getElementById("round-display");

    let sequence = [];
    let toClick = new Set();
    let gameActive = false;
    let currentRound = 0;
    let score = 0;

    function updateRoundDisplay() {
        roundDisplay.textContent = "Round: " + currentRound;
    }

    function resetSquares() {
        // avoid arrow + long line; use classic loop
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

    function highlightSequence() {
        resetSquares();
        gameActive = false;
        toClick.clear();

        currentRound += 1;
        updateRoundDisplay();

        sequence = getRandomSquares(currentRound);

        // show the sequence with delays (no arrows)
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
                        // populate the set to click
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
            body: JSON.stringify({score: scoreToSend}),
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
                // Build the markup via DOM nodes (no long template strings)
                const imgEl = document.createElement("img");
                imgEl.src = "https://res.cloudinary.com/ddmslr9na/image/upload/v1752501444/medievil-castle-web180x180_dzlrhv.webp";
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

    function handleSquareClick(e) {
        if (!gameActive) {
            return;
        }

        const square = e.target;
        if (!toClick.has(square)) {
            gameActive = false;

            if (score > 0) {
                const finalScore = score; // same value as before
                sendScoreToServer(finalScore).finally(function () {
                    localStorage.setItem("showWinModal", finalScore);
                    window.location.reload();
                });
            } else {
                window.location.reload();
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

            setTimeout(function () {
                highlightSequence();
            }, 800);
        }
    }

    // attach click listeners to all squares (no arrows)
    (function attachSquareHandlers() {
        let i = 0;
        const n = squares.length;
        while (i < n) {
            squares[i].addEventListener("click", handleSquareClick);
            i += 1;
        }
    }());

    // start/reset button
    playButton.addEventListener("click", function () {
        sequence = [];
        currentRound = 0;
        score = 0;
        updateRoundDisplay();
        highlightSequence();
    });
});