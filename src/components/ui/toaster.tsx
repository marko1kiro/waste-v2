import { useToast } from '@/hooks/use-toast'
import type { ToastVariant } from '@/hooks/use-toast'
import { X } from 'lucide-react'

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: 'border-border bg-surface text-text-primary',
  destructive: 'border-error-200 bg-error-50 text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400',
  success: 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400',
  warning: 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400',
  info: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400',
}

export function Toaster() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-in slide-in-from-top-2 fade-in relative min-w-[280px] max-w-[360px] rounded-lg border px-4 py-3 shadow-theme-md ${VARIANT_STYLES[t.variant || 'default']}`}
        >
          <button
            onClick={() => dismissToast(t.id)}
            className="absolute right-2 top-2 opacity-50 hover:opacity-100"
          >
            <X size={14} />
          </button>
          <p className="pr-5 text-sm font-bold">{t.title}</p>
          {t.description && (
            <p className="mt-0.5 text-xs opacity-80">{t.description}</p>
          )}
        </div>
      ))}
    </div>
  )
}
