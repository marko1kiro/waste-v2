/**
 * Database Seed Script
 * Usage: npx tsx scripts/seed.ts
 *
 * Requires DATABASE_URL in .env or environment.
 * Creates initial admin user and tenant config.
 */

import { randomBytes, scryptSync } from 'crypto'
import { neon } from '@neondatabase/serverless'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set')
    console.error('Set it in .env or pass it: DATABASE_URL=... npx tsx scripts/seed.ts')
    process.exit(1)
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD
  const storePassword = process.env.SEED_STORE_PASSWORD
  if (!adminPassword || adminPassword.length < 12 || !storePassword || storePassword.length < 12) {
    console.error('ERROR: SEED_ADMIN_PASSWORD and SEED_STORE_PASSWORD must each be at least 12 characters')
    process.exit(1)
  }

  const sql = neon(databaseUrl)

  console.log('Seeding database...\n')

  // 1. Create super admin user
  const adminHash = hashPassword(adminPassword)

  await sql`
    INSERT INTO users (username, password_hash, display_name, role, status)
    VALUES ('admin', ${adminHash}, 'Super Admin', 'super_admin', 'active')
    ON CONFLICT (username) DO NOTHING
  `
  console.log(`[OK] User 'admin' created`)

  // 2. Create store user
  const storeHash = hashPassword(storePassword)

  await sql`
    INSERT INTO users (username, password_hash, display_name, role, status)
    VALUES ('store', ${storeHash}, 'User Store', 'admin_store', 'active')
    ON CONFLICT (username) DO NOTHING
  `
  console.log(`[OK] User 'store' created`)

  // 3. Tenant config
  const existing = await sql`SELECT id FROM tenant_configs LIMIT 1`
  if (existing.length === 0) {
    await sql`INSERT INTO tenant_configs (store_name) VALUES ('BEKASI KP. BULU')`
    console.log(`[OK] Tenant config created (store: BEKASI KP. BULU)`)
  } else {
    console.log(`[SKIP] Tenant config already exists`)
  }

  // 4. Sample personnel (placeholder — replace with real data)
  await sql`
    INSERT INTO personnel (name, full_name, role, signature_url, status)
    VALUES ('QC1', 'QC Contoh 1', 'qc', '', 'active')
    ON CONFLICT DO NOTHING
  `
  await sql`
    INSERT INTO personnel (name, full_name, role, signature_url, status)
    VALUES ('MGR1', 'Manager Contoh 1', 'manager', '', 'active')
    ON CONFLICT DO NOTHING
  `
  console.log(`[OK] Sample personnel created (QC1, MGR1)`)

  console.log('\n--- Seed complete! ---')
  console.log('Initial passwords were read from environment variables and were not printed.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
