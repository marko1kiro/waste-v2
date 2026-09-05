import { z } from 'zod'
import { neon } from '@neondatabase/serverless'
import { put } from '@vercel/blob'
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

// ─── DB ────────────────────────────────────────────────
export function getSQL() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  return neon(databaseUrl)
}

// ─── Auth ──────────────────────────────────────────────
const JWT_EXPIRY_SECONDS = 8 * 60 * 60

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const derived = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return timingSafeEqual(derived, expected)
}

interface JWTPayload {
  sub: string
  role: string
  name: string
  store_id?: number | null
  iat: number
  exp: number
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters')
  }
  return secret
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64url')
}

function hmacSign(data: string): string {
  return createHmac('sha256', getSecret()).update(data).digest('base64url')
}

export function createToken(username: string, role: string, displayName: string, storeId: number | null = null): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: JWTPayload = {
    sub: username,
    role,
    name: displayName,
    store_id: storeId,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
  }

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(payload))
  const signature = hmacSign(`${header}.${body}`)

  return `${header}.${body}.${signature}`
}

export interface StoreContext {
  role: string
  storeId: number | null
}

export interface ResolvedStore {
  storeId: number | null
}

export function resolveStoreContext(
  ctx: StoreContext,
  requestedStoreId: number | undefined,
): ResolvedStore {
  if (ctx.role === 'super_admin') {
    if (
      requestedStoreId !== undefined &&
      Number.isInteger(requestedStoreId) &&
      requestedStoreId > 0
    ) {
      return { storeId: requestedStoreId }
    }
    return { storeId: null }
  }
  if (ctx.storeId === null || !Number.isInteger(ctx.storeId)) {
    throw new Error('Store context missing')
  }
  return { storeId: ctx.storeId }
}

export interface BlobAccessPayload {
  blobUrl: string
  exp: number
}

export function createBlobAccessToken(blobUrl: string, expiresInSeconds = 10 * 60): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'BLOB_ACCESS' }))
  const payload: BlobAccessPayload = { blobUrl, exp: Math.floor(Date.now() / 1000) + expiresInSeconds }
  const body = base64url(JSON.stringify(payload))
  return `${header}.${body}.${hmacSign(`${header}.${body}`)}`
}

export function verifyBlobAccessToken(token: string): BlobAccessPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, signature] = parts
    const expected = hmacSign(`${header}.${body}`)
    const actualBuffer = Buffer.from(signature, 'base64url')
    const expectedBuffer = Buffer.from(expected, 'base64url')
    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as BlobAccessPayload
    if (header !== base64url(JSON.stringify({ alg: 'HS256', typ: 'BLOB_ACCESS' })) || typeof payload.blobUrl !== 'string' || !payload.blobUrl.startsWith('https://') || !Number.isInteger(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    const [header, body, signature] = parts
    const expectedSig = hmacSign(`${header}.${body}`)

    const sigBuf = Buffer.from(signature, 'base64url')
    const expectedBuf = Buffer.from(expectedSig, 'base64url')
    if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
      return null
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as JWTPayload
    const now = Math.floor(Date.now() / 1000)

    if (payload.exp < now) return null

    return payload
  } catch {
    return null
  }
}

export interface AuthPayload extends JWTPayload {
  userId?: number
  apiKeyId?: number
  storeId?: number | null
}

export interface ApiKeyEncryption {
  ciphertext: string
  iv: string
  tag: string
}

function getApiKeyEncryptionKey(): Buffer {
  const encoded = process.env.API_KEY_ENCRYPTION_KEY
  if (!encoded) throw new Error('API_KEY_ENCRYPTION_KEY environment variable is not set')
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) throw new Error('API_KEY_ENCRYPTION_KEY must be base64-encoded 32 bytes')
  return key
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex')
}

export function encryptApiKey(rawKey: string): ApiKeyEncryption {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', getApiKeyEncryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(rawKey, 'utf8'), cipher.final()])
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') }
}

