# 01 — PRD: AWAS (Aplikasi Waste Always Simple)

## 1. Ringkasan (Executive Summary)

AWAS adalah aplikasi **pencatatan & pemusnahan produk** untuk outlet restoran
**PT. Pesta Pora Abadi**. Aplikasi ini menggantikan form kertas dengan sistem
digital untuk mencatat waste (produk rusak, expired, atau tidak layak jual)
dan menyimpannya di **Neon PostgreSQL** untuk reporting, dashboard, dan PDF.

### Core Business Flow

```
Koki/Staff → Catat Waste di AWAS → Upload Foto Bukti → Submit
  → Data masuk Neon PostgreSQL → Dashboard & PDF Report
```

### Kenapa rebuild dari nol?

1. Codebase saat ini terlalu kompleks dengan arsitektur **multi-tenant** yang
   tidak diperlukan lagi.
2. Project akan di-simplify menjadi **single-tenant** (1 resto, 1 DB,
   1 spreadsheet).
3. Banyak dead code, pola campur aduk, dan maintainability rendah.

---

## 2. Tujuan (Goals)

| # | Goal | Prioritas |
|---|------|-----------|
| 1 | Pencatatan waste digital menggantikan form kertas | P0 |
| 2 | Upload foto bukti pemusnahan (Blob storage) | P0 |
| 3 | Data waste tersimpan di Neon PostgreSQL | P0 |
| 4 | Tanda tangan digital QC & Manager | P0 |
| 5 | Dashboard visual (charts, summary) | P0 |
| 6 | PDF report harian | P1 |
| 7 | WhatsApp notification ke group | P1 |


---

## 3. User Persona

### a. QC Staff / Admin Store (pengguna utama)
**Karakteristik:**
- Bekerja di outlet restoran
- Setiap shift melakukan pengecekan waste
- Memasukkan data produk yang dibuang
- Memaraf (sign) sebagai QC
- Memastikan Manager juga memaraf
- Upload foto dokumentasi pemusnahan

### b. Super Admin (terpusat)
**Karakteristik:**
- Mengelola konfigurasi aplikasi
- Melihat dashboard semua data
- Mengelola user/personnel
- Export data & PDF

---

## 4. Alur (Flow) Utama

### 4.1 Manual Waste Entry
Alur paling umum untuk entry data waste per produk.

```
START
  │
  ▼
Pilih Shift (OPENING / MIDDLE / CLOSING / MIDNIGHT)
  │
  ├─── Pilih Station (NOODLE / DIMSUM / BAR / PRODUKSI)
  │      └── Bisa multi-station dalam 1 batch
  │
  ├─── Input Produk
  │      ├── Pilih dari catalog (dropdown)
  │      └── Atau input manual (nama + unit)
  │
  ├─── Input Qty, Alasan, Kode Lot (tanggal expired)
  │
  ├─── Tentukan Metode Pemusnahan (DIBUANG / DIMUSNAHKAN / DLL.)
  │
  ├─── Pilih QC & Manager (paraf digital dari personnel terdaftar)
  │
  ├─── Upload Foto Dokumentasi (max 10 file)
  │
  └─── SUBMIT
         │
         ├── Upload foto ke Blob storage
         ├── Data + URL foto disimpan ke Neon PostgreSQL
         ├── Shift status → Done ✅
         └── (Optional) Kirim WhatsApp notif
              │
              ▼
            SUCCESS
```

### 4.2 Auto Waste (Paste & Submit)
Untuk entry cepat dengan paste data terstruktur.

```
START
  │
  ▼
Paste teks format:
  "NAMA PRODUK (KODE LOT): QTY SATUAN ALASAN"
  Contoh: MIE GORENG (2025-03-09): 5 PCS EXPIRED
  │
  ▼
Auto-parse → Preview Data
  │
  ├── Koreksi jika ada error parsing
  └── Pilih QC, Manager, Upload Foto
       │
       ▼
      SUBMIT → Blob → Neon DB
```

### 4.3 Tester (Station Observation Checklist)
Pengecekan sisa bahan pada akhir shift.

```
Di akhir shift, QC mengecek item sisa:
  - MIE GACOAN LV. 1
  - UDANG KEJU
  - UDANG RAMBUTAN
  - LUMPIA UDANG
  - ALL BIANG BAR

Jika semua "OK" → semua aman & approved
Jika ada kendala → catat detail kendala
Simpan ke Neon DB (tabel product_destructions, station=TESTER)
Kirim WhatsApp notif (opsional)
```

---

## 5. Shift System

Business Day: **05:00 WIB cutoff**.

