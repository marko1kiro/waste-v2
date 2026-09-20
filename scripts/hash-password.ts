/**
 * Hash Password Utility
 *
 * Password TIDAK PERNAH dibaca dari process.argv (muncul di history shell
 * dan process list). Pilih salah satu:
 *   1. Env var:  HASH_PASSWORD="rahasia" npx tsx scripts/hash-password.ts
 *   2. TTY prompt tersembunyi (tanpa echo):
 *                npx tsx scripts/hash-password.ts
 *   3. Piped stdin (tidak di-echo): 
 *                printf '%s' "rahasia" | npx tsx scripts/hash-password.ts
 *
 * Outputs the scrypt hash in "salt:hash" format
 * for inserting into the users table.
 */

import { randomBytes, scryptSync } from 'crypto'
import { openSync, readSync, closeSync } from 'fs'
import { execFileSync } from 'child_process'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

/** Baca password dari TTY dengan echo dimatikan (tanpa menampilkan karakter). */
function readPasswordHiddenTTY(promptText: string): string {
  process.stdout.write(promptText)
  let echoDisabled = false
  try {
    execFileSync('stty', ['-echo'], { stdio: ['inherit', 'ignore', 'ignore'] })
    echoDisabled = true
  } catch {
    // Bukan POSIX / stty tidak tersedia -> fallback baca biasa (bisa terlihat)
  }
  let line = ''
  try {
    const fd = openSync('/dev/tty', 'r')
    const buf = Buffer.alloc(1024)
    for (;;) {
      const n = readSync(fd, buf, 0, buf.length, null)
      if (n <= 0) break
      const chunk = buf.subarray(0, n).toString('utf8')
      const nl = chunk.indexOf('\n')
      if (nl >= 0) {
        line += chunk.slice(0, nl)
        break
      }
      line += chunk
    }
    closeSync(fd)
  } finally {
    if (echoDisabled) {
      try {
        execFileSync('stty', ['echo'], { stdio: ['inherit', 'ignore', 'ignore'] })
      } catch {
        /* abaikan */
      }
    }
    process.stdout.write('\n')
  }
  return line.replace(/\r$/, '')
}

/** Baca seluruh stdin tanpa echo (mode piped). */
function readPasswordStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk: string) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data.replace(/[\r\n]+$/, '')))
    process.stdin.on('error', reject)
  })
}

async function resolvePassword(): Promise<string> {
  if (process.env.HASH_PASSWORD) {
    return process.env.HASH_PASSWORD
  }
  if (process.stdin.isTTY) {
    const password = readPasswordHiddenTTY('Password (input tersembunyi): ')
    if (!password) {
      console.error('Password kosong, batal.')
      process.exit(1)
    }
    return password
  }
  if (!process.stdin.isTTY) {
    // stdin di-pipe: tidak ada echo karena bukan terminal interaktif
    const password = await readPasswordStdin()
    if (!password) {
      console.error('Password kosong, batal.')
      process.exit(1)
    }
    return password
  }
  throw new Error('Tidak bisa membaca password')
}

const password = await resolvePassword()
const hashed = hashPassword(password)
// Password TIDAK PERNAH dicetak — hanya hash yang ditampilkan.
console.log(`Hash: ${hashed}\n`)
console.log('SQL Insert:')
console.log(`INSERT INTO users (username, password_hash, display_name, role, status)`)
console.log(`VALUES ('admin', '${hashed}', 'Super Admin', 'super_admin', 'active');`)
