import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Readable } from 'stream'
import { get } from '@vercel/blob'
import { authenticateRequest, createBlobAccessToken, fetchDayGrouped, getSQL, resolveStoreContext, getRequestedStoreId, isR2Url } from '../server/lib.js'
import { downloadGoogleDrivePdf, findGoogleDrivePdf, GoogleDriveBackupError, uploadGoogleDrivePdf } from '../server/google-drive.js'
import { downloadNeutralDrivePdf, findNeutralDrivePdf, GoogleDriveNeutralError, uploadNeutralDrivePdf } from '../server/google-drive-neutral.js'
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

  let contentType: string | null
  let bytes: Buffer

  if (isR2Url(privateUrl)) {
    // R2 URLs are public — fetch directly
    const response = await fetch(privateUrl)
    if (!response.ok) throw new Error('R2 asset unavailable')
    contentType = supportedImageType(response.headers.get('content-type'), privateUrl)
    if (!contentType) throw new Error('Unsupported PDF image type')
    bytes = Buffer.from(await response.arrayBuffer())
  } else {
    // Legacy Vercel Blob — use @vercel/blob get()
    const result = await get(privateUrl, { access: 'private' })
    if (!result || result.statusCode !== 200 || !result.stream) throw new Error('Private asset unavailable')
    contentType = supportedImageType(result.blob.contentType, privateUrl)
    if (!contentType) throw new Error('Unsupported PDF image type')
    bytes = Buffer.from(await new Response(result.stream).arrayBuffer())
  }

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

type PdfResponseSource = 'google-drive' | 'generated-drive' | 'generated-on-demand'

function setPdfHeaders(res: VercelResponse, filename: string, contentLength: string | undefined, source: PdfResponseSource) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.setHeader('X-AWAS-PDF-Source', source)
  if (contentLength) res.setHeader('Content-Length', contentLength)
  res.setHeader('Cache-Control', 'private, no-store')
}

function sendPdf(res: VercelResponse, filename: string, pdf: Buffer | Uint8Array, source: Exclude<PdfResponseSource, 'google-drive'>) {
  setPdfHeaders(res, filename, String(pdf.byteLength), source)
  return res.status(200).send(Buffer.from(pdf))
}

function streamGoogleDrivePdf(res: VercelResponse, filename: string, response: Response) {
  setPdfHeaders(res, filename, response.headers.get('content-length') || undefined, 'google-drive')
  res.status(200)
  const stream = Readable.fromWeb(response.body as import('stream/web').ReadableStream)
  stream.on('error', (error) => {
    console.error('[generate-pdf] Google Drive download stream failed:', error)
    if (!res.headersSent) res.status(502).json({ error: 'Google Drive PDF download failed' })
    else res.destroy(error)
  })
  stream.pipe(res)
  return res
}

async function claimDriveGeneration(date: string, storeId: number): Promise<boolean> {
  // daily_records is the source of truth for MIDNIGHT completion. Its existing PDF
  // fields double as a short server-side lease, so simultaneous functions do not upload duplicates.
  const rows = await getSQL()`
    UPDATE daily_records
    SET pdf_generated = TRUE, pdf_generated_at = NOW()
    WHERE business_date::text = ${date}
      AND store_id = ${storeId}
      AND shift = 'MIDNIGHT'
      AND done = TRUE
      AND (pdf_generated = FALSE OR pdf_generated_at IS NULL OR pdf_generated_at < NOW() - INTERVAL '2 minutes')
    RETURNING id
  `
  return rows.length === 1
}

async function releaseDriveGenerationClaim(date: string, storeId: number): Promise<void> {
  await getSQL()`
    UPDATE daily_records
    SET pdf_generated = FALSE, pdf_generated_at = NULL
    WHERE business_date::text = ${date} AND store_id = ${storeId} AND shift = 'MIDNIGHT' AND done = TRUE
  `
}

async function markDriveGenerationComplete(date: string, storeId: number): Promise<void> {
  await getSQL()`
    UPDATE daily_records
    SET pdf_generated = TRUE, pdf_generated_at = NOW()
    WHERE business_date::text = ${date} AND store_id = ${storeId} AND shift = 'MIDNIGHT' AND done = TRUE
  `
}

async function waitForDrivePdf(filename: string, store: { drive_account: string; drive_folder_id: string }) {
  const delays = [0, 500, 900, 1400, 2000, 2800]
  for (const delay of delays) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay))
    const existing = store.drive_account === 'legacy'
      ? await findGoogleDrivePdf(filename)
      : await findNeutralDrivePdf(filename, store.drive_folder_id)
    if (existing) return existing
  }
  return null
}

function isDriveError(error: unknown): error is GoogleDriveBackupError | GoogleDriveNeutralError {
  return error instanceof GoogleDriveBackupError || error instanceof GoogleDriveNeutralError
}

