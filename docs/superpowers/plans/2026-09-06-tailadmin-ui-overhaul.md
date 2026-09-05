# TailAdmin UI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Overhaul UI/UX/theme AWAS v4 ke gaya TailAdmin (light+dark), UI only, tanpa menyentuh logic/behavior.

**Architecture:** Token-first — port token TailAdmin ke tailwind.config.ts + CSS variables semantik (nama tetap, nilai flip per mode), lalu reskin komponen dasar, nav/layout, 12 halaman, login. ThemeProvider mini untuk class `.dark`.

**Tech Stack:** Tailwind v3.4 (tanpa upgrade), React 18, lucide-react, CSS variables. Tanpa dependency baru.

**Branch:** `feat/ui-tailadmin-overhaul` (sudah dibuat + spec committed).

**Gate per task:** `npm run typecheck` sukses. **Gate akhir:** typecheck + typecheck:api + build + grep nol brutalist.

---

### Task 1: Fondasi tema

**Files:** `tailwind.config.ts`, `src/index.css`, `src/contexts/ThemeContext.tsx` (baru), `src/main.tsx`, `index.html`

- [ ] Port token TailAdmin ke `tailwind.config.ts`: skala `brand-25…950`, `gray-25…950`, `success-*`, `error-*`, `warning-*`, `orange-*`, `blue-light-*` (hex persis dari style.css TailAdmin); shadow `theme-xs/sm/md/lg/xl`; hapus `nb-*` & `card` shadow; font sans → Outfit.
- [ ] Warna semantik jadi `rgb(var(--...) / <alpha-value>)`: background/surface/surface-alt/border/text-primary/text-muted/text-dim — nilai flip via CSS vars di index.css (`.dark`), light: gray-50/white/gray-100/gray-200/#101828/gray-500/gray-400; dark: #101828/#1a2231/#1d2939/#344054/white-90%/gray-400/gray-500.
- [ ] `src/contexts/ThemeContext.tsx`: `ThemeProvider` + `useTheme()` → `{ theme, toggle }`, state `light|dark`, persist `localStorage('awas-theme')`, effect toggles `document.documentElement.classList`. Default dark.
- [ ] `src/main.tsx`: wrap `<App/>` dengan ThemeProvider.
- [ ] `index.css`: hapus gradient body cyberpunk → flat `bg-background`; ganti import Nunito → Outfit; hapus CSS kawaii login (login-*, sparkle s1-s9, twinkle, cardIn, cloudFloat, logoFloat, profile-avatar + responsive block); update scrollbar & select ke token; body font-family Outfit.
- [ ] `index.html`: `theme-color` dinamis tidak bisa — biarkan `#0a0a0a` dark boot. (meta tetap).
- [ ] Gate: `npm run typecheck`.

### Task 2: Komponen dasar (reskin class, API props tetap)

**Files:** `confirm-dialog.tsx`, `toaster.tsx`, `loading-spinner.tsx`, `shift-status-bar.tsx`, `multi-file-upload.tsx`, `desktop-sidebar.tsx`, `mobile-bottom-nav.tsx`, `app-layout.tsx` (nav item styling di task 3 untuk sidebar/nav; task 2 fokus primitif)

- [ ] `confirm-dialog.tsx`: overlay `bg-gray-950/60 backdrop-blur-sm`; panel `rounded-xl border border-border bg-surface p-5 shadow-theme-lg`; cancel button outline (border-border bg-surface, hover bg-surface-alt); confirm `bg-brand-500 hover:bg-brand-600 text-white rounded-lg shadow-theme-xs`; tanpa translate hover; font-black → font-semibold.
- [ ] `toaster.tsx`: `shadow-theme-md`, border-2 → border; variant colors: success `bg-success-50 text-success-700 border-success-200` (dark: `dark:bg-success-500/10 dark:text-success-400 dark:border-success-500/20`); error/warning/info analog; default border-border bg-surface.
- [ ] `loading-spinner.tsx`: spinner `text-brand-500`; Skeleton `bg-surface-alt`; CardSkeleton `rounded-xl border border-border bg-surface shadow-theme-xs`; ProgressOverlay: overlay `bg-gray-950/60 backdrop-blur-sm`, panel `bg-surface border shadow-theme-lg`, spinner+label `text-brand-500`/font-semibold, track `bg-surface-alt`, bar `bg-brand-500`.
- [ ] `shift-status-bar.tsx`: card `rounded-xl border border-border bg-surface shadow-theme-xs`; badge user `bg-surface-alt text-text-primary font-semibold`; jam clock `text-warning-500`; font-black → font-semibold; note text `text-warning-600 dark:text-warning-400`.
- [ ] `multi-file-upload.tsx`: hex → token (bg-surface-alt, border-border, text-text-muted), font-black → font-semibold.
- [ ] Gate: `npm run typecheck` + build.

### Task 3: Navigasi & layout

**Files:** `desktop-sidebar.tsx`, `mobile-bottom-nav.tsx`, `app-layout.tsx`

