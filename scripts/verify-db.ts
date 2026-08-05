/**
 * Verify database schema and seed data
 * Usage: DATABASE_URL=... npx tsx scripts/verify-db.ts
 */

import { neon } from '@neondatabase/serverless'

async function verify() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL is not set')
    process.exit(1)
  }

  const sql = neon(databaseUrl)

  console.log('Verifying AWAS v4 database...\n')

  // Check tables exist
  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `
  console.log('Tables found:')
  for (const t of tables) {
    console.log(`  - ${t.table_name}`)
  }

  // Check users
  console.log('\nUsers:')
  const users = await sql`SELECT id, username, display_name, role, status FROM users ORDER BY id`
  for (const u of users) {
    console.log(`  [${u.id}] ${u.username} (${u.display_name}) — role: ${u.role}, status: ${u.status}`)
  }

  // Check personnel
  console.log('\nPersonnel:')
  const personnel = await sql`SELECT id, name, full_name, role, status FROM personnel ORDER BY id`
  for (const p of personnel) {
    console.log(`  [${p.id}] ${p.name} (${p.full_name}) — role: ${p.role}`)
  }

  // Check tenant config
  console.log('\nTenant Config:')
  const configs = await sql`SELECT id, store_name FROM tenant_configs`
  for (const c of configs) {
    console.log(`  [${c.id}] store: ${c.store_name}`)
  }

  console.log('\n--- Verification complete! ---')
}

verify().catch((err) => {
  console.error('Verify failed:', err)
  process.exit(1)
})
