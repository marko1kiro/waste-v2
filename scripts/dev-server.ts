/**
 * Local API dev server for AWAS v4
 * Emulates Vercel Serverless Functions locally
 * Usage: npx tsx scripts/dev-server.ts
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { parse as parseUrl } from 'url'
import { resolve } from 'path'
import { config } from 'dotenv'

// Load .env
config({ path: resolve(import.meta.dirname, '..', '.env') })

const PORT = 1213

// Dynamic import handler based on route
async function loadHandler(route: string) {
  const handlerMap: Record<string, string> = {
    '/api/login': '../api/login.ts',
    '/api/submit-waste': '../api/submit-waste.ts',
    '/api/dashboard-data': '../api/dashboard-data.ts',
    '/api/get-day-data': '../api/get-day-data.ts',
    '/api/shift-status': '../api/shift-status.ts',
    '/api/signatures': '../api/signatures.ts',
    '/api/generate-pdf': '../api/generate-pdf.ts',
    '/api/station-items': '../api/station-items.ts',
    '/api/admin-personnel': '../api/admin-personnel.ts',
    '/api/admin-station-items': '../api/admin-station-items.ts',
    '/api/admin-users': '../api/admin-users.ts',
    '/api/upload-file': '../api/upload-file.ts',
    '/api/tenant-config': '../api/tenant-config.ts',
    '/api/list-blob-pdfs': '../api/list-blob-pdfs.ts',
  }

  const handlerPath = handlerMap[route]
    || (route === '/api/items' ? '../api/items.ts' : null)
    || (route.startsWith('/api/admin/') ? '../api/admin/[action].ts' : null)
    || (route === '/api/get' ? '../api/get.ts' : null)
  if (!handlerPath) return null

  const mod = await import(handlerPath)
  return mod.default
}

// Convert Node.js req to VercelRequest-like object
function parseBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
  })
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const parsed = parseUrl(req.url || '/', true)
  const pathname = parsed.pathname || '/'

  const handler = await loadHandler(pathname)
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  // Build VercelRequest-like object
  const rawBody = await parseBody(req)
  let body = null
  const contentType = req.headers['content-type'] || ''
  if (contentType.includes('application/json') && rawBody) {
    try { body = JSON.parse(rawBody) } catch { body = rawBody }
  } else {
    body = rawBody
  }

  const vercelReq = {
    method: req.method,
    headers: req.headers,
    query: parsed.query,
    body,
    url: req.url,
  }

  // Build VercelResponse-like object
  let statusCode = 200
  const responseHeaders: Record<string, string> = {}

  const vercelRes = {
    status(code: number) {
      statusCode = code
      return vercelRes
    },
    setHeader(key: string, value: string) {
      responseHeaders[key] = value
      return vercelRes
    },
    json(data: unknown) {
      responseHeaders['Content-Type'] = 'application/json'
      for (const [k, v] of Object.entries(responseHeaders)) {
        res.setHeader(k, v)
      }
      res.writeHead(statusCode)
      res.end(JSON.stringify(data))
    },
    send(data: Buffer | string) {
      for (const [k, v] of Object.entries(responseHeaders)) {
        res.setHeader(k, v)
      }
      res.writeHead(statusCode)
      res.end(data)
    },
  }

  try {
    await handler(vercelReq, vercelRes)
  } catch (err) {
    console.error(`[${pathname}] Error:`, err)
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal server error' }))
  }
})

server.listen(PORT, () => {
  console.log(`\n  AWAS v4 API Server`)
  console.log(`  Running at http://localhost:${PORT}`)
  console.log(`  Press Ctrl+C to stop\n`)
})
