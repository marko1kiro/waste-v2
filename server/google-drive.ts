import { randomUUID } from 'crypto'

const GOOGLE_DRIVE_FOLDER_ID = '1R0xINfBaFmgogIEsfzS20ivd-nzWwiBw'
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files'
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'

interface GoogleDriveCredentials {
  clientId: string
  clientSecret: string
  refreshToken: string
}

export interface GoogleDrivePdf {
  id: string
  name: string
  mimeType: string
}

export class GoogleDriveBackupError extends Error {
  constructor(message: string, readonly kind: 'configuration' | 'upstream') {
    super(message)
    this.name = 'GoogleDriveBackupError'
  }
}

interface CachedAccessToken {
  value: string
  expiresAt: number
}

let cachedAccessToken: CachedAccessToken | null = null
let refreshInFlight: Promise<string> | null = null

function requiredEnvironment(name: 'GOOGLE_DRIVE_CLIENT_ID' | 'GOOGLE_DRIVE_CLIENT_SECRET' | 'GOOGLE_DRIVE_REFRESH_TOKEN'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new GoogleDriveBackupError(`Missing required ${name}`, 'configuration')
  return value
}

function getCredentials(): GoogleDriveCredentials {
  return {
    clientId: requiredEnvironment('GOOGLE_DRIVE_CLIENT_ID'),
    clientSecret: requiredEnvironment('GOOGLE_DRIVE_CLIENT_SECRET'),
    refreshToken: requiredEnvironment('GOOGLE_DRIVE_REFRESH_TOKEN'),
  }
}

function upstreamError(operation: string, status?: number): GoogleDriveBackupError {
  const suffix = status ? ` (HTTP ${status})` : ''
  return new GoogleDriveBackupError(`Google Drive ${operation} failed${suffix}`, 'upstream')
}

async function refreshAccessToken(): Promise<string> {
  const credentials = getCredentials()
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!response.ok) throw upstreamError('OAuth token refresh', response.status)
  const body = await response.json() as { access_token?: unknown; expires_in?: unknown }
  if (typeof body.access_token !== 'string' || !body.access_token) throw upstreamError('OAuth token refresh')
  const expiresIn = typeof body.expires_in === 'number' && Number.isFinite(body.expires_in) ? body.expires_in : 300
  cachedAccessToken = { value: body.access_token, expiresAt: Date.now() + Math.max(60, expiresIn - 60) * 1000 }
  return cachedAccessToken.value
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) return cachedAccessToken.value
  if (!forceRefresh && refreshInFlight) return refreshInFlight
  refreshInFlight = refreshAccessToken()
  try {
    return await refreshInFlight
  } finally {
    refreshInFlight = null
  }
}

async function authorizedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const accessToken = await getAccessToken(attempt === 1)
    const headers = new Headers(init.headers)
    headers.set('Authorization', `Bearer ${accessToken}`)
    const response = await fetch(url, { ...init, headers })
    if (response.status !== 401 || attempt === 1) return response
    cachedAccessToken = null
  }
  throw upstreamError('request')
}

export function escapeGoogleDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function findGoogleDrivePdf(filename: string): Promise<GoogleDrivePdf | null> {
  const query = `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and name = '${escapeGoogleDriveQueryLiteral(filename)}' and mimeType = 'application/pdf' and trashed = false`
  const params = new URLSearchParams({
    q: query,
    fields: 'files(id,name,mimeType,createdTime)',
    orderBy: 'createdTime desc',
    pageSize: '1',
  })
  const response = await authorizedFetch(`${GOOGLE_DRIVE_API_URL}?${params.toString()}`)
  if (!response.ok) throw upstreamError('file search', response.status)
  const body = await response.json() as { files?: unknown }
  if (!Array.isArray(body.files) || body.files.length === 0) return null
  const file = body.files[0] as { id?: unknown; name?: unknown; mimeType?: unknown }
  if (typeof file.id !== 'string' || file.name !== filename || file.mimeType !== 'application/pdf') throw upstreamError('file search')
  return { id: file.id, name: file.name, mimeType: file.mimeType }
}

export async function downloadGoogleDrivePdf(fileId: string): Promise<Response> {
  const params = new URLSearchParams({ alt: 'media' })
  const response = await authorizedFetch(`${GOOGLE_DRIVE_API_URL}/${encodeURIComponent(fileId)}?${params.toString()}`)
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].toLowerCase()
  if (!response.ok || !response.body || contentType !== 'application/pdf') throw upstreamError('file download', response.status)
  return response
}

export async function uploadGoogleDrivePdf(filename: string, pdf: Buffer): Promise<GoogleDrivePdf> {
  if (!pdf.length || pdf.subarray(0, 5).toString() !== '%PDF-') throw new GoogleDriveBackupError('Refusing to upload a non-PDF file', 'upstream')
  const boundary = `awas-${randomUUID()}`
  const metadata = JSON.stringify({ name: filename, parents: [GOOGLE_DRIVE_FOLDER_ID], mimeType: 'application/pdf' })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`, 'utf8'),
    Buffer.from(`--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`, 'utf8'),
    pdf,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'),
  ])
  const response = await authorizedFetch(`${GOOGLE_DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  })
  if (!response.ok) throw upstreamError('file upload', response.status)
  const file = await response.json() as { id?: unknown; name?: unknown; mimeType?: unknown }
  if (typeof file.id !== 'string' || file.name !== filename || file.mimeType !== 'application/pdf') throw upstreamError('file upload')
  return { id: file.id, name: file.name, mimeType: file.mimeType }
}
