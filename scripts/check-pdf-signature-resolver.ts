import assert from 'node:assert/strict'
import { resolveSignature, normalizeSignatureName } from '../shared/pdf-signature-resolver.js'
import { signatureCellLayout, containedSignatureSize } from '../shared/pdf-renderer.js'

const people = [
  { id: 1, name: 'LUISA RIKE FERNANDA', full_name: 'LUISA RIKE FERNANDA', signature_url: 'luisa' },
  { id: 2, name: 'HIDAYATULLAH', full_name: 'HIDAYATULLAH', signature_url: 'hidayatullah' },
  { id: 3, name: 'PAK IMBRON', full_name: 'PAK IMBRON', signature_url: 'imbron' },
]

assert.equal(normalizeSignatureName('  Bu   Susanti  '), 'BU SUSANTI')
assert.equal(normalizeSignatureName('Pak  Imbron'), 'PAK IMBRON')
assert.equal(resolveSignature('LUISA RIKE FERNANDA', people).kind, 'exact')
assert.equal(resolveSignature('LUISA RIKE', people).kind, 'prefix')
assert.equal(resolveSignature('HIDAYAT', people).kind, 'fallback')
assert.equal(resolveSignature('PAK IMBRON', people).kind, 'exact')
assert.equal(resolveSignature('LUISA', [...people, { id: 4, name: 'LUISA MAYA', full_name: 'LUISA MAYA', signature_url: 'maya' }]).kind, 'fallback')
const layout = signatureCellLayout(0)
assert.equal(layout.minHeight, 18)
assert.ok(layout.nameY > layout.imageTop + layout.imageHeight)
assert.deepEqual(containedSignatureSize(200, 100, 20, 9), { width: 18, height: 9 })
console.log('PDF signature resolver checks passed')
