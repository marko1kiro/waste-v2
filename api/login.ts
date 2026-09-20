import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { randomBytes, scryptSync } from 'crypto'
import { getSQL, verifyPassword, createToken, logActivity, getClientIP } from '../server/lib.js'

const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
})

// ─── In-memory rate limit (per cold-start instance) ────
const rateLimitCache = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, options: { max: number; windowSeconds: number }) {
  const now = Math.floor(Date.now() / 1000)
  const cached = rateLimitCache.get(key)

  if (!cached || now >= cached.resetAt) {
    rateLimitCache.set(key, { count: 1, resetAt: now + options.windowSeconds })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (cached.count >= options.max) {
    return { allowed: false, retryAfterSeconds: Math.max(0, cached.resetAt - now) }
  }

  cached.count++
  return { allowed: true, retryAfterSeconds: 0 }
}

// ─── Per-username attempt counter + progressive delay (M1) ────
// In-memory per cold-start instance, seperti IP limiter di atas.
// Roadmap: pindahkan ke distributed store (Upstash Redis / Vercel KV).
const userAttemptCache = new Map<string, { count: number; resetAt: number }>()
const USER_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const USER_ATTEMPT_SOFT_LIMIT = 5
const USER_ATTEMPT_HARD_LIMIT = 30
const USER_ATTEMPT_MAX_DELAY_MS = 10_000

function noteFailedUserAttempt(username: string): { delayMs: number; blocked: boolean } {
  const key = username.toLowerCase()
  const now = Date.now()
  const cached = userAttemptCache.get(key)
  if (!cached || now >= cached.resetAt) {
    userAttemptCache.set(key, { count: 1, resetAt: now + USER_ATTEMPT_WINDOW_MS })
    return { delayMs: 0, blocked: false }
  }
  cached.count += 1
  if (cached.count > USER_ATTEMPT_HARD_LIMIT) return { delayMs: 0, blocked: true }
  const extra = cached.count - USER_ATTEMPT_SOFT_LIMIT
  return { delayMs: extra > 0 ? Math.min(extra * 1000, USER_ATTEMPT_MAX_DELAY_MS) : 0, blocked: false }
}

function clearUserAttempts(username: string): void {
  userAttemptCache.delete(username.toLowerCase())
}

function maskTimingWithDummyScrypt(): void {
  // L2: jalankan scrypt dummy agar timing tidak membocorkan keberadaan username
  scryptSync(randomBytes(16), randomBytes(16), 64)
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

async function applyUserThrottle(username: string): Promise<{ blocked: boolean }> {
  const attempt = noteFailedUserAttempt(username)
  if (attempt.blocked) return { blocked: true }
  if (attempt.delayMs > 0) await sleep(attempt.delayMs)
  return { blocked: false }
}

// ─── Handler ───────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ip = getClientIP(req.headers as Record<string, string | string[] | undefined>)
  const rateCheck = checkRateLimit(`login:${ip}`, { max: 5, windowSeconds: 300 })
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: `Terlalu banyak percobaan. Coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
    })
  }

  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message })
  }

  const { username, password } = parsed.data

  try {
    const sql = getSQL()

    const users = await sql`
      SELECT u.id, u.username, u.password_hash, u.display_name, u.role, u.status,
             u.store_id,
             s.code AS store_code, s.name AS store_name,
             s.drive_account, s.features, s.status AS store_status
      FROM users u
      LEFT JOIN stores s ON s.id = u.store_id
      WHERE username = ${username.toLowerCase()}
      LIMIT 1
    `

    if (users.length === 0) {
      maskTimingWithDummyScrypt() // L2: samarkan timing user-tidak-ditemukan
      const throttle = await applyUserThrottle(username) // M1
      if (throttle.blocked) {
        return res.status(429).json({ error: 'Terlalu banyak percobaan untuk username ini. Coba lagi nanti.' })
      }
      await logActivity({
        action: 'login_failed',
        category: 'auth',
        username,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        details: { reason: 'user_not_found' },
        status: 'failed',
      })
      return res.status(401).json({ error: 'Username atau password salah!' })
    }

    const user = users[0]

    if (user.status !== 'active') {
      const throttle = await applyUserThrottle(username) // M1
      if (throttle.blocked) {
        return res.status(429).json({ error: 'Terlalu banyak percobaan untuk username ini. Coba lagi nanti.' })
      }
      return res.status(401).json({ error: 'Akun tidak aktif. Hubungi admin.' })
    }

    const isValid = verifyPassword(password, user.password_hash)
    if (!isValid) {
      const throttle = await applyUserThrottle(username) // M1
      if (throttle.blocked) {
        return res.status(429).json({ error: 'Terlalu banyak percobaan untuk username ini. Coba lagi nanti.' })
      }
      await logActivity({
        action: 'login_failed',
        category: 'auth',
        userId: user.id,
        username: user.username,
        ipAddress: ip,
        userAgent: req.headers['user-agent'] || '',
        details: { reason: 'wrong_password' },
        status: 'failed',
      })
      return res.status(401).json({ error: 'Username atau password salah!' })
    }

    const token = createToken(user.username, user.role, user.display_name, user.store_id === null ? null : Number(user.store_id))
    clearUserAttempts(username) // M1: reset counter per-username saat login sukses

    await logActivity({
      action: 'login_success',
      category: 'auth',
      userId: user.id,
      username: user.username,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || '',
      status: 'success',
    })

    return res.status(200).json({
      success: true,
      token,
      user: {
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        store_id: user.store_id === null ? null : Number(user.store_id),
      },
      store: user.store_id
        ? {
            id: Number(user.store_id),
            code: user.store_code,
            name: user.store_name,
            drive_account: user.drive_account,
            features: user.features,
            status: user.store_status,
          }
        : null,
    })
  } catch (err) {
    console.error('[login] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
