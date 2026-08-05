import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)

const rows = await sql`SELECT id, jam_tanggal_pemusnahan, dokumentasi_urls FROM product_destructions ORDER BY id DESC LIMIT 5`
console.log(JSON.stringify(rows, null, 2))
