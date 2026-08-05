import assert from 'node:assert/strict'
import { apiKeyCreateStatement, apiKeyExpireStatement, createApiKey, decryptApiKey, encryptApiKey } from '../api/lib.js'

process.env.API_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString('base64')
const created = createApiKey()
const stored = encryptApiKey(created.rawKey)
assert.equal(decryptApiKey(stored), created.rawKey)
assert.equal(created.keyPrefix, 'awas_live_')
assert.match(apiKeyExpireStatement, /SET revoked_at = NOW\(\)/)
assert.match(apiKeyExpireStatement, /name = \$2/)
assert.match(apiKeyCreateStatement, /NOT EXISTS/)
assert.doesNotMatch(apiKeyCreateStatement, /SET revoked_at/)
console.log('check-api-key-management: PASS')
