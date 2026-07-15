const originalMagneticStartGame = startGame;
const originalMagneticHandlePegTap = handlePegTap;

startGame = function startMagneticAnywhereGame(count = discCount) {
  originalMagneticStartGame(count);
  setInstruction("Flip the entire tower to magenta on any peg.");
};

isComplete = function isMagneticTowerComplete() {
  return stacks.some((stack) =>
    stack.length === discCount
    && stack.every((disc) => disc.topFace === "magenta")
  );
};

handlePegTap = function handleMagneticAnywhereTap(destinationPeg) {
  const movesBeforeTap = moves;
  originalMagneticHandlePegTap(destinationPeg);

  if (locked || moves === movesBeforeTap) return;

  const fullTower = stacks.find((stack) => stack.length === discCount);
  if (fullTower && fullTower.every((disc) => disc.topFace === "cyan")) {
    setInstruction("Tower complete—but still CYAN-side up. Keep flipping.");
  }
};

setInstruction("Flip the entire tower to magenta on any peg.");
