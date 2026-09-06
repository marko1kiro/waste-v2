import { Link } from 'wouter'
import { ClipboardPaste, FileDown, CheckCircle2, ArrowRight, Lightbulb, AlertTriangle } from 'lucide-react'

export default function Tutorial() {
  return (
    <div className="mx-auto max-w-3xl py-2">
      <div className="mb-6 rounded-2xl border border-border bg-surface p-5 shadow-theme-sm">
        <h1 className="mb-1 text-xl font-semibold text-text-primary">Tutorial Penggunaan AWAS</h1>
        <p className="text-xs leading-relaxed text-text-muted">Panduan lengkap untuk crew baru. Ikuti langkah-langkah di bawah ini dari awal sampai selesai.</p>
      </div>

      {/* Step 1 */}
      <Step number={1} title="Login ke Aplikasi">
        <p>Buka aplikasi AWAS di HP atau laptop. Masukkan <strong>username</strong> dan <strong>password</strong> yang diberikan oleh atasanmu, lalu tekan <strong>Masuk</strong>.</p>
        <Tip>Simpan username & password di tempat aman. Jangan bagikan ke orang lain.</Tip>
      </Step>

      {/* Step 2 */}
      <Step number={2} title="Pilih Menu Paste Format Waste">
        <p>Setelah login, kamu akan melihat halaman utama. Tekan tombol <strong>Paste Format Waste</strong>.</p>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
          <ClipboardPaste size={14} />
          <span>Paste Format Waste — ini menu utama kamu setiap hari.</span>
        </div>
      </Step>

      {/* Step 3 */}
      <Step number={3} title="Copy Pesan dari WhatsApp">
        <p>Buka chat WhatsApp yang berisi format laporan waste. <strong>Copy (salin)</strong> seluruh pesan format waste tersebut.</p>
        <Tip>Pastikan kamu copy dari pesan yang benar. Jangan edit isinya — biarkan apa adanya.</Tip>
      </Step>

      {/* Step 4 */}
      <Step number={4} title="Paste ke Aplikasi">
        <p>Kembali ke aplikasi AWAS. <strong>Paste</strong> (tempel) pesan yang sudah kamu copy ke kolom yang tersedia.</p>
        <p className="mt-2">Periksa hasil parse-nya:</p>
        <ul className="mt-1 list-inside list-disc space-y-1 text-xs text-text-muted">
          <li>Nama produk sudah sesuai?</li>
          <li>Jumlah sudah benar?</li>
          <li>Unit sudah cocok (PCS, KG, dll)?</li>
        </ul>
        <p className="mt-2">Kalau ada yang salah, kamu bisa <strong>edit langsung</strong> di halaman berikutnya sebelum submit.</p>
      </Step>

      {/* Step 5 */}
      <Step number={5} title="Periksa & Submit">
        <p>Setelah di-paste, kamu akan melihat daftar item waste yang sudah terisi otomatis. Periksa sekali lagi, lalu tekan tombol <strong>Submit</strong>.</p>
        <div className="mt-2 flex items-start gap-2 rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700 dark:bg-success-500/10 dark:text-success-400">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>Data sudah tersimpan otomatis. Kamu tidak perlu khawatir hilang.</span>
        </div>
      </Step>

      {/* Step 6 */}
      <Step number={6} title="Download PDF (Kalau Perlu)">
        <p>Kalau butuh laporan PDF, masuk ke menu <strong>PDF Report</strong> di sidebar. Pilih tanggal dan shift, lalu tekan <strong>Download</strong>.</p>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-surface-alt px-3 py-2 text-xs text-text-muted">
          <FileDown size={14} />
          <span>PDF bisa diunduh kapan saja setelah data berhasil di-submit.</span>
        </div>
      </Step>

      {/* FAQ */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-theme-sm">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Lightbulb size={16} className="text-warning-500" />
          Pertanyaan Umum
        </h2>
        <div className="space-y-4">
          <Faq
            q="Apa yang terjadi kalau salah submit?"
            a="Kontak admin atau atasanmu untuk memperbaiki data. Jangan submit ulang sendiri."
          />
          <Faq
            q="Bisa input dari HP?"
            a="Bisa. Aplikasi ini mobile-friendly. Buka dari browser HP, login, lalu ikuti langkah yang sama."
          />
          <Faq
            q="Data bisa hilang?"
            a="Tidak. Semua data tersimpan di server. Kalau internet putus saat submit, coba lagi nanti — data tidak akan duplikat."
          />
          <Faq
            q="Format waste dari WhatsApp tidak ter-parse?"
            a="Pastikan format pesan sesuai template yang sudah ditentukan. Kalau masih gagal, hubungi admin."
          />
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="mt-6 text-center">
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-6 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">
          Mulai Input Waste <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <div className="relative mb-6 pl-10">
      <div className="absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">{number}</div>
      <h2 className="mb-2 text-sm font-semibold text-text-primary">{title}</h2>
      <div className="text-xs leading-relaxed text-text-muted">{children}</div>
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
      <AlertTriangle size={14} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-text-primary">{q}</p>
      <p className="mt-1 text-xs text-text-muted">{a}</p>
    </div>
  )
}
