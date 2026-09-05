interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Gas lanjut',
  cancelLabel = 'Gajadi',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-gray-950/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-theme-lg">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">{title}</h2>
        <p className="mb-5 text-sm text-text-muted">{description}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-alt hover:text-text-primary">{cancelLabel}</button>
          <button onClick={onConfirm} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
