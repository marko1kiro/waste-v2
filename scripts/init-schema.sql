-- ============================================
-- AWAS v4 — Database Schema Init
-- Run this once on a fresh Neon PostgreSQL DB
-- ============================================

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL DEFAULT '',
    role          TEXT NOT NULL DEFAULT 'admin_store',
    status        TEXT NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Personnel (QC & Manager untuk paraf)
CREATE TABLE IF NOT EXISTS personnel (
    id             SERIAL PRIMARY KEY,
    name           TEXT NOT NULL,
    full_name      TEXT NOT NULL DEFAULT '',
    role           TEXT NOT NULL,
    signature_url  TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'active',
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Product Destructions (Core Business Table)
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
CREATE INDEX IF NOT EXISTS idx_pd_shift ON product_destructions(shift);
CREATE INDEX IF NOT EXISTS idx_pd_kategori ON product_destructions(kategori_induk);
CREATE INDEX IF NOT EXISTS idx_pd_date_shift ON product_destructions(business_date, shift);

-- 4. Daily Records (Shift Status Tracker)
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

-- 5. Tenant Configs
CREATE TABLE IF NOT EXISTS tenant_configs (
    id            SERIAL PRIMARY KEY,
    store_name    TEXT NOT NULL DEFAULT 'BEKASI KP. BULU',
    extra_config  JSONB DEFAULT '{}',
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Activity Logs
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
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);

CREATE TABLE IF NOT EXISTS api_keys (
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

CREATE INDEX IF NOT EXISTS idx_api_keys_user_active ON api_keys(user_id) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_active_name ON api_keys(user_id, name) WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS waste_submission_locks (
    business_date DATE NOT NULL,
    shift         TEXT NOT NULL,
    station       TEXT NOT NULL,
    PRIMARY KEY (business_date, shift, station)
);
