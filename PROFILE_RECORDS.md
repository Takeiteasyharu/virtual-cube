# Profile recording foundation (stage one)

No UI refresh, badges, backfill, Functions or billing change is included.

## Scope and compatibility

`profile-records.js` is the shared, renderer-independent transaction writer.
Normal records require positive `source: normal`, virtual mode, cube verification
and a fixed UUID issued by `resetSolveStats`. Runtime guards reject battle, BOT,
Guided, Replay and Daily sessions. Real-cube history remains local and separate.

Existing `solves` documents stay readable, and the Single/Ao5 field layout is
preserved. New documents have `schemaVersion: 2` and deterministic IDs:
`normal_<solveId>_single` and `normal_<solveId>_ao5`. The Ao5 record is optional.
The legacy user summary is updated in the same transaction, never separately.
The normal UUID and payload are kept in per-record localStorage entries named
`pendingNormalSolveV2:<solveId>` until the transaction is confirmed. Retries use
the same ID, including after reload, offline recovery and simultaneous tabs.
Web Locks serialize queue claims where available; Firestore remains authoritative.
An account-bound pending record cannot be silently submitted for another UID.

The old `pendingOnlineSolves` array has no reliable IDs/provenance. It is left
untouched and not automatically resubmitted or migrated. Browser storage failure
is reported, not treated as a successful online save.

## New data

`users/<uid>/profileStats/current` has v=1, a fixed scope,
`trackingStartedAt`, `updatedAt`, `lastEventId`, zero-based normal-virtual counts,
millisecond PB/Ao5/Ao12, total moves/time, milli-TPS sum, and separate Ranked and
Friend battles/wins/losses/draws/DNFs. `trackingStartedAt` is the first accepted
event, not the account's creation date. Historical counters are NOT imported.

`users/<uid>/profileEvents/normal_<solveId>` is an immutable compact normal event.
`users/<uid>/profileEvents/battle_<roomId>_<uid>_<round>` is an immutable human
battle event. Activity-day documents are intentionally deferred to avoid writes
for functionality not requested in stage one.

Human battle results and the corresponding event/summary commit together.
Pre-existing results are not rewritten or retroactively aggregated. Event/result
reads detect duplicate completion. DNF is separate from loss; a declared draw
remains a draw, and time-limit score decisions remain win/loss/draw. A non-finished
player after the finishing window is DNF. BOT rooms are rejected. Friend real and
virtual rooms remain supported. The Elo calculation, repeated-opponent multiplier
and round progression are unchanged; the existing Elo transaction still owns
legacy Ranked counters and now distinguishes DNF in those counters as well.

## Security and publication

New child paths are private to the UID owner. Rules require a new immutable event,
matching result/Single record and exact counter deltas in the same atomic commit.
Events and summaries cannot be deleted. A legacy /users update cannot authorize
these child paths. Version-2 ranking writes must reference the same event.
Legacy normal writers remain accepted for cached-client compatibility, but never
feed the canonical new summary. Explicit non-normal sources are rejected.

These are client-reported records, not cheat-proof certificates. Rules do not
prove a real human solved a cube. Old /users counters retain existing compatibility
permissions and are NOT authoritative achievement data. New achievements must use
the versioned child summary, not infer exact lifetime totals from legacy fields.
New events are immutable, not a per-frame cube replay; no user data is migrated.

Deploy tested Rules first to `virtual-cube-timer`, then publish the client through
the existing GitHub Pages workflow. SW v128 includes the new shared module.

## Costs and tests

Normal commit: 4 document reads and 4 writes (5 with Ao5), before retries/Rules
dependent reads. Human result: 6 reads, 3 writes; Friend adds one legacy user write.
The Elo transaction adds two participant reads to classify DNF correctly. No
activity or per-badge writes. Event storage grows one small document per result.

`node --test tests/profile-records.test.cjs` tests scope/classification/reducers.
`npm run test:profile` runs Firestore Emulator tests for idempotency, concurrency,
forbidden writes, legacy compatibility, real Friend rooms and the actual Elo
transaction. Existing Daily Rules tests are also run before release. Only demo
projects are used by these tests. Test authentication claims do not test Google's
interactive OAuth popup. Production smoke tests remain signed out and never
create fake ranking/battle data.
