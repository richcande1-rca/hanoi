const MIN_DISCS = 3;
const STARTING_DISCS = 3;
const MAX_DISCS = 8;
const RULES_SEEN_KEY = "hanoi-rules-seen-v1";
const DISC_COUNT_KEY = "hanoi-classic-starting-discs-v1";

const rulesStylesheet = document.createElement("link");
rulesStylesheet.rel = "stylesheet";
rulesStylesheet.href = "rules.css";
document.head.appendChild(rulesStylesheet);

const stacks = [[], [], []];
const stackElements = [
  document.querySelector("#stack0"),
  document.querySelector("#stack1"),
  document.querySelector("#stack2")
];
const pegZones = [...document.querySelectorAll(".peg-zone")];
const discOptionElements = [...document.querySelectorAll(".disc-option")];

const moveCountElement = document.querySelector("#moveCount");
const minimumMovesElement = document.querySelector("#minimumMoves");
const timeDisplayElement = document.querySelector("#timeDisplay");
const instructionElement = document.querySelector("#instruction");
const levelMarkElement = document.querySelector("#levelMark");
const helpButton = document.querySelector("#helpButton");
const resetButton = document.querySelector("#resetButton");

const rulesDialog = document.querySelector("#rulesDialog");
const beginButton = document.querySelector("#beginButton");
const completeDialog = document.querySelector("#completeDialog");
const resultTitle = document.querySelector("#resultTitle");
const resultMoves = document.querySelector("#resultMoves");
const resultTime = document.querySelector("#resultTime");
const bestTime = document.querySelector("#bestTime");
const playAgainButton = document.querySelector("#playAgainButton");

let startingDiscCount = readStartingDiscCount();
let discCount = startingDiscCount;
let nextDiscCount = startingDiscCount;
let moves = 0;
let selectedPeg = null;
let startedAt = null;
let timerId = null;
let elapsedMs = 0;
let locked = false;

const palette = [
  ["#57fbff", "#16cbd8", "#075b70", "rgba(54, 245, 255, 0.82)"],
  ["#7ae7ff", "#398fff", "#16366e", "rgba(75, 155, 255, 0.82)"],
  ["#b19aff", "#7653ff", "#2d176d", "rgba(143, 93, 255, 0.84)"],
  ["#df79ff", "#a744e6", "#4d145e", "rgba(206, 80, 255, 0.84)"],
  ["#ff75db", "#ee3ead", "#6d124b", "rgba(255, 63, 189, 0.84)"],
  ["#ff7099", "#eb366c", "#6a122d", "rgba(255, 65, 108, 0.82)"],
  ["#ffc37a", "#f18442", "#6e2e16", "rgba(255, 151, 79, 0.82)"],
  ["#fff179", "#e3bf3b", "#635215", "rgba(255, 224, 75, 0.8)"]
];

function minimumMoves() {
  return (2 ** discCount) - 1;
}

function levelLabel() {
  if (discCount === STARTING_DISCS) {
    return `BEGINNER · ${discCount} DISCS`;
  }

  return `LEVEL ${discCount - 2} · ${discCount} DISCS`;
}

function readStartingDiscCount() {
  try {
    const stored = Number(localStorage.getItem(DISC_COUNT_KEY));
    return Number.isInteger(stored) && stored >= MIN_DISCS && stored <= MAX_DISCS
      ? stored
      : STARTING_DISCS;
  } catch {
    return STARTING_DISCS;
  }
}

function saveStartingDiscCount(count) {
  startingDiscCount = count;
  try {
    localStorage.setItem(DISC_COUNT_KEY, String(count));
  } catch {
    // The picker still works when browser storage is unavailable.
  }
}

function updateDiscPicker() {
  discOptionElements.forEach((option) => {
    const count = Number(option.dataset.discs);
    const isActive = count === discCount;
    option.classList.toggle("active", isActive);
    option.setAttribute("aria-pressed", String(isActive));
  });
}

function hasSeenRules() {
  try {
    return localStorage.getItem(RULES_SEEN_KEY) === "yes";
  } catch {
    return false;
  }
}

function markRulesSeen() {
  try {
    localStorage.setItem(RULES_SEEN_KEY, "yes");
  } catch {
    // The game still works when browser storage is unavailable.
  }
}

