import { randomUUID, sign } from 'crypto'

// Drive netral untuk resto baru — TERPISAH dari module legacy CKRBUL.
// Kredensial: GOOGLE_SERVICE_ACCOUNT_KEY (Service Account JSON key).
// Folder: per-resto dari stores.drive_folder_id.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files'
const GOOGLE_DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files'
const SA_SCOPES = 'https://www.googleapis.com/auth/drive'

interface ServiceAccountKey {
  type: string
  project_id: string
  private_key_id: string
  private_key: string
  client_email: string
  client_id: string
  auth_uri: string
  token_uri: string
  auth_provider_x509_cert_url: string
  client_x509_cert_url: string
  universe_domain: string
}

interface NeutralDriveConfig {
  serviceAccountKey: ServiceAccountKey
  folderId: string
}

export interface GoogleDrivePdf {
  id: string
  name: string
  mimeType: string
}

export class GoogleDriveNeutralError extends Error {
  constructor(message: string, readonly kind: 'configuration' | 'upstream') {
    super(message)
    this.name = 'GoogleDriveNeutralError'
  }
}

interface NeutralDriveOptions {
  folderId: string
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function createSignedJwt(saKey: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({
    iss: saKey.client_email,
    scope: SA_SCOPES,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }))
  const data = `${header}.${claim}`
  const signature = sign('RSA-SHA256', Buffer.from(data), saKey.private_key)
  return `${data}.${base64url(signature)}`
}

export function resolveNeutralDriveConfig(
  options: NeutralDriveOptions,
  env: NodeJS.ProcessEnv = process.env,
): NeutralDriveConfig {
  const rawKey = env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim()
  const folderId = options.folderId.trim()
  if (!rawKey) throw new GoogleDriveNeutralError('Missing required GOOGLE_SERVICE_ACCOUNT_KEY', 'configuration')
  if (!folderId) throw new GoogleDriveNeutralError('Missing required per-store drive folder id', 'configuration')
  let serviceAccountKey: ServiceAccountKey
  try {
    serviceAccountKey = JSON.parse(rawKey)
  } catch {
    throw new GoogleDriveNeutralError('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON', 'configuration')
  }
  if (!serviceAccountKey.client_email || !serviceAccountKey.private_key) {
    throw new GoogleDriveNeutralError('GOOGLE_SERVICE_ACCOUNT_KEY missing client_email or private_key', 'configuration')
  }
  return { serviceAccountKey, folderId }
}

function upstreamError(operation: string, status?: number): GoogleDriveNeutralError {
  const suffix = status ? ` (HTTP ${status})` : ''
  return new GoogleDriveNeutralError(`Google Drive (neutral) ${operation} failed${suffix}`, 'upstream')
}

interface CachedAccessToken {
  value: string
  expiresAt: number
}

let cachedAccessToken: CachedAccessToken | null = null
let refreshInFlight: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const config = resolveNeutralDriveConfig({ folderId: 'env-only' })
  const jwt = createSignedJwt(config.serviceAccountKey)
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!response.ok) throw upstreamError('SA token exchange', response.status)
  const body = await response.json() as { access_token?: unknown; expires_in?: unknown }
  if (typeof body.access_token !== 'string' || !body.access_token) throw upstreamError('SA token exchange')
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

export function escapeNeutralDriveQueryLiteral(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export async function findNeutralDrivePdf(filename: string, folderId: string): Promise<GoogleDrivePdf | null> {
  const folder = resolveNeutralDriveConfig({ folderId })
  const query = `'${folder.folderId}' in parents and name = '${escapeNeutralDriveQueryLiteral(filename)}' and mimeType = 'application/pdf' and trashed = false`
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

export async function downloadNeutralDrivePdf(fileId: string): Promise<Response> {
  const params = new URLSearchParams({ alt: 'media' })
  const response = await authorizedFetch(`${GOOGLE_DRIVE_API_URL}/${encodeURIComponent(fileId)}?${params.toString()}`)
  const contentType = response.headers.get('content-type')?.split(';', 1)[0].toLowerCase()
  if (!response.ok || !response.body || contentType !== 'application/pdf') throw upstreamError('file download', response.status)
  return response
}

export async function uploadNeutralDrivePdf(filename: string, pdf: Buffer, folderId: string): Promise<GoogleDrivePdf> {
  const folder = resolveNeutralDriveConfig({ folderId })
  if (!pdf.length || pdf.subarray(0, 5).toString() !== '%PDF-') throw new GoogleDriveNeutralError('Refusing to upload a non-PDF file', 'upstream')
  const boundary = `awas-${randomUUID()}`
  const metadata = JSON.stringify({ name: filename, parents: [folder.folderId], mimeType: 'application/pdf' })
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
