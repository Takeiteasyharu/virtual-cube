# Guest authentication and account migration

The site remains playable without authentication. Anonymous Firebase Authentication
is only requested by Guest Login. Authentication uses browser-local persistence.
Clearing browser data may make an anonymous account inaccessible.

## Ownership and recovery

- Linking an unused Google identity keeps the anonymous UID.
- Linking an existing Google identity signs into a separate Firebase app first.
  The user sees a preview and confirms before the Guest offers a transfer and the
  Google account accepts it. The Google UID, name, rating and existing data remain.
- Private `accountLinks/{guestUid}` documents require the authenticated anonymous
  source to create the offer and the authenticated selected Google target to accept.
  Other users cannot read these links. No administrator credentials are shipped.
- If interrupted after offering, log out and sign into the selected Google account.
  A new confirmation can resume the saved offer. Accepted transfers resume using
  document-ID cursors. The Resume Merge button also retries synchronization.
- Source solves and medal totals are retained. Accepted sources stop creating new
  online solves so the paginated snapshot cannot move. On completion, a public
  `rankingRetirements` flag hides the source in live rankings; this flag exposes no
  destination UID. Source rating/statistics are not added to Google rating.

## Records

`solveImportClaims/{stableSolveId}` is an immutable ownership/deduplication receipt.
The normal solve queue and history importer exclude each other's IDs. Imported
ranking rows use `solves/import_{id}_{single|ao5}`, schema version 3. Linked cloud
rows derive stable IDs from the original document ID and prove the original row
in Rules. Other accounts' local ownership labels alone do not authorize transfer.

Unowned shared-device history requires a separate confirmation. Declining retains
it locally without uploading. Local history remains limited to the existing 100
rows; the pending queue is retained on failure. Missing/unparseable dates, excluded
play modes, invalid times and foreign-owned rows are not guessed or imported.

`solvedAt` preserves the stored ISO solve date; UTC ranking keys use that date.
`createdAt` remains the server receipt time. Late uploads cannot rewrite closed
medal periods. For old cloud rows without `solvedAt`, only the existing recorded
`createdAt` is available; a more precise historical solve date cannot be recovered.

Imports do not re-add legacy lifetime statistics, activity or badges. Existing
private statistics remain in their original accounts; the new imported ranking
history is separate from the profile's tracked normal-event aggregates.

## Medals

`users/{googleUid}/medalImports/{awardEventId}` proves each transferred award.
Period award identities include the original recipient; distinct legitimate awards
earned by both accounts are retained. Special awards use their existing event IDs.
Receipt creation and the target counter increment are one transaction. Original
source totals stay unchanged. Public display still shows at most one of each color.
Future periods use the imported Google row instead of a retired source. Periods
closed before retirement retain the original certificate and can transfer later.

## Cost and limitations

- No Functions, billing-plan change or new real-time listeners.
- Normal queue writes add one import-receipt read for cross-path deduplication.
- A local import normally reads its claim, ranking row and optional existing normal
  row, then writes one receipt plus Single and optional Ao5. Rules reads are extra.
- A cloud merge handles at most 30 source rows per page and 10 pages per visit.
  Medal scans are checkpointed, skipped for zero totals, and bounded to 300
  certificates per pass. Completed scans are reused until source totals change.
- Client-reported local solves are not cheat-proof. Rules protect identity,
  immutable receipts, source-copy fields and counter increments, not physical play.
- Exact rank queries fail closed to `Unavailable` if a required index is absent.
- Real Google OAuth consent/popups are not substituted by Emulator test identities.
  A production merge is not run against real accounts as a deployment smoke test.

## Local verification

Use the Firebase CLI with `demo-` project IDs and the local Emulator only:

```text
firebase emulators:exec --only firestore --project demo-stcube-account-merge "node --test tests/account-migration-rules.test.cjs"
firebase emulators:exec --config firebase.auth-test.json --only auth,firestore --project demo-stcube-auth-browser "node tools/test-auth-browser.cjs"
node --test tests/history-sync.test.cjs
```

The browser fixture rewrites Firebase configuration to the demo project, connects
Auth and Firestore to localhost, and disables background medal work. Its screenshots
are local ignored artifacts under `.auth-verification/`.