export function decryptApiKey(encrypted: ApiKeyEncryption): string {
  const decipher = createDecipheriv('aes-256-gcm', getApiKeyEncryptionKey(), Buffer.from(encrypted.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted.ciphertext, 'base64')), decipher.final()]).toString('utf8')
}

export function createApiKey(): { rawKey: string; keyPrefix: string } {
  const keyPrefix = 'awas_live_'
  return { rawKey: `${keyPrefix}${randomBytes(32).toString('base64url')}`, keyPrefix }
}

export const apiKeyExpireStatement = `WITH guard AS (SELECT pg_advisory_xact_lock($1::bigint)) UPDATE api_keys SET revoked_at = NOW() FROM guard WHERE user_id = $1 AND name = $2 AND revoked_at IS NULL AND expires_at <= NOW()`

export const apiKeyCreateStatement = `INSERT INTO api_keys (user_id, name, key_prefix, key_hash, key_ciphertext, key_iv, key_tag, expires_at) SELECT $1, $2, $3, $4, $5, $6, $7, $8 WHERE (SELECT COUNT(*) FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) < 5 AND NOT EXISTS (SELECT 1 FROM api_keys WHERE user_id = $1 AND name = $2 AND revoked_at IS NULL) RETURNING id, name, key_prefix, expires_at, revoked_at, last_used_at, created_at`

export async function authenticateRequest(req: any, allowApiKey = false): Promise<AuthPayload | null> {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7)
  const jwt = verifyToken(token)
  if (jwt) return jwt
  if (!allowApiKey || !token.startsWith('awas_live_')) return null
  const sql = getSQL()
  const rows = await sql`
    SELECT api_keys.id AS api_key_id, users.id AS user_id, users.username, users.role, users.display_name, users.store_id
    FROM api_keys
    JOIN users ON users.id = api_keys.user_id
    WHERE api_keys.key_hash = ${hashApiKey(token)}
      AND api_keys.revoked_at IS NULL
      AND (api_keys.expires_at IS NULL OR api_keys.expires_at > NOW())
      AND users.status = 'active'
    LIMIT 1
  `
  if (!rows.length) return null
  const row = rows[0]
  void sql`UPDATE api_keys SET last_used_at = NOW() WHERE id = ${row.api_key_id}`.catch(() => undefined)
  return { sub: String(row.username), role: String(row.role), name: String(row.display_name), store_id: row.store_id === null ? null : Number(row.store_id), iat: 0, exp: Number.MAX_SAFE_INTEGER, userId: Number(row.user_id), apiKeyId: Number(row.api_key_id), storeId: row.store_id === null ? null : Number(row.store_id) }
}

// ─── Activity Logger ───────────────────────────────────
interface ActivityLogInput {
  action: string
  category: string
  userId?: number
  username?: string
  ipAddress?: string
  userAgent?: string
  details?: Record<string, unknown>
  status?: string
}

export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    const sql = getSQL()
    await sql`
      INSERT INTO activity_logs (action, category, user_id, username, ip_address, user_agent, details, status)
      VALUES (
        ${input.action},
        ${input.category},
        ${input.userId ?? 0},
        ${input.username ?? ''},
        ${input.ipAddress ?? ''},
        ${input.userAgent ?? ''},
        ${JSON.stringify(input.details ?? {})},
        ${input.status ?? 'success'}
      )
    `
  } catch {
    console.error('[activity-logger] Failed to log activity')
  }
}

export function getClientIP(headers: Record<string, string | string[] | undefined>): string {
  const forwarded = headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(',')[0].trim()
  }
  return headers['x-real-ip'] as string || 'unknown'
}

// ─── Blob ──────────────────────────────────────────────
export async function uploadToBlob(
  filename: string,
  buffer: Buffer,
  contentType: string,
): Promise<string> {
  const blob = await put(filename, buffer, {
    access: 'private',
    contentType,
  })
  return blob.url
}

