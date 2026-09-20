import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, getClientIP, getSQL, isAllowedUploadUrl, logActivity, resolveStoreContext, validateWasteSubmission } from '../server/lib.js'

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

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

    // M12: optional idempotency key — must be a UUID when present; joins the
    // advisory lock name and is logged (contract: client sends idempotencyKey?: string)
    const idempotencyKey = body.idempotencyKey
    if (idempotencyKey !== undefined && idempotencyKey !== null && idempotencyKey !== '') {
      if (typeof idempotencyKey !== 'string' || !UUID_RE.test(idempotencyKey)) {
        return res.status(400).json({ success: false, message: 'idempotencyKey harus UUID yang valid.' })
      }
    }
    const lockName = typeof idempotencyKey === 'string' && idempotencyKey
      ? `idem:${idempotencyKey}`
      : `natural:${storeId}:${tanggal}:${shift}:${kategoriInduk}`

    // H2: documentation/signature URLs must come from our allowlist (generic 400)
    const urlFields: Array<[string, unknown]> = [
      ['parafQCUrl', body.parafQCUrl],
      ['parafManagerUrl', body.parafManagerUrl],
      ...((body.dokumentasiUrls as string[]).map((u, i) => [`dokumentasiUrls[${i}]`, u] as [string, unknown])),
    ]
    for (const [field, value] of urlFields) {
      const url = String(value || '')
      if (url && !isAllowedUploadUrl(url)) {
        console.warn('[submit-waste] Rejected untrusted asset URL', { field, url: url.slice(0, 160) })
        return res.status(400).json({ success: false, message: 'URL dokumentasi/paraf tidak valid.' })
      }
    }

    const sql = getSQL()
    // H5: store_name always resolved server-side from the stores table — client input ignored
    const storeRow = await sql`SELECT name FROM stores WHERE id = ${storeId} LIMIT 1`
    const storeName = storeRow.length ? String(storeRow[0].name) : 'UNKNOWN'
    const productList = body.productList as string[]
    const jumlahProdukList = body.jumlahProdukList as number[]
    const kodeProdukList = body.kodeProdukList as string[]
    const unitList = body.unitList as string[]
    const metodePemusnahanList = body.metodePemusnahanList as string[]
    const alasanPemusnahanList = body.alasanPemusnahanList as string[]
    const jamTanggalPemusnahanList = body.jamTanggalPemusnahanList as string[]
    const result = await sql(`WITH idem_guard AS (SELECT pg_advisory_xact_lock(hashtext($19))), claimed AS (INSERT INTO waste_submission_locks (store_id, business_date, shift, station) SELECT $18, $1::date, $2, $3 FROM idem_guard ON CONFLICT DO NOTHING RETURNING 1), inserted AS (INSERT INTO product_destructions (store_id, business_date, shift, store_name, kategori_induk, nama_produk, kode_produk, jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan, paraf_qc_url, paraf_qc_name, paraf_manager_url, paraf_manager_name, dokumentasi_urls, submitted_by) SELECT $18, $1::date, $2, $4, $3, product_name, product_code, product_quantity, product_unit, destruction_method, destruction_reason, destruction_time, $11, $12, $13, $14, $15, $16 FROM claimed CROSS JOIN UNNEST($5::text[], $6::text[], $7::int[], $8::text[], $9::text[], $10::text[], $17::text[]) AS item(product_name, product_code, product_quantity, product_unit, destruction_method, destruction_reason, destruction_time) RETURNING id), daily AS (INSERT INTO daily_records (store_id, business_date, shift, done, submitted_by, submitted_at) SELECT $18, $1::date, $2, TRUE, $16, NOW() FROM claimed ON CONFLICT (store_id, business_date, shift) DO UPDATE SET done = TRUE, submitted_by = EXCLUDED.submitted_by, submitted_at = NOW() RETURNING id) SELECT COUNT(*)::int AS item_count FROM inserted`, [tanggal, shift, kategoriInduk, storeName, productList, kodeProdukList, jumlahProdukList, unitList, metodePemusnahanList, alasanPemusnahanList, String(body.parafQCUrl || ''), String(body.parafQCName), String(body.parafManagerUrl || ''), String(body.parafManagerName), (body.dokumentasiUrls as string[]).join('\n'), payload.sub, jamTanggalPemusnahanList, storeId, lockName])
    if (Number(result[0]?.item_count) !== productList.length) return res.status(409).json({ success: false, message: 'Data duplikat untuk station, tanggal, dan shift ini.' })
    await logActivity({ action: 'submit_waste', category: 'waste', username: payload.sub, ipAddress: getClientIP(req.headers as Record<string, string | string[] | undefined>), userAgent: req.headers['user-agent'] || '', details: { station: kategoriInduk, shift, itemCount: productList.length, date: tanggal, idempotencyKey: typeof idempotencyKey === 'string' ? idempotencyKey : undefined }, status: 'success' })
    return res.status(200).json({ success: true, message: `Data waste ${kategoriInduk} berhasil disimpan`, data: { kategoriInduk, itemsProcessed: productList.length, shift, storeName, shiftDone: true } })
  } catch (err) {
    console.error('[submit-waste] Error:', err)
    return res.status(500).json({ success: false, message: 'Internal server error' })
  }
}
