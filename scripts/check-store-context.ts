/**
 * Check: store context logic (TDD RED/GREEN)
 * Usage: npx tsx scripts/check-store-context.ts
 */
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'check-store-context-test-secret-0123456789abcdef'

const { createToken, verifyToken, resolveStoreContext } = await import('../server/lib.ts')

// ── JWT store_id roundtrip ──────────────────────────────
const plain = verifyToken(createToken('store', 'admin_store', 'User Store'))
assert.ok(plain, 'token must verify')
assert.equal(plain.store_id ?? null, null, 'token without store must have null store_id')

const scoped = verifyToken(createToken('store', 'admin_store', 'User Store', 7))
assert.ok(scoped, 'scoped token must verify')
assert.equal(scoped.store_id, 7, 'token must carry store_id claim')

const superToken = verifyToken(createToken('admin', 'super_admin', 'Super Admin', null))
assert.ok(superToken, 'super token must verify')
assert.equal(superToken.store_id ?? null, null, 'super_admin without store must carry null store_id')

// ── resolveStoreContext ─────────────────────────────────
// admin_store: locked to own store
assert.deepEqual(
  resolveStoreContext({ role: 'admin_store', storeId: 1 }, undefined),
  { storeId: 1 },
  'admin_store without request -> own store',
)
assert.deepEqual(
  resolveStoreContext({ role: 'admin_store', storeId: 1 }, 2),
  { storeId: 1 },
  'admin_store must NOT switch to requested store 2',
)

// super_admin: requested store wins
assert.deepEqual(
  resolveStoreContext({ role: 'super_admin', storeId: null }, 3),
  { storeId: 3 },
  'super_admin with request -> requested store',
)
assert.deepEqual(
  resolveStoreContext({ role: 'super_admin', storeId: null }, undefined),
  { storeId: null },
  'super_admin without request -> cross-resto (null)',
)

// invalid: admin_store without storeId must be rejected
assert.throws(
  () => resolveStoreContext({ role: 'admin_store', storeId: null }, undefined),
  'admin_store without store_id must throw',
)

console.log('check-store-context: PASS')
