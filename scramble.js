const BASIC_MOVES = ["R", "L", "U", "D", "F", "B"];
const SUFFIXES = ["", "'", "2"];

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