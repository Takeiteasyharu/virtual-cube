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
const NORMAL_MANUAL_ENTRY_KEY = "normalRealManualEntryEnabled";
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

function isNormalManualEntryEnabled() {
  return getNormalTimerMode() === "real" && localStorage.getItem(NORMAL_MANUAL_ENTRY_KEY) === "true";
}

function setCubeSizeScale(value) {
  const normalized = Math.min(2, Math.max(0.5, Number(value) || 1));
  localStorage.setItem(CUBE_SIZE_SCALE_KEY, String(normalized));
  window.applyCubeSizeScale?.(normalized);
  return normalized;
}

window.getCubeAnimationSpeed = getAnimationSpeed;
window.getCubeSizeScale = getCubeSizeScale;
window.setCubeSizeScale = setCubeSizeScale;
window.isRealCubeInspectionEnabled = isRealCubeInspectionEnabled;
window.isNormalManualEntryEnabled = isNormalManualEntryEnabled;

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
let normalScramblePreparing = false;
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
let realTimerPressStartedAt = 0;
let realTimerReleasedAt = 0;

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
    releaseOrQueueRealTimerHold();
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
window.getNormalTimerMode = getNormalTimerMode;

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
  const manualEntry = isNormalManualEntryEnabled();
  const instruction = document.getElementById("realCubeInstruction");
  const manualPanel = document.getElementById("normalManualEntryPanel");
  document.body.classList.toggle("normal-real-cube", realMode);
  setVirtualCubeVisible(!realMode);
  if (scrambleNetPanel) scrambleNetPanel.hidden = !realMode || !normalActiveScramble;
  if (realMode && normalActiveScramble) {
    window.renderScrambleNet?.(normalActiveScramble, document.getElementById("normalScrambleCubeNet"));
  }
  if (manualPanel) manualPanel.hidden = !realMode || !manualEntry;
  if (!instruction) return;
  instruction.hidden = !realMode || manualEntry;
  if (!realMode) return;

  instruction.textContent = normalSolveState === "solving"
    ? (isTouchDevice() ? "Touch to stop." : "Press Space to stop timer.")
    : getRealTimerReadyInstruction();
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

function parseNormalManualTimeInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let seconds;
  if (raw.includes(".")) {
    if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
    seconds = Number(raw);
  } else {
    if (!/^\d+$/.test(raw)) return null;
    seconds = Number(raw) / 100;
  }
  if (!Number.isFinite(seconds) || seconds < 0.01 || seconds >= 3600) return null;
  return Number(seconds.toFixed(2));
}

async function submitNormalManualTime() {
  const input = document.getElementById("normalManualTimeInput");
  if (!input || !isNormalManualEntryEnabled()) return;
  if (!normalActiveScramble) {
    await prepareNextNormalRealScramble();
  }
  const finalTime = parseNormalManualTimeInput(input.value);
  if (!Number.isFinite(finalTime)) return;
  saveSolve(finalTime, normalActiveScramble, {
    mode: "real",
    rankingEligible: false,
    tps: null,
    moveCount: 0,
    moves: []
  });
  renderStats();
  input.value = "";
  input.focus();
  normalSolveState = "idle";
  readyToSolve = false;
  firstTurnDone = false;
  await prepareNextNormalRealScramble();
  renderNormalRealCubeUi();
}

async function prepareNextNormalRealScramble() {
  const scrambleText = typeof window.generateScrambleText === "function"
    ? await window.generateScrambleText(20)
    : generateScramble(20).join(" ");
  setNormalRealScramble(scrambleText);
}

function applyNormalTimerMode() {
  if (isNormalRealCubeMode() && !normalActiveScramble) {
    prepareNextNormalRealScramble();
  }
  renderNormalRealCubeUi();
}

function handleNormalRealCubeSpaceDown() {
  if (isNormalManualEntryEnabled()) {
    if (["idle", "aborted", "finished"].includes(normalSolveState) && !normalActiveScramble) {
      prepareNextNormalRealScramble();
    }
    return;
  }
  if (["idle", "aborted", "finished"].includes(normalSolveState)) {
    prepareAndArmNormalRealCubeTimer();
  } else if (normalSolveState === "inspecting") {
    beginRealTimerHold();
  } else if (normalSolveState === "solving" && isTimerRunning()) {
    stopTimer();
    normalSolveState = "idle";
    readyToSolve = false;
    firstTurnDone = false;
    setSolvingMode(false);
    prepareNextNormalRealScramble();
    renderNormalRealCubeUi();
  }
}

