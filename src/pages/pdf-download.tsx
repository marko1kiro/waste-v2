import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { ProgressOverlay, type ProgressState } from '@/components/ui/loading-spinner'
import { formatDateDisplay, getDayNameWIB } from '@shared/timezone'
import { FileDown, Download, Archive } from 'lucide-react'
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

// apiClient.fetch menolak respons non-JSON, jadi download binary (PDF) memakai
// fetch mentah — tapi dengan timeout 65 detik (endpoint bisa jalan 60 detik)
// dan 401 handling yang memicu alur logout yang sama seperti apiClient
// (clearAuth + event 'auth:session-expired').
const PDF_FETCH_TIMEOUT_MS = 65_000

async function fetchPdfResponse(url: string, headers: Record<string, string> = {}): Promise<Response> {
  let response: Response
  try {
    response = await fetch(url, { headers, signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS) })
  } catch (err) {
    if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error('Kelamaan nih. Coba lagi ya.')
    }
    throw err
  }
  if (response.status === 401 && apiClient.getToken()) {
    apiClient.clearAuth()
    window.dispatchEvent(new CustomEvent('auth:session-expired'))
    const error = new Error('Sesi abis nih. Yuk login lagi.') as Error & { status?: number }
    error.status = 401
    throw error
  }
  return response
}

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

const pickerClass =
  'w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:[color-scheme:dark]'

