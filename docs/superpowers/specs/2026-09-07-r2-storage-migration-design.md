# Design: Migrate Photo Storage from Vercel Blob to Cloudflare R2

## Context
Vercel Blob Storage is expensive on the Hobby plan. Cloudflare R2 offers free egress, 10GB free storage, and 10M Class A requests/month — ideal for photo uploads in a waste management app.

## Constraints
- **Old files stay**: existing Vercel Blob URLs in `dokumentasi_urls` must continue working (used in PDFs)
- **New files go to R2**: all new uploads use R2 via S3-compatible API
- **Custom domain**: `images.gacoanku.my.id` for clean public URLs
- **Zero downtime**: backward compatibility during migration
- **Vercel Hobby limit**: function count ≤ 12, bundle size matters

## Architecture

```
┌─────────────────────────────────────────────┐
│ Client (browser)                            │
│  POST /api/upload-file { base64, filename } │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│ api/upload-file.ts                          │
│  Detect URL pattern → route to R2           │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│ server/r2.ts (NEW)                          │
│  S3-compatible PUT via aws4fetch            │
│  Returns: https://images.gacoanku.my.id/... │
└─────────────────────────────────────────────┘
```

### URL Detection
- `blob.vercel-storage.com` → old Vercel Blob (read via proxy, never delete from R2)
- Everything else → R2 (new uploads)

### Read Path
```
GET /api/signatures?blobUrl=...
  ├── Old URL → @vercel/blob get() → stream response
  └── New URL → Fetch directly from https://images.gacoanku.my.id/... (public)
```

### Delete Path (admin history delete)
```
DELETE blobs
  ├── Old URL → @vercel/blob del() (existing logic, unchanged)
  └── New URL → R2 S3 DELETEObject
```

## Files Changed

| File | Change |
|------|--------|
| `server/r2.ts` | **NEW** — R2 upload/delete via aws4fetch + S3 signing |
| `server/lib.ts` | Modify `uploadToBlob()` → route to R2 for new uploads |
| `api/upload-file.ts` | No change (calls `uploadToBlob`) |
| `api/signatures.ts` | Handle old (proxy) + new (direct fetch) URLs |
| `api/admin/[action].ts` | Delete handler: detect + delete from R2 |
| `api/get.ts` | List handler: handle R2 URLs |
| `package.json` | Add `aws4fetch` dependency |
| Vercel env | Add `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_DOMAIN` |

## Env Variables (Vercel)

```
R2_ACCOUNT_ID        = <cloudflare-account-id>
R2_ACCESS_KEY_ID     = <r2-access-key-id>
R2_SECRET_ACCESS_KEY = <r2-secret-access-key>
R2_BUCKET            = <bucket-name>
R2_PUBLIC_DOMAIN     = images.gacoanku.my.id
```

## R2 Bucket Setup (Manual)
1. Cloudflare Dashboard → R2 → Create Bucket
2. Enable public access via Custom Domain → add `images.gacoanku.my.id`
3. Create R2 API Token (Object Read & Write permissions)
4. Set DNS CNAME: `images.gacoanku.my.id` → R2 public endpoint

## Upload Flow (New)

1. Client sends base64 to `/api/upload-file`
2. `uploadToBlob()` in `server/lib.ts` detects: new upload → call R2
3. `server/r2.ts`:
   - Generate unique key: `waste-docs/{timestamp}-{sanitized-filename}`
   - Sign request with `aws4fetch` (S3v4 signature)
   - PUT to R2 bucket
   - Return public URL: `https://images.gacoanku.my.id/{key}`
4. URL stored in `dokumentasi_urls` column (same as before)

## Read Flow

`/api/signatures?blobUrl=<url>`:
- If URL contains `blob.vercel-storage.com` → use `@vercel/blob` get() (existing)
- Else → fetch directly from `https://images.gacoanku.my.id/...` (public, no auth needed)

## Delete Flow (History Delete)

When admin deletes a shift:
- Old URLs → `@vercel/blob` del() (existing logic)
- New URLs → R2 `DELETEObject` via aws4fetch

## Backward Compatibility

- **No data migration needed**: old files stay in Vercel Blob
- **PDF generation**: already uses proxy endpoint, works for both
- **No URL rewriting**: old URLs in DB remain unchanged

## Cost Comparison (Estimated)

| | Vercel Blob (Hobby) | Cloudflare R2 |
|---|---|---|
| Storage | $0.15/GB/month | Free (10GB) |
| Egress | $0.15/GB | Free |
| PUT/GET | Included | Free (10M/month) |
| ~500 photos/month | ~$1-2/month | $0 |

## Verification
- `npm install` — aws4fetch installed
- `npx tsc --noEmit` — no errors
- `npm run build` — clean
- Manual test: upload photo → verify R2 URL returned
- Manual test: view old photo via proxy → still works
- Manual test: delete shift with mixed old/new photos → both deleted
