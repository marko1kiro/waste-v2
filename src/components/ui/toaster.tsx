import { useToast } from '@/hooks/use-toast'
import type { ToastVariant } from '@/hooks/use-toast'
import { X } from 'lucide-react'

const VARIANT_STYLES: Record<ToastVariant, string> = {
  default: 'border-border bg-surface text-text-primary',
  destructive: 'border-danger/50 bg-danger/10 text-danger',
  success: 'border-success/50 bg-success/10 text-success',
  warning: 'border-warning/50 bg-warning/10 text-warning',
  info: 'border-primary/50 bg-primary/10 text-primary',
}

export function Toaster() {
  const { toasts, dismissToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed right-4 top-4 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-in slide-in-from-top-2 fade-in relative min-w-[280px] max-w-[360px] rounded-lg border-2 px-4 py-3 shadow-nb-md ${VARIANT_STYLES[t.variant || 'default']}`}
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
