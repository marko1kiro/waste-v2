# AWAS v4 — Aplikasi Waste Always Simple

Aplikasi pencatatan pemusnahan produk makanan/minuman untuk **PT. Pesta Pora Abadi**.
Crew/QC/manager di outlet restoran (multi-resto) mengisi form waste per station
(`NOODLE`, `DIMSUM`, `BAR`, `PRODUKSI`) per shift (`OPENING`, `MIDDLE`, `CLOSING`,
`MIDNIGHT`), melampirkan foto dokumentasi + paraf digital QC & manager.
Setelah shift `MIDNIGHT` di-submit, sistem membuka (unlock) **PDF Berita Acara**
yang bisa diunduh — PDF otomatis di-backup ke Google Drive dan Cloudflare R2.

## Arsitektur singkat

- **Frontend:** React 18 + TypeScript + Vite + Tailwind/shadcn + Wouter +
  TanStack React Query (`src/`, `shared/`)
- **Backend:** Vercel Serverless Functions (`api/`), dibantu `server/lib.ts`
  (JWT, scrypt, store context, validator)
- **Database:** Neon PostgreSQL (`docs/05-SCHEMA.md`)
- **Storage:** foto → Cloudflare R2 (baru) / Vercel Blob (legacy, private via proxy);
  backup PDF → Google Drive + R2
- **Auth:** JWT HMAC-SHA256 (8 jam) di header `Authorization: Bearer`;
  role `super_admin` dan `admin_store`
- **Timezone:** WIB (Asia/Jakarta), business date cutoff 05:00

Dokumen desain: baca `docs/` berurutan — `01-PRD.md` → `07-PDF.md`.
Aturan kerja agent: `AGENT_RULES.md`.

## Setup environment

1. Salin template env (file ini **hanya berisi placeholder** — jangan taruh secret asli):
   ```bash
   cp .env.example .env
   ```
2. Isi `.env` dengan kredensial asli dari dashboard masing-masing layanan
   (Neon, Vercel Blob, Cloudflare R2, Google Drive). File `.env` **di-gitignore**
   dan tidak boleh di-commit.
3. Daftar variabel lengkap + penjelasan: lihat `.env.example`.
4. Verifikasi git tidak akan memungut `.env`:
   ```bash
   git check-ignore .env   # harus mencetak ".env"
   ```

## Perintah umum

| Perintah | Fungsi |
|----------|--------|
| `npm ci` | Install dependency (bersih, sesuai lockfile) |
| `npm run dev` | Dev server frontend |
| `npm run dev:api` | Dev server API lokal (meniru Vercel Functions, port 1213) |
| `npm run build` | Build produksi |
| `npm run typecheck` | Typecheck frontend + shared |
| `npm run typecheck:api` | Typecheck API + server + shared |
| `npm run db:init` | Seed database awal |
| `npm run hash-password` | Hash password (baca dari env `HASH_PASSWORD` / prompt tersembunyi) |

Sebelum commit: `npm run typecheck && npm run build` harus PASS.
CI (`.github/workflows/ci.yml`) menjalankan `npm ci` → typecheck → typecheck:api → build.

## API key 9router (untuk opencode)

`opencode.json` berisi referensi `"apiKey": "${NINE_ROUTER_API_KEY}"` — **bukan**
key asli. Key asli tidak boleh di-commit. Cara mengisi secara lokal:

- Opsi 1 (env var): `export NINE_ROUTER_API_KEY="sk-..."` sebelum menjalankan opencode.
- Opsi 2 (file lokal): buat file lokal yang di-gitignore (mis. `~/.config/opencode/secret.json`)
  lalu rujuk dari konfigurasi lokal Anda — jangan taruh di repo ini.

## Peringatan keamanan dev server

Jangan menjalankan `vite --host 0.0.0.0` di jaringan yang tidak terpercaya
(WiFi publik, dsb.) — dev server akan terekspos ke seluruh jaringan lokal.
Pakai default (`localhost`) kecuali Anda tahu apa yang dilakukan.

## Keterbatasan yang diketahui

- **Base URL API tidak configurable:** seluruh frontend memanggil `/api/*` relatif
  (same-origin). Aplikasi diasumsikan di-deploy sebagai satu unit di Vercel;
  memisahkan frontend dan API ke origin berbeda butuh perubahan kode.
- **Vite 7:** di-upgrade dari Vite 5 EOL → `vite@^7` (typecheck + build hijau).
  Upgrade Vite 8 direncanakan menyusul.
- **jsPDF 4:** server-side PDF memakai `jspdf@^4` + `jspdf-autotable@^5`
  (menutup CVE-2025-68428).
- **Backup database:** tidak otomatis — ikuti runbook `docs/BACKUP-DATABASE.md`.
- **Skema:** belum ada migrasi versioned tunggal; sumber kebenaran =
  `scripts/init-schema.sql` + `scripts/migrate-multi-resto.ts` (lihat `docs/05-SCHEMA.md` §9).