function openRules() {
  if (rulesDialog && !rulesDialog.open) {
    rulesDialog.showModal();
  }
}

function closeRules() {
  markRulesSeen();
  if (rulesDialog?.open) {
    rulesDialog.close();
  }
}

function startGame(count = discCount) {
  stopTimer();
  discCount = Math.max(MIN_DISCS, Math.min(MAX_DISCS, count));
  nextDiscCount = discCount;
  moves = 0;
  selectedPeg = null;
  startedAt = null;
  elapsedMs = 0;
  locked = false;

  stacks[0] = [];
  stacks[1] = [];
  stacks[2] = [];

  for (let size = discCount; size >= 1; size -= 1) {
    stacks[0].push(size);
  }

  moveCountElement.textContent = "0";
  minimumMovesElement.textContent = String(minimumMoves());
  timeDisplayElement.textContent = "0:00";
  instructionElement.textContent = "Tap a peg to lift its top disc.";

  if (levelMarkElement) {
    levelMarkElement.textContent = levelLabel();
  }

  updateDiscPicker();
  render();
}

function render() {
  stackElements.forEach((element) => {
    element.replaceChildren();
  });

  stacks.forEach((stack, pegIndex) => {
    stack.forEach((size, index) => {
      const disc = document.createElement("span");
      const [bright, mid, dark, glow] = palette[(size - 1) % palette.length];

      const minimumWidth = discCount >= 7 ? 31 : 35;
      const maximumWidth = discCount >= 7 ? 91 : 94;
      const width = discCount === 1
        ? maximumWidth
        : minimumWidth + ((size - 1) / (discCount - 1)) * (maximumWidth - minimumWidth);

      const height = Math.max(18, Math.min(31, 190 / discCount));

      disc.className = "disc";
      disc.dataset.size = String(size);
      disc.style.setProperty("--disc-width", `${width}%`);
      disc.style.setProperty("--disc-height", `${height}px`);
      disc.style.setProperty("--disc-bright", bright);
      disc.style.setProperty("--disc-mid", mid);
      disc.style.setProperty("--disc-dark", dark);
      disc.style.setProperty("--disc-glow", glow);

      const isTop = index === stack.length - 1;
      if (selectedPeg === pegIndex && isTop) {
        disc.classList.add("top-selected");
      }

      stackElements[pegIndex].appendChild(disc);
    });
  });

  pegZones.forEach((zone, index) => {
    zone.classList.toggle("selected", selectedPeg === index);
  });
}

function handlePegTap(destinationPeg) {
  if (locked) return;

  if (selectedPeg === null) {
    if (stacks[destinationPeg].length === 0) {
      setInstruction("That peg is empty.");
      pulseInvalid(destinationPeg);
      return;
    }

    selectedPeg = destinationPeg;
    setInstruction("Now choose another peg.");
    render();
    return;
  }

  if (selectedPeg === destinationPeg) {
    selectedPeg = null;
    setInstruction("Selection cleared.");
    render();
    return;
  }

  const movingDisc = stacks[selectedPeg][stacks[selectedPeg].length - 1];
  const targetStack = stacks[destinationPeg];
  const targetDisc = targetStack[targetStack.length - 1];

  if (targetDisc !== undefined && movingDisc > targetDisc) {
    setInstruction("Larger cannot rest on smaller.");
    pulseInvalid(destinationPeg);
    return;
  }

  if (startedAt === null) {
    startedAt = performance.now();
    timerId = window.setInterval(updateTimer, 200);
  }

  stacks[selectedPeg].pop();
  stacks[destinationPeg].push(movingDisc);
  selectedPeg = null;
  moves += 1;
  moveCountElement.textContent = String(moves);
  setInstruction("Tap a peg to lift its top disc.");
  render();

  if (stacks[1].length === discCount || stacks[2].length === discCount) {
    finishGame();
  }
}

function pulseInvalid(pegIndex) {
  const zone = pegZones[pegIndex];
  zone.classList.remove("invalid");
  void zone.offsetWidth;
  zone.classList.add("invalid");
}

function setInstruction(text) {
  instructionElement.textContent = text;
}

function updateTimer() {
  if (startedAt === null) return;
  elapsedMs = performance.now() - startedAt;
  timeDisplayElement.textContent = formatTime(elapsedMs);
}

