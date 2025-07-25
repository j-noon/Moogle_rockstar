const startBtn = document.getElementById('memory-match-start-btn');
const tiles = document.querySelectorAll('.memory-tile');
const timerDisplay = document.getElementById('memory-match-timer');
const scoreDisplay = document.getElementById('memory-match-score');

let icons = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵'];
let boardIcons = [];
let flippedTiles = [];
let matched = 0;
let score = 0;
let timer;
let timeLeft = 60;
let gameActive = false;

function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

function resetBoard() {
  boardIcons = shuffle([...icons, ...icons]); // 15 pairs = 30 icons
  tiles.forEach(tile => {
    tile.textContent = '';
    tile.classList.remove('flipped', 'matched');
  });
  flippedTiles = [];
  matched = 0;
  score = 0;
  updateScore();
}

function updateScore() {
  scoreDisplay.textContent = `Score: ${score}`;
}

function updateTimer() {
  timerDisplay.textContent = `Time: ${timeLeft}s`;
}

function startTimer() {
  updateTimer();
  timer = setInterval(() => {
    timeLeft--;
    updateTimer();
    if (timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  clearInterval(timer);
  gameActive = false;
  startBtn.disabled = false;
  alert(`Time's up! You scored ${score} moogles!`);
}

function handleTileClick(e) {
  if (!gameActive) return;

  const tile = e.currentTarget;
  const index = parseInt(tile.dataset.index);
  if (tile.classList.contains('flipped') || tile.classList.contains('matched')) return;

  tile.textContent = boardIcons[index];
  tile.classList.add('flipped');
  flippedTiles.push({ tile, icon: boardIcons[index] });

  if (flippedTiles.length === 2) {
    const [first, second] = flippedTiles;
    if (first.icon === second.icon) {
      first.tile.classList.add('matched');
      second.tile.classList.add('matched');
      matched += 2;
      score += 2;
      updateScore();
      if (matched === 30) {
        endGame();
      }
      flippedTiles = [];
    } else {
      setTimeout(() => {
        first.tile.classList.remove('flipped');
        second.tile.classList.remove('flipped');
        first.tile.textContent = '';
        second.tile.textContent = '';
        flippedTiles = [];
      }, 800);
    }
  }
}

startBtn.addEventListener('click', () => {
  resetBoard();
  timeLeft = 60;
  updateTimer();
  startTimer();
  gameActive = true;
  startBtn.disabled = true;

  tiles.forEach(tile => {
    tile.addEventListener('click', handleTileClick);
  });
});
