# TailAdmin UI/UX Overhaul — Design Spec

Tanggal: 2026-09-06
Branch kerja: `feat/ui-tailadmin-overhaul` (dari `main` @ `51e872b`)
Referensi: https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template (demo: https://demo.tailadmin.com/)

## Tujuan

Overhaul UI/UX/theme aplikasi AWAS v4 dari dark cyberpunk/neo-brutalism ke gaya TailAdmin (clean SaaS admin) — light + dark mode, tanpa menyentuh engine/logic/behavior.

## Batasan Keras (Hard Constraints)

1. **UI only.** Tidak ada perubahan perilaku, state machine, validasi, fetch/API, offline queue, PDF generator (jspdf), auth, routes (wouter), guard per-role, handler.
2. **File yang boleh berubah**: `*.tsx` di `src/components/ui/` dan `src/pages/`, `src/App.tsx` (hanya ErrorBoundary markup), `src/main.tsx` (wrap ThemeProvider), `src/index.css`, `src/contexts/ThemeContext.tsx` (baru), `tailwind.config.ts`, `index.html` (theme-color/meta saja), `package.json` (tidak ada dependency baru yang diharapkan).
3. **File yang tidak boleh berubah**: `api/`, `shared/`, `scripts/`, `src/lib/`, `src/contexts/AuthContext.tsx`, `docs/` (kecuali spec ini).
4. Tailwind tetap **v3.4**; token TailAdmin di-port manual, tanpa upgrade v4, tanpa dependency baru.
5. Wajib branch khusus; commit per bagian; push branch; tidak membuat PR otomatis.

## Bagian 1 — Fondasi Tema

- `darkMode: 'class'` dipertahankan. `ThemeProvider` (`src/contexts/ThemeContext.tsx`): state `'light' | 'dark'`, persist `localStorage('awas-theme')`, toggle class `.dark` pada `<html>`. Default dark; pilihan user menang setelah toggle. `index.html` boot dengan `class="dark"` (anti-flash).
- Port token TailAdmin ke `tailwind.config.ts`:
  - Skala penuh: `brand-25…950` (#465fff core), `gray-25…950` (#101828 core), `success-*`, `error-*`, `warning-*`, `orange-*`, `blue-light-*` (nilai hex persis dari `src/css/style.css` TailAdmin).
  - Shadow `theme-xs/sm/md/lg/xl` (soft, menggantikan `nb-sm/nb-md/nb-lg/nb-yellow` dan `card`).
  - Font `sans` → Outfit (Google Fonts import di index.css, menggantikan Nunito).
- Warna semantik via CSS variables yang flip per mode — **nama token tetap**: `background`, `surface`, `surface-alt`, `border`, `text-primary`, `text-muted`, `text-dim`. Nilai:
  | Token | Light | Dark |
  |---|---|---|
  | background | #f9fafb (gray-50) | #101828 (gray-900) |
  | surface | #ffffff | #1a2231 (gray-dark) |
  | surface-alt | #f2f4f7 (gray-100) | #1d2939 (gray-800) |
  | border | #e4e7ec (gray-200) | #344054 (gray-700) |
  | text-primary | #101828 | rgba(255,255,255,0.9) |
  | text-muted | #667085 (gray-500) | #98a2b3 (gray-400) |
  | text-dim | #98a2b3 | #667085 |
- Body gradient cyberpunk di index.css dihapus; scrollbar + custom select di-update ke token baru.
- Toggle tema: ikon sun/moon di sidebar desktop + profile.

## Bagian 2 — Komponen Dasar (reskin class saja, API props tetap)

- Button primary: `bg-brand-500 hover:bg-brand-600 text-white rounded-lg shadow-theme-xs`; secondary/outline: border `border-border`, bg surface; danger: `error-500`. Hover subtle tanpa translate.
- Card: `rounded-xl border border-border bg-surface shadow-theme-xs`; heading `text-theme-xl font-semibold` (bukan font-black uppercase).
- Input/select/textarea: light bg white border gray-300, dark bg gray-900 border gray-700, focus ring `brand-500/12` + border brand; `rounded-lg`.
- Dialog (Radix): overlay `bg-gray-900/60 backdrop-blur-sm`; panel `rounded-xl bg-surface shadow-theme-lg`.
- Toast: variant success/error/warning pakai skala TailAdmin + ikon lucide, `shadow-theme-md`.
- Spinner/Progress: `text-brand-500`, track `bg-surface-alt`, bar `bg-brand-500`.
- Badge/status: done `success-50/success-700` (dark `success-500/12`/`success-400`); belum `warning-50/warning-700` (dark `warning-500/12`/`warning-400`).
- Tabel: header `bg-surface-alt text-[10px] uppercase text-text-muted`, row border-b, hover `bg-gray-50`/dark `white/[0.03]`.
- Global: `font-black` → `font-semibold`/`font-bold`; tracking-widest label → normal (kecuali label form kecil); ikon `size-4/5`.

## Bagian 3 — Navigasi & Layout

- Desktop sidebar: collapsed 88px, hover expand 290px (perilaku `.sidebar:hover` TailAdmin); active `bg-brand-50 text-brand-500` / dark `bg-brand-500/[0.12] text-brand-400`; grup OPERASIONAL & ADMIN; footer berisi profil + toggle tema. Mobile <lg hidden.
- Mobile bottom nav: **dipertahankan** (hybrid), reskin: bg surface + border-t + blur; aktif `text-brand-500`; tanpa brutalist shadow.
- Topbar halaman (app-layout): sticky, `bg-background/80 backdrop-blur border-b`; container `max-w-[1250px]` untuk dashboard/admin, full-width untuk form waste; padding `px-4 py-5 lg:px-8`.

## Bagian 4 — Sapu 12 Halaman

Urutan: waste-mode → auto-waste (stepper, form, kartu, foto; ProgressOverlay/toast dari Bagian 2) → dashboard (recharts: gridline `gray-100`/dark `gray-800`, tooltip dark `gray-900/gray-800`, seri brand/success/warning/error/blue-light) → pdf-download → profile (+toggle tema) → not-found + AppErrorBoundary → admin group (panel, personnel, station-items, users, history; tabel per Bagian 2) → api-docs (code block bg gray-900 tetap di light).

Aturan sapu: `shadow-nb-*`/`shadow-card` → `shadow-theme-*`; hex `bg-[#]/text-[#]/border-[#]` → token; `font-black` → `font-semibold`; glow/gradient brutalist dihapus. Token semantik lama dipertahankan namanya.

## Bagian 5 — Login

- Hapus ~200 baris CSS kawaii di index.css (login-*, sparkle, cloud, profile-avatar, keyframes twinkle/cardIn/cloudFloat/logoFloat).
- Layout signin TailAdmin: split — kiri brand panel (gradient brand-500→600, logo + tagline, hidden <lg), kanan form `bg-background`; card `rounded-xl bg-surface border shadow-theme-lg max-w-sm`; input per Bagian 2; password toggle ikon `Eye/EyeOff` (perilaku sama); error `error-50/error-700` (dark `error-500/10`/`error-400`); submit brand; grid dekoratif halus di brand panel.
- Tidak menyentuh useAuth/validasi/handler.

## Bagian 6 — Verifikasi

- Per kelompok commit: `npm run typecheck`, `npm run typecheck:api`, `npm run build`; visual manual light/dark × desktop 1280 / mobile 375.
- Acceptance akhir: semua halaman render 2 mode × 2 viewport; grep nol `shadow-nb|shadow-card|bg-[#|text-[#|border-[#|font-black|Nunito`; diff hanya file yang diizinkan; flow inti jalan (login → waste → dashboard → pdf → admin → profile toggle); tidak ada error console.

## Risiko

- 310 pemakaian class lama → token semantik dipertahankan; hex brutalist disapu per halaman.
- Recharts hardcoded → audit `dashboard.tsx`.
- Kontras light mode → token TailAdmin teruji; cek manual badge/disabled.
