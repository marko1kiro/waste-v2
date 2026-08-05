import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, uploadToBlob, getProxyUrl } from './lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = await authenticateRequest(req, true)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { filename, contentType, base64, folder } = req.body || {}
    if (!filename || !contentType || !base64) {
      return res.status(400).json({ error: 'filename, contentType, base64 wajib diisi' })
    }

    const cleanedBase64 = String(base64).replace(/^data:.*;base64,/, '')
    const buffer = Buffer.from(cleanedBase64, 'base64')
    const safeFolder = folder ? String(folder).replace(/[^a-zA-Z0-9/_-]/g, '') : 'uploads'
    const uniqueName = `${safeFolder}/${Date.now()}-${String(filename).replace(/[^a-zA-Z0-9._-]/g, '_')}`

    const blobUrl = await uploadToBlob(uniqueName, buffer, String(contentType))
    const proxyUrl = getProxyUrl(blobUrl)

    return res.status(200).json({ success: true, blobUrl, proxyUrl })
  } catch (err) {
    console.error('[upload-file] Error:', err)
    return res.status(500).json({ error: 'Upload gagal' })
  }
}
