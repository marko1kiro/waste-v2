import assert from 'node:assert/strict'

const tableWidth = 297 - 20
const weights = [7.2, 14.4, 6.9, 5.7, 5.1, 7.2, 13.7, 5.8, 8.0, 8.7, 17.4]
const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
const widths = weights.map((weight) => tableWidth * weight / totalWeight)
assert.equal(Math.round(widths.reduce((sum, width) => sum + width, 0) * 1000) / 1000, tableWidth)
assert.ok(widths[3] >= 15)
assert.ok(widths[10] > widths[10 - 1])
console.log('PDF table width checks passed')