export function getProxyUrl(blobUrl: string): string {
  return `/api/signatures?blobUrl=${encodeURIComponent(blobUrl)}`
}

// ─── Shared SQL / Data Helpers ─────────────────────────
export const SHIFT_ORDER_SQL = `CASE shift WHEN 'OPENING' THEN 1 WHEN 'MIDDLE' THEN 2 WHEN 'CLOSING' THEN 3 WHEN 'MIDNIGHT' THEN 4 END`

export interface GroupedShiftData {
  storeName: string
  grouped: Record<string, Array<Record<string, unknown>>>
}

export async function fetchDayGrouped(date: string): Promise<GroupedShiftData & { raw: Array<Record<string, unknown>> }> {
  const sql = getSQL()
  const rows = await sql`
    SELECT
      shift, store_name, kategori_induk, nama_produk, kode_produk,
      jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan,
      jam_tanggal_pemusnahan, paraf_qc_url, paraf_qc_name,
      paraf_manager_url, paraf_manager_name, dokumentasi_urls,
      submitted_by, created_at
    FROM product_destructions
    WHERE business_date::text = ${date}
    ORDER BY
      CASE shift
        WHEN 'OPENING' THEN 1
        WHEN 'MIDDLE' THEN 2
        WHEN 'CLOSING' THEN 3
        WHEN 'MIDNIGHT' THEN 4
      END,
      created_at ASC
  `

  const grouped: Record<string, Array<Record<string, unknown>>> = {
    OPENING: [], MIDDLE: [], CLOSING: [], MIDNIGHT: [],
  }

  for (const row of rows) {
    const entry: Record<string, unknown> = {
      shift: row.shift,
      store: row.store_name,
      station: row.kategori_induk,
      namaProduk: row.nama_produk,
      kodeProduk: row.kode_produk,
      jumlahProduk: row.jumlah_produk,
      unit: row.unit,
      metodePemusnahan: row.metode_pemusnahan,
      alasanPemusnahan: row.alasan_pemusnahan,
      jamTanggalPemusnahan: row.jam_tanggal_pemusnahan,
      parafQC: row.paraf_qc_url,
      parafQCName: row.paraf_qc_name,
      parafManager: row.paraf_manager_url,
      parafManagerName: row.paraf_manager_name,
      dokumentasi: row.dokumentasi_urls ? row.dokumentasi_urls.split('\n').filter(Boolean) : [],
      submittedBy: row.submitted_by,
    }
    if (row.shift in grouped) {
      grouped[row.shift].push(entry)
    }
  }

  let storeName = 'BEKASI KP. BULU'
  if (rows.length > 0 && rows[0].store_name) {
    storeName = rows[0].store_name
  }

  return { storeName, grouped, raw: rows }
}

// ─── Validators ────────────────────────────────────────
export const STATIONS = ['NOODLE', 'DIMSUM', 'BAR', 'PRODUKSI'] as const
export const SHIFTS = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'] as const

function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function validateItemPayload(body: Record<string, unknown>, partial = false): { success: true; data: Record<string, unknown> } | { success: false; message: string } {
  const businessDate = body.business_date
  const shift = body.shift
  const station = body.kategori_induk
  const product = body.nama_produk
  const quantity = body.jumlah_produk
  const unit = body.unit
  const reason = body.alasan_pemusnahan
  const qc = body.paraf_qc_name
  const manager = body.paraf_manager_name
  if (!partial || businessDate !== undefined) if (!isCalendarDate(businessDate)) return { success: false, message: 'business_date harus kalender valid YYYY-MM-DD.' }
  if (!partial || shift !== undefined) if (!SHIFTS.includes(shift as typeof SHIFTS[number])) return { success: false, message: 'Shift tidak valid.' }
  if (!partial || station !== undefined) if (!STATIONS.includes(station as typeof STATIONS[number])) return { success: false, message: 'Station tidak valid.' }
  if (!partial || product !== undefined) if (typeof product !== 'string' || !product.trim()) return { success: false, message: 'nama_produk wajib diisi.' }
  if (!partial || unit !== undefined) if (typeof unit !== 'string' || !unit.trim()) return { success: false, message: 'unit wajib diisi.' }
  if (!partial || reason !== undefined) if (typeof reason !== 'string' || !reason.trim()) return { success: false, message: 'alasan_pemusnahan wajib diisi.' }
  if (!partial || quantity !== undefined) if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity <= 0) return { success: false, message: 'jumlah_produk harus angka positif.' }
  if (!partial || qc !== undefined) if (typeof qc !== 'string' || !qc.trim()) return { success: false, message: 'paraf_qc_name wajib diisi.' }
  if (!partial || manager !== undefined) if (typeof manager !== 'string' || !manager.trim()) return { success: false, message: 'paraf_manager_name wajib diisi.' }
  return { success: true, data: body }
}

