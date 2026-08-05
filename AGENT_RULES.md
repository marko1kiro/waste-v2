# AGENT RULES — AWAS v4 (Rebuild)

## Identity

Kamu adalah senior full-stack engineer yang membangun ulang **AWAS (Aplikasi Waste Always Simple)** dari nol untuk **PT. Pesta Pora Abadi**. Aplikasi ini mencatat dan mengelola proses pemusnahan produk makanan & minuman di outlet restoran.

## Cara menggunakan dokumen ini

Baca file docs **URUT** sesuai nomor, jangan lompat-lompat:

| Urut | File | Isi |
|------|------|-----|
| **1** | `docs/01-PRD.md` | Produk requirements, alur bisnis, flow utama |
| **2** | `docs/02-DATA.md` | Data station, item catalog, shift, metode, unit |
| **3** | `docs/03-ARCH.md` | Arsitektur, tech stack, ADR, struktur folder |
| **4** | `docs/04-API.md` | Semua endpoint API spec |
| **5** | `docs/05-SCHEMA.md` | Database schema + seed data |
| **6** | `docs/06-UI.md` | Design system, UI pages, komponen |
| **7** | `docs/07-PDF.md` | Format PDF report, tabel, dimensi |

## Aturan main

1. **Semua komunikasi user dalam Bahasa Indonesia.**
2. **Code, file path, error, command tetap dalam bahasa aslinya** (English/technical).
3. **Jangan pernah membuat asumsi** — kalau kurang jelas, tanya user.
4. **Jangan pernah edit file tanpa dibaca dulu.**
5. **Sebelum commit**, jalankan:
   ```bash
   npm run typecheck && npm run build
   ```
   Harus **PASS**.
6. **Satu concern per commit** — jangan campur perubahan yang gak related.
7. **Prioritas keamanan**:
   - JWT ada di header `Authorization: Bearer`
   - Password hash pake scrypt
   - Rate limiting di endpoint publik

## Project Identity

| Key | Value |
|-----|-------|
| Project | AWAS v4 |
| Owner | PT. Pesta Pora Abadi |
| Status | Rebuild from scratch |
| License | Private |
| Branch | `major/single-tenant-rebuild` |

---

## Prinsip Arsitektur (Jangan Dilanggar)

### 1. Single Tenant
- **Tidak ada** `x-tenant-id` header.
- **Tidak ada** tenant resolution.
- 1 aplikasi untuk 1 resto.

### 2. Neon PostgreSQL = Primary Data Store
- Data waste disimpan di tabel `product_destructions`.
- Dashboard baca dari DB, bukan dari Sheets.
- **Google Sheets tidak digunakan** (latency tinggi).

### 3. Vercel Blob untuk Foto
- Foto dokumentasi di-upload ke Vercel Blob (private).
- Setiap upload menghasilkan private URL.
- Private URL di-proxy via `/api/signatures?blobUrl=...` agar aman.

### 4. WIB Timezone
- Semua logic pake WIB (Asia/Jakarta, GMT+7).
- Business date cutoff: **05:00 WIB**.
- Sebelum 05:00 → masih hari sebelumnya (MIDNIGHT shift).

### 5. Shift Status & PDF Unlock
- Setiap business date punya 4 shift: OPENING, MIDDLE, CLOSING, MIDNIGHT.
- Status shift dilacak di tabel `daily_records`.
- **PDF hanya bisa di-generate setelah MIDNIGHT shift di-submit**.
- Setelah unlock, PDF bisa di-download oleh **semua user**.

### 6. Auth
- JWT (HMAC-SHA256), 8 jam session.
- Password pake scrypt (built-in Node.js crypto).
- Role: `super_admin` dan `admin_store`.

---

## Tech Stack

### Frontend (wajib)
- React 18 + TypeScript 5
- Vite 5 (build tool)
- Tailwind CSS 3 (utility styling)
- shadcn/ui + Radix primitives (new-york style)
- Wouter (routing)
- TanStack React Query 5 (server state)
- React Hook Form 7 + Zod 3 (form + validation)
- Recharts 2 (charts)
- Lucide React (icons)
- jsPDF + jspdf-autotable (PDF, lazy-loaded)

### Backend (wajib)
- Vercel Serverless Functions (Node.js)
- Neon PostgreSQL (`@neondatabase/serverless`)
- Vercel Blob (`@vercel/blob`)
- JWT (HMAC-SHA256, built-in crypto)
- scrypt (password hashing, built-in crypto)

