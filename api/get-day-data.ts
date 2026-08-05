import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSQL, authenticateRequest, getDayDataQuerySchema, fetchDayGrouped } from './lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = await authenticateRequest(req, true)
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const parsed = getDayDataQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }

  const { date, shift, station } = parsed.data

  try {
    const sql = getSQL()

    if (shift && station) {
      const existing = await sql`
        SELECT 1 FROM waste_submission_locks
        WHERE business_date::text = ${date} AND shift = ${shift} AND station = ${station}
        LIMIT 1
      `
      return res.status(200).json({ isDuplicate: existing.length > 0 })
    }

    const { storeName, grouped, raw } = await fetchDayGrouped(date)

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
