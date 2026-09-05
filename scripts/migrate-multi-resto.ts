/**
 * Multi-Resto Migration (Fase 1)
 * Usage: npx tsx scripts/migrate-multi-resto.ts  (DATABASE_URL via .env / env)
 *
 * Idempotent: aman dijalankan berkali-kali.
 * 1. Buat tabel stores + seed CKRBUL
 * 2. Tambah kolom store_id (nullable) di 5 tabel
 * 3. Backfill semua NULL -> CKRBUL
 * 4. Set NOT NULL (kecuali users.store_id)
 * 5. Composite indexes
 */

import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const STORE_TABLES = [
  'product_destructions',
  'daily_records',
  'personnel',
  'station_items',
  'tenant_configs',
] as const

type StoreTable = (typeof STORE_TABLES)[number]

function assertWhitelist(table: string): asserts table is StoreTable {
  if (!STORE_TABLES.includes(table as StoreTable)) throw new Error(`Unexpected table: ${table}`)
}

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set')
    process.exit(1)
  }

  const sql = neon(databaseUrl)
  const log = (msg: string) => console.log(`[OK] ${msg}`)

  // 1. Tabel stores
  await sql`
    CREATE TABLE IF NOT EXISTS stores (
        id              SERIAL PRIMARY KEY,
        code            TEXT NOT NULL UNIQUE,
        name            TEXT NOT NULL,
        drive_account   TEXT NOT NULL DEFAULT 'legacy',
        drive_folder_id TEXT NOT NULL DEFAULT '',
        features        JSONB NOT NULL DEFAULT '{}',
        status          TEXT NOT NULL DEFAULT 'active',
        created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `
  log('Table stores ready')

  await sql`
    INSERT INTO stores (code, name, drive_account, features)
    VALUES ('CKRBUL', 'GACOAN KAMPUNG BULU', 'legacy', '{"manual_mode":true,"catalog":true}'::jsonb)
    ON CONFLICT (code) DO NOTHING
  `
  log('Store CKRBUL seeded')

  const storeRow = await sql`SELECT id FROM stores WHERE code = 'CKRBUL' LIMIT 1`
  if (!storeRow.length) throw new Error('CKRBUL store missing after seed')
  const ckrbulId = storeRow[0].id as number
  log(`CKRBUL store id = ${ckrbulId}`)

  // 2. Kolom store_id (nullable dulu)
  for (const table of STORE_TABLES) {
    assertWhitelist(table)
    await sql(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id)`)
    log(`${table}.store_id added (nullable)`)
  }

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id)`
  log('users.store_id added (nullable)')

  // 3. Backfill NULL -> CKRBUL
  for (const table of STORE_TABLES) {
    assertWhitelist(table)
    const result = await sql(`UPDATE ${table} SET store_id = $1 WHERE store_id IS NULL`, [ckrbulId])
    log(`${table}: ${result.rowCount ?? 0} row(s) backfilled to CKRBUL`)
  }

  const usersBackfill = await sql(`UPDATE users SET store_id = $1 WHERE store_id IS NULL AND role = 'admin_store'`, [ckrbulId])
  log(`users (admin_store): ${usersBackfill.rowCount ?? 0} row(s) backfilled to CKRBUL`)
  log('users (super_admin) left NULL = cross-resto')

  // 4. NOT NULL (kecuali users)
  for (const table of STORE_TABLES) {
    assertWhitelist(table)
    await sql(`ALTER TABLE ${table} ALTER COLUMN store_id SET NOT NULL`)
    log(`${table}.store_id set NOT NULL`)
  }

  // 5. Composite indexes (idempoten via IF NOT EXISTS)
  await sql`CREATE INDEX IF NOT EXISTS idx_pd_store_date_shift ON product_destructions(store_id, business_date, shift)`
  await sql`CREATE INDEX IF NOT EXISTS idx_dr_store_date ON daily_records(store_id, business_date)`
  await sql`CREATE INDEX IF NOT EXISTS idx_personnel_store ON personnel(store_id)`
  await sql`CREATE INDEX IF NOT EXISTS idx_station_items_store ON station_items(store_id)`
  log('Composite indexes ready')

  // 5b. Multi-store unique constraints
  // daily_records: UNIQUE(business_date, shift) -> UNIQUE(store_id, business_date, shift)
  await sql`ALTER TABLE daily_records DROP CONSTRAINT IF EXISTS daily_records_business_date_shift_key`
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_records_store_date_shift ON daily_records(store_id, business_date, shift)`
  log('daily_records unique per store')

  // waste_submission_locks: tambah store_id + unique per store
  await sql`ALTER TABLE waste_submission_locks ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id)`
  await sql(`UPDATE waste_submission_locks SET store_id = $1 WHERE store_id IS NULL`, [ckrbulId])
  await sql(`ALTER TABLE waste_submission_locks ALTER COLUMN store_id SET NOT NULL`)
  await sql(`CREATE INDEX IF NOT EXISTS idx_wsl_store_date_shift ON waste_submission_locks(store_id, business_date, shift)`)
  log('waste_submission_locks store-scoped')

  // waste_submission_locks: PK lama (business_date, shift, station) blokir cross-store -> ganti PK ber-store
  const oldPk = await sql`
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'waste_submission_locks'::regclass
      AND conname = 'waste_submission_locks_pkey'
      AND pg_get_constraintdef(oid) NOT LIKE '%store_id%'
    LIMIT 1
  `
  if (oldPk.length) {
    await sql`ALTER TABLE waste_submission_locks DROP CONSTRAINT waste_submission_locks_pkey`
    await sql`ALTER TABLE waste_submission_locks ADD CONSTRAINT waste_submission_locks_pkey PRIMARY KEY (store_id, business_date, shift, station)`
    log('waste_submission_locks PK replaced with store-scoped PK')
  } else {
    log('waste_submission_locks PK already store-scoped')
  }

  // 6. Validasi akhir
  const checks = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM stores) AS stores,
      (SELECT COUNT(*)::int FROM product_destructions WHERE store_id IS NULL) AS pd_null,
      (SELECT COUNT(*)::int FROM daily_records WHERE store_id IS NULL) AS dr_null,
      (SELECT COUNT(*)::int FROM personnel WHERE store_id IS NULL) AS personnel_null,
      (SELECT COUNT(*)::int FROM station_items WHERE store_id IS NULL) AS si_null,
      (SELECT COUNT(*)::int FROM tenant_configs WHERE store_id IS NULL) AS tc_null
  `
  const c = checks[0]
  if (c.pd_null || c.dr_null || c.personnel_null || c.si_null || c.tc_null) {
    throw new Error(`Validation failed: ${JSON.stringify(c)}`)
  }
  log(`Validation passed: ${c.stores} store(s), 0 NULL store_id`)

  console.log('\n--- Migration complete ---')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