export function validateWasteSubmission(body: Record<string, unknown>): { success: true; data: Record<string, unknown> } | { success: false; message: string } {
  const productList = parseArray(body.productList)
  const jumlahProdukList = parseArray(body.jumlahProdukList)
  const kodeProdukList = parseArray(body.kodeProdukList) || []
  const unitList = parseArray(body.unitList) || []
  const metodePemusnahanList = parseArray(body.metodePemusnahanList) || []
  const alasanPemusnahanList = parseArray(body.alasanPemusnahanList)
  const jamTanggalPemusnahanList = parseArray(body.jamTanggalPemusnahanList) || []
  const dokumentasiUrls = parseArray(body.dokumentasiUrls) || []
  const tanggal = body.tanggal
  const shift = body.shift || 'OPENING'
  const kategoriInduk = body.kategoriInduk
  if (!isCalendarDate(tanggal)) return { success: false, message: 'Tanggal harus kalender valid YYYY-MM-DD.' }
  if (!SHIFTS.includes(shift as typeof SHIFTS[number])) return { success: false, message: 'Shift tidak valid.' }
  if (!STATIONS.includes(kategoriInduk as typeof STATIONS[number])) return { success: false, message: 'Station tidak valid.' }
  if (!productList?.length || !jumlahProdukList?.length || !alasanPemusnahanList?.length) return { success: false, message: 'Produk, jumlah, dan alasan wajib diisi.' }
  const lengths = [productList, jumlahProdukList, kodeProdukList, unitList, metodePemusnahanList, alasanPemusnahanList, jamTanggalPemusnahanList]
  if (lengths.some((list) => list.length !== productList.length)) return { success: false, message: 'Semua daftar item harus sejajar.' }
  if (productList.some((value) => typeof value !== 'string' || !value.trim())) return { success: false, message: 'Nama produk wajib diisi.' }
  if (alasanPemusnahanList.some((value) => typeof value !== 'string' || !value.trim())) return { success: false, message: 'Alasan pemusnahan wajib diisi.' }
  if (jumlahProdukList.some((value) => typeof value !== 'number' || !Number.isFinite(value) || value <= 0)) return { success: false, message: 'Jumlah produk harus angka positif.' }
  if (typeof body.parafQCName !== 'string' || !body.parafQCName.trim() || typeof body.parafManagerName !== 'string' || !body.parafManagerName.trim()) return { success: false, message: 'QC dan Manager wajib diisi.' }
  return { success: true, data: { ...body, tanggal, shift, kategoriInduk, productList, jumlahProdukList, kodeProdukList, unitList, metodePemusnahanList, alasanPemusnahanList, jamTanggalPemusnahanList, dokumentasiUrls } }
}

export const dashboardQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mode: z.string().optional(),
})

export const shiftStatusQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD'),
})

export const getDayDataQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date harus YYYY-MM-DD'),
  shift: z.enum(SHIFTS).optional(),
  station: z.enum(STATIONS).optional(),
})
