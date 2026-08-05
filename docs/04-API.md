# 04 — API: Specification

> Base URL: `/api`

## Authentication

**JWT-based.**
- Login → dapat `token` (JWT).
- Setiap request menyertakan header:
  ```
  Authorization: Bearer <token>
  ```
- Token expired: 8 jam.
- Server akan return 401 jika token expired/tidak valid.

---

## 1. Auth

### POST `/api/auth/login`
Login user.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response 200:**
```json
{
  "success": true,
  "token": "jwt_token_string",
  "user": {
    "username": "string",
    "display_name": "string",
    "role": "admin_store | super_admin"
  }
}
```

**Response 401:**
```json
{
  "error": "Username atau password salah!"
}
```

---

## 2. Waste Submission

### POST `/api/submit-waste`
Menerima data waste dan foto dokumentasi.
1. Upload foto ke Vercel Blob → dapat URL proxy
2. Simpan data waste ke tabel `product_destructions` (Neon PostgreSQL)
3. Update shift status di tabel `daily_records`
4. (Opsional) Kirim WhatsApp notif

**Request:** `multipart/form-data`

| Field | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `tanggal` | string | ✅ | Business date `YYYY-MM-DD` |
| `kategoriInduk` | string | ✅ | `NOODLE` / `DIMSUM` / `BAR` / `PRODUKSI` |
| `shift` | string | ❌ | `OPENING` / `MIDDLE` / `CLOSING` / `MIDNIGHT` (default: OPENING) |
| `storeName` | string | ❌ | Nama store (default: BEKASI KP. BULU) |
| `productList` | JSON string[] | ✅ | `["MIE GACOAN LV 1", "PANGSIT GORENG"]` |
| `kodeProdukList` | JSON string[] | ❌ | Kode lot / tanggal expired |
| `jumlahProdukList` | JSON number[] | ✅ | `[5, 3]` |
| `unitList` | JSON string[] | ❌ | `["PORSI", "PCS"]` |
| `metodePemusnahanList` | JSON string[] | ❌ | `["DIBUANG", "DIBUANG"]` |
| `alasanPemusnahanList` | JSON string[] | ❌ | `["EXPIRED", "RUSAK"]` |
| `jamTanggalPemusnahanList` | JSON string[] (nullable) | ❌ | Timestamps |
| `parafQCUrl` | string | ❌ | URL proxy signature QC |
| `parafManagerUrl` | string | ❌ | URL proxy signature Manager |
| `dokumentasi_0` .. `dokumentasi_9` | File | ❌ | File foto (max 10) |
| `dokumentasi` | File | ❌ | Single file fallback |
| `dokumentasiUrls` | JSON string[] | ❌ | Pre-uploaded URL array |
| `mode` | string | ❌ | `submit-tester`, `upload-pdf`, `upload-photo`, `send-wa-notif` |

**Response 200:**
```json
{
  "success": true,
  "message": "Data waste NOODLE berhasil disimpan",
  "data": {
    "kategoriInduk": "NOODLE",
    "itemsProcessed": 5,
    "shift": "OPENING",
    "storeName": "BEKASI KP. BULU",
    "shiftDone": true
  },
  "warnings": ["Gagal upload dokumentasi 1"]
}
```

**Response 400:**
```json
{
  "success": false,
  "message": "Minimal 1 produk harus diisi!"
}
```

---

## 3. Shift Status & PDF Unlock

### GET `/api/shift-status`
Mengambil status per-shift untuk suatu business date.
Endpoint ini menentukan apakah PDF button harus unlocked atau tidak.

**Query Params:**
| Param | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `date` | string | ✅ | Business date `YYYY-MM-DD` |

**Response 200:**
```json
{
  "success": true,
  "date": "2026-06-09",
  "shifts": {
    "OPENING": { "done": true, "submittedBy": "Ahmad", "submittedAt": "2026-06-09T08:30:00Z" },
    "MIDDLE":  { "done": true, "submittedBy": "Siti", "submittedAt": "2026-06-09T13:15:00Z" },
    "CLOSING": { "done": false, "submittedBy": null, "submittedAt": null },
    "MIDNIGHT": { "done": false, "submittedBy": null, "submittedAt": null }
  },
  "pdfUnlocked": false
}
```

### Logic:
```
pdfUnlocked = (MIDNIGHT.done === true)
```
PDF hanya unlock ketika **MIDNIGHT sudah di-submit**.

---

