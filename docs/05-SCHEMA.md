# 05 — SCHEMA: Database Schema

## 1. Tabel: `users`

Menyimpan user yang bisa login ke aplikasi.

```sql
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,          -- scrypt: "salt:hash"
    display_name  TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'admin_store',  -- 'super_admin' | 'admin_store'
    status        TEXT NOT NULL DEFAULT 'active',       -- 'active' | 'inactive'
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | SERIAL | Auto-increment PK |
| `username` | TEXT | Unique, lowercase |
| `password_hash` | TEXT | Format: `salt:hash` (scrypt) |
| `display_name` | TEXT | Nama display untuk UI |
| `role` | TEXT | `super_admin` / `admin_store` |
| `status` | TEXT | `active` / `inactive` |
| `created_at` | TIMESTAMPTZ | Auto-set |

---

## 2. Tabel: `personnel`

Menyimpan daftar QC dan Manager untuk paraf digital.

```sql
CREATE TABLE personnel (
    id             SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,             -- Short name (display, e.g. "Ahmad")
    full_name      TEXT NOT NULL DEFAULT '',
    role           TEXT NOT NULL,             -- 'qc' | 'manager'
    signature_url  TEXT NOT NULL DEFAULT '',  -- Proxy URL signature image
    status         TEXT NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);
