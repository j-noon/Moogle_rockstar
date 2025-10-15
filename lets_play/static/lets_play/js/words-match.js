document.addEventListener("DOMContentLoaded", function () {
  const typingGame_startBtn = document.getElementById("typingGame_startBtn");
  const typingGame_wordDisplay = document.getElementById("typingGame_wordDisplay");
  const typingGame_input = document.getElementById("typingGame_input");
  const typingGame_scoreDisplay = document.getElementById("typingGame_score");
  const typingGame_timerDisplay = document.getElementById("typingGame_timer");
  const typingGame_wordList = document.getElementById("typingGame_wordList");
  const UID = (typeof window !== "undefined" && window.CURRENT_USER_ID) ? String(window.CURRENT_USER_ID) : "anon";

  let typingGame_score = 0;
  let typingGame_timeLeft = 60;
  let typingGame_timer;
  let typingGame_gameActive = false;
  let typingGame_currentWord = "";

  // token
  let typingGame_playToken = null;

  // === 1-minute cooldown (per user, per game) ===
  const TG_COOLDOWN_MS = 60 * 1000;
  const TG_CD_KEY = `${UID}:typing_game_cd_until`;
  let tgCdTimer = null;
  const tgIdleText = typingGame_startBtn ? (typingGame_startBtn.textContent || "Start") : "Start";

  function tg_secondsLeft(untilMs) {
    return Math.max(0, Math.ceil((untilMs - Date.now()) / 1000));
  }

  function typingGame_updateCooldownUI() {
    if (!typingGame_startBtn) return;

    if (tgCdTimer) {
      clearInterval(tgCdTimer);
      tgCdTimer = null;
    }
    const untilStr = localStorage.getItem(TG_CD_KEY);
    const until = untilStr ? parseInt(untilStr, 10) : 0;

    if (until > Date.now()) {
      typingGame_startBtn.disabled = true;
      typingGame_startBtn.classList.add("is-cooling-down");
      const tick = () => {
        const s = tg_secondsLeft(until);
        if (s > 0) {
          typingGame_startBtn.textContent = `${tgIdleText} (${s}s)`;
        } else {
          clearInterval(tgCdTimer);
          tgCdTimer = null;
          typingGame_startBtn.disabled = false;
          typingGame_startBtn.classList.remove("is-cooling-down");
          typingGame_startBtn.textContent = tgIdleText;
          localStorage.removeItem(TG_CD_KEY);
        }
      };
      tick();
      tgCdTimer = setInterval(tick, 1000);
    } else {
      typingGame_startBtn.disabled = false;
      typingGame_startBtn.classList.remove("is-cooling-down");
      typingGame_startBtn.textContent = tgIdleText;
      localStorage.removeItem(TG_CD_KEY);
    }
  }

  function typingGame_beginCooldown() {
    const until = Date.now() + TG_COOLDOWN_MS;
    localStorage.setItem(TG_CD_KEY, String(until));
    typingGame_updateCooldownUI();
  }
  // === end cooldown ===

  const typingGame_wordsByLength = {
    "3": ["mud", "sun", "hat"],
    "4": ["wolf", "dark"],
    "5": ["crash", "flame", "vigor", "blame", "brick"],
    "6": ["battle", "puzzle", "hunter", "rocket", "throne"],
    "7": ["kingdom", "journey", "monster", "villain", "picture"],
    "8": ["triangle", "sandwich", "mountain", "keyboard", "campaign"],
    "9": ["adventure", "strategic", "exploring", "discovery", "fantastic"]
  };

  function typingGame_getRandomWord(length) {
    const list = typingGame_wordsByLength[String(length)];
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
    typingGame_wordDisplay.classList.remove("fade-word");
    window.requestAnimationFrame(function () {
      typingGame_wordDisplay.classList.add("fade-word");
    });
  }

  function typingGame_updateScoreDisplay() {
    typingGame_scoreDisplay.textContent = "Score: " + typingGame_score;
  }

  function typingGame_updateTimerDisplay() {
    typingGame_timerDisplay.textContent = "Time: " + typingGame_timeLeft + "s";
  }

  function typingGame_getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== "") {
      const cookies = document.cookie.split(";");
      for (let i = 0; i < cookies.length; i += 1) {
        const cookie = cookies[i].trim();
        if (cookie.substring(0, name.length + 1) === (name + "=")) {
          cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
          break;
        }
      }
    }
    return cookieValue;
  }

  // token fetcher (gameKey from data attribute)
  function typingGame_fetchPlayToken(gameKey, maxAward) {
    return fetch("/lets-play/start/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": typingGame_getCookie("csrftoken")
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
        typingGame_playToken = data.play_token;
        return data;
      });
  }

  function typingGame_sendScoreToServer(scoreToSend) {
    return fetch("/lets-play/update_moogles/", {
      body: JSON.stringify({ score: scoreToSend, play_token: typingGame_playToken }),
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": typingGame_getCookie("csrftoken")
      },
      method: "POST"
    })
      .then(function (response) {
        if (!response.ok) throw new Error("Failed to update moogles.");
        return response.json();
      })
      .then(function (data) {
        const moogleDisplay = document.querySelector(".moogle-count");
        if (moogleDisplay && data.new_total !== undefined) {
          const imgEl = document.createElement("img");
          const baseUrl = "https://res.cloudinary.com/ddmslr9na/image/upload/";
          const imgPath = "v1752501444/medievil-castle-web180x180_dzlrhv.webp";
          imgEl.src = baseUrl + imgPath;
          imgEl.alt = "Moogle";
          imgEl.style.width = "30px";
          imgEl.style.height = "30px";
          imgEl.style.verticalAlign = "middle";

          moogleDisplay.innerHTML = "";
          moogleDisplay.appendChild(imgEl);
          moogleDisplay.appendChild(
            document.createTextNode(" × " + data.new_total)
          );
        }
        return null;
      })
      .catch(function (error) {
        console.error("Error sending score:", error);
        return null;
      });
  }

  function typingGame_startGame() {
    if (!typingGame_startBtn) return;

    // Block if cooling
    const untilStr = localStorage.getItem(TG_CD_KEY);
    const until = untilStr ? parseInt(untilStr, 10) : 0;
    if (until > Date.now()) {
      typingGame_updateCooldownUI();
      return;
    }

    const gameKey = typingGame_startBtn.dataset.gameKey || "words-match";

    typingGame_fetchPlayToken(gameKey, 50)
      .then(function () {
        // begin cooldown after successful token
        typingGame_beginCooldown();

        typingGame_score = 0;
        typingGame_timeLeft = 60;
        typingGame_gameActive = true;
        typingGame_input.value = "";
        typingGame_input.disabled = false;
        typingGame_wordList.innerHTML = "";
        typingGame_input.focus();

        typingGame_updateScoreDisplay();
        typingGame_updateTimerDisplay();
        typingGame_displayNewWord();

        typingGame_timer = window.setInterval(function () {
          typingGame_timeLeft -= 1;
          typingGame_updateTimerDisplay();

          if (typingGame_timeLeft <= 0) {
            window.clearInterval(typingGame_timer);
            typingGame_gameActive = false;
            typingGame_input.disabled = true;

            const overMsg = "Time's up! Final Score: " + typingGame_score;
            typingGame_wordDisplay.textContent = overMsg;

            if (typingGame_score > 0) {
              if (typingGame_playToken) {
                typingGame_sendScoreToServer(typingGame_score).finally(function () {
                  // trigger win modal (both styles supported)
                  if (window.showGameResultModal) {
                    window.showGameResultModal();
                  } else {
                    try { localStorage.setItem("showWinModal", String(typingGame_score)); } catch (e) {}
                  }
                });
              } else {
                alert("No play token. Please start again.");
                if (window.showGameResultModal) {
                  window.showGameResultModal();
                } else {
                  try { localStorage.setItem("showWinModal", String(typingGame_score)); } catch (e) {}
                }
              }
            } else {
              // zero score still shows result modal for UX consistency
              if (window.showGameResultModal) {
                window.showGameResultModal();
              } else {
                try { localStorage.setItem("showWinModal", String(typingGame_score)); } catch (e) {}
              }
            }
          }
        }, 1000);
      })
      .catch(function (err) {
        console.error("Token start failed:", err);
        alert("Could not start game (token). Try again.");
        typingGame_updateCooldownUI();
      });
  }

  // input listener (unchanged logic)
  typingGame_input.addEventListener("input", function () {
    if (!typingGame_gameActive) return;

    const typed = typingGame_input.value.trim().toLowerCase();
    const target = typingGame_currentWord.toLowerCase();

    if (typed === target) {
      typingGame_score += 1;
      typingGame_updateScoreDisplay();

      const li = document.createElement("li");
      li.textContent = typingGame_currentWord;
      typingGame_wordList.appendChild(li);

      typingGame_input.value = "";
      typingGame_displayNewWord();
    }
  });

  // init cooldown UI & start button
  typingGame_updateCooldownUI();
  typingGame_startBtn.addEventListener("click", function () {
    typingGame_startGame();
  });
});