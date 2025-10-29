document.addEventListener("DOMContentLoaded", function () {

  // ============================================================
  // ===============  CORE GAME STATE / BOOT / UI  ===============
  // ============================================================

  // ----- GAME STATE -----
  const alistairState = {
    health: 3,
    // inventory now stores objects like { id, name, imgUrl }
    inventory: [],
    // journals store objects like { id, title, imgUrl }
    journals: [],
    visitedRooms: [],     // list of room ids we've visited so far
    roomHistory: [],      // stack so Back button can work
    currentRoom: null,
    started: false,

    // modal open flags so we can close them properly
    isJournalOpen: false,
    isInventoryOpen: false,

    // tracks if we've already shown the "where do you go?" nav
    // at the Well crossroads. This prevents spamming the menu.
    hasSeenCrossroads: false,
  };

  // ----- "HOW TO PLAY" INTRO OVERLAY AT START -----
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


  // ============================================================
  // =====================  DIALOGUE SYSTEM  ====================
  // ============================================================
  //
  // This controls:
  // - scrolling narrative lines at the bottom bar ("Next", "Next", "Next")
  // - branching choices buttons
  // - when to hide/show the dialogue bar
  //
  // You mostly call:
  //   alistairStartDialogue(linesArray, callbackWhenDone)
  //   alistairShowChoices(question, [ {label, onClick}, ... ])
  //   alistairResetNextButton()  (puts the bar back into single "Next" mode)
  //

  let dialogueQueue = [];
  let dialogueOnComplete = null;
  let dialogueIndex = 0;

  // Start a block of dialogue lines.
  // linesArray = ["line1","line2",...]
  // onComplete = function to run after last line is done
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

    // make sure the bar is in "Next" mode (not in "choice buttons" mode)
    alistairResetNextButton();
  }

  // Called when player clicks "Next". Advances to next line or finishes.
  function alistairAdvanceDialogue() {
    dialogueIndex += 1;
    const bar = document.getElementById('alistair-dialogue-bar');
    const textEl = document.getElementById('alistair-dialogue-text');

    if (dialogueIndex < dialogueQueue.length) {
      // still more lines to show
      textEl.textContent = dialogueQueue[dialogueIndex];
      return;
    }

    // end of this dialogue block
    bar.classList.add('hidden');

    if (dialogueOnComplete) {
      const cb = dialogueOnComplete;
      dialogueOnComplete = null;
      cb(); // e.g. now show choices...
    }
  }

  // Show branching choices (replaces the "Next" button area
  // with multiple buttons, each with .onClick)
  function alistairShowChoices(questionText, choicesArray) {
    const bar = document.getElementById('alistair-dialogue-bar');
    const textEl = document.getElementById('alistair-dialogue-text');
    const nextBtn = document.getElementById('alistair-dialogue-next');

    if (!bar || !textEl || !nextBtn) return;

    bar.classList.remove('hidden');
    textEl.textContent = questionText;

    // wipe the Next button content and add our choice buttons
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

  // Put the bar back into story mode (single "Next" btn).
  // Call this before using alistairStartDialogue again.
  function alistairResetNextButton() {
    const nextBtn = document.getElementById('alistair-dialogue-next');
    if (!nextBtn) return;
    nextBtn.replaceChildren();
    nextBtn.textContent = "Next";
    nextBtn.onclick = alistairAdvanceDialogue;
  }


  // ============================================================
  // ======================  IMAGE OVERLAY  =====================
  // ============================================================
  //
  // Full-screen popup image for an item, note, clue, etc.
  // Usage:
  //   alistairShowImageOverlay(imgUrl, captionText, () => {
  //      ...what to do when closed...
  //   })
  //

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


  // ============================================================
  // ====================  JOURNAL SYSTEM  ======================
  // ============================================================
  //
  // Journals = lore notes you collect.
  // Stored on alistairState.journals as {id, title, imgUrl}
  // Renders in journal modal grid and supports click-to-open overlay.
  //

  function alistairAddJournal(journalObj) {
    // journalObj: { id, title, imgUrl }
    if (!alistairState.journals.find(j => j.id === journalObj.id)) {
      alistairState.journals.push(journalObj);
    }
  }

  // Draw the journal modal grid
  function alistairRenderJournalPanel() {
    const grid = document.getElementById('alistair-journal-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (alistairState.journals.length === 0) {
      // fill with some "empty" slots so layout looks good
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

      slot.innerHTML = `
        <img src="${journal.imgUrl}" alt="${journal.title}">
        <div class="alistair-grid-slot-title">${journal.title}</div>
      `;

      // click a journal entry to see it fullscreen
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
    // close inventory if it was open
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


  // ============================================================
  // ===================  INVENTORY SYSTEM  =====================
  // ============================================================
  //
  // Inventory = physical items (like the bucket).
  // Stored in alistairState.inventory as {id, name, imgUrl}
  // Shows in inventory modal grid. We also auto-create empty slots.
  //

  function alistairAddItem(itemObj) {
    // itemObj: { id, name, imgUrl }
    if (!alistairState.inventory.find(i => i.id === itemObj.id)) {
      alistairState.inventory.push(itemObj);
    }
  }

  // Draw the inventory modal grid, with fixed min slots
  function alistairRenderInventoryPanel() {
    const grid = document.getElementById('alistair-inventory-grid');
    if (!grid) return;

    grid.innerHTML = '';

    // Show 9 slots minimum (3x3 vibe)
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
        // future: we can add click handlers here to "inspect item"
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


  // ============================================================
  // ===================  HEALTH / HEARTS SYS  ==================
  // ============================================================
  //
  // Renders hearts in the HUD and handles damage / death.
  // Call alistairTakeDamage(1) etc.
  //

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


  // ============================================================
  // =====================  GLOBAL HELPERS  =====================
  // ============================================================
  //
  // These are general-purpose helpers that multiple rooms can use.
  // Example: "reveal the clickable signs" at the Well is useful
  // both when we first arrive and any time later.
  //
  // IMPORTANT FOR YOU:
  // - If you need new shared logic (like a Forest puzzle helper,
  //   or a 'playScreamCutscene()'), add it HERE so it's global.
  //

  // Make The Well's direction signs visible + clickable.
  // (Forest, Barn, Manor)
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

    // MANOR click (locked unless you have the key)
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

  // Show the crossroads "Where do you go next?" menu at the well
  // (or if we've already done it once, just leave the player free-roam).
  function alistairShowCrossroadsChoiceFromWell() {
    // always make signs clickable/visible
    alistairRevealSignsOnly();

    // already seen crossroads once? Then don't pop the menu again.
    // Instead just hide the dialogue bar and leave hotspots active.
    if (alistairState.hasSeenCrossroads) {
      const bar = document.getElementById('alistair-dialogue-bar');
      if (bar) {
        bar.classList.add('hidden');
      }
      return;
    }

    // first time we show crossroads
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
                // after warning, call again:
                // this time hasSeenCrossroads === true so it'll just exit to free roam
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
              // free roam mode: keep hotspots, hide bar
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


  // ============================================================
  // ============  BUCKET FLOW / ITEM INTERACTION  ==============
  // ============================================================
  //
  // This is specifically the interaction at The Well with the bucket,
  // but you can copy this pattern for future "pick up X -> inspect X
  // -> maybe bleed, maybe journal unlock" stuff in other rooms.
  //
  // HOW IT WORKS:
  // - alistairHandleBucketPickupFlow()
  //   runs when you choose "Pick it up"
  // - it shows bucket zoom, gives you the bucket item,
  //   removes hotspot, then asks if you reach in.
  //

  function alistairHandleBucketPickupFlow() {
    alistairResetNextButton();

    alistairShowImageOverlay(
      "https://res.cloudinary.com/ddmslr9na/image/upload/v1761533389/ag-bucket_m4kfer.png",
      "Old wooden bucket. Iron handle. Damp. Smells like rot.",
      () => {
        // add bucket to inventory
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

        // after zoom, ask "reach inside?"
        alistairShowChoices(
          "Do you reach inside the bucket?",
          [
            {
              label: "Reach in",
              onClick: () => {
                alistairResetNextButton();

                // take damage 1 heart
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
                      // add note to journal after close
                      alistairAddJournal({
                        id: "crab_note",
                        title: "Herberts Note",
                        imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761611469/ag-note-from-crab_l56g6a.png"
                      });

                      // now show crossroads nav / free roam
                      alistairShowCrossroadsChoiceFromWell();
                    }
                  );
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
                  // also drop them to crossroads nav / free roam
                  alistairShowCrossroadsChoiceFromWell();
                });
              }
            }
          ]
        );
      }
    );
  }


  // ============================================================
  // ======================  ROOM SYSTEM  =======================
  // ============================================================
  //
  // alistairGoToRoom(id):
  //   - swaps background
  //   - injects that room's HTML (hotspots, etc)
  //   - calls that room's onEnter() so it can set up dialogue, etc
  //
  // pattern for a room object:
  //
  // const SomeRoom = {
  //   id: "some_id",
  //   name: "Readable Name",
  //   background: "IMAGE_URL",
  //   render(gameState) {
  //     return `...HTML TO INJECT...`;
  //   },
  //   onEnter(gameState) {
  //     // runs every time we enter the room
  //     // here you usually do narrative and attach event listeners
  //   }
  // }
  //

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

    // Update slim header room name in HUD
    const roomNameEl = document.getElementById('alistair-room-name');
    if (roomNameEl) {
      roomNameEl.textContent = nextRoom.name || '';
    }

    // Render background for this room scene
    const roomContainer = document.getElementById('alistair-room-container');
    roomContainer.style.backgroundImage = nextRoom.background
      ? `url('${nextRoom.background}')`
      : 'none';

    // Inject room hotspots / interactables markup
    roomContainer.innerHTML = '';
    const rawHtml = nextRoom.render(alistairState);
    if (rawHtml && rawHtml.trim() !== "") {
      roomContainer.innerHTML = rawHtml;
    }

    // Hide dialogue (room will open it when ready)
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) {
      bar.classList.add('hidden');
    }

    // Call the room's script
    if (typeof nextRoom.onEnter === 'function') {
      nextRoom.onEnter(alistairState);
    }

    // Refresh HUD hearts + inventory panel data
    alistairRenderHearts();
    alistairRenderInventoryPanel();
  }

  // go back to previous room (Back button)
  function alistairGoBack() {
    const prev = alistairState.roomHistory.pop();
    if (prev) {
      alistairGoToRoom(prev, { recordHistory: false });
    }
  }


  // ============================================================
  // ======================  MAP / MODALS  ======================
  // ============================================================
  //
  // Map modal: shows list of visited rooms so you can jump.
  // Journal modal & Inventory modal are handled above.
  //

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


  // ============================================================
  // =======================  VIEW MODES  =======================
  // ============================================================
  //
  // Expand: turns the game div fullscreen.
  // Collapse: puts it back in-card.
  //

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


  // ============================================================
  // =====================  GAME OVER LOGIC  ====================
  // ============================================================
  //
  // alistairShowGameOver(msg) pops modal with Restart.
  // alistairRestart() resets all state & shows intro again.
  //

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

    // also reset crossroads flag at the well
    alistairState.hasSeenCrossroads = false;

    // Show intro screen again on restart
    alistairShowHowToScreen();
    alistairRenderHearts();
  }


  // ============================================================
  // ========================  ROOMS  ===========================
  // ============================================================
  //
  // THIS is where we define each location.
  // Each room object has:
  //   id, name, background, render(), onEnter()
  //
  // render() => returns HTML string for hotspots in that room.
  // onEnter() => runs logic each time you arrive (narration, etc)
  //
  // IMPORTANT FOR YOU:
  // - To add new scene content / choices / puzzle for FOREST,
  //   edit AlistairRoom_ForestGrounds.onEnter() and .render().
  //   Look at The Well for reference on branching, items, etc.
  //
  // - If a new scene needs cutscenes / helpers, put those helper
  //   functions up in GLOBAL HELPERS so it's reusable (like we did
  //   for the well's crossroads logic).
  //

  // --- ENTRANCE GATES ---
  const AlistairRoom_EntranceGates = {
    id: "entrance_gates",
    name: "Entrance Gates",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761530233/ag-gates-closed_ldpuwk.png",

    render(gameState) {
      // gates scene doesn't inject hotspots yet
      return ``;
    },

    onEnter(gameState) {
      const introLines = [
        "The air is colder here. You shouldn't even be on these grounds.",
        "They said Alistair vanished beyond these gates. They said anyone who looks for him doesn't come back.",
        "This is a click-only investigation. No turning back once you're inside.",
        "Your choices will have consequences. Your safety is not guaranteed."
      ];

      alistairStartDialogue(introLines, () => {
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


  // --- THE WELL / CROSSROADS HUB ---
  // This is the "main hub" where you can pick up the bucket, get hurt,
  // unlock a journal entry, and choose where to go next
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

      // local helper: "are you sure you don't want to peek inside the bucket?"
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
                  // drop into crossroads / free roam
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

      // local helper: the "reach into bucket and get hurt" storyline
      function doBucketReachInSequence() {
        alistairResetNextButton();

        // take damage 1 heart
        alistairTakeDamage(1);

        const hurtLines = [
          "You reach in. Something sharp snaps at your hand.",
          "Ouch. That hurt.",
          "A crab scrambles out, skittering into the dark.",
          "Oh... there's a note at the bottom.",
          "It looks... wet?"
        ];

        alistairStartDialogue(hurtLines, () => {
          // Show Herbert's Note fullscreen
          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1761611469/ag-note-from-crab_l56g6a.png",
            "Soaked Note",
            () => {
              // add note to journal when overlay closes
              alistairAddJournal({
                id: "crab_note",
                title: "Herberts Note",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761611469/ag-note-from-crab_l56g6a.png"
              });

              // then show crossroads nav / free roam
              alistairShowCrossroadsChoiceFromWell();
            }
          );
        });
      }

      // local helper: first bucket decision ("pick up bucket?" yes/no)
      function startBucketPrompt() {
        alistairShowChoices(
          "Do you pick up the bucket?",
          [
            {
              label: "Pick it up",
              onClick: () => {
                // zoom bucket, add to inv, remove hotspot, ask reach in
                alistairHandleBucketPickupFlow();

                // after pickup finishes we immediately ask "reach in?"
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
                          // ask "you SURE?" which can route to crossroads
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
                  // after refusing bucket, go to crossroads / free roam
                  alistairShowCrossroadsChoiceFromWell();
                });
              }
            }
          ]
        );
      }

      // ---- Well intro lines when you arrive here ----
      const wellIntroLines = [
        "The gates slam shut, almost welded.",
        "Is that the tree whispering to me? Distant voices.",
        "…Is that a well up ahead?",
        "It doesn't smell very well.",
        "As you approach the well you see a bucket on the floor."
      ];

      // grab bucket hotspot if it's still in scene
      const hotspot = document.getElementById('alistair-bucket-hotspot');

      // make the directional signs (forest / barn / manor) visible + clickable
      // so even if player skips dialogue, they can still navigate
      alistairRevealSignsOnly();

      // allow direct click on bucket hotspot
      if (hotspot) {
        hotspot.addEventListener('click', () => {
          startBucketPrompt();
        });
      }

      // run intro dialogue, then branch:
      // if bucket is there => ask them about bucket
      // if already collected => jump straight to crossroads/nav
      alistairStartDialogue(wellIntroLines, () => {
        if (hotspot && document.body.contains(hotspot)) {
          // first time, bucket still exists
          startBucketPrompt();
        } else {
          // bucket is already taken on a previous visit
          alistairShowCrossroadsChoiceFromWell();
        }
      });
    }
  };


  // FOREST GROUNDS
  const AlistairRoom_ForestGrounds = {
    id: "forest_grounds",
    name: "Forest Grounds",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761701137/adventure-garden-forest-skelly_mynpdj.png",

render(gameState) {
  const hasRope = !!gameState.inventory.find(i => i.id === "rope");

  return `
    ${hasRope ? "" : `
      <div id="alistair-rope-hotspot" class="alistair-hotspot-rope">
        <img
          src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761696498/ag-rope_fzhaop.png"
          alt="Coiled rope on the ground"
          class="alistair-rope-img">
      </div>
    `}
  `;
},

    onEnter(gameState) {

      // -------------------------------------------------
      // helper: FREE ROAM MODE in forest
      // hides the dialogue bar so player can click hotspots
      // -------------------------------------------------
      function enterForestFreeRoam() {
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) {
          bar.classList.add('hidden');
        }
        // nothing else right now, just leave hotspots active
      }

      // -------------------------------------------------
      // helper: award rope to player
      //  - shows rope overlay
      //  - adds rope to inventory
      //  - removes clickable hotspot
      //  - returns to free roam
      // We call this in BOTH cases:
      //   - if they were kind ("Yes"),
      //   - or if they click hotspot later.
      // -------------------------------------------------
      function givePlayerRopeFromSkeleton() {
        // show rope zoom overlay
        alistairShowImageOverlay(
          "https://res.cloudinary.com/ddmslr9na/image/upload/v1761696498/ag-rope_fzhaop.png",
          "Rope (still smells like the well.)",
          () => {
            // add rope to inventory if not already there
            if (!alistairState.inventory.find(i => i.id === "rope")) {
              alistairAddItem({
                id: "rope",
                name: "Length of Rope",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761696498/ag-rope_fzhaop.png"
              });
            }

            // remove hotspot so you can't farm rope forever
            const ropeHotspot = document.getElementById('alistair-rope-hotspot');
            if (ropeHotspot) {
              ropeHotspot.remove();
            }

            // "maybe have a look around" vibe after picking it up
            alistairResetNextButton();
            alistairStartDialogue([
              "You coil the rope. It's heavier than it looks.",
              "Might be useful later.",
              "Maybe have a look around."
            ], () => {
              enterForestFreeRoam();
            });
          }
        );
      }

      // -------------------------------------------------
      // helper: wire the rope hotspot so in free roam,
      // player can still collect it if they said "No".
      // We call this AFTER we've rendered the scene.
      // -------------------------------------------------
      function wireRopeHotspot() {
        const ropeHotspot = document.getElementById('alistair-rope-hotspot');
        if (!ropeHotspot) return;

        ropeHotspot.addEventListener('click', () => {
          // player is manually looting the rope in free roam
          givePlayerRopeFromSkeleton();
        });
      }

      // -------------------------------------------------
      // helper: branch after "No" (you don't help him)
      // - we guilt them
      // - we drop to free roam
      // - hotspot stays active so they can STILL loot rope
      // -------------------------------------------------
      function refuseToHelp() {
        alistairResetNextButton();
        alistairStartDialogue([
          "You leave him twisted in the dirt.",
          "Somewhere in your head, a voice that isn't yours says:",
          "\"I knew humans were cruel.\"",
          "You feel like you missed something."
        ], () => {
          // go to free roam, keep hotspot
          enterForestFreeRoam();
        });
      }

    // --- helper: pouch hotspot for Greaves’ note
    function initPouchHotspot() {
      const roomContainer = document.getElementById('alistair-room-container');
      if (!roomContainer) return;

      const pouchSpot = document.createElement('div');
      pouchSpot.className = 'alistair-hotspot-pouch';
      roomContainer.appendChild(pouchSpot);

      pouchSpot.addEventListener('click', () => {
        alistairResetNextButton();

        // Little "you found something" beat before showing the parchment
        alistairStartDialogue(
          ["Oh. What have we found here...?"],
          () => {
            // Show the pirate note full screen
            alistairShowImageOverlay(
              "https://res.cloudinary.com/ddmslr9na/image/upload/v1761703184/ag-pirates-note_fl7mml.png",
              "T. Greaves’ Note",
              () => {

                // === after they CLOSE the parchment overlay ===
                // (1) store it in the journal RIGHT AWAY
                alistairAddJournal({
                  id: "greaves_note",
                  title: "T. Greaves’ Note",
                  imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761703184/ag-pirates-note_fl7mml.png"
                });

                // (2) narrator reads / reacts to it
                alistairResetNextButton();
                alistairStartDialogue(
                  [
                    "T. Greaves... quartermaster of the Wailing Star...",
                    "He says he dropped something down the well and it called his name back.",
                    "He couldn't leave the forest after that.",
                    "So the well is keeping this pirate here.. how i wonder?"
                  ],
                  () => {
                    // (3) when the reading ends:
                    //     - open the Journal so player sees it's been added
                    //     - then drop them back to free roam

                    // open + render journal modal
                    alistairOpenJournal();

                    // after a tiny delay, hide the dialogue bar so it feels like free roam,
                    // but keep the journal open for them to look at.
                    const bar = document.getElementById('alistair-dialogue-bar');
                    if (bar) {
                      bar.classList.add('hidden');
                    }

                    // Optional: if you DON'T want to force-open the journal,
                    // comment out alistairOpenJournal() above and just do:
                    // enterForestFreeRoam();
                    // (but right now we're showing it on purpose)
                  }
                );
              }
            );
          }
        );
      });
    }

      // -------------------------------------------------
      // helper: branch after "Yes" (you help him)
      // - we narrate being kind
      // - immediately give rope
      // (ropeHotspot will get removed in givePlayerRopeFromSkeleton)
      // -------------------------------------------------
      function helpSkeleton() {
        alistairResetNextButton();
        alistairStartDialogue([
          "You kneel beside the skeleton.",
          "The rope is dug so deep into bone you have to twist it loose.",
          "You tell him you'll make him more comfortable.",
          "He doesn't answer — but the forest goes a little quieter.",
          "You got a rope."
        ], () => {
          givePlayerRopeFromSkeleton();
        });
      }

      // -------------------------------------------------
      // forest intro lines (first arrival)
      // -------------------------------------------------
      const forestIntroLines = [
        "The trees lean in, like they're trying to listen to you breathe.",
        "The mud is full of bones. Not all of them are animal.",
        "Something was dragged here and left to sink.",
        "There's a skeleton sitting propped against a stump.",
        "The rope around its chest is pulled tight. Too tight.",
        "The forest past this point is too dense to walk. Dead end… unless you take what you need."
      ];

      // We only want to do the intro + Yes/No ONCE per visit,
      // not every time they come back from another room.
      // You can make this fancier later (track visited state per room),
      // but for now we always play it when entering.
      alistairStartDialogue(forestIntroLines, () => {
        // AFTER intro, ask if we make him more comfy.
        alistairShowChoices(
          "Do you make him more comfortable?",
          [
            {
              label: "Yes",
              onClick: () => {
                helpSkeleton(); // gives rope immediately
              }
            },
            {
              label: "No",
              onClick: () => {
                refuseToHelp(); // guilt, free roam, hotspot still there
              }
            }
          ]
        );
      });

      // finally: make sure hotspot works for both branches
      // (if they said No and we're in free roam,
      // or if they skip the choice somehow and just click it)
      wireRopeHotspot();
      initPouchHotspot();
    }
  };


  // --- THE BARN ---
  const AlistairRoom_Barn = {
    id: "barn",
    name: "The Barn",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761700725/adventure-garden-barn_u6dvj3.png",

    render(gameState) {
      // Check if player already has the herb in inventory
      const alreadyHasHerb = !!gameState.inventory.find(i => i.id === "strange_herb");

      return `
        <!-- Barn exterior scene -->

        <!-- DEV DOOR HOTSPOT (yellow box placeholder) -->
        <div id="alistair-barn-door-hotspot" class="alistair-barn-door-hotspot">
          <!-- dev rectangle for placement -->
        </div>

        ${
          alreadyHasHerb
            ? ""
            : `
              <!-- HERB HOTSPOT -->
              <div id="alistair-herb-hotspot" class="alistair-herb-hotspot">
                <img
                  src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761750412/ag-herb-for-potion-of-dispell_wafxps.png"
                  alt="Strange herb"
                  class="alistair-herb-img">
              </div>
            `
        }
      `;
    },

    onEnter(gameState) {
      // helper: puts us in "free roam mode" = dialogue bar hidden,
      // but leaves hotspots clickable in the scene.
      function enterBarnFreeRoam() {
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) {
          bar.classList.add('hidden');
        }

        // wire hotspots now that the scene HTML is injected
        wireBarnDoorHotspot();
        wireHerbHotspot();
      }

      // hotspot: clicking the barn door (yellow square) should act
      // like "go inside" even if they chickened out in dialogue.
      function wireBarnDoorHotspot() {
        const doorSpot = document.getElementById('alistair-barn-door-hotspot');
        if (!doorSpot) return;

        doorSpot.addEventListener('click', () => {
          // tension beat, then transition into interior
          alistairResetNextButton();
          const stepInLines = [
            "You edge up to the barn doors.",
            "Your fingertips brush the wood. It's damp.",
            "Something on the other side is VERY still now.",
            "You push it open just wide enough to slip inside..."
          ];
          alistairStartDialogue(stepInLines, () => {
            alistairPlayTransitionThenGoRoom('barn_interior');
          });
        });
      }

      // hotspot: clicking the herb
      function wireHerbHotspot() {
        const herbSpot = document.getElementById('alistair-herb-hotspot');
        if (!herbSpot) return;

        herbSpot.addEventListener('click', () => {
          // show image overlay of the herb first
          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1761750412/ag-herb-for-potion-of-dispell_wafxps.png",
            "What a strange herb...",
            () => {
              // once the overlay closes:

              // 1. add herb to inventory if we don't already have it
              if (!alistairState.inventory.find(i => i.id === "strange_herb")) {
                alistairAddItem({
                  id: "strange_herb",
                  name: "Unmarked Herb",
                  imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761750412/ag-herb-for-potion-of-dispell_wafxps.png"
                });
              }

              // 2. REMOVE the herb hotspot from the scene so it can't be picked again
              //    (this matches how we handled bucket/rope)
              const herbNode = document.getElementById('alistair-herb-hotspot');
              if (herbNode) {
                herbNode.remove();
              }

              // now give dialogue + branch "look closer?"
              alistairResetNextButton();
              alistairStartDialogue(
                [
                  "What a strange herb...",
                  "Maybe we should look closer."
                ],
                () => {
                  // ask if they want to examine further
                  alistairShowChoices(
                    "Do you take a closer look?",
                    [
                      {
                        label: "No",
                        onClick: () => {
                          // back to free roam, nothing else
                          enterBarnFreeRoam();
                        }
                      },
                      {
                        label: "Yes",
                        onClick: () => {
                          alistairResetNextButton();
                          const inspectLines = [
                            "You turn the stems in your hand.",
                            "After examining this herb, you realise it's part of the Nightsinger's family...",
                            "But you can't identify exactly which one.",
                            "You feel like it matters."
                          ];
                          alistairStartDialogue(inspectLines, () => {
                            // drop back to free roam afterwards
                            enterBarnFreeRoam();
                          });
                        }
                      }
                    ]
                  );
                }
              );
            }
          );
        });
      }

      // ---- Barn arrival narration (outside the barn) ----
      const approachLines = [
        "Finally... we made it to the barn.",
        "It smells really rancid here.",
        "I've never smelled anything like this. This definitely isn't a normal barn.",
        "Wait... what was that.",
        "I think there's something moving around in there.",
        "Let's go take a look."
      ];

      // After narration, offer choice: go in?
      alistairStartDialogue(approachLines, () => {
        alistairShowChoices(
          "Do you go and look inside?",
          [
            {
              label: "No",
              onClick: () => {
                // Player refuses to enter.
                alistairResetNextButton();
                const noLines = [
                  "Okay... maybe we should head back.",
                  "It doesn't feel right in there.",
                  "But... something in that barn is important.",
                  "If we leave now, we might miss it."
                ];

                alistairStartDialogue(noLines, () => {
                  // Now we release control to free roam outside the barn.
                  enterBarnFreeRoam();
                });
              }
            },
            {
              label: "Yes",
              onClick: () => {
                // Player wants to enter immediately.
                alistairResetNextButton();
                const yesLines = [
                  "You move closer to the barn, each step slow and careful.",
                  "You can hear dead silence now.",
                  "Whatever was moving... stopped.",
                  "It's waiting."
                ];

                alistairStartDialogue(yesLines, () => {
                  // cutscene then move to interior room
                  alistairPlayTransitionThenGoRoom('barn_interior');
                });
              }
            }
          ]
        );
      });
    }
  };

  //BARN-INTERIOR
  const AlistairRoom_BarnInterior = {
    id: "barn_interior",
    name: "Inside the Barn",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761754559/ag-barn-interior_icwcfu.png",

    render(gameState) {
      return `
        <!-- Barn interior hotspots will go here (loft / hanging metal / key) -->
      `;
    },

    onEnter(gameState) {
      // When you first step inside the barn
      const insideLines = [
        "You step into the barn.",
        "The air in here is wet and wrong. Sweet-rotten.",
        "The light from the loft is still flickering, but nothing is moving.",
        "Something metal is hanging above you, swaying just a little.",
        "You shouldn't be in here alone."
      ];

      alistairStartDialogue(insideLines, () => {
        // After the intro, we’ll later branch into:
        // - climb for the key
        // - maybe kill path
        // - etc.
        //
        // For now we just leave them in here with the dialogue bar hidden
        // (free roam state, like Forest did).
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) {
          bar.classList.add('hidden');
        }
      });
    }
  };

  // --- MANOR FRONT DOOR ---
  const AlistairRoom_ManorFront = {
    id: "manor_front",
    name: "Manor de Montreux",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761681141/adventure-garden-mansion_ooljdo.png",

    render(gameState) {
      return `
        <!-- 👉 MANOR HOTSPOTS GO HERE LATER -->
      `;
    },

    onEnter(gameState) {
      const lines = [
        "You stand at the doors of Manor de Montreux.",
        "The glass in the windows has gone milky with age.",
        "Something behind the wood is definitely awake.",
        "It already knows your name."
      ];
      alistairStartDialogue(lines, () => {
        // 👉 later: if player has key, maybe unlock front_door_inside, etc.
      });
    }
  };


  // ----- ROOM REGISTRY -----
  // This is how alistairGoToRoom("room_id") knows what to load.
  const ALISTAIR_ROOMS = {
    entrance_gates: AlistairRoom_EntranceGates,
    the_well: AlistairRoom_TheWell,
    forest_grounds: AlistairRoom_ForestGrounds,
    barn: AlistairRoom_Barn,
    barn_interior: AlistairRoom_BarnInterior,
    manor_front: AlistairRoom_ManorFront,
  };


  // ============================================================
  // ======================  CUTSCENES ETC  =====================
  // ============================================================
  //
  // Small helpers for playing little video clips between rooms.
  // You can copy this pattern for other transitions if you get
  // more cutscenes (scream cam, chase cam, etc).
  //

  // Gates opening cutscene, then send you to Well.
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

  // Generic transition cutscene (used when walking between areas)
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


  // ============================================================
  // =====================  GAME STARTUP  =======================
  // ============================================================
  //
  // Start game sets started=true, shows hearts,
  // unhides the room header, and jumps to first room.
  //
  // Then we wire up all the HUD buttons.
  //

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


  // ============================================================
  // ================  HUD BUTTONS / LISTENERS  =================
  // ============================================================

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
        // boot game
        alistairStartGame();
      } else {
        // if already started, we could optionally restart
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

  // clicking the dark backdrop (but not the white box) closes journal modal
  if (journalModal) {
    journalModal.addEventListener('click', (evt) => {
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

  // clicking the dark backdrop (but not the white box) closes inventory modal
  if (invModal) {
    invModal.addEventListener('click', (evt) => {
      if (evt.target === invModal) {
        alistairCloseInventory();
      }
    });
  }


  // ============================================================
  // =====================  FIRST RENDER  =======================
  // ============================================================
  //
  // Show "How to Play" screen sitting in the game area
  // and show hearts in HUD.
  //

  alistairShowHowToScreen();
  alistairRenderHearts();

});
