import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)

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
