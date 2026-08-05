import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { ProgressOverlay, type ProgressState } from '@/components/ui/loading-spinner'
import { formatDateDisplay, getDayNameWIB } from '@shared/timezone'
import { FileDown, FolderOpen, Download, Archive, ChevronDown } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import type { DashboardData } from '@/lib/types'

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
    setProgress({ current: 1, total: 2, label: 'Membuat PDF...' })
    try {
      const response = await fetch(`/api/generate-pdf?date=${currentDate}`, { headers: { Authorization: `Bearer ${apiClient.getToken() || ''}` } })
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }))
        throw new Error(body.error || body.message || `HTTP ${response.status}`)
      }
      const filename = response.headers.get('content-disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'BA Waste.pdf'
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      setProgress({ current: 2, total: 2, label: 'Selesai!' })
    } catch (error) {
      toast.error('Gagal download PDF', error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setGenerating(false)
      setProgress(null)
    }
  }

  async function downloadBlobPdf(pdf: { filename: string; url: string }) {
    const response = await fetch(`/api/signatures?blobUrl=${encodeURIComponent(pdf.url)}`, { headers: { Authorization: `Bearer ${apiClient.getToken() || ''}` } })
    if (!response.ok) throw new Error(`Gagal ambil ${pdf.filename} (HTTP ${response.status})`)
    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement('a')
    link.href = url
    link.download = pdf.filename
    link.click()
    URL.revokeObjectURL(url)
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
        const response = await fetch(`/api/signatures?blobUrl=${encodeURIComponent(pdf.url)}`, { headers: { Authorization: `Bearer ${apiClient.getToken() || ''}` } })
        if (!response.ok) throw new Error(`Gagal ambil ${pdf.filename} (HTTP ${response.status})`)
        files[pdf.filename.replace(/^\d+-/, '')] = new Uint8Array(await response.arrayBuffer())
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
    <h1 className="mb-4 text-xl font-black text-primary">PDF Report</h1>
    <div className="mb-4 flex gap-2">{(['harian', 'bulanan'] as const).map((tab) => <button key={tab} onClick={() => setActiveTab(tab)} className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-xs font-bold ${activeTab === tab ? 'border-warning bg-warning/10 text-warning' : 'border-border bg-[#141414] text-text-muted'}`}>{tab === 'harian' ? <FileDown size={14} /> : <FolderOpen size={14} />}{tab === 'harian' ? 'Harian' : 'Bulanan'}</button>)}</div>
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]"><section className="rounded-xl border-2 border-border bg-[#111] p-4">{activeTab === 'harian' ? Object.entries(monthGroups).map(([month, dates], index) => <div key={month} className="mb-2 overflow-hidden rounded-lg border-2 border-border"><button type="button" onClick={() => setOpenDailyMonth(openDailyMonth === month ? null : month)} className="flex w-full items-center justify-between px-3 py-2.5"><span>{month.replace('-', ' / ')}</span><ChevronDown size={14} /></button>{(openDailyMonth === undefined ? index === 0 : openDailyMonth === month) && <div className="grid grid-cols-2 gap-2 border-t-2 border-border p-2">{dates.map((date) => <button key={date} onClick={() => setSelectedDate(date)} className="rounded-lg border-2 border-border px-3 py-2 text-xs">{formatDateDisplay(date)}</button>)}</div>}</div>) : monthList.map((month) => <button key={month} onClick={() => setSelectedMonth(month)} className="mb-2 w-full rounded-lg border-2 border-border px-3 py-2 text-left text-xs">{month.replace('-', ' / ')}</button>)}</section>
    <section className="rounded-xl border-2 border-border bg-[#111] p-5">{activeTab === 'harian' ? currentDate ? <><div className="mb-4 text-center"><p>Tanggal: <strong>{formatDateDisplay(currentDate)}</strong></p><p className="mt-1 text-xs text-text-muted">{getDayNameWIB(currentDate)}</p></div><button onClick={handleGeneratePDF} disabled={generating} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-black bg-warning py-4 text-sm font-black text-black disabled:opacity-40"><FileDown size={16} />{generating ? 'Generating...' : 'Download PDF'}</button></> : <p>Pilih tanggal dulu.</p> : selectedMonth ? <><p className="mb-4 text-center">Bulan: <strong>{selectedMonth.replace('-', ' / ')}</strong></p><button onClick={handleDownloadMonth} disabled={downloadingMonth || loadingMonth || !(monthPdfs?.pdfs.length)} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-black bg-warning px-4 py-3 text-sm font-black text-black disabled:opacity-50"><Archive size={16} />{downloadingMonth ? 'Lagi bikin ZIP...' : `Download 1 Bulan (${monthPdfs?.count || 0} PDF)`}</button>{monthPdfs?.pdfs.map((pdf) => <button key={pdf.url} type="button" onClick={() => void downloadBlobPdf(pdf).catch((error) => toast.error('Gagal download PDF', error instanceof Error ? error.message : 'Unknown error'))} className="mt-2 flex w-full items-center gap-3 rounded-lg border-2 border-border px-4 py-3 text-left text-xs"><Download size={16} />{pdf.filename}</button>)}</> : <p>Pilih bulan dulu.</p>}</section></div>
  </div>
}
