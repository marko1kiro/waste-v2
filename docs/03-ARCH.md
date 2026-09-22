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
| Cloudflare R2 | File storage (foto dokumentasi) |
| JWT (HMAC-SHA256) | Authentication |
| Node.js crypto (scrypt) | Password hashing |

### Infra
| Layanan | Fungsi |
|---------|--------|
| Vercel | Hosting & deploy |
| Neon | PostgreSQL serverless (primary data store) |
| Cloudflare R2 | Image/photo storage |

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

### ADR-003: R2 untuk Foto
- Foto dokumentasi diupload ke **Cloudflare R2** (private).
- Setiap upload menghasilkan **private key ref**.
- Key ref di-wrap dengan **proxy endpoint** (`/api/signatures?blobUrl=...`)
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
waste-v2/
├── index.html                  # Entry point
├── package.json                # Dependencies
├── vite.config.ts              # Vite config
├── vercel.json                 # Vercel deploy config (CSP header)
├── tailwind.config.ts          # Tailwind config
├── components.json             # shadcn/ui config
├── .env.example                # Environment template (placeholder saja)
│
├── api/                        # ▲ Vercel Serverless Functions
│   ├── admin/
│   │   └── [action].ts         # Router aksi admin: personnel, users, station-items, api-keys, tenant-config, …
│   ├── login.ts                # POST /api/login
│   ├── submit-waste.ts         # POST /api/submit-waste
│   ├── upload-file.ts          # POST /api/upload-file
│   ├── signatures.ts           # GET /api/signatures + blob proxy
│   ├── generate-pdf.ts         # GET /api/generate-pdf
│   ├── dashboard-data.ts       # GET /api/dashboard-data
│   ├── get-day-data.ts         # GET /api/get-day-data
│   ├── get.ts                  # GET /api/get?action=shift-status|station-items|list-blob-pdfs
│   └── items.ts                # Endpoint item station
│
├── server/                     # Shared backend libs
│   ├── lib.ts                  # JWT, scrypt, store context, validators, upload blob
│   ├── r2.ts                   # Cloudflare R2 helpers
│   ├── google-drive.ts         # Backup PDF akun legacy (OAuth refresh token)
│   └── google-drive-neutral.ts # Backup PDF service account (folder per-resto)
│
├── shared/                     # Dipakai frontend + backend
│   ├── schema.ts               # Shared Zod schemas
│   ├── timezone.ts             # WIB timezone utilities
│   ├── pdf-renderer.ts         # Render PDF Berita Acara (server-side)
│   ├── pdf-signature-resolver.ts
│   ├── station-ui.ts
│   └── tester.ts
│
├── src/                        # ⚛️ React Frontend
│   ├── main.tsx                # Entry point
│   ├── App.tsx                 # Root + router (Wouter)
│   ├── index.css               # Global styles
│   ├── components/ui/          # shadcn/ui + custom components
│   ├── contexts/               # AuthContext, ThemeContext
│   ├── hooks/                  # use-toast
│   ├── lib/                    # api-client, offline-waste, photo-compression, …
│   └── pages/                  # waste-mode, auto-waste, dashboard, admin-*, pdf-download, …
│
├── public/                     # Static assets
│
├── scripts/                    # Utilitas ops/dev (lihat scripts/README.md)
│
└── docs/                       # Dokumentasi
```

---

## 5. Naming Conventions

| Area | Convention | Example |
|------|-----------|---------|
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

## 6. Environment Variables

```env
# 🐘 Database
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require

# 🔐 Auth
JWT_SECRET=your-super-secret-min-32-char


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
