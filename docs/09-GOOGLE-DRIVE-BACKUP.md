# 09 — Google Drive PDF Backup

## Purpose

`GET /api/generate-pdf?date=YYYY-MM-DD` checks the actual completion record in `daily_records`. If the row for that date and `MIDNIGHT` has `done = true`, the canonical PDF must exist in Google Drive before the endpoint returns a download. The fixed backup folder is:

```text
1R0xINfBaFmgogIEsfzS20ivd-nzWwiBw
```

The backend searches that folder for the exact canonical filename (`BA Waste {store_code} - DDMMYYYY.pdf`). An existing match is downloaded through the authenticated backend. A missing match is rendered, uploaded once, then returned. Dates without completed MIDNIGHT continue using the normal on-demand path and make no Google OAuth or Drive request.

## Required server environment

Set these secrets only in the Vercel server environment (Production, and Preview only if preview backups are intended):

```env
GOOGLE_DRIVE_CLIENT_ID=your-oauth-client-id.apps.googleusercontent.com
GOOGLE_DRIVE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_DRIVE_REFRESH_TOKEN=your-owner-account-refresh-token
```

Do **not** prefix them with `VITE_`, return them in an API response, include them in frontend code, or commit their values. `.env.example` intentionally contains placeholders only.

## OAuth owner-account setup

1. In the Google Cloud project owned by the Drive owner, enable **Google Drive API**.
2. Create an OAuth 2.0 client and retain its client ID and client secret in the server secret manager.
3. Complete an OAuth consent flow while signed in as the account that owns (or has Editor access to) the folder above. Request offline access and the scope `https://www.googleapis.com/auth/drive` so the backend can search and retrieve the exact files in that folder as well as upload them.
4. Store the resulting refresh token as `GOOGLE_DRIVE_REFRESH_TOKEN`. It is an owner-account credential; revoke and replace it if it is exposed.
5. Deploy the three values and verify a completed-MIDNIGHT PDF. A missing/invalid value returns a clear `503`; the endpoint intentionally does not return a newly generated but unbacked PDF.

The refresh token must remain valid for the deployed OAuth client. Google may revoke it when consent is revoked, the account security state changes, or too many refresh tokens are issued. Rotate the Vercel secret after generating a replacement.

## Concurrency and recovery

The existing `daily_records.pdf_generated` / `pdf_generated_at` fields act as a short, two-minute server-side generation lease. Concurrent requests first search Drive; only one can claim a missing backup. Other requests wait briefly for the canonical file and otherwise receive `503` asking them to retry. If a render/upload fails, the claim is released. If a function stops unexpectedly, the lease expires so a later request can retry; a Drive search always runs before a new upload to avoid obvious duplicates.
