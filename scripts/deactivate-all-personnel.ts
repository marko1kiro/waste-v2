import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)

const rows = await sql`SELECT id, name, role FROM personnel WHERE status = 'active'`
console.log('Active personnel:', rows.length)
for (const r of rows) {
  console.log(`  ${r.id} | ${r.name} | ${r.role}`)
}

await sql`UPDATE personnel SET status = 'inactive' WHERE status = 'active'`
console.log('All personnel deactivated.')