```

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | SERIAL | Auto-increment |
| `name` | TEXT | Nama pendek untuk dropdown |
| `full_name` | TEXT | Nama lengkap |
| `role` | TEXT | `qc` atau `manager` |
| `signature_url` | TEXT | URL proxy gambar signature |
| `status` | TEXT | `active` / `inactive` |
| `created_at` | TIMESTAMPTZ | Auto-set |

---

## 3. Tabel: `product_destructions` ⭐ *Core Business Table*

Menyimpan semua data waste entry. Ini adalah tabel utama aplikasi.

```sql
CREATE TABLE product_destructions (
    id                        SERIAL PRIMARY KEY,
    business_date             DATE NOT NULL,          -- Business date (WIB, 05:00 cutoff)
    shift                     TEXT NOT NULL,           -- 'OPENING' | 'MIDDLE' | 'CLOSING' | 'MIDNIGHT'
    store_name                TEXT NOT NULL DEFAULT '',
    kategori_induk            TEXT NOT NULL,           -- 'NOODLE' | 'DIMSUM' | 'BAR' | 'PRODUKSI' | 'TESTER'
    nama_produk               TEXT NOT NULL,           -- Product name
    kode_produk               TEXT NOT NULL DEFAULT '',-- Lot code / expired date
    jumlah_produk             INTEGER NOT NULL,        -- Quantity
    unit                      TEXT NOT NULL DEFAULT '',-- 'PORSI' | 'PCS' | 'GRAM' | 'PACK'
    metode_pemusnahan         TEXT NOT NULL DEFAULT '',
    alasan_pemusnahan         TEXT NOT NULL DEFAULT '',
    jam_tanggal_pemusnahan    TEXT NOT NULL DEFAULT '',
    paraf_qc_url              TEXT NOT NULL DEFAULT '', -- Proxy URL QC signature
    paraf_qc_name             TEXT NOT NULL DEFAULT '',
    paraf_manager_url         TEXT NOT NULL DEFAULT '', -- Proxy URL Manager signature
    paraf_manager_name        TEXT NOT NULL DEFAULT '',
    dokumentasi_urls          TEXT NOT NULL DEFAULT '', -- \n-delimited proxy URLs
    submitted_by              TEXT NOT NULL DEFAULT '', -- Username
    created_at                TIMESTAMPTZ DEFAULT NOW()
);
```

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | SERIAL | Auto-increment PK |
| `business_date` | DATE | Business date (WIB, pake 05:00 cutoff). Bukan `tanggal` dari form. |
| `shift` | TEXT | `OPENING` / `MIDDLE` / `CLOSING` / `MIDNIGHT` |
| `store_name` | TEXT | Nama store (contoh: `BEKASI KP. BULU`) |
| `kategori_induk` | TEXT | `NOODLE` / `DIMSUM` / `BAR` / `PRODUKSI` / `TESTER` |
| `nama_produk` | TEXT | Nama produk UPPERCASE |
| `kode_produk` | TEXT | Kode lot atau tanggal expired |
| `jumlah_produk` | INTEGER | Quantity (integer) |
| `unit` | TEXT | `PORSI` / `PCS` / `GRAM` / `PACK` |
| `metode_pemusnahan` | TEXT | `DIBUANG`, `DIMUSNAHKAN`, dll. |
| `alasan_pemusnahan` | TEXT | `EXPIRED`, `RUSAK`, `OVER PRODUKSI`, dll. |
| `jam_tanggal_pemusnahan` | TEXT | Format: `08:00 WIB` |
| `paraf_qc_url` | TEXT | Proxy URL signature QC |
| `paraf_qc_name` | TEXT | Nama QC yang memaraf |
| `paraf_manager_url` | TEXT | Proxy URL signature Manager |
| `paraf_manager_name` | TEXT | Nama Manager yang memaraf |
| `dokumentasi_urls` | TEXT | `\n`-delimited proxy URLs foto dokumentasi |
| `submitted_by` | TEXT | Username yang submit |
| `created_at` | TIMESTAMPTZ | Auto-set |

### Indexes:
```sql
CREATE INDEX idx_pd_business_date ON product_destructions(business_date);
CREATE INDEX idx_pd_shift ON product_destructions(shift);
CREATE INDEX idx_pd_kategori ON product_destructions(kategori_induk);
CREATE INDEX idx_pd_date_shift ON product_destructions(business_date, shift);
```

---

## 4. Tabel: `daily_records` ⭐ *Shift Status Tracker*

Menyimpan status per-shift untuk setiap business date.
Endpoint shift-status dan PDF unlock logic membaca dari tabel ini.

```sql
CREATE TABLE daily_records (
    id                SERIAL PRIMARY KEY,
    business_date     DATE NOT NULL,       -- Business date
    shift             TEXT NOT NULL,        -- 'OPENING' | 'MIDDLE' | 'CLOSING' | 'MIDNIGHT'
    done              BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_by      TEXT NOT NULL DEFAULT '',
    submitted_at      TIMESTAMPTZ,
    pdf_generated     BOOLEAN NOT NULL DEFAULT FALSE,
    pdf_generated_at  TIMESTAMPTZ,
    UNIQUE(business_date, shift)
);
```

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | SERIAL | Auto-increment |
| `business_date` | DATE | Business date |
| `shift` | TEXT | `OPENING` / `MIDDLE` / `CLOSING` / `MIDNIGHT` |
| `done` | BOOLEAN | `TRUE` jika sudah di-submit |
| `submitted_by` | TEXT | Username yang submit pertama |
| `submitted_at` | TIMESTAMPTZ | Waktu submit |
| `pdf_generated` | BOOLEAN | `TRUE` jika PDF sudah di-generate |
| `pdf_generated_at` | TIMESTAMPTZ | Waktu generate PDF |

### Indexes:
```sql
CREATE INDEX idx_dr_date ON daily_records(business_date);
```

### PDF Unlock Logic:
```sql
-- Cek apakah MIDNIGHT sudah Done:
SELECT done FROM daily_records
WHERE business_date = $1 AND shift = 'MIDNIGHT';

