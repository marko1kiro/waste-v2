import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
const sql = neon(process.env.DATABASE_URL!)
const rows = await sql`SELECT id, business_date::text AS date, shift, kategori_induk, nama_produk, paraf_qc_name, paraf_manager_name FROM product_destructions ORDER BY created_at DESC LIMIT 30`
console.log(JSON.stringify({ total: rows.length, missingQc: rows.filter((r) => !r.paraf_qc_name).length, missingManager: rows.filter((r) => !r.paraf_manager_name).length, sample: rows.filter((r) => !r.paraf_qc_name || !r.paraf_manager_name).slice(0, 5) }))
