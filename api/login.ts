import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { getSQL, verifyPassword, createToken, logActivity, getClientIP } from './lib.js'

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
      SELECT id, username, password_hash, display_name, role, status
      FROM users
      WHERE username = ${username.toLowerCase()}
      LIMIT 1
    `

    if (users.length === 0) {
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
      return res.status(401).json({ error: 'Akun tidak aktif. Hubungi admin.' })
    }

    const isValid = verifyPassword(password, user.password_hash)
    if (!isValid) {
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

    const token = createToken(user.username, user.role, user.display_name)

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
      },
    })
  } catch (err) {
    console.error('[login] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
