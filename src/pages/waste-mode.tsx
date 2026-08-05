import { Link } from 'wouter'
import { ClipboardPaste, PenLine } from 'lucide-react'

export default function WasteMode() {
  return (
    <div className="flex flex-col items-center px-4 py-6">
      <h1 className="mb-1 text-xl font-black text-primary">Pilih Cara Input</h1>
      <p className="mb-8 text-center text-xs font-bold text-warning">Pilih input manual atau paste format Waste dari WhatsApp.</p>

      <div className="grid w-full max-w-2xl gap-4 md:grid-cols-2">
        <Link
          href="/manual-waste"
          className="block rounded-xl border-2 border-[#000] bg-warning p-5 shadow-nb-md transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-lg"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-black text-black">
            <PenLine size={16} />
            INPUT MANUAL
          </div>
          <p className="mt-2 text-center text-xs font-bold text-black/70">Isi form item satu per satu seperti biasa.</p>
        </Link>

        <Link
          href="/paste-waste"
          className="block rounded-xl border-2 border-primary/50 bg-primary/10 p-5 shadow-nb-md transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-lg"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-black text-primary">
            <ClipboardPaste size={16} />
            PASTE FORMAT WASTE
          </div>
          <p className="mt-2 text-center text-xs font-bold text-text-muted">Paste format WhatsApp, cek hasilnya, lalu lanjut edit dan submit.</p>
        </Link>
      </div>
    </div>
  )
}
