import assert from 'node:assert/strict'
import { formatWasteSubmitElapsed, getWasteSubmitProgress } from '../src/lib/waste-submit-progress.ts'

assert.deepEqual(getWasteSubmitProgress({ completed: 0, total: 0 }), { percent: 0, text: '0%' })
assert.deepEqual(getWasteSubmitProgress({ completed: 2, total: 5 }), { percent: 40, text: '40%' })
assert.deepEqual(getWasteSubmitProgress({ completed: 8, total: 5 }), { percent: 100, text: '100%' })
assert.equal(formatWasteSubmitElapsed(0), '0 dtk')
assert.equal(formatWasteSubmitElapsed(59_000), '59 dtk')
assert.equal(formatWasteSubmitElapsed(60_000), '1:00')
assert.equal(formatWasteSubmitElapsed(125_000), '2:05')
console.log('check-waste-submit-progress: PASS')
