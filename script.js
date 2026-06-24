const DEFAULT_KEY_MAP = Object.freeze({
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
});

const ANIMATION_SPEED_KEY = "cubeAnimationSpeed";
const KEY_BINDINGS_KEY = "cubeKeyBindings";
let keyMap = { ...DEFAULT_KEY_MAP };
let selectedBindingKey = "";

function normalizeBindingKey(key) {
  return typeof key === "string" && key.length === 1 ? key.toLowerCase() : key;
}

function loadKeyBindings() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY_BINDINGS_KEY));
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) return;

    const entries = Object.entries(saved).filter(([key, move]) =>
      typeof key === "string" && key.length === 1 && Object.values(DEFAULT_KEY_MAP).includes(move)
    );
    if (entries.length) keyMap = Object.fromEntries(entries);
  } catch (error) {
    keyMap = { ...DEFAULT_KEY_MAP };
  }
}

function saveKeyBindings() {
  localStorage.setItem(KEY_BINDINGS_KEY, JSON.stringify(keyMap));
}

function getAnimationSpeed() {
  const value = localStorage.getItem(ANIMATION_SPEED_KEY);
  return value === "infinity" || ["20", "18", "16", "14", "12", "10", "5", "3", "2", "1"].includes(value) ? value : "10";
}

function setAnimationSpeed(value) {
  const normalized = value === "infinity" || ["20", "18", "16", "14", "12", "10", "5", "3", "2", "1"].includes(value) ? value : "10";
  localStorage.setItem(ANIMATION_SPEED_KEY, normalized);
}

window.getCubeAnimationSpeed = getAnimationSpeed;

let readyToSolve = false;
let firstTurnDone = false;
let solveMoveCount = 0;
let solveMoves = [];
let solveStartedAt = 0;
let battleInputState = "inactive";
let battleInspectionInterval = null;
let battleInspectionRound = 0;
let battleMoveSequence = 0;
let normalInspectionInterval = null;
let normalInspectionActive = false;
let normalSolveState = "idle";
let lockedScramble = "";
let normalActiveScramble = "";
let battleMaxCompletionScore = 0;
let battleCurrentCompletionScore = 0;
let rankedBattleTimeLimitTimeout = null;

const ROTATION_MOVES = ["x", "x'", "yRotation", "yRotation'", "zRotation", "zRotation'"];

document.addEventListener("DOMContentLoaded", () => {
  loadKeyBindings();
  if (!localStorage.getItem(KEY_BINDINGS_KEY)) saveKeyBindings();
  initCube();
  renderStats();
  loadTheme();
  setupMoveInput();
  setupSettingsUi();
  setupFeaturePanelUi();

  setAfterMoveCallback(() => {
    updateBattleCompletionScore();
    checkSolvedAndStopTimer();
  });

  document.getElementById("themeToggleBtn").addEventListener("click", () => {
    toggleTheme();
  });

  document.getElementById("scrambleBtn").addEventListener("click", () => {
    scrambleCube();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    abortNormalSolve();
  });

  document.getElementById("clearTimesBtn").addEventListener("click", () => {
    clearTimes();
  });
});

document.addEventListener("keydown", event => {
  const openModal = document.querySelector(".app-modal:not([hidden])");
  if (openModal) {
    if (event.code === "Escape") {
      event.preventDefault();
      openModal.hidden = true;
    }
    return;
  }
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
    abortNormalSolve();
    return;
  }

  const move = getMoveFromKey(key);
  if (!move) return;

  performMove(move);
});

