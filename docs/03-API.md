# Developer API Reference

Base URL produksi:

```text
https://www.gacoanku.my.id
```

API memakai JSON kecuali upload juga menerima Base64 JSON. Semua tanggal menggunakan format `YYYY-MM-DD`.

## 1. Authentication

### JWT

JWT dipakai untuk login, manajemen API key, admin, PDF, dashboard, dan endpoint lain yang tidak tercantum sebagai API-key compatible.

```http
Authorization: Bearer <JWT>
```

### API key

API key hanya berlaku untuk operasi waste berikut:

| Method | Endpoint | Fungsi |
|---|---|---|
| `POST` | `/api/upload-file` | Upload gambar/dokumen |
| `POST` | `/api/submit-waste` | Submit batch waste |
| `GET` | `/api/items` | List waste items |
| `POST` | `/api/items` | Create item |
| `PUT` | `/api/items?id=<id>` | Update item |
| `DELETE` | `/api/items?id=<id>` | Delete item |
| `GET` | `/api/get-day-data` | Baca data harian |
| `GET` | `/api/generate-pdf?date=YYYY-MM-DD` | Download PDF waste harian |

```http
Authorization: Bearer awas_live_<API_KEY>
Content-Type: application/json
```

API key tidak berlaku untuk login, Profile, generate/reveal/revoke key, admin, History Input, dashboard, PDF, tenant config, personnel, atau station-items.

### API-key lifecycle

API key dibuat dari **Profile → API Keys**. Pilihan expiry:

- `7`: aktif 7 hari
- `30`: aktif 30 hari
- `90`: aktif 90 hari
- `never`: tanpa expiry otomatis

Batas maksimal: **5 API key aktif per user**. Key revoked tetap tersimpan sebagai riwayat, tetapi langsung tidak valid. Raw key hanya ditampilkan setelah generate atau setelah verifikasi password. Simpan raw key di secret manager aplikasi integrator.

Jangan kirim key lewat URL, query string, source code, repository, screenshot, log, atau `localStorage`.

## 2. API-key Management

Semua endpoint bagian ini wajib memakai JWT, bukan API key.

### Create key

```bash
curl -X POST "https://www.gacoanku.my.id/api/admin/api-keys" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"name":"inventory-sync","expiry":"30"}'
```

Request:

| Field | Type | Required | Values |
|---|---|---:|---|
| `name` | string | yes | Nama integrasi, unik per user |
| `expiry` | string | yes | `7`, `30`, `90`, `never` |

Response `201` mengandung `rawKey`. Simpan segera; jangan log.

```json
{
  "success": true,
  "data": {
    "id": 12,
    "name": "inventory-sync",
    "key_prefix": "awas_live_ab12",
    "expires_at": "2026-08-27T00:00:00.000Z",
    "key_masked": "awas_live_ab12••••••••"
  },
  "rawKey": "awas_live_..."
}
```

Error umum:

- `400`: nama/expiry tidak valid
- `401`: JWT tidak ada atau expired
- `409`: nama aktif sudah dipakai atau batas 5 key aktif tercapai

### List keys

```bash
curl "https://www.gacoanku.my.id/api/admin/api-keys" \
  -H "Authorization: Bearer <JWT>"
```

Raw key tidak dikembalikan. Response menampilkan `key_masked`, status, expiry, waktu dibuat, dan terakhir digunakan.

### Reveal key

Reveal membutuhkan password akun dan hanya boleh untuk key milik user yang sedang login.

```bash
curl -X POST "https://www.gacoanku.my.id/api/admin/api-keys?operation=reveal" \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"id":12,"password":"PASSWORD_AKUN"}'
```

Response `200`:

```json
{"success":true,"rawKey":"awas_live_..."}
```

Password salah menghasilkan `403`. Key revoked/expired tidak dapat digunakan maupun direveal.

### Revoke key

```bash
curl -X DELETE "https://www.gacoanku.my.id/api/admin/api-keys?id=12" \
  -H "Authorization: Bearer <JWT>"
```

Response:

```json
{"success":true}
```

## 3. Upload File

Upload gambar terlebih dahulu. Gunakan `proxyUrl` yang dikembalikan saat mengirim waste.

