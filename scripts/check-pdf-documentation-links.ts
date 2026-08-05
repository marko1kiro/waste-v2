import assert from 'node:assert/strict'
import { renderDailyPdf, type PdfItem } from '../shared/pdf-renderer.js'

const origin = 'https://www.gacoanku.my.id'
const relative = (shift: string, station: string, index: number) => `/api/signatures?blobUrl=${encodeURIComponent(`https://blob.example/${shift}-${station}-${index}.jpg`)}`
const item = (station: string, dokumentasi: string[]): PdfItem => ({ station, namaProduk: 'TEST', kodeProduk: '', jumlahProduk: 1, unit: 'PCS', metodePemusnahan: 'DIBUANG', alasanPemusnahan: 'TEST', jamTanggalPemusnahan: '12:00', parafQC: '', parafQCName: 'QC', parafManager: '', parafManagerName: 'MANAGER', dokumentasi })
const middleNoodle = Array.from({ length: 10 }, (_, index) => relative('MIDDLE', 'NOODLE', index + 1))
const middleBar = Array.from({ length: 6 }, (_, index) => relative('MIDDLE', 'BAR', index + 1))
const midnightNoodle = Array.from({ length: 8 }, (_, index) => relative('MIDNIGHT', 'NOODLE', index + 1))
const midnightProduksi = Array.from({ length: 10 }, (_, index) => relative('MIDNIGHT', 'PRODUKSI', index + 1))
const grouped = {
  OPENING: [],
  MIDDLE: [
    item('NOODLE', middleNoodle), item('NOODLE', middleNoodle), item('NOODLE', middleNoodle), item('NOODLE', middleNoodle),
    item('BAR', middleBar), item('BAR', middleBar), item('BAR', middleBar), item('BAR', middleBar),
  ],
  CLOSING: [],
  MIDNIGHT: [
    item('NOODLE', midnightNoodle), item('NOODLE', midnightNoodle), item('NOODLE', midnightNoodle),
    item('PRODUKSI', midnightProduksi), item('PRODUKSI', midnightProduksi), item('PRODUKSI', midnightProduksi.slice(0, 3)),
  ],
}
const rawDocumentationCount = Object.values(grouped).flat().reduce((total, entry) => total + entry.dokumentasi.length, 0)
assert.equal(rawDocumentationCount, 111)
const allUrls = Object.values(grouped).flat().flatMap((entry) => entry.dokumentasi)
const assetLinks = new Map(allUrls.map((url) => [url, new URL(url, origin).href]))
const pdf = Buffer.from(renderDailyPdf({ date: '2026-07-31', storeName: 'TEST STORE', storeCode: 'TEST', publicUrl: origin, checklistUrl: '', grouped, assets: new Map(), assetLinks }))
const source = pdf.toString('latin1')
const uris = [...source.matchAll(/\/URI\s*\(([^)]*)\)/g)].map((match) => match[1].replace(/\\([()\\])/g, '$1'))
assert.equal(uris.length, 34)
assert.equal(new Set(uris).size, 34)
assert.equal(uris.filter((url) => url.startsWith('/')).length, 0)
assert.ok(uris.every((url) => url.startsWith(origin)))
assert.ok(source.includes('MIDDLE'))
assert.ok(source.includes('MIDNIGHT'))
assert.ok(source.includes('1. NOODLE'))
assert.ok(source.includes('Gambar 1'))
console.log('PDF documentation links check passed')
