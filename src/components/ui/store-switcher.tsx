import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { getAdminStoreId, setAdminStoreId } from '@/lib/admin-store'
import { Building2 } from 'lucide-react'

interface StoreRow {
  id: number
  code: string
  name: string
  status: string
}

export function StoreSwitcher({ invalidateKeys }: { invalidateKeys?: readonly string[][] }) {
  const qc = useQueryClient()
  const { data } = useQuery<{ success: boolean; data: StoreRow[] }>({
    queryKey: ['admin-stores'],
    queryFn: () => apiClient.fetch('/api/admin/stores'),
    staleTime: 5 * 60_000,
  })
  const stores = useMemo(() => (data?.data || []).filter((s) => s.status === 'active'), [data])
  const selected = getAdminStoreId() ?? stores[0]?.id ?? null

  // Opsi A: kalau belum ada resto tersimpan, simpan resto pertama sebagai default
  // begitu daftar resto kebuka — supaya yang ditampilkan dropdown dan yang dikirim
  // ke API selalu sepakat sejak load pertama. Tanpa ini, halaman admin request
  // tanpa store_id -> API 400 -> halaman tampil kosong ("Ga ada data").
  // Setelah tersimpan, query halaman di-invalidate supaya langsung refetch pakai resto itu.
  useEffect(() => {
    if (getAdminStoreId() === null && stores.length > 0) {
      setAdminStoreId(stores[0].id)
      if (invalidateKeys) {
        for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key })
      } else {
        qc.invalidateQueries()
      }
    }
  }, [stores, qc, invalidateKeys])

  function onChange(value: string) {
    setAdminStoreId(value ? Number(value) : (stores[0]?.id ?? null))
    if (invalidateKeys) {
      for (const key of invalidateKeys) qc.invalidateQueries({ queryKey: key })
    } else {
      qc.invalidateQueries()
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Building2 size={14} className="text-text-muted" />
      <select
        value={selected ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-brand-500"
        aria-label="Pilih resto aktif"
      >
        <option value="">Pilih resto…</option>
        {stores.map((s) => (
          <option key={s.id} value={s.id}>{s.code} — {s.name}</option>
        ))}
      </select>
    </div>
  )
}
