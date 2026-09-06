import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { ProgressOverlay, type ProgressState } from '@/components/ui/loading-spinner'
import { formatDateDisplay, getDayNameWIB } from '@shared/timezone'
import { FileDown, FolderOpen, Download, Archive, ChevronDown } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import type { DashboardData } from '@/lib/types'

type PdfProgressPhase = {
  afterMs: number
  target: number
  label: string
}

// The generate endpoint returns one response after its server-side pipeline is done.
// These weighted phases keep the UI moving through that same pipeline without
// pretending an exact backend percentage; the final download bytes are measured.
const PDF_PROGRESS_PHASES: PdfProgressPhase[] = [
  { afterMs: 0, target: 7, label: 'Menghubungkan ke server PDF...' },
  { afterMs: 900, target: 14, label: 'Memvalidasi tanggal dan akses...' },
  { afterMs: 2200, target: 23, label: 'Memeriksa status shift MIDNIGHT...' },
  { afterMs: 4000, target: 34, label: 'Mengambil data waste dan konfigurasi...' },
  { afterMs: 6500, target: 46, label: 'Memeriksa arsip PDF di Google Drive...' },
  { afterMs: 9500, target: 59, label: 'Memuat dokumentasi dan tanda tangan...' },
  { afterMs: 14000, target: 72, label: 'Menyusun halaman laporan PDF...' },
  { afterMs: 20000, target: 82, label: 'Mengoptimalkan dokumen PDF...' },
  { afterMs: 28000, target: 89, label: 'Mengamankan salinan PDF ke Google Drive...' },
  { afterMs: 40000, target: 94, label: 'Menunggu proses backend selesai...' },
]

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

function getReadyLabel(source: string | null): string {
  if (source === 'google-drive') return 'PDF ditemukan di Google Drive. Mengunduh file...'
  if (source === 'generated-drive') return 'PDF selesai dibuat dan diamankan. Mengunduh file...'
  return 'PDF selesai dibuat. Mengunduh file...'
}

async function readPdfWithProgress(response: Response, onProgress: (percentage: number) => void): Promise<Blob> {
  if (!response.body) return response.blob()
  const reader = response.body.getReader()
  const contentLength = Number(response.headers.get('content-length'))
  const chunks: ArrayBuffer[] = []
  let received = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = new ArrayBuffer(value.byteLength)
    new Uint8Array(chunk).set(value)
    chunks.push(chunk)
    received += value.byteLength
    if (Number.isFinite(contentLength) && contentLength > 0) {
      onProgress(95 + Math.min(4, Math.floor((received / contentLength) * 4)))
    }
  }

  return new Blob(chunks, { type: response.headers.get('content-type') || 'application/pdf' })
}

