# Single All medal display audit (2026-11-02)

Read-only production query and SDK checks found no missing medal decoration. Single All's first three players currently have no `rankingMedals/{uid}` document and no finalized medal-period winner event:

| Position | Player | UID | Time | Gold / Silver / Bronze |
| --- | --- | --- | --- | --- |
| 1 | Darnell | kNThLqBeZThFG3WUVppzuqaCnDF2 | 10.87 | 0 / 0 / 0 |
| 2 | Camille | pjesg5nNmbSpXJklEjYleEIXoVG2 | 12.04 | 0 / 0 / 0 |
| 3 | STcube | ZJWHeZtHNrTMlZRMcswMK2LD7Hj2 | 14.42 | 0 / 0 / 0 |

All three ARE in the prior 42-UID All recipient union; none was accidentally excluded by target membership. The private 6,602-record snapshot contains respectively 40, 636 and 56 records for them, all legacy (no schemaVersion 2). The corresponding 12, 48 and 12 period/metric combinations in the prior audit had zero fully verified results: `Unverifiable normal-solve provenance`. Missing normal-source/completion/fixed-event provenance cannot be inferred from a valid legacy ranking time. Thus their existing All records remain visible, but no historical medals can safely be guessed. The prior +32 medals were for five recipients in verifiable closed periods, not all 42 eligible recipients. All position itself never awards medals.

The existing `loadMedalTotals()` batches up to 30 UIDs, reads public `rankingMedals`, validates version/counts, caches per UID, and passes the same totals map to podiums/lists and Profile. Missing documents correctly map to zero and render no symbols. Production SDK reads succeeded for all seven currently stored medal recipients. Actual stored counts rendered correctly in Single/Ao5/TPS/Moves across All/Today/Week/Month and Profile in light/dark themes at desktop/mobile widths (64 presentation combinations). These are read-only production fetches followed by DOM fixtures, not new ranking submissions or awards.

No medal-writing logic, totals, certificates, solve documents or names were modified. The only medal-facing UI change removes Profile's outdated claim that historical results are never backfilled; only verified historical periods may be included. Tools: `tools/audit-top-medals.cjs` (bounded read-only production audit), `tools/test-medal-read.cjs` (actual SDK loader + presentation verification). Administrator credentials stay in memory and are never shipped.
