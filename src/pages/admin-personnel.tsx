import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { fileToBase64 } from '@/lib/file-utils'
import { toast } from '@/hooks/use-toast'
import { StoreSwitcher } from '@/components/ui/store-switcher'
import { getAdminStoreId, withStoreId } from '@/lib/admin-store'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { AuthenticatedImage } from '@/components/ui/authenticated-image'
import { Search, Loader2 } from 'lucide-react'

interface PersonnelRow {
  id: number
  name: string
  full_name: string
  role: 'qc' | 'manager'
  signature_url: string
  status: string
}

type SortKey = 'name' | 'full_name' | 'role'

const MAX_SIGNATURE_SIZE_KB = 500
const ALLOWED_SIGNATURE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

export default function AdminPersonnel() {
  const [form, setForm] = useState({ name: '', full_name: '', role: 'qc', signature_url: '' })
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'qc' | 'manager'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('full_name')
  const [deleting, setDeleting] = useState<PersonnelRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [uploadingId, setUploadingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, refetch, isLoading, error } = useQuery<{ success: boolean; data: PersonnelRow[] }>({
    queryKey: ['admin-personnel'],
    queryFn: () => apiClient.fetch(withStoreId('/api/admin/personnel', getAdminStoreId())),
  })

  const rows = useMemo(() => {
    const base = (data?.data || []).filter((row) => {
      const matchesQuery = [row.name, row.full_name, row.role].join(' ').toLowerCase().includes(query.toLowerCase())
      const matchesRole = roleFilter === 'all' || row.role === roleFilter
      return matchesQuery && matchesRole
    })
    return [...base].sort((a, b) => String(a[sortKey]).localeCompare(String(b[sortKey])))
  }, [data, query, roleFilter, sortKey])

  function validateForm() {
    if (form.name.trim().length < 2) return 'Short name minimal 2 karakter ya.'
    if (form.full_name.trim().length < 3) return 'Full name minimal 3 karakter ya.'
    return null
  }

  async function addPersonnel() {
    const validationError = validateForm()
    if (validationError) {
      toast.error('Eh, ada yang kurang', validationError)
      return
    }

    setCreating(true)
    try {
      const payload = {
        name: form.name.trim().toUpperCase(),
        full_name: form.full_name.trim(),
        role: form.role,
        signature_url: form.signature_url,
      }
      const res = await apiClient.fetch<{ success: boolean; message?: string }>(withStoreId('/api/admin/personnel', getAdminStoreId()), { method: 'POST', body: JSON.stringify(payload) })
      setForm({ name: '', full_name: '', role: 'qc', signature_url: '' })
      await refetch()
      toast.success(res.message || 'Personnel udah ditambahin')
    } catch (err) {
      toast.error('Waduh gagal tambah personnel', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  async function savePersonnel(person: PersonnelRow) {
    if (person.name.trim().length < 2 || person.full_name.trim().length < 3) {
      toast.error('Eh, ada yang kurang', 'Short name / full name ga valid.')
      return
    }

    setSavingId(person.id)
    try {
      const res = await apiClient.fetch<{ success: boolean; message?: string }>(withStoreId('/api/admin/personnel', getAdminStoreId()), {
        method: 'PUT',
        body: JSON.stringify({
          ...person,
          name: person.name.trim().toUpperCase(),
          full_name: person.full_name.trim(),
        }),
      })
      await refetch()
      toast.success(res.message || 'Personnel udah diupdate')
    } catch (err) {
      toast.error('Waduh gagal update personnel', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSavingId(null)
    }
  }

  async function uploadPersonnelSignature(id: number, file: File) {
    if (!ALLOWED_SIGNATURE_TYPES.includes(file.type)) {
      toast.error('File ga valid', 'Signature harus PNG, JPG, JPEG, atau WEBP ya.')
      return
    }
    if (file.size > MAX_SIGNATURE_SIZE_KB * 1024) {
      toast.error('File kegedean', 'Signature max 500KB. Kompres/crop dulu ya.')
      return
    }
    setUploadingId(id)
    try {
      const base64 = await fileToBase64(file)
      const uploaded = await apiClient.fetch<{ success: boolean; proxyUrl: string }>('/api/upload-file', {
        method: 'POST',
        body: JSON.stringify({ filename: file.name, contentType: file.type, base64, folder: 'signatures' }),
      })
      await apiClient.fetch(withStoreId('/api/admin/personnel', getAdminStoreId()), { method: 'PUT', body: JSON.stringify({ ...rows.find((p) => p.id === id), id, signature_url: uploaded.proxyUrl }) })
      await refetch()
      toast.success('Signature udah diupload')
    } catch (err) {
      toast.error('Waduh gagal upload signature', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setUploadingId(null)
    }
  }

  async function deactivatePersonnel() {
    if (!deleting) return
    setDeletingId(deleting.id)
    try {
      const res = await apiClient.fetch<{ success: boolean; message?: string }>(withStoreId(`/api/admin/personnel?id=${deleting.id}`, getAdminStoreId()), { method: 'DELETE' })
      await refetch()
      toast.success(res.message || 'Personnel udah dihapus')
      setDeleting(null)
    } catch (err) {
      toast.error('Waduh gagal hapus personnel', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl py-2">
      <ConfirmDialog open={Boolean(deleting)} title="Hapus personnel?" description={`Personnel ${deleting?.full_name || deleting?.name || ''} akan dihapus.`} onConfirm={deactivatePersonnel} onCancel={() => setDeleting(null)} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Admin • Personnel</h1>
          <p className="text-xs text-text-muted">Kelola QC & Manager.</p>
        </div>
        <StoreSwitcher invalidateKeys={[['admin-personnel']]} />
      </div>

      <section className="mb-5 rounded-xl border border-border bg-surface p-4 shadow-theme-sm">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Tambah Personnel</h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          <input placeholder="Short name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
          <input placeholder="Full name" value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option value="qc">qc</option><option value="manager">manager</option></select>
          <button onClick={addPersonnel} disabled={creating} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50">{creating ? 'Nyimpen...' : 'Tambah'}</button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-theme-sm">
        <div className="mb-2 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Daftar Personnel</h2>
          <div className="grid gap-2 md:grid-cols-3 xl:min-w-[640px]">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-text-muted"><Search size={14} /><input placeholder="Cari nama / role" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm text-text-primary outline-none" /></div>
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as 'all' | 'qc' | 'manager')} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option value="all">Semua Role</option><option value="qc">QC</option><option value="manager">Manager</option></select>
            <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option value="full_name">Sort: Full name</option><option value="name">Sort: Short name</option><option value="role">Sort: Role</option></select>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-muted">
          Upload TTD: PNG/JPG/WEBP, max 500KB, background putih/transparan.
        </div>

        {isLoading && <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-muted">Bentar ya...</div>}
        {error && <div className="rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-3 text-sm text-error-600 dark:text-error-400">Waduh gagal muat personnel. Coba refresh ya.</div>}
        {!isLoading && !error && rows.length === 0 && <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-muted">Belum ada personnel.</div>}

        {!isLoading && !error && rows.length > 0 && (
          <>
            <div className="space-y-3 md:hidden">
              {rows.map((p) => {
                const isSaving = savingId === p.id
                const isUploading = uploadingId === p.id
                const isDeleting = deletingId === p.id
                return (
                  <div key={p.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="mb-3 grid gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Short Name</label>
                        <input defaultValue={p.name} onBlur={(e) => { p.name = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Full Name</label>
                        <input defaultValue={p.full_name} onBlur={(e) => { p.full_name = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Role</label>
                        <select defaultValue={p.role} onChange={(e) => { p.role = e.target.value as 'qc' | 'manager' }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary"><option value="qc">qc</option><option value="manager">manager</option></select>
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Signature</label>
                        <div className="flex flex-col gap-2">
                          <label className="inline-flex w-fit cursor-pointer rounded border border-border px-3 py-2 text-xs text-text-muted hover:text-text-primary">
                            {isUploading ? <><Loader2 size={12} className="mr-1 animate-spin" /> Upload...</> : 'Upload TTD'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPersonnelSignature(p.id, e.target.files[0])} />
                          </label>
                          {p.signature_url && <AuthenticatedImage src={p.signature_url} alt={p.full_name || p.name} className="h-16 w-fit rounded border border-border bg-white p-1" />}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => savePersonnel({ ...p })} disabled={isSaving || isUploading || isDeleting} className="flex-1 rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10 px-3 py-2 text-xs font-semibold text-primary shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isSaving ? 'Nyimpen...' : 'Simpan'}</button>
                      <button onClick={() => setDeleting(p)} disabled={isSaving || isUploading || isDeleting} className="flex-1 rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-2 text-xs font-semibold text-error-600 dark:text-error-400 shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isDeleting ? '...' : 'Hapus'}</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-alt text-[11px] uppercase text-text-muted">
                  <tr>
                    <th className="px-3 py-3">Short</th>
                    <th className="px-3 py-3">Full Name</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Signature</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const isSaving = savingId === p.id
                    const isUploading = uploadingId === p.id
                    const isDeleting = deletingId === p.id
                    return (
                      <tr key={p.id} className="border-t border-border bg-background align-top">
                        <td className="px-3 py-3"><input defaultValue={p.name} onBlur={(e) => { p.name = e.target.value }} className="w-full rounded border border-border bg-surface px-2 py-1 text-text-primary" /></td>
                        <td className="px-3 py-3"><input defaultValue={p.full_name} onBlur={(e) => { p.full_name = e.target.value }} className="w-full rounded border border-border bg-surface px-2 py-1 text-text-primary" /></td>
                        <td className="px-3 py-3"><select defaultValue={p.role} onChange={(e) => { p.role = e.target.value as 'qc' | 'manager' }} className="rounded border border-border bg-surface px-2 py-1 text-text-primary"><option value="qc">qc</option><option value="manager">manager</option></select></td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-2">
                            <label className="inline-flex cursor-pointer rounded border border-border px-2 py-1 text-xs text-text-muted hover:text-text-primary">
                              {isUploading ? <><Loader2 size={12} className="mr-1 animate-spin" /> Upload...</> : 'Upload TTD'}
                              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPersonnelSignature(p.id, e.target.files[0])} />
                            </label>
                            {p.signature_url && <AuthenticatedImage src={p.signature_url} alt={p.full_name || p.name} className="h-12 rounded border border-border bg-white p-1" />}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => savePersonnel({ ...p })} disabled={isSaving || isUploading || isDeleting} className="rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isSaving ? 'Nyimpen...' : 'Simpan'}</button>
                            <button onClick={() => setDeleting(p)} disabled={isSaving || isUploading || isDeleting} className="rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-1.5 text-xs font-semibold text-error-600 dark:text-error-400 shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isDeleting ? '...' : 'Hapus'}</button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}
