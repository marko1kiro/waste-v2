import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { getBusinessDateWIB, formatDateDisplay, getDayNameWIB, SHIFT_META, SHIFTS } from '@shared/timezone'
import { CheckCircle2, Clock } from 'lucide-react'

import type { ShiftStatusData, TenantConfigData } from '@/lib/types'

export default function ShiftStatusBar() {
  const businessDate = getBusinessDateWIB()
  const { user } = useAuth()

  const { data } = useQuery<ShiftStatusData>({
    queryKey: ['shift-status', businessDate],
    queryFn: () =>
      apiClient.fetch<ShiftStatusData>(`/api/get?action=shift-status&date=${businessDate}`),
    refetchInterval: 30_000,
  })

  const { data: tenantData } = useQuery<TenantConfigData>({
    queryKey: ['tenant-config'],
    queryFn: () => apiClient.fetch<TenantConfigData>('/api/admin/tenant-config'),
    staleTime: 5 * 60_000,
  })

  const storeCode = tenantData?.data?.store_code || ''
  const storeName = tenantData?.data?.store_name || ''
  const storeLabel = storeCode && storeName ? `${storeCode} - ${storeName}` : storeName || storeCode || ''

  return (
    <div className="mx-auto mb-4 max-w-2xl rounded-xl border border-border bg-surface p-3 shadow-theme-xs">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-semibold text-text-primary">{storeLabel}</div>
          <div className="text-[10px] text-text-muted">{getDayNameWIB(businessDate)}, {formatDateDisplay(businessDate)}</div>
        </div>
        <div className="shrink-0 rounded-lg border border-border bg-surface-alt px-2 py-1 text-[10px] font-semibold uppercase text-text-primary">Yo {user?.username || '-'}!</div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {SHIFTS.map((shift) => {
          const meta = SHIFT_META[shift]
          const status = data?.shifts?.[shift]
          const isDone = status?.done === true

          return (
            <div
              key={shift}
              className="flex flex-col items-center py-1"
            >
              <span className="text-sm">{meta.emoji}</span>
              <span className="text-[9px] font-semibold uppercase text-text-muted">
                {shift}
              </span>
              {isDone ? (
                <CheckCircle2 size={14} className="mt-0.5 text-success-500" />
              ) : (
                <Clock size={14} className="mt-0.5 text-warning-500" />
              )}
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-center text-[11px] text-warning-600 dark:text-warning-400">PDF baru bisa dibuat kalo Midnight udah di-submit ya!</p>
    </div>
  )
}
