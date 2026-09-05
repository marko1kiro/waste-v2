import type { VercelRequest, VercelResponse } from '@vercel/node'
import { get } from '@vercel/blob'
import { getSQL, authenticateRequest, verifyBlobAccessToken, resolveStoreContext, getRequestedStoreId } from '../server/lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { role, name: queryName, blobUrl, token } = req.query as Record<string, string | undefined>

  if (blobUrl) {
    const signed = token ? verifyBlobAccessToken(token) : null
    const authorizedBlobUrl = signed?.blobUrl === blobUrl
    if (!authorizedBlobUrl) {
      const payload = await authenticateRequest(req, true)
      if (!payload) return res.status(401).json({ error: 'Unauthorized' })
    }

    try {
      const sql = getSQL()
      const proxyUrl = `/api/signatures?blobUrl=${encodeURIComponent(blobUrl)}`
      const references = await sql`
        SELECT 1
        WHERE EXISTS (SELECT 1 FROM personnel WHERE signature_url IN (${blobUrl}, ${proxyUrl}))
           OR EXISTS (
              SELECT 1 FROM product_destructions
              WHERE paraf_qc_url IN (${blobUrl}, ${proxyUrl})
                 OR paraf_manager_url IN (${blobUrl}, ${proxyUrl})
                 OR ${blobUrl} = ANY(string_to_array(COALESCE(dokumentasi_urls, ''), E'\\n'))
                 OR ${proxyUrl} = ANY(string_to_array(COALESCE(dokumentasi_urls, ''), E'\\n'))
            )
        LIMIT 1
      `
      if (!references.length) return res.status(404).json({ error: 'File not found' })

      const result = await get(blobUrl, { access: 'private' })
      if (!result || result.statusCode !== 200 || !result.stream) {
        return res.status(404).json({ error: 'File not found' })
      }
      const contentType = result.blob.contentType?.split(';', 1)[0].toLowerCase()
      if (!contentType || (!contentType.startsWith('image/') && contentType !== 'application/pdf')) {
        return res.status(415).json({ error: 'Unsupported file type' })
      }
      const response = new Response(result.stream)
      const arrayBuffer = await response.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'private, max-age=60')
      return res.status(200).send(buffer)
    } catch (err) {
      console.error('[signatures] Blob error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  // List signatures — butuh auth
  const payload = await authenticateRequest(req)
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let storeId: number | null
  try {
    const resolved = resolveStoreContext({ role: payload.role, storeId: payload.storeId ?? null }, getRequestedStoreId(req))
    storeId = resolved.storeId
  } catch {
    return res.status(403).json({ error: 'Store context missing' })
  }
  if (storeId === null) return res.status(400).json({ error: 'store_id wajib' })

  try {
    const sql = getSQL()

    let query
    if (role && queryName) {
      query = sql`
        SELECT name, full_name, role, signature_url
        FROM personnel
        WHERE store_id = ${storeId} AND role = ${role} AND name = ${queryName} AND status = 'active'
        ORDER BY name
      `
    } else if (role) {
      query = sql`
        SELECT name, full_name, role, signature_url
        FROM personnel
        WHERE store_id = ${storeId} AND role = ${role} AND status = 'active'
        ORDER BY name
      `
    } else {
      query = sql`
        SELECT name, full_name, role, signature_url
        FROM personnel
        WHERE store_id = ${storeId} AND status = 'active'
        ORDER BY role, name
      `
    }

    const rows = await query

    return res.status(200).json({
      success: true,
      data: rows.map((r: any) => ({
        name: r.name,
        full_name: r.full_name,
        role: r.role,
        signature_url: r.signature_url,
      })),
    })
  } catch (err) {
    console.error('[signatures] Error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
