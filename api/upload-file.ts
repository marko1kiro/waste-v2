import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authenticateRequest, uploadToBlob, getProxyUrl, getSQL, resolveStoreContext, getRequestedStoreId } from '../server/lib.js'

// H1: strict upload validation — allowlisted image types, 10 MB cap, magic bytes.
const ALLOWED_UPLOAD_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

function detectImageKind(buffer: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg'
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return 'png'
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  return null
}

function claimedKind(contentType: string): 'jpeg' | 'png' | 'webp' | null {
  if (contentType === 'image/jpeg') return 'jpeg'
  if (contentType === 'image/png') return 'png'
  if (contentType === 'image/webp') return 'webp'
  return null
}

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

    // H1: reject SVG outright + allowlist content type (generic errors to client)
    const claimedType = String(contentType).split(';', 1)[0].trim().toLowerCase()
    if (claimedType.includes('svg')) {
      console.warn('[upload-file] Rejected SVG upload attempt')
      return res.status(400).json({ error: 'File tidak valid' })
    }
    if (!ALLOWED_UPLOAD_TYPES.has(claimedType)) {
      console.warn('[upload-file] Rejected disallowed content type')
      return res.status(400).json({ error: 'File tidak valid' })
    }

    const cleanedBase64 = String(base64).replace(/^data:.*;base64,/, '')
    // H1: enforce 10 MB BEFORE decoding — base64 inflates payloads ~4/3
    const maxBase64Length = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4
    if (cleanedBase64.length > maxBase64Length) {
      console.warn('[upload-file] Rejected oversized upload', { base64Length: cleanedBase64.length })
      return res.status(413).json({ error: 'Ukuran file melebihi batas' })
    }
    const buffer = Buffer.from(cleanedBase64, 'base64')
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      console.warn('[upload-file] Rejected upload with invalid decoded size', { bytes: buffer.length })
      return res.status(413).json({ error: 'Ukuran file melebihi batas' })
    }

    // H1: magic bytes must match the claimed content type
    const detected = detectImageKind(buffer)
    if (detected === null || detected !== claimedKind(claimedType)) {
      console.warn('[upload-file] Magic byte mismatch', { claimedType, detected })
      return res.status(400).json({ error: 'File tidak valid' })
    }

    const blobRef = await uploadToBlob(uniqueName, buffer, claimedType)
    // R2 uploads already return a private proxy ref; wrap legacy blob URLs.
    const proxyUrl = blobRef.startsWith('/api/signatures?') ? blobRef : getProxyUrl(blobRef)

    return res.status(200).json({ success: true, blobUrl: proxyUrl, proxyUrl })
  } catch (err) {
    console.error('[upload-file] Error:', err)
    return res.status(500).json({ error: 'Upload gagal' })
  }
}
