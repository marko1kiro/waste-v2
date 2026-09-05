import { Link } from 'wouter'
import { ClipboardPaste, PenLine } from 'lucide-react'

export default function WasteMode() {
  return (
    <div className="flex flex-col items-center px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold text-text-primary">Pilih Cara Input</h1>
      <p className="mb-8 text-center text-xs text-text-muted">Pilih input manual atau paste format Waste dari WhatsApp.</p>

      <div className="grid w-full max-w-2xl gap-4 md:grid-cols-2">
        <Link
          href="/manual-waste"
          className="block rounded-xl border border-border bg-surface p-5 shadow-theme-xs transition hover:shadow-theme-md"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
              <PenLine size={16} />
            </span>
            Input Manual
          </div>
          <p className="mt-2 text-center text-xs text-text-muted">Isi form item satu per satu seperti biasa.</p>
        </Link>

        <Link
          href="/paste-waste"
          className="block rounded-xl border border-border bg-surface p-5 shadow-theme-xs transition hover:shadow-theme-md"
        >
          <div className="flex items-center justify-center gap-2 text-sm font-semibold text-text-primary">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-500 dark:bg-brand-500/10 dark:text-brand-400">
              <ClipboardPaste size={16} />
            </span>
            Paste Format Waste
          </div>
          <p className="mt-2 text-center text-xs text-text-muted">Paste format WhatsApp, cek hasilnya, lalu lanjut edit dan submit.</p>
        </Link>
      </div>
    </div>
  )
}