function isTypingInForm(target) {
  if (!target) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function getMoveFromKey(key) {
  return keyMap[normalizeBindingKey(key)] || null;
}

function performMove(move) {
  if (isBattleInputLocked()) return;

  document.getElementById("lastMove").textContent = displayMove(move);

  const isRotationMove = ROTATION_MOVES.includes(move);

  if (!isBattleModeActive() && normalSolveState === "aborted") return;

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

  if (isBattleModeActive()) {
    broadcastBattleMove(move);
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
  battleMaxCompletionScore = 0;
  battleCurrentCompletionScore = 0;
}

function clearRankedBattleTimeLimit() {
  if (rankedBattleTimeLimitTimeout) {
    window.clearTimeout(rankedBattleTimeLimitTimeout);
    rankedBattleTimeLimitTimeout = null;
  }
}

function updateBattleCompletionScore() {
  if (!isBattleModeActive() || battleInputState !== "solving") return;
  const result = window.getCubeCompletionScore?.();
  if (!result) return;

  battleCurrentCompletionScore = result.score;
  battleMaxCompletionScore = Math.max(battleMaxCompletionScore, result.score);
  window.notifyBattleCompletionScore?.({
    currentCompletionScore: battleCurrentCompletionScore,
    maxCompletionScore: battleMaxCompletionScore
  });
}

function startNormalInspection() {
  clearNormalInspection();
  normalInspectionActive = true;
  normalSolveState = "inspecting";
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
  normalSolveState = "solving";
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
}

function broadcastBattleMove(move) {
  if (typeof window.notifyBattleMove !== "function") return;

  battleMoveSequence++;
  window.notifyBattleMove({
    move: displayMove(move),
    elapsedMs: solveStartedAt ? Date.now() - solveStartedAt : 0,
    index: battleMoveSequence
  });
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
      abortNormalSolve();
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
  if (["inspecting", "solving"].includes(normalSolveState)) return;

  clearNormalInspection();
  resetCube();
  resetTimer();
  resetSolveStats();
  setSolvingMode(true);

  const scrambleText = lockedScramble || generateScramble(20).join(" ");
  const scramble = scrambleText.split(" ").filter(Boolean);

  document.getElementById("scrambleText").textContent = scrambleText;
  document.getElementById("lastMove").textContent = "-";

  setCurrentScramble(scrambleText);

  normalActiveScramble = scrambleText;
  readyToSolve = true;
  firstTurnDone = false;

  applyScramble(scramble);
  startNormalInspection();
}

function abortNormalSolve() {
  if (isBattleModeActive()) return;

  if (["inspecting", "solving"].includes(normalSolveState) && normalActiveScramble) {
    lockedScramble = normalActiveScramble;
    normalSolveState = "aborted";
  } else if (normalSolveState !== "aborted") {
    normalSolveState = "idle";
  }

  clearNormalInspection();
  resetCube();
  resetTimer();
  resetSolveStats();
  readyToSolve = false;
  firstTurnDone = false;
  setSolvingMode(false);
  setBattleInspectionOverlay(false);
  document.getElementById("lastMove").textContent = "-";
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

function prepareBattleCube(scrambleText, round = 1) {
  if (!isBattleModeActive()) return;

  clearBattleInspection();
  resetCube();
  resetTimer();
  resetSolveStats();
  setSolvingMode(false);
  document.getElementById("scrambleText").textContent = "";
  document.getElementById("lastMove").textContent = "-";
  setCurrentScramble(scrambleText || "");
  readyToSolve = false;
  firstTurnDone = false;
  battleInputState = "joined";
  battleInspectionRound = round;
  battleMoveSequence = 0;
  setBattleInspectionOverlay(false);
  document.body.classList.add("battle-locked");
  document.getElementById("cubeContainer")?.classList.add("ready-waiting");
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
  battleMoveSequence = 0;
  document.body.classList.remove("battle-locked");
  document.getElementById("cubeContainer")?.classList.remove("ready-waiting");
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

  if (window.isRankedBattle?.()) {
    clearRankedBattleTimeLimit();
    rankedBattleTimeLimitTimeout = window.setTimeout(() => {
      updateBattleCompletionScore();
      battleInputState = "time_limit";
      stopTimerAtLimit(120);
      window.notifyRankedBattleTimeLimit?.({
        currentCompletionScore: battleCurrentCompletionScore,
        maxCompletionScore: battleMaxCompletionScore
      });
    }, 120000);
  }

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
  clearRankedBattleTimeLimit();
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
  document.getElementById("cubeContainer")?.classList.remove("ready-waiting");
  setBattleInspectionOverlay(false);
  document.getElementById("lastMove").textContent = "-";
}

function getCurrentSolveStats(timeSeconds = null) {
  const seconds = Number.isFinite(timeSeconds) ? timeSeconds : null;
  const tps = seconds && seconds > 0 ? solveMoveCount / seconds : null;

  return {
    moveCount: solveMoveCount,
    moves: [...solveMoves],
    tps: tps === null ? null : Number(tps.toFixed(2)),
    currentCompletionScore: battleCurrentCompletionScore,
    maxCompletionScore: battleMaxCompletionScore
  };
}

function executeMove(move) {
  queueCubeMove(move);
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
    clearRankedBattleTimeLimit();
    readyToSolve = false;
    firstTurnDone = false;
    if (isBattleModeActive()) {
      battleInputState = "finished";
    } else {
      normalSolveState = "idle";
      lockedScramble = "";
      normalActiveScramble = "";
    }
    setSolvingMode(false);
  }
}

window.getCurrentSolveStats = getCurrentSolveStats;
window.loadBattleScramble = loadBattleScramble;
window.prepareBattleCube = prepareBattleCube;
window.startBattleInspection = startBattleInspection;
window.cancelCurrentSolve = cancelCurrentSolve;

function formatBindingKey(key) {
  if (key === ".") return ".";
  if (key === "/") return "/";
  return key.length === 1 ? key.toUpperCase() : key;
}

function setKeyBindingStatus(message) {
  const status = document.getElementById("keyBindingStatus");
  if (status) status.textContent = message;
}

function renderKeyBindings() {
  const list = document.getElementById("keyBindingsList");
  if (!list) return;

  list.replaceChildren();
  Object.entries(keyMap)
    .sort(([, moveA], [, moveB]) => displayMove(moveA).localeCompare(displayMove(moveB)))
    .forEach(([key, move]) => {
      const row = document.createElement("div");
      row.className = "key-binding-row";

      const moveLabel = document.createElement("strong");
      moveLabel.textContent = displayMove(move);
      const keyLabel = document.createElement("span");
      keyLabel.className = "key-binding-key";
      keyLabel.textContent = formatBindingKey(key);
      const change = document.createElement("button");
      change.type = "button";
      change.className = "key-binding-change";
      change.textContent = selectedBindingKey === key ? "Press a key..." : "Change";
      change.classList.toggle("is-listening", selectedBindingKey === key);
      change.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 900px)").matches) return;
        if (isBattleModeActive()) {
          setKeyBindingStatus("Key bindings cannot be changed during a battle.");
          return;
        }
        selectedBindingKey = selectedBindingKey === key ? "" : key;
        setKeyBindingStatus(selectedBindingKey ? "Press a key..." : "Choose Change, then press a key.");
        renderKeyBindings();
      });
      row.append(moveLabel, keyLabel, change);
      list.appendChild(row);
    });
}

