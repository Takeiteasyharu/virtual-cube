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
const BACKGROUND_IMAGE_KEY = "cubeBackgroundImage";
const BEGINNER_TIP_KEY = "cubeOnboardingDismissed";
const NORMAL_TIMER_MODE_KEY = "normalTimerMode";
const CUBE_SIZE_SCALE_KEY = "cubeSizeScale";
const REAL_CUBE_INSPECTION_KEY = "realCubeInspectionEnabled";
const BACKGROUND_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
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

function getCubeSizeScale() {
  const value = Number(localStorage.getItem(CUBE_SIZE_SCALE_KEY));
  return Number.isFinite(value) && value >= 0.5 && value <= 2 ? value : 1;
}

function isRealCubeInspectionEnabled() {
  return localStorage.getItem(REAL_CUBE_INSPECTION_KEY) === "true";
}

function setCubeSizeScale(value) {
  const normalized = Math.min(2, Math.max(0.5, Number(value) || 1));
  localStorage.setItem(CUBE_SIZE_SCALE_KEY, String(normalized));
  window.applyCubeSizeScale?.(normalized);
  return normalized;
}

window.getCubeAnimationSpeed = getAnimationSpeed;
window.getCubeSizeScale = getCubeSizeScale;
window.isRealCubeInspectionEnabled = isRealCubeInspectionEnabled;

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
let realCubeSpaceArmed = false;
let realCubeInspectionStarting = false;
let normalRealCubeSpaceArmed = false;
let solveVerifiedByVirtualCube = false;
let realTimerHoldTimeout = null;
let realTimerHoldStartedAt = 0;
let realTimerHoldReady = false;
let realTimerActivePointerId = null;
let realTimerReleasePending = false;

const ROTATION_MOVES = ["x", "x'", "yRotation", "yRotation'", "zRotation", "zRotation'"];
const COUNTABLE_MOVE_FACES = new Set([
  "R", "U", "F", "L", "D", "B",
  "M", "E", "S",
  "Rw", "Lw", "Uw", "Dw", "Fw", "Bw"
]);

document.addEventListener("DOMContentLoaded", () => {
  loadKeyBindings();
  if (!localStorage.getItem(KEY_BINDINGS_KEY)) saveKeyBindings();
  initCube();
  renderStats();
  loadTheme();
  loadCustomBackground();
  setupMoveInput();
  setupSettingsUi();
  applyNormalTimerMode();
  setupBackgroundSettingsUi();
  setupFeaturePanelUi();
  setupBeginnerTip();

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
    if (isBattleModeActive() && window.isRealCubeBattle?.()) {
      window.abortRealCubeBattle?.();
      return;
    }
    abortNormalSolve();
  });

  document.getElementById("clearTimesBtn").addEventListener("click", () => {
    clearTimes();
  });

  document.getElementById("realCubeTimerBtn")?.addEventListener("click", () => {
    handleRealCubeTimerAction();
  });

  setupMobileRealTimerControls();
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
    if (event.repeat) return;
    if (isBattleModeActive()) {
      if (window.isRealCubeBattle?.()) {
        handleRealCubeSpaceDown();
      } else {
        window.handleBattleSpaceStart?.();
      }
      return;
    }
    if (isNormalRealCubeMode()) {
      handleNormalRealCubeSpaceDown();
      return;
    }
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

document.addEventListener("keyup", event => {
  if (event.code !== "Space") return;
  if (!isBattleModeActive() && isNormalRealCubeMode()) {
    event.preventDefault();
    if (!normalRealCubeSpaceArmed) return;
    releaseRealTimerHold();
    return;
  }
  if (!isBattleModeActive() || !window.isRealCubeBattle?.()) return;
  event.preventDefault();
  releaseOrQueueRealTimerHold();
});

