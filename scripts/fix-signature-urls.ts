import { neon } from '@neondatabase/serverless'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is not set')
  process.exit(1)
}

const sql = neon(databaseUrl)

async function main() {
  const rows = await sql`SELECT id, signature_url FROM personnel WHERE signature_url LIKE 'http://localhost%'`

  console.log(`Found ${rows.length} signature(s) with localhost URLs`)

  for (const row of rows) {
    const relativeUrl = row.signature_url.replace(/^https?:\/\/[^/]+/, '')
    console.log(`  Updating id=${row.id}: ${row.signature_url} -> ${relativeUrl}`)

    await sql`UPDATE personnel SET signature_url = ${relativeUrl} WHERE id = ${row.id}`
  }

  console.log('Done.')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})
