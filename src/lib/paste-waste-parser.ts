export const PASTE_STATIONS = ['NOODLE', 'DIMSUM', 'BAR', 'PRODUKSI'] as const
export const PASTE_SHIFTS = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT'] as const
export const PASTE_UNITS = ['PORSI', 'PCS', 'GRAM', 'PACK'] as const

export type PasteStation = (typeof PASTE_STATIONS)[number]
export type PasteShift = (typeof PASTE_SHIFTS)[number]
export type PasteUnit = (typeof PASTE_UNITS)[number]

export interface PasteIssue {
  line: number
  message: string
}

export interface ParsedPasteItem {
  line: number
  station: PasteStation
  namaProduk: string
  jumlahProduk: number
  unit: PasteUnit
  alasanPemusnahan: string
}

export interface PasteWasteParseResult {
  raw: string
  businessDate: string | null
  shift: PasteShift | null
  qcName: string | null
  managerName: string | null
  destructionTime: string | null
  method: string | null
  lotCode: string | null
  items: ParsedPasteItem[]
  errors: PasteIssue[]
  warnings: PasteIssue[]
}

function normalizeSpace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function findExact<T extends readonly string[]>(values: T, value: string): T[number] | null {
  const normalized = normalizeSpace(value).toUpperCase()
  return values.find((candidate) => candidate === normalized) || null
}

