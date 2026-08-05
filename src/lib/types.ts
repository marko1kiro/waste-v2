/** Shared API response types — single source of truth */

export interface TenantConfigData {
  success: boolean
  data: { store_name: string; store_code: string; qc_checklist_url: string }
}

export interface ShiftStatusData {
  success: boolean
  date: string
  shifts: Record<string, { done: boolean; submittedBy: string | null; submittedAt: string | null }>
  pdfUnlocked: boolean
}

export interface PdfItem {
  station?: string
  namaProduk?: string
  kodeProduk?: string
  jumlahProduk?: number
  unit?: string
  metodePemusnahan?: string
  alasanPemusnahan?: string
  jamTanggalPemusnahan?: string
  parafQC?: string
  parafQCName?: string
  parafManager?: string
  parafManagerName?: string
  dokumentasi?: string[]
}

export interface ListBlobPdfsResponse {
  success: boolean
  month: string
  count: number
  pdfs: Array<{
    filename: string
    url: string
    downloadUrl: string
    size: number
    uploadedAt: string
  }>
}

export interface DashboardData {
  success: boolean
  availableDates: string[]
  summary: {
    totalDays: number
    totalItems: number
    totalQty: number
    avgItemsPerDay: number
    avgQtyPerDay: number
  }
  dailyData: Array<{
    date: string
    items: number
    qty: number
    stations: Record<string, number>
    shifts: Record<string, number>
  }>
  stationTotals: Record<string, number>
  shiftTotals: Record<string, number>
  topProducts: Array<{ name: string; count: number; qty: number }>
  lastEntry: { date: string; qc: string; station: string; shift: string } | null
}
