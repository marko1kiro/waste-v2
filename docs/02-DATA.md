# 02 — DATA: Station & Item Catalog

## 1. Station: NOODLE 🍜

Semua produk mie.

| Produk | Unit | Kode Lot Wajib? | Catatan |
|--------|------|-----------------|---------|
| PANGSIT GORENG | PCS | ❌ | |
| MIE GACOAN LEVEL 0 | PORSI | ❌ | Level 0 (tidak pedas) |
| MIE GACOAN LEVEL 1 | PORSI | ❌ | Level 1 |
| MIE GACOAN LEVEL 2 | PORSI | ❌ | Level 2 |
| MIE GACOAN LEVEL 3 | PORSI | ❌ | Level 3 |
| MIE GACOAN LEVEL 4 | PORSI | ❌ | Level 4 |
| MIE GACOAN LEVEL 6 | PORSI | ❌ | Level 6 |
| MIE GACOAN LEVEL 8 | PORSI | ❌ | Level 8 |
| MIE HOMPIMPA LEVEL 1 | PORSI | ❌ | |
| MIE HOMPIMPA LEVEL 2 | PORSI | ❌ | |
| MIE HOMPIMPA LEVEL 3 | PORSI | ❌ | |
| MIE HOMPIMPA LEVEL 4 | PORSI | ❌ | |
| MIE HOMPIMPA LEVEL 6 | PORSI | ❌ | |
| MIE HOMPIMPA LEVEL 8 | PORSI | ❌ | |
| PAPERBOX MIE | PCS | ❌ | |
| MIE POLOS | PCS | ✅ | Kode lot wajib (biasanya beda batch) |
| KERUPUK GORENG | GRAM | ❌ | |
| LAINNYA (isi manual) | — | — | Input manual nama + unit |

---

## 2. Station: DIMSUM 🥟

Semua produk dimsum.

| Produk | Unit | Kode Lot Wajib? | Catatan |
|--------|------|-----------------|---------|
| UDANG KEJU | PCS | ❌ | |
| UDANG RAMBUTAN | PCS | ❌ | |
| LUMPIA UDANG | PCS | ❌ | |
| SIOMAY AYAM | PCS | ❌ | |
| PAPERBOX DIMSUM | PCS | ❌ | |
| SURAI NAGA | GRAM | ✅ | Kode lot wajib |
| PENTOL | PCS | ✅ | Kode lot wajib |

---

## 3. Station: BAR 🍹

Semua produk bar (minuman, buah).

| Produk | Unit | Kode Lot Wajib? | Catatan |
|--------|------|-----------------|---------|
| APEL | GRAM | ❌ | Buah segar |
| PEAR | GRAM | ❌ | Buah segar |
| BELIMBING | GRAM | ❌ | Buah segar |
| JERUK NIPIS | GRAM | ❌ | |
| APEL BUSUK | GRAM | ❌ | Buah busuk (waste terpisah) |
| PEAR BUSUK | GRAM | ❌ | |
| BELIMBING BUSUK | GRAM | ❌ | |
| STROBERI SUSUT | GRAM | ❌ | Susut timbangan |
| STOBERI BUSUK | GRAM | ❌ | Stroberi busuk |
| CUP 16 | PCS | ❌ | Cup ukuran 16oz |
| CUP 14 | PCS | ❌ | Cup ukuran 14oz |
| CUP 12 | PCS | ❌ | Cup ukuran 12oz |
| LAINNYA (isi manual) | — | — | Input manual nama + unit |

---

## 4. Station: PRODUKSI 🏭

Bahan baku produksi.

| Produk | Unit | Kode Lot Wajib? | Catatan |
|--------|------|-----------------|---------|
| KULIT PANGSIT | GRAM | ✅ | Kode lot wajib (beda batch) |
| CABE RAWIT | GRAM | ❌ | |
| KERUPUK GORENG | GRAM | ❌ | |
| LAINNYA (isi manual) | — | — | Input manual nama + unit |

---

## 5. Tester Items (Station Observation Checklist)

Item yang dicek setiap akhir shift.

| Item | Station Asal |
|------|-------------|
| MIE GACOAN LV. 1 | NOODLE |
| UDANG KEJU | DIMSUM |
| UDANG RAMBUTAN | DIMSUM |
| LUMPIA UDANG | DIMSUM |
| ALL BIANG BAR | BAR |

Hasil pengecekan: ✅ atau ❌ (dengan catatan kendala).

---

## 6. Shift

| Shift | Waktu (WIB) | Default |
|-------|-------------|---------|
| OPENING | 05:00 – 11:59 | ✅ Default |
| MIDDLE | 12:00 – 16:59 | |
| CLOSING | 17:00 – 23:59 | |
| MIDNIGHT | 00:00 – 04:59 | |

---

## 7. Metode Pemusnahan

Nilai bebas (string), default suggestion:
- `DIBUANG`
- `DIMUSNAHKAN`
- `DIBERIKAN KE PIHAK KETIGA`

---

## 8. Alasan Pemusnahan

Nilai bebas (string), default suggestion:
- `EXPIRED`
- `RUSAK`
- `OVER PRODUKSI`
- `SALAH PRODUKSI`
- `TESTER`

---

## 9. Unit Satuan

| Unit | Tipe |
|------|------|
| PCS | Integer |
| PORSI | Integer |
| GRAM | Integer (gram) |
| PACK | Integer |

---

## 10. Personnel

### QC (Quality Control)
| Nama | Nama Lengkap | Catatan |
|------|-------------|---------|
| `QC1` | QC Contoh 1 | Contoh, akan diisi manual |

### Manager
| Nama | Nama Lengkap | Catatan |
|------|-------------|---------|
| `MGR1` | Manager Contoh 1 | Contoh, akan diisi manual |

### Rules
- `name` harus UPPERCASE, digunakan sebagai key di dropdown.
- `full_name` bebas format, untuk display.
- File signature disimpan di Vercel Blob, URL-nya disimpan di DB.
- Signature image harus di-upload via settings sebelum bisa dipakai.
