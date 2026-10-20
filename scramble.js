const BASIC_MOVES = ["R", "L", "U", "D", "F", "B"];
const SUFFIXES = ["", "'", "2"];
const CUBING_SCRAMBLE_MODULE_URL = "https://cdn.cubing.net/v0/js/cubing/scramble";

let cubingScrambleModulePromise = null;
let preparedSoloScramble = null;
let soloScramblePreparation = null;

function recordScrambleDuration(name, startedAt) {
  performance.clearMeasures(name);
  performance.measure(name, { start: startedAt, end: performance.now() });
}

function generateScramble(length = 20) {
  const result = [];
  let previousFace = "";

  while (result.length < length) {
    const face = BASIC_MOVES[Math.floor(Math.random() * BASIC_MOVES.length)];

    if (face === previousFace) continue;

    const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
    result.push(face + suffix);
    previousFace = face;
  }

  return result;
}

function normalizeScrambleText(scrambleText) {
  return String(scrambleText || "").trim().replace(/\s+/g, " ");
}

function generateFallbackScrambleText(length = 20) {
  return generateScramble(length).join(" ");
}

async function loadCubingScrambleModule() {
  if (!cubingScrambleModulePromise) {
    const startedAt = performance.now();
    cubingScrambleModulePromise = import(CUBING_SCRAMBLE_MODULE_URL)
      .then(module => {
        recordScrambleDuration("stcube:scramble:module", startedAt);
        return module;
      })
      .catch(error => {
        cubingScrambleModulePromise = null;
        throw error;
      });
  }
  return cubingScrambleModulePromise;
}

async function generateScrambleText(length = 20) {
  try {
    const cubingScramble = await loadCubingScrambleModule();
    if (typeof cubingScramble.randomScrambleForEvent !== "function") {
      throw new Error("cubing.js randomScrambleForEvent is unavailable");
    }

    const startedAt = performance.now();
    const scramble = await cubingScramble.randomScrambleForEvent("333");
    recordScrambleDuration("stcube:scramble:random-state", startedAt);
    const scrambleText = normalizeScrambleText(scramble?.toString?.() || scramble);
    if (!scrambleText) throw new Error("cubing.js returned an empty scramble");
    return scrambleText;
  } catch (error) {
    console.warn("Random-state scramble generation failed. Please retry.", error);
    throw error;
  }
}

// This one-item buffer belongs only to solo solves. Battle hosts continue to
// call generateScrambleText and share that result through the existing room.
function prepareNextSoloScramble() {
  if (preparedSoloScramble) return Promise.resolve(preparedSoloScramble);
  if (!soloScramblePreparation) {
    soloScramblePreparation = generateScrambleText().then(text => {
      preparedSoloScramble = text;
      return text;
    }).finally(() => { soloScramblePreparation = null; });
  }
  return soloScramblePreparation;
}

async function takePreparedSoloScramble() {
  const text = await prepareNextSoloScramble();
  preparedSoloScramble = null;
  scheduleSoloScramblePreparation();
  return text;
}

let soloPreparationScheduled = false;
function scheduleSoloScramblePreparation() {
  if (soloPreparationScheduled) return;
  soloPreparationScheduled = true;
  const prepare = () => {
    soloPreparationScheduled = false;
    if (!window.isBattleMode?.()) prepareNextSoloScramble().catch(() => {});
  };
  if ("requestIdleCallback" in window) window.requestIdleCallback(prepare, { timeout: 1000 });
  else window.setTimeout(prepare, 0);
}

document.addEventListener("DOMContentLoaded", scheduleSoloScramblePreparation);

function applyScramble(scramble) {
  scramble.forEach(move => {
    if (move.includes("2")) {
      const base = move.replace("2", "");
      applyMoveInstant(base);
      applyMoveInstant(base);
    } else {
      applyMoveInstant(move);
    }
  });
  window.dispatchEvent(new CustomEvent("stcube:scramble-applied", { detail:{ moves:[...scramble] } }));
}

window.generateScramble = generateScramble;
window.generateScrambleText = generateScrambleText;
window.takePreparedSoloScramble = takePreparedSoloScramble;
