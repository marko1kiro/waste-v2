import { jsPDF } from 'jspdf'
import autoTableModule from 'jspdf-autotable'

const autoTable = (typeof autoTableModule === 'function' ? autoTableModule : (autoTableModule as unknown as { default: typeof autoTableModule }).default) as typeof autoTableModule

export interface PdfItem {
  station: string
  namaProduk: string
  kodeProduk: string
  jumlahProduk: unknown
  unit: string
  metodePemusnahan: string
  alasanPemusnahan: string
  jamTanggalPemusnahan: string
  parafQC: string
  parafQCName: string
  parafManager: string
  parafManagerName: string
  dokumentasi: string[]
}

export interface DailyPdfInput {
  date: string
  storeName: string
  storeCode: string
  publicUrl: string
  checklistUrl: string
  grouped: Record<string, PdfItem[]>
  assets: Map<string, string>
  assetLinks: Map<string, string>
}

const shifts = ['OPENING', 'MIDDLE', 'CLOSING', 'MIDNIGHT']
const formatDate = (date: string) => new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T00:00:00Z`))
const dayName = (date: string) => new Intl.DateTimeFormat('id-ID', { weekday: 'long', timeZone: 'Asia/Jakarta' }).format(new Date(`${date}T00:00:00Z`))

export function buildPdfFilename(storeCode: string, date: string): string {
  const [year, month, day] = date.split('-')
  const safeStoreCode = storeCode.replace(/[^A-Za-z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 64) || 'STORE'
  return `BA Waste ${safeStoreCode} - ${day}${month}${year}.pdf`
}

export function signatureCellLayout(cellHeight: number): { imageTop: number; imageHeight: number; nameY: number; minHeight: number } {
  const minHeight = 18
  const height = Math.max(cellHeight, minHeight)
  return { imageTop: 2, imageHeight: Math.max(6, height - 9), nameY: height - 2, minHeight }
}

export function containedSignatureSize(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number): { width: number; height: number } {
  const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight)
  return { width: sourceWidth * scale, height: sourceHeight * scale }
}

export function renderDailyPdf(input: DailyPdfInput): Uint8Array {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = 297
  const margin = 10
  const tableWidth = pageWidth - 2 * margin
  const columnWeights = [7.2, 14.4, 6.9, 5.7, 5.1, 7.2, 13.7, 5.8, 8.0, 8.7, 17.4]
  const columnWidths = columnWeights.map((weight) => tableWidth * weight / columnWeights.reduce((sum, value) => sum + value, 0))
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('PT. PESTA PORA ABADI', pageWidth / 2, 12, { align: 'center' })
  doc.setFontSize(10)
  doc.text('FORM PEMUSNAHAN PRODUK', pageWidth / 2, 19, { align: 'center' })
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Dok.No. PPA/FORM/OPS-STORE/016', pageWidth - margin, 10, { align: 'right' })
  doc.text(`Hari: ${dayName(input.date)}`, margin, 28)
  doc.text(`Tanggal: ${formatDate(input.date)}`, margin + 50, 28)
  doc.text(`Store: ${input.storeName}`, margin + 110, 28)

  let startY = 34
  const allItems = Object.values(input.grouped).flat()
  for (const shift of shifts) {
    const items = input.grouped[shift] || []
    if (!items.length) continue
    if (startY > 180) {
      doc.addPage()
      startY = 15
    }
    doc.setFillColor(80, 80, 80)
    doc.rect(margin, startY, tableWidth, 6, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.text(`WASTE ${shift}`, margin + 2, startY + 4)
    doc.setTextColor(0, 0, 0)
    startY += 8
    const stations = new Map<string, PdfItem[]>()
    for (const item of items) stations.set(item.station || 'UNKNOWN', [...(stations.get(item.station || 'UNKNOWN') || []), item])
    const rows = [...stations.entries()]
    const rowMeta = rows.map(([station, stationItems]) => ({ station, docs: [...new Set(stationItems.flatMap((item) => item.dokumentasi || []))].filter((url) => input.assets.has(url)).slice(0, 6) }))
    autoTable(doc, {
      startY,
       margin: { left: margin, right: margin },
       tableWidth,
       head: [['STATION', 'NAMA PRODUK', 'KODE LOT', 'QTY', 'SATUAN', 'METODE', 'ALASAN', 'JAM', 'TTD QC', 'TTD MANAJER', 'DOKUMENTASI']],
      body: rows.map(([station, stationItems]) => {
        const first = stationItems[0]
        return [station, stationItems.map((item) => item.namaProduk || '').join('\n'), stationItems.map((item) => item.kodeProduk || '-').join('\n'), stationItems.map((item) => String(item.jumlahProduk || '')).join('\n'), stationItems.map((item) => item.unit || '').join('\n'), stationItems.map((item) => item.metodePemusnahan || '').join('\n'), stationItems.map((item) => item.alasanPemusnahan || '').join('\n'), first.jamTanggalPemusnahan || '', '', '', '']
      }),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1.5, lineWidth: 0.1, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [80, 80, 80], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle' },
      columnStyles: { 0: { cellWidth: columnWidths[0] }, 1: { cellWidth: columnWidths[1] }, 2: { cellWidth: columnWidths[2] }, 3: { cellWidth: columnWidths[3], halign: 'center' }, 4: { cellWidth: columnWidths[4], halign: 'center' }, 5: { cellWidth: columnWidths[5] }, 6: { cellWidth: columnWidths[6] }, 7: { cellWidth: columnWidths[7], halign: 'center' }, 8: { cellWidth: columnWidths[8], halign: 'center' }, 9: { cellWidth: columnWidths[9], halign: 'center' }, 10: { cellWidth: columnWidths[10], halign: 'center', overflow: 'hidden' } },
       didParseCell: (data) => {
         if (data.section !== 'body') return
         if (data.column.index === 8 || data.column.index === 9) data.cell.styles.minCellHeight = signatureCellLayout(0).minHeight
         if (data.column.index !== 10) return
         const docs = rowMeta[data.row.index]?.docs || []
         if (docs.length) data.cell.styles.minCellHeight = Math.ceil(docs.length / 3) * 9 + 6
       },

      didDrawCell: (data) => {
        if (data.section !== 'body') return
        const first = rows[data.row.index]?.[1]?.[0]
        if (!first) return
        const signature = (url: string, name: string) => {
          const layout = signatureCellLayout(data.cell.height)
          const asset = input.assets.get(url)
          if (asset) {
            const dimensions = doc.getImageProperties(asset)
            const size = containedSignatureSize(dimensions.width, dimensions.height, data.cell.width - 4, layout.imageHeight)
            doc.addImage(asset, data.cell.x + (data.cell.width - size.width) / 2, data.cell.y + layout.imageTop + (layout.imageHeight - size.height) / 2, size.width, size.height)
          }
          doc.setFontSize(6)
          doc.text(name, data.cell.x + data.cell.width / 2, data.cell.y + layout.nameY, { align: 'center', maxWidth: data.cell.width - 2 })
        }
        if (data.column.index === 8) signature(first.parafQC, first.parafQCName || '')
        if (data.column.index === 9) signature(first.parafManager, first.parafManagerName || '')
        if (data.column.index !== 10) return
        const docs = rowMeta[data.row.index]?.docs || []
        const size = 8
        docs.forEach((url, index) => {
          const asset = input.assets.get(url)
          if (asset) doc.addImage(asset, data.cell.x + 4 + (index % 3) * 9, data.cell.y + 3 + Math.floor(index / 3) * 9, size, size)
        })
      },
    })
    startY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }
  const lastItem = input.grouped.MIDNIGHT?.at(-1) || allItems.at(-1)
  const signature = lastItem?.parafQC ? input.assets.get(lastItem.parafQC) : undefined
  const ttdX = pageWidth - margin - 55
  const ttdY = startY + 6
  doc.setFontSize(8)
  doc.text(`Bekasi, ${formatDate(input.date)}`, ttdX + 27, ttdY, { align: 'center' })
  if (signature) doc.addImage(signature, ttdX + 12.5, ttdY + 5, 30, 14)
  doc.line(ttdX, ttdY + 22, ttdX + 55, ttdY + 22)
  doc.setFont('helvetica', 'bold')
  doc.text(lastItem?.parafQCName || 'QC', ttdX + 27, ttdY + 27, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Quality Control', ttdX + 27, ttdY + 32, { align: 'center' })

  const documentationByShift = shifts.map((shift) => {
    const stations = new Map<string, string[]>()
    for (const item of input.grouped[shift] || []) {
      const station = item.station || 'UNKNOWN'
      const urls = stations.get(station) || []
      stations.set(station, [...new Set([...urls, ...(item.dokumentasi || [])])])
    }
    return { shift, stations: [...stations.entries()].filter(([, urls]) => urls.length) }
  }).filter(({ stations }) => stations.length)
  if (documentationByShift.length || input.checklistUrl) {
     const absoluteUrl = (url: string) => input.assetLinks.get(url) || new URL(url, input.publicUrl).href

    doc.addPage()
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Link Gambar/Dokumentasi Waste', margin, 12)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.text(`Resto: ${input.storeName}    |    Tanggal: ${formatDate(input.date)}`, margin, 17)
    const gap = 6
    const columnWidth = (pageWidth - margin * 2 - gap * (documentationByShift.length - 1)) / documentationByShift.length
    documentationByShift.forEach(({ shift, stations }, shiftIndex) => {
      const x = margin + shiftIndex * (columnWidth + gap)
      let y = 25
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(shift, x, y)
      y += 6
      stations.forEach(([station, urls], stationIndex) => {
        doc.setTextColor(0, 0, 0)
        doc.setFont('helvetica', 'bold')
        doc.text(`${stationIndex + 1}. ${station} :`, x, y)
        y += 4
        urls.forEach((url, imageIndex) => {
          const target = absoluteUrl(url)
          const label = `- Gambar ${imageIndex + 1}`
          doc.setTextColor(0, 102, 204)
          doc.setFont('helvetica', 'normal')
          doc.textWithLink(label, x + 3, y, { url: target })
          doc.line(x + 3, y + 0.5, x + 3 + doc.getTextWidth(label), y + 0.5)
          y += 4
        })
        y += 2
      })
    })
    doc.setTextColor(0, 0, 0)
    if (input.checklistUrl) {
      const target = absoluteUrl(input.checklistUrl)
      doc.setTextColor(0, 102, 204)
      doc.textWithLink('QC Checklist', margin, 198, { url: target })
      doc.line(margin, 198.5, margin + doc.getTextWidth('QC Checklist'), 198.5)
    }
  }
  return new Uint8Array(doc.output('arraybuffer'))
}
