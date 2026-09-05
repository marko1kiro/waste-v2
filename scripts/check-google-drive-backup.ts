import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { escapeGoogleDriveQueryLiteral, GoogleDriveBackupError } from '../server/google-drive.js'

assert.equal(escapeGoogleDriveQueryLiteral("BA Waste O'BRIEN.pdf"), "BA Waste O\\'BRIEN.pdf")
assert.equal(escapeGoogleDriveQueryLiteral('path\\file.pdf'), 'path\\\\file.pdf')
const configurationError = new GoogleDriveBackupError('missing secret', 'configuration')
assert.equal(configurationError.kind, 'configuration')
assert.equal(configurationError.name, 'GoogleDriveBackupError')

const source = await readFile(new URL('../api/generate-pdf.ts', import.meta.url), 'utf8')
assert.ok(source.includes("FROM daily_records"), 'MIDNIGHT completion must come from daily_records')
assert.ok(source.includes("shift = 'MIDNIGHT'"), 'MIDNIGHT must be the completion gate')
assert.ok(source.includes('findGoogleDrivePdf(filename)'), 'completed dates must search for the canonical Drive filename')
assert.ok(source.includes('uploadGoogleDrivePdf(filename'), 'a missing completed-date PDF must be uploaded')
assert.ok(source.includes('streamGoogleDrivePdf'), 'existing Drive PDFs must be streamed through the backend')
assert.ok(source.includes('if (midnightComplete)'), 'Drive calls must be conditional on completion')

console.log('google-drive backup checks passed')
