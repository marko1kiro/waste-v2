import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)

const rows = await sql`SELECT * FROM tenant_configs`
console.log(JSON.stringify(rows, null, 2))

if (rows.length === 0) {
  await sql`INSERT INTO tenant_configs (store_name, extra_config) VALUES ('BEKASI KP. BULU', '{"store_code":"CKRBUL"}')`
  console.log('Seeded default tenant config.')
}
