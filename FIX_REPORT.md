# LAPORAN REMEDIASI — waste-v2 (AWAS v4)

| Field | Value |
|---|---|
| Tanggal | 2026-09-20 |
| Cakupan | Semua temuan AUDIT.md: C1–C3, H1–H7, M1–M17, L1–L11 + §7 quick wins |
| Working copy | `~/workspace/waste-v2-fix` (branch `main`, baseline `2a7c73d`) |
| Metode | 3 worker paralel (A: critical/config/deps/docs, B: backend, C: frontend) + verifikasi koordinator |
| Status akhir | `npm run typecheck` ✅ `npm run typecheck:api` ✅ `npm run build` ✅ (Vite 7.3.6) |
| Commit | **Tidak ada commit** — working tree dibiarkan dirty untuk PR via API. Tidak ada remote ditambahkan, tidak ada push. |

> **Catatan koreksi audit:** `shared/tester.ts` yang diklaim "dead code" ternyata **dipakai** (fitur tester checklist di `src/pages/auto-waste.tsx`, 6 referensi). Isinya di-inline sebagai const lokal di `auto-waste.tsx`, baru file-nya dihapus — perilaku bisnis tidak berubah.

---

## 1. STATUS PER TEMUAN

### 🔴 Critical

| ID | Status | Perbaikan |
|---|---|---|
| C1 | **Fixed (kode)** / ⚠️ Manual | `.env.example` ditulis ulang — semua 17 nilai jadi placeholder murni (terverifikasi). Var R2 yang dibaca kode (`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_PUBLIC_DOMAIN`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `GOOGLE_SERVICE_ACCOUNT_KEY`) + `GOOGLE_DRIVE_FOLDER_ID` ditambahkan; var OAuth neutral yang tak dipakai kode dihapus. ⚠️ **Rotasi secret + scrub history = langkah manual user (lihat §3).** |
| C2 | **Fixed (kode)** / ⚠️ Manual | Nilai `apiKey` asli di `opencode.json` → `"${NINE_ROUTER_API_KEY}"`; README mendokumentasikan cara isi key secara lokal. ⚠️ **Revoke key di dashboard 9router + scrub history = manual.** |
| C3 | **Fixed** | `jspdf` `^2.5.2` → `4.2.1`, `jspdf-autotable` `^3.8.4` → `5.0.8` (npm install sukses, lockfile update). `shared/pdf-renderer.ts` kompatibel — API `autoTable(doc, opts)` + `lastAutoTable.finalY` tetap valid di v5; `typecheck:api` hijau. |

### 🟠 High

