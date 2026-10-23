# Local BOT Battle

Random matchmaking searches for humans first. `BOT_FALLBACK_WAIT_MS` in
`online.js` defaults to 15000. A final widened human search precedes fallback.
The same transaction that closes the owned waiting room removes its queue
ticket. Human joins and withdrawal contend on that room: a committed human
join wins; a cancelled room cannot accept a late guest under Firestore Rules.
Generation tickets suppress cancelled asynchronous work. Web Locks serialize
same-account searches across supported browser tabs; Firestore ownership
tokens also protect searches across devices. Stale waiting tickets expire
after 90 seconds for candidate selection. Abrupt disconnect cleanup is best
effort, not a server-side presence guarantee.

BOT sessions are local and explicitly labelled BOT, difficulty and unrated.
They never submit solves, ratings, battle results, replay or normal history.
Rematching searches for humans again. Friend Battle uses its existing flow.

## Strength model and data provenance

`tools/bot-calibrate.mjs` performs a bounded **read-only** administrator query:
500 latest solve documents and at most 40 relevant user profiles. It prints
only aggregate model/report data, never UIDs or credentials. It uses the
locally authenticated Firebase CLI; no private key is shipped or required by
the browser. Run `node tools/bot-calibrate.mjs`, review the aggregate result,
and update `bot-calibration.json` deliberately before publishing.

The October 24, 2026 audit found 500 legacy solves with unknown provenance
and zero provably normal eligible solves. Those records were **not used** to
fit a distribution or a rating/time relationship. New submissions include
their source so future calibration can exclude human battles and other modes.
Existing data is not rewritten.

Until enough verified data exists, reference median seconds are Beginner 65,
Intermediate 32, Advanced 14 and Expert 7. These are not fixed time bands.
An uncalibrated rating maps to `32 * exp(-(rating-1200)/450)` seconds; this is
a heuristic, not an empirical fit. Without rating, recent valid local normal
solves supply the median; with neither, Intermediate is used. Sampling uses
bounded log-space variation (reference sigma 0.18), fixed before play starts.
It does not respond to player progress or choose a winner in advance.

Calibration uses each user's latest five eligible solves and one median per
user, with population quantiles and monotonic rating-bin medians when at
least eight eligible users exist. DNF, unknown sources, non-normal modes,
inconsistent TPS, implausible times and counts are excluded. Runtime loads
only the small static aggregate, not users' solve collections.

## Animated solution provider

`BotModel.plan` is replaceable independently of timing and UI. The initial
provider performs a verified 24-turn identity detour followed by the inverse
scramble. It prioritizes guaranteed completion and human-scale turn counts;
it is **not CFOP or a human-like solver**, and its repeated sequence can be
recognizable. Each animation's actual sticker state is checked against the
pure state engine. Completion requires an actually solved opponent snapshot.
The original random-state scramble generator is unchanged.

Target time is fixed before Ready. Weighted move slots produce varied pauses;
actual completion time is used for results. Background-tab timer throttling
or a slow device can delay completion. Pending timers and animations are
cancelled on exit, rematch, account change and page hide. The existing shared
opponent renderer is reused, with no additional continuous rendering loop.

## Firebase and remaining limits

No Cloud Functions, AI service, plan change or bot gameplay database is used.
Normal human queue creation and atomic withdrawal still use Firestore reads
and writes; after handoff, BOT moves/results generate none. Matching queries
remain limited to ten candidates. Spark quotas still apply to ordinary site
traffic. Rules add only the waiting-state guard to ranked guest admission.

Bot results are client-local practice, not a tamper-proof competitive system.
Live Google-authenticated production matchmaking is distinct from emulator
coverage. No real user's rating or solve was modified during verification.
