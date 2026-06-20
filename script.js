const keyMap = {
  "i": "R",
  "k": "R'",

  "e": "L'",
  "d": "L",

  "j": "U",
  "f": "U'",
  "s": "D",
  "l": "D'",
  "h": "F",
  "g": "F'",
  "w": "B",
  "o": "B'",

  ".": "M",
  "x": "M'",

  "0": "S",
  "1": "S'",

  "u": "Rw",
  "m": "Rw'",

  "r": "Lw'",
  "v": "Lw",

  "z": "Dw",
  "/": "Dw'",

  ",": "Uw",
  "c": "Uw'",

  "5": "Fw'",
  "7": "Fw",

  "t": "x",
  "y": "x",
  "b": "x'",
  "n": "x'",

  ":": "yRotation",
  "a": "yRotation'",

  "p": "zRotation",
  "q": "zRotation'"
};

let readyToSolve = false;
let firstTurnDone = false;
let solveMoveCount = 0;
let solveMoves = [];
let solveStartedAt = 0;

const ROTATION_MOVES = ["x", "x'", "yRotation", "yRotation'", "zRotation", "zRotation'"];

document.addEventListener("DOMContentLoaded", () => {
  initCube();
  renderStats();
  loadTheme();
  setupMoveInput();

  setAfterMoveCallback(() => {
    checkSolvedAndStopTimer();
  });

  document.getElementById("themeToggleBtn").addEventListener("click", () => {
    toggleTheme();
  });

  document.getElementById("scrambleBtn").addEventListener("click", () => {
    scrambleCube();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    resetCube();
    resetTimer();
    readyToSolve = false;
    firstTurnDone = false;
    setSolvingMode(false);
    document.getElementById("lastMove").textContent = "-";
  });

  document.getElementById("clearTimesBtn").addEventListener("click", () => {
    clearTimes();
  });
});

document.addEventListener("keydown", event => {
  if (isTypingInForm(event.target)) return;

  const key = event.key;

  if (event.code === "Space") {
    event.preventDefault();
    if (typeof window.isBattleMode === "function" && window.isBattleMode()) return;
    scrambleCube();
    return;
  }

  if (event.code === "Escape") {
    resetTimer();
    readyToSolve = false;
    firstTurnDone = false;
    setSolvingMode(false);
    return;
  }

  const move = keyMap[key];
  if (!move) return;

  performMove(move);
});

