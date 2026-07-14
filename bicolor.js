const STARTING_PAIRS = 2;
const MAX_PAIRS = 5;
const RULES_SEEN_KEY = "hanoi-bicolor-rules-seen-v1";
const MINIMUM_MOVES = {
  2: 10,
  3: 29,
  4: 67,
  5: 147
};

const stacks = [[], [], []];
const stackElements = [
  document.querySelector("#stack0"),
  document.querySelector("#stack1"),
  document.querySelector("#stack2")
];
const pegZones = [...document.querySelectorAll(".peg-zone")];

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

const colors = {
  cyan: ["#69fbff", "#19cbd8", "#075b70", "rgba(54, 245, 255, 0.84)"],
  magenta: ["#ff8ade", "#ed3ead", "#6d124b", "rgba(255, 63, 189, 0.84)"]
};

let pairCount = STARTING_PAIRS;
let nextPairCount = STARTING_PAIRS;
let moves = 0;
let selectedPeg = null;
let startedAt = null;
let timerId = null;
let elapsedMs = 0;
let locked = false;

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The puzzle remains playable without browser storage.
  }
}

function hasSeenRules() {
  return storageGet(RULES_SEEN_KEY) === "yes";
}

function markRulesSeen() {
  storageSet(RULES_SEEN_KEY, "yes");
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

function minimumMoves() {
  return MINIMUM_MOVES[pairCount];
}

function levelLabel() {
  if (pairCount === STARTING_PAIRS) {
    return `BEGINNER · ${pairCount} PAIRS`;
  }

  return `LEVEL ${pairCount - 1} · ${pairCount} PAIRS`;
}

function oppositeColor(color) {
  return color === "cyan" ? "magenta" : "cyan";
}

function startGame(count = pairCount) {
  stopTimer();
  pairCount = Math.max(STARTING_PAIRS, Math.min(MAX_PAIRS, count));
  nextPairCount = pairCount;
  moves = 0;
  selectedPeg = null;
  startedAt = null;
  elapsedMs = 0;
  locked = false;

  stacks[0] = [];
  stacks[1] = [];
  stacks[2] = [];

  for (let size = pairCount; size >= 1; size -= 1) {
    const levelFromBottom = pairCount - size;
    const leftColor = levelFromBottom % 2 === 0 ? "cyan" : "magenta";
    const rightColor = oppositeColor(leftColor);

    stacks[0].push({ size, color: leftColor, id: `${leftColor}-${size}` });
    stacks[1].push({ size, color: rightColor, id: `${rightColor}-${size}` });
  }

  moveCountElement.textContent = "0";
  minimumMovesElement.textContent = String(minimumMoves());
  timeDisplayElement.textContent = "0:00";
  instructionElement.textContent = "Separate the two colors into complete towers.";
  levelMarkElement.textContent = levelLabel();
  render();
}

function render() {
  stackElements.forEach((element) => element.replaceChildren());

  stacks.forEach((stack, pegIndex) => {
    stack.forEach((discData, index) => {
      const disc = document.createElement("span");
      const [bright, mid, dark, glow] = colors[discData.color];
      const minimumWidth = pairCount >= 5 ? 34 : 38;
      const maximumWidth = 94;
      const width = minimumWidth
        + ((discData.size - 1) / Math.max(1, pairCount - 1)) * (maximumWidth - minimumWidth);
      const height = Math.max(15, Math.min(28, 200 / (pairCount * 2)));

      disc.className = `disc disc-${discData.color}`;
      disc.dataset.size = String(discData.size);
      disc.dataset.color = discData.color;
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

  if (targetDisc && movingDisc.size > targetDisc.size) {
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
  setInstruction("Build one cyan tower and one magenta tower.");
  render();

  if (isComplete()) {
    finishGame();
  }
}

function isComplete() {
  if (stacks[2].length !== 0) return false;
  if (stacks[0].length !== pairCount || stacks[1].length !== pairCount) return false;

  const leftIsMagenta = stacks[0].every((disc) => disc.color === "magenta");
  const rightIsCyan = stacks[1].every((disc) => disc.color === "cyan");
  return leftIsMagenta && rightIsCyan;
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
  const storedKey = `hanoi-bicolor-best-time-${pairCount}`;
  const previousBest = Number(storageGet(storedKey));

  resultTitle.textContent = perfect ? "PERFECT" : "SEPARATED";
  resultMoves.textContent = `${moves} / ${minimum}`;
  resultTime.textContent = formatTime(elapsedMs);

  if (perfect && (!previousBest || elapsedMs < previousBest)) {
    storageSet(storedKey, String(Math.round(elapsedMs)));
    bestTime.textContent = previousBest ? "NEW PERFECT-TIME BEST" : "PERFECT-TIME RECORDED";
  } else if (previousBest) {
    bestTime.textContent = `BEST PERFECT TIME ${formatTime(previousBest)}`;
  } else {
    bestTime.textContent = "";
  }

  if (pairCount < MAX_PAIRS) {
    nextPairCount = pairCount + 1;
    playAgainButton.textContent = `NEXT · ${nextPairCount} PAIRS`;
  } else {
    nextPairCount = pairCount;
    playAgainButton.textContent = `AGAIN · ${pairCount} PAIRS`;
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

helpButton?.addEventListener("click", openRules);
beginButton?.addEventListener("click", closeRules);
resetButton.addEventListener("click", () => startGame());

rulesDialog?.addEventListener("cancel", markRulesSeen);

playAgainButton.addEventListener("click", () => {
  completeDialog.close();
  startGame(nextPairCount);
});

completeDialog.addEventListener("cancel", (event) => {
  event.preventDefault();
  completeDialog.close();
  startGame();
});

buildRain();
buildSurfaceRain();
startGame(STARTING_PAIRS);

if (!hasSeenRules()) {
  window.setTimeout(openRules, 180);
}
