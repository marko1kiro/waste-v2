// Cloudflare R2 Object Storage — S3-compatible API via aws4fetch.
// Handles upload and delete for new photo uploads.
// Old Vercel Blob files are untouched (backward compatible).

import { AwsClient } from 'aws4fetch'

const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
const R2_BUCKET = process.env.R2_BUCKET || ''
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || ''

function getR2Client(): AwsClient {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || ''
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || ''
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY')
  }
  return new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })
}

function getPublicUrl(key: string): string {
  return `https://${R2_PUBLIC_DOMAIN}/${key}`
}

/** Check if a URL is an R2 URL (not old Vercel Blob). */
export function isR2Url(url: string): boolean {
  if (!url || !R2_PUBLIC_DOMAIN) return false
  return url.includes(R2_PUBLIC_DOMAIN) && !url.includes('blob.vercel-storage.com')
}

/** Check if a URL is a legacy Vercel Blob URL. */
export function isVercelBlobUrl(url: string): boolean {
  return url.includes('blob.vercel-storage.com')
}

/** Extract the R2 key from a public URL. */
export function getR2KeyFromUrl(url: string): string {
  const prefix = `https://${R2_PUBLIC_DOMAIN}/`
  if (url.startsWith(prefix)) return url.slice(prefix.length)
  return ''
}

/** Upload a buffer to R2. Returns the public URL. */
export async function r2Upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
  if (!R2_BUCKET) throw new Error('Missing R2_BUCKET env')
  const client = getR2Client()
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`

  const response = await client.fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(buffer.length),
    },
    body: buffer,
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`R2 upload failed (HTTP ${response.status}): ${text}`)
  }

  return getPublicUrl(key)
}

/** Delete an object from R2 by key. No-op if key is empty. */
export async function r2Delete(key: string): Promise<void> {
  if (!key || !R2_BUCKET) return
  const client = getR2Client()
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`

  const response = await client.fetch(url, { method: 'DELETE' })
  if (!response.ok && response.status !== 404) {
    const text = await response.text().catch(() => '')
    console.error(`[r2] Delete failed for ${key} (HTTP ${response.status}): ${text}`)
  }
}

// ─── PDF Backup in R2 (Neutral Stores) ──────────────────

/** Build canonical R2 storage key for a store's PDF backup scoped by resto & month. */
export function buildR2PdfKey(storeCode: string, filename: string, date?: string): string {
  const safeCode = (storeCode || 'STORE').toUpperCase().replace(/[^A-Z0-9_-]/g, '')
  const yearMonth = date && /^\d{4}-\d{2}/.test(date)
    ? date.slice(0, 7)
    : new Date().toISOString().slice(0, 7)
  return `${safeCode}/${yearMonth}/pdf-backup/${filename}`
}

/** Check if a PDF exists in R2. Returns public URL if found, null otherwise. */
export async function findR2Pdf(storeCode: string, filename: string, date?: string): Promise<{ key: string; url: string } | null> {
  if (!R2_BUCKET || !R2_PUBLIC_DOMAIN) return null
  const key = buildR2PdfKey(storeCode, filename, date)
  const client = getR2Client()
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`

  const response = await client.fetch(url, { method: 'HEAD' })
  if (response.status === 200) {
    return { key, url: getPublicUrl(key) }
  }
  return null
}

/** Download a PDF directly from R2. */
export async function downloadR2Pdf(storeCode: string, filename: string, date?: string): Promise<Response | null> {
  if (!R2_BUCKET) return null
  const key = buildR2PdfKey(storeCode, filename, date)
  const client = getR2Client()
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`

  const response = await client.fetch(url, { method: 'GET' })
  if (!response.ok) return null
  return response
}

/** Upload a PDF to R2 scoped by resto & month. Returns public URL. */
export async function uploadR2Pdf(storeCode: string, filename: string, pdf: Buffer, date?: string): Promise<string> {
  const key = buildR2PdfKey(storeCode, filename, date)
  return r2Upload(key, pdf, 'application/pdf')
}

export interface R2PdfItem {
  filename: string
  url: string
  downloadUrl: string
  size: number
  uploadedAt: string
}

/** List all PDF backups in R2 for a specific store and month (YYYY-MM). */
export async function listR2Pdfs(storeCode: string, month: string): Promise<R2PdfItem[]> {
  if (!R2_BUCKET || !R2_PUBLIC_DOMAIN) return []
  const safeCode = (storeCode || 'STORE').toUpperCase().replace(/[^A-Z0-9_-]/g, '')
  const client = getR2Client()

  // We check both new structure (STORE/YYYY-MM/pdf-backup/) and transitional (pdf-backup/STORE/)
  const prefixes = [
    `${safeCode}/${month}/pdf-backup/`,
    `pdf-backup/${safeCode}/`,
  ]

  const items: R2PdfItem[] = []
  const seenKeys = new Set<string>()

  for (const prefix of prefixes) {
    const url = `${R2_ENDPOINT}/${R2_BUCKET}?list-type=2&prefix=${encodeURIComponent(prefix)}`
    const response = await client.fetch(url, { method: 'GET' })
    if (!response.ok) continue

    const text = await response.text().catch(() => '')
    // Parse S3 ListBucketResult XML using regex (zero-dependency)
    const contentsMatches = text.match(/<Contents>[\s\S]*?<\/Contents>/g) || []

    for (const content of contentsMatches) {
      const keyMatch = content.match(/<Key>(.*?)<\/Key>/)
      const sizeMatch = content.match(/<Size>(\d+)<\/Size>/)
      const dateMatch = content.match(/<LastModified>(.*?)<\/LastModified>/)

      if (!keyMatch) continue
      const key = keyMatch[1]
      if (!key.endsWith('.pdf') || seenKeys.has(key)) continue
      seenKeys.add(key)

      const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 0
      const uploadedAt = dateMatch ? dateMatch[1] : new Date().toISOString()
      const filename = key.split('/').pop() || ''

      const publicUrl = getPublicUrl(key)
      items.push({
        filename,
        url: publicUrl,
        downloadUrl: publicUrl,
        size,
        uploadedAt,
      })
    }
  }

  return items.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
}
