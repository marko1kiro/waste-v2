/**
 * Check: neutral drive config resolver (TDD RED/GREEN)
 * Usage: npx tsx scripts/check-neutral-drive.ts
 */
import assert from 'node:assert/strict'

const { resolveNeutralDriveConfig } = await import('../server/google-drive-neutral.ts')

// Missing env -> configuration error
delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY
assert.throws(
  () => resolveNeutralDriveConfig({ folderId: 'abc123' }, process.env),
  (err: unknown) => err instanceof Error && err.message.includes('GOOGLE_SERVICE_ACCOUNT_KEY'),
  'missing env must throw configuration error naming the variable',
)

// Invalid JSON -> configuration error
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = 'not-json'
assert.throws(
  () => resolveNeutralDriveConfig({ folderId: 'abc123' }, process.env),
  (err: unknown) => err instanceof Error && err.message.includes('not valid JSON'),
  'invalid JSON must throw configuration error',
)

// JSON missing required fields -> configuration error
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({ type: 'service_account', client_email: 'sa@test.iam' })
assert.throws(
  () => resolveNeutralDriveConfig({ folderId: 'abc123' }, process.env),
  (err: unknown) => err instanceof Error && err.message.includes('private_key'),
  'JSON missing private_key must throw configuration error',
)

// Valid SA key + folder -> full config
const fakeKey = JSON.stringify({ client_email: 'sa@test.iam', private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n' })
process.env.GOOGLE_SERVICE_ACCOUNT_KEY = fakeKey
const config = resolveNeutralDriveConfig({ folderId: 'folderXYZ' }, process.env)
assert.equal(config.serviceAccountKey.client_email, 'sa@test.iam')
assert.equal(config.folderId, 'folderXYZ')

// Missing folder -> configuration error
assert.throws(
  () => resolveNeutralDriveConfig({ folderId: '' }, process.env),
  (err: unknown) => err instanceof Error && err.message.includes('folder'),
  'missing folder id must throw configuration error',
)

console.log('check-neutral-drive: PASS')
