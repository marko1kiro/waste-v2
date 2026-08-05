import 'dotenv/config'
import assert from 'node:assert/strict'
import { neon } from '@neondatabase/serverless'
import { validateItemPayload } from '../api/lib.js'

const sql = neon(process.env.DATABASE_URL!)
const rows = await sql`SELECT *, business_date::text AS business_date FROM product_destructions ORDER BY created_at DESC LIMIT 1`
if (rows.length) {
  assert.equal(typeof rows[0].business_date, 'string')
  const validated = validateItemPayload(rows[0])
  assert.equal(validated.success, true)
}
console.log('history edit checks passed')
