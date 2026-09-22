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
    refetchInterval: 60_000,
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
    <div className="anim-enter mb-4 rounded-xl border border-border bg-surface px-3 py-2 shadow-theme-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="min-w-0 flex-1 basis-40">
          <div className="truncate text-xs font-semibold text-text-primary">{storeLabel}</div>
          <div className="text-[10px] text-text-muted">{getDayNameWIB(businessDate)}, {formatDateDisplay(businessDate)}</div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {SHIFTS.map((shift) => {
            const meta = SHIFT_META[shift]
            const isDone = data?.shifts?.[shift]?.done === true
            return (
              <span
                key={shift}
                title={`${shift}: ${isDone ? 'udah di-submit' : 'belum'}`}
                className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-wide ${
                  isDone
                    ? 'border-success-500/20 bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-400'
                    : 'border-border bg-surface-alt text-text-muted'
                }`}
              >
                <span className="text-[11px] leading-none">{meta.emoji}</span>
                <span className="hidden sm:inline">{shift}</span>
                {isDone ? <CheckCircle2 size={11} /> : <Clock size={11} />}
              </span>
            )
          })}
        </div>

        <div className="shrink-0 rounded-lg border border-border bg-surface-alt px-2 py-1 text-[10px] font-semibold uppercase text-text-primary">
          Yo {user?.username || '-'}!
        </div>
      </div>

    </div>
  )
}