function stopTimer() {
  if (timerId !== null) {
    window.clearInterval(timerId);
    timerId = null;
  }
}

function finishGame() {
  locked = true;
  updateTimer();
  stopTimer();

  const minimum = minimumMoves();
  const perfect = moves === minimum;
  const storedKey = `hanoi-best-time-${discCount}`;
  const previousBest = Number(localStorage.getItem(storedKey));

  resultTitle.textContent = perfect ? "PERFECT" : "SOLVED";
  resultMoves.textContent = `${moves} / ${minimum}`;
  resultTime.textContent = formatTime(elapsedMs);

  if (perfect && (!previousBest || elapsedMs < previousBest)) {
    localStorage.setItem(storedKey, String(Math.round(elapsedMs)));
    bestTime.textContent = previousBest ? "NEW PERFECT-TIME BEST" : "PERFECT-TIME RECORDED";
  } else if (previousBest) {
    bestTime.textContent = `BEST PERFECT TIME ${formatTime(previousBest)}`;
  } else {
    bestTime.textContent = "";
  }

  if (discCount < MAX_DISCS) {
    nextDiscCount = discCount + 1;
    playAgainButton.textContent = `NEXT · ${nextDiscCount} DISCS`;
  } else {
    nextDiscCount = discCount;
    playAgainButton.textContent = `AGAIN · ${discCount} DISCS`;
  }

  window.setTimeout(() => completeDialog.showModal(), 430);
}

function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildRain() {
  const rain = document.querySelector("#rain");
  const fragment = document.createDocumentFragment();
  const amount = window.innerWidth < 650 ? 70 : 115;

  for (let index = 0; index < amount; index += 1) {
    const drop = document.createElement("span");
    drop.className = "rain-drop";
    drop.style.left = `${Math.random() * 120 - 10}%`;
    drop.style.setProperty("--length", `${22 + Math.random() * 70}px`);
    drop.style.setProperty("--opacity", `${0.08 + Math.random() * 0.34}`);
    drop.style.setProperty("--speed", `${0.7 + Math.random() * 0.85}s`);
    drop.style.setProperty("--delay", `${-Math.random() * 2}s`);
    fragment.appendChild(drop);
  }

  rain.appendChild(fragment);
}

function buildSurfaceRain() {
  const surface = document.querySelector("#surfaceRain");
  if (!surface) return;

  const fragment = document.createDocumentFragment();
  const amount = window.innerWidth < 650 ? 8 : 13;

  for (let index = 0; index < amount; index += 1) {
    const ripple = document.createElement("span");
    ripple.className = "surface-ripple";
    ripple.style.left = `${7 + Math.random() * 86}%`;
    ripple.style.top = `${12 + Math.random() * 76}%`;
    ripple.style.setProperty("--ripple-size", `${18 + Math.random() * 30}px`);
    ripple.style.setProperty("--ripple-opacity", `${0.12 + Math.random() * 0.2}`);
    ripple.style.setProperty("--ripple-speed", `${2.3 + Math.random() * 2.5}s`);
    ripple.style.setProperty("--ripple-delay", `${-Math.random() * 5}s`);
    fragment.appendChild(ripple);
  }

  surface.appendChild(fragment);
}

pegZones.forEach((zone) => {
  zone.addEventListener("click", () => handlePegTap(Number(zone.dataset.peg)));
});

discOptionElements.forEach((option) => {
  option.addEventListener("click", () => {
    const count = Number(option.dataset.discs);
    if (!Number.isInteger(count) || count < MIN_DISCS || count > MAX_DISCS) return;

    saveStartingDiscCount(count);
    if (completeDialog?.open) completeDialog.close();
    startGame(count);
  });
});

helpButton?.addEventListener("click", openRules);
beginButton?.addEventListener("click", closeRules);
resetButton.addEventListener("click", () => startGame());

rulesDialog?.addEventListener("cancel", () => {
  markRulesSeen();
});

playAgainButton.addEventListener("click", () => {
  completeDialog.close();
  startGame(nextDiscCount);
});

completeDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  completeDialog.close();
  startGame();
});

buildRain();
buildSurfaceRain();
startGame(startingDiscCount);

if (!hasSeenRules()) {
  window.setTimeout(openRules, 180);
}
