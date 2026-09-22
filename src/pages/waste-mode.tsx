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
      title: 'Manual',
      iconTone: 'bg-brand-500/10 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
    }] : []),
    {
      href: '/paste-waste',
      icon: ClipboardPaste,
      title: 'Paste',
      iconTone: 'bg-success-500/10 text-success-600 dark:bg-success-500/15 dark:text-success-400',
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

      <div className={`grid w-full gap-2.5 lg:gap-4 ${both ? 'md:grid-cols-2 lg:max-w-4xl' : 'max-w-xl'}`}>
        {cards.map((card, i) => (
          <Link
            key={card.href}
            href={card.href}
            aria-label={card.title}
            className="anim-enter group flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-theme-xs transition-all duration-200 hover:border-brand-300 active:scale-[0.98] dark:hover:border-brand-500/40 lg:p-5"
            style={{ animationDelay: `${180 + i * 90}ms` }}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-105 ${card.iconTone} lg:h-12 lg:w-12`}>
              <card.icon className="size-5 lg:size-6" />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-bold tracking-tight text-text-primary lg:text-base">
              {card.title}
            </span>
            <ArrowRight size={20} className="shrink-0 text-text-dim transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </div>
  )
}
