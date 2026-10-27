# Input/render latency investigation — 2026-10-27

## Changes

- `cube.js`: advance the active layer rotation immediately before the existing
  main renderer. Start its clock when the rotation is scheduled, not on a later
  first RAF that only draws zero progress. Keep the configured duration, FIFO
  queue, reset generation, start/completion events and final state checks.
- `online.js`: a 10ms timer tick updates clock text only, instead of rebuilding
  the room UI and invoking round maintenance/settlement/recovery. Existing
  snapshots, transitions and the 100ms battle clock still render the full UI.
  BOT timer-triggered metadata refresh is limited to 100ms (the separate BOT
  animation loop is unchanged). Move publication updates its last-move label
  rather than rebuilding the room synchronously before queuing the rotation.
- Service Worker cache: v134. No Firestore schema, Rules, Elo, keymap, cube size
  or animation speed setting changes.

## Measurement method and limits

Headless Microsoft Edge, SwiftShader WebGL, 1440x900, real application keydown
handler, synthetic keyboard events. Measure event dispatch to move-start event,
handler return, and the first renderer submission with a nonzero rotation.
This is **not physical keyboard-to-photon latency**: OS/hardware input, GPU
presentation, monitor refresh and an actual phone are unmeasured.

`tools/test-input-latency.cjs` exercises normal and local BOT modes with isolated
input and 12 keys at 8ms intervals, verifies every completed move and final
sticker-state equality. Speed is 10 turns/sec. `--baseline` requires local
pre-change snapshots `.input-latency-baseline.js` and
`.input-latency-online-baseline.js`; these snapshots are not published.

`STCUBE_INPUT_LATENCY=1` adds equivalent timing/state/order probes to
`tools/test-battle-end-browser.cjs` with real Emulator-backed multiplayer rooms.
`STCUBE_INPUT_BASELINE=1` serves the two pre-change snapshots for comparison.
That integration suite uses 20 turns/sec and PC/mobile viewport clients.

Measurements vary with headless software rendering and concurrent client load.
Rapid input above the configured animation rate intentionally waits in FIFO;
the last queued turn is not expected to begin immediately. No speed-up or
dropping of queued moves is used to disguise this queueing delay.

## Measured comparison

Example completed comparison runs, milliseconds (not statistical percentiles):

| Scenario | Before first changed-angle draw | After |
| --- | ---: | ---: |
| Normal, isolated key | 90.1 | 22.6 |
| BOT, isolated key | 98.9 | 29.6 |
| Ranked, two clients, two isolated keys per client | 89.0–99.1 | 7.1–31.8 |
| Normal, last of 12 rapidly queued keys | 1443.0 | 1391.5 |
| BOT, last of 12 rapidly queued keys | 1470.0 | 1402.1 |
| Ranked, last of 12 rapidly queued keys per client | 1040.2–1081.4 | 648.9–650.5 |

Normal/BOT key handlers were generally sub-millisecond, with initial solve
setup around 2ms and occasional scheduling outliers. Ranked baseline handler
samples were 0.6–4.5ms, versus 0.2–3.5ms after. The move-start event itself was
already nearly immediate for an idle queue; visual update scheduling and
repeated battle UI work were the demonstrated issues. Headless tests do not
establish why a particular physical machine feels slower than before, nor
prove a historical regression's exact introduction date.

## Verified

- Existing 51 pure tests passed; 3 input/render regression tests passed.
- Local normal solve, fixed solve ID, mode isolation, Guided Solve, Replay,
  settings/battle/ranking/profile/daily menus and reload passed at 1440px and
  390px with zero page JavaScript errors.
- Initial Emulator multi-client regression passed: host departure, continuation,
  rating once, deferred profile once, Replay speeds/skip, DNF, original UTC
  activity date recovery, three-player Friend Battle, BOT fallback and exit.
- Final timing-enabled Emulator suite passed against both pre-change and
  updated sources, including real per-move Firestore publication and verified
  Battle Replay of the extra measurement turns. No page JavaScript errors.
- No new network listeners or Firestore reads/writes were added. Removing
  timer-driven room maintenance eliminates redundant invocations; the precise
  production network savings were not measured.

## Remaining limits

No physical phone/keyboard measurement, production authenticated human match,
or representative hardware FPS benchmark. Software-renderer frame intervals
remained around 30–33ms; this change does not establish an FPS improvement.
Normal/history/TPS bookkeeping and per-move battle publication are retained to
preserve record/replay accuracy. Client/network/background-tab and third-party
script load can still affect responsiveness.
