import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'wouter'
import { apiClient } from '@/lib/api-client'
import { Shield, Users, Boxes, BarChart3, ArrowRight, UserCog, Store, History, Building2, ChevronDown } from 'lucide-react'

import type { AdminStatsData, AdminStoreStat } from '@/lib/types'

interface PersonnelData { success: boolean; data: Array<{ id: number; name: string; full_name: string; role: string; status: string }> }
interface ItemsData { success: boolean; data: Array<{ id: number; station: string; nama_produk: string; unit: string; status: string }> }
interface UsersData { success: boolean; data: Array<{ id: number; username: string; display_name: string; role: string; status: string; store_code?: string }> }

export default function AdminPanel() {
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStatsData>({
    queryKey: ['admin-stats'],
    queryFn: () => apiClient.fetch('/api/admin/stats'),
  })

  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null)

  const { data: personnel } = useQuery<PersonnelData>({
    queryKey: ['admin-personnel', selectedStoreId],
    queryFn: () => apiClient.fetch(`/api/admin/personnel?store_id=${selectedStoreId}`),
    enabled: selectedStoreId !== null,
  })

  const { data: items } = useQuery<ItemsData>({
    queryKey: ['admin-station-items', selectedStoreId],
    queryFn: () => apiClient.fetch(`/api/admin/station-items?store_id=${selectedStoreId}`),
    enabled: selectedStoreId !== null,
  })

  const { data: users } = useQuery<UsersData>({
    queryKey: ['admin-users', selectedStoreId],
    queryFn: () => apiClient.fetch(`/api/admin/users?store_id=${selectedStoreId}`),
    enabled: selectedStoreId !== null,
  })

  const restos = stats?.restos || []
  const totals = stats?.totals
  const selectedResto = selectedStoreId !== null ? restos.find((r) => r.id === selectedStoreId) : null

  return (
    <div className="mx-auto max-w-6xl py-2">
      <div className="mb-5 rounded-2xl border border-border bg-surface p-4 shadow-theme-sm sm:p-5">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-warning-600 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400"><Shield size={22} /></div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Admin Panel</h1>
            <p className="text-xs leading-relaxed text-text-muted">Dashboard super admin — multi-resto overview.</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      {totals && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <Card label="Resto Aktif" value={totals.restos} icon={<Building2 size={16} />} />
          <Card label="Personnel" value={totals.personnel} icon={<Users size={16} />} />
          <Card label="Items" value={totals.items} icon={<Boxes size={16} />} />
          <Card label="Akun" value={totals.users} icon={<UserCog size={16} />} />
          <Card label="Entri 30 Hari" value={totals.entries_30d} icon={<BarChart3 size={16} />} />
        </div>
      )}

      {statsLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-text-muted">
          <Store size={18} className="animate-pulse" />
          <span className="text-sm">Memuat data...</span>
        </div>
      )}

      {/* Resto Filter */}
      {!statsLoading && restos.length > 0 && (
        <div className="mb-5 rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
          <div className="mb-3 flex items-center gap-2">
            <Store size={16} className="text-brand-500 dark:text-brand-400" />
            <h2 className="text-sm font-semibold text-text-primary">Filter Resto</h2>
          </div>
          <div className="relative">
            <select
              value={selectedStoreId ?? ''}
              onChange={(e) => {
                const val = e.target.value
                setSelectedStoreId(val === '' ? null : Number(val))
              }}
              className="w-full appearance-none rounded-lg border border-border bg-background px-3 py-2 pr-8 text-sm text-text-primary outline-none focus:border-brand-500"
            >
              <option value="">Semua Resto (Overview)</option>
              {restos.map((r) => (
                <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
          </div>
        </div>
      )}

      {/* View: Semua Resto (Overview Grid) */}
      {!statsLoading && selectedStoreId === null && restos.length > 0 && (
        <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {restos.map((row) => (
            <RestoCard key={row.id} row={row} onSelect={setSelectedStoreId} />
          ))}
        </div>
      )}

      {/* View: Resto Dipilih (Detail) */}
      {selectedStoreId !== null && selectedResto && (
        <div className="mb-5 space-y-4">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text-primary">{selectedResto.name}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${selectedResto.status === 'active' ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400' : 'border-gray-200 bg-surface-alt text-gray-500 dark:border-gray-700 dark:bg-gray-900'}`}>
                    {selectedResto.status === 'active' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
                <p className="mt-0.5 font-mono text-xs text-text-muted">{selectedResto.code} &bull; {selectedResto.drive_account === 'legacy' ? 'Drive legacy' : 'Drive netral'}</p>
              </div>
              <button onClick={() => setSelectedStoreId(null)} className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-muted transition hover:bg-surface-alt hover:text-text-primary">
                Kembali
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-text-muted">
              <span>{selectedResto.personnel_count} personnel</span>
              <span>{selectedResto.item_count} items</span>
              <span>{selectedResto.user_count} akun</span>
              <span>{selectedResto.entries_30d} entri (30 hari)</span>
              {selectedResto.last_entry_date && <span>Terakhir: {selectedResto.last_entry_date}</span>}
            </div>
          </div>

          {/* Personnel */}
          <DetailSection title="Personnel" count={personnel?.data?.length}>
            {personnel?.data?.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-text-primary">{p.name}</span>
                  <span className="ml-2 text-xs text-text-muted">{p.full_name}</span>
                </div>
                <span className="text-xs text-text-muted">{p.role}</span>
              </div>
            ))}
          </DetailSection>

          {/* Items */}
          <DetailSection title="Station Items" count={items?.data?.length}>
            {items?.data?.map((it) => (
              <div key={it.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-text-primary">{it.nama_produk}</span>
                  <span className="ml-2 text-xs text-text-muted">{it.unit}</span>
                </div>
                <span className="text-xs text-text-muted">{it.station}</span>
              </div>
            ))}
          </DetailSection>

          {/* Users */}
          <DetailSection title="Akun" count={users?.data?.length}>
            {users?.data?.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-text-primary">{u.display_name}</span>
                  <span className="ml-2 text-xs text-text-muted">@{u.username}</span>
                </div>
                <span className="text-xs text-text-muted">{u.role}</span>
              </div>
            ))}
          </DetailSection>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QuickLink href="/admin/restos" title="Kelola Resto" desc="Tambah & atur resto baru" icon={<Building2 size={18} />} />
        <QuickLink href="/admin/personnel" title="Kelola Personnel" desc="QC, Manager, TTD" icon={<Users size={18} />} />
        <QuickLink href="/admin/users" title="Kelola Akun Store" desc="Akun login store/admin" icon={<UserCog size={18} />} />
        <QuickLink href="/admin/history" title="History & Delete" desc="Lihat & hapus data per shift" icon={<History size={18} />} />
      </div>
    </div>
  )
}

function Card({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
      <div className="mb-2 flex items-center gap-2 text-brand-500 dark:text-brand-400">{icon}<span className="text-[10px] font-semibold uppercase text-text-muted">{label}</span></div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
    </div>
  )
}

function RestoCard({ row, onSelect }: { row: AdminStoreStat; onSelect: (id: number) => void }) {
  return (
    <button
      onClick={() => onSelect(row.id)}
      className="rounded-xl border border-border bg-surface p-4 text-left shadow-theme-xs transition hover:shadow-theme-md hover:border-brand-200 dark:hover:border-brand-500/30"
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{row.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${row.status === 'active' ? 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/20 dark:bg-success-500/10 dark:text-success-400' : 'border-gray-200 bg-surface-alt text-gray-500 dark:border-gray-700 dark:bg-gray-900'}`}>
              {row.status === 'active' ? 'Aktif' : 'Nonaktif'}
            </span>
          </div>
          <p className="mt-0.5 font-mono text-xs text-text-muted">{row.code}</p>
        </div>
        <ArrowRight size={14} className="text-brand-500 dark:text-brand-400" />
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-text-muted">
        <span>{row.personnel_count} personnel</span>
        <span>{row.item_count} items</span>
        <span>{row.user_count} akun</span>
        <span>{row.entries_30d} entri</span>
      </div>
      {row.last_entry_date && <p className="mt-2 text-[10px] text-text-muted">Entri terakhir: {row.last_entry_date}</p>}
    </button>
  )
}

function DetailSection({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {count !== undefined && <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-medium text-text-muted">{count}</span>}
      </div>
      {count === 0 || (count === undefined && !children) ? (
        <p className="text-xs text-text-muted">Belum ada data.</p>
      ) : (
        <div className="max-h-60 space-y-1.5 overflow-y-auto">{children}</div>
      )}
    </div>
  )
}

function QuickLink({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs transition hover:shadow-theme-md hover:border-brand-200 dark:hover:border-brand-500/30">
      <div className="mb-3 flex items-center justify-between text-brand-500 dark:text-brand-400">{icon}<ArrowRight size={16} /></div>
      <div className="mb-1 text-sm font-semibold text-text-primary">{title}</div>
      <div className="text-xs leading-relaxed text-text-muted">{desc}</div>
    </Link>
  )
}
