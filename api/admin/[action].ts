import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { del } from '@vercel/blob'
import { apiKeyCreateStatement, apiKeyExpireStatement, createApiKey, decryptApiKey, encryptApiKey, getSQL, authenticateRequest, hashApiKey, hashPassword, logActivity, getClientIP, verifyPassword, resolveStoreContext, getRequestedStoreId, type ResolvedStore } from '../../server/lib.js'

// ─── Schemas ───────────────────────────────────────────
const createPersonnelSchema = z.object({
  name: z.string().trim().min(2, 'Short name minimal 2 karakter').max(24, 'Short name maksimal 24 karakter'),
  full_name: z.string().trim().min(3, 'Full name minimal 3 karakter').max(100, 'Full name maksimal 100 karakter'),
  role: z.enum(['qc', 'manager']),
  signature_url: z.string().optional().default(''),
})

const updatePersonnelSchema = z.object({
  id: z.number().int().positive('ID tidak valid'),
  name: z.string().trim().min(2).max(24),
  full_name: z.string().trim().min(3).max(100),
  role: z.enum(['qc', 'manager']),
  signature_url: z.string().optional().default(''),
  status: z.enum(['active', 'inactive']).optional().default('active'),
})

const createUserSchema = z.object({
  username: z.string().trim().min(3, 'Username minimal 3 karakter').max(40, 'Username maksimal 40 karakter'),
  password: z.string().min(6, 'Password minimal 6 karakter').max(128, 'Password maksimal 128 karakter'),
  display_name: z.string().trim().min(3, 'Nama display minimal 3 karakter').max(100, 'Nama display maksimal 100 karakter'),
  role: z.enum(['admin_store', 'super_admin']).default('admin_store'),
})

const updateUserSchema = z.object({
  id: z.number().int().positive('ID tidak valid'),
  username: z.string().trim().min(3).max(40),
  display_name: z.string().trim().min(3).max(100),
  role: z.enum(['admin_store', 'super_admin']),
  status: z.enum(['active', 'inactive']).default('active'),
  password: z.string().min(6).max(128).optional(),
})

const updateConfigSchema = z.object({
  store_name: z.string().trim().min(2, 'Nama store minimal 2 karakter').max(100),
  store_code: z.string().trim().min(2, 'Kode store minimal 2 karakter').max(20),
  qc_checklist_url: z.string().trim().max(500).optional().default(''),
})

// ─── Handlers ──────────────────────────────────────────

