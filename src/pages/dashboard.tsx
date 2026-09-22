import { useEffect, useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { DashboardData } from '@/lib/types'
import { CardSkeleton, Skeleton, ChartSkeleton } from '@/components/ui/loading-spinner'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { ChevronDown, Pencil, Trash2, Plus, Check, X, Loader2, CalendarDays, Layers, Scale, Activity } from 'lucide-react'
import { STATION_UI } from '@shared/station-ui'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { getBusinessDateWIB } from '@shared/timezone'

interface ItemRow {
  id: number
  business_date: string
  shift: string
  kategori_induk: string
  nama_produk: string
  kode_produk: string
  jumlah_produk: number
  unit: string
  metode_pemusnahan: string
  alasan_pemusnahan: string
  jam_tanggal_pemusnahan: string
  paraf_qc_name: string
  paraf_manager_name: string
  submitted_by: string
  created_at: string
}

interface EditForm {
  nama_produk: string
  kode_produk: string
  jumlah_produk: number
  unit: string
  metode_pemusnahan: string
  alasan_pemusnahan: string
  jam_tanggal_pemusnahan: string
}

interface AddForm extends EditForm {
  shift: string
  kategori_induk: string
}

const RANGE_OPTIONS = [7, 14, 30, 9999] as const
const STATION_COLORS: Record<string, string> = {
  NOODLE: STATION_UI.NOODLE.accent,
  DIMSUM: STATION_UI.DIMSUM.accent,
  BAR: STATION_UI.BAR.accent,
  PRODUKSI: STATION_UI.PRODUKSI.accent,
}
const SHIFT_COLORS = ['#465fff', '#12b76a', '#f79009', '#7a5af8']

const CHART_TICK = { fill: '#98a2b3', fontSize: 11 }
const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'rgb(var(--surface))',
  border: '1px solid rgb(var(--border))',
  borderRadius: 8,
  color: 'rgb(var(--text-primary))',
  fontSize: 12,
}

