/**
 * Database Init Script
 * Creates all tables and indexes for AWAS v4
 * Usage: DATABASE_URL=... npx tsx scripts/init-db.ts
 */

import { neon } from '@neondatabase/serverless'

async function initDB() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set')
    process.exit(1)
  }

  const sql = neon(databaseUrl)

  console.log('Initializing AWAS v4 database schema...\n')

  // 1. Users
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      display_name  TEXT NOT NULL DEFAULT '',
      role          TEXT NOT NULL DEFAULT 'admin_store',
      status        TEXT NOT NULL DEFAULT 'active',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('[OK] Table: users')

  // 2. Personnel
  await sql`
    CREATE TABLE IF NOT EXISTS personnel (
      id             SERIAL PRIMARY KEY,
      name           TEXT NOT NULL,
      full_name      TEXT NOT NULL DEFAULT '',
      role           TEXT NOT NULL,
      signature_url  TEXT NOT NULL DEFAULT '',
      status         TEXT NOT NULL DEFAULT 'active',
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('[OK] Table: personnel')

  // 3. Product Destructions
  await sql`
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
    )
  `
  console.log('[OK] Table: product_destructions')

  // Indexes for product_destructions
  await sql`CREATE INDEX IF NOT EXISTS idx_pd_business_date ON product_destructions(business_date)`
  await sql`CREATE INDEX IF NOT EXISTS idx_pd_shift ON product_destructions(shift)`
  await sql`CREATE INDEX IF NOT EXISTS idx_pd_kategori ON product_destructions(kategori_induk)`
  await sql`CREATE INDEX IF NOT EXISTS idx_pd_date_shift ON product_destructions(business_date, shift)`
  console.log('[OK] Indexes: product_destructions')

  // 4. Daily Records
  await sql`
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
    )
  `
  console.log('[OK] Table: daily_records')

  await sql`CREATE INDEX IF NOT EXISTS idx_dr_date ON daily_records(business_date)`
  console.log('[OK] Index: daily_records')

  // 5. Tenant Configs
  await sql`
    CREATE TABLE IF NOT EXISTS tenant_configs (
      id            SERIAL PRIMARY KEY,
      store_name    TEXT NOT NULL DEFAULT 'BEKASI KP. BULU',
      extra_config  JSONB DEFAULT '{}',
      updated_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `
  console.log('[OK] Table: tenant_configs')

  // 6. Activity Logs
  await sql`
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
    )
  `
  console.log('[OK] Table: activity_logs')

  await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC)`
  await sql`CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action)`
  console.log('[OK] Indexes: activity_logs')

  console.log('\n--- Schema init complete! All tables created. ---')
}

initDB().catch((err) => {
  console.error('Init failed:', err)
  process.exit(1)
})
