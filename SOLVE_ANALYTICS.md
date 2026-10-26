# Solve Analytics

## Data boundaries

Analytics reads only `virtualCubeSolveHistory` on demand. That existing key
stores newest-first local records and retains at most 100. It is not an
account-specific or synchronized collection. Analytics neither fetches the
`solves` collection nor reads `profileStats` documents. All Available means
the eligible records actually retained in this browser, never lifetime data.

Existing records contain time, stored TPS, normalized moveCount, notation,
scramble, virtual/real mode and a locale-formatted date; newer ones have a
solveId. The dedicated virtual history's legacy normal format is accepted,
but explicit non-normal sources, practice/battle/aid flags, real mode and
aborts are excluded. Legacy entries have no reliable owner metadata. Their
original date text is displayed without guessing a locale/time zone. Missing
times/metrics are not synthesized. Older cleared/capped records and historical
source metadata cannot be recovered. Client-local histories are not trusted
competitive evidence and can be edited with developer tools.

New saves add `source: normal`, `ownerUid` and ISO `completedAt` to the existing
record, with no second history store. Owner identity is captured at solve
start, including anonymous Firebase Guest UIDs; signed-out records and solves
whose identity changes before completion have null ownership. A logged-in Google/Guest identity defaults Analytics to identified
records for that UID only. Shared device history is explicitly labelled and
must not be interpreted as that person's cloud data. Old records are not
assigned to whoever signs in next. Changing identity closes an open Analytics
view. Existing history, PB, ranking and profile transactions remain unchanged.

Cloud `solves` uses source/mode, UID, rankingType, valid/completed flags,
server createdAt, time, TPS, moveCount and scramble; new normal records use
fixed IDs. `profileStats/current` has tracked cumulative normal/battle
aggregates; `details` has bounded recent times, best TPS, activity and badge
data. Neither can reconstruct a complete historical chart, so they are not
mixed with local figures. No migration or cloud synchronization is added.

## Calculation

Retained records are reversed to chronological solve order, not sorted by a
guessed timestamp. Last 10/50/100 select the tail of the chosen account/device
scope. Overview Total includes retained DNF records; averages and PB exclude
DNF, and metric averages exclude missing values. Average TPS is the arithmetic
mean of stored TPS, not total moves divided by total elapsed time. Moves use
the existing normalized moveCount, not the length of raw notation history.

Ao5/Ao12 use contiguous retained windows, dropping exactly one fastest and
one slowest value. One DNF is dropped as the worst; two make the average DNF.
Too-short windows are gaps. Windows can include older retained records before
the selected display range. The existing normal timer does not save aborted
solves as DNFs; Analytics does not invent them, but supports explicit DNF
history records if present.

PB History scans the available scoped history before filtering its updates
to the display range. Ties are not new PBs. The first retained result has an
unknown earlier PB, not a claimed lifetime first solve. New dates are ISO;
old dates remain exactly as stored.

Time charts auto-focus only when at least eight finite values contain a severe
outlier (over 10 times the median and beyond Q3 + 6 IQR), with at least 75% of
values in the typical band. Off-scale values remain selectable as triangles;
the notice provides a review button and a Full range switch. This is display
zoom only: no times, overview statistics or rolling averages are changed.
Large axis labels use k/M units to avoid clipping. A long legacy record is not
assumed to be milliseconds or corrupt; its true origin needs the saved record.

## Replay and performance

Replay still stores one verified solve under `stcubeSolveReplayV1` (v1), with
notation/timing triples, packed 54-sticker initial state, scramble/preparation,
official final milliseconds, normalized count and TPS. Optional solveId and
ownerUid now associate it with exactly one history record. Analytics requires
matching ID, owner, scramble, time and count; older recordings without an ID
are not fuzzily linked. Replay validates its transform/timing data again when
opened. Its own 3D cube remains separate from the live play cube.

Charts use native SVG with at most 100 records. No external chart library,
animation loop, Firebase listener or network request is added. Analytics
listeners use an AbortController per opening; closing aborts them, clears
chart DOM and releases the model. A solve selector and keyboard arrows give
an alternative to tapping densely spaced points. Text is inserted with
textContent, including user-editable history/scramble strings.

## Verification

`node --test tests/solve-analytics.test.cjs` tests actual timer-average parity,
DNF, retention/ranges, missing fields, mode/account isolation, PB chronology
and strict Replay matching. `node tools/test-analytics-browser.cjs` uses local
fixtures at 1440/390/320px and a real local solve-to-Replay flow. `--public`
runs signed-out production checks without writing test cloud records.
The browser helper uses the workstation's installed bundled Playwright/Edge.
