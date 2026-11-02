# Battle Rating ranking (2026-11-02)

- Eligibility: Google profiles with `rankedBattles > 0`, including rating 1200. Friend-only and BOT matches do not increment this existing Ranked counter.
- Rating remains descending; Elo, battle history, and the existing exact profile rank count are unchanged.
- Initially display ten players, including the three podium places. Load More adds ten; Show Less and reopening restore ten. Render-version guards discard outdated asynchronous UI responses.
- Initial query reads at most eleven eligible profiles (one lookahead). Subsequent pages read ten. Five-minute cache and snapshot cursors are reused; collapsing does not fetch when cached. Medal totals are requested for visible users only.
- Server filters: `loginType == google`, `rankedBattles > 0`, `rating >= Number.MIN_SAFE_INTEGER`, order by rating descending. The inclusive numeric bound enables a rating-first multi-range query and does not remove valid Elo ratings. Firestore adds its deterministic secondary inequality/document-key ordering for equal ratings; rating is still the sole ranking score.
- Additive production composite index: collection `users`, collection scope, `loginType ASC`, `rating DESC`, `rankedBattles DESC`, `__name__ DESC`. No Rules or user-document changes. Multiple-range queries can incur index-entry reads; eligible document results are bounded, but index scans are not guaranteed to be eleven entries.

## Verification

`node --test tests/rating-display.test.cjs` covers 0/3/10/11/25 players, 1200, inexperienced exclusion, stale response protection, cache, server filters, cursors and controls.

`firebase emulators:exec --only firestore --project demo-stcube-rating-query "node --test tests/rating-query-emulator.test.cjs"` validates the authenticated filtered query against 100 inexperienced, 23 experienced (including 15 at 1200), and one guest fixture. All 23 eligible users appear exactly once across pages.

`node tools/test-rating-pagination.cjs` checks real page controls/rendering with in-memory fixtures at 1440/390/320 pixels, both themes, populations 3/10/11/23, ranks and horizontal overflow. `--public` repeats against deployed HTML/JS. Fixtures never write Firestore. It is not a real Google-account login test.

The existing 82-test unit suite passed. Firebase Spark and deployment scope remain unchanged.
