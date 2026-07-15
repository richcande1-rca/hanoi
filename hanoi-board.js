(() => {
  "use strict";

  const API_URL = "https://hanoi-board-api.rich-gothic.workers.dev/api/board";
  const NAME_KEY = "hanoi-online-board-name";
  const MODE_LABELS = {
    classic: "CLASSIC",
    bicolor: "BICOLOR",
    clockwise: "CLOCKWISE",
    magnetic: "MAGNETIC",
  };

  const pageName = window.location.pathname.split("/").pop().toLowerCase();
  const mode = pageName === "bicolor.html"
    ? "bicolor"
    : pageName === "clockwise.html"
      ? "clockwise"
      : pageName === "magnetic.html"
        ? "magnetic"
        : "classic";

  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "hanoi-board.css";
  document.head.appendChild(stylesheet);

  const completeCard = document.querySelector("#completeDialog .complete-card");
  const nextButton = document.querySelector("#playAgainButton");
  const headerActions = document.querySelector(".header-actions");

  if (!completeCard || !nextButton || !headerActions || typeof finishGame !== "function") return;

  let currentScore = null;
  let submitted = false;
  let paused = false;
  let pausedHadStarted = false;
  let pausedInstruction = "";

  const boardButton = document.createElement("button");
  boardButton.className = "utility-button board-button";
  boardButton.type = "button";
  boardButton.textContent = "BOARD";
  boardButton.setAttribute("aria-label", "Open leaderboard");

  const pauseButton = document.createElement("button");
  pauseButton.className = "utility-button pause-button";
  pauseButton.type = "button";
  pauseButton.textContent = "PAUSE";
  pauseButton.setAttribute("aria-label", "Pause timer and moves");
  pauseButton.setAttribute("aria-pressed", "false");

  headerActions.prepend(boardButton, pauseButton);

  const leaderboardDialog = document.createElement("dialog");
  leaderboardDialog.className = "leaderboard-dialog";
  leaderboardDialog.innerHTML = `
    <div class="leaderboard-card">
      <div class="online-board-head">
        <div>
          <span class="online-board-kicker">ONLINE BOARD</span>
          <strong id="leaderboardScope">CURRENT PUZZLE</strong>
        </div>
        <span class="online-board-order">MOVES · TIME</span>
      </div>
      <div class="online-board-wall leaderboard-wall" id="leaderboardWall" aria-live="polite">
        <p class="online-board-empty">Calling the tower...</p>
      </div>
      <button id="leaderboardClose" type="button">CLOSE</button>
    </div>
  `;
  document.body.appendChild(leaderboardDialog);

  const leaderboardScope = leaderboardDialog.querySelector("#leaderboardScope");
  const leaderboardWall = leaderboardDialog.querySelector("#leaderboardWall");
  const leaderboardClose = leaderboardDialog.querySelector("#leaderboardClose");

  const board = document.createElement("section");
  board.className = "online-board";
  board.setAttribute("aria-label", "Online Hanoi scoreboard");
  board.innerHTML = `
    <div class="online-board-head">
      <div>
        <span class="online-board-kicker">ONLINE BOARD</span>
        <strong id="onlineBoardScope">CURRENT PUZZLE</strong>
      </div>
      <span class="online-board-order">MOVES · TIME</span>
    </div>

    <div class="online-board-fields">
      <label>
        <span>NAME</span>
        <input id="onlineBoardName" type="text" maxlength="18" autocomplete="nickname" placeholder="Anonymous" />
      </label>
      <label>
        <span>COMMENT</span>
        <input id="onlineBoardMessage" type="text" maxlength="80" placeholder="This seemed reasonable at first." />
      </label>
    </div>

    <button class="online-board-submit" id="onlineBoardSubmit" type="button">POST SCORE</button>
    <p class="online-board-status" id="onlineBoardStatus" aria-live="polite"></p>
    <div class="online-board-wall" id="onlineBoardWall" aria-live="polite">
      <p class="online-board-empty">Complete a puzzle to load its board.</p>
    </div>
  `;

  completeCard.insertBefore(board, nextButton);

  const scopeElement = board.querySelector("#onlineBoardScope");
  const nameInput = board.querySelector("#onlineBoardName");
  const messageInput = board.querySelector("#onlineBoardMessage");
  const submitButton = board.querySelector("#onlineBoardSubmit");
  const statusElement = board.querySelector("#onlineBoardStatus");
  const wallElement = board.querySelector("#onlineBoardWall");

  try {
    nameInput.value = localStorage.getItem(NAME_KEY) || "";
  } catch {
    // The board still works when browser storage is unavailable.
  }

  function currentSize() {
    return mode === "bicolor" ? pairCount : discCount;
  }

  function sizeWord(size) {
    if (mode === "bicolor") return size === 1 ? "PAIR" : "PAIRS";
    return size === 1 ? "DISC" : "DISCS";
  }

  function scopeText(size) {
    return `${MODE_LABELS[mode]} · ${size} ${sizeWord(size)}`;
  }

  function formatBoardTime(timeMs) {
    const safeMs = Math.max(0, Number(timeMs) || 0);
    const totalTenths = Math.floor(safeMs / 100);
    const minutes = Math.floor(totalTenths / 600);
    const seconds = Math.floor((totalTenths % 600) / 10);
    const tenths = totalTenths % 10;
    return `${minutes}:${String(seconds).padStart(2, "0")}.${tenths}`;
  }

  function setStatus(text, state = "") {
    statusElement.textContent = text;
    statusElement.dataset.state = state;
  }

  function makeEntry(entry, rank) {
    const article = document.createElement("article");
    article.className = "online-board-entry";

    const top = document.createElement("div");
    top.className = "online-board-entry-top";

    const identity = document.createElement("span");
    identity.className = "online-board-identity";

    const rankElement = document.createElement("b");
    rankElement.textContent = `${rank}.`;

    const nameElement = document.createElement("strong");
    nameElement.textContent = entry.name || "Anonymous";

    identity.append(rankElement, nameElement);

    const score = document.createElement("span");
    score.className = "online-board-score";
    score.textContent = `${entry.moves} MOVES · ${formatBoardTime(entry.timeMs)}`;

    top.append(identity, score);
    article.appendChild(top);

    if (entry.message) {
      const comment = document.createElement("p");
      comment.textContent = entry.message;
      article.appendChild(comment);
    }

    return article;
  }

  function renderEntries(target, entries) {
    target.replaceChildren();

    if (!Array.isArray(entries) || entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "online-board-empty";
      empty.textContent = "No scores yet. First place is sitting there unattended.";
      target.appendChild(empty);
      return;
    }

    entries.slice(0, 20).forEach((entry, index) => {
      target.appendChild(makeEntry(entry, index + 1));
    });
  }

  async function loadBoard(target, size) {
    target.innerHTML = '<p class="online-board-empty">Calling the tower...</p>';

    try {
      const query = new URLSearchParams({
        mode,
        size: String(size),
      });
      const response = await fetch(`${API_URL}?${query}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Board unavailable.");
      }

      renderEntries(target, data.entries);
    } catch {
      target.innerHTML = '<p class="online-board-empty">The online board is unavailable. The puzzle is not impressed.</p>';
    }
  }

  function captureCompletedRun() {
    currentScore = {
      mode,
      size: currentSize(),
      moves: Number(moveCountElement.textContent) || moves,
      timeMs: Math.max(0, Math.round(elapsedMs)),
    };

    submitted = false;
    submitButton.disabled = false;
    submitButton.textContent = "POST SCORE";
    messageInput.value = "";
    scopeElement.textContent = scopeText(currentScore.size);
    setStatus("");
    loadBoard(wallElement, currentScore.size);
  }

  function resetPauseState() {
    paused = false;
    pausedHadStarted = false;
    pausedInstruction = "";
    pauseButton.disabled = false;
    pauseButton.textContent = "PAUSE";
    pauseButton.setAttribute("aria-label", "Pause timer and moves");
    pauseButton.setAttribute("aria-pressed", "false");
  }

  function pauseGame() {
    if (paused || locked) return;

    paused = true;
    pausedHadStarted = startedAt !== null;
    pausedInstruction = instructionElement.textContent;

    if (pausedHadStarted) {
      updateTimer();
      stopTimer();
    }

    locked = true;
    instructionElement.textContent = "Paused.";
    pauseButton.textContent = "RESUME";
    pauseButton.setAttribute("aria-label", "Resume timer and moves");
    pauseButton.setAttribute("aria-pressed", "true");
  }

  function resumeGame() {
    if (!paused) return;

    paused = false;
    locked = false;

    if (pausedHadStarted) {
      startedAt = performance.now() - elapsedMs;
      timerId = window.setInterval(updateTimer, 200);
    }

    instructionElement.textContent = pausedInstruction || "Tap a peg to continue.";
    pauseButton.textContent = "PAUSE";
    pauseButton.setAttribute("aria-label", "Pause timer and moves");
    pauseButton.setAttribute("aria-pressed", "false");
  }

  pauseButton.addEventListener("click", () => {
    if (paused) {
      resumeGame();
    } else {
      pauseGame();
    }
  });

  boardButton.addEventListener("click", () => {
    const size = currentSize();
    leaderboardScope.textContent = scopeText(size);
    loadBoard(leaderboardWall, size);
    leaderboardDialog.showModal();
  });

  leaderboardClose.addEventListener("click", () => leaderboardDialog.close());

  leaderboardDialog.addEventListener("cancel", () => {
    leaderboardDialog.close();
  });

  submitButton.addEventListener("click", async () => {
    if (!currentScore || submitted) return;

    const name = nameInput.value.trim();
    const message = messageInput.value.trim();

    try {
      localStorage.setItem(NAME_KEY, name);
    } catch {
      // Remembering the name is optional.
    }

    submitButton.disabled = true;
    submitButton.textContent = "POSTING...";
    setStatus("Sending score to the board...");

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message,
          mode: currentScore.mode,
          size: currentScore.size,
          moves: currentScore.moves,
          timeMs: currentScore.timeMs,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Score rejected.");
      }

      submitted = true;
      submitButton.textContent = "POSTED";
      setStatus("Your score is on the board.", "success");
      renderEntries(wallElement, data.entries);
    } catch {
      submitButton.disabled = false;
      submitButton.textContent = "TRY AGAIN";
      setStatus("Could not reach the board. Your current run is still ready to post.", "error");
    }
  });

  const originalStartGame = startGame;
  startGame = function startGameWithSharedControls(...args) {
    resetPauseState();
    return originalStartGame.apply(this, args);
  };

  const originalFinishGame = finishGame;
  finishGame = function finishGameWithOnlineBoard(...args) {
    const result = originalFinishGame.apply(this, args);
    paused = false;
    pauseButton.disabled = true;
    pauseButton.textContent = "PAUSE";
    pauseButton.setAttribute("aria-pressed", "false");
    captureCompletedRun();
    return result;
  };
})();