function isValidDate(day: number, month: number, year: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function addMissingMetadataErrors(result: PasteWasteParseResult, hasStation: boolean) {
  const required: Array<[keyof Pick<PasteWasteParseResult, 'businessDate' | 'shift' | 'qcName' | 'managerName' | 'destructionTime' | 'method' | 'lotCode'>, string]> = [
    ['shift', 'Judul WASTE dengan shift wajib ada.'],
    ['businessDate', 'Tanggal DD-MM-YYYY wajib ada.'],
    ['qcName', 'QC wajib ada.'],
    ['managerName', 'MANAGER wajib ada.'],
    ['destructionTime', 'JAM PEMUSNAHAN wajib ada.'],
    ['method', 'METODE wajib ada.'],
    ['lotCode', 'KODE LOT wajib ada.'],
  ]

  for (const [key, message] of required) {
    if (!result[key]) result.errors.push({ line: 0, message })
  }
  if (!hasStation) result.errors.push({ line: 0, message: 'Minimal satu heading station wajib ada.' })
  if (result.items.length === 0) result.errors.push({ line: 0, message: 'Minimal satu item waste yang valid wajib ada.' })
}

/**
 * Parser format WhatsApp Waste. Fungsi ini hanya membaca dan memvalidasi teks;
 * pencocokan catalog dan personnel dilakukan oleh UI karena datanya dinamis.
 */
export function parsePasteWaste(rawText: string): PasteWasteParseResult {
  const result: PasteWasteParseResult = {
    raw: rawText,
    businessDate: null,
    shift: null,
    qcName: null,
    managerName: null,
    destructionTime: null,
    method: null,
    lotCode: null,
    items: [],
    errors: [],
    warnings: [],
  }

  let currentStation: PasteStation | null = null
  let hasStation = false
  const lines = rawText.replace(/\r\n?/g, '\n').split('\n')

  for (let index = 0; index < lines.length; index += 1) {
    const line = index + 1
    const value = normalizeSpace(lines[index])
    if (!value) continue

    const titleMatch = value.match(/^\*?\s*WASTE\s+(.+?)\s*\*?$/i)
    if (titleMatch) {
      const parsedShift = findExact(PASTE_SHIFTS, titleMatch[1].replace(/\*/g, ''))
      if (!parsedShift) result.errors.push({ line, message: `Shift "${titleMatch[1]}" tidak valid.` })
      else if (result.shift) result.warnings.push({ line, message: 'Judul WASTE duplikat; judul terakhir dipakai.' })
      if (parsedShift) result.shift = parsedShift
      continue
    }

    const dateMatch = value.match(/^(\d{2})-(\d{2})-(\d{4})$/)
    if (dateMatch) {
      const day = Number(dateMatch[1])
      const month = Number(dateMatch[2])
      const year = Number(dateMatch[3])
      if (!isValidDate(day, month, year)) {
        result.errors.push({ line, message: `Tanggal "${value}" tidak valid.` })
      } else {
        if (result.businessDate) result.warnings.push({ line, message: 'Tanggal duplikat; tanggal terakhir dipakai.' })
        result.businessDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      }
      continue
    }

    const metadataMatch = value.match(/^(QC|MANAGER|JAM PEMUSNAHAN|METODE|KODE LOT)\s*:\s*(.*?)\s*$/i)
    if (metadataMatch) {
      const label = metadataMatch[1].toUpperCase()
      const metadataValue = normalizeSpace(metadataMatch[2])
      if (!metadataValue) {
        result.errors.push({ line, message: `${label} tidak boleh kosong.` })
        continue
      }

      if (label === 'QC') result.qcName = metadataValue
      if (label === 'MANAGER') result.managerName = metadataValue
      if (label === 'METODE') result.method = metadataValue
      if (label === 'JAM PEMUSNAHAN') {
        const timeMatch = metadataValue.match(/^(\d{1,2})[.:](\d{2})(?:\s*WIB)?$/i)
        if (!timeMatch) {
          result.errors.push({ line, message: 'JAM PEMUSNAHAN harus berformat HH.MM WIB atau HH:MM WIB.' })
        } else {
          const hours = Number(timeMatch[1])
          const minutes = Number(timeMatch[2])
          if (hours > 23 || minutes > 59) result.errors.push({ line, message: `JAM PEMUSNAHAN "${metadataValue}" tidak valid.` })
          else result.destructionTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
        }
      }
      if (label === 'KODE LOT') {
        const isDestructionDate = normalizeSpace(metadataValue).toUpperCase() === 'TANGGAL PEMUSNAHAN'
        if (isDestructionDate && !result.businessDate) {
          result.errors.push({ line, message: 'KODE LOT TANGGAL PEMUSNAHAN membutuhkan baris tanggal yang valid terlebih dahulu.' })
        } else {
          result.lotCode = isDestructionDate && result.businessDate
            ? result.businessDate.split('-').reverse().join('')
            : metadataValue
        }
      }
      continue
    }

    const stationMatch = value.match(/^\*+\s*(.+?)\s*\*+$/)
    if (stationMatch) {
      const parsedStation = findExact(PASTE_STATIONS, stationMatch[1])
      if (!parsedStation) {
        result.errors.push({ line, message: `Station "${stationMatch[1]}" tidak dikenal.` })
        currentStation = null
      } else {
        currentStation = parsedStation
        hasStation = true
      }
      continue
    }

    if (value.startsWith('-')) {
      if (!currentStation) {
        result.errors.push({ line, message: 'Item harus berada setelah heading station yang valid.' })
        continue
      }
      const itemMatch = value.match(/^-\s*(.+?)\s*:\s*(\d+)\s+([A-Za-z]+)\s*-\s*(.+?)\s*$/)
      if (!itemMatch) {
        result.errors.push({ line, message: 'Format item harus "- NAMA PRODUK :QTY UNIT - ALASAN".' })
        continue
      }
      const namaProduk = normalizeSpace(itemMatch[1])
      const jumlahProduk = Number(itemMatch[2])
      const rawUnit = itemMatch[3].toUpperCase()
      const unit = rawUnit === 'GR' ? 'GRAM' : rawUnit
      const alasanPemusnahan = normalizeSpace(itemMatch[4])
      const parsedUnit = findExact(PASTE_UNITS, unit)

      if (!namaProduk) result.errors.push({ line, message: 'Nama produk tidak boleh kosong.' })
      if (!Number.isInteger(jumlahProduk) || jumlahProduk <= 0) result.errors.push({ line, message: 'Qty harus berupa bilangan bulat lebih dari 0.' })
      if (!parsedUnit) result.errors.push({ line, message: `Unit "${rawUnit}" tidak valid. Gunakan PORSI, PCS, GRAM/GR, atau PACK.` })
      if (!alasanPemusnahan) result.errors.push({ line, message: 'Alasan waste tidak boleh kosong.' })
      if (namaProduk && jumlahProduk > 0 && parsedUnit && alasanPemusnahan) {
        result.items.push({ line, station: currentStation, namaProduk, jumlahProduk, unit: parsedUnit, alasanPemusnahan })
      }
      continue
    }

    if (/^\*+.*\*+$/.test(value)) {
      result.errors.push({ line, message: 'Heading harus berupa WASTE SHIFT atau nama station berbintang.' })
    } else {
      result.warnings.push({ line, message: 'Baris tidak dikenali dan diabaikan.' })
    }
  }

  addMissingMetadataErrors(result, hasStation)
  return result
}