export default function PdfDownload() {
  const [activeTab, setActiveTab] = useState<'harian' | 'bulanan'>('harian')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')
  const [generating, setGenerating] = useState(false)
  const [downloadingMonth, setDownloadingMonth] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const { data: dash } = useQuery<DashboardData>({ queryKey: ['dashboard-data'], queryFn: () => apiClient.fetch('/api/dashboard-data') })
  const availableDates = dash?.availableDates || []

  const sortedDates = useMemo(() => [...availableDates].sort(), [availableDates])
  const minDate = sortedDates[0] || ''
  const maxDate = sortedDates[sortedDates.length - 1] || ''
  const currentDate = selectedDate || availableDates[0] || ''
  const isDateAvailable = currentDate ? availableDates.includes(currentDate) : false

  const monthList = useMemo(() => Array.from(new Set(availableDates.map((date) => date.slice(0, 7)))).sort(), [availableDates])
  const minMonth = monthList[0] || ''
  const maxMonth = monthList[monthList.length - 1] || ''
  const isMonthAvailable = selectedMonth ? monthList.includes(selectedMonth) : false

  // Default ke bulan terbaru begitu datanya ada
  useEffect(() => {
    if (!selectedMonth && monthList.length > 0) {
      setSelectedMonth(monthList[monthList.length - 1])
    }
  }, [monthList, selectedMonth])

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
      const response = await fetchPdfResponse(`/api/generate-pdf?date=${currentDate}`, { Authorization: `Bearer ${apiClient.getToken() || ''}` })
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
    // Already-proxied URLs (e.g. signed R2 archive links from list-blob-pdfs)
    // are fetched as-is — the token in the URL carries the authorization.
    if (url.startsWith('/api/signatures')) {
      const response = await fetchPdfResponse(url)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return response.blob()
    }
    // R2 is private — everything else goes through the authenticated proxy.
    const fetchUrl = `/api/signatures?blobUrl=${encodeURIComponent(url)}`
    const response = await fetchPdfResponse(fetchUrl, { Authorization: `Bearer ${apiClient.getToken() || ''}` })
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

  const monthlyPdfs = monthPdfs?.pdfs || []

  return (
    <div className="mx-auto w-full max-w-5xl py-2">
      {progress && <ProgressOverlay progress={progress} />}
      <div className="anim-enter grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-theme-md">
        <div className="border-b border-border bg-surface-alt/60 px-5 py-4">
          <h1 className="flex items-center gap-2 text-base font-semibold text-text-primary">
            <FileDown size={18} className="text-brand-500" />
            PDF Report
          </h1>
          <p className="mt-0.5 text-xs text-text-muted">Download berita acara waste harian atau bulanan.</p>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-alt p-1" role="tablist">
            {(['harian', 'bulanan'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab
                    ? 'bg-surface text-brand-600 shadow-theme-xs dark:text-brand-400'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab === 'harian' ? <FileDown size={14} /> : <Archive size={14} />}
                {tab === 'harian' ? 'Harian' : 'Bulanan'}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-5">
          {activeTab === 'harian' ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="pdf-date" className="mb-1.5 block text-xs font-medium text-text-muted">
                  Pilih tanggal
                </label>
                <input
                  id="pdf-date"
                  type="date"
                  value={currentDate}
                  min={minDate || undefined}
                  max={maxDate || undefined}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className={pickerClass}
                />
                {availableDates.length === 0 ? (
                  <p className="mt-1.5 text-xs text-text-muted">Belum ada data tanggal.</p>
                ) : currentDate ? (
                  <p className="mt-1.5 text-xs text-text-muted">
                    {isDateAvailable ? (
                      <>{formatDateDisplay(currentDate)} &bull; {getDayNameWIB(currentDate)}</>
                    ) : (
                      <span className="font-medium text-warning-600">Tanggal ini belum ada datanya.</span>
                    )}
                  </p>
                ) : null}
              </div>
              <button
                onClick={handleGeneratePDF}
                disabled={generating || !isDateAvailable}
                className="neon-on-gradient flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 py-3 text-sm font-semibold text-white shadow-theme-md transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
              >
                <FileDown size={16} />
                {generating ? 'Generating...' : 'Download PDF'}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label htmlFor="pdf-month" className="mb-1.5 block text-xs font-medium text-text-muted">
                  Pilih bulan
                </label>
                <input
                  id="pdf-month"
                  type="month"
                  value={selectedMonth}
                  min={minMonth || undefined}
                  max={maxMonth || undefined}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className={pickerClass}
                />
                {selectedMonth && !isMonthAvailable && (
                  <p className="mt-1.5 text-xs font-medium text-warning-600">Bulan ini belum ada datanya.</p>
                )}
              </div>
              <button
                onClick={handleDownloadMonth}
                disabled={downloadingMonth || loadingMonth || !monthlyPdfs.length}
                className="neon-on-gradient flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 py-3 text-sm font-semibold text-white shadow-theme-md transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:brightness-100"
              >
                <Archive size={16} />
                {downloadingMonth ? 'Lagi bikin ZIP...' : `Download 1 Bulan (${monthPdfs?.count || 0} PDF)`}
              </button>
              {loadingMonth ? (
                <p className="text-center text-xs text-text-muted">Memuat daftar PDF...</p>
              ) : monthlyPdfs.length > 0 ? (
                <div>
                  <p className="mb-2 text-xs font-medium text-text-muted">File satuan ({monthlyPdfs.length})</p>
                  <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {monthlyPdfs.map((pdf) => (
                      <button
                        key={pdf.url}
                        type="button"
                        onClick={() => void downloadBlobPdf(pdf).catch((error) => toast.error('Gagal download PDF', error instanceof Error ? error.message : 'Unknown error'))}
                        className="flex w-full items-center gap-2.5 rounded-lg border border-border px-3 py-2 text-left text-xs text-text-primary transition hover:bg-surface-alt"
                      >
                        <Download size={14} className="shrink-0 text-text-muted" />
                        <span className="truncate">{pdf.filename}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : selectedMonth ? (
                <p className="text-center text-xs text-text-muted">Belum ada PDF arsip bulan ini.</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <aside className="anim-enter hidden lg:block" style={{ animationDelay: '120ms' }}>
        <div className="sticky top-6 space-y-4">
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-theme-xs">
            <h2 className="mb-3 text-sm font-bold text-text-primary">Tentang arsip PDF</h2>
            <ul className="space-y-2.5 text-xs leading-relaxed text-text-muted">
              <li className="flex gap-2"><span className="text-brand-500">•</span>Berita acara harian berisi rekap waste per shift + dokumentasi foto.</li>
              <li className="flex gap-2"><span className="text-brand-500">•</span>Link gambar di dalam PDF bersifat arsip — tetap bisa dibuka bertahun-tahun.</li>
              <li className="flex gap-2"><span className="text-brand-500">•</span>Arsip bulanan mengunduh semua PDF harian dalam satu file ZIP.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-500/20 dark:bg-brand-500/5">
            <h2 className="mb-2 text-sm font-bold text-brand-700 dark:text-brand-300">Tips</h2>
            <p className="text-xs leading-relaxed text-brand-700/80 dark:text-brand-300/80">Generate PDF setelah shift MIDNIGHT selesai supaya datanya lengkap satu hari penuh.</p>
          </div>
        </div>
      </aside>
      </div>
    </div>
  )
}
