import { useState, type ReactNode } from 'react'
import { Link } from 'wouter'
import { Check, Copy, Menu, X } from 'lucide-react'

const baseUrl = 'https://www.gacoanku.my.id'

const sections = [
  ['quick-start', 'Quick start'], ['authentication', 'Authentication'], ['key-management', 'API key management'], ['upload-file', 'Upload file'], ['submit-batch', 'Submit waste batch'], ['items', 'Items CRUD'], ['get-day-data', 'Get day data'], ['generate-pdf', 'Generate PDF'], ['errors', 'Statuses & errors'], ['security', 'Security checklist'],
] as const

function CodeBlock({ children, label = 'Code example' }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(children)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return <div className="relative my-5 overflow-hidden border-[3px] border-black bg-[#171717] shadow-[5px_5px_0_#000]">
    <div className="flex items-center justify-between border-b-[3px] border-black bg-[#f4d83b] px-3 py-2 text-xs font-black text-black"><span>{label}</span><button type="button" onClick={copy} className="flex items-center gap-1 border-2 border-black bg-white px-2 py-1 font-black focus:outline-none focus:ring-2 focus:ring-purple-700" aria-label={`Copy ${label}`}>{copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copied' : 'Copy'}</button></div>
    <pre className="overflow-x-auto p-4 text-sm leading-6 text-white"><code>{children}</code></pre>
  </div>
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} className="scroll-mt-6 border-t-[3px] border-black py-10 first:border-t-0"><h2 className="mb-4 inline-block border-[3px] border-black bg-[#b995f7] px-3 py-1 text-2xl font-black text-black shadow-[4px_4px_0_#000]">{title}</h2>{children}</section>
}

