import { z } from 'zod'

// ─── Auth ──────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
})

export type LoginInput = z.infer<typeof loginSchema>

// ─── Enums ─────────────────────────────────────────────
export const STATIONS = ['NOODLE', 'DIMSUM', 'BAR', 'PRODUKSI'] as const
export type Station = (typeof STATIONS)[number]

export const SHIFTS = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'] as const
export type Shift = (typeof SHIFTS)[number]

export const UNITS = ['PORSI', 'PCS', 'GRAM', 'PACK'] as const
export type Unit = (typeof UNITS)[number]

export const METHODS = ['DIBUANG', 'DIMUSNAHKAN', 'DIBERIKAN KE PIHAK KETIGA'] as const
export const REASONS = ['EXPIRED', 'RUSAK', 'OVER PRODUKSI', 'SALAH PRODUKSI', 'TESTER'] as const

// ─── Waste Submission ──────────────────────────────────
export const wasteItemSchema = z.object({
  namaProduk: z.string().min(1, 'Nama produk wajib'),
  kodeProduk: z.string().default(''),
  jumlahProduk: z.number().int().min(1, 'Jumlah minimal 1'),
  unit: z.string().min(1, 'Satuan wajib'),
  metodePemusnahan: z.string().default('DIBUANG'),
  alasanPemusnahan: z.string().default(''),
  jamTanggalPemusnahan: z.string().default(''),
})

export type WasteItem = z.infer<typeof wasteItemSchema>

export const submitWasteSchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal YYYY-MM-DD'),
  kategoriInduk: z.enum(STATIONS),
  shift: z.enum(SHIFTS).default('OPENING'),
  storeName: z.string().default('BEKASI KP. BULU'),
  items: z.array(wasteItemSchema).min(1, 'Minimal 1 produk'),
  parafQCUrl: z.string().default(''),
  parafQCName: z.string().default(''),
  parafManagerUrl: z.string().default(''),
  parafManagerName: z.string().default(''),
})

export type SubmitWasteInput = z.infer<typeof submitWasteSchema>

// ─── Shift Status ──────────────────────────────────────
export const shiftStatusSchema = z.object({
  done: z.boolean(),
  submittedBy: z.string().nullable(),
  submittedAt: z.string().nullable(),
})

export type ShiftStatus = z.infer<typeof shiftStatusSchema>