async function handlePersonnel(req: VercelRequest, res: VercelResponse, payload: any, store: ResolvedStore) {
  if (payload.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })
  if (store.storeId === null) return res.status(400).json({ error: 'store_id wajib untuk personnel' })
  const sql = getSQL()

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, name, full_name, role, signature_url, status
      FROM personnel
      WHERE store_id = ${store.storeId} AND status = 'active'
      ORDER BY role, name
    `
    return res.status(200).json({ success: true, data: rows })
  }

  if (req.method === 'POST') {
    const parsed = createPersonnelSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { name, full_name, role, signature_url } = parsed.data

    const existing = await sql`SELECT id FROM personnel WHERE store_id = ${store.storeId} AND name = ${name.toUpperCase()} AND status = 'active' LIMIT 1`
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Short name sudah dipakai oleh personnel aktif.' })
    }

    const rows = await sql`
      INSERT INTO personnel (store_id, name, full_name, role, signature_url, status)
      VALUES (${store.storeId}, ${name.toUpperCase()}, ${full_name}, ${role}, ${signature_url}, 'active')
      RETURNING id, name, full_name, role, signature_url, status
    `
    return res.status(201).json({ success: true, data: rows[0], message: 'Personnel berhasil dibuat.' })
  }

  if (req.method === 'PUT') {
    const parsed = updatePersonnelSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { id, name, full_name, role, signature_url, status } = parsed.data

    const duplicate = await sql`SELECT id FROM personnel WHERE store_id = ${store.storeId} AND name = ${name.toUpperCase()} AND id <> ${id} AND status = 'active' LIMIT 1`
    if (duplicate.length > 0) {
      return res.status(409).json({ error: 'Short name sudah dipakai oleh personnel aktif lain.' })
    }

    const rows = await sql`
      UPDATE personnel
      SET
        name = ${name.toUpperCase()},
        full_name = ${full_name},
        role = ${role},
        signature_url = ${signature_url},
        status = ${status}
      WHERE id = ${id} AND store_id = ${store.storeId}
      RETURNING id, name, full_name, role, signature_url, status
    ` 
    if (!rows.length) return res.status(404).json({ error: 'Personnel tidak ditemukan.' })
    return res.status(200).json({ success: true, data: rows[0], message: 'Personnel berhasil diupdate.' })
  }

  if (req.method === 'DELETE') {
    const id = Number((req.query as Record<string, string | undefined>).id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id wajib valid' })
    const rows = await sql`
      UPDATE personnel
      SET status = 'inactive'
      WHERE id = ${id} AND store_id = ${store.storeId} AND status <> 'inactive'
      RETURNING id
    `
    if (!rows.length) return res.status(404).json({ error: 'Personnel tidak ditemukan.' })
    return res.status(200).json({ success: true, message: 'Personnel dihapus.' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleUsers(req: VercelRequest, res: VercelResponse, payload: any, store: ResolvedStore) {
  if (payload.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })
  const sql = getSQL()

  if (req.method === 'GET') {
    const rows = store.storeId === null
      ? await sql`
          SELECT u.id, u.username, u.display_name, u.role, u.status, u.created_at, u.store_id, s.code AS store_code, s.name AS store_name
          FROM users u
          LEFT JOIN stores s ON s.id = u.store_id
          ORDER BY u.role DESC, u.username ASC
        `
      : await sql`
          SELECT u.id, u.username, u.display_name, u.role, u.status, u.created_at, u.store_id, s.code AS store_code, s.name AS store_name
          FROM users u
          LEFT JOIN stores s ON s.id = u.store_id
          WHERE u.store_id = ${store.storeId}
          ORDER BY u.role DESC, u.username ASC
        `
    return res.status(200).json({ success: true, data: rows })
  }

  if (req.method === 'POST') {
    const parsed = createUserSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { username, password, display_name, role } = parsed.data
    const storeId = req.body?.store_id

    if (role === 'admin_store') {
      if (!Number.isInteger(storeId) || (storeId as number) <= 0) {
        return res.status(400).json({ error: 'store_id wajib untuk admin_store.' })
      }
      const storeExists = await sql`SELECT id FROM stores WHERE id = ${storeId} LIMIT 1`
      if (!storeExists.length) return res.status(400).json({ error: 'Store tidak ditemukan.' })
    }

    const exists = await sql`SELECT id FROM users WHERE username = ${username.toLowerCase()} LIMIT 1`
    if (exists.length > 0) return res.status(409).json({ error: 'Username sudah dipakai.' })

    const password_hash = hashPassword(password)
    const rows = await sql`
      INSERT INTO users (username, password_hash, display_name, role, status, store_id)
      VALUES (${username.toLowerCase()}, ${password_hash}, ${display_name}, ${role}, 'active', ${role === 'admin_store' ? storeId : null})
      RETURNING id, username, display_name, role, status, created_at
    `
    return res.status(201).json({ success: true, data: rows[0], message: 'Akun store berhasil dibuat.' })
  }

  if (req.method === 'PUT') {
    const parsed = updateUserSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { id, username, display_name, role, status, password } = parsed.data

    const duplicate = await sql`SELECT id FROM users WHERE username = ${username.toLowerCase()} AND id <> ${id} LIMIT 1`
    if (duplicate.length > 0) return res.status(409).json({ error: 'Username sudah dipakai user lain.' })

    const currentRows = await sql`SELECT id, username, role, status FROM users WHERE id = ${id} LIMIT 1`
    if (!currentRows.length) return res.status(404).json({ error: 'User tidak ditemukan.' })
    const current = currentRows[0]

    if (current.username === payload.sub && status === 'inactive') {
      return res.status(400).json({ error: 'Tidak bisa menonaktifkan akun sendiri.' })
    }

    if (current.role === 'super_admin' && (role !== 'super_admin' || status !== 'active')) {
      const activeAdmins = await sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'super_admin' AND status = 'active'`
      const count = Number(activeAdmins[0]?.count || 0)
      if (count <= 1) {
        return res.status(400).json({ error: 'Tidak bisa mengubah super_admin aktif terakhir.' })
      }
    }

    const password_hash = password ? hashPassword(password) : null
    const rows = await sql`
      UPDATE users
      SET
        username = ${username.toLowerCase()},
        display_name = ${display_name},
        role = ${role},
        status = ${status},
        password_hash = COALESCE(${password_hash}, password_hash)
      WHERE id = ${id}
      RETURNING id, username, display_name, role, status, created_at
    `
    return res.status(200).json({ success: true, data: rows[0], message: 'Akun berhasil diupdate.' })
  }

  if (req.method === 'DELETE') {
    const id = Number((req.query as Record<string, string | undefined>).id)
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'id wajib valid' })

    const currentRows = await sql`SELECT id, username, role FROM users WHERE id = ${id} LIMIT 1`
    if (!currentRows.length) return res.status(404).json({ error: 'User tidak ditemukan.' })
    const current = currentRows[0]

    if (current.username === payload.sub) {
      return res.status(400).json({ error: 'Tidak bisa menghapus akun sendiri.' })
    }

    if (current.role === 'super_admin') {
      const activeAdmins = await sql`SELECT COUNT(*)::int AS count FROM users WHERE role = 'super_admin' AND status = 'active'`
      const count = Number(activeAdmins[0]?.count || 0)
      if (count <= 1) {
        return res.status(400).json({ error: 'Tidak bisa menghapus super_admin aktif terakhir.' })
      }
    }

    await sql`UPDATE users SET status = 'inactive' WHERE id = ${id}`
    return res.status(200).json({ success: true, message: 'Akun dihapus.' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleStationItems(req: VercelRequest, res: VercelResponse, payload: any, store: ResolvedStore) {
  if (payload.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })
  if (store.storeId === null) return res.status(400).json({ error: 'store_id wajib untuk station-items' })
  const sql = getSQL()

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order, status
      FROM station_items
      WHERE store_id = ${store.storeId}
      ORDER BY station, sort_order, nama_produk
    `
    return res.status(200).json({ success: true, data: rows })
  }

  if (req.method === 'POST') {
    const { station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order } = req.body
    if (!station || !nama_produk) return res.status(400).json({ error: 'station dan nama_produk wajib diisi' })
    const rows = await sql`
      INSERT INTO station_items (store_id, station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order, status)
      VALUES (${store.storeId}, ${String(station).toUpperCase()}, ${String(nama_produk).toUpperCase()}, ${unit || 'PCS'}, ${Boolean(kode_lot_wajib)}, ${Boolean(is_manual)}, ${sort_order || 0}, 'active')
      RETURNING id, station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order, status
    `
    return res.status(201).json({ success: true, data: rows[0] })
  }

  if (req.method === 'PUT') {
    const { id, station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order, status } = req.body
    if (!id) return res.status(400).json({ error: 'id wajib diisi' })
    const rows = await sql`
      UPDATE station_items
      SET
        station = COALESCE(${station ? String(station).toUpperCase() : null}, station),
        nama_produk = COALESCE(${nama_produk ? String(nama_produk).toUpperCase() : null}, nama_produk),
        unit = COALESCE(${unit ?? null}, unit),
        kode_lot_wajib = COALESCE(${kode_lot_wajib ?? null}, kode_lot_wajib),
        is_manual = COALESCE(${is_manual ?? null}, is_manual),
        sort_order = COALESCE(${sort_order ?? null}, sort_order),
        status = COALESCE(${status ?? null}, status)
      WHERE id = ${id} AND store_id = ${store.storeId}
      RETURNING id, station, nama_produk, unit, kode_lot_wajib, is_manual, sort_order, status
    `
    if (!rows.length) return res.status(404).json({ error: 'Item not found' })
    return res.status(200).json({ success: true, data: rows[0] })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query as Record<string, string | undefined>
    if (!id) return res.status(400).json({ error: 'id wajib diisi' })
    await sql`UPDATE station_items SET status = 'inactive' WHERE id = ${parseInt(id, 10)} AND store_id = ${store.storeId}`
    return res.status(200).json({ success: true })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleTenantConfig(req: VercelRequest, res: VercelResponse, payload: any, store: ResolvedStore) {
  if (store.storeId === null) return res.status(400).json({ error: 'store_id wajib untuk tenant-config' })
  const sql = getSQL()

  if (req.method === 'GET') {
    const rows = await sql`SELECT id, store_name, extra_config, updated_at FROM tenant_configs WHERE store_id = ${store.storeId} LIMIT 1`
    if (rows.length === 0) {
      return res.status(200).json({ success: true, data: { store_name: '', store_code: '', qc_checklist_url: '' } })
    }
    const row = rows[0]
    const extra = (row.extra_config as Record<string, unknown>) || {}
    return res.status(200).json({
      success: true,
      data: {
        store_name: row.store_name || '',
        store_code: (extra.store_code as string) || '',
        qc_checklist_url: (extra.qc_checklist_url as string) || '',
      },
    })
  }

  if (req.method === 'PUT') {
    if (payload.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })

    const parsed = updateConfigSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })

    const { store_name, store_code, qc_checklist_url } = parsed.data

    const existing = await sql`SELECT id FROM tenant_configs WHERE store_id = ${store.storeId} LIMIT 1`
    if (existing.length === 0) {
      await sql`INSERT INTO tenant_configs (store_id, store_name, extra_config) VALUES (${store.storeId}, ${store_name}, ${JSON.stringify({ store_code, qc_checklist_url })})`
    } else {
      await sql`UPDATE tenant_configs SET store_name = ${store_name}, extra_config = ${JSON.stringify({ store_code, qc_checklist_url })}, updated_at = NOW() WHERE id = ${existing[0].id}`
    }

    return res.status(200).json({ success: true, message: 'Konfigurasi store berhasil diupdate.' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── Stores Handler (Kelola Resto) ────────────────────

const createStoreSchema = z.object({
  code: z.string().trim().min(3, 'Kode store minimal 3 karakter').max(20, 'Kode store maksimal 20 karakter').regex(/^[A-Z0-9]+$/, 'Kode store huruf kapital/angka'),
  name: z.string().trim().min(3, 'Nama store minimal 3 karakter').max(100, 'Nama store maksimal 100 karakter'),
  drive_account: z.enum(['legacy', 'neutral']).default('neutral'),
  drive_folder_id: z.string().trim().max(200).optional().default(''),
  manual_mode: z.boolean().default(false),
  catalog: z.boolean().default(false),
})

const updateStoreSchema = z.object({
  id: z.number().int().positive('ID tidak valid'),
  name: z.string().trim().min(3).max(100),
  drive_folder_id: z.string().trim().max(200).optional().default(''),
  manual_mode: z.boolean().default(false),
  catalog: z.boolean().default(false),
  status: z.enum(['active', 'inactive']).default('active'),
})

async function handleStores(req: VercelRequest, res: VercelResponse, payload: any) {
  if (payload.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })
  const sql = getSQL()

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT s.id, s.code, s.name, s.drive_account, s.drive_folder_id, s.features, s.status, s.created_at,
        (SELECT COUNT(*)::int FROM users u WHERE u.store_id = s.id) AS user_count,
        (SELECT COUNT(*)::int FROM product_destructions pd WHERE pd.store_id = s.id) AS total_entries
      FROM stores s
      ORDER BY s.id ASC
    `
    return res.status(200).json({ success: true, data: rows })
  }

  if (req.method === 'POST') {
    const parsed = createStoreSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { code, name, drive_account, drive_folder_id, manual_mode, catalog } = parsed.data

    const exists = await sql`SELECT id FROM stores WHERE code = ${code} LIMIT 1`
    if (exists.length > 0) return res.status(409).json({ error: 'Kode store sudah dipakai.' })

    const rows = await sql`
      INSERT INTO stores (code, name, drive_account, drive_folder_id, features, status)
      VALUES (${code}, ${name}, ${drive_account}, ${drive_folder_id}, ${JSON.stringify({ manual_mode, catalog })}, 'active')
      RETURNING id, code, name, drive_account, drive_folder_id, features, status, created_at
    `
    await logActivity({ action: 'store_created', category: 'admin', username: payload.sub, details: { code, name }, status: 'success' })
    return res.status(201).json({ success: true, data: rows[0], message: 'Resto berhasil dibuat.' })
  }

  if (req.method === 'PUT') {
    const parsed = updateStoreSchema.safeParse(req.body)
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message })
    const { id, name, drive_folder_id, manual_mode, catalog, status } = parsed.data

    const rows = await sql`
      UPDATE stores
      SET
        name = ${name},
        drive_folder_id = ${drive_folder_id},
        features = ${JSON.stringify({ manual_mode, catalog })}::jsonb,
        status = ${status}
      WHERE id = ${id}
      RETURNING id, code, name, drive_account, drive_folder_id, features, status, created_at
    `
    if (!rows.length) return res.status(404).json({ error: 'Resto tidak ditemukan.' })
    await logActivity({ action: 'store_updated', category: 'admin', username: payload.sub, details: { id, name, status }, status: 'success' })
    return res.status(200).json({ success: true, data: rows[0], message: 'Resto berhasil diupdate.' })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

