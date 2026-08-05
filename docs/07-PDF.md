# 07 — PDF: Format & Spesifikasi Report

## 1. PDF Configuration

| Parameter | Value |
|-----------|-------|
| Library | `jspdf` + `jspdf-autotable` (lazy-loaded) |
| Orientation | `landscape` |
| Unit | `mm` |
| Format | `a4` |
| Page Width | 297mm |
| Page Height | 210mm |
| Margin | 10mm (kiri & kanan) |
| Table Width | `pageWidth - 2 * margin` = 277mm |

---

## 2. Page Layout (Visual)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 10mm                                                                │
│                  PT. PESTA PORA ABADI          Dok.No. PPA/...   │
│                  FORM PEMUSNAHAN PRODUK                           │
│                                                                     │
│ Hari: Senin    Tanggal: 09/06/26    Store: BEKASI KP. BULU        │
│                                                                     │
│ ┌─────────────────────────────────────────────────────────────┐     │
│ │                     TABLE: autoTable                         │     │
│ │ NO │ NAMA PRODUK │ KODE │ JLH │ SATUAN │ METODE │ ... │ DOC │     │
│ ├────┼─────────────┼──────┼─────┼────────┼────────┼──────┼─────┤     │
│ │ 1  │ MIE GACOAN  │...   │  5  │ PORSI  │ DIBUANG│ ...  │ 📷  │     │
│ │    │             │      │     │        │        │      │     │     │
│ └─────────────────────────────────────────────────────────────┘     │
│                                                                     │
│ Diketahui Oleh :                                    [QC Sign]      │
│ _________________                                                    │
│ AM/RM                                                               │
│                                                                     │
│ ────────────────────────────────────────────────────────────────    │
│ Data waste ini bersifat Internal & Rahasia...                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Header (Bagian Atas)

### 3.1 Title
```js
doc.text('PT. PESTA PORA ABADI', pageWidth / 2, 12, { align: 'center' })
doc.text('FORM PEMUSNAHAN PRODUK', pageWidth / 2, 19, { align: 'center' })
```

| Baris | Text | X | Y | Align |
|-------|------|---|----|-------|
| 1 | `PT. PESTA PORA ABADI` | center | 12mm | center |
| 2 | `FORM PEMUSNAHAN PRODUK` | center | 19mm | center |

### 3.2 Document Number
```js
doc.text('Dok.No. PPA/FORM/OPS-STORE/016', pageWidth - margin, 10, { align: 'right' })
```

| Text | X | Y | Align |
|------|---|---|-------|
| `Dok.No. PPA/FORM/OPS-STORE/016` | 287mm (297-10) | 10mm | right |

### 3.3 Info Fields
```js
doc.text(`Hari: ${dayName}`, margin, infoY)             // X=10mm
doc.text(`Tanggal: ${dateDisplay}`, margin + 50, infoY) // X=60mm
doc.text(`Store: ${dayData.storeName}`, margin + 110, infoY) // X=120mm
```

| Field | X (mm) |
|-------|--------|
| Hari | 10 |
| Tanggal | 60 |
| Store | 120 |

`infoY` = Y position after header (dihitung dinamis).

### 3.4 Shift Section Header
Per-shift ada header sendiri dengan background:
```js
doc.rect(margin, startY, pageWidth - 2 * margin, 6, 'F') // Fill rectangle
doc.text(`WASTE ${shift}`, margin + 2, startY + 4)
```

| Param | Value |
|-------|-------|
| Rectangle X | `margin` = 10mm |
| Rectangle Y | `startY` (dinamis) |
| Rectangle Width | `pageWidth - 2*margin` = 277mm |
| Rectangle Height | 6mm |
| Fill Color | Default hitam (rgb 0,0,0) |
| Text | `WASTE OPENING` / `WASTE MIDDLE` / `WASTE CLOSING` / `WASTE MIDNIGHT` |
| Text X | `margin + 2` = 12mm |
| Text Y | `startY + 4` |

---

## 4. Table Specification

