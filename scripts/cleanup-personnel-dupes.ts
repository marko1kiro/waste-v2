/**
 * DESTRUCTIVE: menonaktifkan baris personnel duplikat (QC1 / MGR1 tanpa signature).
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
 *   npx tsx scripts/cleanup-personnel-dupes.ts                                # dry-run
 *   npx tsx scripts/cleanup-personnel-dupes.ts --confirm                      # eksekusi (non-prod)
 *   npx tsx scripts/cleanup-personnel-dupes.ts --confirm --i-know-this-is-prod # eksekusi prod
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

const affected = await sql`
  SELECT id, name, role, status
  FROM personnel
  WHERE status = 'active'
    AND ((name = 'QC1' AND role = 'qc') OR (name = 'MGR1' AND role = 'manager'))
    AND signature_url = ''
`
console.log('Personnel duplikat yang akan di-nonaktifkan:', affected.length)
for (const r of affected) {
  console.log(`  ${r.id} | ${r.name} | ${r.role} | ${r.status}`)
}

if (!CONFIRM) {
  console.log('\n[DRY-RUN] Tidak ada perubahan. Jalankan ulang dengan --confirm untuk mengeksekusi.')
  process.exit(0)
}

await sql`
  UPDATE personnel
  SET status = 'inactive'
  WHERE name = 'QC1' AND role = 'qc' AND signature_url = ''
`

await sql`
  UPDATE personnel
  SET status = 'inactive'
  WHERE name = 'MGR1' AND role = 'manager' AND signature_url = ''
`

const rows = await sql`
  SELECT name, full_name, role, status, signature_url
  FROM personnel
  WHERE status = 'active'
  ORDER BY role, name
`

console.log(JSON.stringify(rows, null, 2))
