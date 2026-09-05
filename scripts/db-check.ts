import 'dotenv/config'
import { neon } from '@neondatabase/serverless'

async function main() {
  const sql = neon(process.env.DATABASE_URL)
  const r = await sql`SELECT
    (SELECT COUNT(*)::int FROM stores) AS stores,
    (SELECT COUNT(*)::int FROM product_destructions) AS pd,
    (SELECT COUNT(*)::int FROM daily_records) AS dr,
    (SELECT COUNT(*)::int FROM personnel) AS personnel,
    (SELECT COUNT(*)::int FROM station_items) AS si,
    (SELECT COUNT(*)::int FROM tenant_configs) AS tc,
    (SELECT COUNT(*)::int FROM users) AS users,
    (SELECT COUNT(*)::int FROM api_keys) AS api_keys`
  console.log(JSON.stringify(r[0], null, 2))
  const s = await sql`SELECT id, code, name, drive_account, features FROM stores`
  console.log(JSON.stringify(s, null, 2))
  const u = await sql`SELECT username, role, store_id FROM users ORDER BY id`
  console.log(JSON.stringify(u, null, 2))
  const p = await sql`SELECT id, name, role, store_id FROM personnel ORDER BY id LIMIT 5`
  console.log('personnel sample:', JSON.stringify(p, null, 2))
}

main().catch((e) => { console.error(e.message); process.exit(1) })
