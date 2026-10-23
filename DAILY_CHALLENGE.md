# Daily Challenge (Spark)

## Operations

No Functions, Scheduler, Storage bucket, billing change, service-account key,
or administrator credential is shipped to the website. GitHub Pages uses an
explicit static-file allowlist. `tools/`, tests, package files and Rules are not
included in the Pages artifact. The existing Firebase Authentication instance
is reused; accounts are never created by the daily module.

On the authorized administrator PC (Node 24+, Firebase CLI):

```powershell
npm ci
firebase login
npm run daily:seed
```

The last command creates today (UTC) plus the next 29 days using cubing's random
state 333 generator. It verifies each algorithm followed by its inverse with
KPuzzle. Each date is fetched first and created using a create-only REST POST;
HTTP 409 also preserves a concurrently created day. Existing days are never
modified. Repeat the command periodically, or select a range:

```powershell
node tools/daily-seed.mjs --project virtual-cube-timer --start 2026-11-01 --days 30
```

The tool refreshes the local Firebase CLI OAuth session and uses its access
token only in process memory. CLI credentials remain outside this repository.
IAM-authorized OAuth requests bypass client Security Rules; ordinary Firebase
Auth users cannot write challenge documents. There is no client-side admin flag.
Optional `DAILY_ADMIN_ACCESS_TOKEN` must be provided out of band, never committed.

Missing or inaccessible dates fail closed: no locally generated replacement is
used. Future-day client reads are denied until `opensAt`; past dates remain
readable. The UI hides today's scramble until Start consumes the first attempt,
or a guest explicitly starts Practice. Direct readers of the public day document
can still discover today's scramble before attempting.

## Data / integrity

`dailyChallenges/YYYY-MM-DD`: `date`, `scramble`, `opensAt`, `closesAt`, `version`.
`.../attempts/UID`: private owner-only attempt with immutable `uid`, `date`,
`operationId`, `name`, server `startedAt`; status started/completed/dnf.
`.../results/UID`: public immutable copy of a completed attempt only.

Start consumes the first attempt with a transaction. Client Rules independently
prevent deletion, replacement, other-user writes and metadata changes. A Google
Firebase sign-in provider is required. Completion atomically changes started to
completed and creates an identical public result; Rules require both together.
Finalized attempts cannot change. Results are not created for DNF or Practice.
Receipt deadline is the earlier of start + 10 minutes and the day's UTC close.
Rules compare Firebase `request.time`; device clock changes cannot extend it.
Started attempts past this deadline display as DNF without a scheduled write.
Reload never resumes a ranked attempt in the regular UI. An explicit Abort
attempts to write terminal DNF immediately. Closing the browser needs no write
to keep the attempt consumed.

Start only arms the live cube after a server read confirms the transaction.
An uncertain start can be retried in the same page using the same operation ID.
A reload loses this retry context and exposes Practice only. Completion retries
are idempotent and never overwrite a different/finalized result. Offline or late
submissions can become DNF; no local fallback restores an attempt.

## Ranking / quotas

Single-field `timeMs` ascending plus document ID suffices; no new composite index
is required and no existing index is changed. Fetch 25 results at a time with a
cursor, not realtime listeners. Ties use competition ranks (1, 1, 3). Own rank is
an indexed count of strictly faster results + 1. Public results can be queried
directly; Rules do not provide a general per-user query-rate limit. Quota abuse
remains possible. Results duplicate the attempt to keep private unfinished
attempts out of public ranking queries. A completed first attempt costs three
document writes (start, attempt completion, public result), plus transaction and
Rules reads. Refresh/pagination/count queries consume the existing shared Spark
quota. The countdown uses no periodic Firestore writes or listeners. Check the
Firestore Usage console and replenish dates before they run out. Retention and
abuse removal are manual administrator operations; do not enable paid TTL.

## Play separation

Daily reuses the existing virtual cube, inspection, custom keyboard map and
verified completion callback. The timer's dedicated daily completion branch
does not call saveSolve, submitOnlineSolve, submitBattleSolve or Replay finish.
Guided Solve, Replay and Battle entry are disabled for the daily session.
Exit resets the cube and timer to a clean normal state without saving a solve.
The saved Guided preference is preserved and battle data/rules are unchanged.

## Limits / honesty

Times are client-reported, not server-verified solves. Rules constrain fields,
TPS consistency, elapsed receipt time and state transitions, but cannot prove a
physical solve or prevent external solvers, plausible fake times, multiple
Google accounts, early public-data reads, or modified-client assistance. Rules
cannot detect an actual browser close: a modified client could submit an old
started attempt before its deadline. Regular UI treats reload as DNF. Do not
advertise this as cheat-proof or as a server-validated competitive ranking.

## Tests / deployment

```powershell
npm run test:daily
firebase emulators:exec --only firestore --project demo-stcube-daily "node --test tests/daily-rules.test.cjs tests/daily-seed.test.cjs"
firebase emulators:exec --only firestore --project demo-stcube-daily "node .daily-browser.cjs"
```

The browser harness uses synthetic Google/Guest identities exclusively against
the demo Firestore emulator, never production Auth. It tests desktop/mobile,
normal-record isolation, ranking, pagination/ties, reload, Abort and UTC rollover.
Production smoke tests should use public reads and Practice without generating
fake leaderboard entries.

Apply only the Firestore Rules to the existing project after confirming the live
baseline has not changed, then run `npm run daily:seed`. The original ruleset
before Daily was `bb8a7dd3-d3ad-4f22-ab72-c7af2720cf3e`. Existing rule text is
preserved; Daily adds only its paths and helper functions. Static publication
continues via the existing GitHub Pages workflow, including daily-challenge.js.
