# Multi-Resto Upgrade — Design Spec

Tanggal: 2026-09-06
Repo: `waste-v2` (AWAS v4), branch kerja: `feat/multi-resto`
Status keputusan: Supabase **void** (tetap Neon), VPS **void** (tetap Vercel + Opsi 1 hemat), Opsi onboarding **A** (super admin), Drive **Opsi 3** (akun netral, folder per resto).

## 1. Tujuan

Upgrade aplikasi waste dari single-tenant (CKRBUL saja) menjadi **multi-resto**: data terisolasi per resto di level query, resto baru hanya paste-mode, PDF/Drive backup per resto dengan akun netral, super admin mengelola resto. Vercel diminimalkan konsumsinya (hemat) tanpa mengubah perilaku CKRBUL.

## 2. Batasan Keras

1. **CKRBUL = zona larangan sentuh untuk PDF/Drive**: kredensial, folder, logic `api/google-drive.ts` + path legacy di `api/generate-pdf.ts` — perilaku byte-identical untuk resto CKRBUL.
2. Infrastruktur tetap: Neon (Postgres), Vercel serverless, Vercel Blob, JWT custom auth.
3. Format paste **sama persis** dengan sekarang untuk semua resto.
4. Scoping isolasi: app-level `WHERE store_id = $1` (bukan RLS).
5. Tidak ada self-registration. Akun & resto dibuat super admin.

## 3. Data Model

### Tabel baru: `stores`
```sql
CREATE TABLE stores (
    id              SERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,          -- 'CKRBUL', dst.
    name            TEXT NOT NULL,                 -- 'GACOAN KAMPUNG BULU'
    drive_account   TEXT NOT NULL DEFAULT 'legacy', -- 'legacy' | 'neutral'
    drive_folder_id TEXT NOT NULL DEFAULT '',      -- folder Drive resto (untuk 'neutral')
    features        JSONB NOT NULL DEFAULT '{}',   -- { manual_mode, catalog }
    status          TEXT NOT NULL DEFAULT 'active',-- 'active' | 'inactive'
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```
- CKRBUL: `drive_account='legacy'`, `features={"manual_mode":true,"catalog":true}`
- Resto baru: `drive_account='neutral'`, `features={"manual_mode":false,"catalog":false}` (paste-only)

### Kolom baru `store_id INTEGER NOT NULL REFERENCES stores(id)`
Ditambahkan (nullable dulu) + backfill ke CKRBUL + baru NOT NULL, pada:
- `product_destructions`
- `daily_records`
- `personnel`
- `station_items`
- `tenant_configs` (1 row → jadi per resto; kolom lama tetap untuk backward-compat sementara)

### `users`
- + `store_id INTEGER NULL REFERENCES stores(id)` — NULL = super_admin (cross-resto), non-null = scoped
- Role & password logic tetap

### Indexes
`store_id` masuk composite index utama query: `(store_id, business_date, shift)` pada `product_destructions` & `daily_records`.

## 4. Perilaku per Tier

| Aspek | CKRBUL | Resto baru |
|---|---|---|
| Mode input | Manual + Paste | **Paste only** |
| Catalog station items | Ada, kelola via admin | Kosong; item dynamic dari paste |
| Validasi produk | Exact-match catalog | Skip — semua manual entry |
| Station section paste | NOODLE/DIMSUM/BAR/PRODUKSI | Sama |
| Shift & business date | 4 shift, cutoff 05:00 WIB | Sama |
| PDF generate | Server-side legacy (tidak disentuh) | Server-side render, upload ke folder netral resto |
| PDF client-side (hemat Vercel) | Tidak diubah | **Render di browser (jspdf)** — hanya upload hasil ke Drive via endpoint ringan |

## 5. Drive & PDF (resto baru saja)

- 1 akun Google **netral** baru (bukan QC CKRBUL) → OAuth credential disimpan sebagai env var kedua (`GOOGLE_*_NEUTRAL`)
- `stores.drive_folder_id` per resto; PDF upload ke folder masing-masing
- `api/generate-pdf.ts`: branching — `store.drive_account === 'legacy'` → jalur lama persis; `'neutral'` → kredensial netral + folder resto; kalau request `mode=download-only` (dari client-render), cukup upload bytes yang dikirim client
- Owner file = akun netral — tidak ada jejak kepemilikan QC CKRBUL

## 6. Auth, API & Client

- Login: resolve `user.store_id`; semua query API scoped `store_id`
- Super admin: **store switcher** (pilih resto aktif untuk admin pages; cross-resto read)
- API keys: warisi scope dari `owner user.store_id`
- Offline queue (IndexedDB): tak berubah — server yang scope via JWT
- Frontend: baca `features` resto dari response auth/tenant-config → sembunyikan mode manual & catalog untuk resto paste-only; tombol katalog tersembunyi

## 7. Super Admin UI

- Halaman baru **Kelola Resto**: create (code, name, drive_folder_id, features), edit, activate/deactivate
- `admin-personnel`, `admin-station-items`, `admin-users`, `admin-history`: store switcher; data resto aktif
- `admin-panel`: statik ringkas per resto aktif

## 8. Hemat Vercel (Opsi 1)

1. **Polling `shift-status`** 30s → 60s (semua resto; bukan bagian logic PDF) — **done**
2. **Catalog gak di-fetch untuk resto tanpa catalog** (features flag, `enabled: catalogEnabled`) — **done (Fase 3)**
3. **PDF resto baru render di browser** — **DEFERRED**: butuh duplikasi asset-loading client-side + endpoint upload baru + split lease logic. Nilai hemat baru terasa kalau volume resto baru tinggi; CKRBUL (heavy) memang wajib tetap server-side per batasan zona larangan. Implement saat ada resto baru aktif dengan traffic nyata.
4. (Defer) Signed Blob URL untuk menghilangkan proxy `/api/signatures` — ditunda karena menyentuh URL tersimpan & renderer CKRBUL; revisi fase terpisah nanti bila perlu

## 9. Migrasi & Rollback

- Migration SQL idempoten: `stores` seed CKRBUL → tambah kolom nullable → backfill → validasi count → set NOT NULL → composite indexes
- Rollback: kolom/nullable turun, tabel `stores` tetap (drop terakhir)
- Semua endpoint lama tanpa `store_id` header tetap jalan: server resolve dari JWT (default CKRBUL selama transisi)

## 10. Verifikasi

- `typecheck`, `typecheck:api`, `build`, semua `check:*` lama hijau
- Isolasi: user resto A tidak bisa baca/tulis resto B (uji API langsung 403/404)
- CKRBUL: alur manual, paste, PDF, Drive — identik (regression manual + test)
- Resto baru: paste-only tanpa catalog; PDF masuk folder netral masing-masing
- Super admin: create resto → login user resto → submit paste → PDF → folder benar
