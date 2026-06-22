let scene, camera, renderer;
let moveQueue = [];
let cubies = [];
let isAnimating = false;

const CUBE_SIZE = 0.95;
const GAP = 0.32;
const STEP = CUBE_SIZE + GAP;

const COLORS = {
  U: 0xffffff,
  D: 0xffff33,
  F: 0x00ff00,
  B: 0x3333ff,
  R: 0xff3333,
  L: 0xffaa00
};

function initCube() {
  const container = document.getElementById("cubeContainer");

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.1,
    100
  );
  camera.position.set(0, 10, 10);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 2.0));

  const light = new THREE.DirectionalLight(0xffffff, 2.5);
  light.position.set(5, 8, 8);
  scene.add(light);

  createCubies();
  animateScene();

  window.addEventListener("resize", onResize);
}

function createCubies() {
  cubies = [];

  for (let x = -1; x <= 1; x++) {
    for (let y = -1; y <= 1; y++) {
      for (let z = -1; z <= 1; z++) {
        const cubie = createCubie(x, y, z);
        cubie.userData.coord = { x, y, z };
        cubie.userData.home = { x, y, z };
        cubie.position.set(x * STEP, y * STEP, z * STEP);
        scene.add(cubie);
        cubies.push(cubie);
      }
    }
  }
}

function createCubie(x, y, z) {
  const cubie = new THREE.Group();

  const stickerSize = CUBE_SIZE * 1.05;
  const stickerThickness = 0.0000001;
  const offset = CUBE_SIZE / 2 + 0.15;

  function addSticker(color, position, rotation) {
    const geometry = new THREE.BoxGeometry(stickerSize, stickerSize, stickerThickness);

    const material = new THREE.MeshPhongMaterial({
      color,
      shininess: 20,
      side: THREE.DoubleSide
    });

    const sticker = new THREE.Mesh(geometry, material);
    sticker.position.set(position.x, position.y, position.z);
    sticker.rotation.set(rotation.x, rotation.y, rotation.z);

    sticker.position.set(position.x, position.y, position.z);
    sticker.rotation.set(rotation.x, rotation.y, rotation.z);

    const edges = new THREE.EdgesGeometry(geometry);

    const outline = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
            color: 0x000000
  })
);

sticker.add(outline);

cubie.add(sticker);
  }

  if (x === 1) {
    addSticker(
      COLORS.R,
      { x: offset, y: 0, z: 0 },
      { x: 0, y: Math.PI / 2, z: 0 }
    );
  }

  if (x === -1) {
    addSticker(
      COLORS.L,
      { x: -offset, y: 0, z: 0 },
      { x: 0, y: Math.PI / 2, z: 0 }
    );
  }

  if (y === 1) {
    addSticker(
      COLORS.U,
      { x: 0, y: offset, z: 0 },
      { x: Math.PI / 2, y: 0, z: 0 }
    );
  }

  if (y === -1) {
    addSticker(
      COLORS.D,
      { x: 0, y: -offset, z: 0 },
      { x: Math.PI / 2, y: 0, z: 0 }
    );
  }

  if (z === 1) {
    addSticker(
      COLORS.F,
      { x: 0, y: 0, z: offset },
      { x: 0, y: 0, z: 0 }
    );
  }

  if (z === -1) {
    addSticker(
      COLORS.B,
      { x: 0, y: 0, z: -offset },
      { x: 0, y: 0, z: 0 }
    );
  }

  return cubie;
}

function animateScene() {
  requestAnimationFrame(animateScene);
  renderer.render(scene, camera);
}

