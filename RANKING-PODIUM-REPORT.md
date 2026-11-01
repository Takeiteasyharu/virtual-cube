# Ranking medals audit and podium redesign — 2026-11-01

## Root cause and production data

A bounded, read-only audit found eight finalized certificates:

| UTC period | Single | Ao5 | TPS | Moves |
| --- | --- | --- | --- | --- |
| 2026-10-30 (Today) | finalized | finalized | finalized | finalized |
| 2026-10-31 (Today) | finalized | finalized | finalized | finalized |

Waisal Qornih appears first in all eight certificates. His ledger-derived
gold=8/silver=0/bronze=0 exactly matches the stored counter. Luca Castellari's
eight second-place events likewise match silver=8. No duplicate certificate IDs
or counter mismatches were found in the audited production collections. These
are **two days × four categories**, not eight awards for one Single result.
There is no justified medal deletion or correction to perform. No production
medal, certificate, solve, profile or username was changed by this audit.

`tools/audit-medals.cjs` uses the local Firebase CLI session only for read-only
REST access. Tokens stay in memory; no credentials are printed or published.
It refuses to infer totals if a collection exceeds its 100-document bounded
audit. It is not part of the static-site publish allowlist. This is a ledger
consistency check, not independent proof that each global podium was honest.

## Award identity and safety

`RankingMedals.awardId(kind, key, metric)` now centralizes the existing,
backwards-compatible key, e.g. `today_2026-11-01_single`. There is no migration
or reset. Each winner receives exactly one increment in a certificate
transaction. Duplicate recipient UIDs are rejected before any transaction.
Display limits, query page size, listener callbacks and medal rendering do not
affect increment amounts. Rendering and opening the ranking do not call award
transactions. Existing server Rules and immutable certificates continue to
protect against replay and concurrent counter updates.

The client-assisted security limitations documented in MEDALS.md remain:
Rules cannot prove a browser chose the global best three or prove an empty
result. This update does not claim stronger anti-cheat guarantees.

## UI

The unused text formatter that produced `#1 ... Single - name` was removed.
Main results and Battle Rating now use a shared, presentation-only renderer.
The normal ordered-list marker is disabled and each rank appears exactly once.
Category/period appear in a heading, not in every row. Records have a separate
column. Medals remain repeated after the name; explanatory text identifies
them as career totals across all categories/periods, not this result's award.

The first three appear only on the podium, never again in the lower list:
gold center with crown and tallest step, silver left, bronze right. Fourth
and later places use compact, aligned rows. Missing podium entrants do not
produce invented players. New/unranked Battle Rating users stay in their own
list, not on the competitive podium. Existing rating pagination and ranking
queries, sorting, UTC periods and 50/10 limits are preserved.

Materials use the existing Toy Room tokens in both themes. Cards use a
220ms one-shot entrance, disabled for reduced motion. Long names and full
medal strings wrap inside vertically scrollable name regions rather than
forcing horizontal overflow or truncating stored/displayed names.

## Cost and compatibility

The UI renderer performs no Firestore reads/writes and registers no listeners.
Existing batched medal counter reads and five-minute caches are reused.
Battle Rating now reuses that same cache for its visible names, with at most
one counter per newly displayed UID (queries batched in groups of 30).
No extra per-solve/per-move work, new indexes, new data model, Functions or
plan change is introduced. Rules require no changes; production Rules are
compared read-only with the validated local source before publishing.

## Tests

- 71 pure/model/regression tests: passed.
- 17 medal Emulator tests: passed, including one Single award=one medal,
  ten reopens=no increment, separate Ao5 award=one more, valid eight-event
  accumulation, concurrent same/different periods, lease recovery, counter
  forgery rejection and immutable certificates.
- Browser podium fixtures: 1440/1024/390/320px × two themes × six entrant
  counts = 48 combinations; no horizontal overflow, duplicate ranks or
  JavaScript errors. Full 350-medal strings and long names are retained.
- Screenshots: `.medal-verification/local-podium-*-*.png`.
- Layout fixtures throttle the production worker so synthetic DOM data never
  triggers production award processing. No fake production records are used.

## Changed files

- `ranking-view.js`, `ranking-view.css`: independent podium/list rendering.
- `online.js`, `index.html`: ranking integration and career-medal explanation.
- `ranking-medals.js`, `medal-automation.js`: centralized identity and guard.
- `service-worker.js`, `.github/workflows/pages.yml`: v137 and asset publishing.
- `tests/ranking-view.test.cjs`, `tests/medals.test.cjs`,
  `tests/medal-rules.test.cjs`, `tests/rating-display.test.cjs`: regressions.
- `tools/audit-medals.cjs`, `tools/test-ranking-ui.cjs`,
  `tools/test-toy-room.cjs`: read-only audit and safe browser fixtures.
- This report.

## Unverified / limitations

Google popup authentication and a real two-human battle are not re-exercised
in this UI-only change; their handlers and Rules are unchanged. The historical
ledger audit does not establish physical solve authenticity. No new Week or
Month award is fabricated just to test production; those periods are exercised
in the Emulator. Existing bounded catch-up/query-budget limitations still apply.
