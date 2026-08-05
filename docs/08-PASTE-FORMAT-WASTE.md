# 08 — Paste Format Waste

## UI

Halaman **Waste** menyediakan dua pilihan: **Input Manual** dan **Paste Format Waste**.

Paste memakai route `/paste-waste`. Setelah teks diparse dan diterapkan, pengguna tetap memakai form waste yang sama untuk meninjau atau mengubah item, memilih foto dokumentasi per station, preview, lalu submit. Endpoint submit tidak berubah.

## Format WhatsApp

Gunakan struktur berikut. Heading WASTE dan heading station harus memakai tanda `*`.

```text
*WASTE OPENING*
05-08-2026
QC : PAJAR HIDAYAT
MANAGER : PAK IRFAN
JAM PEMUSNAHAN : 15.04 WIB
METODE : DIBUANG
KODE LOT : TANGGAL PEMUSNAHAN

*NOODLE*
- PANGSIT GORENG :18 PCS - PATAH & KUNCUP

*BAR*
- PEAR :135 GR - SUSUT
```

Catatan:

- Tanggal wajib `DD-MM-YYYY` dan disimpan sebagai `YYYY-MM-DD`.
- Shift wajib `OPENING`, `MIDDLE`, `CLOSING`, atau `MIDNIGHT`.
- Jam menerima `HH.MM WIB` atau `HH:MM WIB`, lalu menjadi `HH:MM`.
- Unit yang valid: `PORSI`, `PCS`, `GRAM`/`GR`, dan `PACK`; `GR` dinormalisasi menjadi `GRAM`.
- `KODE LOT : TANGGAL PEMUSNAHAN` menghasilkan kode lot `DDMMYYYY` dari tanggal di atas.
- QC dan Manager harus cocok dengan personnel aktif (tanpa membedakan huruf besar/kecil) sebelum hasil bisa diterapkan.
- Nama produk hanya dicocokkan secara exact tanpa membedakan huruf besar/kecil. Nama yang tidak ada di catalog tetap menjadi item manual dan diberi peringatan; aplikasi tidak melakukan koreksi nama secara otomatis.
- Saat memakai paste, jam pemusnahan yang telah diparse dipakai ketika submit. Pada input manual, jam submit tetap mengikuti waktu WIB saat submit.
