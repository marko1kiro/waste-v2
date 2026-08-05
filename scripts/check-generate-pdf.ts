import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { buildPdfFilename, renderDailyPdf } from '../shared/pdf-renderer.js'
import { createBlobAccessToken, verifyBlobAccessToken } from '../api/lib.js'

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-that-is-at-least-32-characters-long'

const signedBlobUrl = 'https://blob.vercel-storage.com/private/image.png'
const accessToken = createBlobAccessToken(signedBlobUrl, 600)
assert.equal(verifyBlobAccessToken(accessToken)?.blobUrl, signedBlobUrl)
const [tokenHeader, tokenBody, tokenSignature] = accessToken.split('.')
const tamperedBody = `${tokenBody.slice(0, -1)}${tokenBody.endsWith('A') ? 'B' : 'A'}`
assert.equal(verifyBlobAccessToken(`${tokenHeader}.${tamperedBody}.${tokenSignature}`), null)
const expiredToken = createBlobAccessToken(signedBlobUrl, -1)
assert.equal(verifyBlobAccessToken(expiredToken), null)

const filename = buildPdfFilename('CKRBUL', '2026-07-28')
assert.equal(filename, 'BA Waste CKRBUL - 28072026.pdf')
assert.equal(buildPdfFilename('CKR\r\nX', '2026-07-28'), 'BA Waste CKR_X - 28072026.pdf')

const pdf = renderDailyPdf({
  date: '2026-07-28',
  storeName: 'BEKASI KP. BULU',
  storeCode: 'CKRBUL',
  publicUrl: 'https://www.gacoanku.my.id',
  checklistUrl: '',
  grouped: { OPENING: [], MIDDLE: [], CLOSING: [], MIDNIGHT: [] },
  assets: new Map(),
  assetLinks: new Map(),
})
assert.ok(pdf.byteLength > 1000)
assert.equal(Buffer.from(pdf).subarray(0, 5).toString(), '%PDF-')
const privateImage = 'https://blob.vercel-storage.com/private/image.png'
const signedLink = 'https://www.gacoanku.my.id/api/signatures?blobUrl=https%3A%2F%2Fblob.vercel-storage.com%2Fprivate%2Fimage.png&token=signed'
const linkedPdf = renderDailyPdf({
  date: '2026-07-28', storeName: 'BEKASI KP. BULU', storeCode: 'CKRBUL', publicUrl: 'https://www.gacoanku.my.id', checklistUrl: '', assets: new Map(), assetLinks: new Map([[privateImage, signedLink]]),
  grouped: { OPENING: [{ station: 'NOODLE', namaProduk: 'MIE', kodeProduk: '', jumlahProduk: 1, unit: 'PCS', metodePemusnahan: 'DIBUANG', alasanPemusnahan: 'RUSAK', jamTanggalPemusnahan: '', parafQC: '', parafQCName: '', parafManager: '', parafManagerName: '', dokumentasi: [privateImage] }], MIDDLE: [], CLOSING: [], MIDNIGHT: [] },
})
assert.ok(Buffer.from(linkedPdf).toString('latin1').includes(signedLink))
const generatePdfSource = await readFile(new URL('../api/generate-pdf.ts', import.meta.url), 'utf8')
const rendererSource = await readFile(new URL('../shared/pdf-renderer.ts', import.meta.url), 'utf8')
assert.ok(!generatePdfSource.includes('/logo.webp'))
assert.ok(!rendererSource.includes('input.logo'))

console.log('generate-pdf checks passed')
