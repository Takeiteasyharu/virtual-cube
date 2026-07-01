(function () {
  const FACE_ORDER = ["U", "L", "F", "R", "B", "D"];
  const FACE_COLORS = {
    U: "#ffffff",
    D: "#ffff33",
    F: "#00cc33",
    B: "#3333ff",
    R: "#ff3333",
    L: "#ffaa00"
  };
  const MOVE_ROTATIONS = {
    R: ["x", 1, -1],
    L: ["x", -1, 1],
    U: ["y", 1, -1],
    D: ["y", -1, 1],
    F: ["z", 1, -1],
    B: ["z", -1, 1]
  };
  let renderedScramble = null;

  function createSolvedStickers() {
    const stickers = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        stickers.push({ face: "U", color: "U", position: [col - 1, 1, row - 1], normal: [0, 1, 0] });
        stickers.push({ face: "D", color: "D", position: [col - 1, -1, 1 - row], normal: [0, -1, 0] });
        stickers.push({ face: "F", color: "F", position: [col - 1, 1 - row, 1], normal: [0, 0, 1] });
        stickers.push({ face: "B", color: "B", position: [1 - col, 1 - row, -1], normal: [0, 0, -1] });
        stickers.push({ face: "R", color: "R", position: [1, 1 - row, 1 - col], normal: [1, 0, 0] });
        stickers.push({ face: "L", color: "L", position: [-1, 1 - row, col - 1], normal: [-1, 0, 0] });
      }
    }
    return stickers;
  }

  function rotateVector(vector, axis, direction) {
    const [x, y, z] = vector;
    if (axis === "x") return direction > 0 ? [x, -z, y] : [x, z, -y];
    if (axis === "y") return direction > 0 ? [z, y, -x] : [-z, y, x];
    return direction > 0 ? [-y, x, z] : [y, -x, z];
  }

  function applyQuarterTurn(stickers, axis, layer, direction) {
    const axisIndex = axis === "x" ? 0 : axis === "y" ? 1 : 2;
    stickers.forEach(sticker => {
      if (sticker.position[axisIndex] !== layer) return;
      sticker.position = rotateVector(sticker.position, axis, direction);
      sticker.normal = rotateVector(sticker.normal, axis, direction);
    });
  }

  function applyMove(stickers, move) {
    const match = /^([RLUDFB])(2|')?$/.exec(move);
    if (!match) return;
    const [axis, layer, baseDirection] = MOVE_ROTATIONS[match[1]];
    const turns = match[2] === "2" ? 2 : 1;
    const direction = match[2] === "'" ? -baseDirection : baseDirection;
    for (let turn = 0; turn < turns; turn++) applyQuarterTurn(stickers, axis, layer, direction);
  }

  function getFacePosition(sticker) {
    const [x, y, z] = sticker.position;
    const [nx, ny, nz] = sticker.normal;
    if (ny === 1) return ["U", z + 1, x + 1];
    if (ny === -1) return ["D", 1 - z, x + 1];
    if (nz === 1) return ["F", 1 - y, x + 1];
    if (nz === -1) return ["B", 1 - y, 1 - x];
    if (nx === 1) return ["R", 1 - y, 1 - z];
    return ["L", 1 - y, z + 1];
  }

  function calculateFaces(scramble) {
    const stickers = createSolvedStickers();
    String(scramble || "").trim().split(/\s+/).filter(Boolean).forEach(move => applyMove(stickers, move));
    const faces = Object.fromEntries(FACE_ORDER.map(face => [face, Array(9).fill(face)]));
    stickers.forEach(sticker => {
      const [face, row, col] = getFacePosition(sticker);
      faces[face][row * 3 + col] = sticker.color;
    });
    return faces;
  }

  function renderScrambleNet(scramble, container) {
    if (!container || renderedScramble === scramble) return;
    renderedScramble = scramble;
    const faces = calculateFaces(scramble);
    container.replaceChildren(...FACE_ORDER.map(face => {
      const faceElement = document.createElement("div");
      faceElement.className = `cube-net-face face-${face.toLowerCase()}`;
      faceElement.setAttribute("aria-label", `${face} face`);
      const label = document.createElement("strong");
      label.textContent = face;
      const grid = document.createElement("div");
      grid.className = "cube-net-face-grid";
      faces[face].forEach(color => {
        const sticker = document.createElement("span");
        sticker.style.backgroundColor = FACE_COLORS[color];
        grid.appendChild(sticker);
      });
      faceElement.append(label, grid);
      return faceElement;
    }));
  }

  window.renderScrambleNet = renderScrambleNet;
})();
