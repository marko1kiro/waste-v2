import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'wouter'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import { Shield, Users, Boxes, BarChart3, ArrowRight, UserCog, Store, Loader2, History } from 'lucide-react'

import type { DashboardData, TenantConfigData } from '@/lib/types'

interface PersonnelData { success: boolean; data: Array<unknown> }
interface ItemsData { success: boolean; data: Array<unknown> }
interface UsersData { success: boolean; data: Array<unknown> }

export default function AdminPanel() {
  const { data: dashboard } = useQuery<DashboardData>({ queryKey: ['dashboard-data'], queryFn: () => apiClient.fetch('/api/dashboard-data') })
  const { data: personnel } = useQuery<PersonnelData>({ queryKey: ['admin-personnel'], queryFn: () => apiClient.fetch('/api/admin/personnel') })
  const { data: items } = useQuery<ItemsData>({ queryKey: ['admin-station-items'], queryFn: () => apiClient.fetch('/api/admin/station-items') })
  const { data: users } = useQuery<UsersData>({ queryKey: ['admin-users'], queryFn: () => apiClient.fetch('/api/admin/users') })
  const { data: tenantData, refetch: refetchTenant } = useQuery<TenantConfigData>({ queryKey: ['tenant-config'], queryFn: () => apiClient.fetch('/api/admin/tenant-config') })

  const [storeForm, setStoreForm] = useState<{ store_name: string; store_code: string; qc_checklist_url: string } | null>(null)
  const [savingStore, setSavingStore] = useState(false)

  const currentConfig = tenantData?.data
  const editForm = storeForm || currentConfig || { store_name: '', store_code: '', qc_checklist_url: '' }

  async function saveStoreConfig() {
    setSavingStore(true)
    try {
      await apiClient.fetch('/api/admin/tenant-config', {
        method: 'PUT',
        body: JSON.stringify(editForm),
      })
      await refetchTenant()
      setStoreForm(null)
      toast.success('Config store udah kesimpen.')
    } catch (err) {
      toast.error('Waduh gagal simpen', err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSavingStore(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl py-2">
      <div className="mb-5 rounded-2xl border-2 border-border bg-gradient-to-br from-[#111] to-[#171a20] p-4 shadow-nb-md sm:p-5">
        <div className="flex items-start gap-3 sm:items-center">
          <div className="rounded-xl border-2 border-warning/30 bg-warning/10 p-3 text-warning"><Shield size={22} /></div>
          <div>
            <h1 className="text-xl font-black text-warning">Admin Panel</h1>
            <p className="text-xs leading-relaxed text-text-muted">Dashboard super admin. Modul terpisah, navigasi mobile-friendly.</p>
          </div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <Card label="Personnel" value={personnel?.data?.length || 0} icon={<Users size={16} />} />
        <Card label="Items" value={items?.data?.length || 0} icon={<Boxes size={16} />} />
        <Card label="Accounts" value={users?.data?.length || 0} icon={<UserCog size={16} />} />
        <Card label="Hari Data" value={dashboard?.summary?.totalDays || 0} icon={<BarChart3 size={16} />} />
        <Card label="Total Qty" value={dashboard?.summary?.totalQty || 0} icon={<BarChart3 size={16} />} />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <QuickLink href="/admin/personnel" title="Kelola Personnel" desc="QC, Manager, TTD" icon={<Users size={18} />} />
        <QuickLink href="/admin/station-items" title="Kelola Station Items" desc="Catalog item per station" icon={<Boxes size={18} />} />
        <QuickLink href="/admin/users" title="Kelola Akun Store" desc="Akun login store/admin" icon={<UserCog size={18} />} />
        <QuickLink href="/admin/history" title="History & Delete" desc="Lihat & hapus data per shift" icon={<History size={18} />} />
        <QuickLink href="/dashboard" title="Lihat Analytics" desc="Trend, top products, breakdown" icon={<BarChart3 size={18} />} />
      </div>

      <section className="mt-5 rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-sm">
        <div className="mb-3 flex items-center gap-2">
          <Store size={16} className="text-warning" />
          <h2 className="text-sm font-black text-text-primary">Config Store</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">Kode Store</label>
            <input value={editForm.store_code} onChange={(e) => setStoreForm({ ...editForm, store_code: e.target.value })} className="w-full rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary" placeholder="CKRBUL" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">Nama Store</label>
            <input value={editForm.store_name} onChange={(e) => setStoreForm({ ...editForm, store_name: e.target.value })} className="w-full rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary" placeholder="BEKASI KP. BULU" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">URL QC Checklist</label>
            <input value={editForm.qc_checklist_url} onChange={(e) => setStoreForm({ ...editForm, qc_checklist_url: e.target.value })} className="w-full rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary" placeholder="https://drive.google.com/..." />
          </div>
        </div>
        <button onClick={saveStoreConfig} disabled={savingStore} className="mt-3 rounded-lg border-2 border-[#000] bg-warning px-4 py-2 text-sm font-black text-black shadow-nb-sm transition-all hover:-translate-x-px hover:-translate-y-px hover:shadow-nb-md active:translate-x-0 active:translate-y-0 active:shadow-none disabled:opacity-50">
          {savingStore ? <Loader2 size={14} className="inline animate-spin" /> : 'Simpan'}
        </button>
      </section>

      <section className="mt-5 rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-sm">
        <h2 className="mb-3 text-sm font-black text-text-primary">Entry Terakhir</h2>
        {dashboard?.lastEntry ? (
          <div className="grid gap-2 text-sm text-text-muted sm:grid-cols-2">
            <p><span className="text-text-primary">Tanggal:</span> {dashboard.lastEntry.date}</p>
            <p><span className="text-text-primary">Station:</span> {dashboard.lastEntry.station}</p>
            <p><span className="text-text-primary">Shift:</span> {dashboard.lastEntry.shift}</p>
            <p><span className="text-text-primary">QC:</span> {dashboard.lastEntry.qc || '-'}</p>
          </div>
        ) : <p className="text-sm text-text-muted">Belum ada data.</p>}
      </section>
    </div>
  )
}

function Card({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-sm">
      <div className="mb-2 flex items-center gap-2 text-warning">{icon}<span className="text-[10px] font-black uppercase tracking-widest text-[#555]">{label}</span></div>
      <div className="text-2xl font-black text-text-primary">{value}</div>
    </div>
  )
}

function QuickLink({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-sm transition hover:-translate-x-px hover:-translate-y-px hover:border-warning active:translate-y-[1px]">
      <div className="mb-3 flex items-center justify-between text-warning">{icon}<ArrowRight size={16} /></div>
      <div className="mb-1 text-sm font-black text-text-primary">{title}</div>
      <div className="text-xs leading-relaxed text-text-muted">{desc}</div>
    </Link>
  )
}