### 4.1 Column Headers
| # | Header | Key | Catatan |
|---|--------|-----|---------|
| 0 | NO | `no` | Nomor urut |
| 1 | NAMA PRODUK | `namaProduk` | |
| 2 | KODE PRODUK | `kodeProduk` | |
| 3 | JUMLAH | `jumlah` | |
| 4 | SATUAN | `unit` | |
| 5 | METODE | `metode` | |
| 6 | ALASAN | `alasan` | |
| 7 | JAM | `jam` | |
| 8 | QC | `qc` | Paraf QC (image) |
| 9 | MANAJER | `manajer` | Paraf Manager (image) |
| 10 | DOKUMENTASI | `dokumentasi` | Foto dokumentasi (image) |

### 4.2 Column Widths

#### Mode: Dengan foto dokumentasi
| Kolom | Width (mm) | Align | Notes |
|-------|-----------|-------|-------|
| NO | 10 | center | |
| NAMA PRODUK | 44 | left | |
| KODE PRODUK | 26 | left | |
| JUMLAH | 16 | center | |
| SATUAN | 18 | center | |
| METODE | 23 | left | |
| ALASAN | 38 | left | |
| JAM | 20 | left | |
| QC | 26 | center | Contains image |
| MANAJER | 26 | center | Contains image |
| DOKUMENTASI | 30 | center | Contains image |
| **Total** | **277** | | = pageWidth - 2*margin |

#### Mode: Tanpa foto dokumentasi
| Kolom | Width (mm) | Align |
|-------|-----------|-------|
| NO | 10 | center |
| NAMA PRODUK | 48 | left |
| KODE PRODUK | 26 | left |
| JUMLAH | 16 | center |
| SATUAN | 18 | center |
| METODE | 23 | left |
| ALASAN | 40 | left |
| JAM | 20 | left |
| QC | 26 | center |
| MANAJER | 26 | center |
| DOKUMENTASI | 24 | center |
| **Total** | **277** | |

### 4.3 Table Styles

#### Global Styles
```js
styles: {
  fontSize: 7,
  cellPadding: 1.5,
  lineWidth: 0.1,
  minCellHeight: 8,
  valign: 'middle'
}
```

#### Head Styles
```js
headStyles: {
  fillColor: [80, 80, 80],     // Gray
  textColor: [255, 255, 255],  // White
  fontStyle: 'bold',
  fontSize: 7,
  halign: 'center',
  valign: 'middle'
}
```

#### Theme
```js
theme: 'grid'
```

### 4.4 Data Rows
Setiap row berisi data waste. Untuk cell yang berisi multiple items (misal multi-produk dalam 1 row), gunakan `\n` delimiter secara vertikal.

---

## 5. Image Handling di Tabel

### 5.1 Signature Images (QC & Manager)
```js
doc.addImage(sigCache[qcUrl], 'PNG', cellX + (cellW - imgW) / 2, cellY + (cellH - imgH) / 2, imgW, imgH)
```

| Param | Value |
|-------|-------|
| Format | PNG |
| X | Center of cell: `cellX + (cellW - imgW) / 2` |
| Y | Center of cell: `cellY + (cellH - imgH) / 2` |
| Width | `imgW` (dihitung proporsional) |
| Height | `imgH` (dihitung proporsional) |

**Penempatan:** Signature gambar diposisikan **center** di dalam cell.

### 5.2 Documentation Photos
```js
try { doc.addImage(docPhotoCache[docUrl], 'JPEG', drawX, drawY, imgSize, imgSize) } catch {}
```

| Param | Value |
|-------|-------|
| Format | JPEG |
| X | `drawX` (posisi dalam cell, dinamis) |
| Y | `drawY` (posisi dalam cell, dinamis) |
| Width | `imgSize` (square aspect ratio) |
| Height | `imgSize` (square aspect ratio) |

**Penempatan:** Foto dokumentasi **square** dengan ukuran seragam.

---

## 6. Footer (Bagian Akhir)

### 6.1 Signature Section
```js
// Tanda tangan AM/RM
doc.text('Diketahui Oleh :', margin, startY)
doc.line(margin, startY + 15, margin + 50, startY + 15)
doc.text('AM/RM', margin + 12, startY + 20)

// QC Signature (right side)
const rightX = pageWidth - margin - 60   // 227mm
if (qcSigImg) doc.addImage(qcSigImg, 'JPEG', rightX + 10, startY + 2, 30, 10)
```

