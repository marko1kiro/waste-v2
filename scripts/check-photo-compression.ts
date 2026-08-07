import assert from 'node:assert/strict'
import { MAX_PHOTO_BYTES, compressionSteps, isWithinPhotoLimit } from '../src/lib/photo-compression.ts'

assert.equal(MAX_PHOTO_BYTES, 500 * 1024)
assert.equal(isWithinPhotoLimit(MAX_PHOTO_BYTES), true)
assert.equal(isWithinPhotoLimit(MAX_PHOTO_BYTES + 1), false)
assert.deepEqual(compressionSteps(2400, 1200)[0], { width: 1600, height: 800, quality: 0.82 })
assert.deepEqual(compressionSteps(800, 400)[0], { width: 800, height: 400, quality: 0.82 })
const steps = compressionSteps(1600, 800)
assert.equal(steps.some((step) => step.quality < 0.82 && step.width === 1600), true)
assert.equal(steps.some((step) => step.width < 1600 && step.quality === 0.82), true)
assert.equal(steps.some((step) => step.width < 1600), true)
assert.equal(steps.at(-1)?.quality, 0.4)
assert.equal(steps.at(-1)?.width, 400)
assert.equal(steps.at(-1)?.height, 200)
const portraitSteps = compressionSteps(400, 1600)
assert.equal(portraitSteps.some((step) => step.width === 320 && step.height === 1280 && step.quality === 0.82), true)
assert.equal(Math.max(portraitSteps.at(-1)?.width || 0, portraitSteps.at(-1)?.height || 0), 400)
console.log('check-photo-compression: PASS')
