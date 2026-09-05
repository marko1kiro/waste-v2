import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Search } from 'lucide-react'

interface StationItemRow {
  id: number
  station: string
  nama_produk: string
  unit: string
  kode_lot_wajib: boolean
  is_manual: boolean
  sort_order: number
  status: string
}

export default function AdminStationItems() {
  const [form, setForm] = useState({ station: 'NOODLE', nama_produk: '', unit: 'PCS', kode_lot_wajib: false, is_manual: false, sort_order: 0 })
  const [query, setQuery] = useState('')
  const [stationFilter, setStationFilter] = useState<'ALL' | 'NOODLE' | 'DIMSUM' | 'BAR' | 'PRODUKSI'>('ALL')
  const [deleting, setDeleting] = useState<StationItemRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, refetch, isLoading, error } = useQuery<{ success: boolean; data: StationItemRow[] }>({
    queryKey: ['admin-station-items'],
    queryFn: () => apiClient.fetch('/api/admin/station-items'),
  })

  const rows = useMemo(() => {
    return (data?.data || [])
      .filter((item) => {
        const matchesStation = stationFilter === 'ALL' || item.station === stationFilter
        const matchesQuery = [item.station, item.nama_produk, item.unit].join(' ').toLowerCase().includes(query.toLowerCase())
        return matchesStation && matchesQuery
      })
      .sort((a, b) => a.station.localeCompare(b.station) || a.sort_order - b.sort_order || a.nama_produk.localeCompare(b.nama_produk))
  }, [data, query, stationFilter])

  const groupedRows = useMemo(() => {
    const groups: Record<string, StationItemRow[]> = {}
    for (const row of rows) {
      if (!groups[row.station]) groups[row.station] = []
      groups[row.station].push(row)
    }
    return groups
  }, [rows])

  async function addItem() {
    if (form.nama_produk.trim().length < 2) {
      toast.error('Eh, ada yang kurang', 'Nama produk minimal 2 karakter ya.')
      return
    }

    setCreating(true)
    try {
      await apiClient.fetch('/api/admin/station-items', { method: 'POST', body: JSON.stringify({ ...form, nama_produk: form.nama_produk.trim().toUpperCase() }) })
      setForm({ station: 'NOODLE', nama_produk: '', unit: 'PCS', kode_lot_wajib: false, is_manual: false, sort_order: 0 })
      await refetch()
      toast.success('Item udah ditambahin')
    } catch (err) {
      toast.error('Waduh gagal tambah item', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setCreating(false)
    }
  }

  async function saveItem(item: StationItemRow) {
    setSavingId(item.id)
    try {
      await apiClient.fetch('/api/admin/station-items', { method: 'PUT', body: JSON.stringify({ ...item, nama_produk: item.nama_produk.trim().toUpperCase() }) })
      await refetch()
      toast.success('Item udah diupdate')
    } catch (err) {
      toast.error('Waduh gagal update item', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteItem() {
    if (!deleting) return
    setDeletingId(deleting.id)
    try {
      await apiClient.fetch(`/api/admin/station-items?id=${deleting.id}`, { method: 'DELETE' })
      await refetch()
      toast.info('Item udah dihapus')
      setDeleting(null)
    } catch (err) {
      toast.error('Waduh gagal hapus item', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl py-2">
      <ConfirmDialog open={Boolean(deleting)} title="Hapus station item?" description={`Item ${deleting?.nama_produk || ''} akan dihapus.`} onConfirm={deleteItem} onCancel={() => setDeleting(null)} />

      <div className="mb-5">
        <h1 className="text-xl font-semibold text-warning-600 dark:text-warning-400">Admin • Station Items</h1>
        <p className="text-xs text-text-muted">Kelola master item per station.</p>
      </div>

      <section className="mb-5 rounded-xl border border-border bg-surface p-4 shadow-theme-sm">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Tambah Item</h2>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
          <select value={form.station} onChange={(e) => setForm((p) => ({ ...p, station: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option>NOODLE</option><option>DIMSUM</option><option>BAR</option><option>PRODUKSI</option></select>
          <input placeholder="Nama produk" value={form.nama_produk} onChange={(e) => setForm((p) => ({ ...p, nama_produk: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
          <select value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option>PCS</option><option>PORSI</option><option>GRAM</option><option>PACK</option></select>
          <input type="number" value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value || '0', 10) }))} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary" />
          <label className="flex items-center gap-2 text-xs text-text-primary"><input type="checkbox" checked={form.kode_lot_wajib} onChange={(e) => setForm((p) => ({ ...p, kode_lot_wajib: e.target.checked }))} /> lot wajib</label>
          <button onClick={addItem} disabled={creating} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50">{creating ? 'Nyimpen...' : 'Tambah'}</button>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 shadow-theme-sm">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <h2 className="text-sm font-semibold text-text-primary">Daftar Station Items</h2>
          <div className="grid gap-2 md:grid-cols-2 xl:min-w-[520px]">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-text-muted"><Search size={14} /><input placeholder="Cari item / unit / station" value={query} onChange={(e) => setQuery(e.target.value)} className="w-full bg-transparent text-sm text-text-primary outline-none" /></div>
            <select value={stationFilter} onChange={(e) => setStationFilter(e.target.value as typeof stationFilter)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><option value="ALL">Semua Station</option><option value="NOODLE">NOODLE</option><option value="DIMSUM">DIMSUM</option><option value="BAR">BAR</option><option value="PRODUKSI">PRODUKSI</option></select>
          </div>
        </div>

        {isLoading && <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-muted">Bentar ya...</div>}
        {error && <div className="rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-3 text-sm text-error-600 dark:text-error-400">Waduh gagal muat station items.</div>}
        {!isLoading && !error && rows.length === 0 && <div className="rounded-lg border border-border bg-background px-3 py-3 text-sm text-text-muted">Belum ada item.</div>}

        {!isLoading && !error && rows.length > 0 && (
          <>
            <div className="space-y-3 md:hidden">
              {Object.entries(groupedRows).map(([station, items]) => (
                <div key={station} className="space-y-2">
                  <div className="rounded-lg border border-border bg-surface-alt px-3 py-2 text-xs font-semibold uppercase text-warning-600 dark:text-warning-400">{station}</div>
                  {items.map((item) => {
                    const isSaving = savingId === item.id
                    const isDeleting = deletingId === item.id
                    return (
                      <div key={item.id} className="rounded-xl border border-border bg-background p-3">
                        <div className="mb-3 grid gap-2">
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Nama Produk</label>
                            <input defaultValue={item.nama_produk} onBlur={(e) => { item.nama_produk = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Unit</label>
                              <select defaultValue={item.unit} onChange={(e) => { item.unit = e.target.value }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary"><option>PCS</option><option>PORSI</option><option>GRAM</option><option>PACK</option></select>
                            </div>
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Sort</label>
                              <input type="number" defaultValue={item.sort_order} onBlur={(e) => { item.sort_order = parseInt(e.target.value || '0', 10) }} className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-text-primary" />
                            </div>
                          </div>
                          <div className="text-xs text-text-muted">{item.kode_lot_wajib ? 'LOT WAJIB' : 'LOT OPSIONAL'}{item.is_manual ? ' • ITEM MANUAL' : ''}</div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => saveItem({ ...item })} disabled={isSaving || isDeleting} className="flex-1 rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10 px-3 py-2 text-xs font-semibold text-primary shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isSaving ? 'Nyimpen...' : 'Simpan'}</button>
                          <button onClick={() => setDeleting(item)} disabled={isSaving || isDeleting} className="flex-1 rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-2 text-xs font-semibold text-error-600 dark:text-error-400 shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isDeleting ? '...' : 'Hapus'}</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>

            <div className="hidden space-y-4 md:block">
              {Object.entries(groupedRows).map(([station, items]) => (
                <div key={station} className="overflow-x-auto rounded-lg border border-border">
                  <div className="border-b border-border bg-surface-alt px-3 py-2 text-xs font-semibold uppercase text-warning-600 dark:text-warning-400">{station}</div>
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-surface text-[11px] uppercase text-text-muted">
                      <tr>
                        <th className="px-3 py-3">Nama Produk</th>
                        <th className="px-3 py-3">Unit</th>
                        <th className="px-3 py-3">Sort</th>
                        <th className="px-3 py-3">Flags</th>
                        <th className="px-3 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const isSaving = savingId === item.id
                        const isDeleting = deletingId === item.id
                        return (
                          <tr key={item.id} className="border-t border-border bg-background">
                            <td className="px-3 py-3"><input defaultValue={item.nama_produk} onBlur={(e) => { item.nama_produk = e.target.value }} className="w-full rounded border border-border bg-surface px-2 py-1 text-text-primary" /></td>
                            <td className="px-3 py-3"><select defaultValue={item.unit} onChange={(e) => { item.unit = e.target.value }} className="rounded border border-border bg-surface px-2 py-1 text-text-primary"><option>PCS</option><option>PORSI</option><option>GRAM</option><option>PACK</option></select></td>
                            <td className="px-3 py-3"><input type="number" defaultValue={item.sort_order} onBlur={(e) => { item.sort_order = parseInt(e.target.value || '0', 10) }} className="w-20 rounded border border-border bg-surface px-2 py-1 text-text-primary" /></td>
                            <td className="px-3 py-3 text-xs text-text-muted">{item.kode_lot_wajib ? 'LOT' : '-'} {item.is_manual ? '• MANUAL' : ''}</td>
                            <td className="px-3 py-3"><div className="flex justify-end gap-2"><button onClick={() => saveItem({ ...item })} disabled={isSaving || isDeleting} className="rounded-lg border border-brand-200 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10 px-3 py-1.5 text-xs font-semibold text-primary shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isSaving ? 'Nyimpen...' : 'Simpan'}</button><button onClick={() => setDeleting(item)} disabled={isSaving || isDeleting} className="rounded-lg border border-error-200 bg-error-50 dark:border-error-500/20 dark:bg-error-500/10 px-3 py-1.5 text-xs font-semibold text-error-600 dark:text-error-400 shadow-theme-xs transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-theme-sm active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">{isDeleting ? '...' : 'Hapus'}</button></div></td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
