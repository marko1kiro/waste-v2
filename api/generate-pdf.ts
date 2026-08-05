import type { VercelRequest, VercelResponse } from '@vercel/node'
import { get } from '@vercel/blob'
import { authenticateRequest, createBlobAccessToken, fetchDayGrouped, getSQL } from './lib.js'
import { buildPdfFilename, renderDailyPdf, type PdfItem } from '../shared/pdf-renderer.js'
import { resolvePdfSignatures, type SignaturePersonnel } from '../shared/pdf-signature-resolver.js'

function isCalendarDate(date: string | undefined): date is string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const value = new Date(`${date}T00:00:00.000Z`)
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0, 10) === date
}

const MAX_ASSET_COUNT = 60
const MAX_ASSET_BYTES = 20 * 1024 * 1024
const ASSET_CONCURRENCY = 4
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

function dataUrl(contentType: string, bytes: Buffer): string {
  return `data:${contentType};base64,${bytes.toString('base64')}`
}

function blobUrl(url: string): string | null {
  const match = url.match(/[?&]blobUrl=([^&]+)/)
  if (match) return decodeURIComponent(match[1])
  return url.startsWith('https://') ? url : null
}

function supportedImageType(contentType: string | null | undefined, url: string): string | null {
  const type = contentType?.split(';', 1)[0].toLowerCase()
  if (type && supportedImageTypes.has(type)) return type
  const extension = new URL(url).pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase()
  return extension === 'jpg' || extension === 'jpeg' ? 'image/jpeg' : extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : null
}

async function loadPrivateAsset(url: string): Promise<{ asset: string; bytes: number }> {
  const privateUrl = blobUrl(url)
  if (!privateUrl) throw new Error('Unsupported private asset URL')
  const result = await get(privateUrl, { access: 'private' })
  if (!result || result.statusCode !== 200 || !result.stream) throw new Error('Private asset unavailable')
  const contentType = supportedImageType(result.blob.contentType, privateUrl)
  if (!contentType) throw new Error('Unsupported PDF image type')
  const bytes = Buffer.from(await new Response(result.stream).arrayBuffer())
  if (!bytes.length || bytes.byteLength > MAX_ASSET_BYTES) throw new Error('PDF asset byte limit exceeded')
  return { asset: dataUrl(contentType, bytes), bytes: bytes.byteLength }
}

async function loadAssets(urls: string[], optional = false): Promise<Map<string, string>> {
  if (urls.length > MAX_ASSET_COUNT && !optional) throw new Error('PDF asset count limit exceeded')
  const assets = new Map<string, string>()
  let next = 0
  let totalBytes = 0
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++]
      try {
        const loaded = await loadPrivateAsset(url)
        if (totalBytes + loaded.bytes > MAX_ASSET_BYTES) throw new Error('PDF asset byte limit exceeded')
        totalBytes += loaded.bytes
        assets.set(url, loaded.asset)
      } catch (error) {
        if (!optional) throw error
        console.warn('[generate-pdf] Optional signature asset unavailable:', url)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(ASSET_CONCURRENCY, urls.length) }, worker))
  return assets
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const payload = await authenticateRequest(req, true)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })
  const { date } = req.query as Record<string, string | undefined>
  if (!isCalendarDate(date)) return res.status(400).json({ error: 'Format date harus kalender valid YYYY-MM-DD' })

  try {
    const [{ storeName, grouped }, configRows, personnelRows] = await Promise.all([
      fetchDayGrouped(date),
      getSQL()`SELECT store_name, extra_config FROM tenant_configs LIMIT 1`,
      // Master is intentionally loaded once per PDF across the single-tenant personnel table; resolver never queries per row.
      getSQL()`SELECT id, name, full_name, signature_url FROM personnel WHERE status = 'active'`,
    ])
    const stats = resolvePdfSignatures(grouped as unknown as Record<string, PdfItem[]>, personnelRows as SignaturePersonnel[])
    const config = (configRows[0]?.extra_config as Record<string, unknown> | undefined) || {}
    const signatureUrls = [...new Set(Object.values(grouped).flatMap((items) => items.flatMap((item) => [String(item.parafQC || ''), String(item.parafManager || '')])).filter(Boolean))]
    const documentationUrls = [...new Set(Object.values(grouped).flatMap((items) => items.flatMap((item) => (item.dokumentasi as string[] | undefined) || [])).filter(Boolean))]
    let documentationAssets: Map<string, string>
    try {
      documentationAssets = await loadAssets(documentationUrls)
    } catch (error) {
      console.error('[generate-pdf] Required referenced image unavailable:', error)
      return res.status(502).json({ error: 'Required PDF image asset unavailable' })
    }
    const signatureAssets = await loadAssets(signatureUrls, true)
    const assets = new Map([...documentationAssets, ...signatureAssets])
    const assetUrls = [...new Set([...signatureUrls, ...documentationUrls])]
    const assetLinks = new Map(assetUrls.map((url) => [url, `${String(config.public_url || process.env.PUBLIC_URL || 'https://www.gacoanku.my.id').replace(/\/$/, '')}/api/signatures?blobUrl=${encodeURIComponent(blobUrl(url) || url)}&token=${encodeURIComponent(createBlobAccessToken(blobUrl(url) || url))}`]))
     const pdf = renderDailyPdf({

      date,
      storeName: String(configRows[0]?.store_name || storeName),
      storeCode: String(config.store_code || 'STORE'),
      publicUrl: String(config.public_url || process.env.PUBLIC_URL || 'https://www.gacoanku.my.id'),
      checklistUrl: String(config.qc_checklist_url || ''),
       grouped: grouped as unknown as Record<string, PdfItem[]>,
       assets,
       assetLinks,

    })
    console.info('[generate-pdf] Signature resolution summary:', stats)
    const filename = buildPdfFilename(String(config.store_code || 'STORE'), date)
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Length', String(pdf.byteLength))
    res.setHeader('Cache-Control', 'private, no-store')
    return res.status(200).send(Buffer.from(pdf))
  } catch (error) {
    console.error('[generate-pdf] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
