/**
 * Create station_items table and seed catalog data from docs/02-DATA.md
 */

import { neon } from '@neondatabase/serverless'

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set')
    process.exit(1)
  }

  const sql = neon(databaseUrl)

  // 1. Create table
  console.log('Creating station_items table...')
  await sql`
    CREATE TABLE IF NOT EXISTS station_items (
      id              SERIAL PRIMARY KEY,
      station         TEXT NOT NULL,
      nama_produk     TEXT NOT NULL,
      unit            TEXT NOT NULL DEFAULT 'PCS',
      kode_lot_wajib  BOOLEAN NOT NULL DEFAULT FALSE,
      is_manual       BOOLEAN NOT NULL DEFAULT FALSE,
      sort_order      INTEGER NOT NULL DEFAULT 0,
      status          TEXT NOT NULL DEFAULT 'active',
      created_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `
  await sql`CREATE INDEX IF NOT EXISTS idx_si_station ON station_items(station)`
  await sql`CREATE INDEX IF NOT EXISTS idx_si_status ON station_items(status)`
  console.log('[OK] Table: station_items\n')

  // 2. Check if already seeded
  const existing = await sql`SELECT COUNT(*) as cnt FROM station_items`
  if (Number(existing[0].cnt) > 0) {
    console.log(`[SKIP] station_items already has ${existing[0].cnt} rows. Skipping seed.`)
    return
  }

  // 3. Seed data from docs/02-DATA.md
  console.log('Seeding station items...\n')

  // NOODLE station
  const noodleItems = [
    { nama: 'PANGSIT GORENG', unit: 'PCS', lot: false },
    { nama: 'MIE GACOAN LEVEL 0', unit: 'PORSI', lot: false },
    { nama: 'MIE GACOAN LEVEL 1', unit: 'PORSI', lot: false },
    { nama: 'MIE GACOAN LEVEL 2', unit: 'PORSI', lot: false },
    { nama: 'MIE GACOAN LEVEL 3', unit: 'PORSI', lot: false },
    { nama: 'MIE GACOAN LEVEL 4', unit: 'PORSI', lot: false },
    { nama: 'MIE GACOAN LEVEL 6', unit: 'PORSI', lot: false },
    { nama: 'MIE GACOAN LEVEL 8', unit: 'PORSI', lot: false },
    { nama: 'MIE HOMPIMPA LEVEL 1', unit: 'PORSI', lot: false },
    { nama: 'MIE HOMPIMPA LEVEL 2', unit: 'PORSI', lot: false },
    { nama: 'MIE HOMPIMPA LEVEL 3', unit: 'PORSI', lot: false },
    { nama: 'MIE HOMPIMPA LEVEL 4', unit: 'PORSI', lot: false },
    { nama: 'MIE HOMPIMPA LEVEL 6', unit: 'PORSI', lot: false },
    { nama: 'MIE HOMPIMPA LEVEL 8', unit: 'PORSI', lot: false },
    { nama: 'PAPERBOX MIE', unit: 'PCS', lot: false },
    { nama: 'MIE POLOS', unit: 'PCS', lot: true },
    { nama: 'KERUPUK GORENG', unit: 'GRAM', lot: false },
  ]

  // DIMSUM station
  const dimsumItems = [
    { nama: 'UDANG KEJU', unit: 'PCS', lot: false },
    { nama: 'UDANG RAMBUTAN', unit: 'PCS', lot: false },
    { nama: 'LUMPIA UDANG', unit: 'PCS', lot: false },
    { nama: 'SIOMAY AYAM', unit: 'PCS', lot: false },
    { nama: 'PAPERBOX DIMSUM', unit: 'PCS', lot: false },
    { nama: 'SURAI NAGA', unit: 'GRAM', lot: true },
    { nama: 'PENTOL', unit: 'PCS', lot: true },
  ]

  // BAR station
  const barItems = [
    { nama: 'APEL', unit: 'GRAM', lot: false },
    { nama: 'PEAR', unit: 'GRAM', lot: false },
    { nama: 'BELIMBING', unit: 'GRAM', lot: false },
    { nama: 'JERUK NIPIS', unit: 'GRAM', lot: false },
    { nama: 'APEL BUSUK', unit: 'GRAM', lot: false },
    { nama: 'PEAR BUSUK', unit: 'GRAM', lot: false },
    { nama: 'BELIMBING BUSUK', unit: 'GRAM', lot: false },
    { nama: 'STROBERI SUSUT', unit: 'GRAM', lot: false },
    { nama: 'STOBERI BUSUK', unit: 'GRAM', lot: false },
    { nama: 'CUP 16', unit: 'PCS', lot: false },
    { nama: 'CUP 14', unit: 'PCS', lot: false },
    { nama: 'CUP 12', unit: 'PCS', lot: false },
  ]

  // PRODUKSI station
  const produksiItems = [
    { nama: 'KULIT PANGSIT', unit: 'GRAM', lot: true },
    { nama: 'CABE RAWIT', unit: 'GRAM', lot: false },
    { nama: 'KERUPUK GORENG', unit: 'GRAM', lot: false },
  ]

  const allItems: Array<{ station: string; nama: string; unit: string; lot: boolean; isManual: boolean }> = [
    ...noodleItems.map((i) => ({ ...i, station: 'NOODLE', isManual: false })),
    { station: 'NOODLE', nama: 'LAINNYA', unit: 'PCS', lot: false, isManual: true },
    ...dimsumItems.map((i) => ({ ...i, station: 'DIMSUM', isManual: false })),
    ...barItems.map((i) => ({ ...i, station: 'BAR', isManual: false })),
    { station: 'BAR', nama: 'LAINNYA', unit: 'PCS', lot: false, isManual: true },
    ...produksiItems.map((i) => ({ ...i, station: 'PRODUKSI', isManual: false })),
    { station: 'PRODUKSI', nama: 'LAINNYA', unit: 'PCS', lot: false, isManual: true },
  ]

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i]
    await sql`
      INSERT INTO station_items (station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order)
      VALUES (${item.station}, ${item.nama}, ${item.unit}, ${item.lot}, ${item.isManual}, ${i + 1})
    `
  }

  console.log(`[OK] Seeded ${allItems.length} station items`)
  console.log(`     NOODLE: ${noodleItems.length + 1} items`)
  console.log(`     DIMSUM: ${dimsumItems.length} items`)
  console.log(`     BAR: ${barItems.length + 1} items`)
  console.log(`     PRODUKSI: ${produksiItems.length + 1} items`)
  console.log('\n--- Done! ---')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
