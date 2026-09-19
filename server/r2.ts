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

/** Check if a URL is an R2 URL — exact hostname comparison (H2 SSRF fix). */
export function isR2Url(url: string): boolean {
  if (!url || !R2_PUBLIC_DOMAIN) return false
  try {
    return new URL(url).hostname.toLowerCase() === R2_PUBLIC_DOMAIN.toLowerCase()
  } catch {
    return false
  }
}

/**
 * Submit-time allowlist for documentation/signature URLs (H2 SSRF mitigation).
 * Accepts only: our own proxy refs, exact R2 public host, or Vercel Blob hosts.
 */
export function isAllowedUploadUrl(url: string): boolean {
  if (typeof url !== 'string' || !url) return false
  if (url.startsWith('/api/signatures?blobUrl=')) return true
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const host = parsed.hostname.toLowerCase()
  if (R2_PUBLIC_DOMAIN && host === R2_PUBLIC_DOMAIN.toLowerCase()) return true
  return host === 'blob.vercel-storage.com' || host.endsWith('.blob.vercel-storage.com')
}

/** Check if a blob reference is an R2 object key (new private proxy refs), not a URL. */
export function isR2KeyRef(ref: string): boolean {
  return (
    typeof ref === 'string' &&
    ref.length > 0 &&
    !ref.includes('://') &&
    /^[A-Za-z0-9][A-Za-z0-9/_.\-]*$/.test(ref) &&
    !ref.includes('..')
  )
}

/**
 * Resolve an R2 object key from a blob reference:
 * legacy public R2 URLs → key, new private proxy key refs → key, else ''.
 */
export function resolveR2Key(ref: string): string {
  const fromUrl = getR2KeyFromUrl(ref)
  if (fromUrl) return fromUrl
  return isR2KeyRef(ref) ? ref : ''
}

/** Private proxy reference for an R2 object — what new uploads return (H3). */
export function getR2ProxyRef(key: string): string {
  return `/api/signatures?blobUrl=${encodeURIComponent(key)}`
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

/** Upload a buffer to R2. Returns the object key — never a public URL (H3 private-by-default). */
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
    // Uint8Array wrap: aws4fetch types its body as BodyInit (fixes pre-existing type error)
    body: new Uint8Array(buffer),
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`R2 upload failed (HTTP ${response.status}): ${text}`)
  }

  return key
}

/**
 * Fetch a private R2 object server-side with R2 credentials (H3).
 * Never follows redirects; returns null unless the object is fetched OK.
 */
export async function r2GetObject(key: string): Promise<Response | null> {
  if (!key || !R2_BUCKET) return null
  const client = getR2Client()
  const url = `${R2_ENDPOINT}/${R2_BUCKET}/${key}`

  const response = await client.fetch(url, { method: 'GET', redirect: 'manual' })
  if (!response.ok) return null
  return response
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

/** Upload a PDF to R2 scoped by resto & month. Returns the object key. */
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
