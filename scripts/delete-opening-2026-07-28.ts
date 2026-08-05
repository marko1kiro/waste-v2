import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)
const date = '2026-07-28'
const shift = 'OPENING'
const stations = ['NOODLE', 'DIMSUM', 'BAR', 'PRODUKSI']
const before = await sql`SELECT kategori_induk, COUNT(*)::int AS count FROM product_destructions WHERE business_date = ${date}::date AND shift = ${shift} AND kategori_induk = ANY(${stations}) GROUP BY kategori_induk ORDER BY kategori_induk`
const results = await sql.transaction([
  sql`DELETE FROM product_destructions WHERE business_date = ${date}::date AND shift = ${shift} AND kategori_induk = ANY(${stations}) RETURNING id`,
  sql`DELETE FROM waste_submission_locks WHERE business_date = ${date}::date AND shift = ${shift} AND station = ANY(${stations}) RETURNING station`,
  sql`DELETE FROM daily_records WHERE business_date = ${date}::date AND shift = ${shift} RETURNING id`,
])
const after = await sql`SELECT COUNT(*)::int AS count FROM product_destructions WHERE business_date = ${date}::date AND shift = ${shift} AND kategori_induk = ANY(${stations})`
console.log(JSON.stringify({ before, deletedRows: results[0].length, deletedLocks: results[1].length, deletedDailyRecords: results[2].length, remainingRows: Number(after[0].count) }))
