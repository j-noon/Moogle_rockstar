document.addEventListener("DOMContentLoaded", () => {
    const playButton = document.getElementById("memory-btn");
    const squares = document.querySelectorAll(".mem-square");
    const roundDisplay = document.getElementById("round-display");


    
    let sequence = [];
    let toClick = new Set();
    let gameActive = false;
    let currentRound = 0;

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

    function handleSquareClick(e) {
        if (!gameActive) return;

        const square = e.target;
        if (!toClick.has(square)) {
            alert("Game Over!");
            gameActive = false;
            resetSquares();
            sequence = [];
            currentRound = 0;
            updateRoundDisplay();
            return;
        }

        toClick.delete(square);
        square.classList.add("mem-square-highlight");

        if (toClick.size === 0) {
            gameActive = false;
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
        updateRoundDisplay();
        highlightSequence();
    });
});