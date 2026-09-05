import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSQL, authenticateRequest, getDayDataQuerySchema, fetchDayGrouped, resolveStoreContext, getRequestedStoreId } from './lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = await authenticateRequest(req, true)
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

  const parsed = getDayDataQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }

  const { date, shift, station } = parsed.data

  try {
    const sql = getSQL()

    if (shift && station) {
      if (storeId === null) return res.status(400).json({ error: 'store_id wajib' })
      const existing = await sql`
        SELECT 1 FROM waste_submission_locks
        WHERE store_id = ${storeId} AND business_date::text = ${date} AND shift = ${shift} AND station = ${station}
        LIMIT 1
      `
      return res.status(200).json({ isDuplicate: existing.length > 0 })
    }

    const { storeName, grouped, raw } = await fetchDayGrouped(date, storeId)

    return res.status(200).json({
      success: true,
      date,
      storeName,
      grouped,
      raw,
    })
  } catch (err) {
    console.error('[get-day-data] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
