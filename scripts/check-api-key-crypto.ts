import assert from 'node:assert/strict'
import { decryptApiKey, encryptApiKey, hashApiKey } from '../api/lib.js'

process.env.API_KEY_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64')
const raw = 'awas_live_abcdefghijklmnopqrstuvwxyz012345'
const encrypted = encryptApiKey(raw)
assert.equal(decryptApiKey(encrypted), raw)
assert.equal(hashApiKey(raw).length, 64)
assert.throws(() => decryptApiKey({ ...encrypted, tag: Buffer.alloc(16).toString('base64') }))
console.log('check-api-key-crypto: PASS')
