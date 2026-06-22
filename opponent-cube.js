(function () {
  const SIZE = 0.46;
  const GAP = 0.14;
  const STEP = SIZE + GAP;
  const COLORS = {
    U: 0xffffff,
    D: 0xffff33,
    F: 0x00ff00,
    B: 0x3333ff,
    R: 0xff3333,
    L: 0xffaa00
  };

  const QUARTER_TURN = Math.PI / 2;
  const MOVE_MAP = {
    R: ["x", [1], -QUARTER_TURN], "R'": ["x", [1], QUARTER_TURN],
    L: ["x", [-1], QUARTER_TURN], "L'": ["x", [-1], -QUARTER_TURN],
    U: ["y", [1], -QUARTER_TURN], "U'": ["y", [1], QUARTER_TURN],
    D: ["y", [-1], QUARTER_TURN], "D'": ["y", [-1], -QUARTER_TURN],
    F: ["z", [1], -QUARTER_TURN], "F'": ["z", [1], QUARTER_TURN],
    B: ["z", [-1], QUARTER_TURN], "B'": ["z", [-1], -QUARTER_TURN],
    M: ["x", [0], QUARTER_TURN], "M'": ["x", [0], -QUARTER_TURN],
    E: ["y", [0], QUARTER_TURN], "E'": ["y", [0], -QUARTER_TURN],
    S: ["z", [0], -QUARTER_TURN], "S'": ["z", [0], QUARTER_TURN],
    Rw: ["x", [1, 0], -QUARTER_TURN], "Rw'": ["x", [1, 0], QUARTER_TURN],
    Lw: ["x", [-1, 0], QUARTER_TURN], "Lw'": ["x", [-1, 0], -QUARTER_TURN],
    Uw: ["y", [1, 0], -QUARTER_TURN], "Uw'": ["y", [1, 0], QUARTER_TURN],
    Dw: ["y", [-1, 0], QUARTER_TURN], "Dw'": ["y", [-1, 0], -QUARTER_TURN],
    Fw: ["z", [1, 0], -QUARTER_TURN], "Fw'": ["z", [1, 0], QUARTER_TURN],
    x: ["x", [-1, 0, 1], -QUARTER_TURN], "x'": ["x", [-1, 0, 1], QUARTER_TURN],
    y: ["y", [-1, 0, 1], -QUARTER_TURN], "y'": ["y", [-1, 0, 1], QUARTER_TURN],
    z: ["z", [-1, 0, 1], -QUARTER_TURN], "z'": ["z", [-1, 0, 1], QUARTER_TURN]
  };

  class OpponentCube {
    constructor(container) {
      this.container = container;
      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      this.camera.position.set(0, 4.8, 4.8);
      this.camera.lookAt(0, 0, 0);
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.container.appendChild(this.renderer.domElement);
      this.scene.add(new THREE.AmbientLight(0xffffff, 2));
      const light = new THREE.DirectionalLight(0xffffff, 2.2);
      light.position.set(3, 5, 4);
      this.scene.add(light);
      this.cubies = [];
      this.scramble = "";
      this.round = 0;
      this.appliedIndexes = new Set();
      this.createCubies();
      this.resize();
      this.render();
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }

    createCubies() {
      for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
          for (let z = -1; z <= 1; z++) {
            const cubie = new THREE.Group();
            cubie.userData.coord = { x, y, z };
            cubie.position.set(x * STEP, y * STEP, z * STEP);
            this.addStickers(cubie, x, y, z);
            this.scene.add(cubie);
            this.cubies.push(cubie);
          }
        }
      }
    }

    addStickers(cubie, x, y, z) {
      const stickerSize = SIZE * 1.04;
      const offset = SIZE / 2 + 0.075;
      const add = (color, position, rotation) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(stickerSize, stickerSize, 0.001),
          new THREE.MeshPhongMaterial({ color, shininess: 18, side: THREE.DoubleSide })
        );
        mesh.position.set(position.x, position.y, position.z);
        mesh.rotation.set(rotation.x, rotation.y, rotation.z);
        mesh.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(mesh.geometry),
          new THREE.LineBasicMaterial({ color: 0x111111 })
        ));
        cubie.add(mesh);
      };

      if (x === 1) add(COLORS.R, { x: offset, y: 0, z: 0 }, { x: 0, y: QUARTER_TURN, z: 0 });
      if (x === -1) add(COLORS.L, { x: -offset, y: 0, z: 0 }, { x: 0, y: QUARTER_TURN, z: 0 });
      if (y === 1) add(COLORS.U, { x: 0, y: offset, z: 0 }, { x: QUARTER_TURN, y: 0, z: 0 });
      if (y === -1) add(COLORS.D, { x: 0, y: -offset, z: 0 }, { x: QUARTER_TURN, y: 0, z: 0 });
      if (z === 1) add(COLORS.F, { x: 0, y: 0, z: offset }, { x: 0, y: 0, z: 0 });
      if (z === -1) add(COLORS.B, { x: 0, y: 0, z: -offset }, { x: 0, y: 0, z: 0 });
    }

    reset() {
      this.cubies.forEach(cubie => this.scene.remove(cubie));
      this.cubies = [];
      this.createCubies();
      this.appliedIndexes.clear();
    }

    setScramble(scramble, round) {
      if (this.scramble === scramble && this.round === round) return;
      this.scramble = scramble;
      this.round = round;
      this.reset();
      String(scramble || "").split(/\s+/).filter(Boolean).forEach(move => this.applyMove(move));
      this.render();
    }

    applyMoves(moves) {
      let changed = false;
      [...moves]
        .sort((a, b) => Number(a.moveIndex) - Number(b.moveIndex))
        .forEach(entry => {
          const index = Number(entry.moveIndex);
          if (!Number.isFinite(index) || this.appliedIndexes.has(index)) return;
          this.applyMove(entry.move);
          this.appliedIndexes.add(index);
          changed = true;
        });
      if (changed) this.render();
    }

    applyMove(move) {
      if (!move) return;
      if (String(move).endsWith("2")) {
        const base = String(move).slice(0, -1);
        this.applyMove(base);
        this.applyMove(base);
        return;
      }

      const normalized = move === "yRotation" ? "y"
        : move === "yRotation'" ? "y'"
          : move === "zRotation" ? "z"
            : move === "zRotation'" ? "z'"
              : move;
      const parsed = MOVE_MAP[normalized];
      if (!parsed) return;

      const [axis, layers, angle] = parsed;
      const group = new THREE.Group();
      this.scene.add(group);
      const selected = this.cubies.filter(cubie => layers.includes(cubie.userData.coord[axis]));
      selected.forEach(cubie => group.attach(cubie));
      group.rotation[axis] = angle;
      group.updateMatrixWorld(true);

      selected.forEach(cubie => {
        this.scene.attach(cubie);
        this.updateCoord(cubie, axis, angle);
        this.snap(cubie);
      });
      this.scene.remove(group);
    }

    updateCoord(cubie, axis, angle) {
      let { x, y, z } = cubie.userData.coord;
      const direction = Math.round(angle / QUARTER_TURN);
      if (axis === "x") {
        if (direction === 1) [y, z] = [-z, y];
        if (direction === -1) [y, z] = [z, -y];
      } else if (axis === "y") {
        if (direction === 1) [x, z] = [z, -x];
        if (direction === -1) [x, z] = [-z, x];
      } else if (axis === "z") {
        if (direction === 1) [x, y] = [-y, x];
        if (direction === -1) [x, y] = [y, -x];
      }
      cubie.userData.coord = { x, y, z };
    }

    snap(cubie) {
      const { x, y, z } = cubie.userData.coord;
      cubie.position.set(x * STEP, y * STEP, z * STEP);
      cubie.rotation.x = Math.round(cubie.rotation.x / QUARTER_TURN) * QUARTER_TURN;
      cubie.rotation.y = Math.round(cubie.rotation.y / QUARTER_TURN) * QUARTER_TURN;
      cubie.rotation.z = Math.round(cubie.rotation.z / QUARTER_TURN) * QUARTER_TURN;
    }

    resize() {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      if (!width || !height) return;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height, false);
      this.render();
    }

    render() {
      this.renderer.render(this.scene, this.camera);
    }

    clear() {
      this.scramble = "";
      this.round = 0;
      this.reset();
      this.render();
    }
  }

  function createOpponentCube() {
    const container = document.getElementById("opponentCubeContainer");
    if (!container || !window.THREE) return;
    window.opponentCube = new OpponentCube(container);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createOpponentCube);
  } else {
    createOpponentCube();
  }
})();
