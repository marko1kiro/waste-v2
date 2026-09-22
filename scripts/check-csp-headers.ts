import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vercelJson = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as {
  headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }>
}

const csp = vercelJson.headers
  ?.find((h) => h.source === '/(.*)')
  ?.headers.find((h) => h.key === 'Content-Security-Policy')?.value
assert.ok(csp, 'vercel.json harus punya header Content-Security-Policy untuk /(.*)')

const directives = Object.fromEntries(
  csp!
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => {
      const [name, ...rest] = d.split(/\s+/)
      return [name, rest]
    }),
)

// Invarian: preview foto (multi-file-upload) dan gambar terautentikasi
// (authenticated-image) dirender via URL.createObjectURL() -> skema blob:.
// Kalau img-src tidak mengizinkan blob:, browser menolak thumbnail dengan
// "Refused to load the image 'blob:...' ..." dan preview rusak diam-diam.
const imgSrc = directives['img-src'] ?? []
for (const token of ["'self'", 'data:', 'https:', 'blob:']) {
  assert.ok(imgSrc.includes(token), `img-src harus memuat ${token} (preview blob: butuh blob:)`)
}

// Guard: hardening dari audit jangan sampai kehapus saat edit CSP.
assert.deepEqual(directives['default-src'], ["'self'"], 'default-src harus tetap self')
assert.deepEqual(directives['object-src'], ["'none'"], 'object-src harus tetap none')
assert.deepEqual(directives['frame-ancestors'], ["'self'"], 'frame-ancestors harus tetap self')
assert.ok(!(directives['img-src'] ?? []).includes('*'), 'img-src tidak boleh wildcard *')

// Cross-check: kode yang me-render <img src={blob:...}> harus tetap dicover CSP.
const uploadSrc = readFileSync(join(root, 'src/components/ui/multi-file-upload.tsx'), 'utf8')
const authImgSrc = readFileSync(join(root, 'src/components/ui/authenticated-image.tsx'), 'utf8')
assert.ok(uploadSrc.includes('URL.createObjectURL'), 'multi-file-upload memakai createObjectURL')
assert.ok(authImgSrc.includes('URL.createObjectURL'), 'authenticated-image memakai createObjectURL')

console.log('check-csp-headers: PASS')
