/**
 * Check: admin store url helper (TDD RED/GREEN)
 * Usage: npx tsx scripts/check-admin-store-url.ts
 */
import assert from 'node:assert/strict'

// localStorage shim for Node (browser API test mock)
const memory = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, String(value)),
  removeItem: (key: string) => void memory.delete(key),
}

const { withStoreId, getAdminStoreId, setAdminStoreId } = await import('../src/lib/admin-store.ts')

// Pure URL builder (no localStorage here except via store param)
assert.equal(withStoreId('/api/admin/personnel', 2), '/api/admin/personnel?store_id=2')
assert.equal(withStoreId('/api/admin/history?date=2026-09-06', 3), '/api/admin/history?date=2026-09-06&store_id=3')
assert.equal(withStoreId('/api/admin/users', null), '/api/admin/users', 'null store -> unmodified')
assert.equal(withStoreId('/api/admin/users', undefined), '/api/admin/users')
assert.equal(withStoreId('/api/admin/station-items', 1), '/api/admin/station-items?store_id=1')

// localStorage-backed selected store
setAdminStoreId(5)
assert.equal(getAdminStoreId(), 5, 'selected store persists')
setAdminStoreId(null)
assert.equal(getAdminStoreId(), null, 'clear -> null')

console.log('check-admin-store-url: PASS')
