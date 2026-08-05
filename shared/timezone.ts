/**
 * WIB Timezone Utilities
 * Semua logic pake WIB (Asia/Jakarta, GMT+7)
 * Business date cutoff: 05:00 WIB
 */

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000 // +7 hours in ms
const BUSINESS_CUTOFF_HOUR = 5 // 05:00 WIB

/**
 * Mendapatkan waktu WIB saat ini sebagai Date object
 */
export function getNowWIB(): Date {
  const now = new Date()
  return new Date(now.getTime() + WIB_OFFSET_MS + now.getTimezoneOffset() * 60 * 1000)
}

/**
 * Mendapatkan business date (YYYY-MM-DD) berdasarkan waktu WIB sekarang.
 * Sebelum 05:00 WIB → masih hari sebelumnya (MIDNIGHT shift).
 */
export function getBusinessDateWIB(date?: Date): string {
  const wib = date ? toWIB(date) : getNowWIB()
  const hour = wib.getHours()

  // Sebelum 05:00 WIB → hari sebelumnya
  if (hour < BUSINESS_CUTOFF_HOUR) {
    wib.setDate(wib.getDate() - 1)
  }

  return formatDateISO(wib)
}

/**
 * Mendapatkan shift saat ini berdasarkan jam WIB.
 */
export function getCurrentShiftWIB(date?: Date): 'OPENING' | 'MIDDLE' | 'CLOSING' | 'MIDNIGHT' {
  const wib = date ? toWIB(date) : getNowWIB()
  const hour = wib.getHours()

  if (hour >= 5 && hour < 12) return 'OPENING'
  if (hour >= 12 && hour < 17) return 'MIDDLE'
  if (hour >= 17 && hour <= 23) return 'CLOSING'
  return 'MIDNIGHT' // 00:00 - 04:59
}

/**
 * Convert any Date to WIB equivalent
 */
export function toWIB(date: Date): Date {
  return new Date(date.getTime() + WIB_OFFSET_MS + date.getTimezoneOffset() * 60 * 1000)
}

/**
 * Format Date ke YYYY-MM-DD
 */
export function formatDateISO(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Format Date ke DD/MM/YY
 */
export function formatDateDisplay(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = String(d.getFullYear()).slice(-2)
  return `${day}/${month}/${year}`
}

/**
 * Nama hari dalam bahasa Indonesia
 */
export function getDayNameWIB(date: Date | string): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const d = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
  return days[d.getDay()]
}

/**
 * Format jam WIB (HH:MM WIB)
 */
export function formatTimeWIB(date?: Date): string {
  const wib = date ? toWIB(date) : getNowWIB()
  const h = String(wib.getHours()).padStart(2, '0')
  const m = String(wib.getMinutes()).padStart(2, '0')
  return `${h}:${m} WIB`
}

/** Shift info for display */
export const SHIFT_META = {
  OPENING: { label: 'Opening', emoji: '\u{1F305}', time: '05:00 – 11:59' },
  MIDDLE: { label: 'Middle', emoji: '\u{2600}\u{FE0F}', time: '12:00 – 16:59' },
  CLOSING: { label: 'Closing', emoji: '\u{1F306}', time: '17:00 – 23:59' },
  MIDNIGHT: { label: 'Midnight', emoji: '\u{1F319}', time: '00:00 – 04:59' },
} as const

export type ShiftName = keyof typeof SHIFT_META
export const SHIFTS: ShiftName[] = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT']
