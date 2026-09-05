import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL)
  const c = await sql`SELECT
    conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid IN ('daily_records'::regclass, 'waste_submission_locks'::regclass)
    ORDER BY conrelid::regclass::text, conname`
  console.log(JSON.stringify(c, null, 2))
  const idx = await sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename IN ('daily_records','waste_submission_locks') ORDER BY tablename, indexname`
  console.log(JSON.stringify(idx, null, 2))
}

main().catch((e) => { console.error(e.message); process.exit(1) })
