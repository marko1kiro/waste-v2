import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/hooks/use-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { History, Trash2, Loader2, ChevronLeft, ArrowRightLeft } from 'lucide-react'
import { Link } from 'wouter'
import { getBusinessDateWIB } from '@shared/timezone'

interface ShiftRecord {
  shift: string
  item_count: number
  submitted_by: string
  created_at: string
  stations: string[]
}

interface HistoryResponse {
  success: boolean
  data: ShiftRecord[]
}

const SHIFT_ORDER = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT']

function shiftColor(shift: string) {
  switch (shift) {
    case 'OPENING': return 'text-warning border-warning/30 bg-warning/10'
    case 'MIDDLE': return 'text-blue-400 border-blue-400/30 bg-blue-400/10'
    case 'CLOSING': return 'text-purple-400 border-purple-400/30 bg-purple-400/10'
    case 'MIDNIGHT': return 'text-text-muted border-border bg-[#0d0d0d]'
    default: return 'text-text-muted border-border bg-[#0d0d0d]'
  }
}

export default function AdminHistory() {
  const [date, setDate] = useState(getBusinessDateWIB())
  const [confirmShift, setConfirmShift] = useState<string | null>(null)
  const [confirmChange, setConfirmChange] = useState<{ from: string; to: string } | null>(null)
  const [shiftTargets, setShiftTargets] = useState<Record<string, string>>({})
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery<HistoryResponse>({
    queryKey: ['admin-history', date],
    queryFn: () => apiClient.fetch(`/api/admin/history?date=${date}`),
    enabled: !!date,
  })

  const deleteMutation = useMutation({
    mutationFn: (shift: string) =>
      apiClient.fetch(`/api/admin/history?date=${date}&shift=${shift}`, { method: 'DELETE' }),
    onSuccess: (_res, shift) => {
      toast.success('Mantap', `Data shift ${shift} tanggal ${date} udah dihapus.`)
      qc.invalidateQueries({ queryKey: ['admin-history', date] })
      qc.invalidateQueries({ queryKey: ['shift-status'] })
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
      refetch()
    },
    onError: (err) => {
      toast.error('Waduh gagal hapus', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const changeMutation = useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      apiClient.fetch(`/api/admin/history?date=${date}&from=${from}&to=${to}`, { method: 'PUT' }),
    onSuccess: (_res, { from, to }) => {
      toast.success('Shift diganti', `${from} → ${to} tanggal ${date}`)
      setShiftTargets({})
      qc.invalidateQueries({ queryKey: ['admin-history', date] })
      qc.invalidateQueries({ queryKey: ['shift-status'] })
      qc.invalidateQueries({ queryKey: ['dashboard-data'] })
      refetch()
    },
    onError: (err) => {
      toast.error('Gagal ganti shift', err instanceof Error ? err.message : 'Unknown error')
    },
  })

  const records = (data?.data || []).sort(
    (a, b) => SHIFT_ORDER.indexOf(a.shift) - SHIFT_ORDER.indexOf(b.shift)
  )

  return (
    <div className="mx-auto max-w-2xl py-2">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/" className="rounded-lg border-2 border-border bg-[#111] p-2 text-text-muted shadow-nb-sm transition hover:border-warning hover:text-warning">
          <ChevronLeft size={16} />
        </Link>
        <div className="flex items-center gap-2">
          <History size={20} className="text-warning" />
          <h1 className="text-lg font-black text-text-primary">History Input</h1>
        </div>
      </div>

      <div className="mb-4 rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-sm">
        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">Pilih Tanggal</label>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-8 text-text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Bentar ya...</span>
        </div>
      )}

      {!isLoading && records.length === 0 && (
        <div className="rounded-xl border-2 border-border bg-[#111] p-6 text-center shadow-nb-sm">
          <p className="text-sm text-text-muted">Ga ada data buat tanggal <strong className="text-text-primary">{date}</strong>.</p>
        </div>
      )}

      {!isLoading && records.length > 0 && (
        <div className="space-y-3">
          {records.map((r) => (
            <div key={r.shift} className="rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className={`rounded-full border px-3 py-1 text-xs font-black ${shiftColor(r.shift)}`}>{r.shift}</span>
                <button
                  type="button"
                  onClick={() => setConfirmShift(r.shift)}
                  disabled={deleteMutation.isPending || changeMutation.isPending}
                  className="flex items-center gap-1.5 rounded-lg border-2 border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-black text-danger transition hover:border-danger hover:bg-danger/20 disabled:opacity-50"
                >
                  <Trash2 size={12} />
                  Hapus
                </button>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <select
                  value={shiftTargets[r.shift] || ''}
                  onChange={(e) => setShiftTargets((prev) => ({ ...prev, [r.shift]: e.target.value }))}
                  className="flex-1 rounded-lg border-2 border-border bg-[#0d0d0d] px-2 py-1.5 text-xs text-text-primary"
                >
                  <option value="">Pindah ke...</option>
                  {SHIFT_ORDER.filter((s) => s !== r.shift && !records.some((rec) => rec.shift === s)).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!shiftTargets[r.shift] || changeMutation.isPending}
                  onClick={() => shiftTargets[r.shift] && setConfirmChange({ from: r.shift, to: shiftTargets[r.shift] })}
                  className="flex items-center gap-1.5 rounded-lg border-2 border-blue-400/30 bg-blue-400/10 px-3 py-1.5 text-xs font-black text-blue-400 transition hover:border-blue-400 hover:bg-blue-400/20 disabled:opacity-30"
                >
                  <ArrowRightLeft size={12} />
                  Ganti Shift
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-text-muted">
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#555]">Station</span>
                  <p className="mt-0.5 font-bold text-text-primary">{r.stations?.join(', ') || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#555]">Total Item</span>
                  <p className="mt-0.5 font-bold text-text-primary">{r.item_count}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#555]">Submitted By</span>
                  <p className="mt-0.5 font-bold text-text-primary">{r.submitted_by || '-'}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-widest text-[#555]">Waktu</span>
                  <p className="mt-0.5 font-bold text-text-primary">
                    {r.created_at ? new Date(r.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmShift}
        title="Hapus Data Shift"
        description={`Yakin mau hapus semua data shift ${confirmShift} tanggal ${date}? Ga bisa di-undo dan file dokumentasi ikut kehapus permanen.`}
        confirmLabel="Gas Hapus"
        onConfirm={() => {
          if (confirmShift) deleteMutation.mutate(confirmShift)
          setConfirmShift(null)
        }}
        onCancel={() => setConfirmShift(null)}
      />

      <ConfirmDialog
        open={!!confirmChange}
        title="Ganti Shift"
        description={`Yakin mau pindahin semua data dari shift ${confirmChange?.from} ke ${confirmChange?.to} tanggal ${date}?`}
        confirmLabel="Gas Pindah"
        onConfirm={() => {
          if (confirmChange) changeMutation.mutate(confirmChange)
          setConfirmChange(null)
        }}
        onCancel={() => setConfirmChange(null)}
      />
    </div>
  )
}
