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
let battleInputState = "inactive";
let battleInspectionInterval = null;
let battleInspectionRound = 0;
let normalInspectionInterval = null;
let normalInspectionActive = false;

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
    clearNormalInspection();
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
    if (isBattleModeActive()) {
      event.preventDefault();
      return;
    }
    clearNormalInspection();
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
  if (isBattleInputLocked()) return;

  document.getElementById("lastMove").textContent = displayMove(move);

  const isRotationMove = ROTATION_MOVES.includes(move);

  if (isBattleInspecting() && !isRotationMove) {
    startBattleSolve();
  }

  if (normalInspectionActive && !isRotationMove) {
    startNormalSolve();
  }

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

function isBattleModeActive() {
  return typeof window.isBattleMode === "function" && window.isBattleMode();
}

function isBattleInspecting() {
  return isBattleModeActive() && battleInputState === "inspecting";
}

function isBattleInputLocked() {
  return isBattleModeActive() && !["inspecting", "solving"].includes(battleInputState);
}

function resetSolveStats() {
  solveMoveCount = 0;
  solveMoves = [];
  solveStartedAt = 0;
}

function startNormalInspection() {
  clearNormalInspection();
  normalInspectionActive = true;
  document.body.classList.add("inspection-active");

  const inspectionStartedAt = Date.now();
  const updateInspection = () => {
    const remaining = Math.max(0, Math.ceil(15 - (Date.now() - inspectionStartedAt) / 1000));
    setBattleInspectionOverlay(true, remaining > 0 ? String(remaining) : "Go!");

    if (remaining <= 0) {
      clearNormalInspection();
      startNormalSolve();
      setBattleInspectionOverlay(true, "Go!");
      window.setTimeout(() => setBattleInspectionOverlay(false), 650);
    }
  };

  updateInspection();
  normalInspectionInterval = window.setInterval(updateInspection, 100);
}

function startNormalSolve() {
  if (!normalInspectionActive && isTimerRunning()) return;

  clearNormalInspection();
  setBattleInspectionOverlay(false);
  firstTurnDone = true;
  resetSolveStats();
  solveStartedAt = Date.now();
  startTimer();
}

function clearNormalInspection() {
  if (normalInspectionInterval) {
    window.clearInterval(normalInspectionInterval);
    normalInspectionInterval = null;
  }
  normalInspectionActive = false;
  document.body.classList.remove("inspection-active");
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
      if (isBattleModeActive()) {
        input.value = "";
        return;
      }
      clearNormalInspection();
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

  clearNormalInspection();
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
  startNormalInspection();
}

function prepareBattleCube(scrambleText, round = 1) {
  if (!isBattleModeActive()) return;

  clearBattleInspection();
  resetCube();
  resetTimer();
  resetSolveStats();
  setSolvingMode(false);
  document.getElementById("scrambleText").textContent = scrambleText || "";
  document.getElementById("lastMove").textContent = "-";
  setCurrentScramble(scrambleText || "");
  readyToSolve = false;
  firstTurnDone = false;
  battleInputState = "joined";
  battleInspectionRound = round;
  setBattleInspectionOverlay(false);
  document.body.classList.add("battle-locked");
}

function startBattleInspection(scrambleText, inspectionStartMs = Date.now(), round = 1) {
  if (!isBattleModeActive()) return;
  if (battleInputState === "inspecting" && battleInspectionRound === round) return;

  clearBattleInspection();
  const scramble = (scrambleText || "").split(" ").filter(Boolean);
  resetCube();
  resetTimer();
  resetSolveStats();
  setSolvingMode(false);
  document.getElementById("scrambleText").textContent = scrambleText || "";
  document.getElementById("lastMove").textContent = "-";
  setCurrentScramble(scrambleText || "");
  readyToSolve = true;
  firstTurnDone = false;
  battleInputState = "inspecting";
  battleInspectionRound = round;
  document.body.classList.remove("battle-locked");
  applyScramble(scramble);

  const updateInspection = () => {
    const remaining = Math.max(0, Math.ceil(15 - (Date.now() - inspectionStartMs) / 1000));
    setBattleInspectionOverlay(true, remaining > 0 ? String(remaining) : "Go!");

    if (remaining <= 0) {
      clearBattleInspection();
      startBattleSolve();
      setBattleInspectionOverlay(true, "Go!");
      window.setTimeout(() => setBattleInspectionOverlay(false), 650);
    }
  };

  updateInspection();
  battleInspectionInterval = window.setInterval(updateInspection, 100);
}

function startBattleSolve() {
  if (!isBattleModeActive() || battleInputState === "solving") return;

  clearBattleInspection();
  setBattleInspectionOverlay(false);
  battleInputState = "solving";
  firstTurnDone = true;
  resetSolveStats();
  solveStartedAt = Date.now();
  startTimer();

  if (typeof window.notifyBattleSolveStarted === "function") {
    window.notifyBattleSolveStarted();
  }
}

function clearBattleInspection() {
  if (battleInspectionInterval) {
    window.clearInterval(battleInspectionInterval);
    battleInspectionInterval = null;
  }
}

function setBattleInspectionOverlay(visible, count = "15") {
  const overlay = document.getElementById("battleInspectionOverlay");
  const countDisplay = document.getElementById("battleInspectionCount");
  if (!overlay || !countDisplay) return;

  overlay.hidden = !visible;
  countDisplay.textContent = count;
  document.body.classList.toggle("inspection-active", visible);
  document.body.classList.toggle("battle-inspecting", visible && isBattleModeActive());
}

function setSolvingMode(isSolving) {
  document.body.classList.toggle("solving", isSolving);
}

function cancelCurrentSolve() {
  clearBattleInspection();
  clearNormalInspection();
  resetCube();
  resetTimer();
  resetSolveStats();
  readyToSolve = false;
  firstTurnDone = false;
  setSolvingMode(false);
  battleInputState = "inactive";
  document.body.classList.remove("battle-locked");
  setBattleInspectionOverlay(false);
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
    if (isBattleModeActive()) battleInputState = "finished";
    setSolvingMode(false);
  }
}

window.getCurrentSolveStats = getCurrentSolveStats;
window.loadBattleScramble = loadBattleScramble;
window.prepareBattleCube = prepareBattleCube;
window.startBattleInspection = startBattleInspection;
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