async function handleApiKeys(req: VercelRequest, res: VercelResponse, payload: any) {
  const sql = getSQL()
  const users = await sql`SELECT id, password_hash FROM users WHERE username = ${payload.sub} AND status = 'active' LIMIT 1`
  if (!users.length) return res.status(401).json({ error: 'Unauthorized' })
  const user = users[0]
  if (req.method === 'GET') {
    const rows = await sql`
      SELECT id, name, key_prefix, expires_at, revoked_at, last_used_at, created_at
      FROM api_keys WHERE user_id = ${user.id} ORDER BY created_at DESC
    `
    return res.status(200).json({ success: true, data: rows.map((row) => ({ ...row, key_masked: `${row.key_prefix}••••••••` })) })
  }
  if (req.method === 'POST' && req.query.operation === 'reveal') {
    const id = Number(req.body?.id)
    const password = String(req.body?.password || '')
    if (!Number.isInteger(id) || !password || !verifyPassword(password, String(user.password_hash))) return res.status(403).json({ error: 'Password tidak valid.' })
    const rows = await sql`SELECT key_ciphertext, key_iv, key_tag, revoked_at, expires_at FROM api_keys WHERE id = ${id} AND user_id = ${user.id} LIMIT 1`
    if (!rows.length) return res.status(404).json({ error: 'API key tidak ditemukan.' })
    const key = rows[0]
    if (key.revoked_at || (key.expires_at && new Date(String(key.expires_at)) <= new Date())) return res.status(400).json({ error: 'API key tidak aktif.' })
    return res.status(200).json({ success: true, rawKey: decryptApiKey({ ciphertext: String(key.key_ciphertext), iv: String(key.key_iv), tag: String(key.key_tag) }) })
  }
  if (req.method === 'POST') {
    const name = String(req.body?.name || '').trim()
    const expiry = String(req.body?.expiry || 'never')
    const days = expiry === '7' ? 7 : expiry === '30' ? 30 : expiry === '90' ? 90 : expiry === 'never' ? null : undefined
    if (!name || name.length > 100 || days === undefined) return res.status(400).json({ error: 'Nama atau masa berlaku API key tidak valid.' })
    const created = createApiKey()
    const encrypted = encryptApiKey(created.rawKey)
    const expiresAt = days === null ? null : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    try {
      const transaction = await sql.transaction((tx) => [
        tx(apiKeyExpireStatement, [user.id, name]),
        tx(apiKeyCreateStatement, [user.id, name, created.keyPrefix, hashApiKey(created.rawKey), encrypted.ciphertext, encrypted.iv, encrypted.tag, expiresAt]),
      ])
      const rows = transaction[1]
      if (!rows.length) return res.status(409).json({ error: 'Maksimal 5 API key aktif atau nama sudah dipakai.' })
      return res.status(201).json({ success: true, data: { ...rows[0], key_masked: `${created.keyPrefix}••••••••` }, rawKey: created.rawKey })
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === '23505') return res.status(409).json({ error: 'Nama API key aktif sudah dipakai.' })
      throw err
    }
  }
  if (req.method === 'DELETE') {
    const id = Number(req.query.id)
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'id wajib valid' })
    const rows = await sql`UPDATE api_keys SET revoked_at = NOW() WHERE id = ${id} AND user_id = ${user.id} AND revoked_at IS NULL RETURNING id`
    if (!rows.length) return res.status(404).json({ error: 'API key tidak ditemukan atau sudah dicabut.' })
    return res.status(200).json({ success: true })
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── History Handler ───────────────────────────────────

