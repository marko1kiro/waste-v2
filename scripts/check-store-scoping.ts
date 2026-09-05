/**
 * Check: store scoping SQL builders (TDD RED/GREEN)
 * Usage: npx tsx scripts/check-store-scoping.ts
 */
import assert from 'node:assert/strict'

process.env.JWT_SECRET ||= 'check-store-scoping-test-secret-0123456789abcdef'

const { buildStoreScope } = await import('../api/lib.ts')

// admin_store scoped
assert.deepEqual(
  buildStoreScope(1),
  { clause: 'store_id = $1', params: [1], nextParam: 2 },
  'scope for store 1',
)
assert.deepEqual(
  buildStoreScope(2),
  { clause: 'store_id = $1', params: [2], nextParam: 2 },
  'scope for store 2 always $1 as first param',
)

// super_admin cross-resto
assert.deepEqual(
  buildStoreScope(null),
  { clause: 'TRUE', params: [], nextParam: 1 },
  'null storeId -> cross-resto, no filter',
)

console.log('check-store-scoping: PASS')
