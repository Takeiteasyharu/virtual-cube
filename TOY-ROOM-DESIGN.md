# STcube — Toy Room × Playful Geometry

## Visual system

Cream `#f8f5ed`, navy `#23344b`, blue `#2777bc`, with restrained yellow,
mint, coral and lilac materials. Night palette uses navy room surfaces and
muted versions of the same materials, rather than an unrelated black theme.
The four-tile CSS brand, tactile button edges, rounded shelves and circular
play mat provide a shared identity without new images, fonts or 3D scenes.

`toy-room.css` is a dedicated override layer (20,240 bytes at first check),
loaded after legacy styles. Component rules are grouped by destination.
Existing DOM IDs, keyboard bindings, state machines, Firestore operations,
cube engine, camera and rotation durations are preserved. Cosmetic markup
adds brand tiles, section labels and a Battle introduction; no new feature.

## Screens

- Main: center play mat and large tabular timer, player corner, record shelf,
  readable monospace scramble, three colored PB/Ao5/Ao12 blocks. Mobile uses
  a compact six-action grid and a single-column flow with separate scramble
  and text-input targets. Narrow tablets no longer clip the lower shelves.
- Battle entry: introduction tile, Friend/Random mode selectors, distinct
  create/join cards, BOT preference panel. Arena keeps the existing cube
  geometry and adds player/opponent team edges and rounded opponent panels.
- Replay/Battle Replay: same blue mat, rounded controls and leave button;
  playback timing and result handling remain unchanged.
- Profile/Achievements: overview panel, statistic tiles, separate Ranked and
  Friend blocks, earned badge material and responsive badge grid. Values,
  uncertainty notices and unlock conditions are unchanged.
- Settings: two-column setting tiles, single-column on phones, expandable
  keyboard editor. Ranking, Analytics and Daily use their own list/chart/
  challenge layouts with common materials and typography.
- Guided: keeps blue next-arrow highlighting; mobile guide controls sit below
  the arrows instead of overlapping them. Normal game input is unchanged.
- Login, notifications, dialogs, About/Privacy/Rules and the game guide share
  the palette. PWA name/colors updated; installed icon assets are unchanged.

## Motion and cost

160ms hover/press transitions, 200ms modal entry and a 240ms PB update effect.
No idle animation, backdrop blur, additional WebGL render loop, webfont or
third-party UI library. Decorations are static and pointer-transparent.
`prefers-reduced-motion` removes decorative transitions/animations; PB effect
uses zero duration. Active cube/timer rendering has no CSS transition.
No additional Firestore reads, writes, subscriptions or schema/Rules changes.

## Verification

- 58 Node tests passed (54 existing plus four design contract tests).
- `tools/test-toy-room.cjs`: 1440×900, 1024×768, 390×844 and 320×740,
  light/night; 90 screenshots including populated Profile/badges, Settings,
  Ranking, Analytics, Battle/Friend/Random, Daily and Guided. No horizontal
  overflow or out-of-viewport modal bounds; no page JavaScript errors.
- Mobile-emulated tap to scramble, input-field turns through a full normal
  solve, tap to play/close Replay passed at 390px and 320px. Reduced-motion
  modal styles and all four informational routes passed.
- Existing PC/mobile normal solve, record isolation, fixed solve IDs,
  Guided Solve, Replay and menu regression passed.
- Firestore Emulator multi-client battle regression passed: host departure,
  remaining player's solve, result/Rating once, delayed profile event once,
  automatic Replay 1×/2×/4× and skip, DNF/recovery/original UTC day,
  three-player Friend Battle, BOT fallback and exit without restart.
- Auth + Firestore Emulator: Guest login, one actual normal-solve transaction,
  Profile read/render, one activity day, four unlocked badges and account-scoped
  Analytics with matching Replay passed, with no page JavaScript errors.

## Input timing comparison

Headless Edge + SwiftShader, synthetic keydown through the actual app handler.
The same app and measurement tool were run with the new CSS disabled
(`node tools/test-input-latency.cjs --no-toy`) and enabled (without that flag).
Ten isolated inputs and a 12-key burst per mode; actual order and final
sticker state verified. Values are examples, not performance guarantees.

| Metric | New CSS disabled | New CSS enabled |
| --- | ---: | ---: |
| Normal, isolated first changed-angle draw median | 4.3ms | 3.6ms |
| BOT, isolated first changed-angle draw median | 6.5ms | 4.55ms |
| Normal, burst final changed-angle draw | 1060.2ms | 1085.5ms |
| BOT, burst final changed-angle draw | 1100.2ms | 1116.1ms |

Single-input medians did not worsen. Burst totals varied by ~16–25ms;
queueing/frame phase and headless scheduling vary between runs. This does
not establish a production hardware FPS improvement or zero regression on
every device. Physical keyboard-to-photon latency and actual mobile hardware
remain unmeasured. No game input/animation engine code changed in this task.

## Release

Existing GitHub Pages workflow, with the new CSS in the publication allowlist
and Service Worker v135 precache. Firebase Spark retained; no Cloud Functions,
production data mutation/migration or Firebase Rules deployment required.
Production Google OAuth and real authenticated human battles are not part of
the production smoke test; their Emulator-backed flows are tested locally.

## Changed files

`index.html`, `toy-room.css`, `game-ui.js`, `manifest.json`, `about.html`,
`privacy.html`, `rules.html`, `online-battle/index.html`,
`online-battle/guide.css`, `service-worker.js`, `.github/workflows/pages.yml`,
`.gitignore`, `tools/test-toy-room.cjs`, `tools/test-input-latency.cjs`,
`tests/toy-room.test.cjs`, `TOY-ROOM-DESIGN.md`.
