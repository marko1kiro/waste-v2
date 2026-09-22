import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const handler = readFileSync(join(root, 'api/admin/[action].ts'), 'utf8')

// Invarian: handler DELETE shift (Admin -> History) TIDAK BOLEH me-delete
// paraf_qc_url / paraf_manager_url. URL paraf selalu mereferensikan file ttd
// SHARED milik personnel (personnel.signature_url), bukan upload per-submission.
// Menghapusnya akan diam-diam merusak gambar ttd di semua PDF lain yang
// mereferensikan file yang sama (kasus 2026-09-22: 4 file ttd hilang dari R2
// setelah data shift dihapus, PDF hanya mencetak nama tanpa gambar).
// Yang boleh di-cleanup hanya dokumentasi_urls (foto per-submission).

// Isolasi ke blok DELETE shift saja (file ini punya beberapa handler DELETE).
// Anchor: logActivity delete_shift yang unik untuk handler ini.
const anchor = handler.indexOf("action: 'delete_shift'")
assert.ok(anchor !== -1, "blok DELETE shift (logActivity delete_shift) tidak ditemukan di api/admin/[action].ts")
const deleteBlockStart = handler.lastIndexOf("if (req.method === 'DELETE')", anchor)
assert.ok(deleteBlockStart !== -1, 'awal blok DELETE shift tidak ditemukan')
const deleteBlockEnd = handler.indexOf('return res.status(200)', anchor)
assert.ok(deleteBlockEnd !== -1, 'akhir blok DELETE shift tidak ditemukan')
const deleteBlock = handler.slice(deleteBlockStart, deleteBlockEnd)

// 1. Query pengumpul blob DELETE shift tidak boleh menyentuh kolom paraf_*_url.
// (Pola row.paraf_* agar komentar penjelas tidak ikut tertangkap.)
assert.ok(
  !/row\.paraf_qc_url/.test(deleteBlock),
  'DELETE shift tidak boleh memakai row.paraf_qc_url (file shared personnel!)',
)
assert.ok(
  !/row\.paraf_manager_url/.test(deleteBlock),
  'DELETE shift tidak boleh memakai row.paraf_manager_url (file shared personnel!)',
)
const selectInDelete = deleteBlock.match(/SELECT\s+([\s\S]*?)\s+FROM\s+product_destructions/)
assert.ok(selectInDelete, 'query SELECT DELETE shift tidak ditemukan')
assert.ok(
  !/paraf_qc_url/.test(selectInDelete[1]),
  'SELECT DELETE shift tidak boleh mengambil kolom paraf_qc_url',
)
assert.ok(
  !/paraf_manager_url/.test(selectInDelete[1]),
  'SELECT DELETE shift tidak boleh mengambil kolom paraf_manager_url',
)

// 2. DELETE shift tetap harus membersihkan dokumentasi_urls (foto per-submission).
assert.ok(
  /dokumentasi_urls/.test(deleteBlock),
  'DELETE shift tetap harus membersihkan dokumentasi_urls (foto per-submission)',
)
assert.ok(
  /deleteBlob/.test(deleteBlock),
  'blok DELETE tetap harus me-delete foto dokumentasi via deleteBlob',
)

console.log('OK: DELETE shift tidak menghapus file ttd shared personnel')