```bash
curl -X POST "https://www.gacoanku.my.id/api/upload-file" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "filename":"waste-2026-07-28.jpg",
    "contentType":"image/jpeg",
    "base64":"/9j/4AAQSkZJRgABAQ...",
    "folder":"waste-docs"
  }'
```

| Field | Type | Required | Catatan |
|---|---|---:|---|
| `filename` | string | yes | Nama file asli |
| `contentType` | string | yes | Contoh `image/jpeg`, `image/png` |
| `base64` | string | yes | Boleh berupa raw Base64 atau Data URL |
| `folder` | string | no | Default `uploads` |

Response `200`:

```json
{
  "success": true,
  "blobUrl": "https://...",
  "proxyUrl": "/api/signatures?blobUrl=..."
}
```

`proxyUrl` adalah URL aplikasi untuk file private. Simpan URL tersebut pada `dokumentasiUrls`, bukan raw private blob URL.

## 4. Submit Waste Batch

Endpoint ini mengikuti flow submit UI dan menerima beberapa produk dalam satu station/date/shift.

```bash
curl -X POST "https://www.gacoanku.my.id/api/submit-waste" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "tanggal":"2026-07-28",
    "kategoriInduk":"NOODLE",
    "shift":"OPENING",
    "productList":["MIE GACOAN LEVEL 1"],
    "jumlahProdukList":[1],
    "kodeProdukList":[""],
    "unitList":["PCS"],
    "metodePemusnahanList":["DIBUANG"],
    "alasanPemusnahanList":["EXPIRED"],
    "jamTanggalPemusnahanList":["08:00"],
    "parafQCName":"QC Name",
    "parafManagerName":"Manager Name",
    "dokumentasiUrls":["/api/signatures?blobUrl=https%3A%2F%2F..."]
  }'
```

| Field | Type | Required | Aturan |
|---|---|---:|---|
| `tanggal` | string | yes | Tanggal valid `YYYY-MM-DD` |
| `kategoriInduk` | string | yes | `NOODLE`, `DIMSUM`, `BAR`, `PRODUKSI` |
| `shift` | string | yes | `OPENING`, `MIDDLE`, `CLOSING`, `MIDNIGHT` |
| `productList` | string[] | yes | Minimal 1, tidak boleh kosong |
| `jumlahProdukList` | number[] | yes | Panjang sama; semua finite dan `> 0` |
| `kodeProdukList` | string[] | yes | Panjang sama |
| `unitList` | string[] | yes | Panjang sama |
| `metodePemusnahanList` | string[] | yes | Panjang sama |
| `alasanPemusnahanList` | string[] | yes | Panjang sama, tidak kosong |
| `jamTanggalPemusnahanList` | string[] | yes | Panjang sama |
| `parafQCName` | string | yes | Tidak kosong |
| `parafManagerName` | string | yes | Tidak kosong |
| `dokumentasiUrls` | string[] | no | URL proxy hasil upload |

Satu kombinasi `tanggal + shift + kategoriInduk` hanya boleh disubmit sekali. Submit duplikat menghasilkan `409`.

Response sukses:

```json
{
  "success": true,
  "message": "Data waste NOODLE berhasil disimpan",
  "data": {
    "kategoriInduk": "NOODLE",
    "itemsProcessed": 1,
    "shift": "OPENING",
    "storeName": "BEKASI KP. BULU",
    "shiftDone": true
  }
}
```

## 5. Items CRUD

### List items

```bash
curl "https://www.gacoanku.my.id/api/items?date=2026-07-28&shift=OPENING&station=NOODLE" \
  -H "Authorization: Bearer <API_KEY>"
```

Parameter `date` wajib. `shift` dan `station` opsional.

Response `200`:

```json
{"success":true,"data":[{"id":42,"business_date":"2026-07-28","shift":"OPENING","kategori_induk":"NOODLE","nama_produk":"MIE","jumlah_produk":1}]}
```

### Create item

