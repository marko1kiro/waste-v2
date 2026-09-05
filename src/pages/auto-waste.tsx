import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { apiClient } from '@/lib/api-client'
import { fileToBase64 } from '@/lib/file-utils'
import { queryClient } from '@/lib/query-client'
import { toast } from '@/hooks/use-toast'
import { ButtonLoadingSpinner, ProgressOverlay, type ProgressState } from '@/components/ui/loading-spinner'
import { AuthenticatedImage } from '@/components/ui/authenticated-image'
import MultiFileUpload from '@/components/ui/multi-file-upload'
import { getBusinessDateWIB, getCurrentShiftWIB, formatTimeWIB, SHIFTS } from '@shared/timezone'
import { STATIONS, METHODS } from '@shared/schema'
import { parsePasteWaste, type PasteIssue } from '@/lib/paste-waste-parser'
import { hasCatalog, initialWasteStep } from '@/lib/store-features'
import { canApplyRestore, deleteDraft, filesToPhotos, getDraft, listQueue, photosToFiles, queueSnapshot, retryQueueItem, saveDraft, shouldUseDirectSubmitFallback, syncQueue, type QueueItem } from '@/lib/offline-waste'
import { TESTER_ITEMS } from '@shared/tester'
import { STATION_UI } from '@shared/station-ui'
import type { Station } from '@shared/schema'
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  ArrowLeft,
} from 'lucide-react'

interface StationItem {
  id: number
  station: string
  nama_produk: string
  unit: string
  kode_lot_wajib: boolean
  is_manual: boolean
}

interface Personnel {
  name: string
  full_name: string
  role: 'qc' | 'manager'
  signature_url: string
}

interface WasteRow {
  id: string
  namaProduk: string
  kodeProduk: string
  jumlahProduk: number
  unit: string
  metodePemusnahan: string
  alasanPemusnahan: string
  isManual: boolean
}

type Step = 'paste' | 'config' | 'items' | 'preview' | 'success'