function onResize() {
  const container = document.getElementById("cubeContainer");

  if (!container.clientWidth || !container.clientHeight) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

function resetCube() {
  cubies.forEach(cubie => scene.remove(cubie));
  cubies = [];
  createCubies();
}

function rotateMove(move) {
  queueCubeMove(move);
}

function queueCubeMove(move) {
  if (!parseMove(move)) return;
  moveQueue.push(move);
  runNextMove();
}

function getRotationDuration() {
  const speed = typeof window.getCubeAnimationSpeed === "function"
    ? window.getCubeAnimationSpeed()
    : "10";
  if (speed === "infinity") return 0;

  const tps = Number(speed);
  return Number.isFinite(tps) && tps > 0 ? 1000 / tps : 100;
}

function parseMove(move) {
  const q = Math.PI / 2;

  const map = {
    "R":  { axis: "x", layers: [1], angle: -q },
    "R'": { axis: "x", layers: [1], angle: q },
    "L":  { axis: "x", layers: [-1], angle: q },
    "L'": { axis: "x", layers: [-1], angle: -q },

    "U":  { axis: "y", layers: [1], angle: -q },
    "U'": { axis: "y", layers: [1], angle: q },
    "D":  { axis: "y", layers: [-1], angle: q },
    "D'": { axis: "y", layers: [-1], angle: -q },

    "F":  { axis: "z", layers: [1], angle: -q },
    "F'": { axis: "z", layers: [1], angle: q },
    "B":  { axis: "z", layers: [-1], angle: q },
    "B'": { axis: "z", layers: [-1], angle: -q },

    "M":  { axis: "x", layers: [0], angle: q },
    "M'": { axis: "x", layers: [0], angle: -q },

    "E":  { axis: "y", layers: [0], angle: q },
    "E'": { axis: "y", layers: [0], angle: -q },

    "S":  { axis: "z", layers: [0], angle: -q },
    "S'": { axis: "z", layers: [0], angle: q },

    "Rw":  { axis: "x", layers: [1, 0], angle: -q },
    "Rw'": { axis: "x", layers: [1, 0], angle: q },

    "Lw":  { axis: "x", layers: [-1, 0], angle: q },
    "Lw'": { axis: "x", layers: [-1, 0], angle: -q },

    "Uw":  { axis: "y", layers: [1, 0], angle: -q },
    "Uw'": { axis: "y", layers: [1, 0], angle: q },

    "Dw":  { axis: "y", layers: [-1, 0], angle: q },
    "Dw'": { axis: "y", layers: [-1, 0], angle: -q },

    "Fw":  { axis: "z", layers: [1, 0], angle: -q },
    "Fw'": { axis: "z", layers: [1, 0], angle: q },

    "x":  { axis: "x", layers: [-1, 0, 1], angle: -q },
    "x'": { axis: "x", layers: [-1, 0, 1], angle: q },
    "y":  { axis: "y", layers: [-1, 0, 1], angle: -q },
    "y'": { axis: "y", layers: [-1, 0, 1], angle: q },
    "z":  { axis: "z", layers: [-1, 0, 1], angle: -q },
    "z'": { axis: "z", layers: [-1, 0, 1], angle: q },
    "yRotation": { axis: "y", layers: [-1, 0, 1], angle: -q },
    "yRotation'": { axis: "y", layers: [-1, 0, 1], angle: q },
    "zRotation": { axis: "z", layers: [-1, 0, 1], angle: -q },
    "zRotation'": { axis: "z", layers: [-1, 0, 1], angle: q }
  };

  return map[move] || null;
}

function rotateLayer(axis, layers, angle, durationMs = 100) {
  isAnimating = true;

  const group = new THREE.Group();
  scene.add(group);

  const selected = cubies.filter(cubie => {
  return layers.includes(cubie.userData.coord[axis]);
  });

  selected.forEach(cubie => {
    group.attach(cubie);
  });

  let startedAt = 0;

  function animate(now) {
    if (!startedAt) startedAt = now;
    const progress = Math.min(1, (now - startedAt) / durationMs);
    group.rotation[axis] = angle * progress;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      selected.forEach(cubie => {
        scene.attach(cubie);
        updateCoord(cubie, axis, angle);
        snapCubie(cubie);
      });

      scene.remove(group);
      isAnimating = false;
      callAfterMoveCallback();
      runNextMove();
    }
  }

  animate();
}

function updateCoord(cubie, axis, angle) {
  let { x, y, z } = cubie.userData.coord;
  const dir = Math.round(angle / (Math.PI / 2));

  if (axis === "x") {
    if (dir === 1) [y, z] = [-z, y];
    if (dir === -1) [y, z] = [z, -y];
  }

  if (axis === "y") {
    if (dir === 1) [x, z] = [z, -x];
    if (dir === -1) [x, z] = [-z, x];
  }

  if (axis === "z") {
    if (dir === 1) [x, y] = [-y, x];
    if (dir === -1) [x, y] = [y, -x];
  }

  cubie.userData.coord = { x, y, z };
}