-- Jika done = TRUE → PDF unlocked ✅
-- Jika done = FALSE → PDF locked ❌
```

---

## 5. Tabel: `tenant_configs`

Menyimpan konfigurasi aplikasi. Hanya 1 baris (single-tenant).

```sql
CREATE TABLE tenant_configs (
    id            SERIAL PRIMARY KEY,
    store_name    TEXT NOT NULL DEFAULT 'BEKASI KP. BULU',
    extra_config  JSONB DEFAULT '{}',
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `id` | SERIAL | Auto-increment |
| `store_name` | TEXT | Nama store default |
| `extra_config` | JSONB | Config tambahan |
| `updated_at` | TIMESTAMPTZ | Auto-update |

---

## 6. Tabel: `activity_logs`

Menyimpan log aktivitas user.

```sql
CREATE TABLE activity_logs (
    id           SERIAL PRIMARY KEY,
    action       TEXT NOT NULL DEFAULT '',
    category     TEXT NOT NULL DEFAULT '',
    user_id      INTEGER DEFAULT 0,
    username     TEXT NOT NULL DEFAULT '',
    ip_address   TEXT NOT NULL DEFAULT '',
    user_agent   TEXT NOT NULL DEFAULT '',
    details      JSONB DEFAULT '{}',
    status       TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);
```

---

## 7. Tabel: `api_keys`

Menyimpan API key persisten (format `awas_live_...`). Lookup via SHA-256 hash;
nilai asli terenkripsi envelope AES-256-GCM (butuh re-auth password untuk reveal).

```sql
CREATE TABLE api_keys (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id),
    name           TEXT NOT NULL,
    key_prefix     TEXT NOT NULL,
    key_hash       TEXT NOT NULL UNIQUE,
    key_ciphertext TEXT NOT NULL,
    key_iv         TEXT NOT NULL,
    key_tag        TEXT NOT NULL,
    expires_at     TIMESTAMPTZ,
    revoked_at     TIMESTAMPTZ,
    last_used_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_active ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX uq_api_keys_active_name ON api_keys(user_id, name) WHERE revoked_at IS NULL;
```

| Kolom | Tipe | Catatan |
|-------|------|---------|
| `user_id` | INTEGER | FK ke `users.id`; key mewarisi role user ini |
| `key_prefix` | TEXT | Prefix untuk identifikasi (mask `prefix••••`) |
| `key_hash` | TEXT | SHA-256 dari key asli (kolom lookup) |
| `key_ciphertext` / `key_iv` / `key_tag` | TEXT | Envelope AES-256-GCM (dienkripsi dengan `API_KEY_ENCRYPTION_KEY`) |
| `expires_at` | TIMESTAMPTZ | NULL = tidak kedaluwarsa (opsi `never`) |
| `revoked_at` | TIMESTAMPTZ | NULL = masih aktif; max 5 key aktif per user |

---

## 8. Tabel: `waste_submission_locks`

Anti double-submit per station/shift/date (dipakai bersama `pg_advisory_xact_lock`
dan `ON CONFLICT DO NOTHING`).

```sql
CREATE TABLE waste_submission_locks (
    business_date DATE NOT NULL,
    shift         TEXT NOT NULL,
    station       TEXT NOT NULL,
    PRIMARY KEY (business_date, shift, station)
);
```

Setelah migrasi multi-resto: kolom `store_id INTEGER REFERENCES stores(id)`
ditambahkan + unique per store.

---

## 9. Tabel: `stores` + kolom `store_id` (multi-resto)

Dibuat oleh `scripts/migrate-multi-resto.ts`. Setiap store punya kode unik,
akun Drive, dan folder ID sendiri.

```sql
CREATE TABLE stores (
    id              SERIAL PRIMARY KEY,
    code            TEXT NOT NULL UNIQUE,   -- contoh: 'CKRBUL'
    name            TEXT NOT NULL,          -- contoh: 'GACOAN KAMPUNG BULU'
    drive_account   TEXT NOT NULL DEFAULT 'legacy',  -- 'legacy' | 'neutral'
    drive_folder_id TEXT NOT NULL DEFAULT '',
    features        JSONB NOT NULL DEFAULT '{}',
    status          TEXT NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

Kolom `store_id INTEGER REFERENCES stores(id)` ditambahkan ke tabel:
`product_destructions`, `daily_records`, `personnel`, `station_items`,
`tenant_configs` (semua `NOT NULL` setelah backfill ke store `CKRBUL`)
dan `users` (nullable; `super_admin` = NULL = cross-resto).

Index tambahan:
```sql
CREATE INDEX idx_pd_store_date_shift ON product_destructions(store_id, business_date, shift);
CREATE INDEX idx_dr_store_date ON daily_records(store_id, business_date);
CREATE INDEX idx_personnel_store ON personnel(store_id);
CREATE INDEX idx_station_items_store ON station_items(store_id);
```

Unique yang di-scope per store:
```sql
-- daily_records: UNIQUE(business_date, shift) -> UNIQUE(store_id, business_date, shift)
CREATE UNIQUE INDEX uq_daily_records_store_date_shift ON daily_records(store_id, business_date, shift);
```

> Catatan drift: `scripts/init-schema.sql` memuat 8 tabel (tanpa `stores`/
> `store_id`), sedangkan `scripts/migrate-multi-resto.ts` yang menambahkan
> `stores` + `store_id`. Skema definitif = `init-schema.sql` + migrasi
> berurutan. Lihat roadmap: satukan ke `migrations/NNN_*.sql`.

---

## 10. Init SQL

```sql
-- Jalankan sekali saat setup database:
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'admin_store',
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personnel (
    id             SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    full_name      TEXT NOT NULL DEFAULT '',
    role           TEXT NOT NULL,
    signature_url  TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_destructions (
    id                        SERIAL PRIMARY KEY,
    business_date             DATE NOT NULL,
    shift                     TEXT NOT NULL,
    store_name                TEXT NOT NULL DEFAULT '',
    kategori_induk            TEXT NOT NULL,
    nama_produk               TEXT NOT NULL,
    kode_produk               TEXT NOT NULL DEFAULT '',
    jumlah_produk             INTEGER NOT NULL,
    unit                      TEXT NOT NULL DEFAULT '',
    metode_pemusnahan         TEXT NOT NULL DEFAULT '',
    alasan_pemusnahan         TEXT NOT NULL DEFAULT '',
    jam_tanggal_pemusnahan    TEXT NOT NULL DEFAULT '',
    paraf_qc_url              TEXT NOT NULL DEFAULT '',
    paraf_qc_name             TEXT NOT NULL DEFAULT '',
    paraf_manager_url         TEXT NOT NULL DEFAULT '',
    paraf_manager_name        TEXT NOT NULL DEFAULT '',
    dokumentasi_urls          TEXT NOT NULL DEFAULT '',
    submitted_by              TEXT NOT NULL DEFAULT '',
    created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pd_business_date ON product_destructions(business_date);
CREATE INDEX IF NOT EXISTS idx_pd_date_shift ON product_destructions(business_date, shift);

CREATE TABLE IF NOT EXISTS daily_records (
    id                SERIAL PRIMARY KEY,
    business_date     DATE NOT NULL,
    shift             TEXT NOT NULL,
    done              BOOLEAN NOT NULL DEFAULT FALSE,
    submitted_by      TEXT NOT NULL DEFAULT '',
    submitted_at      TIMESTAMPTZ,
    pdf_generated     BOOLEAN NOT NULL DEFAULT FALSE,
    pdf_generated_at  TIMESTAMPTZ,
    UNIQUE(business_date, shift)
);

CREATE INDEX IF NOT EXISTS idx_dr_date ON daily_records(business_date);

CREATE TABLE IF NOT EXISTS tenant_configs (
    id            SERIAL PRIMARY KEY,
    store_name    TEXT NOT NULL DEFAULT 'BEKASI KP. BULU',
    extra_config  JSONB DEFAULT '{}',
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id           SERIAL PRIMARY KEY,
    action       TEXT NOT NULL DEFAULT '',
    category     TEXT NOT NULL DEFAULT '',
    user_id      INTEGER DEFAULT 0,
    username     TEXT NOT NULL DEFAULT '',
    ip_address   TEXT NOT NULL DEFAULT '',
    user_agent   TEXT NOT NULL DEFAULT '',
    details      JSONB DEFAULT '{}',
    status       TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
```

---

## 11. Seed Data (Data Real)

### Users
```sql
-- Super Admin (password: ditentukan saat setup via hashPassword())
INSERT INTO users (username, password_hash, display_name, role, status)
VALUES ('admin', '<hash>', 'Super Admin', 'super_admin', 'active');

-- Regular store user
INSERT INTO users (username, password_hash, display_name, role, status)
VALUES ('user_store', '<hash>', 'User Store', 'admin_store', 'active');
```

### Personnel (Contoh — kosongkan, isi manual via settings)
```sql
-- Contoh saja, data real akan diisi manual via Settings > Personnel
INSERT INTO personnel (name, full_name, role, signature_url, status) VALUES
  ('QC1', 'QC Contoh 1', 'qc', '<blob_url>', 'active'),
  ('MGR1', 'Manager Contoh 1', 'manager', '<blob_url>', 'active');
```

### File Signature
Folder `public/signatures/` berisi file contoh. Upload via settings panel untuk
mendapatkan blob URL, lalu simpan di kolom `signature_url` tabel `personnel`.

### Station Items
Data real selengkapnya ada di `docs/02-DATA.md` — berisi 4 station,
~40 produk dengan unit masing-masing.

### Config
```sql
INSERT INTO tenant_configs (store_name) VALUES ('BEKASI KP. BULU');
```
