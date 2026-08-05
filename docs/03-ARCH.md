# 03 — ARCH: Architecture & Tech Stack

## 1. Architecture Diagram (Simplified)

```
┌──────────────────────────────────────────────────────┐
│                 BROWSER (PWA)                        │
│  React 18 + TypeScript + Vite + Tailwind CSS         │
│  Wouter (routing) · React Query (caching)            │
│  shadcn/ui (Radix) · Lucide Icons                   │
└───────────────┬──────────────────────────────────────┘
                │ HTTPS + JWT Auth
                ▼
┌──────────────────────────────────────────────────────┐
│            VERCEL SERVERLESS FUNCTIONS                │
│  /api/*                                              │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐           │
│  │ Auth    │  │ Submit   │  │ Dashboard│           │
│  │ login   │  │ auto-    │  │ data     │           │
│  │ logout  │  │ submit   │  │ get-day  │           │
│  └────┬────┘  └────┬─────┘  └────┬─────┘           │
│       │            │              │                  │
│       ▼            ▼              ▼                  │
│  ┌──────────────────────────────────────────────┐    │
│  │              _lib/ (Shared)                   │    │
│  │  auth.ts · db.ts · blob.ts                   │    │
│  │  google-sheets.ts · validators.ts            │    │
│  └──────────────────────┬───────────────────────┘    │
└─────────────────────────┼────────────────────────────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
     ┌──────────┐  ┌──────────┐  ┌──────────┐
│ 🐘 Neon  │  │ ☁️ Vercel│
│ Postgres │  │   Blob   │
│ (Single) │  │(Storage) │
│ Primary  │  │          │
     └──────────┘  └──────────┘  └──────────┘
```

## 2. Tech Stack

### Frontend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| React | 18.x | UI Framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool & dev server |
| Tailwind CSS | 3.x | Utility styling |
| shadcn/ui | latest | UI component library (new-york style) |
| Wouter | 3.x | Client-side routing |
| TanStack React Query | 5.x | Server state management |
| Recharts | 2.x | Charts & dashboard |
| React Hook Form | 7.x | Form management |
| Zod | 3.x | Schema validation |
| Lucide React | latest | Icons |
| jsPDF + autotable | latest | PDF generation (lazy-loaded) |

### Backend
| Teknologi | Fungsi |
|-----------|--------|
| Vercel Serverless Functions | API endpoints (`/api/*`) |
| Neon PostgreSQL (serverless) | Database (single-tenant) |
| Vercel Blob | File storage (foto dokumentasi) |
| JWT (HMAC-SHA256) | Authentication |
| Node.js crypto (scrypt) | Password hashing |

### Infra
| Layanan | Fungsi |
|---------|--------|
| Vercel | Hosting & deploy |
| Neon | PostgreSQL serverless (primary data store) |
| Vercel Blob | Image/photo storage |

---

## 3. Key Architecture Decisions

### ADR-001: Single Tenant
- Aplikasi hanya melayani **1 outlet/resto**.
- Tidak ada tenant resolution, tidak ada `x-tenant-id`.
- 1 database, 1 spreadsheet.

### ADR-002: Neon PostgreSQL sebagai Data Source Utama
- Data waste **ditulis ke Neon PostgreSQL** saat submit.
- Dashboard membaca langsung dari DB.
- Tabel `product_destructions` adalah core business table.
- Google Sheets **tidak digunakan** (alasan: latency tinggi).
- Database menyimpan: users, personnel, config, dan seluruh data waste.

### ADR-003: Blob untuk Foto
- Foto dokumentasi diupload ke **Vercel Blob** (private).
- Setiap upload menghasilkan **private URL**.
- Private URL di-wrap dengan **proxy endpoint** (`/api/signatures?blobUrl=...`)
  agar aman diakses dari frontend.
- URL proxy disimpan di Google Sheets sebagai `=IMAGE("...")`.

### ADR-003: PDF Unlock by MIDNIGHT Shift
- PDF button terkunci (disabled) sampai MIDNIGHT shift selesai di-submit.
- MIDNIGHT adalah shift terakhir dari 1 business day.
- Setelah MIDNIGHT submit → semua user bisa generate PDF untuk hari itu.
- Shift status dilacak di tabel `daily_records`.

### ADR-004: Shift Status Tracking
- Setiap business date memiliki 4 shift record (OPENING, MIDDLE, CLOSING, MIDNIGHT).
- Ketika user submit waste, sistem menandai shift tersebut sebagai `Done ✅`.
- UI menampilkan status per-shift secara real-time.
- 1 business date dianggap **complete** hanya jika MIDNIGHT sudah Done.

### ADR-005: WIB Timezone
- Seluruh aplikasi pake **WIB (Asia/Jakarta, GMT+7)**.
- Business day cutoff: **05:00 WIB**.
- Sebelum jam 05:00 → masih dianggap **hari sebelumnya** (Midnight shift).
- Shared utility di `shared/timezone.ts`.

