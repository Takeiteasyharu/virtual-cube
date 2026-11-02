# Historical medal catch-up (2026-11-02)

## Read-only audit

The consistent Firestore snapshot at 2026-11-02 01:48:57 UTC contains 6,602 solve documents (1,297 schema-v2 and 5,305 legacy). The earliest saved solve timestamp is 2026-06-19 02:33:07.070 UTC. No solve or ranking record is edited or deleted.

All membership follows the existing UI exactly: Single 22, Ao5 17, TPS 19, Moves 39, deduplicated union **42**. Its existing 50-player/1,000-scanned-document limits are preserved. Membership is rechecked before manifest publication; changes stop publication and require a new audit.

Closed period labels observed: 109 days, 20 ISO weeks, 5 UTC months. Winners are verifiable for six days (October 26, 27, 28, 30, 31 and November 1) and one week (2026-W44). No monthly winners can be safely reconstructed. At least one category is unverifiable for 93 daily, 18 weekly and all five monthly periods; ten other daily periods and one weekly period have no eligible on-time winners. Missing-calendar/no-record periods produce no awards.

The twelve existing certificates (October 30/31 and November 1, four metrics each) match recomputation and their stored counters. No erroneous award was identified or removed.

New verified events: October 26–28 × four metrics, plus 2026-W44 × four metrics: **16 canonical event IDs**. Expected additions: **gold 16, silver 12, bronze 4**, across **five** current All members. Rankings are calculated over everyone before restricting recipients to the audited All membership; an ineligible podium place is never promoted to a different color.

Older records lacking immutable normal-solve provenance are not guessed. Existing browser rankings may display legacy records, but that does not prove they were normal, completed, unaided solves. The full audit/rejection details and raw snapshots remain under `.private-medal-backups/`, ignored by Git and excluded by the Pages allowlist.

## Implementation and security

`medal-history.js` separates All selection, offline reconstruction, and bounded browser transactions. A read-only `rankingMedalBackfillPlans/{id}` pins audited event sources/values/ranks and eligible recipients; `rankingMedalConfig/history` points to the plan. Only administrator publication can create these manifests; no secrets are exposed. The preparation command publishes a manifest/config, **not medal counters**.

Browsers use `rankingMedalBackfillProgress/{id}` to resume at the next event and atomically create the usual `rankingMedalPeriods/{kind_period_metric}` certificate, increment only the eligible original podium places in `rankingMedals/{uid}`, and advance progress. Certificate IDs are shared with regular browser awarding, preventing both paths from adding the same event. Historical certificates retain the complete podium plus an `awardedUids` mask. The audit utility understands this mask. Certificates cannot be updated/deleted. Existing medals remain unchanged except for exact permitted increments.

One idle page visit processes at most two events, outside gameplay. A competing browser can safely defer after discovering a committed cursor advance. Completed plans cost only config/progress reads at the existing throttled visit interval; historical solve records are never rescanned in visitors' browsers. Per pending visit: at most ~13 application document reads and 10 writes, excluding Rules dependency reads/retries. This 16-event backfill uses 32 counter writes, 16 certificate writes and 16 progress writes, plus two manifest/config creations. Spark is retained; no Functions, scheduler or new database is added.

Global ranking authenticity for ordinary client-assisted awards remains the pre-existing limitation. Historical awards are further constrained to the administrator-published audited manifest; Rules intentionally do not repeat the 6,602-record global ranking scan. Administrator access and completeness of the surviving archive remain trust assumptions. Unknown/deleted historical data cannot be recovered by this implementation.

## Commands and tests

- Read-only snapshot: `node tools/audit-medal-history.cjs` (25,000-document safety budget).
- Offline dry-run: `node tools/prepare-medal-history.cjs --snapshot <private snapshot>`.
- After tests/Rules: same preparation command with `--apply` backs up latest medal state and publishes only the immutable verified manifest/config. A changed All membership or conflicting existing manifest stops without writing.
- `tests/medal-history.test.cjs`: eight model/cache/idle integration tests.
- `tests/medal-history-rules.test.cjs`: historical recipients, valid three-player atomic writes, concurrent visitors/retries, malicious writes, immutable manifests, and progress bounds.
- Combined Emulator regression: 54 tests including regular medals, normal profiles/statistics, battles/Elo and Daily.
- `tools/test-medal-history-snapshot.cjs <private snapshot>`: the actual audited 16 events under three concurrent Emulator clients produce exactly 16/12/4; rerun adds zero.

Backups, credentials, raw snapshots and generated plans are never copied to the deployment checkout or Pages artifact. Production outcome is reported after deployment and a read-only ledger verification.
