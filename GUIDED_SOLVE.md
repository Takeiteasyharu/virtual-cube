# Guided Solve

Guided Solve is local-only practice. No Firebase schema or submission path is added.

## Layers

- `guided-solver.js`: pure sticker-state transforms, inverse solution validation,
  target states, correction paths, and an Undo/Redo journal. It accepts the real
  renderer's `parseMove` adapter. A future short-solution algorithm can replace
  `buildSolution` and still return a move list to `Session`.
- `guided-solve.js`: browser adapter, keyboard labels, arrow hints and controls.
- `cube.js`: read-only 54-sticker snapshots and post-animation move events.
- `script.js` / `timer.js`: practice boundaries and recording guards.

## Safety

The adapter records the actual scramble and completed turns, not key presses.
Before starting, it replays that path against the current physical sticker
snapshot and verifies its inverse returns the initial solved state. Unknown or
out-of-band state changes are rejected without resetting the user's cube.

Undo truncates the active journal prefix; Redo replays its next turn. New turns
discard the redo suffix. Each commit is checked against a fresh actual snapshot.
The prefix is replayed to derive progress and repairs. Equivalent sticker states
can advance targets; quarter turns toward a 180-degree target remain uncounted
until the full target is reached. Repair turns do not increase main progress.

Practice remains ineligible for records even after Exit, until the next cube
reset/new scramble. Timer start, timer stop and solve saving all enforce this.
No practice state is persisted across reloads. Battle mode clears the adapter.

## UI limitations

This version had no existing arrow controls in its source tree. Guided-only blue
arrow controls are therefore added, derived from the actual axis/layers/angle.
X uses upward/downward column arrows, Y uses left/right row arrows, and Z uses
clockwise/counterclockwise B/S/F badges. Whole rotations highlight three controls.
Where no Settings key is assigned (e.g. E), the hint says "Tap arrow".

The inverse solution is not a beginner layer-by-layer method or a short solver.
It can become long after many free rotations. Guidance is disabled if provenance
cannot be reconstructed. Long key lists may wrap in narrow viewports.

## Hosting

Run the portable pure-state regression suite with:

```sh
node --test tests/guided-solver.test.cjs
```

The local `.guided-tests.cjs` browser harness additionally exercises actual THREE
sticker transforms, random-state scrambles, keyboard/touch controls, records,
viewport geometry, and battle/reload isolation. It uses the installed local
Playwright/Edge runtime, not a production backend.

The current domain resolves to GitHub Pages and the repository's official
workflow is `.github/workflows/pages.yml`. The static artifact must include both
guided JavaScript files. Firebase Hosting has no configuration in this project.
