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
    scrambleCube();
    return;
  }

  if (event.code === "Escape") {
    resetTimer();
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
    startTimer();
  }

  executeMove(move);
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
  resetCube();
  resetTimer();

  const scramble = generateScramble(20);
  const scrambleText = scramble.join(" ");

  document.getElementById("scrambleText").textContent = scrambleText;
  document.getElementById("lastMove").textContent = "-";

  setCurrentScramble(scrambleText);

  readyToSolve = true;
  firstTurnDone = false;

  applyScramble(scramble);
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
  }
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
