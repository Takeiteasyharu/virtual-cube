# Normal solve focus view

Normal virtual inspection enters focus at `startNormalInspection`; the same view continues during `normalSolveState === solving`. Completion, Abort and mode cancellation restore the ordinary view via the existing solo-action rendering boundary. No timer, move queue, animation duration, solve statistics or Replay recording code is replaced.

Only scramble, cube, inspection count/timer, Abort, Settings and Game Guide remain visible. Sidebars/footer are removed from layout. The cube's existing width is captured on entry and retained where viewport space permits; smaller viewports clamp the stage. Inspection and solve share the same timer/cube cells. Existing Abort and inspection overlay nodes are temporarily relocated and restored, retaining their event listeners. One renderer resize happens at entry/exit, never per frame or per keypress.

Settings uses its existing modal and input isolation; time continues to run. During focus only, Game Guide opens `/online-battle/` in another tab with `noopener noreferrer`, preserving the original page/cube/timer. Closing that tab returns to the ongoing solve; the ordinary link target is restored on exit. The existing mobile move input stays transparent over the cube so tapping the cube still provides keyboard input, without displaying another panel.

Battle, BOT, Daily, Guided, Replay and legacy real-cube timer modes are excluded. There are no additional Firestore reads/writes, database changes, persistent preferences, background loops or delayed focus callbacks.

## Verification

- 89 unit tests pass, including four focus lifecycle/mode-exclusion/cancellation/scheduling tests. Cleared inspection/timer flags cannot leave a stale phase name in focus after cancellation.
- `node tools/test-normal-focus.cjs`: real Edge browser, widths 1440/1024/390/320, both themes. Space starts inspection; keyboard turns start/complete a deterministic `R U F2` solve; mobile tap/input works; inspection and solve cube rectangles remain identical; Settings and Guide preserve state; completion/Abort restore the UI; normal Replay data is recorded; Guided is excluded. Desktop additionally waits for the real 15-second inspection timeout and tests Abort after automatic solve start. Snapshots saved under `.focus-verification/` are local verification artifacts, not deployed assets.
- Existing `tools/test-toy-room.cjs` exercises regular screens, mobile scramble/input, normal completion and Replay controls.
- `--public` on the focus browser command repeats the same checks against the deployed page. Tests use local storage and unsigned normal solves; no synthetic production Firestore records are created.

Browser mobile emulation is not a physical-device/OS-keyboard test. Guide browser policies may show a new window rather than a tab; the original solve remains open either way. Settings/Guide do not pause inspection or timing.
