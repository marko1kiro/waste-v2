import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, uploadToBlob, getProxyUrl, getSQL, resolveStoreContext, getRequestedStoreId } from '../server/lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = await authenticateRequest(req, true)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { filename, contentType, base64, folder, date } = req.body || {}
    if (!filename || !contentType || !base64) {
      return res.status(400).json({ error: 'filename, contentType, base64 wajib diisi' })
    }

    let storeCode = 'GLOBAL'
    const sql = getSQL()
    let storeId: number | null = null
    try {
      const resolved = resolveStoreContext({ role: payload.role, storeId: payload.storeId ?? null }, getRequestedStoreId(req))
      storeId = resolved.storeId
    } catch {}

    if (storeId !== null) {
      const storeRows = await sql`SELECT code FROM stores WHERE id = ${storeId} LIMIT 1`
      if (storeRows.length) storeCode = String(storeRows[0].code || 'STORE').toUpperCase()
    }

    const safeFolder = folder ? String(folder).replace(/[^a-zA-Z0-9/_-]/g, '') : 'uploads'
    const cleanFilename = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_')
    const timestamp = Date.now()

    const yearMonth = date && /^\d{4}-\d{2}/.test(String(date))
      ? String(date).slice(0, 7)
      : new Date().toISOString().slice(0, 7)

    let uniqueName: string
    if (safeFolder === 'signatures') {
      uniqueName = `${storeCode}/signatures/${timestamp}-${cleanFilename}`
    } else {
      uniqueName = `${storeCode}/${yearMonth}/${safeFolder}/${timestamp}-${cleanFilename}`
    }

    const cleanedBase64 = String(base64).replace(/^data:.*;base64,/, '')
    const buffer = Buffer.from(cleanedBase64, 'base64')

    const blobUrl = await uploadToBlob(uniqueName, buffer, String(contentType))
    const proxyUrl = getProxyUrl(blobUrl)

    return res.status(200).json({ success: true, blobUrl, proxyUrl })
  } catch (err) {
    console.error('[upload-file] Error:', err)
    return res.status(500).json({ error: 'Upload gagal' })
  }
}
