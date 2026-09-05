import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Building2, Loader2, Plus, Pencil } from 'lucide-react'

interface StoreRow {
  id: number
  code: string
  name: string
  drive_account: 'legacy' | 'neutral'
  drive_folder_id: string
  features: { manual_mode: boolean; catalog: boolean }
  status: string
  user_count: number
  total_entries: number
  created_at: string
}

interface StoreForm {
  code: string
  name: string
  drive_account: 'legacy' | 'neutral'
  drive_folder_id: string
  manual_mode: boolean
  catalog: boolean
}

const emptyForm: StoreForm = { code: '', name: '', drive_account: 'neutral', drive_folder_id: '', manual_mode: false, catalog: false }

export default function AdminRestos() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery<{ success: boolean; data: StoreRow[] }>({
    queryKey: ['admin-stores'],
    queryFn: () => apiClient.fetch('/api/admin/stores'),
  })
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<StoreForm>(emptyForm)
  const [editing, setEditing] = useState<StoreRow | null>(null)
  const [editForm, setEditForm] = useState<StoreForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<StoreRow | null>(null)

  const stores = data?.data || []

  async function create() {
    setSaving(true)
    try {
      const res = await apiClient.fetch<{ success: boolean; message?: string }>('/api/admin/stores', { method: 'POST', body: JSON.stringify(form) })
      if (res.success) {
        toast.success('Resto dibuat', res.message || 'Resto baru berhasil dibuat.')
        setCreating(false)
        setForm(emptyForm)
        qc.invalidateQueries({ queryKey: ['admin-stores'] })
      }
    } catch (err) {
      toast.error('Gagal bikin resto', err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await apiClient.fetch<{ success: boolean; message?: string }>('/api/admin/stores', { method: 'PUT', body: JSON.stringify({ id: editing.id, ...editForm }) })
      if (res.success) {
        toast.success('Resto diupdate', res.message || 'Resto berhasil diupdate.')
        setEditing(null)
        qc.invalidateQueries({ queryKey: ['admin-stores'] })
      }
    } catch (err) {
      toast.error('Gagal update resto', err instanceof Error ? err.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(row: StoreRow) {
    try {
      await apiClient.fetch('/api/admin/stores', { method: 'PUT', body: JSON.stringify({ id: row.id, name: row.name, drive_folder_id: row.drive_folder_id, manual_mode: row.features.manual_mode, catalog: row.features.catalog, status: 'inactive' }) })
      toast.success('Resto dinonaktifkan', `${row.code} sekarang inactive.`)
      setDeleting(null)
      qc.invalidateQueries({ queryKey: ['admin-stores'] })
    } catch (err) {
      toast.error('Gagal nonaktifkan resto', err instanceof Error ? err.message : 'Error')
    }
  }

  function startEdit(row: StoreRow) {
    setEditing(row)
    setEditForm({ code: row.code, name: row.name, drive_account: row.drive_account, drive_folder_id: row.drive_folder_id, manual_mode: row.features.manual_mode, catalog: row.features.catalog })
  }

  const inputCls = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500'

  return (
    <div className="mx-auto max-w-5xl py-2">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-brand-500 dark:text-brand-400" />
          <h1 className="text-lg font-semibold text-text-primary">Kelola Resto</h1>
        </div>
        <button onClick={() => { setCreating(true); setForm(emptyForm) }} className="flex items-center gap-1 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">
          <Plus size={14} /> Resto Baru
        </button>
      </div>

      {isLoading && <div className="flex items-center justify-center gap-2 py-10 text-text-muted"><Loader2 size={18} className="animate-spin" /><span className="text-sm">Bentar ya...</span></div>}

      {!isLoading && stores.length === 0 && <div className="rounded-xl border border-border bg-surface p-6 text-center text-sm text-text-muted shadow-theme-xs">Belum ada resto terdaftar.</div>}

      <div className="grid gap-3 md:grid-cols-2">
        {stores.map((row) => (
          <div key={row.id} className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
            <div className="mb-2 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{row.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${row.status === 'active' ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400' : 'border-gray-200 bg-surface-alt text-gray-500 dark:border-gray-700 dark:bg-gray-900'}`}>{row.status === 'active' ? 'Aktif' : 'Nonaktif'}</span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-text-muted">{row.code} • {row.drive_account === 'legacy' ? 'Drive legacy' : 'Drive netral'}</p>
              </div>
              <button onClick={() => startEdit(row)} className="rounded bg-brand-50 p-1.5 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"><Pencil size={13} /></button>
            </div>
            <div className="mb-3 flex flex-wrap gap-1.5 text-[10px]">
              {row.features.manual_mode && <span className="rounded-full border border-border bg-background px-2 py-0.5 text-text-muted">Manual</span>}
              {row.features.catalog && <span className="rounded-full border border-border bg-background px-2 py-0.5 text-text-muted">Katalog</span>}
              {!row.features.manual_mode && !row.features.catalog && <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">Paste only</span>}
              {row.drive_folder_id && <span className="max-w-[180px] truncate rounded-full border border-border bg-background px-2 py-0.5 text-text-muted" title={row.drive_folder_id}>Folder: {row.drive_folder_id}</span>}
            </div>
            <div className="flex items-center justify-between text-[11px] text-text-muted">
              <span>{row.user_count} akun • {row.total_entries} entri</span>
              {row.status === 'active' && row.code !== 'CKRBUL' && <button onClick={() => setDeleting(row)} className="text-error-600 dark:text-error-400">Nonaktifkan</button>}
            </div>
          </div>
        ))}
      </div>

      {(creating || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-theme-lg">
            <h2 className="mb-4 text-lg font-semibold text-text-primary">{editing ? `Edit ${editing.code}` : 'Resto Baru'}</h2>
            <div className="space-y-3">
              {!editing && (
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Kode Store</label>
                  <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={20} placeholder="CKRBUL" className={inputCls} />
                </div>
              )}
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Nama Resto</label>
                <input value={editing ? editForm.name : form.name} onChange={(e) => editing ? setEditForm({ ...editForm, name: e.target.value }) : setForm({ ...form, name: e.target.value })} maxLength={100} placeholder="GACOAN KAMPUNG BULU" className={inputCls} />
              </div>
              {!editing && (
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Drive Account</label>
                  <select value={form.drive_account} onChange={(e) => setForm({ ...form, drive_account: e.target.value as 'legacy' | 'neutral' })} className={inputCls}>
                    <option value="neutral">Netral (resto baru)</option>
                    <option value="legacy">Legacy (CKRBUL)</option>
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Drive Folder ID</label>
                <input value={editing ? editForm.drive_folder_id : form.drive_folder_id} onChange={(e) => editing ? setEditForm({ ...editForm, drive_folder_id: e.target.value }) : setForm({ ...form, drive_folder_id: e.target.value })} placeholder="1AbC..." className={inputCls} />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" checked={editing ? editForm.manual_mode : form.manual_mode} onChange={(e) => editing ? setEditForm({ ...editForm, manual_mode: e.target.checked }) : setForm({ ...form, manual_mode: e.target.checked })} />
                  Mode manual
                </label>
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <input type="checkbox" checked={editing ? editForm.catalog : form.catalog} onChange={(e) => editing ? setEditForm({ ...editForm, catalog: e.target.checked }) : setForm({ ...form, catalog: e.target.checked })} />
                  Katalog station
                </label>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => { setCreating(false); setEditing(null) }} className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-alt hover:text-text-primary">Batal</button>
              <button onClick={() => (editing ? void save() : void create())} disabled={saving} className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {editing ? 'Simpan' : 'Buat Resto'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title={`Nonaktifkan ${deleting?.code}?`}
        description="Resto nonaktif tidak bisa login submit data baru. Data lama tetap aman."
        confirmLabel="Nonaktifkan"
        onConfirm={() => deleting && void deactivate(deleting)}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