function handleNormalRealCubeTimerAction() {
  if (!isNormalRealCubeMode()) return;
  if (isNormalManualEntryEnabled()) {
    if (!normalActiveScramble) scrambleCube();
    return;
  }
  if (["idle", "aborted", "finished"].includes(normalSolveState)) {
    scrambleCube();
  } else if (normalSolveState === "inspecting") {
    startNormalSolve();
  } else if (normalSolveState === "solving") {
    handleNormalRealCubeSpaceDown();
  }
}

function handleRealCubeSpaceDown() {
  if (window.isManualRealFriendEntry?.()) return;
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

function getRealTimerReadyInstruction() {
  return isTouchDevice()
    ? "Touch & hold. Release to start."
    : "Hold Space. Release to start.";
}

function shouldUseCleanRealTimer() {
  return isRealCubeTimerMode() && (
    isNormalRealCubeMode()
    || Boolean(window.isRealFriendBattle?.())
    || isTouchDevice()
    || !isRealCubeInspectionEnabled()
  );
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
  const delayedHoldFullscreen = inspecting && (
    isNormalRealCubeMode() || Boolean(window.isRealFriendBattle?.())
  );
  const showCleanTimer = solving || (inspecting && (!delayedHoldFullscreen || realTimerHoldReady));
  document.body.classList.toggle("real-timer-clean", shouldUseCleanRealTimer() && showCleanTimer);
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
  realTimerActivePointerId = null;
  realTimerPressStartedAt = 0;
  realTimerReleasedAt = 0;
  setInspectionHoldColor();
}

function beginRealTimerHold(startedAt = Date.now()) {
  if (!isRealTimerInspecting() || realTimerHoldStartedAt) return;
  realTimerHoldStartedAt = startedAt;
  realCubeSpaceArmed = isBattleModeActive();
  normalRealCubeSpaceArmed = !isBattleModeActive();
  setInspectionHoldColor("red");
  realTimerHoldTimeout = window.setTimeout(() => {
    if (!realTimerHoldStartedAt || !isRealTimerInspecting()) return;
    realTimerHoldReady = true;
    setInspectionHoldColor("green");
    if (isNormalRealCubeMode() || window.isRealFriendBattle?.()) resetTimer();
    if (window.isRealFriendBattle?.() || isNormalRealCubeMode()) {
      setBattleInspectionOverlay(true, "0.00", "");
      syncRealTimerScreenState();
    }
  }, Math.max(0, 300 - (Date.now() - startedAt)));
}

function releaseRealTimerHold() {
  if (!realTimerHoldStartedAt) return;
  const releasedAt = realTimerReleasedAt || Date.now();
  const shouldStart = releasedAt - realTimerHoldStartedAt >= 300 && isRealTimerInspecting();
  clearRealTimerHold();
  if (!shouldStart) {
    cancelRealTimerPreparation();
    return;
  }
  if (isBattleModeActive()) startBattleSolve();
  else startNormalSolve();
}

function releaseOrQueueRealTimerHold() {
  realTimerReleasedAt = Date.now();
  if (realTimerHoldStartedAt) return releaseRealTimerHold();
  if (realCubeInspectionStarting) realTimerReleasePending = true;
}

async function prepareAndArmRealCubeTimer() {
  realTimerReleasePending = false;
  realTimerPressStartedAt = Date.now();
  if (window.isRealFriendBattle?.()) setInspectionHoldColor("red");
  const prepared = await beginRealCubeInspection();
  if (!prepared || !isRealTimerInspecting()) {
    clearRealTimerHold();
    return;
  }
  if (isRealCubeInspectionEnabled() && !window.isRealFriendBattle?.()) {
    realTimerPressStartedAt = 0;
    realTimerReleasedAt = 0;
    realTimerReleasePending = false;
    return;
  }
  beginRealTimerHold(realTimerPressStartedAt);
  if (!realTimerReleasePending) return;
  realTimerReleasePending = false;
  releaseRealTimerHold();
}

function prepareAndArmNormalRealCubeTimer() {
  realTimerPressStartedAt = Date.now();
  realTimerReleasedAt = 0;
  setInspectionHoldColor("red");
  handleNormalRealCubeTimerAction();
  if (isRealTimerInspecting()) beginRealTimerHold(realTimerPressStartedAt);
}

function cancelRealTimerPreparation() {
  setBattleInspectionOverlay(false);
  if (isBattleModeActive()) {
    window.cancelRealCubePreparation?.();
    return;
  }
  clearNormalInspection();
  normalSolveState = "idle";
  readyToSolve = false;
  firstTurnDone = false;
  document.body.classList.remove("inspection-active");
  if (!isNormalRealCubeMode()) resetTimer();
  renderStats();
  renderNormalRealCubeUi();
  syncRealTimerScreenState();
}

function setupMobileRealTimerControls() {
  const timerArea = document.querySelector("main");
  if (!timerArea) return;
  const isControl = target => target instanceof Element && Boolean(target.closest("button, input, select, textarea, a"));
  const releaseActivePointer = event => {
    if (event.pointerId !== realTimerActivePointerId) return;
    event.preventDefault();
    realTimerActivePointerId = null;
    releaseOrQueueRealTimerHold();
  };
  const cancelActivePointer = event => {
    if (event.pointerId !== realTimerActivePointerId) return;
    realTimerActivePointerId = null;
    if (isRealTimerInspecting()) cancelRealTimerPreparation();
    else clearRealTimerHold();
  };

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
    if (!isTouchDevice() || !isRealCubeTimerMode() || isControl(event.target)) return;
    if (!document.body.classList.contains("real-timer-clean")) {
      if (isNormalRealCubeMode() && event.target.closest("#timerDisplay")) {
        event.preventDefault();
        realTimerActivePointerId = event.pointerId;
        timerArea.setPointerCapture?.(event.pointerId);
        prepareAndArmNormalRealCubeTimer();
      }
      return;
    }
    if (realTimerActivePointerId !== null || event.isPrimary === false) return;
    event.preventDefault();
    realTimerActivePointerId = event.pointerId;
    timerArea.setPointerCapture?.(event.pointerId);
    if (isRealTimerInspecting()) beginRealTimerHold(realTimerPressStartedAt || Date.now());
    else if (isRealTimerSolving()) handleRealCubeTimerAction();
  });

  timerArea.addEventListener("pointerup", releaseActivePointer);
  timerArea.addEventListener("pointercancel", cancelActivePointer);

  const battleScreen = document.querySelector(".battle-screen");
  battleScreen?.addEventListener("pointerdown", event => {
    if (!isTouchDevice() || !window.isRealFriendBattle?.() || document.body.classList.contains("real-timer-clean")) return;
    if (window.isManualRealFriendEntry?.()) return;
    if (isControl(event.target) || event.target.closest(".friend-real-edit-menu,.multiplayer-roster")) return;
    if (!event.target.closest("#friendRealTimerDisplay")) return;
    if (realTimerActivePointerId !== null || event.isPrimary === false) return;
    event.preventDefault();
    realTimerActivePointerId = event.pointerId;
    if (isRealTimerSolving()) handleRealCubeTimerAction();
    else prepareAndArmRealCubeTimer();
  });
  battleScreen?.addEventListener("pointerup", releaseActivePointer);
  battleScreen?.addEventListener("pointercancel", cancelActivePointer);
  document.addEventListener("pointerup", releaseActivePointer);
  document.addEventListener("pointercancel", cancelActivePointer);
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
  setBattleInspectionOverlay(false);
  renderNormalRealCubeUi();
  syncRealTimerScreenState();
}