| ID | Status | Perbaikan |
|---|---|---|
| H1 | **Fixed** | `api/upload-file.ts`: allowlist `image/jpeg|png|webp`, SVG ditolak mentah-mentah, batas 10 MB dicek dari panjang base64 **sebelum** `Buffer.from` (+ recheck ukuran hasil decode), verifikasi magic bytes server-side (JPEG/PNG/WebP) dicocokkan dengan tipe yang diklaim. Error ke client generik (`File tidak valid`), detail di `console.warn`. |
| H2 | **Fixed** | `isR2Url` → perbandingan hostname eksak (`new URL(url).hostname === R2_PUBLIC_DOMAIN`, try/catch). `isAllowedUploadUrl()` baru: hanya host persis R2_PUBLIC_DOMAIN, `*.blob.vercel-storage.com`, atau path `/api/signatures?blobUrl=…` (https-only) — ditegakkan saat submit di `submit-waste.ts` (paraf QC/Manager + semua dokumentasiUrls) dan `items.ts`, tolak dengan 400 generik. `generate-pdf.ts` fetch R2 via `r2GetObject()` dengan `redirect: 'manual'` (fail-closed). `shared/pdf-renderer.ts` hanya meng-emit link untuk protokol `https:` (non-https jadi teks polos). |
| H3 | **Fixed (kode)** / ⚠️ Manual | Upload R2 kini **private-by-default**: `api/signatures.ts` jadi proxy **terautentikasi** juga untuk URL R2 (fetch server-side pakai kredensial R2, serve dengan `X-Content-Type-Options: nosniff` + `Cache-Control: private, max-age=300`, tanpa directive `public`). `r2Upload()` mengembalikan object key; `uploadToBlob()` mengembalikan `/api/signatures?blobUrl=<key>` untuk upload baru — tidak ada public URL untuk upload baru. `AGENT_RULES.md` diperbarui agar jujur soal model akses. ⚠️ **Set bucket jadi private di dashboard Cloudflare = manual** (URL publik lama tetap reachable sampai itu dilakukan; proxy tetap melayani URL lama via path terautentikasi). |
| H4 | **Partial** | CSP header konservatif ditambahkan di `vercel.json` (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; object-src 'none'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'`). Terverifikasi: `dist/index.html` hasil build **tidak mengandung inline `<script>`** → `script-src 'self'` aman. Migrasi ideal ke httpOnly cookie + CSRF tetap roadmap. |
| H5 | **Fixed** | Frontend: 3 literal `storeName: 'BEKASI KP. BULU'` di `auto-waste.tsx` → `store?.name ?? ''` dari `useAuth()`; opsi hardcoded `"CKRBUL (default)"` di store-switcher dihapus. Backend: `submit-waste.ts` + `items.ts` **mengabaikan** `body.storeName`/`body.store_name` dari client — `store_name` selalu di-resolve dari tabel `stores` via `storeId`. |
| H6 | **Fixed** | Proxy `/api/signatures`: EXISTS check kini di-AND dengan `(store_id = <caller> OR <unscoped>)` untuk caller terautentikasi non-admin; `super_admin` dikecualikan. Pengecualian sadar: path signed-token (`?blobUrl=…&token=…`, token HMAC 10-menit untuk asset link PDF) tetap unscoped — tidak ada identitas caller di sana; token itu sendiri adalah capability. |
| H7 | **Partial** | Pembuatan API key kini **hanya `super_admin`** (403 untuk lainnya); `expiry: 'never'` ditolak; TTL maksimal 90 hari. Kolom scope per-key = **roadmap** (butuh migrasi skema, tidak dikerjakan). |

### 🟡 Medium

| ID | Status | Perbaikan |
|---|---|---|
| M1 | **Partial** | `api/login.ts`: counter per-username + progressive delay (1 dtk per kegagalan ekstra setelah 5x, cap 10 dtk; hard 429 setelah 30x/15 mnt; reset saat login sukses) di samping rate limit IP yang ada. Distributed store (Upstash/Vercel KV) tetap **roadmap** (masih in-memory per cold-start). |
| M2 | **Fixed** | `LICENSE` baru — proprietary notice PT. Pesta Pora Abadi (ID+EN). |
| M3 | **Fixed** | `deactivate-all-personnel.ts` + `cleanup-personnel-dupes.ts`: default **dry-run** (daftar baris terdampak, exit 0 tanpa perubahan); eksekusi nyata hanya dengan `--confirm`; tolak bila host `DATABASE_URL` mengandung `neon.tech` kecuali `--i-know-this-is-prod`. `delete-opening-2026-07-28.ts` (one-off bertanggal, sudah dieksekusi) dipindah ke `scripts/archive/` + dicatat di `scripts/README.md`. Guard teruji (penolakan host prod + missing env). |
| M4 | **Fixed** | Dikerjakan bersama C1 — `.env.example` sinkron dengan kode. |
| M5 | **Fixed** | `.github/workflows/ci.yml` baru (push main + PR): `npm ci` → `typecheck` → `typecheck:api` → `build` (Node 24). |
| M6 | **Fixed** | `scripts/hash-password.ts` ditulis ulang: baca dari env `HASH_PASSWORD` → prompt TTY tersembunyi (`stty -echo`) → piped stdin; tidak pernah dari `process.argv`; password tidak pernah dicetak. Format output hash tidak berubah. |
| M7 | **Fixed** | `vite` `^5.4.11` → **`^7.3.6`** — `typecheck` + `build` hijau → upgrade **dipertahankan**. README berisi peringatan jangan expose `vite --host 0.0.0.0` di jaringan tak terpercaya. |
| M8 | **Fixed** | `docs/BACKUP-DATABASE.md` baru: target RPO ≤1 jam / RTO ≤4 jam, checklist verifikasi PITR/branching Neon, jadwal `pg_dump -Fc` (harian 06:00 WIB + mingguan), prosedur uji restore kuartalan, dump wajib sebelum script destruktif. |
| M9 | **Fixed** | `docs/04-API.md`: `POST /api/auth/login` → `/api/login`; `GET /api/shift-status` fiktif dihapus (diganti dokumentasi `GET /api/get?action=shift-status`); `GET /api/get` didokumentasikan (3 action riil, terverifikasi dari source). `docs/03-ARCH.md`: tree file fiktif diganti struktur aktual. `scripts/dev-server.ts`: route map disinkronkan ke 9 file `api/` yang benar-benar ada (7 route fiktif dibuang). `docs/05-SCHEMA.md`: tabel `api_keys`, `waste_submission_locks`, `stores` + `store_id` ditambahkan (terverifikasi dari `init-schema.sql` + `migrate-multi-resto.ts`). |
| M10 | **Fixed** | `src/pages/dashboard.tsx`: semua hooks dipindah di atas early return; `useQuery` diberi `enabled: user?.role !== 'admin_store'`. |
| M11 | **Fixed** | `src/pages/pdf-download.tsx`: helper `fetchPdfResponse()` baru — `AbortSignal.timeout(65000)`, mapping TimeoutError → pesan ramah, 401 eksplisit → `clearAuth()` + dispatch `auth:session-expired` (alur logout yang sama). (`apiClient.fetch` tidak dipakai karena melempar untuk respons non-JSON.) |
| M12 | **Partial** | Client: `offline-waste.ts` mengirim `idempotencyKey: crypto.randomUUID()` per queue item; fingerprint memakai hash SHA-256 isi foto; key dikirim ulang di setiap retry. Server: `idempotencyKey` opsional diterima, format UUID divalidasi (non-UUID → 400), masuk ke nama `pg_advisory_xact_lock` (`idem:<uuid>`) + `activity_logs`. **Otoritas 409 tetap natural key** `(store_id, business_date, shift, station)` — tidak ada tabel idempotency terpisah (itu perbaikan struktural, roadmap). |
| M13 | **Fixed** | `details: String(err)` dihapus dari respons 500 `api/get.ts`. |
| M14 | **Fixed** | `src/components/ui/confirm-dialog.tsx` dibangun ulang di atas `@radix-ui/react-dialog`: focus trap otomatis, Esc + klik overlay → `onCancel`, `role="dialog" aria-modal="true"`. Interface prop tidak berubah (8 pemakaian tetap kompatibel). |
| M15 | **Fixed** | `index.html`: viewport kini hanya `width=device-width, initial-scale=1.0`. |
| M16 | **Fixed** | `AuthContext.tsx`: `else throw new Error(res.message || 'Login gagal')` ditambahkan. |
| M17 | **Fixed** | `dashboard.tsx`: `qc.invalidateQueries({ queryKey: ['dashboard-data'] })` di `update/delete/addMutation`. |

### ⚪ Low

| ID | Status | Perbaikan |
|---|---|---|
| L1 | **Fixed** | `verifyToken`: `typeof payload.exp !== 'number' \|\| payload.exp < now` → null. |
| L2 | **Fixed** | Dummy `scryptSync(randomBytes(16), randomBytes(16), 64)` saat user tidak ditemukan (samarkan timing). |
| L3 | **Fixed** | `handleStationItems` POST/PUT kini pakai skema zod (terverifikasi cocok dengan kontrak `admin-station-items.tsx`; PUT tetap partial via COALESCE). |
| L4 | **Fixed** | `handleTenantConfig` GET: allowlist role `super_admin`/`admin_store`, tetap scope ke store sendiri. |
| L5 | **Fixed** | Komentar "UI-only, keamanan riil di server" di `AuthContext.tsx:26` dan `App.tsx`. |
| L6 | **Fixed** | Retry promise `auto-waste.tsx:600` → `.catch` + toast; clipboard di `profile.tsx` dibungkus try/catch; `public/sw.js` dihapus (0 referensi `serviceWorker`/`sw.js` repo-wide, recoverable via trash); `shared/tester.ts` dihapus setelah isinya di-inline (lihat catatan di atas). |
| L7 | **Fixed** | `react-hook-form`: 0 import repo-wide → `npm uninstall` sukses. `jspdf`/`jspdf-autotable`/`zod` **dipertahankan** (dipakai server-side). |
| L8 | **Fixed** | Folder ID Drive → `process.env.GOOGLE_DRIVE_FOLDER_ID` di `server/google-drive.ts` (throw `GoogleDriveBackupError('configuration')` bila unset) dan `scripts/seed-qc-checklist-url.ts` (FATAL bila unset); placeholder ditambahkan ke `.env.example`. |
| L9 | **Fixed** | `scripts/README.md` baru: indeks script aktif (terdaftar di package.json) vs one-off/check vs archived. |
| L10 | **Fixed** | `README.md` diisi: deskripsi, arsitektur singkat, setup env, perintah umum, setup key 9router, peringatan vite --host, keterbatasan (termasuk L11: base URL `/api/*` same-origin tidak configurable). |
| L11 | **Fixed (dokumentasi)** | Dicatat sebagai keterbatasan di README. |

**Bonus (di luar daftar temuan, sekalian dibetulkan):** error pre-existing `server/r2.ts:54` (Buffer vs BodyInit) diperbaiki via `new Uint8Array(buffer)`; `deleteBlob()` kini menangani key refs (perbaiki orphaned R2 objects saat shift dihapus); cabang Vercel Blob di proxy juga dapat `nosniff`.

---

## 2. RINGKASAN PERUBAHAN

- **40 file diubah** (1325 insertions, 920 deletions) + 4 path baru: `.github/workflows/ci.yml`, `LICENSE`, `docs/BACKUP-DATABASE.md`, `scripts/README.md`; 2 file dihapus (`public/sw.js`, `shared/tester.ts` — keduanya recoverable via trash); 1 file diarsipkan (`scripts/archive/delete-opening-2026-07-28.ts`).
- **Dependensi:** `jspdf` 2.5.2→4.2.1, `jspdf-autotable` 3.8.4→5.0.8, `vite` 5.4.11→7.3.6, `react-hook-form` dihapus.
- **Verifikasi akhir (koordinator):** `npm run typecheck` ✅ · `npm run typecheck:api` ✅ · `npm run build` ✅ (Vite 7.3.6, ~6.6 dtk). Tidak ada secret yang ditulis ke file mana pun (terverifikasi: `.env.example` 100% placeholder, `opencode.json` 0 kemunculan `sk-`).
- **Tidak ada commit/push/remote** — siap untuk PR via API.

---

## 3. LANGKAH MANUAL UNTUK USER (tidak bisa dikerjakan di level kode)

> Secret di bawah ini **pernah terpapar di repo PUBLIK** — anggap semuanya sudah dikompromikan.

1. **Rotasi SEMUA secret (C1):** password database Neon, `JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`, kedua OAuth client + refresh token Google Drive (legacy & neutral), seed password admin/store. Lakukan **sekarang juga**, sebelum deploy hasil fix ini.
2. **Revoke di Google Cloud Console (C1):** revoke kedua OAuth client/refresh token Drive (legacy + neutral). Kredensial neutral bahkan tidak dipakai kode — revoke + hapus untuk kecilkan attack surface.
3. **Revoke key 9router (C2):** revoke di dashboard 9router, generate baru, simpan di env lokal (jangan commit).
4. **Bersihkan git history:** `git filter-repo` / BFG Repo-Cleaner untuk `.env.example` dan `opencode.json` di **seluruh history** (menghapus di commit baru tidak cukup — history publik tetap bisa diakses). Pertimbangkan jadikan repo **private**.
5. **Cek `activity_logs`** untuk akses anomali selama secret terpapar.
6. **Set bucket R2 jadi private di Cloudflare dashboard (H3):** kode sudah serve via proxy terautentikasi; URL publik lama tetap reachable sampai bucket di-flip. Setelah flip, verifikasi PDF/foto lama tetap tampil via proxy.
7. **Verifikasi PITR Neon (M8):** cek plan yang dipakai mendukung PITR/branching; jadwalkan `pg_dump` + uji restore pertama mengikuti `docs/BACKUP-DATABASE.md`.
8. **Roadmap (butuh keputusan/desain, bukan bug):** kolom scope per API key (migrasi skema), distributed rate limiting (Upstash/Vercel KV), migrasi JWT ke httpOnly cookie + CSRF, migrasi skema versioned (`migrations/001_….sql`), tabel idempotency terpisah bila diperlukan.

---

*Disusun oleh koordinator remediasi + 3 worker paralel, 2026-09-20. Semua temuan audit telah ditangani di level kode kecuali yang tercantum di §3.*
