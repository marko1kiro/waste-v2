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
  if (!url) return false
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
