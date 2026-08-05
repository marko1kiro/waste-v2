import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSQL, authenticateRequest, dashboardQuerySchema } from './lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const payload = await authenticateRequest(req)
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const parsed = dashboardQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }

  const { startDate, endDate, mode } = parsed.data

  try {
    const sql = getSQL()

    if (mode === 'activity-log') {
      if (payload.role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden' })
      }
      const logs = await sql`
        SELECT action, category, username, ip_address, details, status, created_at
        FROM activity_logs
        ORDER BY created_at DESC
        LIMIT 100
      `
      return res.status(200).json({ success: true, logs })
    }

    let rows
    if (startDate && endDate) {
      rows = await sql`
        SELECT business_date::text AS business_date, shift, kategori_induk, nama_produk,
               jumlah_produk, unit, paraf_qc_name, submitted_by, created_at
        FROM product_destructions
        WHERE business_date >= ${startDate} AND business_date <= ${endDate}
        ORDER BY business_date DESC, created_at ASC
      `
    } else {
      rows = await sql`
        SELECT business_date::text AS business_date, shift, kategori_induk, nama_produk,
               jumlah_produk, unit, paraf_qc_name, submitted_by, created_at
        FROM product_destructions
        WHERE business_date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY business_date DESC, created_at ASC
      `
    }

    const dateSet = new Set<string>()
    let totalItems = 0
    let totalQty = 0
    const stationTotals: Record<string, number> = {}
    const shiftTotals: Record<string, number> = {}
    const productCount: Record<string, { count: number; qty: number }> = {}
    const dailyMap: Record<string, { items: number; qty: number; stations: Record<string, number>; shifts: Record<string, number> }> = {}

    for (const row of rows) {
      const dateStr = String(row.business_date).slice(0, 10)
      dateSet.add(dateStr)
      totalItems++
      totalQty += Number(row.jumlah_produk)

      stationTotals[row.kategori_induk] = (stationTotals[row.kategori_induk] || 0) + Number(row.jumlah_produk)

      shiftTotals[row.shift] = (shiftTotals[row.shift] || 0) + Number(row.jumlah_produk)

      if (!productCount[row.nama_produk]) {
        productCount[row.nama_produk] = { count: 0, qty: 0 }
      }
      productCount[row.nama_produk].count++
      productCount[row.nama_produk].qty += Number(row.jumlah_produk)

      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { items: 0, qty: 0, stations: {}, shifts: {} }
      }
      dailyMap[dateStr].items++
      dailyMap[dateStr].qty += Number(row.jumlah_produk)
      dailyMap[dateStr].stations[row.kategori_induk] = (dailyMap[dateStr].stations[row.kategori_induk] || 0) + Number(row.jumlah_produk)
      dailyMap[dateStr].shifts[row.shift] = (dailyMap[dateStr].shifts[row.shift] || 0) + Number(row.jumlah_produk)
    }

    const totalDays = dateSet.size
    const availableDates = Array.from(dateSet).sort().reverse()
    const dailyData = availableDates.map((date) => ({
      date,
      ...dailyMap[date],
    }))

    const topProducts = Object.entries(productCount)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)

    let lastEntry = null
    if (rows.length > 0) {
      const last = rows[0]
      lastEntry = {
        date: String(last.business_date).slice(0, 10),
        qc: last.paraf_qc_name,
        station: last.kategori_induk,
        shift: last.shift,
      }
    }

    return res.status(200).json({
      success: true,
      availableDates,
      summary: {
        totalDays,
        totalItems,
        totalQty,
        avgItemsPerDay: totalDays > 0 ? Math.round(totalItems / totalDays) : 0,
        avgQtyPerDay: totalDays > 0 ? Math.round(totalQty / totalDays) : 0,
      },
      dailyData,
      stationTotals,
      shiftTotals,
      topProducts,
      lastEntry,
    })
  } catch (err) {
    console.error('[dashboard-data] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