```bash
curl -X POST "https://www.gacoanku.my.id/api/items" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "business_date":"2026-07-28",
    "shift":"OPENING",
    "kategori_induk":"NOODLE",
    "nama_produk":"MIE",
    "jumlah_produk":1,
    "unit":"PCS",
    "alasan_pemusnahan":"EXPIRED",
    "paraf_qc_name":"QC Name",
    "paraf_manager_name":"Manager Name"
  }'
```

`jumlah_produk` harus angka finite dan lebih besar dari `0`. Field date, shift, station, product, reason, QC, dan manager mengikuti validasi Submit Waste.

### Update item

```bash
curl -X PUT "https://www.gacoanku.my.id/api/items?id=42" \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "jumlah_produk":2,
    "alasan_pemusnahan":"RUSAK"
  }'
```

PUT mempertahankan nilai lama untuk field yang tidak dikirim dan memvalidasi hasil gabungan.

### Delete item

```bash
curl -X DELETE "https://www.gacoanku.my.id/api/items?id=42" \
  -H "Authorization: Bearer <API_KEY>"
```

Response:

```json
{"success":true,"shiftCleared":false}
```

## 6. Get Day Data

```bash
curl "https://www.gacoanku.my.id/api/get-day-data?date=2026-07-28&shift=OPENING&station=NOODLE" \
  -H "Authorization: Bearer <API_KEY>"
```

Tanpa filter tambahan, endpoint mengembalikan data tanggal tersebut yang dikelompokkan berdasarkan shift. Dengan kombinasi `date`, `shift`, dan `station`, response dapat dipakai untuk mengecek apakah input sudah ada sebelum submit.

## 7. Generate PDF

`GET /api/generate-pdf?date=YYYY-MM-DD` menerima JWT atau API key Bearer. PDF dapat dibuat untuk setiap tanggal kalender valid, tanpa syarat submit shift `MIDNIGHT`; tanggal tanpa data tetap menghasilkan PDF valid.

```bash
curl "https://www.gacoanku.my.id/api/generate-pdf?date=2026-07-28" \
  -H "Authorization: Bearer <API_KEY_OR_JWT>" \
  --output "BA Waste STORE - 28072026.pdf"
```

Response `200` adalah bytes PDF, bukan JSON:

```http
Content-Type: application/pdf
Content-Disposition: attachment; filename="BA Waste {store_code} - DDMMYYYY.pdf"
Cache-Control: private, no-store
```

Dokumentasi serta paraf yang direferensikan pada data adalah aset PDF wajib. Jika salah satu aset wajib tidak dapat dibaca dari private Blob, response `502` dengan `{"error":"Required PDF image asset unavailable"}`; tidak ada PDF parsial. Link anotasi gambar dalam PDF memakai signed access token yang berlaku 10 menit; setelah expired, generate ulang PDF. Error lain: `400` date invalid, `401` credential invalid, `405` method invalid, `500` server error.

## 8. HTTP Status and Error Format

Error umumnya berbentuk:

```json
{"error":"Pesan error yang aman ditampilkan integrator."}
```

| Status | Arti |
|---:|---|
| `400` | Payload, query, date, shift, station, atau field tidak valid |
| `401` | Credential tidak ada, malformed, expired, revoked, atau owner inactive |
| `403` | JWT/API key tidak memiliki akses atau password reveal salah |
| `404` | Resource/item tidak ditemukan |
| `409` | Duplicate submission, duplicate key name, atau batas 5 key aktif |
| `405` | HTTP method tidak didukung |
| `500` | Kesalahan server; retry dengan backoff dan jangan menggandakan submit tanpa mengecek hasil |

## 9. Integration Checklist

1. Generate API key di Profile.
2. Simpan raw key di environment variable integrator, misalnya `WASTE_API_KEY`.
3. Kirim key hanya sebagai `Authorization: Bearer` melalui HTTPS.
4. Upload gambar melalui `/api/upload-file`.
5. Simpan `proxyUrl` dari response.
6. Submit payload waste memakai value, jumlah, station, shift, alasan, QC, manager, dan URL dokumentasi.
7. Tangani `401` dengan rotate/reveal key atau generate key baru.
8. Tangani `409` dengan membaca data existing sebelum retry.
9. Revoke key yang tidak lagi dipakai.
10. Jangan mencetak Authorization header atau raw key ke log.
