# 09 — Google Drive PDF Backup

## Purpose

`GET /api/generate-pdf?date=YYYY-MM-DD` checks the actual completion record in `daily_records`. If the row for that date and `MIDNIGHT` has `done = true`, the canonical PDF must exist in Google Drive before the endpoint returns a download. The backup folder is per-store, taken from the `stores.drive_folder_id` column (for CKRBUL this points at the dedicated Kampung Bulu folder).

The backend searches that folder for the exact canonical filename (`BA Waste {store_code} - DDMMYYYY.pdf`). An existing match is downloaded through the authenticated backend. A missing match is rendered, uploaded once, then returned. Dates without completed MIDNIGHT continue using the normal on-demand path and make no Google Drive request.

Authentication uses a Google Cloud **service account** (`server/google-drive-neutral.ts`) — no OAuth consent screen, no refresh-token expiry.

## Required server environment

Set this secret only in the Vercel server environment (Production, and Preview only if preview backups are intended):

```env
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account", ... }
```

The full service-account JSON key on a single line. Do **not** prefix it with `VITE_`, return it in an API response, include it in frontend code, or commit its value. `.env.example` intentionally contains a placeholder only.

The Drive folder itself is configured per-store in the database (`stores.drive_folder_id`), not via env.

## Service account setup

1. In a Google Cloud project, enable **Google Drive API**.
2. Create a service account (IAM & Admin → Service Accounts) and create a JSON key for it. Keep the JSON private — anyone holding it can act as the service account.
3. In Google Drive (using the dedicated resto account), create the backup folder (e.g. `AWAS PDF - Kampung Bulu`), then **Share** it with the service account's `client_email` as **Editor**.
4. Copy the folder ID from the folder URL and store it in the database:
   ```sql
   UPDATE stores SET drive_folder_id = '<folder-id>' WHERE code = 'CKRBUL';
   ```
5. Set `GOOGLE_SERVICE_ACCOUNT_KEY` in Vercel (Production) to the full JSON key and redeploy. Then verify a completed-MIDNIGHT PDF download. A missing/invalid key or folder returns a clear `503`; the endpoint intentionally does not return a newly generated but unbacked PDF.

Service-account keys do not expire the way Testing-mode OAuth refresh tokens do (7 days). To rotate: create a new key, update the Vercel secret, redeploy, then delete the old key.

## Concurrency and recovery

The existing `daily_records.pdf_generated` / `pdf_generated_at` fields act as a short, two-minute server-side generation lease. Concurrent requests first search Drive; only one can claim a missing backup. Other requests wait briefly for the canonical file and otherwise receive `503` asking them to retry. If a render/upload fails, the claim is released. If a function stops unexpectedly, the lease expires so a later request can retry; a Drive search always runs before a new upload to avoid obvious duplicates.
