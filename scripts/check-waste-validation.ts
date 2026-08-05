import assert from 'node:assert/strict'
import { validateItemPayload, validateWasteSubmission } from '../api/lib.js'

const input = { tanggal: '2026-02-28', kategoriInduk: 'NOODLE', shift: 'OPENING', productList: ['MIE'], jumlahProdukList: [1], kodeProdukList: [''], unitList: ['PCS'], metodePemusnahanList: ['DIBUANG'], alasanPemusnahanList: ['EXPIRED'], jamTanggalPemusnahanList: ['08:00'], parafQCName: 'QC', parafManagerName: 'Manager' }
assert.equal(validateWasteSubmission(input).success, true)
assert.equal(validateWasteSubmission({ ...input, tanggal: '2026-02-30' }).success, false)
assert.equal(validateWasteSubmission({ ...input, shift: 'INVALID' }).success, false)
assert.equal(validateWasteSubmission({ ...input, jumlahProdukList: [Infinity] }).success, false)
assert.equal(validateItemPayload({ business_date: '2026-02-28', shift: 'OPENING', kategori_induk: 'NOODLE', nama_produk: 'MIE', jumlah_produk: 1, unit: 'PCS', alasan_pemusnahan: 'EXPIRED', paraf_qc_name: 'QC', paraf_manager_name: 'Manager' }).success, true)
assert.equal(validateItemPayload({ business_date: '2026-02-30' }).success, false)
console.log('check-waste-validation: PASS')