## 4. Dashboard

### GET `/api/dashboard-data`
Mengambil data dashboard dari **Neon PostgreSQL** untuk ditampilkan di chart.

**Query Params:**
| Param | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `startDate` | string | ❌ | `YYYY-MM-DD` |
| `endDate` | string | ❌ | `YYYY-MM-DD` |
| `mode` | string | ❌ | `activity-log` (untuk super admin) |

**Response 200:**
```json
{
  "success": true,
  "availableDates": ["2026-06-09", "2026-06-08"],
  "summary": {
    "totalDays": 2,
    "totalItems": 45,
    "totalQty": 120,
    "avgItemsPerDay": 22,
    "avgQtyPerDay": 60
  },
  "dailyData": [
    {
      "date": "2026-06-09",
      "items": 25,
      "qty": 70,
      "stations": { "NOODLE": 40, "DIMSUM": 30 },
      "shifts": { "OPENING": 50, "CLOSING": 20 }
    }
  ],
  "stationTotals": { "NOODLE": 200, "DIMSUM": 150, "BAR": 80, "PRODUKSI": 40 },
  "shiftTotals": { "OPENING": 300, "MIDDLE": 100, "CLOSING": 70 },
  "topProducts": [
    { "name": "MIE GACOAN LEVEL 1", "count": 10, "qty": 15 }
  ],
  "lastEntry": {
    "date": "2026-06-09",
    "qc": "Ahmad",
    "station": "NOODLE",
    "shift": "OPENING"
  },
  "stationBreakdown": { "NOODLE": [{ "unit": "PORSI", "items": [...], "totalQty": 200 }] },
  "periodBreakdown": {
    "daily": { ... },
    "weekly": { ... },
    "monthly": { ... },
    "byDate": { ... }
  }
}
```

---

## 5. Daily Data

### GET `/api/get-day-data`
Mengambil data waste untuk tanggal tertentu dari **Neon PostgreSQL**.

**Query Params:**
| Param | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `date` | string | ✅ | `YYYY-MM-DD` |
| `shift` | string | ❌ | Jika ada → mode check-duplicate |
| `station` | string | ❌ | Jika ada → mode check-duplicate |

**Response 200 (data):**
```json
{
  "success": true,
  "date": "2026-06-09",
  "storeName": "BEKASI KP. BULU",
  "grouped": {
    "OPENING": [{
      "shift": "OPENING",
      "store": "BEKASI KP. BULU",
      "station": "NOODLE",
      "namaProduk": "MIE GACOAN LEVEL 1",
      "kodeProduk": "2026-06-09",
      "jumlahProduk": 5,
      "unit": "PORSI",
      "metodePemusnahan": "DIBUANG",
      "alasanPemusnahan": "EXPIRED",
      "jamTanggalPemusnahan": "08:00",
      "parafQC": "proxy_url",
      "parafManager": "proxy_url",
      "dokumentasi": ["proxy_url", "proxy_url"]
    }],
    "MIDDLE": [],
    "CLOSING": [],
    "MIDNIGHT": []
  },
  "raw": [...]
}
```

**Response 200 (check-duplicate):**
```json
{
  "isDuplicate": true
}
```

---

## 6. Signatures & Blob Proxy

### GET `/api/signatures`
Mengambil daftar personnel (QC / Manager) dengan signature URL.

**Query Params:**
| Param | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `role` | string | ❌ | `qc` atau `manager` |
| `name` | string | ❌ | Filter by name |
| `blobUrl` | string | ❌ | Jika ada → proxy mode (return file blob) |

**Response 200 (personnel list):**
```json
{
  "success": true,
  "data": [
    { "name": "Ahmad", "full_name": "Ahmad Fauzi", "role": "qc", "signature_url": "proxy_url" }
  ]
}
```

**Response (blob proxy):**
Returns the file directly with correct Content-Type. No JSON.

---

## 7. PDF Generation

### GET `/api/generate-pdf`
Generate dan download PDF report untuk suatu business date.
Hanya bisa dipanggil jika MIDNIGHT shift sudah Done.

**Query Params:**
| Param | Tipe | Required | Deskripsi |
|-------|------|----------|-----------|
| `date` | string | ✅ | Business date `YYYY-MM-DD` |

**Response 403:**
```json
{
  "success": false,
  "message": "PDF belum bisa di-generate. Shift MIDNIGHT belum di-submit."
}
```

**Response 200:**
Returns PDF file as download.


