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
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border-2 border-border bg-[#111] p-5 shadow-nb-lg">
        <h2 className="mb-2 text-lg font-black text-text-primary">{title}</h2>
        <p className="mb-5 text-sm text-text-muted">{description}</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border-2 border-border bg-[#141414] px-4 py-2 text-sm font-bold text-text-muted shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0 active:translate-y-0 active:shadow-none">{cancelLabel}</button>
          <button onClick={onConfirm} className="rounded-lg border-2 border-[#000] bg-warning px-4 py-2 text-sm font-black text-black shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0 active:translate-y-0 active:shadow-none">{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
