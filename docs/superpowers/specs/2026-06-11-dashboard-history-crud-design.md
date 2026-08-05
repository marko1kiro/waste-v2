# Dashboard Overhaul — History & CRUD for admin_store

**Date:** 2026-06-11  
**Status:** Approved

---

## Overview

Replace the analytics dashboard for `admin_store` role with a History Input page that shows submitted waste data per date, grouped by shift and station, with full CRUD capability (edit all fields except `business_date` and `shift`, delete individual items).

`super_admin` continues to see the existing analytics dashboard unchanged.

---

## Architecture

### Routing

- `/dashboard` route serves different components based on role:
  - `admin_store` → new `DashboardHistory` component
  - `super_admin` → existing `Dashboard` (analytics, unchanged)
- No new route needed — handled inside `dashboard.tsx` with a role check.

### Backend — New API endpoint

**File:** `api/items.ts`

| Method | Query params | Action |
|--------|-------------|--------|
| GET | `date`, `shift` (optional), `station` (optional) | List items from `product_destructions` |
| POST | — | Insert new row |
| PUT | `id` | Update row (all fields except `business_date`, `shift`) |
| DELETE | `id` | Delete row; if shift becomes empty → delete `daily_records` row |

Auth: any authenticated user (`admin_store` or `super_admin`).

**Vercel functions config:** add `"api/items.ts"` to `vercel.json` functions glob — already covered by `api/**/*.ts`.

### Frontend — `DashboardHistory` component

Lives inside `src/pages/dashboard.tsx`, rendered only for `admin_store`.

#### Layout

```
[Date picker]  ← default: today's business date (WIB)

For each shift that has data (OPENING → MIDDLE → CLOSING → MIDNIGHT):
  ┌─ SHIFT LABEL ──────────────────────────────────┐
  │  ┌─ STATION NAME  (N item, by: username) ──┐   │
  │  │  table: NO | NAMA PRODUK | QTY | UNIT   │   │
  │  │         METODE | ALASAN | JAM | [actions]│   │
  │  │  [+ Tambah Item]                         │   │
  │  └─────────────────────────────────────────┘   │
  └────────────────────────────────────────────────┘
```

#### Edit Item

- Clicking Edit converts the row to an inline editable form.
- Editable fields: `nama_produk`, `kode_produk`, `jumlah_produk`, `unit`, `metode_pemusnahan`, `alasan_pemusnahan`, `jam_tanggal_pemusnahan`.
- Save → `PUT /api/items?id=<id>` → optimistic update on success.
- Cancel → revert row to read-only.

#### Delete Item

- Clicking Hapus → `ConfirmDialog` → `DELETE /api/items?id=<id>`.
- After delete, if that was the last item in the shift, also send `DELETE /api/items?clearShift=true&date=&shift=` to clean up `daily_records`.
- Refetch list on success.

#### Tambah Item

- `+ Tambah Item` button per station.
- Opens a new blank row at the bottom of that station's table.
- Required fields: `nama_produk`, `jumlah_produk`, `unit`.
- Defaults: `metode_pemusnahan = 'DIBUANG'`, `alasan_pemusnahan = 'EXPIRED'`.
- On save → `POST /api/items` with `business_date`, `shift`, `kategori_induk` inherited from context.
- On success, refetch list.

#### State

- `selectedDate: string` — controlled date picker, default `getBusinessDateWIB()`
- `editingId: number | null` — which row is being edited
- `addingFor: { shift, station } | null` — which station has the add form open
- Data fetched via `useQuery(['items', selectedDate], ...)` hitting `GET /api/items?date=<date>`

---

## Data Flow

```
user picks date
  → GET /api/items?date=YYYY-MM-DD
  → group by shift → group by station
  → render sections

user clicks Edit row N
  → editingId = N, show inline form

user saves edit
  → PUT /api/items?id=N { ...fields }
  → invalidate query → re-render

user clicks Hapus row N
  → ConfirmDialog → DELETE /api/items?id=N
  → if shift now empty → DELETE daily_records row
  → invalidate query → re-render

user clicks + Tambah Item (shift S, station X)
  → addingFor = { S, X }
  → fill form → POST /api/items { date, shift: S, station: X, ...fields }
  → invalidate query → re-render
```

---

## API Spec

### GET /api/items?date=YYYY-MM-DD

Response:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "business_date": "2026-06-10",
      "shift": "OPENING",
      "kategori_induk": "NOODLE",
      "nama_produk": "MIE AYAM",
      "kode_produk": "",
      "jumlah_produk": 3,
      "unit": "PORSI",
      "metode_pemusnahan": "DIBUANG",
      "alasan_pemusnahan": "EXPIRED",
      "jam_tanggal_pemusnahan": "06:30 WIB",
      "paraf_qc_name": "SUSANTI",
      "paraf_manager_name": "MARKO",
      "submitted_by": "store",
      "created_at": "2026-06-10T23:30:00Z"
    }
  ]
}
```

### POST /api/items

Body:
```json
{
  "business_date": "2026-06-10",
  "shift": "OPENING",
  "kategori_induk": "NOODLE",
  "nama_produk": "MIE AYAM",
  "kode_produk": "",
  "jumlah_produk": 3,
  "unit": "PORSI",
  "metode_pemusnahan": "DIBUANG",
  "alasan_pemusnahan": "EXPIRED",
  "jam_tanggal_pemusnahan": "06:30 WIB",
  "store_name": "BEKASI KP. BULU",
  "paraf_qc_url": "",
  "paraf_qc_name": "",
  "paraf_manager_url": "",
  "paraf_manager_name": ""
}
```

### PUT /api/items?id=1

Body: same as POST except `business_date`, `shift`, `kategori_induk` are ignored.

### DELETE /api/items?id=1

Deletes row. Checks if `product_destructions` for that `(business_date, shift)` is now empty. If empty, deletes the corresponding `daily_records` row.

---

## Error Handling

- All API errors return `{ error: string }` with appropriate HTTP status.
- Frontend shows `toast.error(...)` on any failed mutation.
- Empty date (no data) shows a friendly empty state message.

---

## Out of Scope

- Editing `business_date` or `shift` — not allowed.
- Editing `dokumentasi_urls` or signature URLs — not in this iteration.
- `super_admin` dashboard — unchanged.
- Pagination — not needed (max ~50 items per day).
