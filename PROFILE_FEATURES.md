# Profile and achievements (stage two)

The existing Profile button opens five English sections: Player Overview, Solve
Statistics, Battle Statistics, Activity & Streaks, Achievements. Game geometry,
key bindings, timer mechanics, rating formula and normal ranking formats remain
unchanged. No Functions or paid service is added.

## Canonical data and coverage

Stage-one `users/UID/profileStats/current` remains unchanged and authoritative for
normal virtual counts/PB/TPS sum and separated human Ranked/Friend outcomes.
Legacy `users` solve totals are NOT used for badges or substituted for missing
canonical statistics. Real Cube history is shown separately as this device's
bounded local history, not a lifetime account total.

`users/UID/profileStats/details` holds enhanced tracking start, last normal solve,
observed best TPS, a bounded newest-first list of twelve normal times, UTC activity
counts/streaks and a fixed eleven-entry badge timestamp map. It is owner-readable.
Ao5/Ao12 are calculated from the validated twelve-time list when displayed,
discarding one minimum and maximum. No redundant average caches, whole-history
queries or per-badge documents are needed. This also keeps Rules evaluation below
the expression limit. Extra rolling tracking starts with new events; old arrays
or unknown lifetime values are never invented.

`users/UID/activityDays/EPOCH_DAY` is immutable and owner-readable. The numeric
document ID represents a UTC calendar date (floor of epoch milliseconds / day).
Rules bind it to `request.time.date()`, not an arbitrary client date. It stores
the first confirmed normal/human result event of the day. The existing record,
event, current summary, details and optional first-day document commit atomically.
Repeated events return before writing. Distinct events on one day share the day
document; transaction conflicts re-read it. New day adjacency increments a streak;
a gap resets it. On viewing, yesterday's streak remains current until today ends;
after a full missed day it displays zero. Offline queued solves count on their
server-confirmed UTC receipt day, not a backdated client day.

Version-one clients remain accepted for compatibility. A missed feature event
(details.lastEventId != previous current.lastEventId) marks enhanced coverage
incomplete and clears rolling history rather than claiming an exact streak or
guessing missing times. Known active days and confirmed unlocks are retained.

## Badges

First Solve / 100 Solves / 1,000 Solves use canonical normal counts. Sub-30,
Sub-20, Sub-10 use strict PB thresholds. First Win / 10 Wins / 100 Wins use human
Ranked wins, never Friend or BOT wins. 7-Day / 30-Day use the longest confirmed
UTC activity streak. Unlocks never expire. A threshold newly crossed by a feature
event stores server time. A threshold already met in stage-one data is displayed
as unlocked with unknown unlock date; no fictional historical timestamp is added.
Unknown history and locked-in-tracked-records are visually and textually distinct.

## Ratings and ranks

The existing Elo transaction also stores protected public `ratingPeakObserved`
and `ratingPeakTrackingStartedAt` fields for each participant. This is the maximum
observed before/after rating since this tracking began, not a lifetime peak. Win
streaks remain explicitly Not tracked: delayed/out-of-order result arrival cannot
prove a full chronological streak without additional history processing.

Battle rank uses a server count of Google profiles with rankedBattles > 0 and
rating strictly above the player's rating. Competition ties share rank. Add-only
`node tools/profile-index.mjs --ensure` creates the necessary users composite
index (loginType ASC, rankedBattles ASC, rating ASC) without touching existing
indexes. The tool uses administrator CLI credentials only in process memory and
is never included in Pages artifacts.

New normal transactions publish protected `users.normalSinglePbMs` alongside the
canonical summary. Single PB Rank is explicitly scoped to tracked profiles with
published normal PBs; earlier unpublished profiles are not claimed to be included.
It counts user documents, never repeated solve documents. Ties share rank. Missing
public PB, missing index, permission or network errors show Not published yet or
Unavailable, never an estimate. Rank checks are cached for up to one minute.

## Reads / writes and security

Each accepted normal/human result adds two reads (details + today's day), one
details write, plus one day write only on the first accepted event of that UTC
day. Badge changes are included in that details write. Peak ratings/public PB
fields ride existing user writes and add no document writes. Profile opening
reads three documents (user/current/details); rank queries consume index-entry
reads and are not assumed free. No new realtime listeners or full history scans.

Rules validate exact counter/list/badge map transitions against the fixed new
event. Details/day writes cannot stand alone, be rewritten or forged for another
UID/date. Protected public PB/peak fields cannot be changed through the broad
legacy user update path. Client-reported solve truth is still not guaranteed.
Historical legacy data is neither deleted nor bulk migrated. Rules/indexes must
be published and validated before the new GitHub Pages client. SW cache v129.

## Verification

Pure tests exercise all eleven badges, strict thresholds, missing data, bounded
averages, UTC rollover, idle-day expiry and legacy recording gaps. Emulator tests
cover atomic writes, deduplication, same-day competing devices, threshold unlocks,
Guest permissions, protected fields, private data, real Friend rooms, Elo peaks,
exact rank counting, and existing Daily rules. Browser tests use explicitly
synthetic Google/Guest/empty UI fixtures at 1440/768/390/320px in both themes and
check unchanged cube geometry. Production smoke tests remain signed out, with no
fake ranking or battle results created; interactive Google OAuth and a live
two-account human match are not falsely reported as tested.
