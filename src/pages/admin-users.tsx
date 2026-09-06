import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import { StoreSwitcher } from '@/components/ui/store-switcher'
import { getAdminStoreId, withStoreId } from '@/lib/admin-store'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface UserRow {
  id: number
  username: string
  display_name: string
  role: 'admin_store' | 'super_admin'
  status: 'active' | 'inactive'
  store_id?: number | null
  store_code?: string | null
  store_name?: string | null
  created_at: string
}

interface StoreOption {
  id: number
  code: string
  name: string
  status: string
}

const PAGE_SIZE = 8

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [form, setForm] = useState<{ username: string; password: string; display_name: string; role: 'admin_store' | 'super_admin'; store_id: number }>({ username: '', password: '', display_name: '', role: 'admin_store', store_id: 1 })
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin_store' | 'super_admin'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [deleting, setDeleting] = useState<UserRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const { data, refetch, isLoading, error } = useQuery<{ success: boolean; data: UserRow[] }>({
    queryKey: ['admin-users', getAdminStoreId()],
    queryFn: () => apiClient.fetch(withStoreId('/api/admin/users', getAdminStoreId())),
  })

  const { data: storesData } = useQuery<{ success: boolean; data: StoreOption[] }>({
    queryKey: ['admin-stores'],
    queryFn: () => apiClient.fetch('/api/admin/stores'),
    staleTime: 5 * 60_000,
  })
  const storeOptions = (storesData?.data || []).filter((s) => s.status === 'active')

  const filteredRows = useMemo(() => {
    return (data?.data || []).filter((row) => {
      const matchesQuery = [row.username, row.display_name, row.role, row.status].join(' ').toLowerCase().includes(query.toLowerCase())
      const matchesRole = roleFilter === 'all' || row.role === roleFilter
      const matchesStatus = statusFilter === 'all' || row.status === statusFilter
      return matchesQuery && matchesRole && matchesStatus
    })
  }, [data, query, roleFilter, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
  const rows = useMemo(() => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filteredRows, page])

  async function addUser() {
    if (form.username.trim().length < 3) return toast.error('Eh, ada yang kurang', 'Username minimal 3 karakter ya.')
    if (form.display_name.trim().length < 3) return toast.error('Eh, ada yang kurang', 'Nama display minimal 3 karakter ya.')
    if (form.password.length < 6) return toast.error('Eh, ada yang kurang', 'Password minimal 6 karakter ya.')

    setCreating(true)
    try {
      const res = await apiClient.fetch<{ success: boolean; message?: string }>('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ ...form, store_id: form.role === 'admin_store' ? form.store_id : null, username: form.username.trim(), display_name: form.display_name.trim() }),
      })
      setForm({ username: '', password: '', display_name: '', role: 'admin_store', store_id: storeOptions[0]?.id ?? 1 })
      await refetch()
      toast.success(res.message || 'Akun store udah dibuat')
    } catch (err) {
      toast.error('Waduh gagal tambah akun', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  async function saveUser(user: UserRow, password?: string) {
    if (user.username.trim().length < 3) return toast.error('Eh, ada yang kurang', 'Username minimal 3 karakter ya.')
    if (user.display_name.trim().length < 3) return toast.error('Eh, ada yang kurang', 'Nama display minimal 3 karakter ya.')
    if (password && password.length < 6) return toast.error('Eh, ada yang kurang', 'Password baru minimal 6 karakter ya.')

    setSavingId(user.id)
    try {
      const res = await apiClient.fetch<{ success: boolean; message?: string }>('/api/admin/users', {
        method: 'PUT',
        body: JSON.stringify({ ...user, password: password || undefined }),
      })
      await refetch()
      toast.success(res.message || 'Akun udah diupdate')
    } catch (err) {
      toast.error('Waduh gagal update akun', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteUser() {
    if (!deleting) return
    setDeletingId(deleting.id)
    try {
      const res = await apiClient.fetch<{ success: boolean; message?: string }>(`/api/admin/users?id=${deleting.id}`, { method: 'DELETE' })
      await refetch()
      toast.success(res.message || 'Akun udah dihapus')
      setDeleting(null)
    } catch (err) {
      toast.error('Waduh gagal hapus akun', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl py-2">
      <ConfirmDialog open={Boolean(deleting)} title="Hapus akun store?" description={`Akun ${deleting?.username || ''} akan dihapus.`} onConfirm={deleteUser} onCancel={() => setDeleting(null)} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Admin • Akun Store</h1>
          <p className="text-xs text-text-muted">Kelola akun login buat user store & admin.</p>
        </div>
        <StoreSwitcher invalidateKeys={[['admin-users'], ['admin-stores']]} />
      </div>

      <section className="mb-5 rounded-xl border border-border bg-surface p-4 shadow-theme-sm">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Tambah Akun</h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <input placeholder="Username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
          <input placeholder="Nama display" value={form.display_name} onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'admin_store' | 'super_admin' }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option value="admin_store">admin_store</option><option value="super_admin">super_admin</option></select>
          <select value={form.store_id} onChange={(e) => setForm((p) => ({ ...p, store_id: Number(e.target.value) }))} disabled={form.role === 'super_admin'} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary disabled:opacity-50"><option value={0} disabled>Pilih resto</option>{storeOptions.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}</select>
          <button onClick={addUser} disabled={creating} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50">{creating ? 'Nyimpen...' : 'Tambah'}</button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-theme-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Daftar Akun</h2>
          <div className="grid gap-2 md:grid-cols-3 xl:min-w-[760px]">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-text-muted"><Search size={14} /><input placeholder="Cari username / nama / role" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} className="w-full bg-transparent text-sm text-text-primary outline-none" /></div>
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as typeof roleFilter); setPage(1) }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option value="all">Semua Role</option><option value="admin_store">admin_store</option><option value="super_admin">super_admin</option></select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option value="all">Semua Status</option><option value="active">active</option><option value="inactive">inactive</option></select>
          </div>
        </div>

        {isLoading && <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-muted">Bentar ya...</div>}
        {error && <div className="rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-3 text-sm text-error-600 dark:text-error-400">Waduh gagal muat akun.</div>}
        {!isLoading && !error && rows.length === 0 && <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-muted">{getAdminStoreId() ? 'Belum ada user di Resto ini.' : 'Belum ada akun.'}</div>}

        {!isLoading && !error && rows.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-3 md:hidden">
              {rows.map((user) => {
                const isSelf = currentUser?.username === user.username
                const isSaving = savingId === user.id
                const isDeleting = deletingId === user.id
                let passwordDraft = ''
                return (
                  <div key={user.id} className="rounded-xl border border-border bg-background p-3">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-brand-200 bg-brand-50 px-2 py-1 text-[10px] font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400">{user.role}</span>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${user.status === 'active' ? 'border-success-200 bg-success-50 dark:border-success-500/20 dark:bg-success-500/10 text-success-600 dark:text-success-400' : 'border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 text-error-600 dark:text-error-400'}`}>{user.status}</span>
                      {isSelf && <span className="rounded-full border border-warning-200 bg-warning-50 dark:border-warning-500/20 dark:bg-warning-500/10 px-2 py-1 text-[10px] font-semibold text-warning-600 dark:text-warning-400">Akun Lo</span>}
                    </div>
                    <div className="grid gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Username</label>
                        <input defaultValue={user.username} onBlur={(e) => { user.username = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Nama Display</label>
                        <input defaultValue={user.display_name} onBlur={(e) => { user.display_name = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Password Baru</label>
                        <input placeholder="Opsional" type="password" onBlur={(e) => { passwordDraft = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Role</label>
                        <select defaultValue={user.role} onChange={(e) => { user.role = e.target.value as 'admin_store' | 'super_admin' }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary"><option value="admin_store">admin_store</option><option value="super_admin">super_admin</option></select>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => saveUser({ ...user }, passwordDraft)} disabled={isSaving || isDeleting} className="flex-1 rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10 px-3 py-2 text-xs font-semibold text-primary shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isSaving ? 'Nyimpen...' : 'Simpan'}</button>
                      <button onClick={() => setDeleting(user)} disabled={isSaving || isDeleting || isSelf} className="flex-1 rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-2 text-xs font-semibold text-error-600 dark:text-error-400 shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isDeleting ? '...' : 'Hapus'}</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-alt text-[11px] uppercase text-text-muted">
                  <tr>
                    <th className="px-3 py-3">Username</th>
                    <th className="px-3 py-3">Nama Display</th>
                    <th className="px-3 py-3">Password Baru</th>
                    <th className="px-3 py-3">Role</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((user) => {
                    const isSelf = currentUser?.username === user.username
                    const isSaving = savingId === user.id
                    const isDeleting = deletingId === user.id
                    let passwordDraft = ''
                    return (
                      <tr key={user.id} className="border-t border-border bg-background align-top">
                        <td className="px-3 py-3"><input defaultValue={user.username} onBlur={(e) => { user.username = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" /></td>
                        <td className="px-3 py-3"><input defaultValue={user.display_name} onBlur={(e) => { user.display_name = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" /></td>
                        <td className="px-3 py-3"><input placeholder="Password baru (opsional)" type="password" onBlur={(e) => { passwordDraft = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" /></td>
                        <td className="px-3 py-3"><select defaultValue={user.role} onChange={(e) => { user.role = e.target.value as 'admin_store' | 'super_admin' }} className="rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary"><option value="admin_store">admin_store</option><option value="super_admin">super_admin</option></select></td>
                        <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${user.status === 'active' ? 'border-success-200 bg-success-50 dark:border-success-500/20 dark:bg-success-500/10 text-success-600 dark:text-success-400' : 'border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 text-error-600 dark:text-error-400'}`}>{user.status}</span></td>
                        <td className="px-3 py-3"><div className="flex justify-end gap-2"><button onClick={() => saveUser({ ...user }, passwordDraft)} disabled={isSaving || isDeleting} className="rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isSaving ? 'Nyimpen...' : 'Simpan'}</button><button onClick={() => setDeleting(user)} disabled={isSaving || isDeleting || isSelf} className="rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-1.5 text-xs font-semibold text-error-600 dark:text-error-400 shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isDeleting ? '...' : 'Hapus'}</button></div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-muted">
                <span>Halaman {page} / {pageCount}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-border px-2 py-1 disabled:opacity-50">Prev</button>
                  <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page === pageCount} className="rounded border border-border px-2 py-1 disabled:opacity-50">Next</button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