type DraftPayload = {
  businessDate: string
  shift: (typeof SHIFTS)[number]
  selectedStations: Station[]
  rowsByStation: Record<string, WasteRow[]>
  savedAt: number
  qcName?: string
  managerName?: string
  testerMode?: boolean
  testerChecks?: Record<string, boolean>
  pasteRaw?: string
  parsedDestructionTime?: string
}

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function dateToDDMMYYYY(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${d}${m}${y}`
}

const KODE_LOT_DATE_PICKER_ITEMS = ['KULIT PANGSIT', 'MIE POLOS']

function makeEmptyRow(businessDate?: string): WasteRow {
  return {
    id: uid(),
    namaProduk: '',
    kodeProduk: businessDate ? dateToDDMMYYYY(businessDate) : '',
    jumlahProduk: 0,
    unit: 'PCS',
    metodePemusnahan: 'DIBUANG',
    alasanPemusnahan: '',
    isManual: false,
  }
}



export default function AutoWaste() {
  const [location] = useLocation()
  const pasteMode = location === '/paste-waste'
  return <WasteForm key={pasteMode ? 'paste' : 'manual'} pasteMode={pasteMode} />
}

function WasteForm({ pasteMode }: { pasteMode: boolean }) {
  const { user, store, isAuthenticated } = useAuth()
  const catalogEnabled = hasCatalog(store)
  const restoredRef = useRef(false)
  const mountedRef = useRef(true)
  const draftRevision = useRef(0)
  const markDirty = () => { draftRevision.current += 1 }
  const [restoreDone, setRestoreDone] = useState(false)
  const [persistenceStatus, setPersistenceStatus] = useState('')
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])

  const [step, setStep] = useState<Step>(initialWasteStep(pasteMode, store))
  const [businessDate, setBusinessDate] = useState(getBusinessDateWIB())
  const [shift, setShift] = useState<(typeof SHIFTS)[number]>(getCurrentShiftWIB())
  const [selectedStations, setSelectedStations] = useState<Station[]>(['NOODLE'])
  const [expandedStation, setExpandedStation] = useState<Station>('NOODLE')
  const initDate = getBusinessDateWIB()
  const [rowsByStation, setRowsByStation] = useState<Record<string, WasteRow[]>>({
    NOODLE: [makeEmptyRow(initDate)],
    DIMSUM: [makeEmptyRow(initDate)],
    BAR: [makeEmptyRow(initDate)],
    PRODUKSI: [makeEmptyRow(initDate)],
  })
  const [collapsedRows, setCollapsedRows] = useState<Record<string, string[]>>({
    NOODLE: [],
    DIMSUM: [],
    BAR: [],
    PRODUKSI: [],
  })
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [filesByStation, setFilesByStation] = useState<Record<string, File[]>>({})
  const [qcName, setQcName] = useState('')
  const [managerName, setManagerName] = useState('')
  const [testerMode, setTesterMode] = useState(false)
  const [testerChecks, setTesterChecks] = useState<Record<string, boolean>>({})
  const [testerCollapsed, setTesterCollapsed] = useState(true)
  const [rawPaste, setRawPaste] = useState('')
  const [pasteApplyIssues, setPasteApplyIssues] = useState<PasteIssue[]>([])
  const parsedPaste = useMemo(() => parsePasteWaste(rawPaste), [rawPaste])

  const stationQueries = {
    NOODLE: useQuery<{ success: boolean; data: StationItem[] }>({ queryKey: ['station-items', 'NOODLE'], queryFn: () => apiClient.fetch('/api/get?action=station-items&station=NOODLE'), enabled: catalogEnabled }),
    DIMSUM: useQuery<{ success: boolean; data: StationItem[] }>({ queryKey: ['station-items', 'DIMSUM'], queryFn: () => apiClient.fetch('/api/get?action=station-items&station=DIMSUM'), enabled: catalogEnabled }),
    BAR: useQuery<{ success: boolean; data: StationItem[] }>({ queryKey: ['station-items', 'BAR'], queryFn: () => apiClient.fetch('/api/get?action=station-items&station=BAR'), enabled: catalogEnabled }),
    PRODUKSI: useQuery<{ success: boolean; data: StationItem[] }>({ queryKey: ['station-items', 'PRODUKSI'], queryFn: () => apiClient.fetch('/api/get?action=station-items&station=PRODUKSI'), enabled: catalogEnabled }),
  }

  const { data: qcData } = useQuery<{ success: boolean; data: Personnel[] }>({ queryKey: ['personnel', 'qc'], queryFn: () => apiClient.fetch('/api/signatures?role=qc') })
  const { data: managerData } = useQuery<{ success: boolean; data: Personnel[] }>({ queryKey: ['personnel', 'manager'], queryFn: () => apiClient.fetch('/api/signatures?role=manager') })

  const qcList = qcData?.data || []
  const managerList = managerData?.data || []
  const selectedQC = qcList.find((p) => (p.full_name || p.name) === qcName)
  const selectedManager = managerList.find((p) => (p.full_name || p.name) === managerName)
  const catalogError = catalogEnabled && STATIONS.some((station) => stationQueries[station].error)
  const personnelMissing = qcList.length === 0 || managerList.length === 0

  const form: 'manual' | 'paste' = pasteMode ? 'paste' : 'manual'
  const payload: DraftPayload = { businessDate, shift, selectedStations, rowsByStation, savedAt: Date.now(), qcName, managerName, testerMode, testerChecks, pasteRaw: pasteMode ? rawPaste : undefined, parsedDestructionTime: pasteMode ? parsedPaste.destructionTime || undefined : undefined }
  useEffect(() => () => { mountedRef.current = false }, [])
  useEffect(() => {
    const dirty = () => markDirty()
    window.addEventListener('input', dirty, true)
    window.addEventListener('change', dirty, true)
    return () => { window.removeEventListener('input', dirty, true); window.removeEventListener('change', dirty, true) }
  }, [])
  useEffect(() => {
    if (!user || restoredRef.current) return
    restoredRef.current = true
    const revisionAtRequest = draftRevision.current
    void getDraft<DraftPayload>(user.username, form).then((draft) => {
      if (!draft || !canApplyRestore(revisionAtRequest, draftRevision.current)) return
      draftRevision.current = draft.revision
      const value = draft.value
      setBusinessDate(value.businessDate); setShift(value.shift); setSelectedStations(value.selectedStations); setExpandedStation(value.selectedStations[0] || 'NOODLE'); setRowsByStation((prev) => ({ ...prev, ...value.rowsByStation })); setQcName(value.qcName || ''); setManagerName(value.managerName || ''); setTesterMode(Boolean(value.testerMode)); setTesterChecks(value.testerChecks || {}); if (pasteMode) setRawPaste(value.pasteRaw || ''); setFilesByStation(Object.fromEntries(Object.entries(draft.photos).map(([station, photos]) => [station, photosToFiles(photos)]))); setPersistenceStatus('Draft dipulihkan.')
    }).catch(() => setPersistenceStatus('Penyimpanan lokal tidak tersedia.')).finally(() => setRestoreDone(true))
  }, [form, pasteMode, user])
  useEffect(() => {
    if (!user || !restoreDone) return
    draftRevision.current += 1
    setPersistenceStatus('Menyimpan draft...')
    const timer = window.setTimeout(() => { const revision = draftRevision.current + 1; draftRevision.current = revision; void saveDraft({ key: `${user.username}:${form}`, userId: user.username, form, value: payload, photos: Object.fromEntries(Object.entries(filesByStation).map(([station, files]) => [station, filesToPhotos(files)])), updatedAt: Date.now(), revision, schemaVersion: 1 }).then(() => setPersistenceStatus('Draft tersimpan.')).catch(() => setPersistenceStatus('Penyimpanan lokal tidak tersedia.')) }, 800)
    return () => window.clearTimeout(timer)
  }, [businessDate, filesByStation, form, managerName, pasteMode, parsedPaste.destructionTime, qcName, rawPaste, restoreDone, rowsByStation, selectedStations, shift, testerChecks, testerMode, user])
  useEffect(() => {
    if (!user) return
    const refresh = () => void listQueue(user.username).then(setQueueItems).catch(() => setPersistenceStatus('Penyimpanan lokal tidak tersedia.'))
    const sync = () => void syncQueue(user.username, apiClient.fetch).then(refresh).catch(() => refresh())
    refresh(); if (isAuthenticated && navigator.onLine) sync(); window.addEventListener('online', sync); return () => window.removeEventListener('online', sync)
  }, [isAuthenticated, user])

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      const hasData = Object.values(rowsByStation).some((rows) => rows.some((r) => r.namaProduk.trim() !== '')) || testerMode
      if (!hasData || step === 'success') return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [rowsByStation, step, testerMode])

  const totalValidItems = useMemo(() => {
    return selectedStations.reduce((acc, station) => acc + rowsByStation[station].filter((r) => r.namaProduk.trim() !== '').length, 0)
  }, [rowsByStation, selectedStations])
  const testerIssueCount = useMemo(() => TESTER_ITEMS.filter((item) => testerChecks[item.name] === false).length, [testerChecks])
  const hasSelectedStations = selectedStations.length > 0

  function toggleStation(station: Station) {
    setSelectedStations((prev) => {
      const exists = prev.includes(station)
      const next = exists ? prev.filter((s) => s !== station) : [...prev, station]
      if (!exists && next.length === 1) setExpandedStation(station)
      if (exists && expandedStation === station && next[0]) setExpandedStation(next[0])
      return next
    })
  }

  function toggleAllStations() {
    if (selectedStations.length === STATIONS.length) {
      setSelectedStations([])
    } else {
      setSelectedStations([...STATIONS])
      setExpandedStation(STATIONS[0])
    }
  }

  function getAvailableOptions(station: Station, currentRowId: string) {
    const selectedNames = rowsByStation[station]
      .filter((row) => row.id !== currentRowId && row.namaProduk.trim() !== '' && !row.isManual)
      .map((row) => row.namaProduk)

    return (stationQueries[station].data?.data || []).filter((item) => item.is_manual || !selectedNames.includes(item.nama_produk))
  }

  function addRow(station: Station) {
    setCollapsedRows((prev) => ({
      ...prev,
      [station]: rowsByStation[station].map((row) => row.id),
    }))
    setRowsByStation((prev) => ({
      ...prev,
      [station]: [...prev[station], makeEmptyRow(businessDate)],
    }))
    setExpandedStation(station)
  }

  function removeRow(station: Station, rowId: string) {
    setRowsByStation((prev) => ({
      ...prev,
      [station]: prev[station].filter((row) => row.id !== rowId),
    }))
    setCollapsedRows((prev) => ({
      ...prev,
      [station]: prev[station].filter((id) => id !== rowId),
    }))
  }

  function updateRow(station: Station, rowId: string, patch: Partial<WasteRow>) {
    setRowsByStation((prev) => ({
      ...prev,
      [station]: prev[station].map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }))
  }

  function toggleRowCollapse(station: Station, rowId: string) {
    setCollapsedRows((prev) => {
      const isCollapsed = prev[station].includes(rowId)
      return {
        ...prev,
        [station]: isCollapsed ? prev[station].filter((id) => id !== rowId) : [...prev[station], rowId],
      }
    })
  }

  function selectProduct(station: Station, rowId: string, value: string) {
    if (value === '__MANUAL__') {
      const manualAlasan = station === 'BAR' ? 'SUSUT' : ''
      updateRow(station, rowId, { namaProduk: '', isManual: true, unit: 'PCS', alasanPemusnahan: manualAlasan })
      return
    }
    const item = (stationQueries[station].data?.data || []).find((c) => c.nama_produk === value)
    if (!item) return
    // Station BAR: default alasan SUSUT, kecuali item mengandung BUSUK
    const alasan = station === 'BAR'
      ? (item.nama_produk.includes('BUSUK') ? 'BUSUK' : 'SUSUT')
      : ''
    updateRow(station, rowId, {
      namaProduk: item.nama_produk,
      unit: item.unit,
      isManual: item.is_manual,
      alasanPemusnahan: alasan,
    })
  }

  function normalizePersonnelName(value: string): string {
    return value.trim().replace(/\s+/g, ' ').toLocaleUpperCase('id-ID')
  }

  function findPersonnel(personnel: Personnel[], pastedName: string | null): Personnel | undefined {
    if (!pastedName) return undefined
    const normalized = normalizePersonnelName(pastedName)
    return personnel.find((person) => (
      normalizePersonnelName(person.name) === normalized ||
      normalizePersonnelName(person.full_name) === normalized
    ))
  }

  const pastedQC = findPersonnel(qcList, parsedPaste.qcName)
  const pastedManager = findPersonnel(managerList, parsedPaste.managerName)
  const catalogLoading = catalogEnabled && STATIONS.some((station) => stationQueries[station].isLoading)
  const pasteCatalogWarnings = useMemo<PasteIssue[]>(() => {
    if (!catalogEnabled || !rawPaste.trim() || catalogLoading) return []
    return parsedPaste.items.flatMap((item) => {
      const exactCatalogMatch = catalogEnabled && (stationQueries[item.station].data?.data || []).some(
        (catalogItem) => catalogItem.nama_produk.trim().toLocaleUpperCase('id-ID') === item.namaProduk.trim().toLocaleUpperCase('id-ID'),
      )
      return exactCatalogMatch
        ? []
        : [{ line: item.line, message: `Produk "${item.namaProduk}" tidak ditemukan persis di catalog ${item.station}; disimpan sebagai item manual tanpa koreksi nama.` }]
    })
  }, [rawPaste, parsedPaste.items, catalogLoading, stationQueries])

  function applyPaste() {
    const issues: PasteIssue[] = []
    if (parsedPaste.errors.length > 0) {
      setPasteApplyIssues(parsedPaste.errors)
      return
    }
    if (catalogLoading) {
      setPasteApplyIssues([{ line: 0, message: 'Catalog masih dimuat. Tunggu sebentar lalu coba lagi.' }])
      return
    }
    if (catalogEnabled && catalogError) {
      setPasteApplyIssues([{ line: 0, message: 'Catalog gagal dimuat. Refresh halaman lalu coba lagi.' }])
      return
    }
    if (!pastedQC) issues.push({ line: 0, message: `QC "${parsedPaste.qcName || '-'}" tidak ditemukan di personnel aktif.` })
    if (!pastedManager) issues.push({ line: 0, message: `Manager "${parsedPaste.managerName || '-'}" tidak ditemukan di personnel aktif.` })
    if (issues.length > 0) {
      setPasteApplyIssues(issues)
      return
    }

    const nextRows: Record<string, WasteRow[]> = {
      NOODLE: [],
      DIMSUM: [],
      BAR: [],
      PRODUKSI: [],
    }
    const nextStations: Station[] = []
    for (const item of parsedPaste.items) {
      const station = item.station as Station
      if (!nextStations.includes(station)) nextStations.push(station)
      const exactCatalogItem = catalogEnabled
        ? (stationQueries[station].data?.data || []).find(
            (catalogItem) => catalogItem.nama_produk.trim().toLocaleUpperCase('id-ID') === item.namaProduk.trim().toLocaleUpperCase('id-ID'),
          )
        : undefined
      nextRows[station].push({
        id: uid(),
        namaProduk: exactCatalogItem ? exactCatalogItem.nama_produk : item.namaProduk,
        kodeProduk: parsedPaste.lotCode || '',
        jumlahProduk: item.jumlahProduk,
        unit: item.unit,
        metodePemusnahan: parsedPaste.method || 'DIBUANG',
        alasanPemusnahan: item.alasanPemusnahan,
        isManual: !exactCatalogItem,
      })
    }

    setBusinessDate(parsedPaste.businessDate || getBusinessDateWIB())
    setShift(parsedPaste.shift || getCurrentShiftWIB())
    setSelectedStations(nextStations)
    setExpandedStation(nextStations[0] || 'NOODLE')
    setRowsByStation(nextRows)
    setCollapsedRows({ NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [] })
    setQcName(pastedQC?.full_name || pastedQC?.name || '')
    setManagerName(pastedManager?.full_name || pastedManager?.name || '')
    setTesterMode(false)
    setTesterChecks({})
    setPasteApplyIssues([])
    setStep('config')
    if (pasteCatalogWarnings.length > 0) toast.warning('Ada item manual', `${pasteCatalogWarnings.length} produk tidak ada exact match di catalog.`)
    else if (catalogEnabled) toast.success('Format diterapkan', `${parsedPaste.items.length} item siap ditinjau.`)
    else toast.success('Format diterapkan', `${parsedPaste.items.length} item siap ditinjau.`)
  }

  async function handleSubmit() {
    if (!hasSelectedStations && !testerMode) {
      toast.error('Eh, ada yang kurang', 'Pilih minimal 1 station dong.')
      return
    }
    if (hasSelectedStations && totalValidItems === 0) {
      toast.error('Eh, ada yang kurang', 'Isi minimal 1 item dong buat station yang dipilih.')
      return
    }
    if (hasSelectedStations) {
      const hasInvalidQty = selectedStations.some((station) => rowsByStation[station].some((r) => r.namaProduk.trim() !== '' && r.jumlahProduk <= 0))
      if (hasInvalidQty) {
        toast.error('Eh, ada yang kurang', 'Qty harus diisi dan lebih dari 0 ya.')
        return
      }
    }
    if (testerMode && !hasSelectedStations && testerIssueCount === 0) {
      toast.warning('Tester Kosong', 'Ga ada issue tester yang mau disubmit.')
      return
    }
    if (!qcName || !managerName) {
      toast.error('Eh, ada yang kurang', 'QC sama Manager harus dipilih dulu dong.')
      return
    }
    if (pasteMode && !parsedPaste.destructionTime) {
      toast.error('Format paste belum lengkap', 'Jam pemusnahan hasil paste tidak valid. Kembali ke format paste dan perbaiki dulu ya.')
      return
    }

    if (!user) {
      toast.error('Sesi tidak tersedia', 'Login ulang dulu ya.')
      return
    }
    let storageUnavailable = false
    {
      const submission = (station: string, rows: Array<Pick<WasteRow, 'namaProduk' | 'jumlahProduk' | 'kodeProduk' | 'unit' | 'metodePemusnahan' | 'alasanPemusnahan'>>) => ({ payload: { tanggal: businessDate, kategoriInduk: station, shift, storeName: 'BEKASI KP. BULU', productList: JSON.stringify(rows.map((row) => row.namaProduk.toUpperCase())), jumlahProdukList: JSON.stringify(rows.map((row) => row.jumlahProduk)), kodeProdukList: JSON.stringify(rows.map((row) => row.kodeProduk)), unitList: JSON.stringify(rows.map((row) => row.unit)), metodePemusnahanList: JSON.stringify(rows.map((row) => row.metodePemusnahan)), alasanPemusnahanList: JSON.stringify(rows.map((row) => row.alasanPemusnahan)), jamTanggalPemusnahanList: JSON.stringify(rows.map(() => pasteMode ? parsedPaste.destructionTime || '' : formatTimeWIB())), parafQCName: qcName, parafQCUrl: selectedQC?.signature_url || '', parafManagerName: managerName, parafManagerUrl: selectedManager?.signature_url || '' }, photos: filesToPhotos(filesByStation[station] || []), uploadedUrls: [] })
      const submissions = selectedStations.map((station) => submission(station, rowsByStation[station].filter((row) => row.namaProduk.trim() !== '')))
      if (testerMode && testerIssueCount) submissions.push(submission('BAR', TESTER_ITEMS.filter((item) => testerChecks[item.name] === false).map((item) => ({ namaProduk: item.name, kodeProduk: '', jumlahProduk: 1, unit: 'PCS', metodePemusnahan: 'DIBUANG', alasanPemusnahan: 'TESTER' }))))
      try {
        const startedAt = Date.now()
        setLoading(true); setProgress({ current: 0, total: 0, label: 'Memvalidasi dan menyimpan antrean...', detail: 'Menyiapkan data pengiriman.', startedAt })
        const item = await queueSnapshot({ userId: user.username, form, businessDate, shift, stations: testerMode ? [...selectedStations, 'TESTER'] : selectedStations, submissions, draftRevision: draftRevision.current })
        if (mountedRef.current) setQueueItems((items) => items.some((queued) => queued.id === item.id) ? items : [...items, item])
        if (!navigator.onLine) { if (mountedRef.current) { setLoading(false); setProgress(null); setPersistenceStatus('Offline: data masuk antrean.'); toast.info('Data diantrekan', 'Akan dikirim saat koneksi kembali.') }; return }
        await syncQueue(user.username, apiClient.fetch, true, (event) => { if (mountedRef.current) setProgress({ current: event.completed, total: event.total, label: event.station ? `${event.phase === 'uploading' ? 'Upload foto' : event.phase === 'submitting' ? 'Mengirim data' : 'Sinkronisasi'} ${event.station}` : 'Menyinkronkan antrean...', detail: event.detail, startedAt }) })
        const queued = await listQueue(user.username)
        if (mountedRef.current) {
          setQueueItems(queued)
          const current = queued.find((queuedItem) => queuedItem.id === item.id)
          if (!current || current.state === 'completed') { setSuccessMessage(`${hasSelectedStations ? `${selectedStations.length} station` : ''}${hasSelectedStations && testerMode ? ' + ' : ''}${testerMode ? 'tester' : ''} berhasil disimpan!`); setStep('success'); toast.success('Mantap', 'Data waste udah kesimpen.') }
          else toast.info('Data diantrekan', current.lastError || 'Menunggu sinkronisasi.')
        }
        return
      } catch { storageUnavailable = true; if (mountedRef.current) setPersistenceStatus('Penyimpanan lokal tidak tersedia.') } finally { if (mountedRef.current) { setLoading(false); setProgress(null) } }
    }
    if (shouldUseDirectSubmitFallback(!storageUnavailable)) await submitDirectFallback()
  }

  async function submitDirectFallback() {
    setLoading(true)

    const totalFiles = selectedStations.reduce((sum, s) => sum + (filesByStation[s]?.length || 0), 0)
    const stationCount = hasSelectedStations ? selectedStations.length : 0
    const hasTester = testerMode && testerIssueCount > 0
    const totalSteps = totalFiles + stationCount + stationCount + (hasTester ? 1 : 0) + 1
    let currentStep = 0
    const startedAt = Date.now()
    const tick = (label: string) => { currentStep++; setProgress({ current: currentStep, total: totalSteps, label, startedAt }) }

    try {
      // Seluruh station dicek terlebih dahulu agar tidak ada foto yang terunggah
      // bila salah satu station ternyata sudah pernah disubmit.
      if (hasSelectedStations) {
        for (const station of selectedStations) {
          tick(`Cek duplikat ${station}...`)
          const dup = await apiClient.fetch<{ isDuplicate: boolean }>(`/api/get-day-data?date=${businessDate}&shift=${shift}&station=${station}`)
          if (dup.isDuplicate) throw new Error(`Data duplikat untuk station ${station} pada tanggal dan shift ini.`)
        }
      }

      const dokumentasiByStation: Record<string, string[]> = {}
      for (const station of selectedStations) {
        const stationFiles = filesByStation[station] || []
        const urls: string[] = []
        for (const file of stationFiles) {
          tick(`Lagi upload foto ${station}...`)
          const base64 = await fileToBase64(file)
          const uploaded = await apiClient.fetch<{ success: boolean; proxyUrl: string }>('/api/upload-file', {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, contentType: file.type, base64, folder: 'waste-docs' }),
          })
          if (uploaded.proxyUrl) urls.push(uploaded.proxyUrl)
        }
        dokumentasiByStation[station] = urls
      }

      if (hasSelectedStations) {
        for (const station of selectedStations) {
          tick(`Nyimpen data ${station}...`)
          const validRows = rowsByStation[station].filter((r) => r.namaProduk.trim() !== '')
          if (validRows.length === 0) continue

          await apiClient.fetch('/api/submit-waste', {
            method: 'POST',
            body: JSON.stringify({
              tanggal: businessDate,
              kategoriInduk: station,
              shift,
              storeName: 'BEKASI KP. BULU',
              productList: JSON.stringify(validRows.map((r) => r.namaProduk.toUpperCase())),
              jumlahProdukList: JSON.stringify(validRows.map((r) => r.jumlahProduk)),
              kodeProdukList: JSON.stringify(validRows.map((r) => r.kodeProduk)),
              unitList: JSON.stringify(validRows.map((r) => r.unit)),
              metodePemusnahanList: JSON.stringify(validRows.map((r) => r.metodePemusnahan)),
              alasanPemusnahanList: JSON.stringify(validRows.map((r) => r.alasanPemusnahan)),
              jamTanggalPemusnahanList: JSON.stringify(pasteMode
                ? validRows.map(() => parsedPaste.destructionTime || '')
                : validRows.map(() => formatTimeWIB())),
              parafQCName: qcName,
              parafQCUrl: selectedQC?.signature_url || '',
              parafManagerName: managerName,
              parafManagerUrl: selectedManager?.signature_url || '',
              dokumentasiUrls: JSON.stringify(dokumentasiByStation[station] || []),
            }),
          })
        }
      }

      if (hasTester) {
        tick('Nyimpen data tester...')
        const payloadRows = TESTER_ITEMS.filter((item) => testerChecks[item.name] === false).map((item) => ({
          namaProduk: item.name,
          kodeProduk: '',
          jumlahProduk: 1,
          unit: 'PCS',
          metodePemusnahan: 'DIBUANG',
          alasanPemusnahan: 'TESTER',
        }))

        await apiClient.fetch('/api/submit-waste', {
          method: 'POST',
          body: JSON.stringify({
            tanggal: businessDate,
            kategoriInduk: 'BAR',
            shift,
            storeName: 'BEKASI KP. BULU',
            productList: JSON.stringify(payloadRows.map((r) => r.namaProduk.toUpperCase())),
            jumlahProdukList: JSON.stringify(payloadRows.map((r) => r.jumlahProduk)),
            kodeProdukList: JSON.stringify(payloadRows.map((r) => r.kodeProduk)),
            unitList: JSON.stringify(payloadRows.map((r) => r.unit)),
            metodePemusnahanList: JSON.stringify(payloadRows.map((r) => r.metodePemusnahan)),
            alasanPemusnahanList: JSON.stringify(payloadRows.map((r) => r.alasanPemusnahan)),
            jamTanggalPemusnahanList: JSON.stringify(pasteMode
              ? payloadRows.map(() => parsedPaste.destructionTime || '')
              : payloadRows.map(() => formatTimeWIB())),
            parafQCName: qcName,
            parafQCUrl: selectedQC?.signature_url || '',
            parafManagerName: managerName,
            parafManagerUrl: selectedManager?.signature_url || '',
            dokumentasiUrls: JSON.stringify(dokumentasiByStation['BAR'] || []),
          }),
        })
      }

      tick('Update status...')
      await queryClient.invalidateQueries({ queryKey: ['shift-status'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard-data'] })
      if (user) await deleteDraft(user.username, form).catch(() => undefined)
      setSuccessMessage(`${hasSelectedStations ? `${selectedStations.length} station` : ''}${hasSelectedStations && testerMode ? ' + ' : ''}${testerMode ? 'tester' : ''} berhasil disimpan!`)
      setStep('success')
      toast.success('Mantap', 'Data waste udah kesimpen.')
    } catch (err) {
      const status = typeof err === 'object' && err && 'status' in err ? Number(err.status) : undefined
      if (status === 409 && user) await deleteDraft(user.username, form).catch(() => undefined)
      toast.error('Waduh gagal submit', status === 409 ? 'Data sudah ada di server' : err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  function resetForm() {
    setStep(pasteMode ? 'paste' : 'config')
    setBusinessDate(getBusinessDateWIB())
    setShift(getCurrentShiftWIB())
    setSelectedStations(['NOODLE'])
    setExpandedStation('NOODLE')
    const resetDate = getBusinessDateWIB()
    setRowsByStation({ NOODLE: [makeEmptyRow(resetDate)], DIMSUM: [makeEmptyRow(resetDate)], BAR: [makeEmptyRow(resetDate)], PRODUKSI: [makeEmptyRow(resetDate)] })
    setCollapsedRows({ NOODLE: [], DIMSUM: [], BAR: [], PRODUKSI: [] })
    setSuccessMessage('')
    setFilesByStation({})
    setQcName('')
    setManagerName('')
    setTesterMode(false)
    setTesterChecks({})
    setTesterCollapsed(true)
    setRawPaste('')
    setPasteApplyIssues([])
    if (user) void deleteDraft(user.username, form).catch(() => undefined)
  }

  return (
    <div className="mx-auto max-w-4xl py-2" onClickCapture={markDirty} onChangeCapture={markDirty}>
      {progress && <ProgressOverlay progress={progress} />}
      {persistenceStatus && <div role="status" aria-live="polite" className="mb-3 flex items-center justify-between rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-400"><span>{persistenceStatus}</span>{persistenceStatus === 'Draft dipulihkan.' && <button type="button" onClick={() => setPersistenceStatus('')} aria-label="Tutup status draft">Tutup</button>}</div>}
      {queueItems.length > 0 && <section aria-label="Antrean sinkronisasi" className="mb-3 rounded-lg border border-warning-200 bg-warning-50 p-3 text-xs text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400"><p className="font-semibold">Antrean: {queueItems.length}</p>{queueItems.map((item) => <div key={item.id} className="mt-2 flex items-center justify-between gap-2"><span>{item.stations.join(', ')} • {item.businessDate} • {item.shift} • {item.state}{item.lastError ? `: ${item.lastError}` : ''}</span>{(item.state === 'retryable-failure' || item.state === 'manual-failure') && <button type="button" onClick={() => void retryQueueItem(item.id).then(() => syncQueue(item.userId, apiClient.fetch)).then(() => listQueue(item.userId)).then(setQueueItems)} className="rounded border border-warning-300 px-2 py-1 font-medium dark:border-warning-500/40">Coba Lagi</button>}{item.state === 'auth-required' && <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('auth:session-expired'))} className="rounded border border-warning-300 px-2 py-1 font-medium dark:border-warning-500/40">Login</button>}</div>)}</section>}

      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">{pasteMode ? 'Paste Format Waste' : 'Input Waste'}</h1>
          <p className="text-xs text-text-muted">Step {stepLabel(step, pasteMode)}</p>
        </div>
        {step !== 'config' && step !== 'success' && step !== 'paste' && (
          <button type="button" onClick={() => setStep(step === 'items' ? 'config' : 'items')} className="flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-text-muted hover:bg-surface-alt hover:text-text-primary"><ArrowLeft size={14} /> Config</button>
        )}
      </div>

      {step === 'paste' && (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Paste pesan WhatsApp Waste</h2>
            <p className="mt-1 text-xs text-text-muted">Parser akan membaca metadata, station, dan item. Setelah diterapkan, semua data masih bisa diedit di form biasa.</p>
          </div>
          <textarea
            value={rawPaste}
            onChange={(event) => { setRawPaste(event.target.value); setPasteApplyIssues([]) }}
            rows={16}
            placeholder={'*WASTE OPENING*\n05-08-2026\nQC : NAMA QC\nMANAGER : NAMA MANAGER\nJAM PEMUSNAHAN : 15.04 WIB\nMETODE : DIBUANG\nKODE LOT : TANGGAL PEMUSNAHAN\n\n*NOODLE*\n- PANGSIT GORENG :18 PCS - PATAH & KUNCUP'}
            className="w-full rounded-lg border border-border bg-background px-3 py-3 font-mono text-xs text-text-primary outline-none placeholder:text-text-dim focus:border-brand-500"
          />

          {rawPaste.trim() && (
            <div className="rounded-lg border border-border bg-background p-3 text-xs text-text-muted">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <span>Tanggal: <strong className="text-text-primary">{parsedPaste.businessDate || '-'}</strong></span>
                <span>Shift: <strong className="text-text-primary">{parsedPaste.shift || '-'}</strong></span>
                <span>Jam: <strong className="text-text-primary">{parsedPaste.destructionTime || '-'}</strong></span>
                <span>Metode: <strong className="text-text-primary">{parsedPaste.method || '-'}</strong></span>
                <span>Kode Lot: <strong className="text-text-primary">{parsedPaste.lotCode || '-'}</strong></span>
                <span>Item valid: <strong className="text-text-primary">{parsedPaste.items.length}</strong></span>
              </div>
            </div>
          )}

          {rawPaste.trim() && parsedPaste.errors.length > 0 && (
            <PasteIssues title="Perlu diperbaiki" issues={parsedPaste.errors} tone="danger" />
          )}
          {rawPaste.trim() && parsedPaste.warnings.length > 0 && (
            <PasteIssues title="Peringatan parser" issues={parsedPaste.warnings} tone="warning" />
          )}
          {rawPaste.trim() && pasteCatalogWarnings.length > 0 && (
            <PasteIssues title="Produk manual" issues={pasteCatalogWarnings} tone="warning" />
          )}
          {pasteApplyIssues.length > 0 && (
            <PasteIssues title="Belum bisa diterapkan" issues={pasteApplyIssues} tone="danger" />
          )}
          {rawPaste.trim() && catalogLoading && <p className="text-xs text-text-muted">Memuat catalog untuk cek exact match...</p>}
          {rawPaste.trim() && !catalogLoading && !catalogError && !pastedQC && <p className="text-xs text-error-600 dark:text-error-400">QC dari paste belum cocok dengan personnel aktif.</p>}
          {rawPaste.trim() && !catalogLoading && !catalogError && !pastedManager && <p className="text-xs text-error-600 dark:text-error-400">Manager dari paste belum cocok dengan personnel aktif.</p>}

          <button
            type="button"
            onClick={applyPaste}
            disabled={!rawPaste.trim() || parsedPaste.errors.length > 0 || catalogLoading || Boolean(catalogError) || !pastedQC || !pastedManager}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-4 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Terapkan ke Form <ChevronRight size={16} />
          </button>
        </section>
      )}

      {step === 'config' && (
        <section className="space-y-4 rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
          {personnelMissing && (
            <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400">
              Data QC / Manager belum lengkap. Minta super admin lengkapin ya.
            </div>
          )}
          {catalogError && (
            <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400">
              Catalog item ada yang gagal dimuat. Coba refresh ya.
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Tanggal</label>
              <input type="date" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Shift</label>
              <select value={shift} onChange={(e) => setShift(e.target.value as (typeof SHIFTS)[number])} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500">{SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background px-3 py-3 text-xs text-text-muted">
            <div className="mb-2 flex items-center justify-between">
              <span>{selectedStations.length} station dipilih. Nanti disubmit per station ya.</span>
              <button type="button" onClick={toggleAllStations} className="font-semibold text-brand-600 dark:text-brand-400">{selectedStations.length === STATIONS.length ? 'Reset' : 'Pilih Semua'}</button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {STATIONS.map((s) => (
                <button key={s} type="button" onClick={() => toggleStation(s)} className={`rounded-lg border px-3 py-3 text-xs font-semibold transition ${selectedStations.includes(s) ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'border-border bg-surface text-text-muted hover:bg-surface-alt hover:text-text-primary'}`}>{s}</button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-background p-3">
            <label className="flex items-start gap-3"><input type="checkbox" checked={testerMode} onChange={(e) => setTesterMode(e.target.checked)} className="mt-1" /><div><p className="text-sm font-semibold text-text-primary">Tester Mode</p><p className="text-xs text-text-muted">Checklist observasi akhir shift.</p></div></label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">QC</label>
              <select value={qcName} onChange={(e) => setQcName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500"><option value="">-- Pilih QC --</option>{qcList.map((p) => <option key={p.name} value={p.full_name || p.name}>{p.full_name || p.name}</option>)}</select>
              {selectedQC?.signature_url && <AuthenticatedImage src={selectedQC.signature_url} alt={selectedQC.full_name || selectedQC.name} className="mt-2 h-14 rounded-lg border border-border bg-white p-1" />}
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">Manager</label>
              <select value={managerName} onChange={(e) => setManagerName(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500"><option value="">-- Pilih Manager --</option>{managerList.map((p) => <option key={p.name} value={p.full_name || p.name}>{p.full_name || p.name}</option>)}</select>
              {selectedManager?.signature_url && <AuthenticatedImage src={selectedManager.signature_url} alt={selectedManager.full_name || selectedManager.name} className="mt-2 h-14 rounded-lg border border-border bg-white p-1" />}
            </div>
          </div>

          {/* Inline validation hints */}
          {!qcName && <p className="text-[11px] text-warning-600 dark:text-warning-400">⚠️ QC belum dipilih</p>}
          {!managerName && <p className="text-[11px] text-warning-600 dark:text-warning-400">⚠️ Manager belum dipilih</p>}
          {!testerMode && selectedStations.length === 0 && <p className="text-[11px] text-warning-600 dark:text-warning-400">⚠️ Pilih minimal 1 station atau aktifin tester mode</p>}

          <button type="button" disabled={personnelMissing || !qcName || !managerName || (!testerMode && selectedStations.length === 0)} onClick={() => { setExpandedStation(selectedStations[0] || 'NOODLE'); setStep('items') }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-4 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">Pilih Item {selectedStations.length ? `(${selectedStations.length} Station)` : ''} <ChevronRight size={16} /></button>
        </section>
      )}

      {step === 'items' && (
        <section className="space-y-4">
          <div className="flex items-start justify-between rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Pilih Item Waste</h2>
              <p className="text-xs text-text-muted">{shift} • {businessDate} • {selectedStations.length} station dipilih</p>
            </div>
          </div>

          <details className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
            <summary className="cursor-pointer text-xs font-semibold text-text-primary">Tips Input</summary>
            <ul className="mt-3 list-disc pl-5 text-xs text-text-muted">
              <li>Bisa pilih banyak station sekaligus.</li>
              <li>Fokus satu station yang lagi dibuka aja.</li>
              <li>Pas nambah item, row lama auto nutup biar ga scroll panjang.</li>
              <li>Item yang udah dipilih ga muncul lagi di dropdown.</li>
            </ul>
          </details>

          {hasSelectedStations && selectedStations.map((station) => {
            const rows = rowsByStation[station]
            const itemCount = rows.filter((r) => r.namaProduk.trim() !== '').length
            const isOpen = expandedStation === station

            const stationUI = STATION_UI[station]

            return (
              <section key={station} className={`rounded-xl border-2 bg-surface shadow-theme-xs ${isOpen ? `${stationUI.borderClass} ${stationUI.bgClass}` : 'border-border'}`}>
                <button type="button" onClick={() => setExpandedStation(station)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                    <div>
                      <div className={`text-sm font-semibold ${isOpen ? stationUI.textClass : 'text-text-primary'}`}>{station}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-text-muted">
                        <span>{itemCount} item terisi</span>
                        <span>•</span>
                        <span>{rows.length} baris</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${isOpen ? `${stationUI.borderClass} ${stationUI.bgClass} ${stationUI.textClass}` : 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400'}`}>{itemCount}</span>
                      <ChevronDown size={16} className={`transition-transform ${isOpen ? `rotate-180 ${stationUI.textClass}` : 'text-text-muted'}`} />
                    </div>
                </button>

                {isOpen && (
                  <div className="border-t border-border px-4 pb-4 pt-2">
                    {rows.length === 0 && <div className="rounded-lg border border-dashed border-border bg-background px-3 py-4 text-xs text-text-muted">Belum ada item nih. Tap Tambah Item di bawah.</div>}

                    <div className="space-y-2">
                      {rows.map((row, index) => {
                        const isCollapsed = collapsedRows[station].includes(row.id)
                        return (
                          <div key={row.id} className="rounded-xl border border-border bg-background">
                            <div className="flex items-center justify-between gap-2 px-3 py-2">
                              <button type="button" onClick={() => toggleRowCollapse(station, row.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                                <ChevronDown size={14} className={`shrink-0 text-text-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                                <span className="text-[10px] font-semibold text-text-muted">#{index + 1}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="truncate text-sm font-medium text-text-primary">{row.namaProduk || 'Pilih item...'}</div>
                                  {isCollapsed && (
                                    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-text-muted">
                                      <span className="rounded-full border border-border px-2 py-0.5">{row.jumlahProduk > 0 ? `${row.jumlahProduk} ${row.unit}` : 'Qty belum diisi'}</span>
                                      <span className="rounded-full border border-border px-2 py-0.5">{row.alasanPemusnahan || 'Alasan kosong'}</span>
                                    </div>
                                  )}
                                </div>
                              </button>
                              {rows.length > 1 && <button type="button" onClick={() => removeRow(station, row.id)} className="text-error-500 hover:text-error-600"><Trash2 size={14} /></button>}
                            </div>

                            {!isCollapsed && (
                              <div className="grid gap-2 border-t border-border px-3 py-3 md:grid-cols-2">
                                <div className="md:col-span-2">
                                  <select value={row.isManual && row.namaProduk ? '__MANUAL__' : row.namaProduk} onChange={(e) => selectProduct(station, row.id, e.target.value)} className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none focus:border-brand-500">
                                    <option value="">-- Pilih Produk --</option>
                                    {getAvailableOptions(station, row.id).filter((c) => !c.is_manual).map((c) => <option key={c.id} value={c.nama_produk}>{c.nama_produk}</option>)}
                                    <option value="__MANUAL__">LAINNYA (isi manual)</option>
                                  </select>
                                </div>

                                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                                  <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">QTY</label>
                                  <input type="number" min={1} inputMode="numeric" placeholder="Isi Quantity" value={row.jumlahProduk === 0 ? '' : String(row.jumlahProduk)} onChange={(e) => updateRow(station, row.id, { jumlahProduk: e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0 })} className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-dim" />
                                </div>

                                {row.isManual && (
                                  <div className="rounded-lg border border-border bg-surface px-3 py-2">
                                    <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">NAMA MANUAL</label>
                                    <input type="text" placeholder="Nama produk manual" value={row.namaProduk} onChange={(e) => updateRow(station, row.id, { namaProduk: e.target.value.toUpperCase() })} className="w-full bg-transparent text-sm text-text-primary outline-none" />
                                  </div>
                                )}

                                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                                  <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">KODE LOT</label>
                                  {KODE_LOT_DATE_PICKER_ITEMS.includes(row.namaProduk) ? (
                                    <input type="date" value={row.kodeProduk.length === 8 ? `${row.kodeProduk.slice(4)}-${row.kodeProduk.slice(2,4)}-${row.kodeProduk.slice(0,2)}` : ''} onChange={(e) => updateRow(station, row.id, { kodeProduk: e.target.value ? dateToDDMMYYYY(e.target.value) : '' })} className="w-full bg-transparent text-sm text-text-primary outline-none" />
                                  ) : (
                                    <input type="text" value={row.kodeProduk} readOnly className="w-full bg-transparent text-sm text-text-muted outline-none cursor-default" />
                                  )}
                                </div>

                                <div className="rounded-lg border border-border bg-surface px-3 py-2">
                                  <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">ALASAN WASTE</label>
                                  <input type="text" placeholder="Alasan Waste" value={row.alasanPemusnahan} onChange={(e) => updateRow(station, row.id, { alasanPemusnahan: e.target.value.toUpperCase() })} className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-dim" />
                                </div>

                                <div className="md:col-span-2 rounded-lg border border-border bg-surface px-3 py-2">
                                  <label className="mb-1 block text-[10px] font-semibold uppercase text-text-muted">METODE MUSNAH</label>
                                  <select value={row.metodePemusnahan} onChange={(e) => updateRow(station, row.id, { metodePemusnahan: e.target.value })} className="w-full bg-transparent text-sm text-text-primary outline-none">{METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                                </div>

                                <div className="md:col-span-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-text-muted">
                                  Satuan default: <span className="font-medium text-text-primary">{row.unit || '-'}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    <div className="mt-4 border-t border-border pt-4">
                      <button type="button" onClick={() => addRow(station)} className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-transparent py-3 text-sm font-medium text-text-muted transition hover:border-brand-500 hover:text-brand-500"><Plus size={16} /> Tambah Item</button>
                    </div>
                  </div>
                )}
              </section>
            )
          })}

          {testerMode && (
            <section className="rounded-xl border border-border bg-surface shadow-theme-xs">
              <button type="button" onClick={() => setTesterCollapsed((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Tester Checklist</h2>
                  <p className="text-[11px] text-text-muted">Default normal, edit kalo ada issue aja.</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 text-[10px] font-semibold text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400">{testerIssueCount} issue</span>
                  <ChevronDown size={16} className={`text-text-muted transition-transform ${testerCollapsed ? '' : 'rotate-180'}`} />
                </div>
              </button>
              {!testerCollapsed && (
                <div className="border-t border-border px-4 pb-4 pt-3">
                  <div className="space-y-2">{TESTER_ITEMS.map((item) => <label key={item.name} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary"><div><p className="font-medium">{item.name}</p><p className="text-[11px] text-text-muted">{item.station}</p></div><input type="checkbox" checked={testerChecks[item.name] ?? true} onChange={(e) => setTesterChecks((prev) => ({ ...prev, [item.name]: e.target.checked }))} /></label>)}</div>
                </div>
              )}
            </section>
          )}

          <button type="button" onClick={() => {
            if (!hasSelectedStations && !testerMode) { toast.warning('Belum ada data', 'Pilih station atau aktifin tester mode.'); return }
            if (hasSelectedStations && totalValidItems === 0) { toast.warning('Belum ada item', 'Isi minimal 1 item dulu.'); return }
            // Validate qty > 0 and alasan filled for all valid items
            if (hasSelectedStations) {
              for (const station of selectedStations) {
                for (const row of rowsByStation[station]) {
                  if (row.namaProduk.trim() === '') continue
                  if (row.jumlahProduk <= 0) { toast.error('Eh, ada yang kurang', `Qty belum diisi di item "${row.namaProduk}" (${station}).`); return }
                  if (!row.alasanPemusnahan.trim()) { toast.error('Eh, ada yang kurang', `Alasan waste belum diisi di item "${row.namaProduk}" (${station}).`); return }
                }
              }
            }
            setStep('preview')
          }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 py-4 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">Cek & Preview <ChevronRight size={16} /></button>
        </section>
      )}

      {step === 'preview' && (
        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-surface px-4 py-3 shadow-theme-xs">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
              <span>Tanggal: <strong className="text-text-primary">{businessDate}</strong></span>
              <span>Shift: <strong className="text-text-primary">{shift}</strong></span>
              <span>Station: <strong className="text-text-primary">{testerMode ? 'TESTER' : selectedStations.join(', ')}</strong></span>
              <span>QC: <strong className="text-text-primary">{qcName || '-'}</strong></span>
              <span>Manager: <strong className="text-text-primary">{managerName || '-'}</strong></span>
              {pasteMode && <span>Waktu pemusnahan: <strong className="text-text-primary">{parsedPaste.destructionTime || '-'}</strong></span>}
              {pasteMode && <span>Kode lot: <strong className="text-text-primary">{parsedPaste.lotCode || '-'}</strong></span>}
            </div>
          </div>

          {hasSelectedStations && selectedStations.map((station) => {
            const stationRows = rowsByStation[station].filter((r) => r.namaProduk.trim() !== '')
            if (!stationRows.length) return null
            return (
              <div key={station} className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs">
                <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold text-text-primary">{station}</h3><span className="text-xs text-text-muted">{stationRows.length} item</span></div>
                <div className="mb-3 flex flex-wrap gap-2">{stationRows.map((row, idx) => <span key={idx} className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-text-muted">{row.namaProduk} <strong className="text-text-primary">×{row.jumlahProduk}</strong> {row.unit}</span>)}</div>
                <MultiFileUpload files={filesByStation[station] || []} onChange={(f) => setFilesByStation((prev) => ({ ...prev, [station]: f }))} />
              </div>
            )
          })}

          {testerMode && (
            <div className="rounded-xl border border-border bg-surface p-4 shadow-theme-xs"><h3 className="mb-3 text-sm font-semibold text-text-primary">Checklist Tester</h3><div className="space-y-2">{TESTER_ITEMS.map((item) => <div key={item.name} className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-text-muted"><div className="mb-1 font-medium text-text-primary">{item.name}</div><div>Status: <span className={testerChecks[item.name] ?? true ? 'text-success-600 dark:text-success-400' : 'text-warning-600 dark:text-warning-400'}>{testerChecks[item.name] ?? true ? 'OK' : 'Kendala'}</span></div></div>)}</div></div>
          )}

          <button type="button" onClick={handleSubmit} disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-success-500 py-4 text-sm font-medium text-white shadow-theme-xs transition hover:bg-success-600 disabled:opacity-50">{loading ? <ButtonLoadingSpinner /> : null}{loading ? 'Nyimpen...' : `Kirim ${testerMode ? 'Tester' : `${selectedStations.length} Station`}`}</button>
        </section>
      )}

      {step === 'success' && (
        <section className="rounded-xl border border-success-200 bg-success-50 p-6 text-center shadow-theme-xs dark:border-success-500/20 dark:bg-success-500/10"><div className="mb-3 flex justify-center"><CheckCircle2 size={48} className="text-success-500" /></div><h2 className="mb-2 text-xl font-semibold text-success-700 dark:text-success-400">Mantap, Tersimpan!</h2><p className="mb-5 text-sm text-text-primary">{successMessage}</p><div className="mb-6 space-y-1 text-xs text-text-muted"><p>Tanggal: {businessDate}</p><p>Shift: {shift}</p><p>Station: {testerMode ? 'TESTER' : selectedStations.join(', ')}</p><p>QC: {qcName || '-'}</p><p>Manager: {managerName || '-'}</p></div><button type="button" onClick={resetForm} className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600">Shift Baru</button></section>
      )}
    </div>
  )
}



function PasteIssues({ title, issues, tone }: { title: string; issues: PasteIssue[]; tone: 'danger' | 'warning' }) {
  const toneClass = tone === 'danger' ? 'border-error-200 bg-error-50 text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-400' : 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-400'
  return (
    <div className={`rounded-lg border px-3 py-3 text-xs ${toneClass}`}>
      <p className="mb-1 font-semibold">{title}</p>
      <ul className="list-disc space-y-1 pl-4">
        {issues.map((issue, index) => <li key={`${issue.line}-${index}`}>{issue.line > 0 ? `Baris ${issue.line}: ` : ''}{issue.message}</li>)}
      </ul>
    </div>
  )
}

function stepLabel(step: Step, pasteMode: boolean) {
  if (pasteMode) {
    switch (step) {
      case 'paste': return '1/5 • Paste'
      case 'config': return '2/5 • Config'
      case 'items': return '3/5 • Item'
      case 'preview': return '4/5 • Preview'
      case 'success': return '5/5 • Done'
    }
  }
  switch (step) {
    case 'paste': return '1/4 • Paste'
    case 'config': return '1/4 • Config'
    case 'items': return '2/4 • Item'
    case 'preview': return '3/4 • Preview'
    case 'success': return '4/4 • Done'
  }
}
