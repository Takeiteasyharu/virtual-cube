# Personal Battle End Flow

## Behavior

- New human rooms use `flowVersion: 3`; existing room documents are not migrated.
- A verified personal completion shows the time and a final or explicitly pending
  result for 3 seconds, independently of synchronization latency or other players.
- A separate local Three.js replay starts at 2×, offers 1×/2×/4× and Skip Replay,
  and automatically ends at the Leave Battle screen. Missing or invalid replay
  data is reported, not reconstructed. Normal Replay storage is untouched.
- Leaving preserves terminal certificates, player documents and other players'
  clocks. An unfinished departure submits DNF. Local exit waits at most 1.5 seconds
  for presence synchronization; expiration remains available if disconnected.
- Every Leave/Cancel invalidates the matchmaking generation and its BOT timers.
  Rematch BOT, Play Again and Find next match are no longer end-screen actions.

## Finalization and private achievements

- Immutable `battleRooms/{id}.roundResults[uid]` certificates carry terminal state,
  time/score and the original server completion/expiry timestamp.
- Shared `pendingParticipantUids` supports a bounded recovery query at login.
- Any participant may finalize their own result or certify an expired participant.
  An unfinished player expires after 90 seconds without heartbeat or 5 minutes
  from round start, whichever occurs first. Ranked's existing 2-minute solve limit
  still applies. If everyone is offline there is no scheduled server job: the next
  participant access materializes the already-expired results.
- The best completed time wins. With no finish, time-limit scores are compared.
  Tied best finishers draw; slower finishers lose. DNF remains distinct from draw.
- `finishedAt` is the latest original terminal timestamp, not a later recovery
  time. Original UTC round completion day is used for activity.
- Either Ranked participant can commit both public Elo updates atomically. The
  original calculation/repeated-opponent multiplier is unchanged. Rules require
  both public profiles and the room flag to be updated together. A finalized room
  cannot be rated twice, including a zero-change draw.
- Finalization creates small owner-readable pending metadata in
  `battleInboxes/{uid}/rounds/{roomId}_{round}`. Participants cannot read another
  user's inbox or private statistics. The inbox does not contain private stats.
- The owner projects a fixed `battle_{roomId}_{uid}_{round}` event into the existing
  private aggregate transaction, then marks its inbox processed. Simultaneous
  devices/retries do not double count. Login processes at most 20 pending rooms
  and 20 finalized inboxes per pass, without a persistent listener.
- `users/{uid}/activityCalendar/current` stores validated disjoint UTC intervals
  (`{start,end}` maps). Late days join intervals without moving the most recent
  day backwards. Existing immutable activity-day documents bootstrap this calendar
  once, in bounded batches of up to 1,000 days. No solve history is imported.

## Cost and limitations

- Spark is retained; no Cloud Functions, new cloud replay storage, or external AI.
- Personal recording/replay is local memory only. No new per-move cloud writes.
- Each terminal human result updates its existing player/room pair. Finalization
  additionally writes one small inbox document per participant. Owner projection
  reuses the existing event/summary transaction, plus a calendar write on a new
  UTC activity day and a processed-inbox write. Initial activity bootstrap adds
  one read/write per retained activity-day document; it is not repeated in full.
- Rules protect ownership, immutable results, original dates and atomic updates;
  client-reported solving skill/time is not cryptographically proven. Coordinated
  malicious clients and legacy client trust are not completely eliminated.
- A disconnected, unacknowledged finish may become DNF. With no online participant,
  physical settlement waits for the next access. Historical data is not rewritten.
- DNF, Real Cube or missing-journal cases can show Replay unavailable. Replay
  never invents moves. Existing pre-v3 rooms retain their compatibility path.

## Verification commands

Pre-publication checks: 51 pure/CI tests and 40 Firestore Emulator tests passed.
Independent browser contexts verified the end/replay flows, three-player Friend
Battle, and deferred settlement. Additional browser regression checks verified
desktop/mobile normal play, Guided Solve, normal Replay, Guest Auth/Profile/
Analytics, BOT ON/OFF, cancellation/reload and human-first matching. Production
authenticated human battles are not exercised with test writes; production
verification is a read-only/public-client smoke check after deployment.

```text
node --test tests/battle-flow.test.cjs tests/battle-end.test.cjs
firebase emulators:exec --only firestore --project demo-stcube-flow "node --test tests/battle-flow-rules.test.cjs tests/profile-stage2-rules.test.cjs tests/profile-rules.test.cjs tests/daily-rules.test.cjs tests/random-matchmaking-rules.test.cjs tests/bot-matchmaking.test.cjs"
firebase emulators:exec --only firestore --project demo-stcube-battle-end "node tools/test-battle-end-browser.cjs"
firebase emulators:exec --only firestore --project demo-stcube-random-browser "node tools/test-random-browser.cjs"
```

The browser fixtures use only demo projects and isolated Edge contexts. They cover
personal completion/replay/skip, a host leaving before a guest finishes, an
unfinished host departure, consecutive rounds, next-access recovery of an abandoned
round, three-player Friend Battle, and BOT exit without delayed restart. Screenshots
are generated locally for desktop/mobile light/dark layout verification.

## Changed files

- Runtime: `battle-flow.js`, `battle-end.js`, `battle-end.css`,
  `activity-calendar.js`, `online.js`, `bot-battle.js`, `solve-replay.js`,
  `timer.js`, `script.js`, `profile-records.js`, `profile-progress.js`, `index.html`.
- Rules/cache/publication: `firestore.rules`, `service-worker.js`,
  `.github/workflows/pages.yml`.
- Guide: `online-battle/index.html`.
- Tests: `tests/battle-flow.test.cjs`, `tests/battle-end.test.cjs`,
  `tests/battle-flow-rules.test.cjs`, `tests/profile-rules.test.cjs`,
  `tools/test-battle-end-browser.cjs`, `tools/test-random-browser.cjs`.
- This report: `BATTLE-END-FLOW.md`.
