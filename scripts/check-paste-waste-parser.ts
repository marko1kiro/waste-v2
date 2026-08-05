import assert from 'node:assert/strict'
import { parsePasteWaste } from '../src/lib/paste-waste-parser.ts'

const fixture = `*WASTE OPENING*
05-08-2026
QC : PAJAR HIDAYAT
MANAGER : PAK IRFAN
JAM PEMUSNAHAN : 15.04 WIB
METODE : DIBUANG
KODE LOT : TANGGAL PEMUSNAHAN

*NOODLE*
- PANGSIT GORENG :18 PCS - PATAH & KUNCUP

*BAR*
- PEAR :135 GR - SUSUT
- APEL :80 GR - SUSUT
- BELIMBING :50 GR - SUSUT
- STOBERI :30 GR - SUSUT

*PRODUKSI*
- KULIT PANGSIT :1570 GR - LENGKET & SOBEK

*DIMSUM*
- UDANG KEJU :1 PCS - HANDLING
- UDANG RAMBUTAN :4 PCS - HANDLING JATUH
- SIOMAY :1 PCS - HANDLING
- LUMPIA :17 PCS - HANDLING PATAH & VISUAL HITAM/BERCAK/JAMUR`

const parsed = parsePasteWaste(fixture)
assert.deepEqual(parsed.errors, [], `Fixture valid menghasilkan error: ${JSON.stringify(parsed.errors)}`)
assert.equal(new Set(parsed.items.map((item) => item.station)).size, 4)
assert.equal(parsed.items.length, 10)
assert.equal(parsed.businessDate, '2026-08-05')
assert.equal(parsed.shift, 'OPENING')
assert.equal(parsed.destructionTime, '15:04')
assert.equal(parsed.method, 'DIBUANG')
assert.equal(parsed.lotCode, '05082026')
assert.equal(parsed.items.find((item) => item.namaProduk === 'PEAR')?.unit, 'GRAM')

const colonTime = parsePasteWaste(fixture.replace('15.04 WIB', '5:04 WIB'))
assert.equal(colonTime.destructionTime, '05:04')
assert.equal(colonTime.errors.length, 0)

const invalidDate = parsePasteWaste(fixture.replace('05-08-2026', '31-02-2026'))
assert.ok(invalidDate.errors.some((issue) => issue.line === 2 && issue.message.includes('Tanggal')))

const invalidStation = parsePasteWaste(fixture.replace('*NOODLE*', '*KITCHEN*'))
assert.ok(invalidStation.errors.some((issue) => issue.message.includes('Station "KITCHEN"')))

const invalidItem = parsePasteWaste(fixture.replace('18 PCS', '0 KG'))
assert.ok(invalidItem.errors.some((issue) => issue.line === 10 && issue.message.includes('Qty')))
assert.ok(invalidItem.errors.some((issue) => issue.line === 10 && issue.message.includes('Unit')))

const invalidTime = parsePasteWaste(fixture.replace('15.04 WIB', '27:88 WIB'))
assert.ok(invalidTime.errors.some((issue) => issue.line === 5 && issue.message.includes('JAM PEMUSNAHAN')))

console.log('check-paste-waste-parser: PASS')
