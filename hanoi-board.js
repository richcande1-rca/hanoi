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

  if (!completeCard || !nextButton || typeof finishGame !== "function") return;

  let currentScore = null;
  let submitted = false;

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

  function renderEntries(entries) {
    wallElement.replaceChildren();

    if (!Array.isArray(entries) || entries.length === 0) {
      const empty = document.createElement("p");
      empty.className = "online-board-empty";
      empty.textContent = "No scores yet. First place is sitting there unattended.";
      wallElement.appendChild(empty);
      return;
    }

    entries.slice(0, 20).forEach((entry, index) => {
      wallElement.appendChild(makeEntry(entry, index + 1));
    });
  }

  async function loadBoard() {
    if (!currentScore) return;

    wallElement.innerHTML = '<p class="online-board-empty">Calling the tower...</p>';

    try {
      const query = new URLSearchParams({
        mode: currentScore.mode,
        size: String(currentScore.size),
      });
      const response = await fetch(`${API_URL}?${query}`);
      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Board unavailable.");
      }

      renderEntries(data.entries);
    } catch {
      wallElement.innerHTML = '<p class="online-board-empty">The online board is unavailable. The puzzle is not impressed.</p>';
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
    scopeElement.textContent = `${MODE_LABELS[mode]} · ${currentScore.size} ${sizeWord(currentScore.size)}`;
    setStatus("");
    loadBoard();
  }

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
      renderEntries(data.entries);
    } catch {
      submitButton.disabled = false;
      submitButton.textContent = "TRY AGAIN";
      setStatus("Could not reach the board. Your current run is still ready to post.", "error");
    }
  });

  const originalFinishGame = finishGame;
  finishGame = function finishGameWithOnlineBoard(...args) {
    const result = originalFinishGame.apply(this, args);
    captureCompletedRun();
    return result;
  };
})();