export default function ApiDocs() {
  const [open, setOpen] = useState(false)
  const navigation = <ol className="space-y-1">{sections.map(([id, title]) => <li key={id}><a href={`#${id}`} onClick={() => setOpen(false)} className="block border-2 border-transparent px-2 py-1 font-bold text-black hover:border-black hover:bg-[#f4d83b] focus:outline-none focus:ring-2 focus:ring-purple-700">{title}</a></li>)}</ol>
  return <div className="min-h-dvh bg-[#fffdf3] text-black"><header className="border-b-[3px] border-black bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6"><Link href="/" className="border-[3px] border-black bg-[#f4d83b] px-3 py-2 font-black shadow-[3px_3px_0_#000] focus:outline-none focus:ring-2 focus:ring-purple-700">AWAS API</Link><Link href="/" className="border-[3px] border-black bg-white px-3 py-2 text-sm font-black shadow-[3px_3px_0_#000] focus:outline-none focus:ring-2 focus:ring-purple-700">Login / Home</Link></div></header>
    <div className="mx-auto grid max-w-7xl lg:grid-cols-[245px_minmax(0,1fr)]"><aside className="hidden border-r-[3px] border-black bg-[#f7f0ff] p-6 lg:block"><nav className="sticky top-6" aria-label="Documentation table of contents"><p className="mb-3 font-black">ON THIS PAGE</p>{navigation}</nav></aside><main className="min-w-0 px-4 py-8 sm:px-8 sm:py-12"><div className="mb-8 border-[3px] border-black bg-white p-5 shadow-[7px_7px_0_#000] sm:p-8"><p className="mb-2 font-black uppercase tracking-widest text-purple-800">Public developer documentation</p><h1 className="text-4xl font-black leading-none sm:text-6xl">Waste integration API</h1><p className="mt-5 max-w-2xl text-lg font-bold">Create API keys with JWT, upload evidence, submit waste batches, manage items, retrieve daily data, generate PDFs.</p></div><div className="mb-6 lg:hidden"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between border-[3px] border-black bg-[#b995f7] p-3 font-black shadow-[4px_4px_0_#000]"><span>Navigate documentation</span>{open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}</button>{open && <nav className="mt-2 border-[3px] border-black bg-white p-3" aria-label="Documentation table of contents">{navigation}</nav>}</div>
    <Section id="quick-start" title="Quick start"><p>Production base URL: <code className="font-black">{baseUrl}</code>. JSON is used throughout; dates use <code>YYYY-MM-DD</code>.</p><CodeBlock label="Upload, then submit">{`export WASTE_API_KEY='awas_live_...'
curl -X POST '${baseUrl}/api/upload-file' \\
  -H "Authorization: Bearer $WASTE_API_KEY" \\
  -H 'Content-Type: application/json' \\
  -d '{"filename":"waste.jpg","contentType":"image/jpeg","base64":"..."}'`}</CodeBlock></Section>
    <Section id="authentication" title="Authentication"><p>Send credentials in the Bearer header. JWT is required for login, profile, API-key management, admin, dashboard, history, tenant configuration, personnel, and station-items. API keys authorize waste operations, including PDF generation.</p><CodeBlock>{`Authorization: Bearer <JWT_OR_awas_live_API_KEY>`}</CodeBlock><p className="font-bold">API-key scope: <code>upload-file</code>, <code>submit-waste</code>, Items CRUD, <code>get-day-data</code>, <code>generate-pdf</code>.</p><p className="mt-3">Keys expire after 7, 30, or 90 days, or never. Maximum five active keys per user. Revoked, expired, malformed, or inactive-owner keys fail immediately.</p></Section>
    <Section id="key-management" title="API key management"><p>Key management is JWT-only. Create keys in Profile → API Keys; raw keys appear only at generation or after password-verified reveal. Store them in an integration secret manager.</p><CodeBlock>{`curl -X POST '${baseUrl}/api/admin/api-keys' \\
  -H 'Authorization: Bearer <JWT>' -H 'Content-Type: application/json' \\
  -d '{"name":"inventory-sync","expiry":"30"}'

curl -X DELETE '${baseUrl}/api/admin/api-keys?id=12' \\
  -H 'Authorization: Bearer <JWT>'`}</CodeBlock><p><code>expiry</code>: <code>7</code>, <code>30</code>, <code>90</code>, <code>never</code>. List with <code>GET /api/admin/api-keys</code>. Reveal with <code>POST ?operation=reveal</code> plus <code>{'{"id":12,"password":"..."}'}</code>.</p></Section>
    <Section id="upload-file" title="Upload file first"><p>Upload images/documents before submission. Use returned <code>proxyUrl</code> in <code>dokumentasiUrls</code>; never submit the private blob URL.</p><CodeBlock>{`POST /api/upload-file
{"filename":"waste.jpg","contentType":"image/jpeg","base64":"raw Base64 or Data URL","folder":"waste-docs"}

200: {"success":true,"blobUrl":"https://...","proxyUrl":"/api/signatures?blobUrl=..."}`}</CodeBlock></Section>
    <Section id="submit-batch" title="Submit waste batch"><p>A batch is one <code>tanggal + shift + kategoriInduk</code>; duplicates return <code>409</code>. Array fields must have equal lengths. Allowed categories: <code>NOODLE</code>, <code>DIMSUM</code>, <code>BAR</code>, <code>PRODUKSI</code>. Shifts: <code>OPENING</code>, <code>MIDDLE</code>, <code>CLOSING</code>, <code>MIDNIGHT</code>.</p><CodeBlock>{`POST /api/submit-waste
{"tanggal":"2026-07-28","kategoriInduk":"NOODLE","shift":"OPENING","productList":["MIE GACOAN LEVEL 1"],"jumlahProdukList":[1],"kodeProdukList":[""],"unitList":["PCS"],"metodePemusnahanList":["DIBUANG"],"alasanPemusnahanList":["EXPIRED"],"jamTanggalPemusnahanList":["08:00"],"parafQCName":"QC Name","parafManagerName":"Manager Name","dokumentasiUrls":["/api/signatures?blobUrl=..."]}`}</CodeBlock><p><code>productList</code>, <code>jumlahProdukList</code>, <code>kodeProdukList</code>, <code>unitList</code>, <code>metodePemusnahanList</code>, <code>alasanPemusnahanList</code>, and <code>jamTanggalPemusnahanList</code> are required. Quantities must be finite and greater than zero. QC and manager names cannot be empty.</p></Section>
    <Section id="items" title="Items CRUD"><CodeBlock>{`GET /api/items?date=2026-07-28&shift=OPENING&station=NOODLE
POST /api/items
{"business_date":"2026-07-28","shift":"OPENING","kategori_induk":"NOODLE","nama_produk":"MIE","jumlah_produk":1,"unit":"PCS","alasan_pemusnahan":"EXPIRED","paraf_qc_name":"QC Name","paraf_manager_name":"Manager Name"}
PUT /api/items?id=42
{"jumlah_produk":2,"alasan_pemusnahan":"RUSAK"}
DELETE /api/items?id=42`}</CodeBlock><p><code>date</code> is required for listing; <code>shift</code> and <code>station</code> are optional. PUT preserves omitted values, then validates the merged item.</p></Section>
    <Section id="get-day-data" title="Get day data"><CodeBlock>{`GET /api/get-day-data?date=2026-07-28&shift=OPENING&station=NOODLE`}</CodeBlock><p>With date only, results are grouped by shift. Add shift and station to determine whether input already exists before retrying a submission.</p></Section>
    <Section id="generate-pdf" title="Generate PDF"><p>Accepts JWT <strong>or API key</strong>. Any valid calendar date can generate a PDF, including dates without data. Before the date's <code>MIDNIGHT</code> record is done, generation remains on-demand and does not contact Google Drive. Once MIDNIGHT is done, the backend serves the canonical Google Drive backup or uploads it before responding. Response is PDF bytes, not JSON.</p><CodeBlock>{`curl '${baseUrl}/api/generate-pdf?date=2026-07-28' \\
  -H 'Authorization: Bearer <API_KEY_OR_JWT>' \\
  --output 'BA Waste STORE - 28072026.pdf'`}</CodeBlock><p>Required private image assets unavailable: <code>502 Required PDF image asset unavailable</code>; partial PDFs are not returned. For a completed MIDNIGHT date, a required Drive backup that cannot be created returns <code>503</code> rather than an unbacked PDF. PDF signed image links last 10 minutes; regenerate after expiry.</p></Section>
    <Section id="errors" title="Statuses & errors"><p>Errors normally return <code>{'{"error":"safe message"}'}</code>.</p><ul className="list-disc space-y-2 pl-5"><li><code>400</code> invalid payload, query, date, shift, station, or field</li><li><code>401</code> missing, expired, revoked, malformed, or inactive-owner credential</li><li><code>403</code> insufficient access or failed reveal password</li><li><code>404</code> resource or item absent</li><li><code>405</code> method unsupported</li><li><code>409</code> duplicate batch/key name or five-key active limit</li><li><code>500</code> server error; back off, check existing data before retrying</li></ul></Section>
    <Section id="security" title="Security checklist"><ol className="list-decimal space-y-2 pl-5 font-bold"><li>Keep raw keys in environment-backed secret storage.</li><li>Use HTTPS and the Authorization header only.</li><li>Never expose keys in URLs, source code, repositories, screenshots, logs, or localStorage.</li><li>Upload first; submit the returned proxy URL only.</li><li>On 401, rotate or replace the key. On 409, read existing data before retrying.</li><li>Revoke unused keys. Do not log Authorization headers.</li></ol></Section>
    </main></div></div>
}
