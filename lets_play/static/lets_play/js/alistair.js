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
    currentAct: 1,            // which act the player is currently in
    seenActSplash: {},        // { 1: true, 2: true } to prevent repeat splashes
  };

  const ALISTAIR_SUB_LOCK_ENABLED = false;

  // Replace this later with your real check (JWT, API, etc.)
  function alistairIsSubscriber() {
    return false; // <- CHANGE to `true` (or real logic) when wiring subs
  }

  // Central gate: allow Act 1 for everyone; restrict later acts if lock is on.
  function alistairGateActAccess(targetAct) {
    if (!ALISTAIR_SUB_LOCK_ENABLED) return true;        // free-to-play mode
    if (targetAct <= 1) return true;                    // Act 1 always open
    return alistairIsSubscriber();                      // Act 2+ need sub
  }

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

    bar.classList.add('alistair-choices');
    nextBtn.onclick = null;

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
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) bar.classList.remove('alistair-choices', 'alistair-list-choices');
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
  const closeBtn = document.getElementById('alistair-image-close');

  if (!overlay || !imgEl || !capEl) return;

  imgEl.src = imgUrl;
  capEl.textContent = captionText || "";
  overlay.classList.remove('hidden');

  function handleClose() {
    overlay.classList.add('hidden');
    overlay.removeEventListener('click', backdropClose);
    if (closeBtn) closeBtn.removeEventListener('click', handleClose);
    if (onClose) onClose();
  }

  // clicking the backdrop (outside white box) still closes
  function backdropClose(evt) {
    // only close if click is on the dark backdrop, not inside the content
    if (evt.target === overlay) {
      handleClose();
    }
  }

  // wire close button + backdrop
  if (closeBtn) closeBtn.addEventListener('click', handleClose);
  overlay.addEventListener('click', backdropClose);
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

  const ALISTAIR_ACT_LABELS = {
    1: "ACT I — Outside",
    2: "ACT II — The Manor",
    3: "ACT III — (TBD)"
  };

  function alistairEnterAct(actNo) {
    alistairState.currentAct = actNo;
    if (!alistairState.seenActSplash[actNo]) {
      alistairState.seenActSplash[actNo] = true;
      const label = ALISTAIR_ACT_LABELS[actNo] || `ACT ${actNo}`;
      alistairResetNextButton();
      alistairStartDialogue([label], () => {
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) bar.classList.add('hidden');
      });
    }
  }

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

    // MANOR click (custom flow per your spec)
    const manorSign = document.querySelector('.alistair-sign-manor');
    if (manorSign) {
      manorSign.addEventListener('click', () => {
        const hasKey = !!alistairState.inventory.find(i => i.id === "front_key");

        if (!hasKey) {
          // No key: hint and return to free roam
          alistairResetNextButton();
          alistairStartDialogue(
            [
              "I think you're missing something.",
              "Go wander the grounds."
            ],
            () => {
              // free roam: keep the signs live and hide the bar
              alistairRevealSignsOnly();
              const bar = document.getElementById('alistair-dialogue-bar');
              if (bar) bar.classList.add('hidden');
            }
          );
          return;
        }

        // Has key: mood lines, then transition clip -> manor front
        alistairResetNextButton();
        alistairStartDialogue(
          [
            "The manor is just up ahead.",
            "Whispers ride the wind: \"Turn back now.\"",
            "You remember the gates behind you — sealed shut.",
            "Forward is the only way.",
            "Onwards…"
          ],
          () => {
            alistairPlayTransitionThenGoRoom('manor_front');
          }
        );
      });
    }
  }

  // List-style choices wrapper (global)
  function alistairShowListChoices(questionText, choicesArray) {
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) bar.classList.add('alistair-list-choices');
    alistairShowChoices(questionText, choicesArray);
  }

  // Clear the list mode before returning to normal Next/choices
  function alistairClearListChoices() {
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) bar.classList.remove('alistair-list-choices');
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
    alistairState.currentAct = 1;
    alistairState.seenActSplash = {};
    delete alistairState.isCursed;
    delete alistairState._gardenHealedOnce;

  // clear per-room "entered once" flags
    delete alistairState._enteredGatesOnce;
    delete alistairState._enteredWellOnce;
    delete alistairState._enteredForestOnce;
    delete alistairState._enteredBathroomOnce;
    delete alistairState._enteredKitchenOnce;
    delete alistairState._enteredManorHallOnce;
    delete alistairState._enteredGardenOnce;

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
    act: 1,
    id: "entrance_gates",
    name: "Entrance Gates",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761530233/ag-gates-closed_ldpuwk.png",

    render(gameState) {
      // gates scene doesn't inject hotspots yet
      return ``;
    },

    onEnter(gameState) {
      // Re-entry handler: if we've been here before (e.g., via Map),
      // punish the attempt to leave, then send the player back to the Well.
      const seenBefore = !!alistairState._enteredGatesOnce;
      alistairState._enteredGatesOnce = true;

      if (seenBefore) {
        alistairResetNextButton();
        const lines = [
          "You thought you were clever climbing over the gates.",
          "I told you already: you cannot leave this place.",
          "I'm watching you at all times.",
          "Here—take this!",
          "ouch that hurt!"
        ];

        alistairStartDialogue(lines, () => {
          // -1 heart, then run the same cutscene that starts the game
          alistairTakeDamage(1);
          alistairPlayGateCutsceneThenGoWell();
        });
        return;
      }

      // ---- original first-time intro (unchanged) ----
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

  //---------------------------------
  // --- THE WELL / CROSSROADS HUB ---
  //----------------------------------
  const AlistairRoom_TheWell = {
    act: 1,
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

        <!-- WELL HOTSPOT (hidden by default; we show + wire it on re-entry) -->
        <div id="alistair-well-hotspot" class="alistair-well-hotspot" style="display:none;"></div>
      `;
    },

    onEnter(gameState) {

    // ---------- helpers ----------
    function wireWellHotspotForReentry() {
      const wellSpot = document.getElementById('alistair-well-hotspot');
      if (!wellSpot) return;

      // make it visible on re-entry
      wellSpot.style.display = 'block';

      // avoid duplicate listeners if we bounce in/out a lot
      wellSpot.replaceWith(wellSpot.cloneNode(true));
      const freshSpot = document.getElementById('alistair-well-hotspot');

      freshSpot.addEventListener('click', () => {
        handleWellPuzzleOrHint();
      });
    }

        // re-wire the bucket hotspot safely (idempotent)
    function wireBucketHotspot() {
      const spot = document.getElementById('alistair-bucket-hotspot');
      if (!spot) return;

      // drop any old listeners in case we bounced in/out
      const clone = spot.cloneNode(true);
      spot.replaceWith(clone);

      clone.addEventListener('click', () => {
        startBucketPrompt();   // uses your existing flow
      });
    }

      function handleWellPuzzleOrHint() {
        const hasBucket = !!alistairState.inventory.find(i => i.id === "bucket");
        const hasRope   = !!alistairState.inventory.find(i => i.id === "rope");
        const hasHammer = !!alistairState.inventory.find(i => i.id === "barn_hammer");
        const hasAll    = hasBucket && hasRope && hasHammer;

        if (!hasAll) {
          // Missing something -> gentle nudge + free roam
          alistairResetNextButton();
          alistairStartDialogue(
            [
              "I think we still might be missing something.",
              "Where to now?"
            ],
            () => {
              // free roam: signs active, dialogue hidden
              alistairRevealSignsOnly();
              const bar = document.getElementById('alistair-dialogue-bar');
              if (bar) bar.classList.add('hidden');
            }
          );
          return;
        }


        // They have bucket + rope + hammer: show the 3 options puzzle
        alistairResetNextButton();
        alistairStartDialogue(
          [
            "You stand over the well with everything you need.",
            "What do you do at the well?"
          ],
          () => {
            alistairShowListChoices(
              "Choose your action:",
              [
                {
                  // ✅ Correct order
                  label: "Tie the bucket to the rope, hit the crank with the hammer, and lower it.",
                  onClick: () => {
                    alistairClearListChoices();
                    alistairResetNextButton();
                    alistairStartDialogue(
                      [
                        "You knot the rope to the bucket handle.",
                        "You tap the crank with the hammer — once, firm — and the gear catches.",
                        "The line descends. Something knocks the bucket from below.",
                        "When you haul it up, something metal glints in the slime…"
                      ],
                      () => {
                        alistairShowImageOverlay(
                          "https://res.cloudinary.com/ddmslr9na/image/upload/v1761779312/ag-manor-front-door-key_uetd0n.png",
                          "Engraved key",
                          () => {
                            if (!alistairState.inventory.find(i => i.id === "front_key")) {
                              alistairAddItem({
                                id: "front_key",
                                name: "Front Door Key",
                                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761779312/ag-manor-front-door-key_uetd0n.png"
                              });
                            }
                            alistairResetNextButton();
                            alistairStartDialogue(
                              [
                                "We’ve found a key. It’s old and engraved “De Montreux.”",
                                "This must be the key to the manor."
                              ],
                              () => {
                                alistairRevealSignsOnly();
                                const bar = document.getElementById('alistair-dialogue-bar');
                                if (bar) bar.classList.add('hidden');
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                },
                {
                  // ❌ Wrong: fall in (3 damage)
                  label: "Tie the rope to the bucket, hit the crank with hammer and lower it.",
                  onClick: () => {
                    alistairClearListChoices();
                    alistairResetNextButton();
                    alistairStartDialogue(
                      [
                        "You knot the rope and begin lowering the bucket.",
                        "Then you swing the hammer at the crank.",
                        "The bucket just hangs there… snagged on something below.",
                        "You lean over the lip to see what’s blocking it—",
                        "—and the stone is slick.",
                        "You slip and fell into the well."
                      ],
                      () => {
                        alistairTakeDamage(3);
                      }
                    );
                  }
                },
                {
                  // ❌ Wrong: foot damage (1)
                  label: "Use the hammer on the crank first, then tie the rope to the bucket and lower it",
                  onClick: () => {
                    alistairClearListChoices();
                    alistairResetNextButton();
                    alistairStartDialogue(
                      [
                        "You swing for the crank without prepping the line.",
                        "The hammer glances and tumbles.",
                        "It lands squarely on your foot."
                      ],
                      () => {
                        alistairTakeDamage(1);
                        alistairRevealSignsOnly();
                        const bar = document.getElementById('alistair-dialogue-bar');
                        if (bar) bar.classList.add('hidden');
                      }
                    );
                  }
                }
              ]
            );
          }
        );
      }

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

      // ---------- ENTRY LOGIC ----------
      alistairRevealSignsOnly();

      // mark first/return visit
      const seenBefore = !!alistairState._enteredWellOnce;
      alistairState._enteredWellOnce = true;

      // Wire the well hotspot for *re-entry* interactions
      wireWellHotspotForReentry();

      if (seenBefore) {
        // Re-entry behavior
        const hasBucket = !!alistairState.inventory.find(i => i.id === "bucket");
        const hasRope   = !!alistairState.inventory.find(i => i.id === "rope");
        const hasHammer = !!alistairState.inventory.find(i => i.id === "barn_hammer");
        const hasAll    = hasBucket && hasRope && hasHammer;

        wireWellHotspotForReentry();
        wireBucketHotspot();

        alistairResetNextButton();

        if (!hasAll) {
          // Missing something -> gentle nudge + free roam (well hotspot stays active)
          alistairStartDialogue(
            [
              "Back at the well.",
              "I think we still might be missing something.",
              "Where to now?"
            ],
            () => {
              const bar = document.getElementById('alistair-dialogue-bar');
              if (bar) bar.classList.add('hidden');
            }
          );
        } else {
          // Have all 3: give preamble lines, then free roam; click well to start puzzle
          alistairStartDialogue(
            [
              "Pretty sure we have everything we need now.",
              "I wonder what that skeleton pirate dropped down the well...",
              "Master Greaves — that was his name."
            ],
            () => {
              const bar = document.getElementById('alistair-dialogue-bar');
              if (bar) bar.classList.add('hidden');
              // well hotspot is already wired; player can click it to open the 3 options
            }
          );
        }

        return; // skip first-visit bucket narrative
      }

      // ---------- First-time intro (original) ----------
      const wellIntroLines = [
        "The gates slam shut, almost welded.",
        "Is that the tree whispering to me? Distant voices.",
        "…Is that a well up ahead?",
        "It doesn't smell very well.",
        "As you approach the well you see a bucket on the floor."
      ];

      const hotspot = document.getElementById('alistair-bucket-hotspot');

      if (hotspot) {
        hotspot.addEventListener('click', () => { startBucketPrompt(); });
      }

      alistairStartDialogue(wellIntroLines, () => {
        if (hotspot && document.body.contains(hotspot)) {
          startBucketPrompt();
        } else {
          alistairShowCrossroadsChoiceFromWell();
        }
      });
    }
  };

  //---------------------------------
  // --- FOREST GROUNDS
  //----------------------------------
  const AlistairRoom_ForestGrounds = {
    act: 1,
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
      // -------------------------------------------------
      function enterForestFreeRoam() {
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) bar.classList.add('hidden');
        // leave hotspots active
      }

      // -------------------------------------------------
      // helper: award rope to player
      // -------------------------------------------------
      function givePlayerRopeFromSkeleton() {
        alistairShowImageOverlay(
          "https://res.cloudinary.com/ddmslr9na/image/upload/v1761696498/ag-rope_fzhaop.png",
          "Rope (still smells like the well.)",
          () => {
            if (!alistairState.inventory.find(i => i.id === "rope")) {
              alistairAddItem({
                id: "rope",
                name: "Length of Rope",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761696498/ag-rope_fzhaop.png"
              });
            }

            const ropeHotspot = document.getElementById('alistair-rope-hotspot');
            if (ropeHotspot) ropeHotspot.remove();

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
      // helper: wire rope hotspot (if present)
      // -------------------------------------------------
      function wireRopeHotspot() {
        const ropeHotspot = document.getElementById('alistair-rope-hotspot');
        if (!ropeHotspot) return;
        ropeHotspot.addEventListener('click', () => {
          givePlayerRopeFromSkeleton();
        });
      }

      // -------------------------------------------------
      // helper: pouch hotspot for Greaves’ note (idempotent)
      // -------------------------------------------------
      function initPouchHotspot() {
        const roomContainer = document.getElementById('alistair-room-container');
        if (!roomContainer) return;

        // avoid duplicates on re-entry
        if (roomContainer.querySelector('.alistair-hotspot-pouch')) return;

        const pouchSpot = document.createElement('div');
        pouchSpot.className = 'alistair-hotspot-pouch';
        roomContainer.appendChild(pouchSpot);

        pouchSpot.addEventListener('click', () => {
          alistairResetNextButton();
          alistairStartDialogue(
            ["Oh. What have we found here...?"],
            () => {
              alistairShowImageOverlay(
                "https://res.cloudinary.com/ddmslr9na/image/upload/v1761703184/ag-pirates-note_fl7mml.png",
                "T. Greaves’ Note",
                () => {
                  alistairAddJournal({
                    id: "greaves_note",
                    title: "T. Greaves’ Note",
                    imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761703184/ag-pirates-note_fl7mml.png"
                  });

                  alistairResetNextButton();
                  alistairStartDialogue(
                    [
                      "T. Greaves... quartermaster of the Wailing Star...",
                      "He says he dropped something down the well and it called his name back.",
                      "He couldn't leave the forest after that.",
                      "So the well is keeping this pirate here.. how i wonder?"
                    ],
                    () => {
                      alistairOpenJournal();
                      const bar = document.getElementById('alistair-dialogue-bar');
                      if (bar) bar.classList.add('hidden');
                    }
                  );
                }
              );
            }
          );
        });
      }

      // -------------------------------------------------
      // helper: refuse to help
      // -------------------------------------------------
      function refuseToHelp() {
        alistairResetNextButton();
        alistairStartDialogue([
          "You leave him twisted in the dirt.",
          "Somewhere in your head, a voice that isn't yours says:",
          "\"I knew humans were cruel.\"",
          "You feel like you missed something."
        ], () => {
          enterForestFreeRoam();
        });
      }

      // -------------------------------------------------
      // helper: help the skeleton (rope)
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

      // Always ensure hotspots exist/wired before any early returns
      wireRopeHotspot();
      initPouchHotspot();

      // ---------- RE-ENTER BLURB ----------
      const seenBefore = !!alistairState._enteredForestOnce;
      // mark as entered from now on
      alistairState._enteredForestOnce = true;

      if (seenBefore) {
        alistairResetNextButton();
        alistairStartDialogue(
          [
            "We've definitely been here before.",
            "I wonder if we've found everything we can..."
          ],
          () => { enterForestFreeRoam(); }
        );
        return; // skip the initial intro/choice on re-entries
      }

      // -------------------------------------------------
      // first arrival intro + choice
      // -------------------------------------------------
      const forestIntroLines = [
        "The trees lean in, like they're trying to listen to you breathe.",
        "The mud is full of bones. Not all of them are animal.",
        "Something was dragged here and left to sink.",
        "There's a skeleton sitting propped against a stump.",
        "The rope around its chest is pulled tight. Too tight.",
        "The forest past this point is too dense to walk. Dead end… unless you take what you need."
      ];

      alistairStartDialogue(forestIntroLines, () => {
        alistairShowChoices(
          "Do you make him more comfortable?",
          [
            { label: "Yes", onClick: () => { helpSkeleton(); } },
            { label: "No",  onClick: () => { refuseToHelp(); } }
          ]
        );
      });

    }
  };

  //---------------------------------
  // ---THE BARN ---
  //----------------------------------
  const AlistairRoom_Barn = {
    act: 1,
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
                  name: "Nightsingers Herb",
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

      const hasHammer = !!alistairState.inventory.find(i => i.id === "barn_hammer");
      if (hasHammer) {
        alistairResetNextButton();
        const reenterExteriorLines = [
          "Out here the air doesn't feel as sick.",
          "I'm glad we made it out of there.",
          "Whatever was moving inside has gone quiet...",
          "Maybe we shouldn't go back in."
        ];
        alistairStartDialogue(reenterExteriorLines, () => {
          enterBarnFreeRoam();
        });
        return; // stop; don't show the original 'go inside?' prompt
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

  //---------------------------------
  // ---BARN INTERIOR ---
  //----------------------------------
  const AlistairRoom_BarnInterior = {
    act: 1,
    id: "barn_interior",
    name: "Inside the Barn",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761754559/ag-barn-interior_icwcfu.png",

    render(gameState) {
      // We always render two things here:
      // 1. A ladder hotspot (invisible box for the danger climb)
      // 2. A glimmer hotspot wrapper for that mp4, START HIDDEN.
      //
      // We unhide the glimmer hotspot later if the player refuses to climb and
      // chooses to back off (Option 1 -> No, then Option 2 -> Yes).
      //
      // We also remove hotspots entirely once the player has the hammer.

      const hasHammer = !!gameState.inventory.find(i => i.id === "barn_hammer");

      return `
        <!-- Barn interior scene -->

        ${
          hasHammer
            ? ""
            : `
              <!-- LADDERS / DANGER HOTSPOT -->
              <div id="alistair-glimmer-hotspot" class="alistair-glimmer-hotspot alistair-glimmer-hidden">
                <img
                  src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761769367/ag-hot-spot-glimmer_k2sqkj.png"
                  alt="Glimmer"
                  id="alistair-glimmer-img"
                  
                 >
              </div>
            `
        }
      `;
    },

    onEnter(gameState) {

      // --- tiny helper for plain free roam (no extra hotspots) ---
      function enterInteriorFreeRoam() {
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) bar.classList.add('hidden');
      }

      // ============================
      // RE-ENTRY CURSE CHECK FIRST
      // (only after they already have the hammer)
      // ============================
      const alreadyHasHammer = !!alistairState.inventory.find(i => i.id === "barn_hammer");
      if (alreadyHasHammer) {
        alistairResetNextButton();

        // take damage immediately
        alistairTakeDamage(1);

        const reentryLines = [
          "That presence from before is stronger now.",
          "It crawls over your skin. Your stomach flips.",
          "You feel really sick.",
          "I think we need to leave. Right now."
        ];

        alistairStartDialogue(reentryLines, () => {
          // free roam INSIDE (no hotspots render because we have the hammer)
          enterInteriorFreeRoam();
        });

        return; // don't run the first-time ladder/glimmer flow below
      }

      // ================
      // helper: add hammer, talk, and leave the barn interior
      // (used in *all* branches once hammer is obtained)
      // ================
      function awardHammerAndExitRoom(didGetHurt) {
        // 1. Show hammer overlay zoom
        alistairShowImageOverlay(
          "https://res.cloudinary.com/ddmslr9na/image/upload/v1761764082/ag-hammer_irioeo.png",
          "Rusty Hammer",
          () => {
            // 2. Add hammer to inventory (if not already)
            if (!alistairState.inventory.find(i => i.id === "barn_hammer")) {
              alistairAddItem({
                id: "barn_hammer",
                name: "Rusty Hammer",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761764082/ag-hammer_irioeo.png"
              });
            }

            // 3. Remove hotspots so you can't farm hammer
            const ladderSpot = document.getElementById('alistair-ladder-hotspot');
            if (ladderSpot) ladderSpot.remove();
            const glimmerSpot = document.getElementById('alistair-glimmer-hotspot');
            if (glimmerSpot) glimmerSpot.remove();

            // 4. Final dialogue, then we bail out of the barn interior.
            alistairResetNextButton();

            const endLines = didGetHurt
              ? [
                  "I think this is what we needed.",
                  "That hurt more than it should have.",
                  "Let's get out of here."
                ]
              : [
                  "I think this is what we needed.",
                  "Let's get out of here."
                ];

            alistairStartDialogue(endLines, () => {
              // After grabbing the hammer, we dump them back outside the barn
              alistairPlayTransitionThenGoRoom('barn');
            });
          }
        );
      }

      // ================
      // helper: unsafe climb – you fall and take damage
      // (used in Option 1 Yes path, and Option 2 "No I'll climb anyway" path)
      // ================
      function doUnsafeLadderClimb() {
        alistairResetNextButton();

        const fallLines = [
          "You grab the ladder and start climbing.",
          "Every rung creaks like it's going to snap.",
          "Halfway up — it does.",
          "You drop. You hit the floor hard.",
          "White pain explodes up your leg."
        ];

        // Apply damage 1 heart
        alistairTakeDamage(1);

        alistairStartDialogue(fallLines, () => {
          awardHammerAndExitRoom(true /*didGetHurt*/);
        });
      }

      // ================
      // helper: safe glimmer pickup – no damage
      // (used when they backed off and went free roam and clicked the hotspot)
      // ================
      function doSafeGlimmerPickup() {
        alistairResetNextButton();

        const sneakLines = [
          "You stay low and move slow.",
          "You don't climb. You don't make a sound.",
          "There — tucked under fallen boards. Metal.",
          "You slide it free without the whole barn screaming about it."
        ];

        alistairStartDialogue(sneakLines, () => {
          awardHammerAndExitRoom(false /*didGetHurt*/);
        });
      }

      // ================
      // helper: enable free roam mode INSIDE barn with the glimmer
      // ================
      function enterBarnInteriorFreeRoamWithGlimmer() {
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) bar.classList.add('hidden');

        const glimmerSpot = document.getElementById('alistair-glimmer-hotspot');
        if (glimmerSpot) {
          glimmerSpot.classList.remove('alistair-glimmer-hidden');
          glimmerSpot.addEventListener('click', () => {
            doSafeGlimmerPickup();
          });
        }
      }

      // ================
      // helper: second confirmation menu ("you sure?")
      // ================
      function confirmDontClimb() {
        alistairShowChoices(
          "You sure you don't want to climb the ladder?",
          [
            {
              label: "Yes",
              onClick: () => {
                enterBarnInteriorFreeRoamWithGlimmer();
              }
            },
            {
              label: "No",
              onClick: () => {
                doUnsafeLadderClimb();
              }
            }
          ]
        );
      }

      // ================
      // MAIN INTRO FLOW WHEN ENTERING BARN INTERIOR (first time)
      // ================
      const interiorIntroLines = [
        "You step into the barn.",
        "The air in here is wet and wrong. Sweet-rotten.",
        "Something about this place makes your stomach twist. You shouldn't stay long.",
        "But it feels like there's something in here that we NEED.",
        "Oh. Look over there. There's a ladder up to the loft."
      ];

      alistairStartDialogue(interiorIntroLines, () => {
        alistairShowChoices(
          "Do you climb the ladder?",
          [
            { label: "Yes", onClick: () => { doUnsafeLadderClimb(); } },
            { label: "No",  onClick: () => {
                alistairResetNextButton();
                const warnLines = [
                  "You freeze at the base of the ladder.",
                  "Your skin is buzzing.",
                  "Something in here does not want you going up there.",
                  "You feel sick.",
                  "Are you sure you don't want to climb?"
                ];
                alistairStartDialogue(warnLines, () => { confirmDontClimb(); });
              }
            }
          ]
        );
      });

    }
  };

  //---------------------------------
  // --- MANOR FRONT DOOR ---
  //---------------------------------- 
  const AlistairRoom_ManorFront = {
    act: 1,
    id: "manor_front",
    name: "Manor de Montreux",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761681141/adventure-garden-mansion_ooljdo.png",

    render(gameState) {
      return `
        <!-- dev hotspot for the front door -->
        <div id="alistair-manor-door-hotspot" class="alistair-dev-hotspot"></div>
      `;
    },

    onEnter(gameState) {
      alistairResetNextButton();

      const lines = [
        "You made it.",
        "Well done for getting this far.",
        "Act One is now complete.",
        "For a moment, the front steps feel almost safe.",
        "Almost.",
        "The glass is milky with age; the stone sweats.",
        "You can feel eyes on you from somewhere behind the curtains.",
        "Rest if you must — but remember: nowhere here is truly safe.",
        "Maybe you should try the door. The key feels cold in your hand."
      ];

      alistairStartDialogue(lines, () => {
        const door = document.getElementById('alistair-manor-door-hotspot');
        if (!door) return;

        // ensure fresh listener on re-entry
        const clone = door.cloneNode(true);
        door.replaceWith(clone);

        // ⬇️ GATED ACT II CLICK HANDLER
        clone.addEventListener('click', () => {
          // ⛔ Block Act II if lock is enabled and user not subbed
          if (!alistairGateActAccess(2)) {
            alistairResetNextButton();
            alistairStartDialogue([
              "The key turns easily in the sticky lock… then stops.",
              "Beyond this door begins **Act II**.",
              "Support the project to continue."
            ], () => {
              // Optional: bounce them somewhere else if you want:
              // alistairPlayTransitionThenGoRoom('the_well');
            });
            return;
          }

          // ✅ Allowed into Act II
          alistairResetNextButton();
          alistairStartDialogue(
            [
              "You press the key into the goopy, sticky lock.",
              "It slides in without resistance.",
              "You turn it — *click.*",
              "The latch unlatches."
            ],
            () => {
              const cutsceneUrl = "https://res.cloudinary.com/ddmslr9na/video/upload/v1761786439/ag-mansion-front-entry-transistion_l7yblk.mp4";
              // Plays the entrance cutscene, then:
              // inside that helper you already set: alistairEnterAct(2); alistairGoToRoom('manor_hall');
              alistairPlayManorEntranceCutsceneThenGoHall(cutsceneUrl);
            }
          );
        });
      });
    }
  };

  //---------------------------------
  // --- MANOR HALL (ACT 2) ---
  //---------------------------------- 

  const AlistairRoom_ManorHall = {
    act: 2,
    id: "manor_hall",
    name: "The Manor Hall",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761784130/ag-main-hall_wplaif.png",

    render(gameState) {
      const hasCoat = !!gameState.inventory.find(i => i.id === "alistair_coat");

      return `
        <!-- Travel Hotspots -->
        <div class="alistair-hall-hotspot" id="hall-to-room-1" data-target="manor_bedroom">
          <span class="alistair-hotspot-label">To Master Bedroom</span>
        </div>
        <div class="alistair-hall-hotspot" id="hall-to-room-2" data-target="manor_bathroom">
          <span class="alistair-hotspot-label">To Bathroom</span>
        </div>
        <div class="alistair-hall-hotspot" id="hall-to-room-3" data-target="manor_wine_cellar">
          <span class="alistair-hotspot-label">To Wine Cellar</span>
        </div>
        <div class="alistair-hall-hotspot" id="hall-to-room-4" data-target="manor_study">
          <span class="alistair-hotspot-label">To Study</span>
        </div>
        <div class="alistair-hall-hotspot" id="hall-to-room-5" data-target="manor_parlour">
          <span class="alistair-hotspot-label">To Parlour</span>
        </div>
        <div class="alistair-hall-hotspot" id="hall-to-room-6" data-target="manor_kitchen">
          <span class="alistair-hotspot-label">To Kitchen</span>
        </div>

        <!-- NEW: Alistair’s Coat Hotspot -->
        ${hasCoat ? "" : `
          <div id="alistair-coat-hotspot" class="alistair-hotspot-coat">
            <img
              src="https://res.cloudinary.com/ddmslr9na/image/upload/v1761958038/ag-alistairs-coat_nwuvov.png"
              alt="Alistair’s coat"
              class="alistair-coat-img">
          </div>
        `}
      `;
    },

    onEnter(gameState) {
      // Ensure act label + intro
      alistairEnterAct(2);
      alistairResetNextButton();

      const seenBefore = !!alistairState._enteredManorHallOnce;
      alistairState._enteredManorHallOnce = true;

      // Wire hall → room navigation first
      function wireTravelHotspots() {
        const spots = document.querySelectorAll(".alistair-hall-hotspot");
        spots.forEach((el) => {
          const target = el.dataset.target;
          if (!target) return;

          const clone = el.cloneNode(true);
          el.replaceWith(clone);

          clone.addEventListener("click", () => {
            // Special handling for Wine Cellar door
            if (target === "manor_wine_cellar") {
              // If previously unlocked, go straight in
              if (alistairState._cellarUnlocked) {
                alistairPlayHallTransitionThenGo(target);
                return;
              }

              const hasCellarKey = !!alistairState.inventory.find(i => i.id === "cellar_key");

              // No key yet → simple locked message
              if (!hasCellarKey) {
                alistairResetNextButton();
                alistairStartDialogue([
                  "This door is locked."
                ]);
                return;
              }

              // Has key but not unlocked yet → unlocking narration (click again to enter)
              alistairResetNextButton();
              alistairStartDialogue([
                "Let’s try the key we found in the garden…",
                "It looks like it fits.",
                "You place the key in the lock and it turns on its own,",
                "as if allowing you entry."
              ], () => {
                // Mark as unlocked so future clicks (now and on re-entry) go straight through
                alistairState._cellarUnlocked = true;
              });
              return;
            }

            // Default behavior for all other doors
            alistairPlayHallTransitionThenGo(target);
          });
        });
      }

      // After exploring/coat flow is done → free roam
      function enterManorFreeRoam() {
        const bar = document.getElementById("alistair-dialogue-bar");
        if (bar) bar.classList.add("hidden");
        wireTravelHotspots();
      }

      // Handle coat pickup + choice
      function handleCoatPickup() {
        alistairShowImageOverlay(
          "https://res.cloudinary.com/ddmslr9na/image/upload/v1761958038/ag-alistairs-coat_nwuvov.png",
          "Alistair’s Coat",
          () => {
            // Add coat to inventory
            if (!alistairState.inventory.find(i => i.id === "alistair_coat")) {
              alistairAddItem({
                id: "alistair_coat",
                name: "Alistair’s Coat",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761958038/ag-alistairs-coat_nwuvov.png"
              });
            }

            // Remove coat hotspot
            const coatSpot = document.getElementById("alistair-coat-hotspot");
            if (coatSpot) coatSpot.remove();

            // Start follow-up dialogue
            alistairResetNextButton();
            alistairStartDialogue(
              [
                "Wait a minute...",
                "This is Alistair’s coat — but there’s something different about it.",
                "He never takes it off, let alone leaves it here.",
                "Something’s not right."
              ],
              () => {
                alistairShowChoices(
                  "Do you put the coat on to feel closer to Alistair?",
                  [
                    {
                      label: "Yes",
                      onClick: () => {
                        alistairState.health = 3;
                        alistairRenderHearts();
                        alistairResetNextButton();
                        alistairStartDialogue(
                          [
                            "This feels nice... I miss him.",
                            "Where could he have gone?",
                            "Hint: click the doors to explore the manor and go to other rooms."
                          ],
                          () => {
                            enterManorFreeRoam();
                          }
                        );
                      }
                    },
                    {
                      label: "No",
                      onClick: () => {
                        alistairResetNextButton();
                        alistairStartDialogue(
                          [
                            "You wrap the jacket around your waist.",
                            "You wouldn’t catch me dead in this ratty tatty thing — he’s had it for years.",
                            "Hint: click the doors to explore the manor and go to other rooms."
                          ],
                          () => {
                            enterManorFreeRoam();
                          }
                        );
                      }
                    }
                  ]
                );
              }
            );
          }
        );
      }

      // Wire coat hotspot if it’s there
      function wireCoatHotspot() {
        const spot = document.getElementById("alistair-coat-hotspot");
        if (!spot) return;

        const clone = spot.cloneNode(true);
        spot.replaceWith(clone);
        clone.addEventListener("click", handleCoatPickup);
      }

      // --- Entry flow ---
      if (seenBefore) {
        // Re-entry, skip intro
        alistairResetNextButton();
        alistairStartDialogue(
          ["Back in the manor hall.", "The air still feels heavy here."],
          () => {
            enterManorFreeRoam();
          }
        );
        wireCoatHotspot();
        return;
      }

      // First time entry dialogue
      const hallIntro = [
        "We made it... finally! Phew...",
        "Definitely warmer in here than outside.",
        "Not so sure why he came here... my stupid husband Alistair.",
        "Useless he is. What a foolish man — chasing made up stories.",
        "Where could he have gotten to?",
        "Let's take a look around."
      ];

      alistairStartDialogue(hallIntro, () => {
        wireCoatHotspot();
        enterManorFreeRoam();
      });
    }
  };


   //---------------------------------
  // ---  BEDROOM ---
  //---------------------------------- 
  const AlistairRoom_ManorBedroom = {
    act: 2,
    id: "manor_bedroom",
    name: "Master Bedroom",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761790325/ag-master-bedroom_adicsr.png",
    render() { return ``; },
    onEnter() {
      alistairResetNextButton();
      alistairStartDialogue(["You have entered a new room."]);
    }
  };

  //---------------------------------
  // --- BATHROOM --- 
  //---------------------------------- 
  const AlistairRoom_ManorBathroom = {
    act: 2,
    id: "manor_bathroom",
    name: "Bathroom",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761790298/ag-bath-room_mwkgvs.png",

    render(gameState) {
      return `
        <!-- Bath sludge hotspot -->
        <div id="alistair-bath-sludge" class="alistair-bath-hotspot">
          <img src="https://res.cloudinary.com/ddmslr9na/image/upload/v1762096067/ag-bath-sludge_sxbvjv.png"
              alt="Bath Sludge">
        </div>

        <!-- Hidden note hotspot (yellow box for dev) — renamed -->
        <div id="alistair-bathroom-note" class="alistair-bathroom-note"></div>
      `;
    },

    onEnter(gameState) {
      const visitedBefore = alistairState.visitedRooms.includes("manor_bathroom");

      if (visitedBefore && alistairState._enteredBathroomOnce) {
        // Re-entry = sickness + damage
        alistairResetNextButton();
        alistairStartDialogue([
          "I knew we shouldn't have come back here.",
          "You feel extremely sick again... worse than in the barn."
        ], () => {
          alistairTakeDamage(2);
        });
        return;
      }

      alistairState._enteredBathroomOnce = true;

      // First visit narrative
      alistairResetNextButton();
      alistairStartDialogue([
        "You step into the bathroom.",
        "The air is heavy and foul. A thick stench of rot clings to everything.",
        "A bath sits in the corner, filled with some kind of dark, viscous sludge.",
        "As awful as it looks, you can’t shake the feeling it might be... useful.",
        "You feel there’s something hidden in this room and its not that sludgy stuff.",
        "Where could it be?."
      ], () => {
        const sludge = document.getElementById("alistair-bath-sludge");
        const hidden = document.getElementById("alistair-bathroom-note");

        // --- Sludge hotspot ---
        if (sludge) {
          sludge.addEventListener("click", () => {
            const alreadyHave = alistairState.inventory.some(i => i.id === "bath_sludge");
            if (!alreadyHave) {
              alistairAddItem({
                id: "bath_sludge",
                name: "Bath Sludge",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762096067/ag-bath-sludge_sxbvjv.png"
              });
              alistairRenderInventoryPanel();
              alistairShowImageOverlay(
                "https://res.cloudinary.com/ddmslr9na/image/upload/v1762096067/ag-bath-sludge_sxbvjv.png",
                "You scoop up some of the foul sludge. It feels unearthly — wrong.",
                () => {
                  // NEW: mark the player as cursed on first pickup
                  alistairState.isCursed = true;

                  alistairResetNextButton();
                  alistairStartDialogue([
                    "You scoop up some of the foul sludge.",
                    "It feels unearthly — like it was never meant to be touched.",
                    "The mere touch crawls under your skin… a slow, creeping rot settles in.",
                    "You feel it taking hold of you.",
                    "You have been cursed."
                  ]);
                }
              );
            } else {
              alistairStartDialogue(["You've already collected some of the sludge."]);
            }
          });
        }

        // --- Hidden note hotspot (bathroom-note) ---
        if (hidden) {
          hidden.addEventListener("click", () => {
            const alreadyHaveNote = alistairState.journals.some(j => j.id === "ritual_note");
            if (!alreadyHaveNote) {
              alistairAddJournal({
                id: "ritual_note",
                title: "Ritual Instructions",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762096363/ag-ritual-insructions_o4poxe.png"
              });
              alistairRenderJournalPanel();
              alistairShowImageOverlay(
                "https://res.cloudinary.com/ddmslr9na/image/upload/v1762096363/ag-ritual-insructions_o4poxe.png",
                "A tattered note — ritual instructions. The words twist your stomach just reading them.",
                () => {
                  alistairResetNextButton();
                  alistairStartDialogue([
                    "A hidden note…",
                    "It describes some kind of ritual. You can barely stand to read it.",
                    "I think we’d better leave right now!"
                  ]);
                }
              );
            } else {
              alistairStartDialogue(["There's nothing else hidden here."]);
            }
          });
        }
      });
    }
  };


  //---------------------------------
  // --- WINE CELLAR ---
  //----------------------------------
  const AlistairRoom_ManorWineCellar = {
    act: 2,
    id: "manor_wine_cellar",
    name: "Wine Cellar",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761790397/ag-wine-celler_ns44ow.png",

    render(gameState) {
      const hasRecipeNote = gameState.journals.some(j => j.id === "cure_curse_recipe");

      return `
        <!-- Cellar Mold hotspot -->
        <div id="alistair-cellar-mold" class="alistair-cellar-mold-hotspot">
          <img
            src="https://res.cloudinary.com/ddmslr9na/image/upload/v1762126722/ag-mold_bgolll.png"
            alt="Cellar Mold">
        </div>

        <!-- Table Note hotspot (only render if not yet picked up) -->
        ${hasRecipeNote ? "" : `
          <div id="alistair-cellar-note" class="alistair-cellar-note-hotspot">
            <img
              src="https://res.cloudinary.com/ddmslr9na/image/upload/v1762126738/ag-note-hotspot_c8ewej.png"
              alt="Note on Table">
          </div>
        `}

        <!-- Fancy Wine hotspot (yellow dev box; no image) -->
        <div id="alistair-cellar-wine" class="alistair-cellar-wine-hotspot"></div>
      `;
    },
    onEnter(gameState) {
      const seenBefore = !!alistairState._enteredCellarOnce;
      alistairState._enteredCellarOnce = true;

      function enterCellarFreeRoam() {
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) bar.classList.add('hidden');
        wireMoldHotspot();
        wireNoteHotspot();
        wireWineHotspot();
      }

      // --- Mold ---
      function wireMoldHotspot() {
        const node = document.getElementById('alistair-cellar-mold');
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);

        clone.addEventListener('click', () => {
          const alreadyHave = alistairState.inventory.some(i => i.id === "cellar_mold");
          if (alreadyHave) {
            alistairResetNextButton();
            alistairStartDialogue(["We already have some of this mold."]);
            return;
          }

          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1762126722/ag-mold_bgolll.png",
            "Cellar Mold",
            () => {
              if (!alistairState.inventory.find(i => i.id === "cellar_mold")) {
                alistairAddItem({
                  id: "cellar_mold",
                  name: "Cellar Mold",
                  imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762126722/ag-mold_bgolll.png"
                });
                alistairRenderInventoryPanel();
              }
              alistairResetNextButton();
              alistairStartDialogue([
                "This looks like mold… but not ordinary mold.",
                "Better collect this with caution.",
                "You carefully scrape a small sample into a vial."
              ], () => { enterCellarFreeRoam(); });
            }
          );
        });
      }

      // --- Note on table (Cure Curse Recipe) ---
      function wireNoteHotspot() {
        const node = document.getElementById('alistair-cellar-note');
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);

        clone.addEventListener('click', () => {
          const alreadyHaveNote = alistairState.journals.some(j => j.id === "cure_curse_recipe");
          if (alreadyHaveNote) {
            alistairResetNextButton();
            alistairStartDialogue(["Nothing else on the table."]);
            return;
          }

          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1762127078/ag-cure-curse-potion_odv5vm.png",
            "Cure Curse — Recipe",
            () => {
              // Add to journal
              alistairAddJournal({
                id: "cure_curse_recipe",
                title: "Cure Curse — Recipe",
                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762127078/ag-cure-curse-potion_odv5vm.png"
              });
              alistairRenderJournalPanel();

              // ✅ Remove the note hotspot so it’s gone from the scene
              const noteSpot = document.getElementById('alistair-cellar-note');
              if (noteSpot) noteSpot.remove();

              // Dialogue
              alistairResetNextButton();
              alistairStartDialogue([
                "This looks like a recipe for curing a curse.",
                "It details how to prepare the potion."
              ], () => { enterCellarFreeRoam(); });
            }
          );
        });
      }

      // --- Fancy Wine (one-time) ---
      function wireWineHotspot() {
        const node = document.getElementById('alistair-cellar-wine');
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);

        clone.addEventListener('click', () => {
          if (alistairState._cellarWineTaken) {
            alistairResetNextButton();
            alistairStartDialogue([
              "We’ve already sampled that bottle. Best not push our luck."
            ]);
            return;
          }

          alistairResetNextButton();
          alistairStartDialogue([
            "No WAY!! This is the most expensive bottle of wine in the world.",
            "I can't believe this is here — I’ve got to try some."
          ], () => {
            alistairShowChoices(
              "Do you drink the wine? You're never going to get to taste this ever again.",
              [
                {
                  label: "Yes",
                  onClick: () => {
                    // Drinking path
                    alistairResetNextButton();
                    alistairStartDialogue([
                      "You sip the wine — the taste is to die for.",
                      "You took a tiny sip, ",
                      "the wine whispers to you, ",
                      " thats enough.....! ",
                      " put me down, i am not ment for you...! ",
                      "As you lower the bottle, you notice a note attached to the bottom."
                    ], () => {
                      // Add journal note from bottle bottom
                      alistairShowImageOverlay(
                        "https://res.cloudinary.com/ddmslr9na/image/upload/v1762127512/ag-servants-note-wine_eapmgu.png",
                        "Servant’s Note — Wine",
                        () => {
                          if (!alistairState.journals.find(j => j.id === "wine_note")) {
                            alistairAddJournal({
                              id: "wine_note",
                              title: "Servant’s Note — Wine",
                              imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762127512/ag-servants-note-wine_eapmgu.png"
                            });
                            alistairRenderJournalPanel();
                          }

                          // Heal +1 (cap at 3)
                          alistairState.health = Math.min(3, alistairState.health + 1);
                          alistairRenderHearts();

                          // Mark as taken so it’s one-time
                          alistairState._cellarWineTaken = true;

                          alistairResetNextButton();
                          alistairStartDialogue([
                            "That note reads.",
                            "In all my years of service, never have i known a cellar such as this.",
                            "The masters wine-rich and dark as midnight warms the chest.",
                            "Stirs the heart as though one were reborn with every sip.",
                            "They say this vinatage weas gifted to the De Montreux line long ago.",
                            "A recipe older than the manor itself",
                            "I know not its secrets, yet each night i find myself drawn to it",
                            "For it's taste lingers like a blessing and a curse alike.",
                            "signed: The saervant- Gertrude",
                            "That was… refreshing."
                          ], () => { enterCellarFreeRoam(); });
                        }
                      );
                    });
                  }
                },
                {
                  label: "No",
                  onClick: () => {
                    // “Are you sure?” confirm
                    alistairShowChoices(
                      "Are you sure?",
                      [
                        {
                          label: "Yes, I'm sure.",
                          onClick: () => {
                            alistairResetNextButton();
                            alistairStartDialogue([
                              "You place the bottle down and step away."
                            ], () => { enterCellarFreeRoam(); });
                          }
                        },
                        {
                          label: "Ok, I'll take a sip.",
                          onClick: () => {
                            // Reuse the Yes flow
                            // (simulate a click-through to keep code DRY)
                            // We'll just call the 'Yes' branch directly:
                            // replicate short path:
                            alistairResetNextButton();
                            alistairStartDialogue([
                              "You sip the wine — the taste is to die for.",
                              "You took a tiny sip, ",
                              "the wine whispers to you, ", 
                              " thats enough.....! ",
                              " put me down, i am not meant for you...! ",
                              "As you lower the bottle, you notice a note attached to the bottom."
                            ], () => {
                              alistairShowImageOverlay(
                                "https://res.cloudinary.com/ddmslr9na/image/upload/v1762127512/ag-servants-note-wine_eapmgu.png",
                                "Servant’s Note — Wine",
                                () => {
                                  if (!alistairState.journals.find(j => j.id === "wine_note")) {
                                    alistairAddJournal({
                                      id: "wine_note",
                                      title: "Servant’s Note — Wine",
                                      imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762127512/ag-servants-note-wine_eapmgu.png"
                                    });
                                    alistairRenderJournalPanel();
                                  }
                                  alistairState.health = Math.min(3, alistairState.health + 1);
                                  alistairRenderHearts();
                                  alistairState._cellarWineTaken = true;

                                  alistairResetNextButton();
                                  alistairStartDialogue([
                                    "That was… refreshing."
                                  ], () => { enterCellarFreeRoam(); });
                                }
                              );
                            });
                          }
                        }
                      ]
                    );
                  }
                }
              ]
            );
          });
        });
      }

      // --- Entry flow ---
      if (seenBefore) {
        alistairResetNextButton();
        alistairStartDialogue(
          ["Back down here. Glad the lights are still on."],
          () => { enterCellarFreeRoam(); }
        );
        return;
      }

      // First-time intro
      alistairResetNextButton();
      alistairStartDialogue(
        [
          "Oh— not as bad as I was expecting.",
          "Looks moderately comfy, actually. Thank God the lights are on…",
          "Oh my— look at all this wine. There’s enough down here to last a lifetime.",
          "Is that a note on the table?"
        ],
        () => { enterCellarFreeRoam(); }
      );
    }
  };

  //---------------------------------
  // --- STUDY ---
  //---------------------------------- 
  const AlistairRoom_ManorStudy = {
    act: 2,
    id: "manor_study",
    name: "Study",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761950535/ag-study-2_o8skms.png",
    render() { return ``; },
    onEnter() {
      alistairResetNextButton();
      alistairStartDialogue(["You have entered a new room."]);
    }
  };


  //---------------------------------
  // --- PARLOUR ---
  //----------------------------------
  const AlistairRoom_ManorParlour = {
    act: 2,
    id: "manor_parlour",
    name: "Parlour",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761790350/ag-parlour_pfv9si.png",

    render(gameState) {
      const hasDemonAsh = !!gameState.inventory.find(i => i.id === "demon_ash");
      const hasDaughtersNote = !!gameState.journals.find(j => j.id === "daughters_note");

      return `
        <!-- Hotspot 1: fireplace / secret way (yellow) -->
        <div id="alistair-parlour-fireplace" class="alistair-parlour-hotspot"></div>

        <!-- Hotspot 2: Demon Ash (only if not collected) -->
        ${hasDemonAsh ? "" : `
          <div id="alistair-parlour-ash" class="alistair-parlour-ash">
            <img
              src="https://res.cloudinary.com/ddmslr9na/image/upload/v1762170626/ag-bag-of-ash_gn69lb.png"
              alt="Demon Ash">
          </div>
        `}

        <!-- Hotspot 3: hidden note (yellow for now) -->
        ${hasDaughtersNote ? "" : `
          <div id="alistair-parlour-note" class="alistair-parlour-hotspot"></div>
        `}
      `;
    },

    onEnter(gameState) {
      // helper: free roam
      function enterParlourFreeRoam() {
        const bar = document.getElementById("alistair-dialogue-bar");
        if (bar) bar.classList.add("hidden");
        wireFireplaceHotspot();
        wireAshHotspot();
        wireNoteHotspot();
      }

      // check if player is ready to go through the fireplace passage
      function playerHasRitualRequirements() {
        // at least ONE of these
        const hasOneWeapon =
          alistairState.inventory.find(i => i.id === "bonds") ||
          alistairState.inventory.find(i => i.id === "kitchen_knife") ||
          alistairState.inventory.find(i => i.id === "moon_maiden_blade");

        // AND must have ALL of these 4
        const hasCandle       = !!alistairState.inventory.find(i => i.id === "candle");
        const hasRedHeart     = !!alistairState.inventory.find(i => i.id === "red_heart_stone");
        const hasBathSludge   = !!alistairState.inventory.find(i => i.id === "bath_sludge");
        const hasDemonAsh     = !!alistairState.inventory.find(i => i.id === "demon_ash");

        const hasAllFour = hasCandle && hasRedHeart && hasBathSludge && hasDemonAsh;

        return hasOneWeapon && hasAllFour;
      }

      // when blocked by the voice
      function doBlockedByVoiceThenFreeRoam() {
        alistairResetNextButton();
        alistairStartDialogue(
          [
            "I'm afraid more preparation is needed.",
            "You hear a voice in your head:",
            "“You will never get to this place. You shall never leave…!”"
          ],
          () => {
            alistairTakeDamage(1);
            alistairResetNextButton();
            alistairStartDialogue(
              ["Ouch… that hurt."],
              () => {
                enterParlourFreeRoam();
              }
            );
          }
        );
      }

      // fireplace hotspot logic
      function wireFireplaceHotspot() {
        const node = document.getElementById("alistair-parlour-fireplace");
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);

        clone.addEventListener("click", () => {
          // SECOND CLICK / REUSE PATH
          if (alistairState._parlourFireplaceSeenOnce) {
            alistairResetNextButton();
            alistairStartDialogue(
              ["Do you have all you need to proceed?"],
              () => {
                alistairShowChoices(
                  "Are you ready?",
                  [
                    {
                      label: "Yes",
                      onClick: () => {
                        if (playerHasRitualRequirements()) {
                          alistairResetNextButton();
                          alistairStartDialogue(
                            ["You may pass ahead."],
                            () => {
                              alistairPlayHallTransitionThenGo("manor_ritual_room");
                            }
                          );
                        } else {
                          // fail path with your new wording
                          alistairResetNextButton();
                          alistairStartDialogue(
                            [
                              "Seems you’ve got something missing.",
                              "The voice SCREAMS with laughter in your head, rattling your brain…"
                            ],
                            () => {
                              alistairTakeDamage(1);
                              alistairResetNextButton();
                              alistairStartDialogue(
                                ["Ouch… that hurt."],
                                () => { enterParlourFreeRoam(); }
                              );
                            }
                          );
                        }
                      }
                    },
                    {
                      label: "No",
                      onClick: () => {
                        alistairResetNextButton();
                        alistairStartDialogue(
                          ["Return when you have everything."],
                          () => { enterParlourFreeRoam(); }
                        );
                      }
                    }
                  ]
                );
              }
            );
            return;
          }

          // FIRST TIME path stays the same ↓↓↓
          alistairState._parlourFireplaceSeenOnce = true;

          alistairResetNextButton();
          alistairStartDialogue(
            [
              "As you move closer to the cold, still fireplace you feel a faint breeze coming from it...",
              "Like there’s something behind it."
            ],
            () => {
              // ... your first-time choices (unchanged)
            }
          );
        });
      }

      // demon ash hotspot
      function wireAshHotspot() {
        const node = document.getElementById("alistair-parlour-ash");
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);

        clone.addEventListener("click", () => {
          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1762170626/ag-bag-of-ash_gn69lb.png",
            "Demon’s Ash",
            () => {
              const alreadyHave = alistairState.inventory.find(i => i.id === "demon_ash");

              if (!alreadyHave) {
                alistairAddItem({
                  id: "demon_ash",
                  name: "Demon’s Ash",
                  imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762170626/ag-bag-of-ash_gn69lb.png"
                });
                alistairRenderInventoryPanel();
              }

              // 🔴 remove the ash hotspot from the scene so it’s gone immediately
              const ashNode = document.getElementById("alistair-parlour-ash");
              if (ashNode) ashNode.remove();

              alistairResetNextButton();
              alistairStartDialogue(
                [
                  "Hmmm… this doesn’t look too healthy.",
                  "And God — it smells bad.",
                  "Like rotten eggs.",
                  "I think we should keep this — never know, aye…!"
                ],
                () => { enterParlourFreeRoam(); }
              );
            }
          );
        });
      }

      // hidden/daughter note hotspot
      function wireNoteHotspot() {
        const node = document.getElementById("alistair-parlour-note");
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);

        clone.addEventListener("click", () => {
          // TODO: replace this URL with the actual daughter's note image
          const daughtersNoteImg = "https://res.cloudinary.com/ddmslr9na/image/upload/v1762170648/ag-diary-note-safe-code_adgxux.png";

          alistairShowImageOverlay(
            daughtersNoteImg,
            "Daughter’s Note",
            () => {
              if (!alistairState.journals.find(j => j.id === "daughters_note")) {
                alistairAddJournal({
                  id: "daughters_note",
                  title: "Daughter’s Note",
                  imgUrl: daughtersNoteImg
                });
                alistairRenderJournalPanel();
              }

              alistairResetNextButton();
              alistairStartDialogue(
                [
                  "It seems to be a note from the daughter.",
                  "I think we should read this…!"
                ],
                () => { enterParlourFreeRoam(); }
              );
            }
          );
        });
      }

      // --- entry flow ---
      const seenBefore = !!alistairState._enteredParlourOnce;
      alistairState._enteredParlourOnce = true;

      if (seenBefore) {
        alistairResetNextButton();
        alistairStartDialogue(
          ["Back to the parlour…"],
          () => { enterParlourFreeRoam(); }
        );
        return;
      }

      // first-time narration
      alistairResetNextButton();
      alistairStartDialogue(
        [
          "You step into the parlour.",
          "It’s eerie — still — like it’s been empty for centuries.",
          "You can almost imagine it once held fabulous balls and exquisite evenings.",
          "Above the fireplace there’s a sigil — not just for show.",
          "Maybe it’s containing magic to keep a spell active.",
          "The fireplace itself is dark, cold and dead… but you feel as if there’s some small part of life behind it.",
          "I think there might be something hidden in this room — maybe a note or information we can miss."
        ],
        () => {
          enterParlourFreeRoam();
        }
      );
    }
  };

  //---------------------------------
  // --- KITCHEN ---
  //----------------------------------
  const AlistairRoom_ManorKitchen = {
    act: 2,
    id: "manor_kitchen",
    name: "Kitchen",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1761790276/ag-kitchen_nrlmf2.png",

    render(gameState) {
      const hasKnife = !!gameState.inventory.find(i => i.id === "kitchen_knife");

      return `
        <!-- DEV HOTSPOTS (yellow squares) -->
        <div id="alistair-kitchen-door-hotspot" class="alistair-dev-hotspot"></div>
        ${hasKnife ? "" : `<div id="alistair-kitchen-knife-hotspot" class="alistair-dev-hotspot"></div>`}

        <!-- ALCHEMY HOTSPOT uses image -->
        <div id="alistair-kitchen-alchemy-hotspot" class="alistair-kitchen-alchemy-hotspot">
          <img
            src="https://res.cloudinary.com/ddmslr9na/image/upload/v1762107459/ag-potion-hot-spot_saii68.png"
            alt="Potion Workbench"
          >
        </div>
      `;
    },

    onEnter(gameState) {
      // --- helpers ---
      function enterKitchenFreeRoam() {
        const bar = document.getElementById('alistair-dialogue-bar');
        if (bar) bar.classList.add('hidden');
        wireDoorHotspot();
        wireKnifeHotspot();
        wireAlchemyHotspot();
      }

      function wireDoorHotspot() {
        const node = document.getElementById('alistair-kitchen-door-hotspot');
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);
        clone.addEventListener('click', () => {
          // play the manor transition cutscene and go to Back Garden
          alistairPlayHallTransitionThenGo('manor_garden');
        });
      }

      function wireKnifeHotspot() {
        const node = document.getElementById('alistair-kitchen-knife-hotspot');
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);
        clone.addEventListener('click', () => {
          // Show knife, add to inventory, remove hotspot, speak, free roam
          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1762098371/ag-kitchen-knife_seq1sj.png",
            "Kitchen Knife",
            () => {
              if (!alistairState.inventory.find(i => i.id === "kitchen_knife")) {
                alistairAddItem({
                  id: "kitchen_knife",
                  name: "Kitchen Knife",
                  imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762098371/ag-kitchen-knife_seq1sj.png"
                });
                alistairRenderInventoryPanel();
              }
              const knifeSpot = document.getElementById('alistair-kitchen-knife-hotspot');
              if (knifeSpot) knifeSpot.remove();

              alistairResetNextButton();
              alistairStartDialogue(
                [
                  "What's this doing here?",
                  "I can feel my husband… he's close. He must be here.",
                  "This knife is connected to him—but it feels heavier than it used to."
                ],
                () => { enterKitchenFreeRoam(); }
              );
            }
          );
        });
      }

      function wireAlchemyHotspot() {
        const node = document.getElementById('alistair-kitchen-alchemy-hotspot');
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);
        clone.addEventListener('click', () => {
          alistairResetNextButton();
          alistairStartDialogue(
            [
              "Small tools and empty vials… a pestle and mortar.",
              "I think we could craft a potion here."
            ],
            () => {
              alistairShowChoices(
                "Do you have all you need to craft?",
                [
                  {
                    label: "Yes",
                    onClick: () => {
                      const hasWater = !!alistairState.inventory.find(i => i.id === "blessed_water");
                      const hasHerb  = !!alistairState.inventory.find(i => i.id === "strange_herb"); // Nightsingers Herb
                      const hasMold  = !!alistairState.inventory.find(i => i.id === "cellar_mold");
                      const haveAll  = hasWater && hasHerb && hasMold;

                      alistairResetNextButton();

                      if (haveAll) {
                        // Success craft: add Cure Curse
                        alistairShowImageOverlay(
                          "https://res.cloudinary.com/ddmslr9na/image/upload/v1762098684/ag-cure_curse_potion_gcoasg.png",
                          "Cure Curse",
                          () => {
                            if (!alistairState.inventory.find(i => i.id === "cure_curse")) {
                              alistairAddItem({
                                id: "cure_curse",
                                name: "Cure Curse",
                                imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762098684/ag-cure_curse_potion_gcoasg.png"
                              });
                              alistairRenderInventoryPanel();
                            }
                            alistairResetNextButton();
                            // original line
                            alistairStartDialogue(
                              ["We’ve found a cure!"],
                              () => {
                                // ask to consume it right now
                                alistairShowChoices(
                                  "Oh my… what did I do? What is this I’ve made… The label says: “Potion of Cure Curses — remedy to cure the most evil curses and sickness.” Do you wish to consume this potion?",
                                  [
                                    {
                                      label: "Yes, drink it",
                                      onClick: () => {
                                        alistairResetNextButton();
                                        alistairStartDialogue(
                                          [
                                            "You pop the cork and start gulping this tonic.",
                                            "The taste is dreamy — not awful in any way.",
                                            "You can feel this rot feeling leaving your bones.",
                                            "The curse has been cured."
                                          ],
                                          () => {
                                            // actually cure the curse
                                            alistairState.isCursed = false;

                                            // ⬇️ NEW: give Moon Maiden’s Blade
                                            const alreadyHaveBlade = alistairState.inventory.find(i => i.id === "moon_maiden_blade");
                                            alistairShowImageOverlay(
                                              "https://res.cloudinary.com/ddmslr9na/image/upload/v1762168460/ag-blessed-dagger_mdg7qq.png",
                                              "Moon Maiden’s Blade",
                                              () => {
                                                if (!alreadyHaveBlade) {
                                                  alistairAddItem({
                                                    id: "moon_maiden_blade",
                                                    name: "Moon Maiden’s Blade",
                                                    imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762168460/ag-blessed-dagger_mdg7qq.png"
                                                  });
                                                  alistairRenderInventoryPanel();
                                                }

                                                alistairResetNextButton();
                                                alistairStartDialogue(
                                                  [
                                                    "This is the Moon Maiden’s knife.",
                                                    "An extremely rare, powerful dagger — blessed enough to strike down any demonic or evil presence.",
                                                    "We should keep this close."
                                                  ],
                                                  () => {
                                                    const bar = document.getElementById('alistair-dialogue-bar');
                                                    if (bar) bar.classList.add('hidden');
                                                    enterKitchenFreeRoam();
                                                  }
                                                );
                                              }
                                            );
                                          }
                                        );
                                      }
                                    },
                                    {
                                      label: "No, save it",
                                      onClick: () => {
                                        alistairResetNextButton();
                                        alistairStartDialogue(
                                          [
                                            "Okay, we’ve put this away safe.",
                                            "Maybe we can drink it later."
                                          ],
                                          () => {
                                            const bar = document.getElementById('alistair-dialogue-bar');
                                            if (bar) bar.classList.add('hidden');
                                            enterKitchenFreeRoam();
                                          }
                                        );
                                      }
                                    }
                                  ]
                                );
                              }
                            );
                          }
                        );
                      } else {
                        // ❌ Missing ingredients: story beat → damage → hint → free roam
                        alistairResetNextButton();
                        alistairStartDialogue(
                          [
                            "Oops… there’s definitely something missing.",
                            "The Watcher laughs. You hear a voice, but the words are not clear.",
                            "That voice shudders through your body and chips at your mind."
                          ],
                          () => {
                            alistairTakeDamage(1);
                            alistairResetNextButton();
                            alistairStartDialogue(
                              ["Come back when all ingredients are found."],
                              () => { enterKitchenFreeRoam(); }
                            );
                          }
                        );
                      }
                    }
                  },
                  {
                    label: "No",
                    onClick: () => {
                      enterKitchenFreeRoam();
                    }
                  }
                ]
              );
            }
          );
        });
      }

      // --- entry flow ---
      const seenBefore = !!alistairState._enteredKitchenOnce;
      alistairState._enteredKitchenOnce = true;

      if (seenBefore) {
        alistairResetNextButton();
        alistairStartDialogue(
          ["Back in the kitchen. It still feels wrong in here."],
          () => { enterKitchenFreeRoam(); }
        );
        return;
      }

      // First-time narration
      alistairResetNextButton();
      alistairStartDialogue(
        [
          "You step into the kitchen. It’s eerie—quiet—like the room is holding its breath.",
          "This doesn’t look like the cooks have been here in a long time.",
          "We’re still looking for Alistair… I thought we would’ve found the fat fool in the kitchen.",
          "There must be something useful in here to find.",
          "Must be something in cupboards or draws?",
          "The back door looks… open."
        ],
        () => { enterKitchenFreeRoam(); }
      );
    }
  };


  //---------------------------------
  // --- BACK GARDEN ---
  //----------------------------------
  const AlistairRoom_ManorGarden = {
    act: 2,
    id: "manor_garden",
    name: "Back Garden",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762099418/ag-manor-back-garden_fyruqh.png",

    render(gameState) {
      const hasCellarKey = !!gameState.inventory.find(i => i.id === "cellar_key");

      return `
        <!-- Statue hotspot (yellow dev box with empty img for now) -->
        <div id="alistair-garden-statue-hotspot" class="alistair-garden-statue-hotspot">
          <img src="https://res.cloudinary.com/ddmslr9na/image/upload/v1762121084/ag-statue-plaque_bwmp9l.png" alt="Statue Placeholder">
        </div>

        <!-- Cellar Key hotspot (only if not already picked up) -->
        ${hasCellarKey ? "" : `
        <div id="alistair-garden-key-hotspot" class="alistair-garden-key-hotspot">
          <img
            src="https://res.cloudinary.com/ddmslr9na/image/upload/v1762118719/ag-wine-celler-key_b2sm1w.png"
            alt="Cellar Key"
          >
        </div>
        `}
      `;
    },

    onEnter(gameState) {
      const seenBefore = !!alistairState._enteredGardenOnce;
      alistairState._enteredGardenOnce = true;

      // helper: free roam mode
      function enterGardenFreeRoam() {
        const bar = document.getElementById("alistair-dialogue-bar");
        if (bar) bar.classList.add("hidden");
        wireStatueHotspot();
        wireKeyHotspot();
        wireWaterHotspot();
      }

      // --- Statue logic (heals only once) ---
      function wireStatueHotspot() {
        const node = document.getElementById("alistair-garden-statue-hotspot");
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);

        clone.addEventListener("click", () => {
          // Placeholder image for statue
          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1762121084/ag-statue-plaque_bwmp9l.png",
            "Statue of the Divine Maiden",
            () => {
              alistairResetNextButton();
              alistairStartDialogue([
                "A plaque beneath the statue reads:",
                "‘This is the Maiden of the Moon — protector of the pure.’",
                "‘Are you of pure heart?’"
              ], () => {
                alistairShowChoices(
                  "Are you of pure heart?",
                  [
                    {
                      label: "Yes",
                      onClick: () => {
                        const cursed = !!alistairState.isCursed;
                        const alreadyHealed = !!alistairState._gardenHealedOnce;
                        alistairResetNextButton();

                        if (!cursed) {
                          if (alreadyHealed) {
                            // Already healed once: no more healing
                            alistairStartDialogue([
                              "The statue remains still.",
                              "A whisper rattles the leaves: “Do not be greedy, mortal.”",
                              "“I have aided as much as I can for now… the rest is up to you.”"
                            ], () => {
                              giveBlessedWater();
                            });
                          } else {
                            // First and only heal
                            alistairState.health = 3;
                            alistairRenderHearts();
                            alistairState._gardenHealedOnce = true;
                            alistairStartDialogue([
                              "A warm light surrounds you… the statue glows softly.",
                              "Your wounds fade — your strength restored."
                            ], () => {
                              giveBlessedWater();
                            });
                          }
                        } else {
                          // Cursed: no heal
                          alistairStartDialogue([
                            "The statue’s eyes flicker with sorrow.",
                            "‘Your heart may have been pure once... but it is now tainted.’",
                            "‘I can only heal those untouched by the curse.’"
                          ], () => {
                            giveBlessedWater();
                          });
                        }
                      }
                    },
                    {
                      label: "No",
                      onClick: () => {
                        alistairResetNextButton();
                        alistairStartDialogue([
                          "You admit your flaws quietly.",
                          "The statue seems to understand… but offers no warmth in return."
                        ], () => {
                          giveBlessedWater();
                        });
                      }
                    }
                  ]
                );
              });
            }
          );
        });
      }

      // --- Give Blessed Water item (only once) ---
      function giveBlessedWater() {
        const alreadyHave = alistairState.inventory.some(i => i.id === "blessed_water");
        if (alreadyHave) {
          enterGardenFreeRoam();
          return;
        }

        alistairAddItem({
          id: "blessed_water",
          name: "Blessed Water",
          imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762118749/ag-blessed-water_rpcymh.png"
        });
        alistairRenderInventoryPanel();
        alistairShowImageOverlay(
          "https://res.cloudinary.com/ddmslr9na/image/upload/v1762118749/ag-blessed-water_rpcymh.png",
          "You find a small flask of Blessed Water lying beside the statue.",
          () => {
            alistairResetNextButton();
            alistairStartDialogue([
              "I think this might be used with that potion brewing bench in the kitchen."
            ], () => {
              enterGardenFreeRoam();
            });
          }
        );
      }

      // --- Cellar Key logic (remove from scene after pickup) ---
      function wireKeyHotspot() {
        const node = document.getElementById("alistair-garden-key-hotspot");
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);

        clone.addEventListener("click", () => {
          const alreadyHave = alistairState.inventory.some(i => i.id === "cellar_key");
          if (alreadyHave) {
            alistairStartDialogue(["You've already picked up the key."]);
            return;
          }

          alistairAddItem({
            id: "cellar_key",
            name: "Cellar Key",
            imgUrl: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762118719/ag-wine-celler-key_b2sm1w.png"
          });
          alistairRenderInventoryPanel();

          // Remove the key hotspot so it no longer shows in scene
          const keySpot = document.getElementById("alistair-garden-key-hotspot");
          if (keySpot) keySpot.remove();

          alistairShowImageOverlay(
            "https://res.cloudinary.com/ddmslr9na/image/upload/v1762118719/ag-wine-celler-key_b2sm1w.png",
            "Looks like we’ve found a key — it’s engraved with the word ‘Cellar’.",
            () => {
              alistairResetNextButton();
              alistairStartDialogue([
                "Let’s keep this… it might open something deeper within the manor."
              ], () => {
                enterGardenFreeRoam();
              });
            }
          );
        });
      }

      // --- Blessed Water hotspot (for dev testing, optional direct pickup) ---
      function wireWaterHotspot() {
        const node = document.getElementById("alistair-garden-water-hotspot");
        if (!node) return;
        const clone = node.cloneNode(true);
        node.replaceWith(clone);
        clone.addEventListener("click", () => {
          giveBlessedWater();
        });
      }

      // --- Entry dialogue ---
      if (seenBefore) {
        alistairResetNextButton();
        alistairStartDialogue([
          "It’s more fresh out here, and this feels as if I’m ok to rest a while.",
          "Let’s head back inside when we’re ready."
        ], () => {
          enterGardenFreeRoam();
        });
        return;
      }

      alistairResetNextButton();
      alistairStartDialogue([
        "You step into the back garden.",
        "The air feels different — cleaner. Protected from the darkness inside the manor.",
        "A statue of a divine figure stands watching over the overgrown path.",
        "A magpie bursts from the bushes — startled — something shiny glints where it flew from."
      ], () => {
        enterGardenFreeRoam();
      });
    }
  };

  //---------------------------------
  // --- SECRET RITUAL ROOM ---
  //----------------------------------
  const AlistairRoom_ManorRitualRoom = {
    act: 2,
    id: "manor_ritual_room",
    name: "Ritual Chamber",
    background: "https://res.cloudinary.com/ddmslr9na/image/upload/v1762170857/ag-panic-ritual-room_nzjcxv.png",
    render(gameState) {
      return ``; // add hotspots later
    },
    onEnter(gameState) {
      alistairResetNextButton();
      alistairStartDialogue(
        [
          "You squeeze through the narrow gap behind the fireplace.",
          "The air in here is thick with old magic.",
          "Something was done here… and it wasn’t holy."
        ]
      );
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
      manor_hall: AlistairRoom_ManorHall,
      manor_bedroom: AlistairRoom_ManorBedroom,
      manor_bathroom: AlistairRoom_ManorBathroom,
      manor_wine_cellar: AlistairRoom_ManorWineCellar,
      manor_study: AlistairRoom_ManorStudy,
      manor_parlour: AlistairRoom_ManorParlour,
      manor_kitchen: AlistairRoom_ManorKitchen,
      manor_garden: AlistairRoom_ManorGarden,
      manor_ritual_room: AlistairRoom_ManorRitualRoom
    };

 // -------------------------------   
//    DEV JUMP TO ROOM FOR TESTING
//    REMOVE ONCE FINISHED
// ---------------------------------  
  // --- DEV CONSOLE HELPERS (remove for production) ---
  window.ag = {
    /** Jump instantly to a room (no cutscene). */
    go: (roomId, recordHistory = false) => alistairGoToRoom(roomId, { recordHistory }),

    /** Play the generic transition, then go to a room (Act I style). */
    cut: (roomId) => alistairPlayTransitionThenGoRoom(roomId),

    /** Play the hall transition (Act II style), then go to a room. */
    hall: (roomId) => alistairPlayHallTransitionThenGo(roomId),

    /** Force the act splash (handy if a room expects Act 2). */
    act: (n) => alistairEnterAct(n),

    /** Peek at/modify state quickly. */
    state: alistairState,

    /** Quick helpers */
    hideDialogue: () => document.getElementById('alistair-dialogue-bar')?.classList.add('hidden'),
    showDialogue: () => document.getElementById('alistair-dialogue-bar')?.classList.remove('hidden'),

    /** Toggle “first time” flags if needed during testing */
    flags: {
      resetBathroomOnce: () => { delete alistairState._enteredBathroomOnce; },
      resetKitchenOnce:  () => { delete alistairState._enteredKitchenOnce; },
      resetHallOnce:     () => { delete alistairState._enteredManorHallOnce; },
    },
  };
  console.log("ag dev helpers ready. Try ag.go('manor_bathroom')");

  // USE COMMMAND IN DEVTOOLS CONSOLE 
  // EXAMPLE 
  // ag.go('manor_kitchen'); TO GO TO  KITCHEN


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
    const go = () => { alistairGoToRoom('the_well'); };
    if (vid) { vid.addEventListener('ended', go); vid.addEventListener('error', go); }
    else { go(); }
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

  // ======= HALL → ROOM TRANSITION (custom cutscene) =======
  const ALISTAIR_HALL_TRANSITION_URL =
    "https://res.cloudinary.com/ddmslr9na/video/upload/v1761869702/ag-manor-house-transition_rryuwj.mp4";

  function alistairPlayHallTransitionThenGo(nextRoomId) {
    const roomContainer = document.getElementById('alistair-room-container');
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) bar.classList.add('hidden');

    roomContainer.style.backgroundImage = 'none';
    roomContainer.innerHTML = `
      <video id="alistair-hall-transition-video"
            autoplay
            muted
            playsinline
            preload="auto"
            style="position:absolute; inset:0; width:100%; height:100%; display:block; object-fit:cover; object-position:center;">
        <source src="${ALISTAIR_HALL_TRANSITION_URL}" type="video/mp4">
      </video>
    `;

    const vid = document.getElementById('alistair-hall-transition-video');
    const go = () => alistairGoToRoom(nextRoomId);
    if (vid) { vid.addEventListener('ended', go); vid.addEventListener('error', go); }
    else { go(); }
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

  // Manor Entrance cutscene -> go to Manor Hall
  function alistairPlayManorEntranceCutsceneThenGoHall(videoUrl) {
    const roomContainer = document.getElementById('alistair-room-container');

    // hide dialogue during the cutscene
    const bar = document.getElementById('alistair-dialogue-bar');
    if (bar) bar.classList.add('hidden');

    // clear current visuals and play the manor entrance clip
    roomContainer.style.backgroundImage = 'none';
    roomContainer.innerHTML = `
      <video id="alistair-manor-entrance-video"
            autoplay
            playsinline
            style="width:100%;height:100%;object-fit:cover;">
        <source src="${videoUrl}" type="video/mp4">
      </video>
      <div class="alistair-room-inner">
        <p>…the house inhales.</p>
      </div>
    `;

    const vid = document.getElementById('alistair-manor-entrance-video');
    const go = () => { alistairGoToRoom('manor_hall'); };
    if (vid) { vid.addEventListener('ended', go); vid.addEventListener('error', go); }
    else { go(); }
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

  if (invModal) {
    invModal.addEventListener('click', (evt) => {
      if (evt.target === invModal) {
        alistairCloseInventory();
      }
    });
  }

  // ======= GLOBAL DIALOGUE CLICK-LOCK =======
  // While the dialogue bar is visible, ignore clicks that are NOT inside it.
  document.addEventListener(
    'click',
    (evt) => {
      const bar = document.getElementById('alistair-dialogue-bar');
      if (!bar || bar.classList.contains('hidden')) return;

      // Allow clicks inside the dialogue bar (Next / choices)
      if (bar.contains(evt.target)) return;

      // ✅ Allow clicks inside any visible modal (overlays, journal, inventory, etc.)
      const openModal = document.querySelector('.alistair-modal:not(.hidden)');
      if (openModal && openModal.contains(evt.target)) return;

      // Block everything else while dialogue is open
      evt.stopPropagation();
      evt.preventDefault();
    },
    true
  );


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
