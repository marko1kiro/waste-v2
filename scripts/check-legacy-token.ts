/**
 * Check: legacy JWT token store backfill (READ-ONLY, needs DATABASE_URL)
 * Usage: npx tsx scripts/check-legacy-token.ts
 *
 * Token lama (pre-multi-resto) tidak punya claim store_id.
 * authenticateRequest harus resolve users.store_id dari DB supaya sesi lama tetap scoped.
 */
import assert from 'node:assert/strict'
import 'dotenv/config'

process.env.JWT_SECRET ||= 'check-legacy-token-test-secret-0123456789abcdef'

const { createToken, authenticateRequest } = await import('../server/lib.ts')

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is not set')

// Token bentuk LAMA: tanpa store_id
const legacyToken = createToken('store', 'admin_store', 'User Store')
assert.ok(!legacyToken.includes('store_id'), 'legacy token shape sanity')

const payload = await authenticateRequest({ headers: { authorization: `Bearer ${legacyToken}` } }, false)
assert.ok(payload, 'legacy token must authenticate')
assert.equal(payload.storeId, 1, 'legacy admin_store token must backfill store_id=1 (CKRBUL) from users table')

// Token baru: sudah bawa store_id, tidak boleh berubah
const modernToken = createToken('store', 'admin_store', 'User Store', 1)
const modern = await authenticateRequest({ headers: { authorization: `Bearer ${modernToken}` } }, false)
assert.ok(modern, 'modern token must authenticate')
assert.equal(modern.storeId, 1)

console.log('check-legacy-token: PASS')
