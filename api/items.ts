import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, getSQL, validateItemPayload, resolveStoreContext, getRequestedStoreId } from './lib.js'

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = await authenticateRequest(req, true)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })
  let storeId: number | null
  try {
    const resolved = resolveStoreContext({ role: payload.role, storeId: payload.storeId ?? null }, getRequestedStoreId(req))
    storeId = resolved.storeId
  } catch {
    return res.status(403).json({ error: 'Store context missing' })
  }
  const sql = getSQL()
  if (req.method === 'GET') {
    const { date, shift, station } = req.query as Record<string, string | undefined>
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Format date harus YYYY-MM-DD' })
    if (storeId === null) return res.status(400).json({ error: 'store_id wajib' })
    try {
      const rows = shift && station ? await sql`SELECT id, business_date::text AS business_date, shift, kategori_induk, nama_produk, kode_produk, jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan, paraf_qc_name, paraf_manager_name, submitted_by, created_at FROM product_destructions WHERE store_id = ${storeId} AND business_date::text = ${date} AND shift = ${shift} AND kategori_induk = ${station} ORDER BY created_at ASC` : shift ? await sql`SELECT id, business_date::text AS business_date, shift, kategori_induk, nama_produk, kode_produk, jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan, paraf_qc_name, paraf_manager_name, submitted_by, created_at FROM product_destructions WHERE store_id = ${storeId} AND business_date::text = ${date} AND shift = ${shift} ORDER BY kategori_induk ASC, created_at ASC` : await sql`SELECT id, business_date::text AS business_date, shift, kategori_induk, nama_produk, kode_produk, jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan, paraf_qc_name, paraf_manager_name, submitted_by, created_at FROM product_destructions WHERE store_id = ${storeId} AND business_date::text = ${date} ORDER BY shift, kategori_induk ASC, created_at ASC`
      return res.status(200).json({ success: true, data: rows })
    } catch { return res.status(500).json({ error: 'Internal server error' }) }
  }
  if (req.method === 'POST') {
    const body = req.body || {}
    const validated = validateItemPayload(body)
    if (!validated.success) return res.status(400).json({ error: validated.message })
    if (storeId === null) return res.status(400).json({ error: 'store_id wajib' })
    try {
      const rows = await sql(`WITH guard AS (SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':' || $17))), claimed AS (INSERT INTO waste_submission_locks (business_date, shift, station, store_id) SELECT $1::date, $2, $3, $17 FROM guard ON CONFLICT DO NOTHING RETURNING 1) INSERT INTO product_destructions (store_id, business_date, shift, store_name, kategori_induk, nama_produk, kode_produk, jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan, paraf_qc_url, paraf_qc_name, paraf_manager_url, paraf_manager_name, dokumentasi_urls, submitted_by) SELECT $17, $1::date, $2, $4, $3, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, '', $16 FROM claimed RETURNING id, business_date::text AS business_date, shift, kategori_induk, nama_produk, kode_produk, jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan, paraf_qc_name, paraf_manager_name, submitted_by, created_at`, [String(body.business_date), String(body.shift), String(body.kategori_induk), String(body.store_name || ''), String(body.nama_produk).toUpperCase(), String(body.kode_produk || ''), Number(body.jumlah_produk), String(body.unit), String(body.metode_pemusnahan || 'DIBUANG'), String(body.alasan_pemusnahan), String(body.jam_tanggal_pemusnahan || ''), String(body.paraf_qc_url || ''), String(body.paraf_qc_name), String(body.paraf_manager_url || ''), String(body.paraf_manager_name), payload.sub, storeId])
      if (!rows.length) return res.status(409).json({ error: 'Data duplikat untuk station, tanggal, dan shift ini.' })
      return res.status(201).json({ success: true, data: rows[0] })
    } catch (err) { return res.status(isUniqueViolation(err) ? 409 : 500).json({ error: isUniqueViolation(err) ? 'Data duplikat untuk station, tanggal, dan shift ini.' : 'Internal server error' }) }
  }
  if (req.method === 'PUT') {
    const id = Number((req.query as Record<string, string | undefined>).id)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id wajib valid' })
    if (storeId === null) return res.status(400).json({ error: 'store_id wajib' })
    try {
      const existing = await sql`SELECT *, business_date::text AS business_date FROM product_destructions WHERE id = ${id} AND store_id = ${storeId} LIMIT 1`
      if (!existing.length) return res.status(404).json({ error: 'Item tidak ditemukan' })
      const body = { ...existing[0], ...(req.body || {}) }
      const validated = validateItemPayload(body)
      if (!validated.success) return res.status(400).json({ error: validated.message })
      const rows = await sql`UPDATE product_destructions SET nama_produk = ${String(body.nama_produk).toUpperCase()}, kode_produk = ${String(body.kode_produk || '')}, jumlah_produk = ${Number(body.jumlah_produk)}, unit = ${String(body.unit)}, metode_pemusnahan = ${String(body.metode_pemusnahan || 'DIBUANG')}, alasan_pemusnahan = ${String(body.alasan_pemusnahan)}, jam_tanggal_pemusnahan = ${String(body.jam_tanggal_pemusnahan || '')} WHERE id = ${id} AND store_id = ${storeId} RETURNING id, business_date::text AS business_date, shift, kategori_induk, nama_produk, kode_produk, jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan, paraf_qc_name, paraf_manager_name, submitted_by, created_at`
      return res.status(200).json({ success: true, data: rows[0] })
    } catch { return res.status(500).json({ error: 'Internal server error' }) }
  }
  if (req.method === 'DELETE') {
    const id = Number((req.query as Record<string, string | undefined>).id)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id wajib valid' })
    if (storeId === null) return res.status(400).json({ error: 'store_id wajib' })
    try {
      const [target, deleted, result] = await sql.transaction((tx) => [
        tx(`SELECT set_config('waste.delete_date', business_date::text, true), set_config('waste.delete_shift', shift, true), set_config('waste.delete_station', kategori_induk, true), pg_advisory_xact_lock(hashtext(business_date::text || ':' || shift || ':' || kategori_induk)) FROM product_destructions WHERE id = $1 AND store_id = $2`, [id, storeId]),
        tx(`DELETE FROM product_destructions WHERE id = $1 AND store_id = $2 RETURNING id`, [id, storeId]),
        tx(`WITH target AS (SELECT current_setting('waste.delete_date', true)::date AS business_date, current_setting('waste.delete_shift', true) AS shift, current_setting('waste.delete_station', true) AS station), remaining AS (SELECT COUNT(*)::int AS count FROM product_destructions, target WHERE product_destructions.store_id = $2 AND product_destructions.business_date = target.business_date AND product_destructions.shift = target.shift AND product_destructions.kategori_induk = target.station), unlocked AS (DELETE FROM waste_submission_locks USING target, remaining WHERE waste_submission_locks.store_id = $2 AND waste_submission_locks.business_date = target.business_date AND waste_submission_locks.shift = target.shift AND waste_submission_locks.station = target.station AND remaining.count = 0) SELECT count FROM remaining`, [id, storeId]),
      ])
      if (!target.length || !deleted.length) return res.status(404).json({ error: 'Item tidak ditemukan' })
      return res.status(200).json({ success: true, shiftCleared: Number(result[0]?.count) === 0 })
    } catch { return res.status(500).json({ error: 'Internal server error' }) }
  }
  return res.status(405).json({ error: 'Method not allowed' })
}
