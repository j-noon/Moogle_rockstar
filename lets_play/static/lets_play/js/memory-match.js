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
    if (!response.ok) throw new Error('Failed to update moogles.');
    return response.json();
  })
  .then(data => {
    console.log('Moogles updated:', data);
    const moogleDisplay = document.querySelector(".moogle-count");
    if (moogleDisplay && data.new_total !== undefined) {
      moogleDisplay.innerHTML = `
        <img
          src="https://res.cloudinary.com/ddmslr9na/image/upload/v1752501444/medievil-castle-web180x180_dzlrhv.webp"
          alt="Moogle"
          style="width: 30px; height: 30px; vertical-align: middle"
        />
        × ${data.new_total}
      `;
    }
  })
  .catch(error => {
    console.error('Error sending score:', error);
  });
}

function endGame() {
  clearInterval(timer);
  gameActive = false;
  startBtn.disabled = false;

  if (score > 0) {
    sendScoreToServer(score).then(() => {
      // Show modal after moogles update
      if (window.showGameResultModal) {
        window.showGameResultModal();
      }
    });
  } else {
    // Show modal even if score is 0
    if (window.showGameResultModal) {
      window.showGameResultModal();
    }
  }
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
