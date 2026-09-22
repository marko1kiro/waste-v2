import { Link } from 'wouter'
import { ClipboardPaste, PenLine, ArrowRight, Sparkles } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { canManual, pasteOnly } from '@/lib/store-features'

export default function WasteMode() {
  const { store } = useAuth()
  const showManual = canManual(store)
  const isPasteOnly = pasteOnly(store)
  const both = showManual && !isPasteOnly

  const cards = [
    ...(showManual && !isPasteOnly ? [{
      href: '/manual-waste',
      icon: PenLine,
      title: 'Input Manual',
      desc: 'Isi form item satu per satu seperti biasa. Cocok buat koreksi atau input sedikit.',
      tag: 'Fleksibel',
      accent: 'from-brand-500 to-brand-700',
      iconBg: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
    }] : []),
    {
      href: '/paste-waste',
      icon: ClipboardPaste,
      title: 'Paste Format Waste',
      desc: 'Paste format WhatsApp, parser baca otomatis, lalu cek hasilnya dan submit.',
      tag: 'Paling cepat',
      accent: 'from-success-500 to-success-700',
      iconBg: 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400',
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center px-4 py-3 lg:py-14">
      <div className="anim-enter mb-1.5 flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300 lg:mb-2 lg:gap-2 lg:px-3 lg:py-1 lg:text-[11px]">
        <Sparkles size={11} className="lg:size-3" />
        Pilih cara input
      </div>
      <h1 className="anim-enter mb-3 text-center text-lg font-bold tracking-tight text-text-primary lg:mb-2 lg:text-4xl" style={{ animationDelay: '60ms' }}>
        Mau input waste gimana?
      </h1>
      <p className="anim-enter mb-8 hidden max-w-md text-center text-xs text-text-muted lg:mb-12 lg:block lg:text-sm" style={{ animationDelay: '120ms' }}>
        Dua jalur menuju data yang sama — pilih yang paling enak buat shift lo sekarang.
      </p>

      <div className={`grid w-full gap-2.5 lg:gap-6 ${both ? 'md:grid-cols-2 lg:max-w-4xl' : 'max-w-xl'}`}>
        {cards.map((card, i) => (
          <Link
            key={card.href}
            href={card.href}
            className="anim-enter hover-lift group relative block overflow-hidden rounded-2xl border border-border bg-surface shadow-theme-xs"
            style={{ animationDelay: `${180 + i * 90}ms` }}
          >
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${card.accent}`} />

            {/* Mobile: kartu ringkas satu baris — muat 1 layar tanpa scroll */}
            <div className="flex items-center gap-3 p-3.5 lg:hidden">
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                <card.icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-text-primary">{card.title}</span>
                  <span className="shrink-0 rounded-full bg-surface-alt px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-muted">
                    {card.tag}
                  </span>
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[11px] leading-snug text-text-muted">{card.desc}</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-text-dim transition-transform duration-300 group-active:translate-x-1" />
            </div>

            {/* Desktop/tablet besar: tampilan lapang seperti semula */}
            <div className="hidden p-6 lg:block lg:p-8">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${card.iconBg} transition-transform duration-300 group-hover:scale-110 lg:h-14 lg:w-14`}>
                  <card.icon size={24} />
                </span>
                <span className="rounded-full bg-surface-alt px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                  {card.tag}
                </span>
              </div>
              <h2 className="mt-4 text-lg font-bold text-text-primary lg:text-xl">{card.title}</h2>
              <p className="mt-1.5 text-xs leading-relaxed text-text-muted lg:text-sm">{card.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-300 lg:text-sm">
                Mulai
                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
