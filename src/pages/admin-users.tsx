import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Search } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface UserRow {
  id: number
  username: string
  display_name: string
  role: 'admin_store' | 'super_admin'
  status: 'active' | 'inactive'
  created_at: string
}

const PAGE_SIZE = 8

export default function AdminUsers() {
  const { user: currentUser } = useAuth()
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'admin_store' })
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin_store' | 'super_admin'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [deleting, setDeleting] = useState<UserRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  const { data, refetch, isLoading, error } = useQuery<{ success: boolean; data: UserRow[] }>({
    queryKey: ['admin-users'],
    queryFn: () => apiClient.fetch('/api/admin/users'),
  })

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
        body: JSON.stringify({ ...form, username: form.username.trim(), display_name: form.display_name.trim() }),
      })
      setForm({ username: '', password: '', display_name: '', role: 'admin_store' })
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

      <div className="mb-5">
        <h1 className="text-xl font-black text-warning">Admin • Akun Store</h1>
        <p className="text-xs text-text-muted">Kelola akun login buat user store & admin.</p>
      </div>

      <section className="mb-5 rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-md">
        <h2 className="mb-3 text-sm font-black text-text-primary">Tambah Akun</h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
          <input placeholder="Username" value={form.username} onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))} className="rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary" />
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} className="rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary" />
          <input placeholder="Nama display" value={form.display_name} onChange={(e) => setForm((p) => ({ ...p, display_name: e.target.value }))} className="rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary" />
          <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as 'admin_store' | 'super_admin' }))} className="rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary"><option value="admin_store">admin_store</option><option value="super_admin">super_admin</option></select>
          <button onClick={addUser} disabled={creating} className="rounded-lg border-2 border-[#000] bg-warning px-4 py-2 text-sm font-black text-black shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{creating ? 'Nyimpen...' : 'Tambah'}</button>
        </div>
      </section>

      <section className="rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-md">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-sm font-black text-text-primary">Daftar Akun</h2>
          <div className="grid gap-2 md:grid-cols-3 xl:min-w-[760px]">
            <div className="flex items-center gap-2 rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-text-muted"><Search size={14} /><input placeholder="Cari username / nama / role" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1) }} className="w-full bg-transparent text-sm text-text-primary outline-none" /></div>
            <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value as typeof roleFilter); setPage(1) }} className="rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary"><option value="all">Semua Role</option><option value="admin_store">admin_store</option><option value="super_admin">super_admin</option></select>
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value as typeof statusFilter); setPage(1) }} className="rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary"><option value="all">Semua Status</option><option value="active">active</option><option value="inactive">inactive</option></select>
          </div>
        </div>

        {isLoading && <div className="rounded-lg border border-border bg-[#0d0d0d] px-3 py-3 text-sm text-text-muted">Bentar ya...</div>}
        {error && <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-3 text-sm text-danger">Waduh gagal muat akun.</div>}
        {!isLoading && !error && rows.length === 0 && <div className="rounded-lg border border-border bg-[#0d0d0d] px-3 py-3 text-sm text-text-muted">Belum ada akun.</div>}

        {!isLoading && !error && rows.length > 0 && (
          <div className="space-y-3">
            <div className="space-y-3 md:hidden">
              {rows.map((user) => {
                const isSelf = currentUser?.username === user.username
                const isSaving = savingId === user.id
                const isDeleting = deletingId === user.id
                let passwordDraft = ''
                return (
                  <div key={user.id} className="rounded-xl border border-border bg-[#0d0d0d] p-3">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">{user.role}</span>
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${user.status === 'active' ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>{user.status}</span>
                      {isSelf && <span className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] font-black text-warning">Akun Lo</span>}
                    </div>
                    <div className="grid gap-2">
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">Username</label>
                        <input defaultValue={user.username} onBlur={(e) => { user.username = e.target.value }} className="w-full rounded border border-border bg-[#111] px-3 py-2 text-sm text-text-primary" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">Nama Display</label>
                        <input defaultValue={user.display_name} onBlur={(e) => { user.display_name = e.target.value }} className="w-full rounded border border-border bg-[#111] px-3 py-2 text-sm text-text-primary" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">Password Baru</label>
                        <input placeholder="Opsional" type="password" onBlur={(e) => { passwordDraft = e.target.value }} className="w-full rounded border border-border bg-[#111] px-3 py-2 text-sm text-text-primary" />
                      </div>
                      <div>
                        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">Role</label>
                        <select defaultValue={user.role} onChange={(e) => { user.role = e.target.value as 'admin_store' | 'super_admin' }} className="w-full rounded border border-border bg-[#111] px-3 py-2 text-sm text-text-primary"><option value="admin_store">admin_store</option><option value="super_admin">super_admin</option></select>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => saveUser({ ...user }, passwordDraft)} disabled={isSaving || isDeleting} className="flex-1 rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-2 text-xs font-black text-primary shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isSaving ? 'Nyimpen...' : 'Simpan'}</button>
                      <button onClick={() => setDeleting(user)} disabled={isSaving || isDeleting || isSelf} className="flex-1 rounded-lg border-2 border-danger/40 bg-danger/10 px-3 py-2 text-xs font-black text-danger shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isDeleting ? '...' : 'Hapus'}</button>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-[#171a20] text-[11px] uppercase tracking-widest text-[#777]">
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
                      <tr key={user.id} className="border-t border-border bg-[#0d0d0d] align-top">
                        <td className="px-3 py-3"><input defaultValue={user.username} onBlur={(e) => { user.username = e.target.value }} className="w-full rounded border border-border bg-[#111] px-3 py-2 text-sm text-text-primary" /></td>
                        <td className="px-3 py-3"><input defaultValue={user.display_name} onBlur={(e) => { user.display_name = e.target.value }} className="w-full rounded border border-border bg-[#111] px-3 py-2 text-sm text-text-primary" /></td>
                        <td className="px-3 py-3"><input placeholder="Password baru (opsional)" type="password" onBlur={(e) => { passwordDraft = e.target.value }} className="w-full rounded border border-border bg-[#111] px-3 py-2 text-sm text-text-primary" /></td>
                        <td className="px-3 py-3"><select defaultValue={user.role} onChange={(e) => { user.role = e.target.value as 'admin_store' | 'super_admin' }} className="rounded border border-border bg-[#111] px-3 py-2 text-sm text-text-primary"><option value="admin_store">admin_store</option><option value="super_admin">super_admin</option></select></td>
                        <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-black ${user.status === 'active' ? 'border-success/30 bg-success/10 text-success' : 'border-danger/30 bg-danger/10 text-danger'}`}>{user.status}</span></td>
                        <td className="px-3 py-3"><div className="flex justify-end gap-2"><button onClick={() => saveUser({ ...user }, passwordDraft)} disabled={isSaving || isDeleting} className="rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isSaving ? 'Nyimpen...' : 'Simpan'}</button><button onClick={() => setDeleting(user)} disabled={isSaving || isDeleting || isSelf} className="rounded-lg border-2 border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-black text-danger shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isDeleting ? '...' : 'Hapus'}</button></div></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {pageCount > 1 && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-[#0d0d0d] px-3 py-2 text-xs text-text-muted">
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