function startNormalSolve() {
  if (!normalInspectionActive && isTimerRunning()) return;

  clearRealTimerHold();
  clearNormalInspection();
  setBattleInspectionOverlay(false);
  normalSolveState = "solving";
  setSolvingMode(true);
  firstTurnDone = true;
  resetSolveStats();
  if (isNormalRealCubeMode()) resetTimer();
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

async function scrambleCube() {
  if (typeof window.isBattleMode === "function" && window.isBattleMode()) return;
  if (["inspecting", "solving"].includes(normalSolveState)) return;
  if (normalScramblePreparing) return;

  normalScramblePreparing = true;
  try {
    clearNormalInspection();
    resetCube();
    if (!isNormalRealCubeMode()) resetTimer();
    resetSolveStats();
    if (!isNormalRealCubeMode()) setSolvingMode(true);

    const preparedRealScramble = isNormalRealCubeMode()
      ? normalActiveScramble
      : "";
    const scrambleText = lockedScramble || preparedRealScramble || (
      typeof window.generateScrambleText === "function"
        ? await window.generateScrambleText(20)
        : generateScramble(20).join(" ")
    );
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
    if (isNormalRealCubeMode() && isNormalManualEntryEnabled()) {
      normalSolveState = "idle";
      readyToSolve = false;
      renderNormalRealCubeUi();
    } else if (isNormalRealCubeMode()) startNormalRealPreparation();
    else startNormalInspection();
  } finally {
    normalScramblePreparing = false;
  }
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

function prepareBattleCube(scrambleText, round = 1, preserveRealFriendTimer = false) {
  if (!isBattleModeActive()) return;

  clearRealTimerHold();
  clearBattleInspection();
  resetCube();
  if (!preserveRealFriendTimer) resetTimer();
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
  if (!window.isRealFriendBattle?.()) resetTimer();
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
  if (window.isRealFriendBattle?.()) setBattleInspectionOverlay(false);
  else setBattleInspectionOverlay(true, "Ready", getRealTimerReadyInstruction());
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
  if (window.isRealFriendBattle?.()) resetTimer();
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

function cancelCurrentSolve({ preserveTimer = false } = {}) {
  clearRealTimerHold();
  clearRankedBattleTimeLimit();
  clearBattleInspection();
  clearNormalInspection();
  resetCube();
  if (!preserveTimer) resetTimer();
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
  const manualEntryToggle = document.getElementById("normalManualEntryToggle");
  const manualEntryHint = document.getElementById("normalManualEntryHint");
  const manualTimeInput = document.getElementById("normalManualTimeInput");
  const manualTimeSaveBtn = document.getElementById("normalManualTimeSaveBtn");
  const cubeSizeInput = document.getElementById("cubeSizeInput");
  const cubeSizeValue = document.getElementById("cubeSizeValue");
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
    const syncManualEntrySetting = () => {
      const realMode = timerModeSelect.value === "real";
      if (!realMode) localStorage.setItem(NORMAL_MANUAL_ENTRY_KEY, "false");
      if (manualEntryToggle) {
        manualEntryToggle.disabled = !realMode;
        manualEntryToggle.checked = realMode && localStorage.getItem(NORMAL_MANUAL_ENTRY_KEY) === "true";
      }
      if (manualEntryHint) {
        manualEntryHint.textContent = realMode
          ? "Use Manual Entry to type real-cube solve times instead of using the screen timer."
          : "Manual Entry is available in Real Cube Mode only.";
      }
    };
    timerModeSelect.value = getNormalTimerMode();
    syncManualEntrySetting();
    timerModeSelect.addEventListener("change", () => {
      if (isBattleModeActive()) return;
      abortNormalSolve();
      localStorage.setItem(NORMAL_TIMER_MODE_KEY, timerModeSelect.value === "real" ? "real" : "virtual");
      syncManualEntrySetting();
      if (timerModeSelect.value === "real") {
        lockedScramble = "";
        normalActiveScramble = "";
      }
      normalSolveState = "idle";
      applyNormalTimerMode();
      renderStats();
    });
    manualEntryToggle?.addEventListener("change", () => {
      if (timerModeSelect.value !== "real") {
        localStorage.setItem(NORMAL_MANUAL_ENTRY_KEY, "false");
        syncManualEntrySetting();
        return;
      }
      localStorage.setItem(NORMAL_MANUAL_ENTRY_KEY, manualEntryToggle.checked ? "true" : "false");
      abortNormalSolve();
      normalSolveState = "idle";
      applyNormalTimerMode();
    });
  }
  manualTimeSaveBtn?.addEventListener("click", () => {
    submitNormalManualTime().catch(console.error);
  });
  manualTimeInput?.addEventListener("keydown", event => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitNormalManualTime().catch(console.error);
  });
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