### ADR-006: Auth
- JWT-based authentication (HMAC-SHA256).
- Password hashing pake **scrypt** (built-in Node.js crypto).
- Session duration: **8 jam**, extend otomatis saat ada aktivitas.
- Role: `super_admin` (global) dan `admin_store` (regular user).

---

## 4. Project Structure

```
waste/
├── index.html                  # Entry point
├── package.json                # Dependencies
├── vite.config.ts              # Vite config
├── vercel.json                 # Vercel deploy config
├── tailwind.config.ts          # Tailwind config
├── .env.example                # Environment template
│
├── api/                        # ▲ Serverless Functions
│   ├── _lib/                   # Shared backend libraries
│   │   ├── auth.ts             # JWT + scrypt auth
│   │   ├── db.ts               # Database queries (Neon)
│   │   ├── blob.ts             # Vercel Blob upload helper
│   │   ├── validators.ts       # Zod schemas
│   │   ├── rate-limit.ts       # Simple rate limiter
│   │   └── activity-logger.ts  # Activity logging
│   │
│   ├── auth/
│   │   └── login.ts            # POST /api/auth/login
│   │
│   ├── auto-submit.ts          # POST /api/auto-submit
│   ├── dashboard-data.ts       # GET /api/dashboard-data
│   ├── get-day-data.ts         # GET /api/get-day-data
│   ├── signatures.ts           # GET /api/signatures + blob proxy
│   ├── proxy-image.ts          # GET /api/proxy-image
│   └── activity-logger.ts  # Activity logging
│
├── shared/
│   ├── schema.ts               # Shared Zod schemas
│   └── timezone.ts             # WIB timezone utilities
│
├── src/                        # ⚛️ React Frontend
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root + router
│   ├── index.css               # Global styles
│   │
│   ├── pages/
│   │   ├── waste-mode.tsx      # Home — mode selection
│   │   ├── auto-waste.tsx      # Manual + auto waste form
│   │   ├── dashboard.tsx       # Dashboard & charts
│   │   ├── profile.tsx         # User profile
│   │   ├── pdf-download.tsx    # PDF export
│   │   └── not-found.tsx       # 404
│   │
│   ├── components/ui/          # shadcn/ui + custom components
│   │   ├── login-form.tsx      # Login form
│   │   ├── multi-file-upload.tsx # File upload zone
│   │   └── ...                 # Other Radix components
│   │
│   ├── hooks/
│   │   ├── useAuth.ts          # Auth hook (session mgmt)
│   │   └── use-toast.ts        # Toast notifications
│   │
│   ├── lib/
│   │   ├── api-client.ts       # API client with auth
│   │   ├── queryClient.ts      # React Query client
│   │   ├── blob-upload.ts      # Client-side Blob upload
│   │   └── utils.ts            # Utility functions
│   │
│   └── contexts/
│       └── AuthContext.tsx      # Auth React context
│
├── public/
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service worker
│   └── icons/                  # PWA icons
│
└── docs/                       # 📋 Documentation
    ├── 01-PRD.md               # Product requirements
    ├── 02-DATA.md              # Station & item catalog
    ├── 03-ARCH.md              # Architecture
    └── ...
```

---

## 5. Naming Conventions

| Area | Convention | Example |
|------|-----------|---------|
| API files | `kebab-case.ts` | `auto-submit.ts` |
| Pages | `kebab-case.tsx` | `auto-waste.tsx` |
| Components | `kebab-case.tsx` | `multi-file-upload.tsx` |
| Hooks | `useXxx.ts` | `useAuth.ts` |
| Shared libs | `kebab-case.ts` | `validators.ts` |
| Types | PascalCase | `StationDraftRow` |
| Functions | camelCase | `getBusinessDateWIB()` |
| DB columns | snake_case | `kategori_induk` |
| API routes | `/api/kebab-case` | `/api/auto-submit` |
| localStorage keys | `waste_app_xxx` | `waste_app_token` |

---

## 6. Environment Variables

```env
# 🐘 Database
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# 🔐 Auth
JWT_SECRET=your-super-secret-min-32-char

# ☁️ Vercel Blob (optional — auto-configured on Vercel)
BLOB_READ_WRITE_TOKEN=...

# 📄 Google Sheets (optional export)
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id
GOOGLE_SHEETS_CREDENTIALS={"type":"service_account",...}# 🌐 Public URL (for proxy URLs)
PUBLIC_URL=https://your-domain.com
```

---

## 7. Rate Limiting

- **Login**: max 5 requests per 300 seconds (per IP)
- **Auto-submit**: max 30 requests per 60 seconds
- **Settings**: max 30 requests per 60 seconds
- **General API**: no strict limit (but 30s timeout on all Sheets requests)