function isTypingInForm(target) {
  if (!target) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function getMoveFromKey(key) {
  return keyMap[key] || keyMap[key.toLowerCase()] || null;
}

function performMove(move) {
  document.getElementById("lastMove").textContent = displayMove(move);

  const isRotationMove = ROTATION_MOVES.includes(move);

  if (readyToSolve && !firstTurnDone && !isRotationMove) {
    firstTurnDone = true;
    resetSolveStats();
    solveStartedAt = Date.now();
    startTimer();

    if (typeof window.notifyBattleSolveStarted === "function") {
      window.notifyBattleSolveStarted();
    }
  }

  if (readyToSolve && firstTurnDone && isTimerRunning()) {
    recordSolveMove(move, !isRotationMove);
  }

  executeMove(move);
}

function resetSolveStats() {
  solveMoveCount = 0;
  solveMoves = [];
  solveStartedAt = 0;
}

function recordSolveMove(move, counted) {
  const relativeTime = solveStartedAt ? Date.now() - solveStartedAt : 0;

  if (counted) {
    solveMoveCount++;
  }

  solveMoves.push({
    move: displayMove(move),
    t: relativeTime,
    counted
  });

  if (typeof window.notifyBattleMove === "function") {
    window.notifyBattleMove({
      move: displayMove(move),
      elapsedMs: relativeTime,
      index: solveMoves.length
    });
  }
}

function setupMoveInput() {
  const input = document.getElementById("moveInput");
  if (!input) return;

  input.addEventListener("keydown", event => {
    const key = event.key;
    event.stopPropagation();

    if (event.code === "Space") {
      event.preventDefault();
      scrambleCube();
      input.value = "";
      return;
    }

    if (event.code === "Escape") {
      event.preventDefault();
      resetTimer();
      readyToSolve = false;
      firstTurnDone = false;
      setSolvingMode(false);
      input.value = "";
      return;
    }

    const move = getMoveFromKey(key);
    if (!move) return;

    event.preventDefault();
    performMove(move);
    input.value = "";
  });

  input.addEventListener("input", () => {
    const value = input.value;

    for (const key of value) {
      if (key === " ") {
        scrambleCube();
        continue;
      }

      const move = getMoveFromKey(key);
      if (move) {
        performMove(move);
      }
    }

    input.value = "";
  });
}

function scrambleCube() {
  if (typeof window.isBattleMode === "function" && window.isBattleMode()) return;

  resetCube();
  resetTimer();
  resetSolveStats();
  setSolvingMode(true);

  const scramble = generateScramble(20);
  const scrambleText = scramble.join(" ");

  document.getElementById("scrambleText").textContent = scrambleText;
  document.getElementById("lastMove").textContent = "-";

  setCurrentScramble(scrambleText);

  readyToSolve = true;
  firstTurnDone = false;

  applyScramble(scramble);
}

function loadBattleScramble(scrambleText) {
  const scramble = scrambleText.split(" ").filter(Boolean);

  resetCube();
  resetTimer();
  resetSolveStats();
  setSolvingMode(true);

  document.getElementById("scrambleText").textContent = scrambleText;
  document.getElementById("lastMove").textContent = "-";

  setCurrentScramble(scrambleText);

  readyToSolve = true;
  firstTurnDone = false;

  applyScramble(scramble);
}

function setSolvingMode(isSolving) {
  document.body.classList.toggle("solving", isSolving);
}

function cancelCurrentSolve() {
  resetCube();
  resetTimer();
  resetSolveStats();
  readyToSolve = false;
  firstTurnDone = false;
  setSolvingMode(false);
  document.getElementById("lastMove").textContent = "-";
}

function getCurrentSolveStats(timeSeconds = null) {
  const seconds = Number.isFinite(timeSeconds) ? timeSeconds : null;
  const tps = seconds && seconds > 0 ? solveMoveCount / seconds : null;

  return {
    moveCount: solveMoveCount,
    moves: [...solveMoves],
    tps: tps === null ? null : Number(tps.toFixed(2))
  };
}

function executeMove(move) {
  if (move === "x") {
    rotateWholeCube("x", -Math.PI / 2);
    return;
  }

  if (move === "x'") {
    rotateWholeCube("x", Math.PI / 2);
    return;
  }

  if (move === "yRotation") {
    rotateWholeCube("y", -Math.PI / 2);
    return;
  }

  if (move === "yRotation'") {
    rotateWholeCube("y", Math.PI / 2);
    return;
  }

  if (move === "zRotation") {
    rotateWholeCube("z", -Math.PI / 2);
    return;
  }

  if (move === "zRotation'") {
    rotateWholeCube("z", Math.PI / 2);
    return;
  }

  rotateMove(move);
}

function displayMove(move) {
  if (move === "yRotation") return "y";
  if (move === "yRotation'") return "y'";
  if (move === "zRotation") return "z";
  if (move === "zRotation'") return "z'";
  return move;
}

function checkSolvedAndStopTimer() {
  if (
    readyToSolve &&
    firstTurnDone &&
    isTimerRunning() &&
    isCubeSolved()
  ) {
    stopTimer();
    readyToSolve = false;
    firstTurnDone = false;
    setSolvingMode(false);
  }
}

window.getCurrentSolveStats = getCurrentSolveStats;
window.loadBattleScramble = loadBattleScramble;
window.cancelCurrentSolve = cancelCurrentSolve;

function toggleTheme() {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");
  localStorage.setItem("theme", isDark ? "dark" : "light");

  document.getElementById("themeToggleBtn").textContent = isDark ? "Light" : "Dark";
}

function loadTheme() {
  const theme = localStorage.getItem("theme");

  if (theme === "dark") {
    document.body.classList.add("dark");
    document.getElementById("themeToggleBtn").textContent = "Light";
  } else {
    document.body.classList.remove("dark");
    document.getElementById("themeToggleBtn").textContent = "Dark";
  }
}