function isTypingInForm(target) {
  if (!target) return false;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function getMoveFromKey(key) {
  return keyMap[normalizeBindingKey(key)] || null;
}

function performMove(move) {
  if (isRealCubeTimerMode()) return;
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

function handleRealCubeTimerAction() {
  if (!isBattleModeActive()) {
    handleNormalRealCubeTimerAction();
    return;
  }
  if (!window.isRealCubeBattle?.()) return;
  if (["joined", "inactive", "finished"].includes(battleInputState)) {
    beginRealCubeInspection();
    return;
  }
  if (battleInputState === "inspecting") {
    startBattleSolve();
    return;
  }
  if (battleInputState === "solving" && isTimerRunning()) {
    stopTimer();
    clearRankedBattleTimeLimit();
    readyToSolve = false;
    firstTurnDone = false;
    battleInputState = "finished";
    setSolvingMode(false);
    syncRealTimerScreenState();
  }
}

function getNormalTimerMode() {
  return localStorage.getItem(NORMAL_TIMER_MODE_KEY) === "real" ? "real" : "virtual";
}

function isNormalRealCubeMode() {
  return !isBattleModeActive() && getNormalTimerMode() === "real";
}

function isRealCubeTimerMode() {
  return Boolean(window.isRealCubeBattle?.()) || isNormalRealCubeMode();
}

function setVirtualCubeVisible(visible) {
  const canvas = document.querySelector("#cubeContainer > canvas");
  if (canvas) {
    const wasHidden = canvas.hidden;
    canvas.hidden = !visible;
    canvas.style.pointerEvents = visible ? "" : "none";
    if (visible && wasHidden) {
      window.requestAnimationFrame(() => {
        window.resizeMainCube?.();
        window.applyCubeSizeScale?.(getCubeSizeScale());
      });
    }
  }
}

function renderNormalRealCubeUi() {
  const scrambleNetPanel = document.getElementById("normalScrambleNetPanel");
  if (isBattleModeActive()) {
    if (scrambleNetPanel) scrambleNetPanel.hidden = true;
    return;
  }
  const realMode = getNormalTimerMode() === "real";
  const instruction = document.getElementById("realCubeInstruction");
  const button = document.getElementById("realCubeTimerBtn");
  document.body.classList.toggle("normal-real-cube", realMode);
  setVirtualCubeVisible(!realMode);
  if (scrambleNetPanel) scrambleNetPanel.hidden = !realMode || !normalActiveScramble;
  if (realMode && normalActiveScramble) {
    window.renderScrambleNet?.(normalActiveScramble, document.getElementById("normalScrambleCubeNet"));
  }
  if (!instruction || !button) return;
  instruction.hidden = !realMode;
  button.hidden = !realMode;
  if (!realMode) return;

  const inspectionEnabled = isRealCubeInspectionEnabled();
  if (normalSolveState === "inspecting") {
    instruction.textContent = "Hold and release Space to start solve";
    button.textContent = "Start Solve";
  } else if (normalSolveState === "solving") {
    instruction.textContent = "Press Space to stop timer";
    button.textContent = "Stop Timer";
  } else if (normalSolveState === "finished") {
    instruction.textContent = "Finished";
    button.textContent = inspectionEnabled ? "Start Inspection" : "Start Solve";
  } else {
    instruction.textContent = inspectionEnabled
      ? "Press Space to start inspection"
      : "Press Start Solve to prepare the timer";
    button.textContent = inspectionEnabled ? "Start Inspection" : "Start Solve";
  }
  syncRealTimerScreenState();
}

function setNormalRealScramble(scrambleText) {
  normalActiveScramble = String(scrambleText || "").trim();
  document.getElementById("scrambleText").textContent = normalActiveScramble || "Scramble will appear here";
  setCurrentScramble(normalActiveScramble);
  const panel = document.getElementById("normalScrambleNetPanel");
  if (panel) panel.hidden = !isNormalRealCubeMode() || !normalActiveScramble;
  if (normalActiveScramble) {
    window.renderScrambleNet?.(normalActiveScramble, document.getElementById("normalScrambleCubeNet"));
  }
}

function prepareNextNormalRealScramble() {
  setNormalRealScramble(generateScramble(20).join(" "));
}

function applyNormalTimerMode() {
  if (isNormalRealCubeMode() && !normalActiveScramble) {
    prepareNextNormalRealScramble();
  }
  renderNormalRealCubeUi();
}

function handleNormalRealCubeSpaceDown() {
  if (["idle", "aborted", "finished"].includes(normalSolveState)) {
    handleNormalRealCubeTimerAction();
  } else if (normalSolveState === "inspecting") {
    beginRealTimerHold();
  } else if (normalSolveState === "solving" && isTimerRunning()) {
    stopTimer();
    normalSolveState = "finished";
    readyToSolve = false;
    firstTurnDone = false;
    setSolvingMode(false);
    prepareNextNormalRealScramble();
    renderNormalRealCubeUi();
  }
}

function handleNormalRealCubeTimerAction() {
  if (!isNormalRealCubeMode()) return;
  if (["idle", "aborted", "finished"].includes(normalSolveState)) {
    scrambleCube();
  } else if (normalSolveState === "inspecting") {
    startNormalSolve();
  } else if (normalSolveState === "solving") {
    handleNormalRealCubeSpaceDown();
  }
}

function handleRealCubeSpaceDown() {
  if (["joined", "inactive", "finished"].includes(battleInputState)) {
    prepareAndArmRealCubeTimer();
    return;
  }
  if (battleInputState === "inspecting") {
    beginRealTimerHold();
    return;
  }
  if (battleInputState === "solving") handleRealCubeTimerAction();
}

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 1;
}

function shouldUseCleanRealTimer() {
  return isRealCubeTimerMode() && (isTouchDevice() || !isRealCubeInspectionEnabled());
}

function isRealTimerInspecting() {
  return isBattleModeActive()
    ? battleInputState === "inspecting" && Boolean(window.isRealCubeBattle?.())
    : normalSolveState === "inspecting" && isNormalRealCubeMode();
}

function isRealTimerSolving() {
  return isBattleModeActive()
    ? battleInputState === "solving" && Boolean(window.isRealCubeBattle?.())
    : normalSolveState === "solving" && isNormalRealCubeMode();
}

function syncRealTimerScreenState() {
  const inspecting = isRealTimerInspecting();
  const solving = isRealTimerSolving();
  document.body.classList.toggle("real-timer-clean", shouldUseCleanRealTimer() && (inspecting || solving));
  document.body.classList.toggle("real-timer-inspecting", inspecting);
  document.body.classList.toggle("real-timer-solving", solving);
}

function setInspectionHoldColor(state = "") {
  document.body.classList.toggle("inspection-hold-red", state === "red");
  document.body.classList.toggle("inspection-hold-green", state === "green");
}

function clearRealTimerHold() {
  if (realTimerHoldTimeout) window.clearTimeout(realTimerHoldTimeout);
  realTimerHoldTimeout = null;
  realTimerHoldStartedAt = 0;
  realTimerHoldReady = false;
  realCubeSpaceArmed = false;
  normalRealCubeSpaceArmed = false;
  setInspectionHoldColor();
}

function beginRealTimerHold() {
  if (!isRealTimerInspecting() || realTimerHoldStartedAt) return;
  realTimerHoldStartedAt = Date.now();
  realCubeSpaceArmed = isBattleModeActive();
  normalRealCubeSpaceArmed = !isBattleModeActive();
  setInspectionHoldColor("red");
  realTimerHoldTimeout = window.setTimeout(() => {
    if (!realTimerHoldStartedAt || !isRealTimerInspecting()) return;
    realTimerHoldReady = true;
    setInspectionHoldColor("green");
  }, 300);
}

function releaseRealTimerHold() {
  if (!realTimerHoldStartedAt) return;
  const shouldStart = realTimerHoldReady && isRealTimerInspecting();
  clearRealTimerHold();
  if (!shouldStart) return;
  if (isBattleModeActive()) startBattleSolve();
  else startNormalSolve();
}

function releaseOrQueueRealTimerHold() {
  if (realTimerHoldStartedAt) return releaseRealTimerHold();
  if (realCubeInspectionStarting) realTimerReleasePending = true;
}

async function prepareAndArmRealCubeTimer() {
  realTimerReleasePending = false;
  const prepared = await beginRealCubeInspection();
  if (!prepared || !isRealTimerInspecting()) return;
  beginRealTimerHold();
  if (!realTimerReleasePending) return;
  realTimerReleasePending = false;
  window.setTimeout(() => {
    if (!realTimerHoldStartedAt) return;
    realTimerHoldReady = true;
    releaseRealTimerHold();
  }, 310);
}

function setupMobileRealTimerControls() {
  const timerArea = document.querySelector("main");
  if (!timerArea) return;
  const isControl = target => target instanceof Element && Boolean(target.closest("button, input, select, textarea, a"));

  timerArea.addEventListener("contextmenu", event => {
    if (!document.body.classList.contains("real-timer-clean")) return;
    event.preventDefault();
  });

  timerArea.addEventListener("selectstart", event => {
    if (!document.body.classList.contains("real-timer-clean")) return;
    event.preventDefault();
  });

  timerArea.addEventListener("dragstart", event => {
    if (!document.body.classList.contains("real-timer-clean")) return;
    event.preventDefault();
  });

  timerArea.addEventListener("pointerdown", event => {
    if (!isTouchDevice() || !isRealCubeTimerMode() || !document.body.classList.contains("real-timer-clean") || isControl(event.target)) return;
    if (realTimerActivePointerId !== null || event.isPrimary === false) return;
    event.preventDefault();
    realTimerActivePointerId = event.pointerId;
    timerArea.setPointerCapture?.(event.pointerId);
    if (isRealTimerInspecting()) beginRealTimerHold();
    else if (isRealTimerSolving()) handleRealCubeTimerAction();
  });

  timerArea.addEventListener("pointerup", event => {
    if (event.pointerId !== realTimerActivePointerId) return;
    event.preventDefault();
    realTimerActivePointerId = null;
    releaseRealTimerHold();
  });

  timerArea.addEventListener("pointercancel", event => {
    if (event.pointerId !== realTimerActivePointerId) return;
    realTimerActivePointerId = null;
    clearRealTimerHold();
  });

  const battleScreen = document.querySelector(".battle-screen");
  battleScreen?.addEventListener("pointerdown", event => {
    if (!isTouchDevice() || !window.isRealFriendBattle?.() || document.body.classList.contains("real-timer-clean")) return;
    if (isControl(event.target) || event.target.closest(".friend-real-edit-menu,.multiplayer-roster")) return;
    if (!event.target.closest("#battleScramble,#friendRealTimerPanel,#scrambleNetPanel")) return;
    if (realTimerActivePointerId !== null || event.isPrimary === false) return;
    event.preventDefault();
    realTimerActivePointerId = event.pointerId;
    battleScreen.setPointerCapture?.(event.pointerId);
    if (isRealTimerSolving()) handleRealCubeTimerAction();
    else prepareAndArmRealCubeTimer();
  });
  battleScreen?.addEventListener("pointerup", event => {
    if (event.pointerId !== realTimerActivePointerId) return;
    event.preventDefault();
    realTimerActivePointerId = null;
    releaseOrQueueRealTimerHold();
  });
}

async function beginRealCubeInspection() {
  if (realCubeInspectionStarting || typeof window.beginRealCubeInspection !== "function") return false;
  realCubeInspectionStarting = true;
  try {
    return await window.beginRealCubeInspection();
  } finally {
    realCubeInspectionStarting = false;
  }
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
  solveVerifiedByVirtualCube = false;
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
  renderNormalRealCubeUi();
  document.body.classList.add("inspection-active");
  syncRealTimerScreenState();

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

function startNormalRealPreparation() {
  clearNormalInspection();
  normalInspectionActive = true;
  normalSolveState = "inspecting";
  document.body.classList.add("inspection-active");
  setBattleInspectionOverlay(true, "Ready", "Timer Ready");
  renderNormalRealCubeUi();
  syncRealTimerScreenState();
}

function startNormalSolve() {
  if (!normalInspectionActive && isTimerRunning()) return;

  clearRealTimerHold();
  clearNormalInspection();
  setBattleInspectionOverlay(false);
  normalSolveState = "solving";
  firstTurnDone = true;
  resetSolveStats();
  solveStartedAt = Date.now();
  startTimer();
  renderNormalRealCubeUi();
  syncRealTimerScreenState();
}

function clearNormalInspection() {
  if (normalInspectionInterval) {
    window.clearInterval(normalInspectionInterval);
    normalInspectionInterval = null;
  }
  normalInspectionActive = false;
  document.body.classList.remove("inspection-active");
}

function normalizeMoveForCount(move) {
  const rawMove = typeof move === "string" ? move : move?.move;
  if (!rawMove) return "";
  return displayMove(rawMove).trim();
}

function getMoveFaceForCount(move) {
  const normalized = normalizeMoveForCount(move);
  const face = normalized.replace(/2|'$/g, "");
  return COUNTABLE_MOVE_FACES.has(face) ? face : "";
}

function getMoveTurnAmount(move) {
  const normalized = normalizeMoveForCount(move);
  if (!getMoveFaceForCount(normalized)) return 0;
  if (normalized.endsWith("2")) return 2;
  return normalized.endsWith("'") ? -1 : 1;
}

function calculateNormalizedMoveCount(moves) {
  let count = 0;
  let currentFace = "";
  let currentAmount = 0;

  const flush = () => {
    if (!currentFace) return;
    const normalizedAmount = ((currentAmount % 4) + 4) % 4;
    if (normalizedAmount !== 0) count++;
    currentFace = "";
    currentAmount = 0;
  };

  (Array.isArray(moves) ? moves : []).forEach(entry => {
    const face = getMoveFaceForCount(entry);
    const amount = getMoveTurnAmount(entry);

    if (!face || amount === 0) {
      return;
    }

    if (currentFace && currentFace !== face) {
      flush();
    }

    currentFace = face;
    currentAmount += amount;
  });

  flush();
  return count;
}

function recordSolveMove(move, counted) {
  const relativeTime = solveStartedAt ? Date.now() - solveStartedAt : 0;

  solveMoves.push({
    move: displayMove(move),
    t: relativeTime,
    counted
  });
  solveMoveCount = calculateNormalizedMoveCount(solveMoves);
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

  const preparedRealScramble = isNormalRealCubeMode()
    ? normalActiveScramble
    : "";
  const scrambleText = lockedScramble || preparedRealScramble || generateScramble(20).join(" ");
  const scramble = scrambleText.split(" ").filter(Boolean);

  document.getElementById("scrambleText").textContent = scrambleText;
  document.getElementById("lastMove").textContent = "-";

  if (isNormalRealCubeMode()) {
    setNormalRealScramble(scrambleText);
  } else {
    setCurrentScramble(scrambleText);
    normalActiveScramble = scrambleText;
  }
  readyToSolve = true;
  firstTurnDone = false;

  if (!isNormalRealCubeMode()) applyScramble(scramble);
  if (isNormalRealCubeMode() && !isRealCubeInspectionEnabled()) startNormalRealPreparation();
  else startNormalInspection();
}

function abortNormalSolve() {
  if (isBattleModeActive()) return;

  clearRealTimerHold();

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
  normalRealCubeSpaceArmed = false;
  renderNormalRealCubeUi();
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
  const isRealCube = Boolean(window.isRealCubeBattle?.());
  if (!isRealCube) resetCube();
  resetTimer();
  resetSolveStats();
  setSolvingMode(false);
  document.getElementById("scrambleText").textContent = scrambleText || "";
  document.getElementById("lastMove").textContent = "-";
  setCurrentScramble(scrambleText || "");
  readyToSolve = true;
  firstTurnDone = false;
  battleInputState = "inspecting";
  syncRealTimerScreenState();
  battleInspectionRound = round;
  battleMoveSequence = 0;
  document.body.classList.remove("battle-locked");
  document.getElementById("cubeContainer")?.classList.remove("ready-waiting");
  if (!isRealCube) applyScramble(scramble);

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

function startBattleRealPreparation(scrambleText, round = 1) {
  if (!isBattleModeActive() || !window.isRealCubeBattle?.()) return;
  if (battleInputState === "inspecting" && battleInspectionRound === round) return;

  clearBattleInspection();
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
  setBattleInspectionOverlay(true, "Ready", "Timer Ready");
  syncRealTimerScreenState();
}

function startBattleSolve() {
  if (!isBattleModeActive() || battleInputState === "solving") return;

  clearRealTimerHold();
  clearBattleInspection();
  realCubeSpaceArmed = false;
  setBattleInspectionOverlay(false);
  battleInputState = "solving";
  firstTurnDone = true;
  resetSolveStats();
  solveStartedAt = Date.now();
  startTimer();
  syncRealTimerScreenState();

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

function setBattleInspectionOverlay(visible, count = "15", label = "Inspection") {
  const overlay = document.getElementById("battleInspectionOverlay");
  const labelDisplay = document.getElementById("battleInspectionLabel");
  const countDisplay = document.getElementById("battleInspectionCount");
  if (!overlay || !countDisplay) return;

  overlay.hidden = !visible;
  if (labelDisplay) labelDisplay.textContent = label;
  countDisplay.textContent = count;
  document.body.classList.toggle("inspection-active", visible);
  document.body.classList.toggle("battle-inspecting", visible && isBattleModeActive());
}

function setSolvingMode(isSolving) {
  document.body.classList.toggle("solving", isSolving);
}

function cancelCurrentSolve() {
  clearRealTimerHold();
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
  realCubeSpaceArmed = false;
  realCubeInspectionStarting = false;
  document.body.classList.remove("battle-locked");
  document.getElementById("cubeContainer")?.classList.remove("ready-waiting");
  setBattleInspectionOverlay(false);
  syncRealTimerScreenState();
  document.getElementById("lastMove").textContent = "-";
}

function getCurrentSolveStats(timeSeconds = null) {
  const seconds = Number.isFinite(timeSeconds) ? timeSeconds : null;
  const normalizedMoveCount = calculateNormalizedMoveCount(solveMoves);
  solveMoveCount = normalizedMoveCount;
  const tps = seconds && seconds > 0 ? normalizedMoveCount / seconds : null;

  return {
    moveCount: normalizedMoveCount,
    moves: [...solveMoves],
    tps: tps === null ? null : Number(tps.toFixed(2)),
    currentCompletionScore: battleCurrentCompletionScore,
    maxCompletionScore: battleMaxCompletionScore,
    mode: isRealCubeTimerMode() ? "real" : "virtual",
    rankingEligible: !isRealCubeTimerMode() && solveVerifiedByVirtualCube
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
    solveVerifiedByVirtualCube = true;
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
window.calculateNormalizedMoveCount = calculateNormalizedMoveCount;
window.normalizeMoveForCount = normalizeMoveForCount;
window.getMoveFaceForCount = getMoveFaceForCount;
window.getMoveTurnAmount = getMoveTurnAmount;
window.loadBattleScramble = loadBattleScramble;
window.prepareBattleCube = prepareBattleCube;
window.startBattleInspection = startBattleInspection;
window.startBattleRealPreparation = startBattleRealPreparation;
window.cancelCurrentSolve = cancelCurrentSolve;
window.handleRealCubeTimerAction = handleRealCubeTimerAction;
window.prepareAndArmRealCubeTimer = prepareAndArmRealCubeTimer;
window.releaseRealCubeTimerHold = releaseOrQueueRealTimerHold;

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
  const timerModeSelect = document.getElementById("normalTimerModeSelect");
  const cubeSizeInput = document.getElementById("cubeSizeInput");
  const cubeSizeValue = document.getElementById("cubeSizeValue");
  const realCubeInspectionToggle = document.getElementById("realCubeInspectionToggle");
  const resetButton = document.getElementById("resetKeyBindingsBtn");
  if (!speedSelect) return;

  speedSelect.value = getAnimationSpeed();
  setAnimationSpeed(speedSelect.value);
  speedSelect.addEventListener("change", () => setAnimationSpeed(speedSelect.value));
  if (cubeSizeInput) {
    const renderCubeSize = value => {
      const normalized = setCubeSizeScale(value);
      cubeSizeInput.value = String(normalized);
      if (cubeSizeValue) cubeSizeValue.textContent = `${normalized.toFixed(2)}x`;
    };
    renderCubeSize(getCubeSizeScale());
    cubeSizeInput.addEventListener("input", () => renderCubeSize(cubeSizeInput.value));
  }
  if (timerModeSelect) {
    timerModeSelect.value = getNormalTimerMode();
    timerModeSelect.addEventListener("change", () => {
      if (isBattleModeActive()) return;
      abortNormalSolve();
      localStorage.setItem(NORMAL_TIMER_MODE_KEY, timerModeSelect.value === "real" ? "real" : "virtual");
      if (timerModeSelect.value === "real") {
        lockedScramble = "";
        normalActiveScramble = "";
      }
      normalSolveState = "idle";
      applyNormalTimerMode();
    });
  }
  if (realCubeInspectionToggle) {
    realCubeInspectionToggle.checked = isRealCubeInspectionEnabled();
    realCubeInspectionToggle.addEventListener("change", () => {
      localStorage.setItem(REAL_CUBE_INSPECTION_KEY, realCubeInspectionToggle.checked ? "true" : "false");
      if (!isBattleModeActive() && isNormalRealCubeMode()) {
        abortNormalSolve();
        normalSolveState = "idle";
        applyNormalTimerMode();
      }
    });
  }
  resetButton?.addEventListener("click", () => {
    if (isBattleModeActive()) {
      setKeyBindingStatus("Key bindings cannot be changed during a battle.");
      return;
    }
    if (!window.confirm("Reset all key bindings to their defaults?")) return;
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

window.setVirtualCubeVisible = setVirtualCubeVisible;
window.applyNormalTimerMode = applyNormalTimerMode;
window.getCurrentTimerMode = () => isRealCubeTimerMode() ? "real" : "virtual";

function setBackgroundStatus(message) {
  const status = document.getElementById("backgroundStatus");
  if (status) status.textContent = message;
}

function applyCustomBackground(dataUrl) {
  if (dataUrl) {
    document.body.style.backgroundImage = `url("${dataUrl}")`;
    document.body.classList.add("custom-background");
    setBackgroundStatus("Background image loaded.");
    return;
  }

  document.body.style.backgroundImage = "";
  document.body.classList.remove("custom-background");
  setBackgroundStatus("");
}

function loadCustomBackground() {
  applyCustomBackground(localStorage.getItem(BACKGROUND_IMAGE_KEY));
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", reject);
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", reject);
    image.src = dataUrl;
  });
}

function dataUrlBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  return Math.ceil((base64.length * 3) / 4);
}

async function compressBackgroundImage(file) {
  const source = await readImageFile(file);
  const image = await loadImage(source);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  for (const quality of [0.85, 0.8, 0.75, 0.7, 0.65]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrlBytes(dataUrl) <= BACKGROUND_IMAGE_MAX_BYTES) return dataUrl;
  }

  return null;
}

function setupBackgroundSettingsUi() {
  const input = document.getElementById("backgroundImageInput");
  const removeButton = document.getElementById("removeBackgroundBtn");

  input?.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;

    setBackgroundStatus("Processing image...");
    try {
      const dataUrl = await compressBackgroundImage(file);
      if (!dataUrl) {
        setBackgroundStatus("Image is too large. Please choose a smaller image.");
        input.value = "";
        return;
      }

      localStorage.setItem(BACKGROUND_IMAGE_KEY, dataUrl);
      applyCustomBackground(dataUrl);
      setBackgroundStatus("Background image saved on this device.");
    } catch (error) {
      setBackgroundStatus("Image could not be loaded.");
      console.error(error);
    } finally {
      input.value = "";
    }
  });

  removeButton?.addEventListener("click", () => {
    localStorage.removeItem(BACKGROUND_IMAGE_KEY);
    applyCustomBackground("");
    setBackgroundStatus("Background image removed.");
  });
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

function setupBeginnerTip() {
  const modal = document.getElementById("beginnerTipModal");
  const dismissButton = document.getElementById("dismissBeginnerTipBtn");
  if (!modal || !dismissButton || localStorage.getItem(BEGINNER_TIP_KEY) === "true") return;
  modal.hidden = false;
  dismissButton.addEventListener("click", () => {
    localStorage.setItem(BEGINNER_TIP_KEY, "true");
    modal.hidden = true;
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
