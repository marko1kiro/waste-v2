import assert from 'node:assert/strict'
import { createApiKey, hashApiKey, verifyToken } from '../api/lib.js'

const key = createApiKey()
assert.ok(key.rawKey.startsWith(key.keyPrefix))
assert.notEqual(hashApiKey(key.rawKey), hashApiKey(`${key.rawKey}x`))
assert.equal(verifyToken('not.a.jwt'), null)
console.log('check-api-key-auth: PASS')
