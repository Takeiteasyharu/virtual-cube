# Rotation direction and latency — 2026-11-01

## Cause

The October 27 latency change (626736e, still present in 1d96119) moved the
animation start to `performance.now()` and advanced rotations before drawing.
However, it passed the RAF **frame-start timestamp** into the interpolation.
Input can start a turn after that timestamp, although the callback executes
later. `(rafTimestamp - startedAt) / duration` can therefore be negative.
Only the upper bound was clamped. A target R angle of -90 degrees could first
draw a positive angle, then jump back across zero. Final state was still right.

The deterministic regression reproduces +7.2 degrees for R when the timestamp
is 8ms older than the start at a 100ms duration. The before snapshot matches
the published 1d96119 `cube.js` blob exactly (abd1eae9354934e5aeb218930c58020ed9cd8696).

## Fix

- Sample `performance.now()` immediately before the animation update, using
  the same live clock as its start. Do not wait for another RAF or reset the
  start at the first frame (either would lose the latency improvement).
- Bound progress to [0,1] and never allow it below the previous progress.
- Keep the same single render loop, linear interpolation, rotation axes/signs,
  duration settings, queue handoff, completion callback, coordinate updates and
  final snapping. No new game-loop listener, timer, wait or network operation.

Both normal and battle player cubes use this shared path. Guided Solve uses
the same move completion events. Separate replay/opponent renderers and move
notation are not changed.

## Per-frame verification

Actual Three.js update angles and renderer-visible angles were recorded for
R/L/U/D/F/B, their primes and 180-degree variants, single and fast input,
alternating R/R', ordinary scheduling, a synthetic 30ms-old RAF timestamp, and
a 55ms main-thread frame delay. Normal and BOT each execute 96 turns, for
192 turns per revision. All final states match independently applied move
specifications and every input/complete sequence matches.

| Revision | Turns with any direction/progress violation | Drawn intermediate frames |
| --- | ---: | ---: |
| Before | 66 / 192 | 1,200 |
| After | 0 / 192 | 1,038 |

There were 178 violating update/draw samples before, zero after; the same
problem can be counted once in the update and again in its draw. The total
includes the two explicitly adverse scheduling conditions and is not a claim
that one-third of ordinary human inputs fail. Natural scheduling also reproduced
the issue without injecting stale timestamps. Frame counts are observations,
not an FPS performance comparison.

Pure tests additionally cover 36 face/slice/whole-cube moves, backward/repeated
clock samples and exact 5/10/20/50 TPS durations plus instant mode. Final-state
snap/callback and queue ordering remain unchanged. At low FPS, fewer frames
necessarily show larger *forward* increments; this fix does not invent missing
frames or slow down the configured animation to hide dropped frames.

Raw artifacts (local, deliberately not published):

- `.rotation-verification/before-angles.json`, `after-angles.json`
- `before-R-frame-*.png`, `after-R-frame-*.png`, and their capture JSON

The PNG sequences are actual WebGL canvas captures under the same 30ms-stale
timestamp fixture after the same six warm-up turns. They are not AI images or
a claim of identical wall-clock sample times. The regular no-capture traces
are kept separate so PNG encoding cannot affect their measurements.

## Latency comparison

Edge/Chromium headless, software WebGL, 1440×900, same keys and game code.
Normal/BOT: 10 single inputs each at 10 TPS after the same six warm-up turns.
Ranked: two actual Emulator-backed clients, desktop and 390px mobile viewport,
four single-input samples total at the existing 20 TPS integration setting.
These are JavaScript keydown → first renderer call showing progress or the
completed state, not physical keyboard-to-monitor/photon measurements.

| Mode | Before mean | After mean | After observed single-input range |
| --- | ---: | ---: | --- |
| Normal, warmed | 3.81ms | 4.24ms | 1.0–8.6ms |
| BOT, warmed | 4.16ms | 4.64ms | 2.3–6.5ms |
| Two-client Ranked | 18.40ms | 14.58ms | 8.2–25.1ms |

The steady-state measurements do not show a return to the older 90–100ms
behavior. The earlier reported 22.6/29.6/7–32ms numbers are reference values,
not interchangeable paired samples with these different warm-up/frame-rate
conditions. Small sub-ms differences are not presented as statistically
significant. Each normal/BOT benchmark also checks a 12-key, 8ms-spacing burst:
later queued turns wait for earlier 100ms animations, as they must to preserve
order and the existing speed. That queue residence is not labeled input-handler
delay. All sequences and final states match.

Cold launch was measured separately with the same per-turn attribution:
Normal mean/max 6.91/30.0ms before vs 30.30/145.2ms after; BOT mean/max
5.45/16.1ms before vs 4.75/7.2ms after. There remain startup outliers, and this
change does **not** guarantee a <90ms cold-start maximum or identify the cause
of that startup jitter. The initial probe was improved to count a turn whose
completion precedes its first draw instead of misattributing a later turn's
frame. Final comparisons consistently use that improved normal/BOT probe.

## Regression results

- 75 unit/model/regression tests: pass, including the newly added direction,
  irregular frame, backward sample and configured-speed tests.
- Before and after, real Emulator-backed browser flow: two-client Ranked,
  host leaving before the guest finishes, rating and private projection once,
  DNF exit, abandoned-room recovery, three-client Friend, BOT fallback/cleanup,
  Battle Replay 1×/2×/4× and Skip: pass.
- A timing-probe-only setup initially consumed inspection time while waiting
  for other players. The harness now probes only Ranked and starts the waiting
  guest with a reversible R/R' pair. Production inspection rules were not changed.
- Normal completion, fixed solve IDs, local record isolation, Guided Solve,
  normal Replay and main modals: actual desktop/mobile browser regression.

No real Google login popup or physical mobile device was tested. No production
solve, medal, rating, profile data, Firestore Rules, billing plan or Functions
is changed by this task. Browser/Firestore integration uses a demo Emulator;
standalone local UI fixtures suppress production medal processing.

## Files

`cube.js`, `service-worker.js` (v138), `.gitignore`,
`tests/input-render.test.cjs`, `tools/test-rotation-frames.cjs`,
`tools/test-input-latency.cjs`, `tools/test-battle-end-browser.cjs`, this report.
The before source snapshot and raw verification artifacts stay ignored/local.
