const typingGame_startBtn = document.getElementById('typingGame_startBtn');
const typingGame_wordDisplay = document.getElementById('typingGame_wordDisplay');
const typingGame_input = document.getElementById('typingGame_input');
const typingGame_scoreDisplay = document.getElementById('typingGame_score');
const typingGame_timerDisplay = document.getElementById('typingGame_timer');
const typingGame_wordList = document.getElementById('typingGame_wordList');

let typingGame_score = 0;
let typingGame_timeLeft = 60;
let typingGame_timer;
let typingGame_gameActive = false;
let typingGame_currentWord = "";

const typingGame_wordsByLength = {
  3: ["mud", "sun", "hat"],
  4: ["wolf", "dark"],
  5: ["crash", "flame", "vigor", "blame", "brick"],
  6: ["battle", "puzzle", "hunter", "rocket", "throne"],
  7: ["kingdom", "journey", "monster", "villain", "picture"],
  8: ["triangle", "sandwich", "mountain", "keyboard", "campaign"],
  9: ["adventure", "strategic", "exploring", "discovery", "fantastic"]
};

function typingGame_getRandomWord(length) {
  const list = typingGame_wordsByLength[length];
  return list[Math.floor(Math.random() * list.length)];
}

function typingGame_getWordForTime(t) {
  if (t > 50) return typingGame_getRandomWord(5);
  if (t > 40) return typingGame_getRandomWord(6);
  if (t > 30) return typingGame_getRandomWord(7);
  if (t > 20) return typingGame_getRandomWord(8);
  return typingGame_getRandomWord(9);
}

function typingGame_displayNewWord() {
  typingGame_currentWord = typingGame_getWordForTime(typingGame_timeLeft);
  typingGame_wordDisplay.textContent = typingGame_currentWord;
  typingGame_wordDisplay.classList.remove('fade-word');
  void typingGame_wordDisplay.offsetWidth; // trigger reflow
  typingGame_wordDisplay.classList.add('fade-word');
}

function typingGame_updateScoreDisplay() {
  typingGame_scoreDisplay.textContent = `Score: ${typingGame_score}`;
}

function typingGame_updateTimerDisplay() {
  typingGame_timerDisplay.textContent = `Time: ${typingGame_timeLeft}s`;
}

function typingGame_startGame() {
  typingGame_score = 0;
  typingGame_timeLeft = 60;
  typingGame_gameActive = true;
  typingGame_input.value = '';
  typingGame_input.disabled = false;
  typingGame_wordList.innerHTML = '';
  typingGame_input.focus();

  typingGame_updateScoreDisplay();
  typingGame_updateTimerDisplay();
  typingGame_displayNewWord();

  typingGame_timer = setInterval(() => {
    typingGame_timeLeft--;
    typingGame_updateTimerDisplay();

    if (typingGame_timeLeft <= 0) {
      clearInterval(typingGame_timer);
      typingGame_gameActive = false;
      typingGame_input.disabled = true;
      typingGame_wordDisplay.textContent = `Time's up! Final Score: ${typingGame_score}`;
      
      // Send score to server
      if (typingGame_score > 0) {
        typingGame_sendScoreToServer(typingGame_score);
      }
    }
  }, 1000);
}

typingGame_input.addEventListener('input', () => {
  if (!typingGame_gameActive) return;

  if (typingGame_input.value.trim().toLowerCase() === typingGame_currentWord.toLowerCase()) {
    typingGame_score += 1;
    typingGame_updateScoreDisplay();

    // Add word to log
    const li = document.createElement('li');
    li.textContent = typingGame_currentWord;
    typingGame_wordList.appendChild(li);

    typingGame_input.value = '';
    typingGame_displayNewWord();
  }
});

typingGame_startBtn.addEventListener('click', typingGame_startGame);

function typingGame_getCookie(name) {
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

function typingGame_sendScoreToServer(scoreToSend) {
  fetch('/lets-play/update_moogles/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': typingGame_getCookie('csrftoken'),
    },
    body: JSON.stringify({ score: scoreToSend }),
  })
  .then(response => {
    if (!response.ok) throw new Error('Failed to update moogles.');
    return response.json();
  })
  .then(data => {
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