import * as Dialog from '@radix-ui/react-dialog'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

// Rebuilt di atas @radix-ui/react-dialog: focus trap, tutup pakai Esc / klik
// overlay, dan role="dialog" + aria-modal="true" bawaan Radix.
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Gas lanjut',
  cancelLabel = 'Gajadi',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-gray-950/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[121] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-5 shadow-theme-lg">
          <Dialog.Title className="mb-2 text-lg font-semibold text-text-primary">{title}</Dialog.Title>
          <Dialog.Description className="mb-5 text-sm text-text-muted">{description}</Dialog.Description>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-alt hover:text-text-primary">{cancelLabel}</button>
            <button type="button" onClick={onConfirm} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">{confirmLabel}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
