/**
 * Check: store features helpers (TDD RED/GREEN)
 * Usage: npx tsx scripts/check-store-features.ts
 */
import assert from 'node:assert/strict'

const { pasteOnly, canManual, hasCatalog, initialWasteStep } = await import('../src/lib/store-features.ts')

type Store = { features: Record<string, unknown> | null } | null

const ckrbul: Store = { features: { manual_mode: true, catalog: true } }
const pasteResto: Store = { features: { manual_mode: false, catalog: false } }
const superAdmin: Store = null
const legacyDefault: Store = { features: null }

// paste-only
assert.equal(pasteOnly(pasteResto), true, 'resto tanpa manual+catalog = paste only')
assert.equal(pasteOnly(ckrbul), false, 'CKRBUL bukan paste-only')
assert.equal(pasteOnly(superAdmin), false, 'super_admin full access')
assert.equal(pasteOnly(legacyDefault), false, 'features kosong default full (CKRBUL legacy)')

// manual mode
assert.equal(canManual(ckrbul), true)
assert.equal(canManual(pasteResto), false)
assert.equal(canManual(superAdmin), false, 'null store defaults to paste-only (safe during loading)')
assert.equal(canManual(legacyDefault), true)

// catalog
assert.equal(hasCatalog(ckrbul), true)
assert.equal(hasCatalog(pasteResto), false)
assert.equal(hasCatalog(superAdmin), true)
assert.equal(hasCatalog(legacyDefault), true)

// initial step
assert.equal(initialWasteStep(false, pasteResto), 'paste', 'resto paste-only mulai dari paste walau route manual')
assert.equal(initialWasteStep(false, ckrbul), 'config', 'CKRBUL manual mulai dari config')
assert.equal(initialWasteStep(true, ckrbul), 'paste', 'route paste tetap paste')

console.log('check-store-features: PASS')
