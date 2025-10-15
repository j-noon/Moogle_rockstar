document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  const startBtn = document.getElementById("mathGame_startBtn");
  const questionDisplay = document.getElementById("mathGame_sumDisplay");
  const answerInput = document.getElementById("mathGame_answerInput");
  const scoreDisplay = document.getElementById("mathGame_scoreDisplay");
  const timerDisplay = document.getElementById("mathGame_timerDisplay");
   const UID = (typeof window !== "undefined" && window.CURRENT_USER_ID) ? String(window.CURRENT_USER_ID) : "anon";

  let score = 0;
  let timeLeft = 60;
  let currentAnswer = 0;
  let timer = null;

  // token
  let playToken = null;

  // === 1-minute cooldown (per user, per game) ===
  const MATH_COOLDOWN_MS = 60 * 1000;
  const MATH_CD_KEY = `${UID}:math_game_cd_until`;
  let mathCdTimer = null;
  const mathIdleText = startBtn ? (startBtn.textContent || "Start") : "Start";

  function math_secondsLeft(untilMs) {
    return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
  }

  function math_updateCooldownUI() {
    if (!startBtn) return;

    if (mathCdTimer) {
      clearInterval(mathCdTimer);
      mathCdTimer = null;
    }
    const untilStr = localStorage.getItem(MATH_CD_KEY);
    const until = untilStr ? parseInt(untilStr, 10) : 0;

    if (until > Date.now()) {
      startBtn.disabled = true;
      startBtn.classList.add("is-cooling-down");
      const tick = () => {
        const s = math_secondsLeft(until);
        if (s > 0) {
          startBtn.textContent = `${mathIdleText} (${s}s)`;
        } else {
          clearInterval(mathCdTimer);
          mathCdTimer = null;
          startBtn.disabled = false;
          startBtn.classList.remove("is-cooling-down");
          startBtn.textContent = mathIdleText;
          localStorage.removeItem(MATH_CD_KEY);
        }
      };
      tick();
      mathCdTimer = setInterval(tick, 1000);
    } else {
      startBtn.disabled = false;
      startBtn.classList.remove("is-cooling-down");
      startBtn.textContent = mathIdleText;
      localStorage.removeItem(MATH_CD_KEY);
    }
  }

  function math_beginCooldown() {
    const until = Date.now() + MATH_COOLDOWN_MS;
    localStorage.setItem(MATH_CD_KEY, String(until));
    math_updateCooldownUI();
  }
  // === end cooldown ===

  function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i += 1) {
        const cookie = cookies[i].trim();
        if (cookie.indexOf(name + "=") === 0) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  function fetchPlayToken(gameKey, maxAward) {
    return fetch("/lets-play/start/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken")
      },
      body: JSON.stringify({ game: gameKey, max_award: maxAward })
    })
      .then(function (r) {
        if (!r.ok) {
          return r.json().catch(() => ({})).then(errJson => {
            const msg = errJson && errJson.detail ? errJson.detail : `HTTP ${r.status}`;
            throw new Error("Failed to start play session: " + msg);
          });
        }
        return r.json();
      })
      .then(function (data) {
        playToken = data.play_token;
        return data;
      });
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
      body: JSON.stringify({ score: scoreToSend, play_token: playToken }),
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": getCookie("csrftoken")
      },
      method: "POST"
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Network error");
        return response.json();
      })
      .then(function (data) {
        const sel = "#user-profile .user-text .moogle-count";
        const moogleDisplay = document.querySelector(sel);
        if (moogleDisplay && data.new_total !== undefined) {
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
      })
      .catch(function (err) {
        console.error("Failed to update moogles:", err);
        alert("Failed to update moogles.");
        return null;
      });
  }

  function startGameAfterToken() {
    score = 0;
    timeLeft = 60;
    updateScore();
    updateTimer();
    generateQuestion();

    answerInput.disabled = false;
    answerInput.focus();

    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      timeLeft -= 1;
      updateTimer();

      if (timeLeft <= 0) {
        clearInterval(timer);
        const overMsg = "Time's up! Final Score: " + score;
        questionDisplay.textContent = overMsg;
        answerInput.disabled = true;

        if (playToken) {
          sendScoreToServer(score).finally(function () {
            // trigger win modal (both styles supported)
            if (window.showGameResultModal) {
              window.showGameResultModal();
            } else {
              try { localStorage.setItem("showWinModal", String(score)); } catch (e) {}
            }
          });
        } else {
          alert("No play token. Please start again.");
          if (window.showGameResultModal) {
            window.showGameResultModal();
          } else {
            try { localStorage.setItem("showWinModal", String(score)); } catch (e) {}
          }
        }
      }
    }, 1000);
  }

  function startGame() {
    if (!startBtn) return;

    // Block if cooling
    const untilStr = localStorage.getItem(MATH_CD_KEY);
    const until = untilStr ? parseInt(untilStr, 10) : 0;
    if (until > Date.now()) {
      math_updateCooldownUI();
      return;
    }

    const gameKey = startBtn.dataset.gameKey || "math-game";

    // fetch token then start; begin cooldown only after a successful token
    fetchPlayToken(gameKey, 50)
      .then(function () {
        math_beginCooldown();
        startGameAfterToken();
      })
      .catch(function (err) {
        console.error("Token start failed:", err);
        alert("Could not start game (token). Try again.");
        math_updateCooldownUI();
      });
  }

  // init
  math_updateCooldownUI();

  startBtn.addEventListener("click", function () {
    startGame();
  });

  answerInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      const userAnswer = parseInt(answerInput.value, 10);
      if (!Number.isNaN(userAnswer) && userAnswer === currentAnswer) {
        score += 1;
        updateScore();
        generateQuestion();
        answerInput.value = "";
        answerInput.focus();
      }
    }
  });
});