function setupSettingsUi() {
  const speedSelect = document.getElementById("animationSpeedSelect");
  const resetButton = document.getElementById("resetKeyBindingsBtn");
  if (!speedSelect) return;

  speedSelect.value = getAnimationSpeed();
  setAnimationSpeed(speedSelect.value);
  speedSelect.addEventListener("change", () => setAnimationSpeed(speedSelect.value));
  resetButton?.addEventListener("click", () => {
    if (isBattleModeActive()) {
      setKeyBindingStatus("Key bindings cannot be changed during a battle.");
      return;
    }
    keyMap = { ...DEFAULT_KEY_MAP };
    selectedBindingKey = "";
    saveKeyBindings();
    setKeyBindingStatus("Default key bindings restored.");
    renderKeyBindings();
  });

  document.addEventListener("keydown", event => {
    if (!selectedBindingKey || document.getElementById("settingsModal")?.hidden) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.code === "Escape") {
      selectedBindingKey = "";
      setKeyBindingStatus("Key binding change cancelled.");
      renderKeyBindings();
      return;
    }

    const key = normalizeBindingKey(event.key);
    if (!key || key.length !== 1 || /\s/.test(key)) {
      setKeyBindingStatus("Choose a non-space keyboard key.");
      return;
    }
    if (isBattleModeActive()) {
      selectedBindingKey = "";
      setKeyBindingStatus("Key bindings cannot be changed during a battle.");
      renderKeyBindings();
      return;
    }
    const conflictMove = keyMap[key];
    if (conflictMove && key !== selectedBindingKey) {
      setKeyBindingStatus(`${formatBindingKey(key)} is already assigned to ${displayMove(conflictMove)}.`);
      return;
    }

    const move = keyMap[selectedBindingKey];
    delete keyMap[selectedBindingKey];
    keyMap[key] = move;
    selectedBindingKey = "";
    saveKeyBindings();
    setKeyBindingStatus("Key binding saved.");
    renderKeyBindings();
  }, true);

  renderKeyBindings();
}

function setupFeaturePanelUi() {
  const panels = [
    ["openRankingBtn", "rankingModal"],
    ["openBattleBtn", "battleModal"],
    ["openSettingsBtn", "settingsModal"]
  ];

  panels.forEach(([buttonId, panelId]) => {
    document.getElementById(buttonId)?.addEventListener("click", () => {
      const panel = document.getElementById(panelId);
      if (panel) panel.hidden = false;
    });
  });

  ["rankingModal", "battleModal", "settingsModal"].forEach(panelId => {
    const panel = document.getElementById(panelId);
    panel?.addEventListener("click", event => {
      if (event.target === panel) panel.hidden = true;
    });
  });
}

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
