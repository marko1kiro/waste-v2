import 'dotenv/config'
import { getSQL } from '../api/lib.js'
import { resolveSignature, type SignaturePersonnel } from '../shared/pdf-signature-resolver.js'

const sql = getSQL()
const rows = await sql`
  SELECT paraf_qc_url, paraf_qc_name, paraf_manager_url, paraf_manager_name
  FROM product_destructions
  WHERE business_date BETWEEN '2026-07-20' AND '2026-08-02'
`
const people = await sql`SELECT id, name, full_name, signature_url FROM personnel WHERE status = 'active'`
const missing: string[] = []
for (const row of rows) {
  if (!row.paraf_qc_url && row.paraf_qc_name) missing.push(String(row.paraf_qc_name))
  if (!row.paraf_manager_url && row.paraf_manager_name) missing.push(String(row.paraf_manager_name))
}
const grouped = Object.groupBy(missing, (name) => name)
const stats = { exact: [] as string[], prefix: [] as string[], fallback: [] as string[] }
for (const name of missing) stats[resolveSignature(name, people as SignaturePersonnel[]).kind].push(name)
const counts = (names: string[]) => Object.fromEntries(Object.entries(Object.groupBy(names, (name) => name)).map(([name, values]) => [name, values.length]))
console.log(JSON.stringify({ missing: missing.length, names: counts(missing), exact: counts(stats.exact), prefix: counts(stats.prefix), fallback: counts(stats.fallback) }, null, 2))
