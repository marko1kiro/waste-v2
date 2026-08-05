import 'dotenv/config'
import { neon } from '@neondatabase/serverless'
import { readFileSync } from 'node:fs'

const sql = neon(process.env.DATABASE_URL!)
const statements = readFileSync('scripts/add-api-keys.sql', 'utf8')
  .split(';')
  .map((statement) => statement.trim())
  .filter(Boolean)

for (const statement of statements) {
  await sql(statement, [])
}
console.log(`Applied ${statements.length} schema statements`)
