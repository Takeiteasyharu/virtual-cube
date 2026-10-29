# Automatic permanent ranking medals

## Operation

No administrator command, Cloud Functions, billing-plan change, or secret is
required. A foreground visitor gets one bounded catch-up pass, three seconds
after opening the game, when no solve, battle, guide, replay or cube animation is
active. Signed-in players reuse their connection. Signed-out visitors use a
separate, persisted anonymous Auth identity; the primary player login and user
profile are not changed. If anonymous Auth/network access fails, work is deferred.
This can create additional anonymous Firebase Authentication accounts.

Tracking starts **2026-10-30 00:00 UTC**. The first eligible daily period closes
October 31; the first full month starts November 1 and closes December 1; the
first full ISO week starts November 2 and closes November 9. Partial periods and
older records are deliberately not backfilled. These constants match the model
and Rules. There is no need to keep an administrator PC running.

Each completed Today, Week and Month period awards gold/silver/bronze to the best
three distinct users for each of Single, Ao5, TPS and Moves. Existing metric
values and period keys are reused. Ties use the ranking query's document-ID order
(descending for TPS, ascending otherwise), giving exactly three podium slots.
All awards no medals. UI lists up to 50 users for All, 10 for other periods;
repeat results from one player do not occupy multiple places.

Only immutable v2, verified-provenance normal virtual solves are eligible.
The server `createdAt` must be within the period. Late/offline submissions cannot
alter an already closed snapshot. An unverifiable encountered candidate seals
that metric as `unverifiable`, with a source-document reference and **no guessed
awards**. Empty periods are explicitly recorded. Existing solve/profile/battle
data and names are never modified by this feature.

## Storage and recovery

- `rankingMedalJobs/{today|week|month}`: oldest unfinished period and a 60-second
  worker lease. Rules permit at most 90 seconds and prohibit skipping periods.
- `rankingMedalPeriods/{kind_key_metric}`: immutable certificate, selected source
  references/values, result status, server finalization time and worker UID.
- `rankingMedals/{uid}`: permanent gold/silver/bronze totals and last certificate.

A certificate and all its winning counters commit in one transaction. Rules
require referenced normal solves, correct period/type/value, at most three
distinct winners in metric order, corresponding counter writes, and exactly one
increment of the matching color. Certificates cannot be edited/deleted. An
existing certificate cannot increment counters again. Conflicting writers retry
against the current counters; crashed workers lose their lease and another
visitor resumes partial periods. The cursor advances only after all four
certificates exist. There is no name rewriting or old-data migration.

The pure `ranking-medals.js` model, injected storage adapter
`medal-automation.js`, and read-only `medal-display.js` are separate, allowing a
future trusted server worker to replace browser finalization.

## Read/write budget and performance

One pass handles at most six periods (two per kind) and at most 1,000 queried
solve documents, paging in tens. Transaction/certificate/job reads and Rules
dependent reads are additional. A full four-metric/three-winner period normally
uses about 43 client document reads when each query returns exactly three rows,
and 18 writes; larger candidate pages and transaction retries increase reads.
No-work visits read only the three cursor documents per round (six maximum).
Cross-tab Web Locks and a local five-minute throttle reduce repeated work;
deferred work uses a one-minute throttle. These are optimizations, not security.

Profile reads one medal counter; ranking counters are batched in groups of 30
and cached five minutes. Ranking queries stop after 200 source rows per bounded
period / 1,000 for All, displaying a notice if fewer distinct players can be
verified within that budget. A catch-up scan that exhausts its budget before
proving the podium does not finalize. A pathological period with over 1,000
leading duplicate/late rows may therefore remain pending until a trusted future
worker or a reviewed budget change handles it. Many missed periods are recovered
over multiple visits, not an unlimited synchronous scan.

No continuous drawing loop, live listener, per-move work, solve write, rating
change, index change or gameplay input handler is added. Work checks gameplay
state before queries and before committing. An already in-flight SDK request
cannot be cancelled if a solve starts. Spark quotas can still be exhausted by
large legitimate traffic or malicious clients; there is no automatic upgrade.

## Security limitations (intentional client-assisted design)

Rules cannot prove a globally optimal top-three query or absence of records.
An authenticated malicious visitor may choose worse but eligible winners,
omit winners or finalize an empty period first, manipulate tie selection, or
temporarily monopolize a worker lease. Existing client-reported solve results
are not independently authenticated physical performance. Legacy records can
also make a period unverifiable. Format, membership, fixed-period bounds,
counter increments and immutability are enforced, **not full ranking integrity**.
Do not describe this as cheat-proof. Permanent totals are not retroactively
corrected by clients. A future trusted Functions implementation should deny
browser finalization and use the same certificate IDs. Private profile Rules
remain unchanged. No Admin SDK credentials are included in published assets.

## Verification

Run pure tests:

`node --test tests/medals.test.cjs tests/ranking-limits.test.cjs`

Run Emulator tests (demo project only):

`firebase emulators:exec --only firestore --project demo-stcube-medals "node --test tests/medal-rules.test.cjs"`

The fixture substitutes an earlier tracking date only in the Emulator Rules
string, to exercise real closed periods without changing the machine clock or
production data. Browser layout fixtures use synthetic counters only in the
DOM, never in production Firestore. First real automatic awards cannot be
observed before the first eligible period closes.
