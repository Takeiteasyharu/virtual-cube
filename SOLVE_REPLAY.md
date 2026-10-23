# Solve Replay

Only the latest completed, verified virtual Normal solve is stored under
`stcubeSolveReplayV1`. Guest use needs no account. Guided practice, battle,
unverified stops, aborted and incomplete attempts never replace it.

Version 1 JSON fields:

- `scramble`, `pre`: scramble notation and completed inspection/pre-start turns.
- `initial`: 54 compact `[x,y,z,nx,ny,nz,color]` sticker tuples.
- `turns`: ordered `[notation,startMs,endMs]` actual animation events.
- `ms`, `count`, `tps`: the existing official solve statistics.
- `v`: schema version, currently 1.

Timestamps use the same `Date.now()` epoch as the timer. The final endpoint is
clamped to the official hundredth-second time (the existing timer samples every
10ms). Displayed `Turn n / total` counts actual operations including whole-cube
rotations; `Moves` and TPS retain the existing normalized move-count rules.

Preparation, initial state, final solved state, count, TPS and ordered timestamps
are checked before deferred storage. Parsing/validation/storage failures retain
the previous replay and do not interrupt normal solve recording. Unknown versions
and corrupt persisted data are ignored. A 512,000-byte estimated UTF-16 limit and
10,000-operation limit prevent unbounded local storage. A three-turn fixture is
approximately 1.4KB UTF-8; normal solves add roughly 15–25 bytes per operation.

`solve-replay.js` reuses GuidedSolver's pure sticker transforms and the actual
cube move parser. It owns a separate THREE scene and renderer, created only when
the replay modal opens. Playback interpolates recorded animation intervals; seek
and stepping reconstruct exact completed-move states, never the main cube.
Transient checkpoints every 32 turns bound seek/playback transform work without
persisting extra states. Pause cancels RAF; close disposes geometries, materials,
WebGL context, ResizeObserver and checkpoints. UI handlers are installed once.
Capture-phase keyboard isolation and a focus trap protect normal play.

Run portable tests with `node --test tests/*.test.cjs`. The local
`.replay-check.cjs` Edge/Playwright harness verifies desktop/mobile controls,
recording, storage, excluded modes and isolation; `--public` tests deployed assets.
No Firestore, Storage, Authentication or battle rules are changed.
