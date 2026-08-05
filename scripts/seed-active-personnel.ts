import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

config({ path: '.env' })

const sql = neon(process.env.DATABASE_URL!)

await sql`
  INSERT INTO personnel (name, full_name, role, signature_url, status)
  VALUES ('QC1', 'QC Contoh 1', 'qc', '', 'active')
  ON CONFLICT DO NOTHING
`

await sql`
  INSERT INTO personnel (name, full_name, role, signature_url, status)
  VALUES ('MGR1', 'Manager Contoh 1', 'manager', '', 'active')
  ON CONFLICT DO NOTHING
`

await sql`
  UPDATE personnel
  SET full_name = 'QC Contoh 1', role = 'qc', status = 'active'
  WHERE name = 'QC1'
`

await sql`
  UPDATE personnel
  SET full_name = 'Manager Contoh 1', role = 'manager', status = 'active'
  WHERE name = 'MGR1'
`

const rows = await sql`
  SELECT name, full_name, role, status
  FROM personnel
  WHERE status = 'active'
  ORDER BY role, name
`

console.log(JSON.stringify(rows, null, 2))