function snapCubie(cubie) {
  const { x, y, z } = cubie.userData.coord;
  cubie.position.set(x * STEP, y * STEP, z * STEP);

  cubie.rotation.x = Math.round(cubie.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
  cubie.rotation.y = Math.round(cubie.rotation.y / (Math.PI / 2)) * (Math.PI / 2);
  cubie.rotation.z = Math.round(cubie.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
}

function rotateWholeCube(axis, angle) {
  if (isAnimating) return;

  isAnimating = true;

  const group = new THREE.Group();
  scene.add(group);

  cubies.forEach(cubie => {
    group.attach(cubie);
  });

  let current = 0;
  const frames = 12;
  const step = angle / frames;

  function animate() {
    current++;
    group.rotation[axis] += step;

    if (current < frames) {
      requestAnimationFrame(animate);
    } else {
      cubies.forEach(cubie => {
        scene.attach(cubie);
        updateCoord(cubie, axis, angle);
        snapCubie(cubie);
      });

      scene.remove(group);
      isAnimating = false;
      callAfterMoveCallback();
      runNextMove();
    }
  }

  animate();
}

function isCubeSolved() {
  const faceColors = {
    x1: [],
    x_1: [],
    y1: [],
    y_1: [],
    z1: [],
    z_1: []
  };

  cubies.forEach(cubie => {
    cubie.updateMatrixWorld(true);

    cubie.children.forEach(sticker => {
      sticker.updateMatrixWorld(true);

      const pos = new THREE.Vector3();
      sticker.getWorldPosition(pos);

      const color = sticker.material.color.getHex();

      const ax = Math.abs(pos.x);
      const ay = Math.abs(pos.y);
      const az = Math.abs(pos.z);

      if (ax > ay && ax > az) {
        if (pos.x > 0) faceColors.x1.push(color);
        else faceColors.x_1.push(color);
      } else if (ay > ax && ay > az) {
        if (pos.y > 0) faceColors.y1.push(color);
        else faceColors.y_1.push(color);
      } else if (az > ax && az > ay) {
        if (pos.z > 0) faceColors.z1.push(color);
        else faceColors.z_1.push(color);
      }
    });
  });

  return Object.values(faceColors).every(face => {
    return face.length === 9 && face.every(color => color === face[0]);
  });
}


function applyMoveInstant(move) {
  const parsed = parseMove(move);
  if (!parsed) return;
  applyParsedMoveInstant(parsed);
}

function applyParsedMoveInstant(parsed) {
  const { axis, layers, angle } = parsed;

  const group = new THREE.Group();
  scene.add(group);

  const selected = cubies.filter(
    cubie => layers.includes(cubie.userData.coord[axis])
  );

  selected.forEach(cubie => {
    group.attach(cubie);
  });

  group.rotation[axis] = angle;
  group.updateMatrixWorld(true);

  selected.forEach(cubie => {
    scene.attach(cubie);
    updateCoord(cubie, axis, angle);
    snapCubie(cubie);
  });

  scene.remove(group);
}

let afterMoveCallback = null;

function setAfterMoveCallback(callback) {
  afterMoveCallback = callback;
}

function callAfterMoveCallback() {
  if (typeof afterMoveCallback === "function") {
    afterMoveCallback();
  }
}

function runNextMove() {
  if (isAnimating) return;
  if (moveQueue.length === 0) return;

  const nextMove = moveQueue.shift();
  const parsed = parseMove(nextMove);
  if (!parsed) {
    runNextMove();
    return;
  }

  const durationMs = getRotationDuration();
  if (durationMs === 0) {
    applyParsedMoveInstant(parsed);
    callAfterMoveCallback();
    requestAnimationFrame(runNextMove);
    return;
  }

  rotateLayer(parsed.axis, parsed.layers, parsed.angle, durationMs);
}
