document.addEventListener("DOMContentLoaded", function () {

  // ====== GAME STATE ======
  const alistairState = {
    health: 3,
    inventory: [],
    visitedRooms: [],
    roomHistory: [],
    currentRoom: null,
    started: false,
  };

  // ====== HOW TO PLAY INTRO SCREEN ======
  function alistairShowHowToScreen() {
    const roomContainer = document.getElementById('alistair-room-container');
    if (!roomContainer) return;

    // no room background yet for intro
    roomContainer.style.backgroundImage = 'none';

    roomContainer.innerHTML = `
      <div id="alistair-howto-screen">
        <h1 class="alistair-howto-title">Alistair!</h1>
        <div class="alistair-howto-tagline">
          "Every choice matters, will you choose wisely?"
        </div>

        <div>
          <h2 class="alistair-howto-heading">How to Play:</h2>
          <ul class="alistair-howto-list">
            <li>Use your <strong>mouse</strong> to explore and make choices.</li>
            <li><strong>Read every dialogue</strong> carefully — every word matters.</li>
            <li><strong>Search everywhere</strong> — if something looks suspicious, it’s there for a reason.</li>
            <li>You start with <strong>3 lives (hearts)</strong>.</li>
            <li>If your hearts hit <strong>0</strong>, you <strong>die</strong>.</li>
            <li><strong>Choices matter</strong> — what you do changes what happens next.</li>
            <li>Some secrets can be <strong>missed forever</strong>.</li>
            <li><strong>Hidden items</strong> can change your fate.</li>
            <li>Evil is always watching…</li>
          </ul>
        </div>

        <div id="alistair-howto-bgface"></div>
      </div>
    `;
  }

  // === Dialogue controller (per-room narrative lines) ===
  let dialogueQueue = [];
  let dialogueOnComplete = null;
  let dialogueIndex = 0;

  function alistairStartDialogue(linesArray, onComplete) {
    dialogueQueue = Array.isArray(linesArray) ? linesArray : [];
    dialogueOnComplete = typeof onComplete === 'function' ? onComplete : null;
    dialogueIndex = 0;

    const bar = document.getElementById('alistair-dialogue-bar');
    const textEl = document.getElementById('alistair-dialogue-text');
    const nextBtn = document.getElementById('alistair-dialogue-next');

    if (!bar || !textEl || !nextBtn) return;

    if (dialogueQueue.length === 0) {
      // nothing to say, just hide
      bar.classList.add('hidden');
      if (dialogueOnComplete) dialogueOnComplete();
      return;
    }

    // show first line
    textEl.textContent = dialogueQueue[0];
    bar.classList.remove('hidden');

    // restore normal Next button look/behavior
    alistairResetNextButton();
  }

  function alistairAdvanceDialogue() {
    dialogueIndex += 1;
    const bar = document.getElementById('alistair-dialogue-bar');
    const textEl = document.getElementById('alistair-dialogue-text');

    if (dialogueIndex < dialogueQueue.length) {
      // still more lines
      textEl.textContent = dialogueQueue[dialogueIndex];
      return;
    }

    // we're done with this block
    bar.classList.add('hidden');

    if (dialogueOnComplete) {
      const cb = dialogueOnComplete;
      dialogueOnComplete = null;
      cb(); // e.g. show choices now
    }
  }

  // ====== DIALOGUE CHOICE SYSTEM ======
  // Show a question + buttons instead of "Next"
  function alistairShowChoices(questionText, choicesArray) {
    const bar = document.getElementById('alistair-dialogue-bar');
    const textEl = document.getElementById('alistair-dialogue-text');
    const nextBtn = document.getElementById('alistair-dialogue-next');

    if (!bar || !textEl || !nextBtn) return;

    bar.classList.remove('hidden');
    textEl.textContent = questionText;

    // wipe the Next button and replace with choice buttons
    nextBtn.replaceChildren();
    choicesArray.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'alistair-ctrl-btn';
      btn.textContent = choice.label;
      btn.addEventListener('click', () => {
        choice.onClick();
      });
      nextBtn.appendChild(btn);
    });
  }

  // Put the bottom bar back into "story mode" (single Next button)
  function alistairResetNextButton() {
    const nextBtn = document.getElementById('alistair-dialogue-next');
    if (!nextBtn) return;
    nextBtn.replaceChildren();       // clear any previous choice buttons
    nextBtn.textContent = "Next";
    nextBtn.onclick = alistairAdvanceDialogue;
  }

  // ====== IMAGE OVERLAY (bucket close-up, later notes, etc.) ======
  function alistairShowImageOverlay(imgUrl, captionText, onClose) {
    const overlay = document.getElementById('alistair-image-overlay');
    const imgEl = document.getElementById('alistair-overlay-img');
    const capEl = document.getElementById('alistair-overlay-caption');

    if (!overlay || !imgEl || !capEl) return;

    imgEl.src = imgUrl;
    capEl.textContent = captionText || "";

    overlay.classList.remove('hidden');

    function handleClose() {
      overlay.classList.add('hidden');
      overlay.removeEventListener('click', handleClose);
      if (onClose) onClose();
    }

    // click anywhere to close
    overlay.addEventListener('click', handleClose);
  }

  // ====== HELPERS: UI RENDER ======
  function alistairRenderHearts() {
    const heartsEl = document.getElementById('alistair-hearts');
    const fullHearts = "❤️".repeat(alistairState.health);
    const emptyHearts = "🖤".repeat(3 - alistairState.health);
    heartsEl.textContent = fullHearts + emptyHearts;
  }

  function alistairRenderInventory() {
    const listEl = document.getElementById('alistair-inventory-list');
    listEl.innerHTML = '';
    if (alistairState.inventory.length === 0) {
      const li = document.createElement('li');
      li.textContent = '(empty)';
      listEl.appendChild(li);
      return;
    }
    alistairState.inventory.forEach(itemId => {
      const li = document.createElement('li');
      li.textContent = itemId;
      listEl.appendChild(li);
    });
  }

  function alistairTakeDamage(amount = 1) {
    alistairState.health = Math.max(0, alistairState.health - amount);
    alistairRenderHearts();
    if (alistairState.health === 0) {
      alistairShowGameOver("You have perished. Your soul is forfeit.");
    }
  }

  function alistairAddItem(itemId) {
    if (!alistairState.inventory.includes(itemId)) {
      alistairState.inventory.push(itemId);
      alistairRenderInventory();
    }
  }

  // ====== BUCKET PICKUP FLOW ======
  // This is the "yes pick it up" path and also what runs if you click the hotspot later
  function alistairHandleBucketPickupFlow() {
    // show bucket zoomed in
    alistairResetNextButton();

    alistairShowImageOverlay(
      "https://res.cloudinary.com/ddmslr9na/image/upload/v1761533389/ag-bucket_m4kfer.png",
      "Old wooden bucket. Iron handle. Damp. Smells like rot.",
      () => {
        // overlay closed -> they have effectively picked it up
        alistairAddItem("Bucket");

        // remove bucket hotspot from scene now that we have it
        const hotspot = document.getElementById('alistair-bucket-hotspot');
        if (hotspot) {
          hotspot.remove();
        }

        // now ask if they want to stick their hand in
        alistairShowChoices(
          "Do you reach inside the bucket?",
          [
            {
              label: "Reach in",
              onClick: () => {
                alistairResetNextButton();

                // pain moment
                alistairTakeDamage(1);

                const hurtLines = [
                  "You reach in. Something sharp snaps at your hand.",
                  "Ouch. That hurt.",
                  "A crab scrambles out, skittering into the dark.",
                  "Oh... there's a note at the bottom.",
                  "It reads..."
                  // TODO: later, show note art + actual note text
                ];

                alistairStartDialogue(hurtLines, () => {
                  // after reading note we can continue story / unlock next room
                });
              }
            },
            {
              label: "Don't",
              onClick: () => {
                alistairResetNextButton();

                const passLines = [
                  "You decide not to stick your hand into unknown slime.",
                  "The bucket hums, like it's breathing. You pretend you didn't notice."
                ];

                alistairStartDialogue(passLines, () => {
                  // safe branch ends here for now
                });
              }
            }
          ]
        );
      }
    );
  }

  // ====== ROOM MANAGEMENT ======
  function alistairGoToRoom(roomId, opts = {}) {
    console.log("Alistair: alistairGoToRoom ->", roomId);

    const recordHistory = opts.recordHistory !== false; // default true
    const nextRoom = ALISTAIR_ROOMS[roomId];
    console.log("Alistair: nextRoom is", nextRoom);

    if (!nextRoom) {
      console.error("Unknown room:", roomId);
      return;
    }

    // Save where we've been so Back works
    if (alistairState.currentRoom && recordHistory) {
      alistairState.roomHistory.push(alistairState.currentRoom.id);
    }

    // Set current room
    alistairState.currentRoom = nextRoom;

    // Track visited for the Map menu
    if (!alistairState.visitedRooms.includes(nextRoom.id)) {
      alistairState.visitedRooms.push(nextRoom.id);
    }

    // Update slim header room name
    const roomNameEl = document.getElementById('alistair-room-name');
    if (roomNameEl) {
      roomNameEl.textContent = nextRoom.name || '';
    }

    // Render background
    const roomContainer = document.getElementById('alistair-room-container');
    roomContainer.style.backgroundImage = nextRoom.background
      ? `url('${nextRoom.background}')`
      : 'none';

    // Inject room hotspots / interactables
    roomContainer.innerHTML = '';
    const rawHtml = nextRoom.render(alistairState);
    if (rawHtml && rawHtml.trim() !== "") {
      roomContainer.innerHTML = rawHtml;
    }

    // Hide dialogue until the room narrates
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) {
      bar.classList.add('hidden');
    }

    // Let the room handle its narrative / choices / hotspot wiring
    if (typeof nextRoom.onEnter === 'function') {
      nextRoom.onEnter(alistairState);
    }

    // Refresh HUD
    alistairRenderHearts();
    alistairRenderInventory();
  }

  function alistairGoBack() {
    const prev = alistairState.roomHistory.pop();
    if (prev) {
      alistairGoToRoom(prev, { recordHistory: false });
    }
  }

  // ====== MAP MODAL ======
  function alistairOpenMap() {
    const modal = document.getElementById('alistair-map-modal');
    const list = document.getElementById('alistair-map-list');
    list.innerHTML = '';

    alistairState.visitedRooms.forEach(roomId => {
      const roomObj = ALISTAIR_ROOMS[roomId];
      if (!roomObj) return;
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.textContent = roomObj.name;
      btn.addEventListener('click', () => {
        alistairCloseMap();
        alistairGoToRoom(roomId);
      });
      li.appendChild(btn);
      list.appendChild(li);
    });

    modal.classList.remove('hidden');
  }

  function alistairCloseMap() {
    document.getElementById('alistair-map-modal').classList.add('hidden');
  }

  // ====== EXPAND / SHRINK VIEW ======
  function alistairToggleExpand() {
    const wrapper = document.getElementById('alistair-wrapper');
    const btn = document.getElementById('alistair-expand-btn');
    if (wrapper.classList.contains('alistair-expanded')) {
      wrapper.classList.remove('alistair-expanded');
      wrapper.classList.add('alistair-embedded');
      btn.textContent = 'Expand';
    } else {
      wrapper.classList.remove('alistair-embedded');
      wrapper.classList.add('alistair-expanded');
      btn.textContent = 'Close';
    }
  }

  // ====== GAME OVER / ENDINGS ======
  function alistairShowGameOver(messageText) {
    const modal = document.getElementById('alistair-gameover-modal');
    const content = document.getElementById('alistair-gameover-content');
    content.innerHTML = `
      <h2>THE END</h2>
      <p>${messageText}</p>
      <button id="alistair-restart-btn">Restart</button>
    `;
    modal.classList.remove('hidden');

    setTimeout(() => {
      const restartBtn = document.getElementById('alistair-restart-btn');
      if (restartBtn) {
        restartBtn.addEventListener('click', () => {
          modal.classList.add('hidden');
          alistairRestart();
        });
      }
    }, 0);
  }

  function alistairRestart() {
    alistairState.health = 3;
    alistairState.inventory = [];
    alistairState.visitedRooms = [];
    alistairState.roomHistory = [];
    alistairState.currentRoom = null;
    alistairState.started = false;

    // Show intro screen again on restart
    alistairShowHowToScreen();
    alistairRenderHearts();
    alistairRenderInventory();
  }

  // ====== ROOM DEFINITIONS ======

  // ENTRANCE GATES
  const AlistairRoom_EntranceGates = {
    id: "entrance_gates",
    name: "Entrance Gates",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761530233/ag-gates-closed_ldpuwk.png",

    render(gameState) {
      return ``;
    },

    onEnter(gameState) {
      // Intro lore lines at the gates
      const introLines = [
        "The air is colder here. You shouldn't even be on these grounds.",
        "They said Alistair vanished beyond these gates. They said anyone who looks for him doesn't come back.",
        "This is a click-only investigation. No turning back once you're inside.",
        "Your choices will have consequences. Your safety is not guaranteed."
      ];

      alistairStartDialogue(introLines, () => {
        // After intro, ask the big question
        alistairShowChoices(
          "Do you dare to enter? Once you pass these gates you might never return.",
          [
            {
              label: "Yes. Open the gates.",
              onClick: () => {
                alistairResetNextButton();
                alistairPlayGateCutsceneThenGoWell();
              }
            },
            {
              label: "No. I value my life.",
              onClick: () => {
                alistairResetNextButton();
                alistairShowGameOver(
                  "You turn and flee. The world will never know what waited beyond the gates. Coward's ending."
                );
              }
            }
          ]
        );
      });
    }
  };

  // THE WELL
  const AlistairRoom_TheWell = {
    id: "the_well",
    name: "The Well",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761530097/adventure-gardens-well-NEEDSSIGNS_aww91m.png",

    render(gameState) {
      // Show the bucket hotspot in the scene IF they don't already have the bucket
      const hasBucket = gameState.inventory.includes("Bucket");

      return `
        ${hasBucket ? '' : `
          <div id="alistair-bucket-hotspot" class="alistair-hotspot-bucket">
            <img
              src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761533389/ag-bucket_m4kfer.png"
              alt="Bucket on the floor"
              class="alistair-hotspot-bucket-img">
          </div>
        `}
      `;
    },

    onEnter(gameState) {

      // Attach click handler to the bucket hotspot (if it's there)
      const hotspot = document.getElementById('alistair-bucket-hotspot');
      if (hotspot) {
        hotspot.addEventListener('click', () => {
          // Player ignored it in dialogue but then clicks in the world
          alistairShowChoices(
            "Do you want to pick up the bucket?",
            [
              {
                label: "Pick it up",
                onClick: () => {
                  alistairHandleBucketPickupFlow();
                }
              },
              {
                label: "Leave it",
                onClick: () => {
                  alistairResetNextButton();
                  const leaveLines = [
                    "You leave the bucket where it lies.",
                    "You swear it turned to watch you when you walked away."
                  ];
                  alistairStartDialogue(leaveLines, () => {});
                }
              }
            ]
          );
        });
      }

      // Arrival narration at the Well
      const wellIntroLines = [
        "The gates slam shut, almost welded.",
        "Is that the tree whispering to me? Distant voices.",
        "…Is that a well up ahead?",
        "It doesn't smell very well.",
        "As you approach the well you see a bucket on the floor."
      ];

      alistairStartDialogue(wellIntroLines, () => {
        // First-time prompt: pick it up right now?
        alistairShowChoices(
          "Do you pick up the bucket?",
          [
            {
              label: "Pick it up",
              onClick: () => {
                alistairHandleBucketPickupFlow();
              }
            },
            {
              label: "Leave it",
              onClick: () => {
                alistairResetNextButton();
                const leaveLines = [
                  "You step around the bucket.",
                  "It feels wrong to touch it. Like it's waiting for you."
                ];
                alistairStartDialogue(leaveLines, () => {
                  // nothing else immediately; hotspot stays in the room
                });
              }
            }
          ]
        );
      });
    }
  };

  // Room registry
  const ALISTAIR_ROOMS = {
    entrance_gates: AlistairRoom_EntranceGates,
    the_well: AlistairRoom_TheWell,
  };

  // ====== CUTSCENE HANDLER ======
  function alistairPlayGateCutsceneThenGoWell() {
    const roomContainer = document.getElementById('alistair-room-container');

    // hide dialogue while cutscene is playing
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) bar.classList.add('hidden');

    roomContainer.style.backgroundImage = 'none';
    roomContainer.innerHTML = `
      <video id="alistair-gate-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;">
        <source src="https://res.cloudinary.com/ddmslr9na/video/upload/v1761530014/ag-gates-start_tborui.mp4" type="video/mp4">
      </video>
      <div class="alistair-room-inner">
        <p>The gates groan open...</p>
      </div>
    `;

    const vid = document.getElementById('alistair-gate-video');
    if (vid) {
      vid.addEventListener('ended', () => {
        alistairGoToRoom('the_well');
      });
    } else {
      // fallback if <video> didn't mount
      alistairGoToRoom('the_well');
    }
  }

  // ====== START GAME ======
  function alistairStartGame() {
    console.log("Alistair: starting game");
    alistairState.started = true;
    alistairRenderHearts();
    alistairRenderInventory();
    console.log("Alistair: going to entrance_gates");
    alistairGoToRoom('entrance_gates');
  }

  // ====== INIT BUTTONS / EVENT LISTENERS ======
  const playBtn = document.getElementById('advent-btn');
  const backBtn = document.getElementById('alistair-back-btn');
  const mapBtn = document.getElementById('alistair-map-btn');
  const expandBtn = document.getElementById('alistair-expand-btn');
  const mapCloseBtn = document.getElementById('alistair-map-close');

  if (playBtn) {
    console.log("Alistair: found Play button");
    playBtn.addEventListener('click', () => {
      console.log("Alistair: Play clicked");

      if (!alistairState.started) {
        // remove intro screen
        const howto = document.getElementById('alistair-howto-screen');
        if (howto) {
          howto.remove();
        }

        // now start the actual game
        alistairStartGame();
      } else {
        // already started; do nothing for now
        // optional future: alistairRestart();
      }
    });
  } else {
    console.log("Alistair: NO Play button found");
  }

  if (backBtn) {
    backBtn.addEventListener('click', alistairGoBack);
  }

  if (mapBtn) {
    mapBtn.addEventListener('click', alistairOpenMap);
  }

  if (mapCloseBtn) {
    mapCloseBtn.addEventListener('click', alistairCloseMap);
  }

  if (expandBtn) {
    expandBtn.addEventListener('click', alistairToggleExpand);
  }

  // ====== INITIAL LOAD ======
  // Show HUD info and the How to Play overlay right away
  alistairShowHowToScreen();
  alistairRenderHearts();
  alistairRenderInventory();

});