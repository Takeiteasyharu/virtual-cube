# One-time inaugural All awards

Snapshot: **2026-11-02T04:34:07.460429Z**. Award ID: `all-inaugural-v1`.
Fingerprint: `894dbd743afbc5b934eceeacd5eaa467c729d9c960fb7e288511516edfc5f7ce`.

| Metric | Gold | Silver | Bronze |
| --- | --- | --- | --- |
| Single | Darnell · 10.87 s | Camille · 12.04 s | STcube · 14.42 s |
| Ao5 | Darnell · 11.79 s | ああ · 15.05 s | Camille · 16.41 s |
| Moves | m1stzy · 42 | Camille · 44 | isal · 44 |
| TPS | Darnell · 5.89 | Camille · 5.51 | koukou · 5.23 |

Twelve awards, seven distinct UIDs. Darnell receives three gold medals; Camille receives three silver and one bronze. Equal Moves scores follow the existing Firestore query/document-ID ordering, not a new tie policy. The production UI's own `getRankingEntries()` confirmed all twelve frozen UID/rank/value tuples. Legacy solves are explicitly eligible for this special snapshot only.

The administrator CLI snapshots all four queries at the same readTime, using the same filters, metric ordering, UID deduplication and 1,000-record safety budget as the current All UI. The immutable local plan and recipient backups are under `.private-medal-backups/special-2026-11-02T04-34-07-460429Z/` (ignored by Git and excluded from Pages). Before applying, another backup captures all existing medal documents, current recipient totals and any existing special root. OAuth credentials remain in memory from the existing Firebase CLI session; no private key, token or administrator runtime is published.

One administrator Firestore transaction reads the root, twelve unique event documents and seven totals. It writes twenty documents atomically: the complete snapshot root, twelve event receipts and seven exact accumulated totals. Root: `rankingSpecialAwards/all-inaugural-v1`; events: `events/all-inaugural-v1_{metric}_{rank}`. Existing `rankingMedals/{uid}` v1 totals and names are reused without resetting prior counts. An existing matching complete root returns zero additions; a conflicting snapshot or orphan event stops without writing. Regular Today/Week/Month certificates, jobs, solves and users are untouched. Browser Rules allow public reading but deny all client writes/deletes of special roots/events. No recurring All automation is added.

Commands (administrator PC, original frozen snapshot required):

```powershell
node tools/special-award.cjs verify .private-medal-backups/special-2026-11-02T04-34-07-460429Z/snapshot.json
# Idempotent re-run; returns added: 0 once the inaugural award is complete:
node tools/special-award.cjs apply .private-medal-backups/special-2026-11-02T04-34-07-460429Z/snapshot.json
```

`tests/special-award.test.cjs` runs only in Emulator: exact production candidates, three concurrent SDK transactions, preserved counts/names, re-run zero, conflicting-plan rejection, the actual REST transaction adapter and prohibited client writes. Production SDK/browser presentation is checked with `tools/test-medal-read.cjs`. Ledger audits now distinguish special awards from regular period awards. Spark and existing game/rating behavior are unchanged; no Functions, recurring queries or writes are introduced by this one-time procedure.

## Production outcome (2026-11-04)

The original November 2 snapshot was retained; no recipients were reselected during the interrupted deployment. The tested read-only special-event Rules were released to `virtual-cube-timer`. Immediately before applying, all ten existing medal documents plus the seven recipient states were backed up locally. The administrator transaction committed exactly twelve additions for seven recipients (four gold, four silver, four bronze). A second execution returned **added: 0**. Read-only verification confirmed all twelve event receipts and all ten pre-existing recipients' counts preserved exactly. User names, solve records, period certificates and regular browser award processing were not modified.

Revalidation: **100 unit tests**, **61 Emulator tests** passed, including the actual frozen candidates and production REST adapter. Read-only production SDK fetching and light/dark presentation checks passed at 1440px and 390px: 32 metric/period/theme combinations at each width, with every stored recipient's Profile medal display verified. No JavaScript errors occurred. The profile explanation now mentions the one-time inaugural exception; SW v147 refreshes the client files. Public deployment status is reported separately after the Pages workflow completes.
