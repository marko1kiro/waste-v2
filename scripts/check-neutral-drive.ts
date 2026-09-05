/**
 * Check: neutral drive config resolver (TDD RED/GREEN)
 * Usage: npx tsx scripts/check-neutral-drive.ts
 */
import assert from 'node:assert/strict'

const { resolveNeutralDriveConfig } = await import('../server/google-drive-neutral.ts')

// Missing env -> configuration error
delete process.env.GOOGLE_DRIVE_NEUTRAL_CLIENT_ID
delete process.env.GOOGLE_DRIVE_NEUTRAL_CLIENT_SECRET
delete process.env.GOOGLE_DRIVE_NEUTRAL_REFRESH_TOKEN
assert.throws(
  () => resolveNeutralDriveConfig({ folderId: 'abc123' }, process.env),
  (err: unknown) => err instanceof Error && err.message.includes('GOOGLE_DRIVE_NEUTRAL_CLIENT_ID'),
  'missing env must throw configuration error naming the variable',
)

// Env present + folder -> full config
process.env.GOOGLE_DRIVE_NEUTRAL_CLIENT_ID = 'neutral-client'
process.env.GOOGLE_DRIVE_NEUTRAL_CLIENT_SECRET = 'neutral-secret'
process.env.GOOGLE_DRIVE_NEUTRAL_REFRESH_TOKEN = 'neutral-refresh'
const config = resolveNeutralDriveConfig({ folderId: 'folderXYZ' }, process.env)
assert.equal(config.clientId, 'neutral-client')
assert.equal(config.clientSecret, 'neutral-secret')
assert.equal(config.refreshToken, 'neutral-refresh')
assert.equal(config.folderId, 'folderXYZ')

// Missing folder -> configuration error
assert.throws(
  () => resolveNeutralDriveConfig({ folderId: '' }, process.env),
  (err: unknown) => err instanceof Error && err.message.includes('folder'),
  'missing folder id must throw configuration error',
)

console.log('check-neutral-drive: PASS')
