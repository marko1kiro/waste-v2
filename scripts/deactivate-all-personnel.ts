/**
 * DESTRUCTIVE: menonaktifkan SELURUH personnel yang sedang aktif.
 *
 * Safety guard:
 *   - Default = DRY-RUN: hanya menampilkan baris yang akan terdampak,
 *     TIDAK mengubah apa pun.
 *   - Eksekusi nyata HANYA dengan flag --confirm.
 *   - Jika host DATABASE_URL terlihat seperti produksi (mengandung
 *     'neon.tech'), script MENOLAK berjalan kecuali flag
 *     --i-know-this-is-prod juga diberikan.
 *
 * Contoh:
 *   npx tsx scripts/deactivate-all-personnel.ts                                # dry-run
 *   npx tsx scripts/deactivate-all-personnel.ts --confirm                      # eksekusi (non-prod)
 *   npx tsx scripts/deactivate-all-personnel.ts --confirm --i-know-this-is-prod # eksekusi prod
 */

import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const args = new Set(process.argv.slice(2))
const CONFIRM = args.has('--confirm')
const KNOWS_PROD = args.has('--i-know-this-is-prod')

function databaseHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').hostname
  } catch {
    return ''
  }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL belum di-set.')
  process.exit(1)
}

const host = databaseHost()
if (host.includes('neon.tech') && !KNOWS_PROD) {
  console.error(`REFUSED: host DATABASE_URL "${host}" terlihat seperti database produksi.`)
  console.error('Jalankan ulang dengan --confirm --i-know-this-is-prod jika Anda benar-benar yakin.')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)

const rows = await sql`SELECT id, name, role FROM personnel WHERE status = 'active'`
console.log('Active personnel:', rows.length)
for (const r of rows) {
  console.log(`  ${r.id} | ${r.name} | ${r.role}`)
}

if (!CONFIRM) {
  console.log(`\n[DRY-RUN] ${rows.length} baris personnel AKAN di-nonaktifkan.`)
  console.log('Jalankan ulang dengan --confirm untuk mengeksekusi perubahan.')
  process.exit(0)
}

await sql`UPDATE personnel SET status = 'inactive' WHERE status = 'active'`
console.log('All personnel deactivated.')
