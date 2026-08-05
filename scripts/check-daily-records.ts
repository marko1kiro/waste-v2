import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)

const rows = await sql`SELECT business_date, shift, done, submitted_by, submitted_at FROM daily_records ORDER BY business_date DESC, shift`
console.log(JSON.stringify(rows, null, 2))