export default function PdfDownload() {
  const [activeTab, setActiveTab] = useState<'harian' | 'bulanan'>('harian')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [openDailyMonth, setOpenDailyMonth] = useState<string | null | undefined>(undefined)
  const [generating, setGenerating] = useState(false)
  const [downloadingMonth, setDownloadingMonth] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const { data: dash } = useQuery<DashboardData>({ queryKey: ['dashboard-data'], queryFn: () => apiClient.fetch('/api/dashboard-data') })
  const availableDates = dash?.availableDates || []
  const currentDate = selectedDate || availableDates[0] || ''
  const monthGroups = useMemo(() => availableDates.reduce<Record<string, string[]>>((groups, date) => ({ ...groups, [date.slice(0, 7)]: [...(groups[date.slice(0, 7)] || []), date] }), {}), [availableDates])
  const monthList = useMemo(() => Array.from(new Set(availableDates.map((date) => date.slice(0, 7)))).sort().reverse(), [availableDates])
  const { data: monthPdfs, isLoading: loadingMonth } = useQuery<{ count: number; pdfs: Array<{ filename: string; url: string; uploadedAt: string; size: number }> }>({ queryKey: ['list-blob-pdfs', selectedMonth], queryFn: () => apiClient.fetch(`/api/get?action=list-blob-pdfs&month=${selectedMonth}`), enabled: Boolean(selectedMonth) })

  async function handleGeneratePDF() {
    if (!currentDate || generating) return
    setGenerating(true)
    const startedAt = Date.now()
    let visualPercentage = 3
    let currentLabel = PDF_PROGRESS_PHASES[0].label
    const updateProgress = (percentage: number, label = currentLabel) => {
      visualPercentage = Math.max(visualPercentage, Math.min(100, Math.round(percentage)))
      currentLabel = label
      setProgress({ current: visualPercentage, total: 100, label })
    }
    updateProgress(visualPercentage)

    const progressTimer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt
      const phase = [...PDF_PROGRESS_PHASES].reverse().find((candidate) => elapsed >= candidate.afterMs) || PDF_PROGRESS_PHASES[0]
      const distance = phase.target - visualPercentage
      updateProgress(distance > 0 ? visualPercentage + Math.max(1, Math.ceil(distance * 0.18)) : visualPercentage, phase.label)
    }, 400)

    try {
      const response = await fetch(`/api/generate-pdf?date=${currentDate}`, { headers: { Authorization: `Bearer ${apiClient.getToken() || ''}` } })
      window.clearInterval(progressTimer)
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(body.error || body.message || `HTTP ${response.status}`)
      }

      const readyLabel = getReadyLabel(response.headers.get('x-awas-pdf-source'))
      const transitionStart = visualPercentage
      const transitionSteps = 8
      for (let step = 1; step <= transitionSteps; step += 1) {
        updateProgress(transitionStart + ((95 - transitionStart) * step) / transitionSteps, readyLabel)
        await wait(55)
      }

      const filename = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'BA Waste.pdf'
      const pdfBlob = await readPdfWithProgress(response, (percentage) => updateProgress(percentage, readyLabel))
      const url = URL.createObjectURL(pdfBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      updateProgress(100, 'Selesai! PDF siap dibuka.')
      await wait(650)
    } catch (error) {
      window.clearInterval(progressTimer)
      toast.error('Gagal download PDF', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      window.clearInterval(progressTimer)
      setGenerating(false)
      setProgress(null)
    }
  }

  async function fetchPdfBlob(url: string): Promise<Blob> {
    const isR2 = url.includes('images.gacoanku.my.id') || (!url.includes('blob.vercel-storage.com') && url.startsWith('https://'))
    const fetchUrl = isR2 ? url : `/api/signatures?blobUrl=${encodeURIComponent(url)}`
    const headers: Record<string, string> = isR2 ? {} : { Authorization: `Bearer ${apiClient.getToken() || ''}` }
    const response = await fetch(fetchUrl, { headers })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response.blob()
  }

  async function downloadBlobPdf(pdf: { filename: string; url: string }) {
    try {
      const blob = await fetchPdfBlob(pdf.url)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = pdf.filename
      link.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      throw new Error(`Gagal ambil ${pdf.filename}: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  async function handleDownloadMonth() {
    const pdfs = monthPdfs?.pdfs || []
    if (!selectedMonth || !pdfs.length || downloadingMonth) return
    setDownloadingMonth(true)
    try {
      const { zipSync } = await import('fflate')
      const files: Record<string, Uint8Array> = {}
      for (const [index, pdf] of pdfs.entries()) {
        setProgress({ current: index + 1, total: pdfs.length + 1, label: `Ambil PDF ${index + 1}/${pdfs.length}...` })
        const blob = await fetchPdfBlob(pdf.url)
        files[pdf.filename.replace(/^\d+-/, '')] = new Uint8Array(await blob.arrayBuffer())
      }
      const url = URL.createObjectURL(new Blob([zipSync(files)], { type: 'application/zip' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `BA Waste ${selectedMonth}.zip`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error('Gagal download bulanan', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setDownloadingMonth(false)
      setProgress(null)
    }
  }

  return <div className="mx-auto max-w-5xl py-2">
    {progress && <ProgressOverlay progress={progress} />}
    <h1 className="mb-4 text-xl font-semibold text-text-primary">PDF Report</h1>
    <div className="mb-4 flex gap-2">{(['harian', 'bulanan'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-xs font-medium transition-colors ${activeTab === tab ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'border-border bg-surface text-text-muted hover:bg-surface-alt'}`}>{tab === 'harian' ? <FileDown size={14} /> : <FolderOpen size={14} />}{tab === 'harian' ? 'Harian' : 'Bulanan'}</button>)}</div>
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><section className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs">{activeTab === 'harian' ? Object.entries(monthGroups).map(([month, dates], index) => <div key={month} className="mb-2 overflow-hidden rounded-lg border border-border"><button type="button" onClick={() => setOpenDailyMonth(openDailyMonth === month ? null : month)} className="flex w-full items-center justify-between bg-surface-alt px-3 py-2.5 text-sm font-medium text-text-primary"><span>{month.replace('-', ' / ')}</span><ChevronDown size={14} /></button>{(openDailyMonth === undefined ? index === 0 : openDailyMonth === month) && <div className="grid grid-cols-2 gap-2 border-t border-border p-2">{dates.map((date) => <button key={date} onClick={() => setSelectedDate(date)} className={`rounded-lg border px-3 py-2 text-xs transition-colors ${selectedDate === date ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'border-border text-text-muted hover:bg-surface-alt'}`}>{formatDateDisplay(date)}</button>)}</div>}</div>) : monthList.map((month) => <button key={month} onClick={() => setSelectedMonth(month)} className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selectedMonth === month ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'border-border text-text-muted hover:bg-surface-alt'}`}>{month.replace('-', ' / ')}</button>)}</section>
    <section className="rounded-xl border border-border bg-surface p-5 shadow-theme-xs">{activeTab === 'harian' ? currentDate ? <><div className="mb-4 text-center"><p className="text-sm text-text-primary">Tanggal: <strong>{formatDateDisplay(currentDate)}</strong></p><p className="mt-1 text-xs text-text-muted">{getDayNameWIB(currentDate)}</p></div><button onClick={handleGeneratePDF} disabled={generating} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-4 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-40"><FileDown size={16} />{generating ? 'Generating...' : 'Download PDF'}</button></> : <p className="text-sm text-text-muted">Pilih tanggal dulu.</p> : selectedMonth ? <><p className="mb-4 text-center text-sm text-text-primary">Bulan: <strong>{selectedMonth.replace('-', ' / ')}</strong></p><button onClick={handleDownloadMonth} disabled={downloadingMonth || loadingMonth || !(monthPdfs?.pdfs.length)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"><Archive size={16} />{downloadingMonth ? 'Lagi bikin ZIP...' : `Download 1 Bulan (${monthPdfs?.count || 0} PDF)`}</button>{monthPdfs?.pdfs.map((pdf) => <button key={pdf.url} type="button" onClick={() => void downloadBlobPdf(pdf).catch((error) => toast.error('Gagal download PDF', error instanceof Error ? error.message : 'Unknown error'))} className="mt-2 flex w-full items-center gap-3 rounded-lg border border-border px-4 py-3 text-left text-xs text-text-primary transition-colors hover:bg-surface-alt"><Download size={16} className="text-text-muted" />{pdf.filename}</button>)}</> : <p className="text-sm text-text-muted">Pilih bulan dulu.</p>}</section></div>
  </div>
}
