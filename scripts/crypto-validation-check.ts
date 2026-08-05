import assert from 'node:assert/strict'
import { decryptApiKey, encryptApiKey, validateWasteSubmission } from '../api/lib.js'

const encryptionKey = Buffer.alloc(32, 7).toString('base64')
process.env.API_KEY_ENCRYPTION_KEY = encryptionKey

const rawKey = 'awas_live_abcdefghijklmnopqrstuvwxyz012345'
const encrypted = encryptApiKey(rawKey)
assert.notEqual(encrypted.ciphertext, rawKey)
assert.equal(decryptApiKey(encrypted), rawKey)

const valid = validateWasteSubmission({
  tanggal: '2026-02-28',
  kategoriInduk: 'NOODLE',
  shift: 'OPENING',
  productList: ['MIE'],
  jumlahProdukList: [1],
  kodeProdukList: [''],
  unitList: ['PCS'],
  metodePemusnahanList: ['DIBUANG'],
  alasanPemusnahanList: ['EXPIRED'],
  jamTanggalPemusnahanList: ['08:00'],
  parafQCName: 'QC',
  parafManagerName: 'Manager',
})
assert.equal(valid.success, true)
assert.equal(validateWasteSubmission({ ...valid.data, tanggal: '2026-02-30' }).success, false)
assert.equal(validateWasteSubmission({ ...valid.data, jumlahProdukList: [0] }).success, false)
assert.equal(validateWasteSubmission({ ...valid.data, alasanPemusnahanList: [''] }).success, false)

console.log('crypto-validation-check: PASS')
