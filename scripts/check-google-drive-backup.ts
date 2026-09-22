import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { escapeNeutralDriveQueryLiteral, GoogleDriveNeutralError } from '../server/google-drive-neutral.js'

assert.equal(escapeNeutralDriveQueryLiteral("BA Waste O'BRIEN.pdf"), "BA Waste O\\'BRIEN.pdf")
assert.equal(escapeNeutralDriveQueryLiteral('path\\file.pdf'), 'path\\\\file.pdf')
const configurationError = new GoogleDriveNeutralError('missing secret', 'configuration')
assert.equal(configurationError.kind, 'configuration')
assert.equal(configurationError.name, 'GoogleDriveNeutralError')

const source = await readFile(new URL('../api/generate-pdf.ts', import.meta.url), 'utf8')
assert.ok(source.includes("FROM daily_records"), 'MIDNIGHT completion must come from daily_records')
assert.ok(source.includes("shift = 'MIDNIGHT'"), 'MIDNIGHT must be the completion gate')
assert.ok(source.includes('findNeutralDrivePdf(filename,'), 'completed dates must search for the canonical Drive filename')
assert.ok(source.includes('uploadNeutralDrivePdf(filename,'), 'a missing completed-date PDF must be uploaded')
assert.ok(source.includes('streamGoogleDrivePdf'), 'existing Drive PDFs must be streamed through the backend')
assert.ok(source.includes('if (midnightComplete)'), 'Drive calls must be conditional on completion')
assert.ok(!source.includes('../server/google-drive.js'), 'legacy OAuth Drive module must not be used anymore')

console.log('google-drive backup checks passed')