| Elemen | Posisi |
|--------|--------|
| Text "Diketahui Oleh :" | X=margin (10mm), Y=startY |
| Garis signature | X=10mm → 60mm, Y=startY+15 |
| Label "AM/RM" | X=22mm (10+12), Y=startY+20 |
| QC Image | X=237mm (227+10), Y=startY+2, W=30mm, H=10mm |

### 6.2 Footer Line
```js
const bottomY = pageHeight - 5  // 205mm
doc.line(margin + 30, bottomY - 3.5, pageWidth - margin - 30, bottomY - 3.5)
```

| Elemen | Posisi |
|--------|--------|
| Garis horizontal | X=40mm → 257mm, Y=201.5mm |

### 6.3 Footer Text
```js
doc.text("Data waste ini bersifat Internal & Rahasia serta terjaga keamanannya di database QC.", pageWidth / 2, bottomY, { align: "center" })
```

| Text | X | Y | Align |
|------|---|---|-------|
| "Data waste ini bersifat Internal & Rahasia..." | center | 205mm | center |

---

## 7. Page Break Logic

```js
// Before each shift table (kecuali shift pertama)
if (startY > pageHeight - 30 && shiftIdx < shifts.length - 1) {
  doc.addPage()
  startY = 15 // Reset Y untuk halaman baru
}
```

| Kondisi | Aksi |
|---------|------|
| `startY > pageHeight - 30` (≈180mm) dan bukan shift terakhir | Tambah halaman baru |
| `startY > pageHeight - 45` (≈165mm) sebelum footer | Tambah halaman baru |

---

## 8. Process Flow

```
START: Generate PDF
  │
  ├── Lazy-load jspdf + jspdf-autotable
  │
  ├── Fetch data dari GET /api/get-day-data?date=YYYY-MM-DD
  │
   ├── Pre-fetch images:
   │   ├── Signature QC (untuk semua shift)
   │   ├── Signature Manager (untuk semua shift)
   │   └── Documentation photos (untuk semua shift)
   │
   ├── Render Header:
   │   ├── Centered title
   │   ├── Document number
   │   └── Info fields
  │
  ├── For each shift (OPENING → MIDDLE → CLOSING → MIDNIGHT):
  │   ├── Shift header with background
  │   ├── autoTable with data rows
  │   │   ├── Inject QC signature image ke cell 8
  │   │   ├── Inject Manager signature image ke cell 9
  │   │   └── Inject documentation photo(s) ke cell 10
  │   └── Page break check
  │
  ├── Render Footer:
  │   ├── "Diketahui Oleh :" + signature line
  │   └── Confidential notice
  │
  └── Download PDF (doc.save('waste_report_YYYY-MM-DD.pdf'))
```

---

## 9. Image Cache Strategy

Untuk performa, semua gambar di-fetch terlebih dahulu sebelum render:

```js
// Cache structure
sigCache: Record<string, HTMLImageElement>     // { "proxyUrl": img }
docPhotoCache: Record<string, HTMLImageElement> // { "proxyUrl": img }

// Convert image to data URL via canvas
function imageToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  return canvas.toDataURL('image/jpeg', 0.8)
}

// Gunakan data URL di doc.addImage()
doc.addImage(dataUrl, 'JPEG', x, y, w, h)
```

---

## 10. Data Source

```js
// Fetch dari API
const res = await fetch(`/api/get-day-data?date=${date}`)
const dayData = await res.json()

// Structure:
dayData = {
  date: "2026-06-09",
  storeName: "BEKASI KP. BULU",
  grouped: {
    OPENING: [{ ... }, { ... }],  // Array of waste entries
    MIDDLE:  [{ ... }, { ... }],
    CLOSING: [{ ... }, { ... }],
    MIDNIGHT: [{ ... }, { ... }]
  },
  raw: [...] // All entries flat
}
```

PDF dapat dibuat untuk tanggal kalender valid. Backend mengecek `daily_records` secara langsung: jika record `MIDNIGHT` belum `done = true`, PDF dibuat on-demand tanpa Google Drive. Jika sudah selesai, backend mencari PDF dengan filename kanonis di folder backup Google Drive; PDF baru hanya dikirim setelah berhasil diunggah ke Drive.