function driveFailureMessage(error: unknown): string {
  if (isDriveError(error) && error.kind === 'configuration') {
    return 'Google Drive backup belum dikonfigurasi. Hubungi administrator untuk melengkapi kredensial Google Drive.'
  }
  return 'Google Drive backup wajib untuk PDF dengan shift MIDNIGHT selesai, tetapi Drive sedang tidak tersedia. Coba lagi beberapa saat atau hubungi administrator.'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const payload = await authenticateRequest(req, true)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })
  let storeId: number | null
  try {
    const resolved = resolveStoreContext({ role: payload.role, storeId: payload.storeId ?? null }, getRequestedStoreId(req))
    storeId = resolved.storeId
  } catch {
    return res.status(403).json({ error: 'Store context missing' })
  }
  if (storeId === null) return res.status(400).json({ error: 'store_id wajib untuk generate PDF' })
  const { date } = req.query as Record<string, string | undefined>
  if (!isCalendarDate(date)) return res.status(400).json({ error: 'Format date harus kalender valid YYYY-MM-DD' })

  let driveGenerationClaimed = false
  try {
    const sql = getSQL()
    const midnightRows = await sql`
      SELECT done
      FROM daily_records
      WHERE business_date::text = ${date} AND shift = 'MIDNIGHT' AND store_id = ${storeId}
      LIMIT 1
    `
    const midnightComplete = midnightRows[0]?.done === true
    const [{ storeName, grouped }, storeRows, configRows, personnelRows] = await Promise.all([
      fetchDayGrouped(date, storeId),
      sql`SELECT code, name, drive_account, drive_folder_id FROM stores WHERE id = ${storeId} LIMIT 1`,
      sql`SELECT store_name, extra_config FROM tenant_configs WHERE store_id = ${storeId} LIMIT 1`,
      sql`SELECT id, name, full_name, signature_url FROM personnel WHERE status = 'active' AND store_id = ${storeId}`,
    ])
    const store = storeRows[0]
    if (!store) return res.status(404).json({ error: 'Store tidak ditemukan' })
    const isNeutral = store.drive_account !== 'legacy'
    const config = (configRows[0]?.extra_config as Record<string, unknown> | undefined) || {}
    const filename = buildPdfFilename(String(config.store_code || 'STORE'), date)
    const driveStore = { drive_account: String(store.drive_account), drive_folder_id: String(store.drive_folder_id || '') }

    // Preserve the current on-demand behavior for dates that are not complete.
    // In particular, do not even validate credentials or make a Google request here.
    if (midnightComplete) {
      let existing
      try {
        existing = isNeutral
          ? await findNeutralDrivePdf(filename, driveStore.drive_folder_id)
          : await findGoogleDrivePdf(filename)
        if (existing) {
          const drivePdf = isNeutral
            ? await downloadNeutralDrivePdf(existing.id)
            : await downloadGoogleDrivePdf(existing.id)
          void markDriveGenerationComplete(date, storeId).catch((error) => console.error('[generate-pdf] Could not update Drive PDF status:', error))
          return streamGoogleDrivePdf(res, filename, drivePdf)
        }
        driveGenerationClaimed = await claimDriveGeneration(date, storeId)
        if (!driveGenerationClaimed) {
          const uploadedByAnotherRequest = await waitForDrivePdf(filename, driveStore)
          if (uploadedByAnotherRequest) {
            const drivePdf = isNeutral
              ? await downloadNeutralDrivePdf(uploadedByAnotherRequest.id)
              : await downloadGoogleDrivePdf(uploadedByAnotherRequest.id)
            return streamGoogleDrivePdf(res, filename, drivePdf)
          }
          return res.status(503).json({ error: 'PDF sedang diamankan ke Google Drive oleh request lain. Coba download lagi dalam beberapa detik.' })
        }
      } catch (error) {
        console.error('[generate-pdf] Google Drive lookup failed:', error)
        if (driveGenerationClaimed) await releaseDriveGenerationClaim(date, storeId).catch((releaseError) => console.error('[generate-pdf] Could not release Drive generation claim:', releaseError))
        driveGenerationClaimed = false
        return res.status(503).json({ error: driveFailureMessage(error) })
      }
    }

    // Preserve the current on-demand behavior for dates that are not complete.
    // In particular, do not even validate credentials or make a Google request here.

    const stats = resolvePdfSignatures(grouped as unknown as Record<string, PdfItem[]>, personnelRows as SignaturePersonnel[])
    const signatureUrls = [...new Set(Object.values(grouped).flatMap((items) => items.flatMap((item) => [String(item.parafQC || ''), String(item.parafManager || '')])).filter(Boolean))]
    const documentationUrls = [...new Set(Object.values(grouped).flatMap((items) => items.flatMap((item) => (item.dokumentasi as string[] | undefined) || [])).filter(Boolean))]
    let documentationAssets: Map<string, string>
    try {
      documentationAssets = await loadAssets(documentationUrls)
    } catch (error) {
      console.error('[generate-pdf] Required referenced image unavailable:', error)
      if (driveGenerationClaimed) await releaseDriveGenerationClaim(date, storeId).catch((releaseError) => console.error('[generate-pdf] Could not release Drive generation claim:', releaseError))
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

    if (midnightComplete) {
      try {
        if (isNeutral) await uploadNeutralDrivePdf(filename, Buffer.from(pdf), driveStore.drive_folder_id)
        else await uploadGoogleDrivePdf(filename, Buffer.from(pdf))
        driveGenerationClaimed = false // Keep the successful lease/status for future requests.
        await markDriveGenerationComplete(date, storeId).catch((error) => console.error('[generate-pdf] Could not finalize Drive PDF status:', error))
      } catch (error) {
        console.error('[generate-pdf] Google Drive upload failed:', error)
        if (driveGenerationClaimed) await releaseDriveGenerationClaim(date, storeId).catch((releaseError) => console.error('[generate-pdf] Could not release Drive generation claim:', releaseError))
        driveGenerationClaimed = false
        return res.status(503).json({ error: driveFailureMessage(error) })
      }
    }

    return sendPdf(res, filename, pdf, midnightComplete ? 'generated-drive' : 'generated-on-demand')
  } catch (error) {
    if (driveGenerationClaimed) await releaseDriveGenerationClaim(date, storeId).catch((releaseError) => console.error('[generate-pdf] Could not release Drive generation claim:', releaseError))
    console.error('[generate-pdf] Error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
