import { readFile } from 'node:fs/promises'
import { strict as assert } from 'node:assert'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const docs = await readFile(new URL('../src/pages/api-docs.tsx', import.meta.url), 'utf8')

assert.ok(app.indexOf('path="/docs"') < app.indexOf('if (!isAuthenticated)'), '/docs route must precede auth guard')
for (const id of ['quick-start', 'authentication', 'key-management', 'upload-file', 'submit-batch', 'items', 'get-day-data', 'generate-pdf', 'errors', 'security']) {
  assert.match(docs, new RegExp(`id="${id}"`), `missing #${id}`)
}

console.log('Docs route and sections verified')