async function handleHistory(req: VercelRequest, res: VercelResponse, payload: any, store: ResolvedStore) {
  if (payload.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })
  if (store.storeId === null) return res.status(400).json({ error: 'store_id wajib untuk history' })
  const sql = getSQL()

  if (req.method === 'GET') {
    const { date } = req.query as Record<string, string | undefined>
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Format date harus YYYY-MM-DD' })
    }

    const records = await sql`
      SELECT shift, COUNT(*)::int AS item_count, MIN(submitted_by) AS submitted_by, MIN(created_at) AS created_at,
        array_agg(DISTINCT kategori_induk) AS stations
      FROM product_destructions
      WHERE business_date::text = ${date} AND store_id = ${store.storeId}
      GROUP BY shift
      ORDER BY
        CASE shift
          WHEN 'OPENING' THEN 1
          WHEN 'MIDDLE' THEN 2
          WHEN 'CLOSING' THEN 3
          WHEN 'MIDNIGHT' THEN 4
        END
    `

    return res.status(200).json({ success: true, data: records })
  }

  if (req.method === 'PUT') {
    const { date, from, to } = req.query as Record<string, string | undefined>
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Format date harus YYYY-MM-DD' })
    }
    const validShifts = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT']
    if (!from || !to || !validShifts.includes(from) || !validShifts.includes(to)) {
      return res.status(400).json({ error: 'Shift from/to harus OPENING, MIDDLE, CLOSING, atau MIDNIGHT' })
    }
    if (from === to) {
      return res.status(400).json({ error: 'Shift asal dan tujuan ga boleh sama' })
    }

    const moved = await sql(`WITH guard AS (SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2 || ':' || $3 || ':' || $5))), source AS (SELECT station FROM waste_submission_locks, guard WHERE business_date = $1::date AND shift = $2 AND store_id = $5), conflict AS (SELECT 1 FROM product_destructions WHERE business_date = $1::date AND shift = $3 AND store_id = $5 LIMIT 1), moved_locks AS (UPDATE waste_submission_locks SET shift = $3 WHERE business_date = $1::date AND shift = $2 AND store_id = $5 AND NOT EXISTS (SELECT 1 FROM conflict) RETURNING station), moved_products AS (UPDATE product_destructions SET shift = $3 WHERE business_date = $1::date AND shift = $2 AND store_id = $5 AND EXISTS (SELECT 1 FROM moved_locks) RETURNING id), reset_daily AS (UPDATE daily_records SET done = FALSE WHERE business_date = $1::date AND shift = $2 AND store_id = $5 AND EXISTS (SELECT 1 FROM moved_locks) RETURNING id), set_daily AS (INSERT INTO daily_records (store_id, business_date, shift, done, submitted_by, submitted_at) SELECT $5, $1::date, $3, TRUE, $4, NOW() WHERE EXISTS (SELECT 1 FROM moved_locks) ON CONFLICT (store_id, business_date, shift) DO UPDATE SET done = TRUE, submitted_by = EXCLUDED.submitted_by, submitted_at = NOW() RETURNING id) SELECT (SELECT COUNT(*)::int FROM moved_products) AS count, EXISTS (SELECT 1 FROM conflict) AS conflict`, [date, from, to, payload.sub, store.storeId])
    if (moved[0].conflict) return res.status(409).json({ error: `Shift ${to} tanggal ${date} udah ada datanya. Hapus dulu kalo mau ganti.` })
    const updated = [{ count: moved[0].count }]

    const ip = getClientIP(req.headers as Record<string, string | string[] | undefined>)
    await logActivity({
      action: 'change_shift',
      category: 'admin',
      username: payload.sub,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || '',
      details: { date, from, to, rowsAffected: updated.length },
      status: 'success',
    })

    return res.status(200).json({ success: true, message: `Data shift ${from} berhasil dipindah ke ${to}.` })
  }

  if (req.method === 'DELETE') {
    const { date, shift } = req.query as Record<string, string | undefined>
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Format date harus YYYY-MM-DD' })
    }
    if (!shift) {
      return res.status(400).json({ error: 'Shift wajib diisi' })
    }

    const rows = await sql`
      SELECT dokumentasi_urls, kategori_induk FROM product_destructions
      WHERE business_date::text = ${date} AND shift = ${shift} AND store_id = ${store.storeId}
    `

    const blobUrls: string[] = []
    for (const row of rows) {
      if (!row.dokumentasi_urls) continue
      const urls = String(row.dokumentasi_urls).split('\n').filter(Boolean)
      for (const url of urls) {
        const match = url.match(/[?&]blobUrl=([^&]+)/)
        if (match) {
          blobUrls.push(decodeURIComponent(match[1]))
        }
      }
    }

    const uniqueBlobUrls = [...new Set(blobUrls)]
    if (uniqueBlobUrls.length > 0) {
      try {
        await del(uniqueBlobUrls)
      } catch (err) {
        console.error('[history] Blob delete error:', err)
      }
    }

    await sql`DELETE FROM product_destructions WHERE business_date::text = ${date} AND shift = ${shift} AND store_id = ${store.storeId}`
    await sql`DELETE FROM waste_submission_locks WHERE business_date::text = ${date} AND shift = ${shift} AND store_id = ${store.storeId}`
    await sql`DELETE FROM daily_records WHERE business_date::text = ${date} AND shift = ${shift} AND store_id = ${store.storeId}`

    const ip = getClientIP(req.headers as Record<string, string | string[] | undefined>)
    await logActivity({
      action: 'delete_shift',
      category: 'admin',
      username: payload.sub,
      ipAddress: ip,
      userAgent: req.headers['user-agent'] || '',
      details: { date, shift, blobsDeleted: uniqueBlobUrls.length, rowsAffected: rows.length },
      status: 'success',
    })

    return res.status(200).json({ success: true, message: `Data shift ${shift} tanggal ${date} berhasil dihapus.`, blobsDeleted: uniqueBlobUrls.length })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ─── Stats Handler (admin overview) ────────────────────

