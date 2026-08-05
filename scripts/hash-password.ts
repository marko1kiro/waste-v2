/**
 * Hash Password Utility
 * Usage: npx tsx scripts/hash-password.ts <password>
 *
 * Outputs the scrypt hash in "salt:hash" format
 * for inserting into the users table.
 */

import { randomBytes, scryptSync } from 'crypto'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const password = process.argv[2]

if (!password) {
  console.error('Usage: npx tsx scripts/hash-password.ts <password>')
  process.exit(1)
}

const hashed = hashPassword(password)
console.log(`\nPassword: ${password}`)
console.log(`Hash:     ${hashed}\n`)
console.log('SQL Insert:')
console.log(`INSERT INTO users (username, password_hash, display_name, role, status)`)
console.log(`VALUES ('admin', '${hashed}', 'Super Admin', 'super_admin', 'active');`)
