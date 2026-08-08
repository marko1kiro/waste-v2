import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatWasteSubmitElapsed, getWasteSubmitProgress } from '@/lib/waste-submit-progress'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
}

const SIZE_MAP = {
  sm: 16,
  md: 24,
  lg: 32,
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center gap-2">
      <Loader2 size={SIZE_MAP[size]} className="animate-spin text-primary" />
      {text && <span className="text-sm text-text-muted">{text}</span>}
    </div>
  )
}

export function PageLoadingSpinner({ text = 'Bentar ya...' }: { text?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingSpinner size="lg" text={text} />
    </div>
  )
}

export function ButtonLoadingSpinner() {
  return <Loader2 size={16} className="animate-spin" />
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-[#1a1a1a] ${className}`} />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-sm">
      <Skeleton className="mb-3 h-4 w-24" />
      <Skeleton className="mb-2 h-6 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  )
}

// ─── Progress Overlay ──────────────────────────────────
export interface ProgressState {
  current: number
  total: number
  label: string
  detail?: string
  startedAt?: number
}

export function ProgressOverlay({ progress }: { progress: ProgressState }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (!progress.startedAt) return; setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer) }, [progress.startedAt])
  const { percent: pct } = getWasteSubmitProgress({ completed: progress.current, total: progress.total })
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border-2 border-border bg-[#111] p-5 text-center shadow-nb-lg">
        <div className="mb-3 flex items-center justify-center gap-2">
          <Loader2 size={18} className="animate-spin text-warning" />
          <span className="text-sm font-black text-warning">{progress.label}</span>
        </div>
        <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-[#1a1a1a]">
          <div
            className="h-2.5 rounded-full bg-warning transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mb-2 text-xs font-bold text-text-primary">{pct}%{progress.startedAt ? ` • ${formatWasteSubmitElapsed(now - progress.startedAt)}` : ''}</div>
        {progress.detail && <p className="mb-2 text-[10px] text-text-muted">{progress.detail}</p>}
        <p className="text-[10px] text-text-muted">Sabar ya, jangan ditutup halamannya.</p>
      </div>
    </div>
  )
}
