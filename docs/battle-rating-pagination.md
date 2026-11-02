# Ranking tabs and Battle Ratings (2026-11-02)

- Eligibility: Google profiles with `rankedBattles > 0`, including rating 1200. Friend-only and BOT matches do not increment this existing Ranked counter.
- Rating remains descending; Elo, battle history, and the existing exact profile rank count are unchanged.
- Solve Rankings and Battle Ratings are separate accessible tabs. Opening the modal defaults to Solve Rankings. Existing solve categories, periods, podium and medals remain unchanged. Arrow keys/Home/End switch the tabs.
- Battle Ratings initially displays ten experienced players, including the three podium places. Load More adds ten experienced players and ten unplayed profiles per click; Show Less restores the experienced top ten. Unplayed Google profiles at 1200 are in a separate unranked section, labelled Not played yet, so they never acquire or displace an experienced player's rank. Render-version guards discard outdated asynchronous UI responses.
- Initial queries read at most eleven experienced profiles (one lookahead), plus one unplayed profile to determine whether Load More is needed. Subsequent pages read ten per group. Five-minute caches and snapshot cursors are reused; collapsing does not fetch when cached. Medal totals are requested for visible users only.
- Server filters: `loginType == google`, `rankedBattles > 0`, `rating >= Number.MIN_SAFE_INTEGER`, order by rating descending. The inclusive numeric bound enables a rating-first multi-range query and does not remove valid Elo ratings. Firestore adds its deterministic secondary inequality/document-key ordering for equal ratings; rating is still the sole ranking score.
- Additive production composite index: collection `users`, collection scope, `loginType ASC`, `rating DESC`, `rankedBattles DESC`, `__name__ DESC`. No Rules or user-document changes. Multiple-range queries can incur index-entry reads; eligible document results are bounded, but index scans are not guaranteed to be eleven entries.

## Verification

`node --test tests/rating-display.test.cjs` covers 0/3/10/11/25 players, 1200, inexperienced exclusion, stale response protection, cache, server filters, cursors and controls.

`firebase emulators:exec --only firestore --project demo-stcube-rating-query "node --test tests/rating-query-emulator.test.cjs"` validates the authenticated filtered query against 100 inexperienced, 23 experienced (including 15 at 1200), and one guest fixture. All 23 eligible users appear exactly once across pages.

`node tools/test-rating-pagination.cjs` checks real page controls/rendering with in-memory fixtures at 1440/390/320 pixels, both themes, populations 3/10/11/23, ranks and horizontal overflow. `--public` repeats against deployed HTML/JS. Fixtures never write Firestore. It is not a real Google-account login test.

The 85-test unit suite passed. The Emulator also verifies the unplayed equality query, cursor and bounded page size. Browser checks cover tabs, keyboard navigation, default reset, expansion, unranked labels and both themes. Firebase Spark and deployment scope remain unchanged. The production unplayed query was checked read-only and works with existing indexes; no Rules or index changes are needed for this update.