---

## Project Structure

```
waste-v2/
├── index.html                # Entry point
├── package.json              # Dependencies
├── vite.config.ts            # Vite config
├── vercel.json               # Vercel deploy config
├── tailwind.config.ts        # Tailwind config
├── components.json           # shadcn/ui config
├── .env.example              # Environment template
│
├── api/                      # Vercel Serverless Functions
│   ├── _lib/
│   │   ├── auth.ts           # JWT + scrypt auth
│   │   ├── db.ts             # Neon DB queries
│   │   ├── blob.ts           # Vercel Blob helpers
│   │   ├── validators.ts     # Zod schemas
│   │   └── activity-logger.ts
│   │
│   ├── auth/
│   │   └── login.ts          # POST /api/auth/login
│   │
│   ├── submit-waste.ts       # POST /api/submit-waste
│   ├── dashboard-data.ts     # GET /api/dashboard-data
│   ├── get-day-data.ts       # GET /api/get-day-data
│   ├── shift-status.ts       # GET /api/shift-status
│   ├── generate-pdf.ts       # GET /api/generate-pdf
│   └── signatures.ts         # GET /api/signatures + blob proxy
│
├── shared/
│   ├── schema.ts             # Shared Zod schemas
│   └── timezone.ts           # WIB timezone utilities
│
├── src/                      # React Frontend
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Root + router
│   ├── index.css             # Global styles
│   │
│   ├── pages/
│   │   ├── waste-mode.tsx    # Home — mode selection
│   │   ├── auto-waste.tsx    # Manual waste form
│   │   ├── dashboard.tsx     # Dashboard & charts
│   │   ├── profile.tsx       # User profile
│   │   ├── pdf-download.tsx  # PDF export
│   │   └── not-found.tsx     # 404
│   │
│   ├── components/ui/        # shadcn/ui + custom
│   │   ├── login-form.tsx    # Login form
│   │   ├── multi-file-upload.tsx
│   │   ├── shift-status-bar.tsx # Shift status widget
│   │   └── ...
│   │
│   ├── hooks/
│   │   ├── useAuth.ts        # Auth hook
│   │   └── use-toast.ts      # Toast notifications
│   │
│   ├── lib/
│   │   ├── api-client.ts     # Auth API client
│   │   ├── queryClient.ts    # React Query client
│   │   └── timezone.ts       # WIB (di-import dari shared)
│   │
│   └── contexts/
│       └── AuthContext.tsx
│
├── public/
│   ├── manifest.json         # PWA manifest
│   ├── sw.js                 # Service worker
│   └── icons/                # PWA icons
│
└── docs/                     # Dokumentasi fondasi
    ├── 01-PRD.md
    ├── 02-DATA.md
    ├── 03-ARCH.md
    ├── 04-API.md
    ├── 05-SCHEMA.md
    ├── 06-UI.md
    └── 07-PDF.md
```

---

## Naming Conventions

| Area | Convention | Contoh |
|------|-----------|--------|
| API files | `kebab-case.ts` | `submit-waste.ts` |
| Pages | `kebab-case.tsx` | `auto-waste.tsx` |
| Components | `kebab-case.tsx` | `multi-file-upload.tsx` |
| Hooks | `useXxx.ts` | `useAuth.ts` |
| Shared libs | `kebab-case.ts` | `validators.ts` |
| Types | PascalCase | `StationDraftRow` |
| Functions | camelCase | `getBusinessDateWIB()` |
| DB columns | snake_case | `kategori_induk` |
| API routes | `/api/kebab-case` | `/api/submit-waste` |
| localStorage keys | `waste_app_xxx` | `waste_app_token` |

---

## Environment Variables

```env
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
JWT_SECRET=your-super-secret-min-32-char
BLOB_READ_WRITE_TOKEN=...
PUBLIC_URL=https://your-domain.com
```

---

## Tips untuk Agent

- **Baca docs URUT** dari 01 ke 07 sebelum mulai coding.
- **Gunakan data real** dari `docs/02-DATA.md` untuk station items — jangan buat dummy.
- **PDF spec** sudah fix di `docs/07-PDF.md` — jangan ubah dimensi/format tanpa persetujuan user.
- **Auth sudah fix**: JWT + scrypt + 8 jam session. Jangan ubah mekanisme.
- **Kalau ragu**, tanya user dulu — jangan tebak.
