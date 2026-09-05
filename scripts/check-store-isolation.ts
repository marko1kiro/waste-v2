/**
 * Check: store isolation smoke (READ-ONLY against production DB)
 * Usage: npx tsx scripts/check-store-isolation.ts  (DATABASE_URL via .env / env)
 *
 * Verifikasi:
 * 1. Scoped query store 1 == jumlah baris global (semua data existing = CKRBUL)
 * 2. Scoped query store lain (999) = 0 baris
 * 3. JWT store user membawa store_id yang cocok dengan users.store_id
 * 4. buildStoreScope menghasilkan clause yang benar
 */
import assert from 'node:assert/strict'
import 'dotenv/config'

process.env.JWT_SECRET ||= 'check-store-isolation-test-secret-0123456789abcdef'

const { neon } = await import('@neondatabase/serverless')
const { createToken, verifyToken, buildStoreScope } = await import('../server/lib.ts')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL not set')
  process.exit(1)
}
const sql = neon(databaseUrl)

// 1. Global vs scoped store 1
const globalPd = await sql`SELECT COUNT(*)::int AS count FROM product_destructions`
const scopedPd = await sql`SELECT COUNT(*)::int AS count FROM product_destructions WHERE store_id = 1`
assert.equal(Number(scopedPd[0].count), Number(globalPd[0].count), 'all existing rows must belong to CKRBUL')

// 2. Cross-store leakage must be zero
const otherPd = await sql`SELECT COUNT(*)::int AS count FROM product_destructions WHERE store_id = 999`
const otherDr = await sql`SELECT COUNT(*)::int AS count FROM daily_records WHERE store_id = 999`
assert.equal(Number(otherPd[0].count), 0, 'no rows for store 999 in product_destructions')
assert.equal(Number(otherDr[0].count), 0, 'no rows for store 999 in daily_records')

// 3. JWT roundtrip carries store_id matching users table
const user = await sql`SELECT username, store_id FROM users WHERE username = 'store' LIMIT 1`
assert.ok(user.length, 'store user exists')
const token = createToken('store', 'admin_store', 'User Store', Number(user[0].store_id))
const payload = verifyToken(token)
assert.ok(payload, 'token verifies')
assert.equal(payload.store_id, Number(user[0].store_id), 'JWT store_id matches users.store_id')

// 4. Scope builder
const scope = buildStoreScope(1)
assert.equal(scope.clause, 'store_id = $1')
assert.deepEqual(scope.params, [1])
const cross = buildStoreScope(null)
assert.equal(cross.clause, 'TRUE')
assert.deepEqual(cross.params, [])

// 5. NOT NULL guard on business tables
const nulls = await sql`SELECT
  (SELECT COUNT(*)::int FROM product_destructions WHERE store_id IS NULL) AS pd,
  (SELECT COUNT(*)::int FROM daily_records WHERE store_id IS NULL) AS dr,
  (SELECT COUNT(*)::int FROM personnel WHERE store_id IS NULL) AS personnel,
  (SELECT COUNT(*)::int FROM station_items WHERE store_id IS NULL) AS si`
assert.equal(nulls[0].pd, 0)
assert.equal(nulls[0].dr, 0)
assert.equal(nulls[0].personnel, 0)
assert.equal(nulls[0].si, 0)

console.log('check-store-isolation: PASS')
