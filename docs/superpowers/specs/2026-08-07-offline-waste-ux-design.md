# Offline Waste UX Design

**Goal:** Protect waste-entry work through refresh, crash, and network loss; reduce photo upload cost; queue submissions while offline without changing server business rules.

## Scope

Apply the feature to both waste-entry flows:

- Auto/manual waste form in `src/pages/auto-waste.tsx`
- Paste waste form in `src/pages/paste-waste.tsx`

Deliver in three stages:

1. IndexedDB draft persistence
2. Client-side photo compression
3. Offline submission queue

API-key behavior, server schemas, PDF generation, dashboard behavior, and broad PWA shell caching are outside this scope.

## Storage Architecture

Use native IndexedDB with one small shared utility and no new dependency. The database contains separate stores for drafts and queued submissions.

Draft keys combine authenticated user ID and form type, preventing drafts from leaking between accounts or entry flows. Each record stores form values, compressed photo Blobs, schema version, and `updatedAt`. Drafts older than seven days are deleted during database initialization and draft reads.

Queued submissions store the complete server payload plus compressed photo Blobs, queue state, attempt count, timestamps, and the authenticated user ID. JWTs and passwords are never persisted in IndexedDB.

Database failures must not block normal online form use. The UI reports that local protection is unavailable while retaining the current submission path.

## Draft Lifecycle

Each form restores its matching draft automatically after authentication and initial form setup. Restoration must not overwrite values the user entered while asynchronous data was loading. A short, dismissible status indicates that a draft was restored.

Changes are saved after a short debounce rather than on every keystroke. Saves include all user-entered values needed to reconstruct the form and the compressed photo Blobs. Object URLs are recreated when restoring photos and revoked when replaced or when the component unmounts.

A draft is deleted only after its submission succeeds or receives the terminal duplicate response described below. Users can also explicitly clear the form and its draft. Navigating away, refreshing, closing the browser, losing connectivity, or receiving a retryable server error preserves it.

## Photo Compression

Compress selected photos before storing or uploading them:

- Correct orientation through browser image decoding
- Preserve aspect ratio
- Maximum width or height: 1600 pixels
- Output: WebP at quality `0.8`
- Maximum accepted compressed size: 3 MB per photo

Use browser-native `createImageBitmap`, canvas, and `canvas.toBlob`; fall back to an HTML image element when required. Reject unsupported or undecodable files with a visible field error. If WebP encoding is unavailable, use JPEG at equivalent quality and retain the 3 MB limit.

Compression happens once at file selection. The resulting Blob is reused for preview, IndexedDB, queueing, and upload. This avoids repeated processing and ensures queued data matches the visible draft.

## Submission Queue

When the user submits while offline, validate the form locally first. Valid data is converted into one immutable queue item, persisted transactionally, and shown as queued. The active form remains recoverable until that queue item reaches a terminal state.

Synchronization runs:

- When a queue item is created while online
- On the browser `online` event
- After successful login/session restoration
- When the user presses Retry

Process queue items FIFO, one at a time, using the existing upload and submission endpoints. Upload compressed photos first, replace local photo references with returned proxy URLs, then submit the waste payload. Persist upload progress so a retry does not upload already-completed photos again.

Do not depend on Background Sync because browser support is inconsistent. Sync runs while the application is open. Closing the application preserves queued work for the next launch.

## Queue States and Errors

Queue states are `queued`, `syncing`, `auth-required`, `retryable-failure`, `duplicate`, and `completed`.

- Network failure, timeout, HTTP `408`, `429`, or `5xx`: return to retryable state and increment attempts.
- After three failed automatic attempts: stop automatic retries and expose Retry.
- HTTP `401` or `403`: move to `auth-required`, prompt login, then automatically resume using the new in-memory JWT.
- HTTP `409` duplicate station/date/shift: mark `duplicate`, display “Data sudah ada di server”, stop retrying, and clear the matching draft.
- Other `4xx`: mark retryable-failure with the server message; require manual correction or retry rather than silently discarding data.
- Successful submission: mark completed, clear the matching draft, then remove the completed queue record after its success status has been presented.

Queue items must have client-generated IDs so repeated UI actions cannot create duplicate local items. Existing server duplicate locking remains the final authority.

## User Interface

Both forms show compact persistence status: saving, saved, restored, storage unavailable, or offline. Submission while offline confirms that data is queued rather than claiming server success.

A shared queue-status surface shows pending count and each item's form/date/shift/station, current state, last error, and Retry action where applicable. Authentication-required items show a login action. Duplicate items show the terminal server-conflict message.

Controls remain keyboard accessible, status updates use an appropriate ARIA live region, and errors are not communicated by color alone.

## Data Consistency

Draft writes use last-write-wins within a single user/form key. Queue creation snapshots the validated draft; later draft edits do not mutate an existing queue item. Only one synchronizer may process a queue item at once within a tab. A short IndexedDB lease prevents concurrent tabs from uploading the same queue item simultaneously; expired leases are recoverable after crashes.

Schema records include a version number. This release supports only its initial version; incompatible future records must remain untouched and produce a recovery message rather than being deleted.

## Service Worker and Application Updates

This scope does not require a service worker for draft or queue persistence. IndexedDB and online-event synchronization work without one.

If service-worker registration is added later, HTML must remain network-first and build assets must use hashed filenames. A waiting worker should show “Update tersedia” and reload only after explicit user confirmation. No forced reload may interrupt an active draft or synchronization.

## Verification

Add focused runnable checks for pure serialization, expiry, queue transition, retry classification, and FIFO selection logic. Browser-level checks cover:

1. Both forms restore values and compressed photos after reload.
2. Drafts are isolated by user and form type.
3. Drafts older than seven days are removed.
4. Successful submission clears its draft.
5. Offline submission survives reload and syncs after reconnect.
6. Expired authentication pauses sync and resumes after login.
7. Duplicate `409` becomes terminal and does not retry.
8. Three retryable failures require manual Retry.
9. Two tabs do not submit the same queued item concurrently.
10. Storage failure leaves online submission usable.

Run frontend and API typechecks, the production build, existing focused checks, and the new offline UX check before completion.
