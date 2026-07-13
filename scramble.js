const BASIC_MOVES = ["R", "L", "U", "D", "F", "B"];
const SUFFIXES = ["", "'", "2"];
const CUBING_SCRAMBLE_MODULE_URL = "https://cdn.cubing.net/js/cubing/scramble";

let cubingScrambleModulePromise = null;

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
    cubingScrambleModulePromise = import(CUBING_SCRAMBLE_MODULE_URL);
  }
  return cubingScrambleModulePromise;
}

async function generateScrambleText(length = 20) {
  try {
    const cubingScramble = await loadCubingScrambleModule();
    if (typeof cubingScramble.randomScrambleForEvent !== "function") {
      throw new Error("cubing.js randomScrambleForEvent is unavailable");
    }

    const scramble = await cubingScramble.randomScrambleForEvent("333");
    const scrambleText = normalizeScrambleText(scramble?.toString?.() || scramble);
    if (!scrambleText) throw new Error("cubing.js returned an empty scramble");
    return scrambleText;
  } catch (error) {
    cubingScrambleModulePromise = null;
    console.warn("cubing.js scramble generation failed; using fallback generator.", error);
    return generateFallbackScrambleText(length);
  }
}

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
}

window.generateScramble = generateScramble;
window.generateScrambleText = generateScrambleText;
