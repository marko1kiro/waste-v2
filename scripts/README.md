# scripts/ — Indeks Utilitas

Konvensi: file `kebab-case.ts`, dijalankan dengan `npx tsx scripts/<nama>.ts`.

## Script aktif (terdaftar di `package.json`)

| Script npm | File | Fungsi |
|------------|------|--------|
| `dev:api` | `dev-server.ts` | Dev server lokal yang meniru Vercel Functions (route map disinkron dengan `api/`) |
| `db:init` | `seed.ts` | Seed database awal (user admin, dst.) |
| `hash-password` | `hash-password.ts` | Hash password scrypt → format `salt:hash`. Baca password dari **env `HASH_PASSWORD`**, prompt TTY tersembunyi, atau piped stdin. **Tidak pernah** dari argumen CLI dan tidak pernah dicetak. |
| `check:generate-pdf` | `check-generate-pdf.ts` | Self-test render PDF |
| `check:google-drive-backup` | `check-google-drive-backup.ts` | Self-test backup PDF ke Google Drive |
| `check:submission-locks` | `check-submission-locks.ts` | Self-test anti double-submit |
| `check:paste-parser` | `check-paste-waste-parser.ts` | Self-test parser paste waste |
| `check:offline-waste` | `check-offline-waste.ts` | Self-test antrean offline |
| `check:photo-compression` | `check-photo-compression.ts` | Self-test kompresi foto |
| `check:waste-submit-progress` | `check-waste-submit-progress.ts` | Self-test progress submit |
| `check:store-context` | `check-store-context.ts` | Self-test store context / scoping |
| `check:neutral-drive` | `check-neutral-drive.ts` | Self-test Google Drive service account |

## Script destruktif (guard aktif)

Script ini **default dry-run** (hanya menampilkan baris terdampak) dan
**menolak** berjalan ke database produksi (host mengandung `neon.tech`)
tanpa flag `--i-know-this-is-prod`:

| File | Fungsi | Eksekusi |
|------|--------|----------|
| `deactivate-all-personnel.ts` | Nonaktifkan SEMUA personnel aktif | `--confirm` (+ `--i-know-this-is-prod` untuk prod) |
| `cleanup-personnel-dupes.ts` | Nonaktifkan duplikat QC1/MGR1 tanpa signature | `--confirm` (+ `--i-know-this-is-prod` untuk prod) |

Sebelum menjalankan, buat backup tabel terdampak dulu — lihat
`docs/BACKUP-DATABASE.md`.

## Script one-off / tidak terdaftar

Jalankan manual sesuai kebutuhan (tidak ada di `package.json`):

- **Seed & setup:** `seed-qc-checklist-url.ts` (pakai env `GOOGLE_DRIVE_FOLDER_ID`),
  `seed-active-personnel.ts`, `seed-station-items.ts`, `update-tenant-code.ts`,
  `fix-signature-urls.ts`
- **Migrasi skema:** `init-db.ts`, `init-schema.sql`, `add-api-keys.sql`,
  `apply-api-key-migration.ts`, `migrate-multi-resto.ts`
- **Self-test lain (`check-*`):** `check-admin-store-url.ts`,
  `check-api-key-auth.ts`, `check-api-key-crypto.ts`, `check-api-key-management.ts`,
  `check-daily-records.ts`, `check-docs-route.ts`, `check-history-edit.ts`,
  `check-legacy-token.ts`, `check-pdf-documentation-links.ts`,
  `check-pdf-fields.ts`, `check-pdf-signature-resolver.ts`,
  `check-pdf-table-width.ts`, `check-store-features.ts`, `check-store-isolation.ts`,
  `check-store-scoping.ts`, `check-tenant-config.ts`, `check-waste-validation.ts`
- **Inspeksi/debug:** `db-check.ts`, `verify-db.ts`, `audit-pdf-signatures.ts`,
  `inspect-history-edit.ts`, `test-resolve.ts`, `crypto-validation-check.ts`

## Arsip (`scripts/archive/`)

- `delete-opening-2026-07-28.ts` — one-off bertanggal yang **sudah dieksekusi**
  (hapus data OPENING 2026-07-28 dari 3 tabel). Disimpan untuk referensi
  historis; jangan dijalankan ulang tanpa meninjau tanggal/shift-nya.
