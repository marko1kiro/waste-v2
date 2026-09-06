import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, getClientIP, getSQL, logActivity, resolveStoreContext, validateWasteSubmission } from '../server/lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const payload = await authenticateRequest(req, true)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })
  let storeId: number | null
  try {
    const resolved = resolveStoreContext({ role: payload.role, storeId: payload.storeId ?? null }, undefined)
    storeId = resolved.storeId
  } catch {
    return res.status(403).json({ error: 'Store context missing' })
  }
  if (storeId === null) return res.status(400).json({ success: false, message: 'store_id wajib' })
  try {
    const validated = validateWasteSubmission(req.body || {})
    if (!validated.success) return res.status(400).json({ success: false, message: validated.message })
    const body = validated.data
    const tanggal = String(body.tanggal)
    const kategoriInduk = String(body.kategoriInduk)
    const shift = String(body.shift)
    const sql = getSQL()
    let storeName = String(body.storeName || '')
    if (!storeName) {
      const storeRow = await sql`SELECT name FROM stores WHERE id = ${storeId} LIMIT 1`
      storeName = storeRow.length ? String(storeRow[0].name) : 'UNKNOWN'
    }
    const productList = body.productList as string[]
    const jumlahProdukList = body.jumlahProdukList as number[]
    const kodeProdukList = body.kodeProdukList as string[]
    const unitList = body.unitList as string[]
    const metodePemusnahanList = body.metodePemusnahanList as string[]
    const alasanPemusnahanList = body.alasanPemusnahanList as string[]
    const jamTanggalPemusnahanList = body.jamTanggalPemusnahanList as string[]
    const result = await sql(`WITH claimed AS (INSERT INTO waste_submission_locks (store_id, business_date, shift, station) VALUES ($18, $1::date, $2, $3) ON CONFLICT DO NOTHING RETURNING 1), inserted AS (INSERT INTO product_destructions (store_id, business_date, shift, store_name, kategori_induk, nama_produk, kode_produk, jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan, paraf_qc_url, paraf_qc_name, paraf_manager_url, paraf_manager_name, dokumentasi_urls, submitted_by) SELECT $18, $1::date, $2, $4, $3, product_name, product_code, product_quantity, product_unit, destruction_method, destruction_reason, destruction_time, $11, $12, $13, $14, $15, $16 FROM claimed CROSS JOIN UNNEST($5::text[], $6::text[], $7::int[], $8::text[], $9::text[], $10::text[], $17::text[]) AS item(product_name, product_code, product_quantity, product_unit, destruction_method, destruction_reason, destruction_time) RETURNING id), daily AS (INSERT INTO daily_records (store_id, business_date, shift, done, submitted_by, submitted_at) SELECT $18, $1::date, $2, TRUE, $16, NOW() FROM claimed ON CONFLICT (store_id, business_date, shift) DO UPDATE SET done = TRUE, submitted_by = EXCLUDED.submitted_by, submitted_at = NOW() RETURNING id) SELECT COUNT(*)::int AS item_count FROM inserted`, [tanggal, shift, kategoriInduk, storeName, productList, kodeProdukList, jumlahProdukList, unitList, metodePemusnahanList, alasanPemusnahanList, String(body.parafQCUrl || ''), String(body.parafQCName), String(body.parafManagerUrl || ''), String(body.parafManagerName), (body.dokumentasiUrls as string[]).join('\n'), payload.sub, jamTanggalPemusnahanList, storeId])
    if (Number(result[0]?.item_count) !== productList.length) return res.status(409).json({ success: false, message: 'Data duplikat untuk station, tanggal, dan shift ini.' })
    await logActivity({ action: 'submit_waste', category: 'waste', username: payload.sub, ipAddress: getClientIP(req.headers as Record<string, string | string[] | undefined>), userAgent: req.headers['user-agent'] || '', details: { station: kategoriInduk, shift, itemCount: productList.length, date: tanggal }, status: 'success' })
    return res.status(200).json({ success: true, message: `Data waste ${kategoriInduk} berhasil disimpan`, data: { kategoriInduk, itemsProcessed: productList.length, shift, storeName, shiftDone: true } })
  } catch (err) {
    console.error('[submit-waste] Error:', err)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}