export default function Dashboard() {
  const { user } = useAuth()

  // Semua hooks WAJIB di atas early return (Rules of Hooks).
  // Query di-disable untuk admin_store karena komponen ini return lebih awal.
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>(30)

  const { data, isLoading, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard-data'],
    queryFn: () => apiClient.fetch<DashboardData>('/api/dashboard-data'),
    enabled: user?.role !== 'admin_store',
  })

  const filteredDaily = useMemo(() => {
    if (!data?.dailyData) return []
    if (range === 9999) return data.dailyData
    return data.dailyData.slice(0, range).reverse()
  }, [data, range])

  const stationChartData = useMemo(() => {
    if (!data?.stationTotals) return []
    return Object.entries(data.stationTotals).map(([name, qty]) => ({ name, qty }))
  }, [data])

  const shiftChartData = useMemo(() => {
    if (!data?.shiftTotals) return []
    return Object.entries(data.shiftTotals).map(([name, value]) => ({ name, value }))
  }, [data])

  if (user?.role === 'admin_store') return <DashboardHistory />

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl py-2">
        <div className="anim-enter mb-5 rounded-2xl border border-border bg-surface p-5 shadow-theme-xs">
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8"><ChartSkeleton /></div>
          <div className="xl:col-span-4"><ChartSkeleton /></div>
          <div className="xl:col-span-7"><ChartSkeleton /></div>
          <div className="xl:col-span-5"><ChartSkeleton /></div>
        </div>
      </div>
    )
  }

  if (!data?.success) {
    return (
      <div className="mx-auto max-w-4xl py-4">
        <p className="text-sm text-error-600 dark:text-error-400">Waduh, gagal muat dashboard.</p>
        <button onClick={() => refetch()} className="mt-3 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-alt">Coba Lagi</button>
      </div>
    )
  }

  if (data.summary.totalItems === 0) {
    return (
      <div className="mx-auto max-w-4xl py-4">
        <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-theme-xs">
          <h1 className="mb-2 text-xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-muted">Belum ada data waste. Submit data dulu dari Input Waste ya.</p>
        </div>
      </div>
    )
  }

  const activeQCs = Array.from(new Set(filteredDaily.flatMap(() => (data.lastEntry?.qc ? [data.lastEntry.qc] : []))))

  // Delta 7 hari terakhir vs 7 hari sebelumnya (dailyData urut terbaru dulu)
  const qtyDelta = (() => {
    const dd = data?.dailyData
    if (!dd || dd.length < 14) return null
    const sum = (arr: { qty: number }[]) => arr.reduce((a, b) => a + (b.qty || 0), 0)
    const recent = sum(dd.slice(0, 7))
    const prev = sum(dd.slice(7, 14))
    if (prev === 0) return recent > 0 ? 100 : null
    return Math.round(((recent - prev) / prev) * 100)
  })()

  return (
    <div className="mx-auto w-full max-w-7xl py-2">
      {/* Header */}
      <div className="anim-enter mb-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-theme-xs">
        <div className="h-1 bg-gradient-to-r from-brand-500 via-brand-400 to-success-500" />
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text-primary lg:text-2xl">Dashboard</h1>
            <p className="mt-1 text-xs text-text-muted lg:text-sm">Pantau tren waste harian & breakdown station.</p>
            {data.lastEntry && (
              <p className="mt-2 text-xs text-text-muted">
                Entry terakhir: <span className="font-medium text-text-primary">{data.lastEntry.date}</span> • <span className="font-medium text-text-primary">{data.lastEntry.station}</span> • <span className="font-medium text-text-primary">{data.lastEntry.shift}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 lg:items-end">
            <div className="flex flex-wrap gap-2">
              {activeQCs.length > 0 ? activeQCs.map((qc) => (
                <span key={qc} className="rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-[11px] font-medium text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">QC: {qc}</span>
              )) : <span className="rounded-full border border-border px-3 py-1 text-[11px] text-text-muted">Belum ada QC aktif</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              {RANGE_OPTIONS.map((r) => (
                <button key={r} onClick={() => setRange(r)} className={`btn-press rounded-lg border px-3 py-2 text-xs font-semibold transition ${range === r ? 'border-brand-500 bg-brand-500 text-white shadow-theme-xs' : 'border-border bg-surface text-text-muted hover:border-brand-300 hover:text-text-primary'}`}>
                  {r === 9999 ? 'ALL' : `${r}H`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
        <StatCard label="Total Hari" value={data.summary.totalDays} icon={CalendarDays}
          iconCls="bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"
          barCls="from-brand-500 to-brand-300" delay={0} />
        <StatCard label="Total Item" value={data.summary.totalItems} icon={Layers}
          iconCls="bg-warning-50 text-warning-600 dark:bg-warning-500/10 dark:text-warning-400"
          barCls="from-warning-500 to-warning-300" delay={70} />
        <StatCard label="Total Qty" value={data.summary.totalQty} icon={Scale}
          iconCls="bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400"
          barCls="from-success-500 to-success-300" delay={140} delta={qtyDelta} deltaHint="vs 7 hari lalu" />
        <StatCard label="Avg Qty/Hari" value={data.summary.avgQtyPerDay} icon={Activity}
          iconCls="bg-[#f4f0ff] text-[#7a5af8] dark:bg-[#7a5af8]/10 dark:text-[#a48afb]"
          barCls="from-[#7a5af8] to-[#b8a6fb]" delay={210} />
      </div>

      {/* Charts: 12-kolom di desktop */}
      <div className="grid gap-4 xl:grid-cols-12">
        <div className="anim-enter xl:col-span-8" style={{ animationDelay: '120ms' }}>
          <Section title="Tren Harian" defaultOpen>
            <div className="h-[260px] xl:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredDaily}>
                  <XAxis dataKey="date" tick={CHART_TICK} />
                  <YAxis tick={CHART_TICK} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  <Area type="monotone" dataKey="qty" stroke="#465fff" fill="rgba(70,95,255,0.18)" strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <div className="anim-enter xl:col-span-4" style={{ animationDelay: '180ms' }}>
          <Section title="Per Shift" defaultOpen>
            <div className="h-[260px] xl:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={shiftChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={3}>
                    {shiftChartData.map((entry, idx) => <Cell key={entry.name} fill={SHIFT_COLORS[idx % SHIFT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {shiftChartData.map((entry, idx) => (
                <span key={entry.name} className="flex items-center gap-1.5 text-[11px] text-text-muted">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: SHIFT_COLORS[idx % SHIFT_COLORS.length] }} />
                  {entry.name}
                </span>
              ))}
            </div>
          </Section>
        </div>

        <div className="anim-enter xl:col-span-7" style={{ animationDelay: '240ms' }}>
          <Section title="Per Station" defaultOpen>
            <div className="h-[260px] xl:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stationChartData}>
                  <XAxis dataKey="name" tick={CHART_TICK} />
                  <YAxis tick={CHART_TICK} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={{ fill: 'rgb(var(--surface-alt))', opacity: 0.5 }} />
                  <Bar dataKey="qty" radius={[8, 8, 0, 0]}>
                    {stationChartData.map((entry) => <Cell key={entry.name} fill={STATION_COLORS[entry.name] || '#465fff'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
        </div>

        <div className="anim-enter xl:col-span-5" style={{ animationDelay: '300ms' }}>
          <Section title="Top Produk" defaultOpen>
            <div className="max-h-[300px] space-y-3 overflow-y-auto pr-1">
              {data.topProducts.slice(0, 10).map((p, i) => {
                const maxQty = data.topProducts[0]?.qty || 1
                const pct = (p.qty / maxQty) * 100
                return (
                  <div key={p.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="truncate text-text-muted"><span className="mr-2 font-semibold text-text-dim">{i + 1}.</span>{p.name}</span>
                      <span className="ml-2 shrink-0 font-bold text-text-primary">{p.qty}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-alt"><div className="h-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-300 transition-all duration-700" style={{ width: `${pct}%` }} /></div>
                  </div>
                )
              })}
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}


function StatCard({ label, value, icon: Icon, iconCls, barCls, delay = 0, delta = null, deltaHint = '' }: {
  label: string
  value: number
  icon: typeof CalendarDays
  iconCls: string
  barCls: string
  delay?: number
  delta?: number | null
  deltaHint?: string
}) {
  return (
    <div className="anim-enter hover-lift relative overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-theme-xs" style={{ animationDelay: `${delay}ms` }}>
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${barCls}`} />
      <div className="flex items-start justify-between gap-2">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconCls}`}>
          <Icon size={20} strokeWidth={2.25} />
        </div>
        {delta !== null && (
          <span title={deltaHint} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${delta >= 0 ? 'bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-400' : 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <AnimatedNumber value={value} />
    </div>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let frame = 0
    const start = performance.now()
    const duration = 700

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      setDisplayValue(Math.round(value * progress))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <span className="text-2xl font-semibold tabular-nums text-text-primary">{displayValue}</span>
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
      <button onClick={() => setOpen((v) => !v)} className="mb-2 flex w-full items-center justify-between text-left">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <ChevronDown size={16} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && children}
    </section>
  )
}

const SHIFT_ORDER = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'] as const
const UNITS = ['PORSI', 'PCS', 'GRAM', 'PACK'] as const
const METODE_LIST = ['DIBUANG', 'DIMUSNAHKAN', 'DIBERIKAN KE PIHAK KETIGA'] as const
const ALASAN_LIST = ['EXPIRED', 'RUSAK', 'OVER PRODUKSI', 'SALAH PRODUKSI', 'TESTER'] as const

export function DashboardHistory() {
  const [selectedDate, setSelectedDate] = useState(getBusinessDateWIB())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [addingFor, setAddingFor] = useState<{ shift: string; station: string } | null>(null)
  const [addForm, setAddForm] = useState<AddForm | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ success: boolean; data: ItemRow[] }>({
    queryKey: ['items', selectedDate],
    queryFn: () => apiClient.fetch(`/api/items?date=${selectedDate}`),
    enabled: !!selectedDate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: number; form: EditForm }) =>
      apiClient.fetch(`/api/items?id=${id}`, { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success('Item udah diupdate.')
      setEditingId(null)
      setEditForm(null)
      qc.invalidateQueries({ queryKey: ['items', selectedDate] })
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
    },
    onError: (err) => toast.error('Waduh gagal update', err instanceof Error ? err.message : 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.fetch(`/api/items?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Item udah dihapus.')
      setConfirmDeleteId(null)
      qc.invalidateQueries({ queryKey: ['items', selectedDate] })
      qc.invalidateQueries({ queryKey: ['shift-status'] })
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
    },
    onError: (err) => toast.error('Waduh gagal hapus', err instanceof Error ? err.message : 'Error'),
  })

  const addMutation = useMutation({
    mutationFn: (form: AddForm & { business_date: string }) =>
      apiClient.fetch('/api/items', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success('Item udah ditambahin.')
      setAddingFor(null)
      setAddForm(null)
      qc.invalidateQueries({ queryKey: ['items', selectedDate] })
      qc.invalidateQueries({ queryKey: ['shift-status'] })
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
    },
    onError: (err) => toast.error('Waduh gagal tambah', err instanceof Error ? err.message : 'Error'),
  })

  const items = data?.data || []

  const grouped = items.reduce<Record<string, Record<string, ItemRow[]>>>((acc, item) => {
    if (!acc[item.shift]) acc[item.shift] = {}
    if (!acc[item.shift][item.kategori_induk]) acc[item.shift][item.kategori_induk] = []
    acc[item.shift][item.kategori_induk].push(item)
    return acc
  }, {})

  function startEdit(item: ItemRow) {
    setEditingId(item.id)
    setEditForm({
      nama_produk: item.nama_produk,
      kode_produk: item.kode_produk,
      jumlah_produk: item.jumlah_produk,
      unit: item.unit,
      metode_pemusnahan: item.metode_pemusnahan,
      alasan_pemusnahan: item.alasan_pemusnahan,
      jam_tanggal_pemusnahan: item.jam_tanggal_pemusnahan,
    })
  }

  function startAdd(shift: string, station: string) {
    setAddingFor({ shift, station })
    setAddForm({
      shift,
      kategori_induk: station,
      nama_produk: '',
      kode_produk: '',
      jumlah_produk: 1,
      unit: 'PCS',
      metode_pemusnahan: 'DIBUANG',
      alasan_pemusnahan: 'EXPIRED',
      jam_tanggal_pemusnahan: '',
    })
  }

  const inputCls = 'w-full rounded border border-border bg-background px-2 py-1 text-xs text-text-primary focus:border-brand-500 focus:outline-none'
  const selectCls = 'w-full rounded border border-border bg-background px-2 py-1 text-xs text-text-primary focus:border-brand-500 focus:outline-none'

  return (
    <div className="mx-auto max-w-5xl py-2">
      <div className="mb-4 flex items-center gap-3">
        <CalendarDays size={18} className="text-primary" />
        <h1 className="text-lg font-semibold text-text-primary">History Input</h1>
      </div>

      <div className="mb-4 rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
        <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Pilih Tanggal</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:border-brand-500"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Bentar ya...</span>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-border bg-surface p-6 text-center shadow-theme-xs">
          <p className="text-sm text-text-muted">Ga ada data buat tanggal <strong className="text-text-primary">{selectedDate}</strong>.</p>
        </div>
      )}

      {!isLoading && SHIFT_ORDER.map((shift) => {
        const stationMap = grouped[shift]
        if (!stationMap) return null
        return (
          <div key={shift} className="mb-4 rounded-xl border border-border bg-surface shadow-theme-xs">
            <div className="flex items-center gap-2 border-b border-border bg-surface-alt px-4 py-2.5 rounded-t-xl">
              <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">{shift}</span>
            </div>
            <div className="divide-y divide-border">
              {Object.entries(stationMap).map(([station, rows]) => (
                <div key={station} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-text-primary">{station}</span>
                      <span className="rounded-full bg-surface-alt px-2 py-0.5 text-[10px] text-text-muted">{rows.length} item</span>
                      <span className="text-[10px] text-text-dim">by {rows[0]?.submitted_by || '-'}</span>
                    </div>
                  </div>

                    <div className="overflow-x-auto">
                     <table className="min-w-[860px] w-full table-fixed text-[11px]">
                       <colgroup>
                         <col className="w-[24%]" />
                         <col className="w-[100px]" />
                         <col className="w-[80px]" />
                         <col className="w-[185px]" />
                         <col className="w-[170px]" />
                         <col className="w-[130px]" />
                         <col className="w-[68px]" />
                       </colgroup>
                       <thead className="lg:sticky lg:top-0 lg:z-10 lg:bg-surface">
                         <tr className="text-left text-[10px] uppercase text-text-muted">
                           <th className="pb-1 pr-2">Nama Produk</th>
                           <th className="pb-1 pr-2 text-center">Qty</th>
                           <th className="pb-1 pr-2">Unit</th>
                           <th className="pb-1 pr-2">Metode</th>
                           <th className="pb-1 pr-2">Alasan</th>
                           <th className="pb-1 pr-2">Jam</th>
                           <th className="pb-1"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {rows.map((item) => (
                          editingId === item.id && editForm ? (
                            <tr key={item.id} className="bg-brand-50/60 dark:bg-brand-500/5">
                              <td className="py-1.5 pr-2"><input value={editForm.nama_produk} onChange={(e) => setEditForm({ ...editForm, nama_produk: e.target.value })} className={inputCls} /></td>
                              <td className="py-1.5 pr-2"><input type="number" min={1} value={editForm.jumlah_produk} onChange={(e) => setEditForm({ ...editForm, jumlah_produk: Number(e.target.value) })} className={inputCls + ' text-center'} /></td>
                              <td className="py-1.5 pr-2">
                                <select value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className={selectCls}>
                                  {UNITS.map(u => <option key={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="py-1.5 pr-2">
                                <select value={editForm.metode_pemusnahan} onChange={(e) => setEditForm({ ...editForm, metode_pemusnahan: e.target.value })} className={selectCls}>
                                  {METODE_LIST.map(m => <option key={m}>{m}</option>)}
                                </select>
                              </td>
                              <td className="py-1.5 pr-2">
                                <select value={editForm.alasan_pemusnahan} onChange={(e) => setEditForm({ ...editForm, alasan_pemusnahan: e.target.value })} className={selectCls}>
                                  {ALASAN_LIST.map(r => <option key={r}>{r}</option>)}
                                </select>
                              </td>
                              <td className="py-1.5 pr-2"><input value={editForm.jam_tanggal_pemusnahan} onChange={(e) => setEditForm({ ...editForm, jam_tanggal_pemusnahan: e.target.value })} className={inputCls} /></td>
                              <td className="py-1.5">
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => updateMutation.mutate({ id: item.id, form: editForm })} disabled={updateMutation.isPending} className="rounded bg-success-50 p-1 text-success-600 hover:bg-success-100 dark:bg-success-500/10 dark:text-success-400 dark:hover:bg-success-500/20 disabled:opacity-40"><Check size={12} /></button>
                                  <button type="button" onClick={() => { setEditingId(null); setEditForm(null) }} className="rounded bg-surface-alt p-1 text-text-muted hover:text-text-primary"><X size={12} /></button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={item.id} className="hover:bg-white/[0.02]">
                              <td className="py-1.5 pr-2 font-medium text-text-primary">{item.nama_produk}</td>
                              <td className="py-1.5 pr-2 text-center text-text-primary">{item.jumlah_produk}</td>
                              <td className="py-1.5 pr-2 text-text-muted">{item.unit}</td>
                              <td className="py-1.5 pr-2 text-text-muted">{item.metode_pemusnahan}</td>
                              <td className="py-1.5 pr-2 text-text-muted">{item.alasan_pemusnahan}</td>
                              <td className="py-1.5 pr-2 text-text-muted">{item.jam_tanggal_pemusnahan || '-'}</td>
                              <td className="py-1.5">
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => startEdit(item)} className="rounded bg-brand-50 p-1 text-brand-600 hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:hover:bg-brand-500/20"><Pencil size={11} /></button>
                                  <button type="button" onClick={() => setConfirmDeleteId(item.id)} className="rounded bg-error-50 p-1 text-error-600 hover:bg-error-100 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"><Trash2 size={11} /></button>
                                </div>
                              </td>
                            </tr>
                          )
                        ))}

                        {addingFor?.shift === shift && addingFor?.station === station && addForm && (
                          <tr className="bg-success-50/60 dark:bg-success-500/5">
                            <td className="py-1.5 pr-2"><input placeholder="Nama produk" value={addForm.nama_produk} onChange={(e) => setAddForm({ ...addForm, nama_produk: e.target.value })} className={inputCls} /></td>
                            <td className="py-1.5 pr-2"><input type="number" min={1} value={addForm.jumlah_produk} onChange={(e) => setAddForm({ ...addForm, jumlah_produk: Number(e.target.value) })} className={inputCls + ' text-center'} /></td>
                            <td className="py-1.5 pr-2">
                              <select value={addForm.unit} onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })} className={selectCls}>
                                {UNITS.map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <select value={addForm.metode_pemusnahan} onChange={(e) => setAddForm({ ...addForm, metode_pemusnahan: e.target.value })} className={selectCls}>
                                {METODE_LIST.map(m => <option key={m}>{m}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <select value={addForm.alasan_pemusnahan} onChange={(e) => setAddForm({ ...addForm, alasan_pemusnahan: e.target.value })} className={selectCls}>
                                {ALASAN_LIST.map(r => <option key={r}>{r}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2"><input placeholder="Jam" value={addForm.jam_tanggal_pemusnahan} onChange={(e) => setAddForm({ ...addForm, jam_tanggal_pemusnahan: e.target.value })} className={inputCls} /></td>
                            <td className="py-1.5">
                              <div className="flex gap-1">
                                <button type="button" onClick={() => addMutation.mutate({ ...addForm, business_date: selectedDate })} disabled={!addForm.nama_produk || addForm.jumlah_produk < 1 || addMutation.isPending} className="rounded bg-success-50 p-1 text-success-600 hover:bg-success-100 dark:bg-success-500/10 dark:text-success-400 dark:hover:bg-success-500/20 disabled:opacity-40"><Check size={12} /></button>
                                <button type="button" onClick={() => { setAddingFor(null); setAddForm(null) }} className="rounded bg-surface-alt p-1 text-text-muted hover:text-text-primary"><X size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {(!addingFor || addingFor.shift !== shift || addingFor.station !== station) && (
                    <button type="button" onClick={() => startAdd(shift, station)} className="mt-2 flex items-center gap-1 text-[11px] text-text-dim hover:text-primary">
                      <Plus size={11} /> Tambah item ke {station}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Hapus Item"
        description="Yakin hapus item ini? Kalo ini item terakhir di shift itu, status shift bakal direset."
        confirmLabel="Gas Hapus"
        onConfirm={() => { if (confirmDeleteId !== null) deleteMutation.mutate(confirmDeleteId) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
