import type { VercelRequest, VercelResponse } from '@vercel/node'
import { list } from '@vercel/blob'
import { getSQL, authenticateRequest, shiftStatusQuerySchema, resolveStoreContext, getRequestedStoreId } from './lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = await authenticateRequest(req)
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let storeId: number | null
  try {
    const resolved = resolveStoreContext({ role: payload.role, storeId: payload.storeId ?? null }, getRequestedStoreId(req))
    storeId = resolved.storeId
  } catch {
    return res.status(403).json({ error: 'Store context missing' })
  }

  const { action } = req.query as Record<string, string | undefined>
  const sql = getSQL()

  if (action === 'station-items') {
    const { station } = req.query as Record<string, string | undefined>

    let rows
    if (storeId === null) {
      return res.status(400).json({ error: 'store_id wajib untuk station-items' })
    }
    if (station) {
      rows = await sql`
        SELECT id, station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order, status
        FROM station_items
        WHERE store_id = ${storeId} AND station = ${station.toUpperCase()} AND status = 'active'
        ORDER BY sort_order ASC, nama_produk ASC
      `
    } else {
      rows = await sql`
        SELECT id, station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order, status
        FROM station_items
        WHERE store_id = ${storeId} AND status = 'active'
        ORDER BY station ASC, sort_order ASC, nama_produk ASC
      `
    }

    return res.status(200).json({ success: true, data: rows })
  }

  if (action === 'shift-status') {
    const parsed = shiftStatusQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }

    const { date } = parsed.data

    try {
      const records = storeId === null
        ? await sql`
          SELECT shift, done, submitted_by, submitted_at
          FROM daily_records
          WHERE business_date::text = ${date}
          ORDER BY
            CASE shift
              WHEN 'OPENING' THEN 1
              WHEN 'MIDDLE' THEN 2
              WHEN 'CLOSING' THEN 3
              WHEN 'MIDNIGHT' THEN 4
            END
        `
        : await sql`
          SELECT shift, done, submitted_by, submitted_at
          FROM daily_records
          WHERE business_date::text = ${date} AND store_id = ${storeId}
          ORDER BY
            CASE shift
              WHEN 'OPENING' THEN 1
              WHEN 'MIDDLE' THEN 2
              WHEN 'CLOSING' THEN 3
              WHEN 'MIDNIGHT' THEN 4
            END
        `

      const shifts: Record<string, { done: boolean; submittedBy: string | null; submittedAt: string | null }> = {
        OPENING: { done: false, submittedBy: null, submittedAt: null },
        MIDDLE: { done: false, submittedBy: null, submittedAt: null },
        CLOSING: { done: false, submittedBy: null, submittedAt: null },
        MIDNIGHT: { done: false, submittedBy: null, submittedAt: null },
      }

      for (const row of records) {
        if (row.shift in shifts) {
          shifts[row.shift] = {
            done: row.done,
            submittedBy: row.submitted_by || null,
            submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
          }
        }
      }

      const pdfUnlocked = shifts.MIDNIGHT.done === true

      return res.status(200).json({
        success: true,
        date,
        shifts,
        pdfUnlocked,
      })
    } catch (err) {
      console.error('[shift-status] Error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (action === 'list-blob-pdfs') {
    const { month } = req.query as Record<string, string | undefined>

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'Format month harus YYYY-MM (contoh: 2026-06)' })
    }

    try {
      const result = await list({
        prefix: 'pdf-backup/',
        limit: 100,
        mode: 'expanded',
      })

      const pdfs = (result.blobs || [])
        .filter((blob) => {
          const pathname = blob.pathname || ''
          if (!pathname.startsWith('pdf-backup/') || !pathname.endsWith('.pdf')) return false
          const uploadedAt = blob.uploadedAt ? new Date(blob.uploadedAt) : null
          if (!uploadedAt) return false
          const ym = `${uploadedAt.getFullYear()}-${String(uploadedAt.getMonth() + 1).padStart(2, '0')}`
          return ym === month
        })
        .map((blob) => ({
          filename: blob.pathname?.split('/').pop() || '',
          url: blob.url,
          downloadUrl: blob.downloadUrl,
          size: blob.size,
          uploadedAt: blob.uploadedAt,
        }))
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())

      return res.status(200).json({
        success: true,
        month,
        count: pdfs.length,
        pdfs,
      })
    } catch (err) {
      console.error('[list-blob-pdfs] Error:', err)
      return res.status(500).json({ error: 'Gagal mengambil daftar PDF', details: String(err) })
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