async function handleStats(req: VercelRequest, res: VercelResponse, payload: any) {
  if (payload.role !== 'super_admin') return res.status(403).json({ error: 'Forbidden' })
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const sql = getSQL()

  const rows = await sql`
    SELECT
      s.id, s.code, s.name, s.status, s.drive_account, s.features,
      (SELECT COUNT(*)::int FROM users u WHERE u.store_id = s.id AND u.status = 'active') AS user_count,
      (SELECT COUNT(*)::int FROM personnel p WHERE p.store_id = s.id AND p.status = 'active') AS personnel_count,
      (SELECT COUNT(*)::int FROM station_items si WHERE si.store_id = s.id AND si.status = 'active') AS item_count,
      (SELECT COUNT(*)::int FROM product_destructions pd WHERE pd.store_id = s.id AND pd.business_date >= CURRENT_DATE - INTERVAL '30 days') AS entries_30d,
      (SELECT MAX(business_date)::text FROM product_destructions pd WHERE pd.store_id = s.id) AS last_entry_date
    FROM stores s
    WHERE s.status = 'active'
    ORDER BY s.id ASC
  `

  const totals = {
    restos: rows.length,
    users: rows.reduce((sum: number, r: any) => sum + (r.user_count || 0), 0),
    personnel: rows.reduce((sum: number, r: any) => sum + (r.personnel_count || 0), 0),
    items: rows.reduce((sum: number, r: any) => sum + (r.item_count || 0), 0),
    entries_30d: rows.reduce((sum: number, r: any) => sum + (r.entries_30d || 0), 0),
  }

  return res.status(200).json({ success: true, restos: rows, totals })
}

// ─── Main Route Router ─────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = await authenticateRequest(req)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  let store: ResolvedStore
  try {
    store = resolveStoreContext({ role: payload.role, storeId: payload.storeId ?? null }, getRequestedStoreId(req))
  } catch {
    return res.status(403).json({ error: 'Store context missing' })
  }

  const { action } = req.query as { action: string }

  try {
    switch (action) {
      case 'personnel':
        return await handlePersonnel(req, res, payload, store)
      case 'users':
        return await handleUsers(req, res, payload, store)
      case 'station-items':
        return await handleStationItems(req, res, payload, store)
      case 'tenant-config':
        return await handleTenantConfig(req, res, payload, store)
      case 'stores':
        return await handleStores(req, res, payload)
      case 'stats':
        return await handleStats(req, res, payload)
      case 'history':
        return await handleHistory(req, res, payload, store)
      case 'api-keys':
        return await handleApiKeys(req, res, payload)
      default:
        return res.status(404).json({ error: 'Not found' })
    }
  } catch (err) {
    console.error(`[admin-${action}] Error:`, err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
