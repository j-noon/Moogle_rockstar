document.addEventListener("DOMContentLoaded", function () {

  // ====== GAME STATE ======
  const alistairState = {
    health: 3,
    // inventory now stores objects like { id, name, imgUrl }
    inventory: [],
    // journals store objects like { id, title, imgUrl }
    journals: [],
    visitedRooms: [],
    roomHistory: [],
    currentRoom: null,
    started: false,

    // modal open flags so we can close them properly
    isJournalOpen: false,
    isInventoryOpen: false,

    // 🟣 NEW: track if we've already shown the crossroads nav menu
    hasSeenCrossroads: false,
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

  // ====== DIALOGUE SYSTEM ======
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
    nextBtn.replaceChildren();
    nextBtn.textContent = "Next";
    nextBtn.onclick = alistairAdvanceDialogue;
  }

  // ====== IMAGE OVERLAY ======
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

  // ====== JOURNAL SYSTEM ======
  function alistairAddJournal(journalObj) {
    // journalObj: { id, title, imgUrl }
    if (!alistairState.journals.find(j => j.id === journalObj.id)) {
      alistairState.journals.push(journalObj);
    }
  }

  function alistairRenderJournalPanel() {
    const grid = document.getElementById('alistair-journal-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (alistairState.journals.length === 0) {
      // show some empty slots so it still looks like a grid
      for (let i = 0; i < 6; i++) {
        const slot = document.createElement('div');
        slot.className = 'alistair-grid-slot';
        slot.innerHTML = `
          <div class="alistair-grid-slot-title" style="opacity:.4;">(empty)</div>
        `;
        grid.appendChild(slot);
      }
      return;
    }

    alistairState.journals.forEach(journal => {
      const slot = document.createElement('div');
      slot.className = 'alistair-grid-slot';

      // show the note's image AND the title
      slot.innerHTML = `
        <img src="${journal.imgUrl}" alt="${journal.title}">
        <div class="alistair-grid-slot-title">${journal.title}</div>
      `;

      // clicking opens full-screen readable view
      slot.addEventListener('click', () => {
        alistairShowImageOverlay(
          journal.imgUrl,
          journal.title,
          () => {}
        );
      });

      grid.appendChild(slot);
    });
  }

  function alistairOpenJournal() {
    // close inventory if open
    if (alistairState.isInventoryOpen) {
      alistairCloseInventory();
    }

    const modal = document.getElementById('alistair-journal-modal');
    if (!modal) return;

    alistairRenderJournalPanel();
    modal.classList.remove('hidden');
    alistairState.isJournalOpen = true;
  }

  function alistairCloseJournal() {
    const modal = document.getElementById('alistair-journal-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    alistairState.isJournalOpen = false;
  }

  // ====== INVENTORY SYSTEM ======
  function alistairAddItem(itemObj) {
    // itemObj: { id, name, imgUrl }
    if (!alistairState.inventory.find(i => i.id === itemObj.id)) {
      alistairState.inventory.push(itemObj);
    }
  }

  // Big grid panel (modal)
  function alistairRenderInventoryPanel() {
    const grid = document.getElementById('alistair-inventory-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // For vibe: show 9 slots minimum (3 columns x 3 rows)
    const totalSlots = Math.max(9, alistairState.inventory.length);

    for (let i = 0; i < totalSlots; i++) {
      const slot = document.createElement('div');
      slot.className = 'alistair-grid-slot';

      const itemObj = alistairState.inventory[i];
      if (itemObj) {
        slot.innerHTML = `
          <img src="${itemObj.imgUrl}" alt="${itemObj.name}">
          <div class="alistair-grid-slot-title">${itemObj.name}</div>
        `;
        // later we could add click to "inspect item"
      } else {
        slot.innerHTML = `
          <div class="alistair-grid-slot-title" style="opacity:.4;">(empty)</div>
        `;
      }

      grid.appendChild(slot);
    }
  }

  function alistairOpenInventory() {
    // close journal if open
    if (alistairState.isJournalOpen) {
      alistairCloseJournal();
    }

    const modal = document.getElementById('alistair-inventory-modal');
    if (!modal) return;

    alistairRenderInventoryPanel();
    modal.classList.remove('hidden');
    alistairState.isInventoryOpen = true;
  }

  function alistairCloseInventory() {
    const modal = document.getElementById('alistair-inventory-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    alistairState.isInventoryOpen = false;
  }

  // ====== HELPERS: UI RENDER ======
  function alistairRenderHearts() {
    const heartsEl = document.getElementById('alistair-hearts');
    const fullHearts = "❤️".repeat(alistairState.health);
    const emptyHearts = "🖤".repeat(3 - alistairState.health);
    heartsEl.textContent = fullHearts + emptyHearts;
  }

  function alistairTakeDamage(amount = 1) {
    alistairState.health = Math.max(0, alistairState.health - amount);
    alistairRenderHearts();
    if (alistairState.health === 0) {
      alistairShowGameOver("You have perished. Your soul is forfeit.");
    }
  }

  // 🟣 NEW GLOBAL HELPER #1
  // reveal the sign hotspots in the Well, and wire them to navigation
  function alistairRevealSignsOnly() {
    const signs = document.querySelectorAll('.alistair-hotspot-sign');
    signs.forEach(sign => {
      sign.classList.remove('alistair-signs-hidden');
    });

    // FOREST click
    const forestSign = document.querySelector('.alistair-sign-forest');
    if (forestSign) {
      forestSign.addEventListener('click', () => {
        alistairPlayTransitionThenGoRoom('forest_grounds');
      });
    }

    // BARN click
    const barnSign = document.querySelector('.alistair-sign-barn');
    if (barnSign) {
      barnSign.addEventListener('click', () => {
        alistairPlayTransitionThenGoRoom('barn');
      });
    }

    // MANOR click (locked unless key)
    const manorSign = document.querySelector('.alistair-sign-manor');
    if (manorSign) {
      manorSign.addEventListener('click', () => {
        const hasKey = !!alistairState.inventory.find(i => i.id === "front_key");
        if (hasKey) {
          alistairPlayTransitionThenGoRoom('manor_front');
        } else {
          alistairResetNextButton();
          alistairStartDialogue([
            "You follow the path toward Manor de Montreux.",
            "The front door is chained from the inside.",
            "Something on the other side leans against the wood and listens.",
            "You’re going to need the front key."
          ], () => {});
        }
      });
    }
  }

  // 🟣 NEW GLOBAL HELPER #2
  // This replaces the old inline showCrossroadsChoice() so we can call it
  // from anywhere: bucket flow, skip-peek flow, after note, etc.
  function alistairShowCrossroadsChoiceFromWell() {
    // always make signs clickable/visible
    alistairRevealSignsOnly();

    // If we've already shown crossroads before, don't spam the menu again.
    // Just leave the scene free-roam (dialogue bar hidden).
    if (alistairState.hasSeenCrossroads) {
      const bar = document.getElementById('alistair-dialogue-bar');
      if (bar) {
        bar.classList.add('hidden');
      }
      return;
    }

    // First time we show crossroads
    alistairState.hasSeenCrossroads = true;

    alistairShowChoices(
      "Where do you go next?",
      [
        {
          label: "Forest Grounds",
          onClick: () => {
            alistairPlayTransitionThenGoRoom('forest_grounds');
          }
        },
        {
          label: "The Barn",
          onClick: () => {
            alistairPlayTransitionThenGoRoom('barn');
          }
        },
        {
          label: "Manor de Montreux",
          onClick: () => {
            const hasKey = !!alistairState.inventory.find(i => i.id === "front_key");
            if (hasKey) {
              alistairPlayTransitionThenGoRoom('manor_front');
            } else {
              alistairResetNextButton();
              alistairStartDialogue([
                "The manor door won't open for you.",
                "Not yet."
              ], () => {
                // after warning, call it again —
                // but because hasSeenCrossroads is now true,
                // this will just free-roam hide the bar.
                alistairShowCrossroadsChoiceFromWell();
              });
            }
          }
        },
        {
          label: "Stay here and look around",
          onClick: () => {
            alistairResetNextButton();
            alistairStartDialogue([
              "You linger by the well.",
              "The air tastes like rust.",
              "Something is watching to see what you choose."
            ], () => {
              // free-roam: leave hotspots active, hide bar
              alistairRevealSignsOnly();
              const bar = document.getElementById('alistair-dialogue-bar');
              if (bar) {
                bar.classList.add('hidden');
              }
            });
          }
        }
      ]
    );
  }

  // ====== BUCKET PICKUP FLOW ======
  // 🟣 CHANGED: now calls alistairShowCrossroadsChoiceFromWell()
  // after the bucket logic finishes, instead of local showCrossroadsChoice()
  function alistairHandleBucketPickupFlow() {
    alistairResetNextButton();

    alistairShowImageOverlay(
      "https://res.cloudinary.com/ddmslr9na/image/upload/v1761533389/ag-bucket_m4kfer.png",
      "Old wooden bucket. Iron handle. Damp. Smells like rot.",
      () => {
        alistairAddItem({
          id: "bucket",
          name: "Bucket",
          imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761533389/ag-bucket_m4kfer.png"
        });

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
                  "It looks... wet?"
                ];

                // After we show the hurtLines, we’ll show the note image,
                // then add that note to the journal.
                alistairStartDialogue(hurtLines, () => {
                  // Show the note as an overlay the player can read
                  alistairShowImageOverlay(
                    "https://res.cloudinary.com/ddmslr9na/image/upload/v1761611469/ag-note-from-crab_l56g6a.png",
                    "Soaked Note",
                    () => {
                      // When player closes the note overlay, add it to journal
                      alistairAddJournal({
                        id: "crab_note",
                        title: "Herberts Note",
                        imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761611469/ag-note-from-crab_l56g6a.png"
                      });

                      // 🟣 NEW: after finishing the whole bucket->hurt->note path,
                      // go to crossroads (will respect hasSeenCrossroads)
                      alistairShowCrossroadsChoiceFromWell();
                    }
                  );
                });
              }
            },
            // "Don't" path here is basically same as confirmSkipPeek()
            {
              label: "Don't",
              onClick: () => {
                alistairResetNextButton();

                const passLines = [
                  "You decide not to stick your hand into unknown slime.",
                  "The bucket hums, like it's breathing. You pretend you didn't notice."
                ];

                alistairStartDialogue(passLines, () => {
                  // 🟣 NEW: after deciding not to reach, also go to crossroads
                  // (again will respect hasSeenCrossroads)
                  alistairShowCrossroadsChoiceFromWell();
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
    alistairRenderInventoryPanel();
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
    alistairState.journals = [];
    alistairState.visitedRooms = [];
    alistairState.roomHistory = [];
    alistairState.currentRoom = null;
    alistairState.started = false;
    alistairState.isJournalOpen = false;
    alistairState.isInventoryOpen = false;

    // 🟣 UPDATED: reset crossroads flag on restart
    alistairState.hasSeenCrossroads = false;

    // Show intro screen again on restart
    alistairShowHowToScreen();
    alistairRenderHearts();
    
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

  //  THE WELL 
  const AlistairRoom_TheWell = {
    id: "the_well",
    name: "The Well",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761530097/adventure-gardens-well-NEEDSSIGNS_aww91m.png",

    render(gameState) {
      const hasBucket = !!gameState.inventory.find(i => i.id === "bucket");

      return `
        ${hasBucket ? '' : `
          <div id="alistair-bucket-hotspot" class="alistair-hotspot-bucket">
            <img
              src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761533389/ag-bucket_m4kfer.png"
              alt="Bucket on the floor"
              class="alistair-hotspot-bucket-img">
          </div>
        `}

        <!-- Forest sign -->
        <div class="alistair-hotspot-sign alistair-sign-forest alistair-signs-hidden">
          <img
            src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761681108/ag-sign-forest_rjwwkw.png"
            alt="Forest Grounds">
        </div>

        <!-- Manor sign -->
        <div class="alistair-hotspot-sign alistair-sign-manor alistair-signs-hidden">
          <img
            src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761681108/ag-sign-manor-house_fcc2uo.png"
            alt="Manor de Montreux">
        </div>

        <!-- Barn sign -->
        <div class="alistair-hotspot-sign alistair-sign-barn alistair-signs-hidden">
          <img
            src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761681109/ag-sign-barn_nintmu.png"
            alt="The Barn">
        </div>
      `;
    },

    onEnter(gameState) {

      // === helper: confirm "are you sure you don't want to peek?"
      function confirmSkipPeek() {
        alistairShowChoices(
          "You sure you don’t want to peek inside?",
          [
            {
              label: "No, leave it alone",
              onClick: () => {
                alistairResetNextButton();
                const passLines = [
                  "You decide not to test your luck.",
                  "Whatever's inside can stay inside."
                ];
                alistairStartDialogue(passLines, () => {
                  // after refusing to peek, go to crossroads menu/free roam
                  alistairShowCrossroadsChoiceFromWell();
                });
              }
            },
            {
              label: "Fine. I'll look.",
              onClick: () => {
                doBucketReachInSequence();
              }
            }
          ]
        );
      }

      // === helper: the hurt / crab / note sequence, then crossroads
      function doBucketReachInSequence() {
        alistairResetNextButton();

        // pain moment
        alistairTakeDamage(1);

        const hurtLines = [
          "You reach in. Something sharp snaps at your hand.",
          "Ouch. That hurt.",
          "A crab scrambles out, skittering into the dark.",
          "Oh... there's a note at the bottom.",
          "It looks... wet?"
        ];

        alistairStartDialogue(hurtLines, () => {
          // Show Herberts Note fullscreen
          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1761611469/ag-note-from-crab_l56g6a.png",
            "Soaked Note",
            () => {
              // add note to journal
              alistairAddJournal({
                id: "crab_note",
                title: "Herberts Note",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761611469/ag-note-from-crab_l56g6a.png"
              });

              // after closing the note overlay, go to crossroads/free roam
              alistairShowCrossroadsChoiceFromWell();
            }
          );
        });
      }

      // === helper: first bucket question "Do you pick up the bucket?"
      function startBucketPrompt() {
        alistairShowChoices(
          "Do you pick up the bucket?",
          [
            {
              label: "Pick it up",
              onClick: () => {
                // zoom bucket + add to inv + remove hotspot
                alistairHandleBucketPickupFlow();

                // after picking it up, we immediately ask "reach in?"
                setTimeout(() => {
                  alistairShowChoices(
                    "Do you reach inside the bucket?",
                    [
                      {
                        label: "Reach in",
                        onClick: () => {
                          doBucketReachInSequence();
                        }
                      },
                      {
                        label: "Don't",
                        onClick: () => {
                          // this gives them the confirm, which will
                          // eventually drop into alistairShowCrossroadsChoiceFromWell()
                          confirmSkipPeek();
                        }
                      }
                    ]
                  );
                }, 0);
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
                  // after refusing bucket, go to crossroads/free roam
                  alistairShowCrossroadsChoiceFromWell();
                });
              }
            }
          ]
        );
      }

      // ----- WELL INTRO LINES -----
      const wellIntroLines = [
        "The gates slam shut, almost welded.",
        "Is that the tree whispering to me? Distant voices.",
        "…Is that a well up ahead?",
        "It doesn't smell very well.",
        "As you approach the well you see a bucket on the floor."
      ];

      // grab hotspot so we can check if bucket exists
      const hotspot = document.getElementById('alistair-bucket-hotspot');

      // make the signs visible / wired as soon as we enter
      alistairRevealSignsOnly();

      // allow clicking bucket in-scene whenever
      if (hotspot) {
        hotspot.addEventListener('click', () => {
          startBucketPrompt();
        });
      }

      // run intro, then branch to bucket or straight to crossroads
      alistairStartDialogue(wellIntroLines, () => {
        if (hotspot && document.body.contains(hotspot)) {
          // bucket still here (first time)
          startBucketPrompt();
        } else {
          // bucket already collected on a past visit
          alistairShowCrossroadsChoiceFromWell();
        }
      });
    }
  };

  // >>> NEW ROOMS GO HERE <<<

  // FOREST GROUNDS
  const AlistairRoom_ForestGrounds = {
    id: "forest_grounds",
    name: "Forest Grounds",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761681141/adventure-garden-forest-skelly_erq5ay.png",

    render(gameState) {
      return ``;
    },

    onEnter(gameState) {
      const lines = [
        "The trees lean in like they're trying to listen to you breathe.",
        "Bones are half-sunk in the mud. They're not all animal.",
        "Something was dragged through here recently. You can still see the grooves."
      ];
      alistairStartDialogue(lines, () => {
        // future forest interactions
      });
    }
  };

  const AlistairRoom_Barn = {
    id: "barn",
    name: "The Barn",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761681141/adventure-garden-barn_fhe6iu.png",

    render(gameState) {
      return ``;
    },

    onEnter(gameState) {
      const lines = [
        "The barn smells like rope rot and warm animal panic.",
        "There's light coming from the loft, but you don't hear anyone moving.",
        "Something metal is creaking in the rafters. Slow. Repeating."
      ];
      alistairStartDialogue(lines, () => {
        // future barn interactions (maybe the key 👀)
      });
    }
  };

  const AlistairRoom_ManorFront = {
    id: "manor_front",
    name: "Manor de Montreux",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761681141/adventure-garden-mansion_ooljdo.png",

    render(gameState) {
      return ``;
    },

    onEnter(gameState) {
      const lines = [
        "You stand at the doors of Manor de Montreux.",
        "The glass in the windows has gone milky with age.",
        "Something behind the wood is definitely awake.",
        "It already knows your name."
      ];
      alistairStartDialogue(lines, () => {
        // future manor / unlock logic
      });
    }
  };


  // Room registry
  const ALISTAIR_ROOMS = {
    entrance_gates: AlistairRoom_EntranceGates,
    the_well: AlistairRoom_TheWell,
    forest_grounds: AlistairRoom_ForestGrounds,
    barn: AlistairRoom_Barn,
    manor_front: AlistairRoom_ManorFront,
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

  function alistairPlayTransitionThenGoRoom(nextRoomId) {
    const roomContainer = document.getElementById('alistair-room-container');

    // hide dialogue bar while transition plays
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) bar.classList.add('hidden');

    // clear current room visuals and play your act-one transition clip
    roomContainer.style.backgroundImage = 'none';
    roomContainer.innerHTML = `
      <video id="alistair-transition-video" autoplay playsinline style="width:100%;height:100%;object-fit:cover;">
        <source src="https://res.cloudinary.com/ddmslr9na/video/upload/v1761681546/ag-act-one-transition_cyzqkj.mp4" type="video/mp4">
      </video>
      <div class="alistair-room-inner">
        <p>...</p>
      </div>
    `;

    const vid = document.getElementById('alistair-transition-video');
    if (vid) {
      vid.addEventListener('ended', () => {
        alistairGoToRoom(nextRoomId);
      });
    } else {
      // fallback if <video> didn't mount
      alistairGoToRoom(nextRoomId);
    }
  }

  // ====== START GAME ======
  function alistairStartGame() {
    console.log("Alistair: starting game");
    alistairState.started = true;
    alistairRenderHearts();
    const roomHeaderEl = document.getElementById('alistair-room-header');
    if (roomHeaderEl) {
      roomHeaderEl.classList.remove('hidden-room-header');
    }

    console.log("Alistair: going to entrance_gates");
    alistairGoToRoom('entrance_gates');
  }

  // ====== INIT BUTTONS / EVENT LISTENERS ======
  const playBtn = document.getElementById('advent-btn');
  const backBtn = document.getElementById('alistair-back-btn');
  const mapBtn = document.getElementById('alistair-map-btn');
  const expandBtn = document.getElementById('alistair-expand-btn');
  const mapCloseBtn = document.getElementById('alistair-map-close');

  const journalBtn = document.getElementById('alistair-journal-btn');
  const journalCloseBtn = document.getElementById('alistair-journal-close');
  const journalModal = document.getElementById('alistair-journal-modal');

  const invBtn = document.getElementById('alistair-inv-btn');
  const invCloseBtn = document.getElementById('alistair-inventory-close');
  const invModal = document.getElementById('alistair-inventory-modal');

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!alistairState.started) {
        // remove intro screen
        const howto = document.getElementById('alistair-howto-screen');
        if (howto) {
          howto.remove();
        }
        // now start the actual game
        alistairStartGame();
      } else {
        // already started -> do nothing OR we could restart
        // alistairRestart();
      }
    });
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

  if (journalBtn) {
    journalBtn.addEventListener('click', () => {
      if (alistairState.isJournalOpen) {
        alistairCloseJournal();
      } else {
        alistairOpenJournal();
      }
    });
  }

  if (journalCloseBtn) {
    journalCloseBtn.addEventListener('click', () => {
      alistairCloseJournal();
    });
  }

  // click outside to close journal
  if (journalModal) {
    journalModal.addEventListener('click', (evt) => {
      // if you click the dark backdrop (modal) but NOT the inner content box
      if (evt.target === journalModal) {
        alistairCloseJournal();
      }
    });
  }

  if (invBtn) {
    invBtn.addEventListener('click', () => {
      if (alistairState.isInventoryOpen) {
        alistairCloseInventory();
      } else {
        alistairOpenInventory();
      }
    });
  }

  if (invCloseBtn) {
    invCloseBtn.addEventListener('click', () => {
      alistairCloseInventory();
    });
  }

  // click outside to close inventory
  if (invModal) {
    invModal.addEventListener('click', (evt) => {
      if (evt.target === invModal) {
        alistairCloseInventory();
      }
    });
  }

  // ====== INITIAL LOAD ======
  // Show HUD info and the How to Play overlay right away
  alistairShowHowToScreen();
  alistairRenderHearts();

});