| Shift | Waktu | Emoji | Catatan |
|-------|-------|-------|---------|
| **OPENING** | 05:00 – 11:59 WIB | 🌅 | Morning prep shift |
| **MIDDLE** | 12:00 – 16:59 WIB | ☀️ | Lunch rush shift |
| **CLOSING** | 17:00 – 23:59 WIB | 🌆 | Dinner shift |
| **MIDNIGHT** | 00:00 – 04:59 WIB | 🌙 | Counts as previous business day |

### Shift Status & PDF Unlock Logic

Setiap business date memiliki 4 shift. Status per-shift:

| Status | Arti |
|--------|------|
| **Belum** | Belum ada data waste masuk |
| **Done ✅** | Sudah ada data waste yang di-submit untuk shift ini |

**PDF Unlock Rule:**
- ✅ PDF button **terkunci (disabled)** secara default
- ✅ User bisa submit waste kapan saja di shift manapun
- ✅ Setiap submit → data masuk DB + status shift jadi **Done ✅**
- ✅ **Hanya ketika MIDNIGHT shift sudah Done** → PDF button **unlocked (global)**
- ✅ Setelah unlock, **semua user** bisa generate PDF untuk business date itu
- ✅ PDF berisi: OPENING + MIDDLE + CLOSING + MIDNIGHT data

Ilustrasi timeline 1 business day:

```
05:00 WIB ─── ┌─────────────────────────────────────────────┐
              │         BUSINESS DATE: 09/06/26             │
              └─────────────────────────────────────────────┘

05:00-11:59 ─── OPENING submit ───▶ Status: Done ✅
12:00-16:59 ─── MIDDLE submit ─────▶ Status: Done ✅
17:00-23:59 ─── CLOSING submit ───▶ Status: Done ✅
00:00-04:59 ─── MIDNIGHT submit ──▶ Status: Done ✅
                                       │
                                       ▼
                              PDF UNLOCKED! 🔓
                              (global untuk semua user)

05:00 WIB ─── Next business day ───▶ Reset status shift baru
```

---

## 6. Kategori Station

| Station | Emoji | Deskripsi |
|---------|-------|-----------|
| **NOODLE** | 🍜 | Semua produk mie |
| **DIMSUM** | 🥟 | Semua produk dimsum |
| **BAR** | 🍹 | Minuman, fruits, cup |
| **PRODUKSI** | 🏭 | Bahan baku produksi |

---

## 7. Metode Pemusnahan

| Metode | Keterangan |
|--------|-----------|
| DIBUANG | Dibuang ke tempat sampah |
| DIMUSNAHKAN | Dimusnahkan (dihancurkan/dibakar) |
| DIBERIKAN KE PIHAK KETIGA | Diberikan untuk pakan ternak dll. |
| (bebas input) | Bisa diisi manual |

---

## 8. Alasan Pemusnahan

| Alasan | Keterangan |
|--------|-----------|
| EXPIRED | Melewati tanggal kadaluarsa |
| RUSAK | Packaging rusak, produk cacat |
| OVER PRODUKSI | Kelebihan produksi |
| SALAH PRODUKSI | Produksi gagal/salah |
| TESTER | Sample tester |
| (bebas input) | Bisa diisi manual |

---

## 9. Unit Satuan

| Unit | Untuk |
|------|-------|
| PORSI | Mie (1 porsi = 1 piring) |
| PCS | Potongan/unit (dimsum, pangsit) |
| GRAM | Bahan baku (cabe, kerupuk, buah) |
| PACK | Pack (paperbox) |

---

## 10. Non-Fungsional Requirements

| # | Requirement |
|---|-------------|
| NFR1 | **Timezone**: Semua logic pake WIB (Asia/Jakarta, GMT+7) |
| NFR2 | **Single-tenant**: 1 aplikasi untuk 1 resto |
| NFR7 | **Shift status**: Setiap shift punya status Done/Belum, ditampilkan di UI |
| NFR8 | **PDF unlock**: PDF hanya bisa di-generate setelah MIDNIGHT shift selesai |
| NFR9 | **Neon DB primary**: Semua data waste disimpan di PostgreSQL, bukan Sheets |
| NFR3 | **Offline resilience**: Form harus tetap bisa diisi (belum submit) walau offline |
| NFR4 | **Mobile-first**: PWA, responsive, bisa dipake di HP |
| NFR5 | **Dark theme**: UI theme gelap, cyberpunk/neo-brutalism style |
| NFR6 | **Bahasa Indonesia**: Semua UI pake bahasa Indonesia (informal/semi-formal) |
