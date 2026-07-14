// Keep the two bicolor towers on the outer pegs, with the center peg as workspace.
const startBicolorGame = startGame;

startGame = function startOuterTowerGame(count = pairCount) {
  startBicolorGame(count);

  // The base game builds the second tower on the middle peg.
  // Move that complete starting tower to the right peg instead.
  stacks[2] = stacks[1];
  stacks[1] = [];
  render();
};

isComplete = function areColorsSeparated() {
  if (stacks[1].length !== 0) return false;
  if (stacks[0].length !== pairCount || stacks[2].length !== pairCount) return false;

  const leftIsMagenta = stacks[0].every((disc) => disc.color === "magenta");
  const rightIsCyan = stacks[2].every((disc) => disc.color === "cyan");

  return leftIsMagenta && rightIsCyan;
};

// Correct the initial board created before this layout script loaded.
startGame(pairCount);