- [ ] `desktop-sidebar.tsx`: w-[88px] hover:w-[290px] transisi (`overflow-hidden whitespace-nowrap`); logo area (icon saat collapsed, full saat hover via group-hover); nav item: aktif `bg-brand-50 text-brand-500 dark:bg-brand-500/[0.12] dark:text-brand-400`, inactive `text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 hover:text-text-primary`; tanpa border-2/shadow-nb; user chip ring brand; logout hover `text-error-600 dark:text-error-400`; ikon size-5.
- [ ] `mobile-bottom-nav.tsx`: container `bg-surface/95 border border-border shadow-theme-lg rounded-2xl` (floating card tetap); aktif `text-brand-500`, inactive `text-gray-400`; label font-medium.
- [ ] `app-layout.tsx`: konten padding `px-4 pb-28 pt-4 lg:px-8 lg:pb-8`; footer tetap; (ShiftStatusBar wrapper tetap).
- [ ] Gate: typecheck + build; visual manual desktop+mobile.

### Task 4: Sapu halaman — gel 1 (waste-mode, not-found, AppErrorBoundary, profile, pdf-download)

**Files:** `waste-mode.tsx`, `not-found.tsx`, `src/App.tsx`, `profile.tsx`, `pdf-download.tsx`

- [ ] `waste-mode.tsx`: dua kartu pilihan → card `rounded-xl border border-border bg-surface p-5 shadow-theme-xs hover:shadow-theme-md transition` dengan ikon chip `bg-brand-500/10 text-brand-500 rounded-lg`; CTA tone brand; font-black → font-semibold.
- [ ] `not-found.tsx` + `AppErrorBoundary` (App.tsx): card token baru, button primary brand.
- [ ] `profile.tsx`: avatar ring `border-brand-500` (ganti ungu), card token, tambah row **toggle tema** (pakai `useTheme`, ikon Sun/Moon + label) — UI only.
- [ ] `pdf-download.tsx`: card/button token.
- [ ] Gate: typecheck + build.

### Task 5: Sapu halaman — gel 2 (auto-waste.tsx, 59 hit)

**Files:** `auto-waste.tsx` (hanya className/struktur visual; state machine, validasi, offline queue, paste parser tidak disentuh)

- [ ] Stepper/pill langkah: aktif `bg-brand-500 text-white`, done `bg-success-500 text-white`, upcoming `bg-surface-alt text-text-muted`.
- [ ] Semua input/select: token Bagian 2 (bg white/gray-900 via `bg-background`-surface pattern, border-border, focus:border-brand-500 focus:ring-brand-500/10).
- [ ] Kartu station/expand: `rounded-xl border border-border bg-surface shadow-theme-xs`; header expanded `bg-surface-alt`.
- [ ] Tombol: primary brand, secondary outline, danger error-500; foto upload area outline dashed border-border.
- [ ] ProgressOverlay/toast otomatis dari Task 2. Preview/success card token baru.
- [ ] Sapu semua `shadow-nb|bg-[#|text-[#|border-[#|font-black` di file ini.
- [ ] Gate: typecheck + build; jalankan manual flow paste (kalau dev server ada) minimal visual.

### Task 6: Sapu halaman — gel 3 (dashboard.tsx, admin group 5 file, api-docs.tsx)

**Files:** `dashboard.tsx`, `admin-panel.tsx`, `admin-personnel.tsx`, `admin-station-items.tsx`, `admin-users.tsx`, `admin-history.tsx`, `api-docs.tsx`

- [ ] `dashboard.tsx`: kartu statistik token; recharts: gridline `#e4e7ec`/dark `#344054`, axis tick `#667085`, tooltip `bg-white border-gray-200` / dark `bg-gray-900 border-gray-800 text-white/90`, seri: brand `#465fff`, success `#12b76a`, warning `#f79009`, error `#f04438`, blue-light `#0ba5ec`.
- [ ] Admin 5 file: tabel header `bg-surface-alt text-[10px] uppercase text-text-muted`, row `border-b border-border hover:bg-gray-50 dark:hover:bg-white/[0.03]`; dialog/form/badge token; font-black → font-semibold; hex → token.
- [ ] `api-docs.tsx`: code block `bg-gray-900 text-gray-100 border-gray-800` (tetap gelap di light mode), card token.
- [ ] Gate: typecheck + build.

### Task 7: Login

**Files:** `login-form.tsx`

- [ ] Rewrite markup gaya signin TailAdmin: split screen — kiri brand panel `bg-gradient-to-br from-brand-500 to-brand-600` hidden lg:flex (logo, tagline, grid dekoratif halus via inline svg/bg pattern), kanan area form `bg-background` dengan card `rounded-xl border border-border bg-surface shadow-theme-lg max-w-sm`.
- [ ] Input: wrapper rounded-lg border, ikon lucide `User`/`Lock` (ganti emoji), password toggle `Eye/EyeOff` (state/behavior sama).
- [ ] Error banner `bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-400`.
- [ ] Submit `bg-brand-500 hover:bg-brand-600 text-white rounded-lg shadow-theme-xs` + ButtonLoadingSpinner saat loading; disabled opacity-50.
- [ ] Footer `A Product By MarkoID` tetap.
- [ ] Tidak menyentuh useAuth/validasi/handler.
- [ ] Gate: typecheck + build.

### Task 8: Gate akhir + push

- [ ] `npm run typecheck` + `npm run typecheck:api` + `npm run build` — semua sukses.
- [ ] Grep nol: `shadow-nb`, `shadow-card`, `bg-[#`, `text-[#`, `border-[#`, `font-black`, `Nunito` di `src/` (kecuali none).
- [ ] `git diff main --name-only` hanya file yang diizinkan (tsx UI/pages, App.tsx, main.tsx, index.css, ThemeContext, tailwind.config.ts, index.html, docs/spec/plan).
- [ ] Commit per task sudah terjadi; push branch. Tanpa PR otomatis.
