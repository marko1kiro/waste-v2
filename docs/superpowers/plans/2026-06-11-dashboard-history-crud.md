# Dashboard History & CRUD Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the `admin_store` dashboard from analytics charts into a History Input page with full CRUD per item, while keeping the `super_admin` analytics dashboard unchanged.

**Architecture:** New `api/items.ts` endpoint handles GET/POST/PUT/DELETE for `product_destructions` rows. `dashboard.tsx` renders `DashboardHistory` for `admin_store` and existing `Dashboard` for `super_admin`, gated by role from `useAuth`.

**Tech Stack:** React, @tanstack/react-query, jspdf-autotable, Tailwind CSS (neo-brutalism), Vercel Serverless Functions, Neon PostgreSQL via `@neondatabase/serverless`.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `api/items.ts` | Create | GET/POST/PUT/DELETE for product_destructions rows |
| `src/pages/dashboard.tsx` | Modify | Add role-branch: render DashboardHistory for admin_store |

---

### Task 1: Create `api/items.ts` — GET handler

**Files:**
- Create: `api/items.ts`

- [ ] **Step 1: Create the file with GET handler**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSQL, authenticateRequest } from './lib.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const payload = authenticateRequest(req)
  if (!payload) return res.status(401).json({ error: 'Unauthorized' })

  const sql = getSQL()

  if (req.method === 'GET') {
    const { date, shift, station } = req.query as Record<string, string | undefined>

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Format date harus YYYY-MM-DD' })
    }

    try {
      let rows
      if (shift && station) {
        rows = await sql`
          SELECT id, business_date::text AS business_date, shift, kategori_induk,
            nama_produk, kode_produk, jumlah_produk, unit,
            metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan,
            paraf_qc_name, paraf_manager_name, submitted_by, created_at
          FROM product_destructions
          WHERE business_date::text = ${date} AND shift = ${shift} AND kategori_induk = ${station}
          ORDER BY created_at ASC
        `
      } else if (shift) {
        rows = await sql`
          SELECT id, business_date::text AS business_date, shift, kategori_induk,
            nama_produk, kode_produk, jumlah_produk, unit,
            metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan,
            paraf_qc_name, paraf_manager_name, submitted_by, created_at
          FROM product_destructions
          WHERE business_date::text = ${date} AND shift = ${shift}
          ORDER BY kategori_induk ASC, created_at ASC
        `
      } else {
        rows = await sql`
          SELECT id, business_date::text AS business_date, shift, kategori_induk,
            nama_produk, kode_produk, jumlah_produk, unit,
            metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan,
            paraf_qc_name, paraf_manager_name, submitted_by, created_at
          FROM product_destructions
          WHERE business_date::text = ${date}
          ORDER BY
            CASE shift
              WHEN 'OPENING' THEN 1 WHEN 'MIDDLE' THEN 2
              WHEN 'CLOSING' THEN 3 WHEN 'MIDNIGHT' THEN 4
            END,
            kategori_induk ASC, created_at ASC
        `
      }
      return res.status(200).json({ success: true, data: rows })
    } catch (err) {
      console.error('[items GET] Error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:api
```
Expected: no errors.

---

### Task 2: Add POST to `api/items.ts`

**Files:**
- Modify: `api/items.ts`

- [ ] **Step 1: Replace the `return res.status(405)...` at the end with POST + final 405**

Find this line at the bottom of the handler:
```typescript
  return res.status(405).json({ error: 'Method not allowed' })
```

Replace with:
```typescript
  if (req.method === 'POST') {
    const {
      business_date, shift, kategori_induk, nama_produk, kode_produk,
      jumlah_produk, unit, metode_pemusnahan, alasan_pemusnahan,
      jam_tanggal_pemusnahan, store_name,
      paraf_qc_url, paraf_qc_name, paraf_manager_url, paraf_manager_name,
    } = req.body || {}

    if (!business_date || !shift || !kategori_induk || !nama_produk || !jumlah_produk || !unit) {
      return res.status(400).json({ error: 'business_date, shift, kategori_induk, nama_produk, jumlah_produk, unit wajib diisi' })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(business_date))) {
      return res.status(400).json({ error: 'Format business_date harus YYYY-MM-DD' })
    }

    try {
      const rows = await sql`
        INSERT INTO product_destructions (
          business_date, shift, store_name, kategori_induk,
          nama_produk, kode_produk, jumlah_produk, unit,
          metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan,
          paraf_qc_url, paraf_qc_name, paraf_manager_url, paraf_manager_name,
          dokumentasi_urls, submitted_by
        ) VALUES (
          ${String(business_date)}, ${String(shift)}, ${String(store_name || '')}, ${String(kategori_induk)},
          ${String(nama_produk).toUpperCase()}, ${String(kode_produk || '')}, ${Number(jumlah_produk)}, ${String(unit)},
          ${String(metode_pemusnahan || 'DIBUANG')}, ${String(alasan_pemusnahan || '')}, ${String(jam_tanggal_pemusnahan || '')},
          ${String(paraf_qc_url || '')}, ${String(paraf_qc_name || '')}, ${String(paraf_manager_url || '')}, ${String(paraf_manager_name || '')},
          '', ${payload.sub}
        )
        RETURNING id, business_date::text AS business_date, shift, kategori_induk,
          nama_produk, kode_produk, jumlah_produk, unit,
          metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan,
          paraf_qc_name, paraf_manager_name, submitted_by, created_at
      `
      return res.status(201).json({ success: true, data: rows[0] })
    } catch (err) {
      console.error('[items POST] Error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:api
```
Expected: no errors.

---

### Task 3: Add PUT and DELETE to `api/items.ts`

**Files:**
- Modify: `api/items.ts`

- [ ] **Step 1: Replace the final `return res.status(405)...` with PUT + DELETE + final 405**

Find:
```typescript
  return res.status(405).json({ error: 'Method not allowed' })
```

Replace with:
```typescript
  if (req.method === 'PUT') {
    const { id } = req.query as Record<string, string | undefined>
    if (!id || isNaN(Number(id))) return res.status(400).json({ error: 'id wajib valid' })

    const {
      nama_produk, kode_produk, jumlah_produk, unit,
      metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan,
    } = req.body || {}

    if (!nama_produk || !jumlah_produk || !unit) {
      return res.status(400).json({ error: 'nama_produk, jumlah_produk, unit wajib diisi' })
    }

    try {
      const rows = await sql`
        UPDATE product_destructions
        SET
          nama_produk = ${String(nama_produk).toUpperCase()},
          kode_produk = ${String(kode_produk || '')},
          jumlah_produk = ${Number(jumlah_produk)},
          unit = ${String(unit)},
          metode_pemusnahan = ${String(metode_pemusnahan || 'DIBUANG')},
          alasan_pemusnahan = ${String(alasan_pemusnahan || '')},
          jam_tanggal_pemusnahan = ${String(jam_tanggal_pemusnahan || '')}
        WHERE id = ${Number(id)}
        RETURNING id, business_date::text AS business_date, shift, kategori_induk,
          nama_produk, kode_produk, jumlah_produk, unit,
          metode_pemusnahan, alasan_pemusnahan, jam_tanggal_pemusnahan,
          paraf_qc_name, paraf_manager_name, submitted_by, created_at
      `
      if (!rows.length) return res.status(404).json({ error: 'Item tidak ditemukan' })
      return res.status(200).json({ success: true, data: rows[0] })
    } catch (err) {
      console.error('[items PUT] Error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query as Record<string, string | undefined>
    if (!id || isNaN(Number(id))) return res.status(400).json({ error: 'id wajib valid' })

    try {
      const deleted = await sql`
        DELETE FROM product_destructions WHERE id = ${Number(id)}
        RETURNING id, business_date::text AS business_date, shift
      `
      if (!deleted.length) return res.status(404).json({ error: 'Item tidak ditemukan' })

      const { business_date, shift } = deleted[0]
      const remaining = await sql`
        SELECT COUNT(*)::int AS cnt FROM product_destructions
        WHERE business_date::text = ${String(business_date)} AND shift = ${String(shift)}
      `
      if (Number(remaining[0].cnt) === 0) {
        await sql`DELETE FROM daily_records WHERE business_date::text = ${String(business_date)} AND shift = ${String(shift)}`
      }

      return res.status(200).json({ success: true, shiftCleared: Number(remaining[0].cnt) === 0 })
    } catch (err) {
      console.error('[items DELETE] Error:', err)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck:api
```
Expected: no errors.

---

### Task 4: Add `DashboardHistory` component to `dashboard.tsx`

**Files:**
- Modify: `src/pages/dashboard.tsx`

- [ ] **Step 1: Add imports at the top of `dashboard.tsx`**

After the existing imports, add:
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import { Pencil, Trash2, Plus, Check, X, Loader2, CalendarDays } from 'lucide-react'
import { getBusinessDateWIB } from '@shared/timezone'
import { METHODS, REASONS, STATIONS, SHIFTS } from '@shared/schema'
```

- [ ] **Step 2: Add the `ItemRow` interface after existing interfaces in `dashboard.tsx`**

After the `DashboardData` interface, add:
```typescript
interface ItemRow {
  id: number
  business_date: string
  shift: string
  kategori_induk: string
  nama_produk: string
  kode_produk: string
  jumlah_produk: number
  unit: string
  metode_pemusnahan: string
  alasan_pemusnahan: string
  jam_tanggal_pemusnahan: string
  paraf_qc_name: string
  paraf_manager_name: string
  submitted_by: string
  created_at: string
}

interface EditForm {
  nama_produk: string
  kode_produk: string
  jumlah_produk: number
  unit: string
  metode_pemusnahan: string
  alasan_pemusnahan: string
  jam_tanggal_pemusnahan: string
}

interface AddForm extends EditForm {
  shift: string
  kategori_induk: string
}
```

- [ ] **Step 3: Add `DashboardHistory` component at the bottom of `dashboard.tsx`, before the last closing line**

Add this entire component before the end of the file (after the last helper function):

```typescript
export function DashboardHistory() {
  const [selectedDate, setSelectedDate] = useState(getBusinessDateWIB())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<EditForm | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [addingFor, setAddingFor] = useState<{ shift: string; station: string } | null>(null)
  const [addForm, setAddForm] = useState<AddForm | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ success: boolean; data: ItemRow[] }>({
    queryKey: ['items', selectedDate],
    queryFn: () => apiClient.fetch(`/api/items?date=${selectedDate}`),
    enabled: !!selectedDate,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, form }: { id: number; form: EditForm }) =>
      apiClient.fetch(`/api/items?id=${id}`, { method: 'PUT', body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success('Item diupdate.')
      setEditingId(null)
      setEditForm(null)
      qc.invalidateQueries({ queryKey: ['items', selectedDate] })
    },
    onError: (err) => toast.error('Gagal update', err instanceof Error ? err.message : 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.fetch(`/api/items?id=${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Item dihapus.')
      setConfirmDeleteId(null)
      qc.invalidateQueries({ queryKey: ['items', selectedDate] })
      qc.invalidateQueries({ queryKey: ['shift-status'] })
    },
    onError: (err) => toast.error('Gagal hapus', err instanceof Error ? err.message : 'Error'),
  })

  const addMutation = useMutation({
    mutationFn: (form: AddForm & { business_date: string }) =>
      apiClient.fetch('/api/items', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => {
      toast.success('Item ditambahkan.')
      setAddingFor(null)
      setAddForm(null)
      qc.invalidateQueries({ queryKey: ['items', selectedDate] })
      qc.invalidateQueries({ queryKey: ['shift-status'] })
    },
    onError: (err) => toast.error('Gagal tambah', err instanceof Error ? err.message : 'Error'),
  })

  const items = data?.data || []

  const grouped = items.reduce<Record<string, Record<string, ItemRow[]>>>((acc, item) => {
    if (!acc[item.shift]) acc[item.shift] = {}
    if (!acc[item.shift][item.kategori_induk]) acc[item.shift][item.kategori_induk] = []
    acc[item.shift][item.kategori_induk].push(item)
    return acc
  }, {})

  function startEdit(item: ItemRow) {
    setEditingId(item.id)
    setEditForm({
      nama_produk: item.nama_produk,
      kode_produk: item.kode_produk,
      jumlah_produk: item.jumlah_produk,
      unit: item.unit,
      metode_pemusnahan: item.metode_pemusnahan,
      alasan_pemusnahan: item.alasan_pemusnahan,
      jam_tanggal_pemusnahan: item.jam_tanggal_pemusnahan,
    })
  }

  function startAdd(shift: string, station: string) {
    setAddingFor({ shift, station })
    setAddForm({
      shift,
      kategori_induk: station,
      nama_produk: '',
      kode_produk: '',
      jumlah_produk: 1,
      unit: 'PCS',
      metode_pemusnahan: 'DIBUANG',
      alasan_pemusnahan: 'EXPIRED',
      jam_tanggal_pemusnahan: '',
    })
  }

  const inputCls = 'w-full rounded border border-border bg-[#0d0d0d] px-2 py-1 text-xs text-text-primary focus:border-primary focus:outline-none'
  const selectCls = inputCls

  return (
    <div className="mx-auto max-w-5xl py-2">
      <div className="mb-4 flex items-center gap-3">
        <CalendarDays size={18} className="text-primary" />
        <h1 className="text-lg font-black text-text-primary">History Input</h1>
      </div>

      <div className="mb-4 rounded-xl border-2 border-border bg-[#111] p-4 shadow-nb-sm">
        <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[#666]">Pilih Tanggal</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="rounded-lg border-2 border-border bg-[#0d0d0d] px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-10 text-text-muted">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm">Memuat data...</span>
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border-2 border-border bg-[#111] p-6 text-center shadow-nb-sm">
          <p className="text-sm text-text-muted">Tidak ada data untuk tanggal <strong className="text-text-primary">{selectedDate}</strong>.</p>
        </div>
      )}

      {!isLoading && (SHIFTS as readonly string[]).map((shift) => {
        const stationMap = grouped[shift]
        if (!stationMap) return null
        return (
          <div key={shift} className="mb-4 rounded-xl border-2 border-border bg-[#111] shadow-nb-sm">
            <div className="flex items-center gap-2 border-b border-border bg-[#191919] px-4 py-2.5">
              <span className="text-xs font-black text-warning">{shift}</span>
            </div>
            <div className="divide-y divide-border">
              {Object.entries(stationMap).map(([station, rows]) => (
                <div key={station} className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-text-primary">{station}</span>
                      <span className="rounded-full bg-[#222] px-2 py-0.5 text-[10px] text-text-muted">{rows.length} item</span>
                      <span className="text-[10px] text-text-dim">by {rows[0]?.submitted_by || '-'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => startAdd(shift, station)}
                      className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary transition hover:border-primary"
                    >
                      <Plus size={11} /> Tambah
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-widest text-[#555]">
                          <th className="pb-1 pr-2">Nama Produk</th>
                          <th className="pb-1 pr-2 text-center">Qty</th>
                          <th className="pb-1 pr-2">Unit</th>
                          <th className="pb-1 pr-2">Metode</th>
                          <th className="pb-1 pr-2">Alasan</th>
                          <th className="pb-1 pr-2">Jam</th>
                          <th className="pb-1"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {rows.map((item) => (
                          editingId === item.id && editForm ? (
                            <tr key={item.id} className="bg-primary/5">
                              <td className="py-1.5 pr-2"><input value={editForm.nama_produk} onChange={(e) => setEditForm({ ...editForm, nama_produk: e.target.value })} className={inputCls} /></td>
                              <td className="py-1.5 pr-2"><input type="number" min={1} value={editForm.jumlah_produk} onChange={(e) => setEditForm({ ...editForm, jumlah_produk: Number(e.target.value) })} className={inputCls + ' w-16 text-center'} /></td>
                              <td className="py-1.5 pr-2">
                                <select value={editForm.unit} onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })} className={selectCls + ' w-20'}>
                                  {['PORSI','PCS','GRAM','PACK'].map(u => <option key={u}>{u}</option>)}
                                </select>
                              </td>
                              <td className="py-1.5 pr-2">
                                <select value={editForm.metode_pemusnahan} onChange={(e) => setEditForm({ ...editForm, metode_pemusnahan: e.target.value })} className={selectCls}>
                                  {(METHODS as readonly string[]).map(m => <option key={m}>{m}</option>)}
                                </select>
                              </td>
                              <td className="py-1.5 pr-2">
                                <select value={editForm.alasan_pemusnahan} onChange={(e) => setEditForm({ ...editForm, alasan_pemusnahan: e.target.value })} className={selectCls}>
                                  {(REASONS as readonly string[]).map(r => <option key={r}>{r}</option>)}
                                </select>
                              </td>
                              <td className="py-1.5 pr-2"><input value={editForm.jam_tanggal_pemusnahan} onChange={(e) => setEditForm({ ...editForm, jam_tanggal_pemusnahan: e.target.value })} className={inputCls + ' w-24'} /></td>
                              <td className="py-1.5">
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => updateMutation.mutate({ id: item.id, form: editForm })} disabled={updateMutation.isPending} className="rounded bg-success/20 p-1 text-success hover:bg-success/30"><Check size={12} /></button>
                                  <button type="button" onClick={() => { setEditingId(null); setEditForm(null) }} className="rounded bg-[#222] p-1 text-text-muted hover:text-text-primary"><X size={12} /></button>
                                </div>
                              </td>
                            </tr>
                          ) : (
                            <tr key={item.id} className="hover:bg-white/[0.02]">
                              <td className="py-1.5 pr-2 font-medium text-text-primary">{item.nama_produk}</td>
                              <td className="py-1.5 pr-2 text-center text-text-primary">{item.jumlah_produk}</td>
                              <td className="py-1.5 pr-2 text-text-muted">{item.unit}</td>
                              <td className="py-1.5 pr-2 text-text-muted">{item.metode_pemusnahan}</td>
                              <td className="py-1.5 pr-2 text-text-muted">{item.alasan_pemusnahan}</td>
                              <td className="py-1.5 pr-2 text-text-muted">{item.jam_tanggal_pemusnahan || '-'}</td>
                              <td className="py-1.5">
                                <div className="flex gap-1">
                                  <button type="button" onClick={() => startEdit(item)} className="rounded bg-primary/10 p-1 text-primary hover:bg-primary/20"><Pencil size={11} /></button>
                                  <button type="button" onClick={() => setConfirmDeleteId(item.id)} className="rounded bg-danger/10 p-1 text-danger hover:bg-danger/20"><Trash2 size={11} /></button>
                                </div>
                              </td>
                            </tr>
                          )
                        ))}

                        {addingFor?.shift === shift && addingFor?.station === station && addForm && (
                          <tr className="bg-success/5">
                            <td className="py-1.5 pr-2"><input placeholder="Nama produk" value={addForm.nama_produk} onChange={(e) => setAddForm({ ...addForm, nama_produk: e.target.value })} className={inputCls} /></td>
                            <td className="py-1.5 pr-2"><input type="number" min={1} value={addForm.jumlah_produk} onChange={(e) => setAddForm({ ...addForm, jumlah_produk: Number(e.target.value) })} className={inputCls + ' w-16 text-center'} /></td>
                            <td className="py-1.5 pr-2">
                              <select value={addForm.unit} onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })} className={selectCls + ' w-20'}>
                                {['PORSI','PCS','GRAM','PACK'].map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <select value={addForm.metode_pemusnahan} onChange={(e) => setAddForm({ ...addForm, metode_pemusnahan: e.target.value })} className={selectCls}>
                                {(METHODS as readonly string[]).map(m => <option key={m}>{m}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <select value={addForm.alasan_pemusnahan} onChange={(e) => setAddForm({ ...addForm, alasan_pemusnahan: e.target.value })} className={selectCls}>
                                {(REASONS as readonly string[]).map(r => <option key={r}>{r}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2"><input placeholder="Jam" value={addForm.jam_tanggal_pemusnahan} onChange={(e) => setAddForm({ ...addForm, jam_tanggal_pemusnahan: e.target.value })} className={inputCls + ' w-24'} /></td>
                            <td className="py-1.5">
                              <div className="flex gap-1">
                                <button type="button" onClick={() => addMutation.mutate({ ...addForm, business_date: selectedDate })} disabled={!addForm.nama_produk || addForm.jumlah_produk < 1 || addMutation.isPending} className="rounded bg-success/20 p-1 text-success hover:bg-success/30 disabled:opacity-40"><Check size={12} /></button>
                                <button type="button" onClick={() => { setAddingFor(null); setAddForm(null) }} className="rounded bg-[#222] p-1 text-text-muted hover:text-text-primary"><X size={12} /></button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {(!addingFor || addingFor.shift !== shift || addingFor.station !== station) && (
                    <button type="button" onClick={() => startAdd(shift, station)} className="mt-2 flex items-center gap-1 text-[11px] text-text-dim hover:text-primary">
                      <Plus size={11} /> Tambah item ke {station}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      <ConfirmDialog
        open={confirmDeleteId !== null}
        title="Hapus Item"
        description="Yakin hapus item ini? Jika ini item terakhir di shift tersebut, status shift akan direset."
        confirmLabel="Ya, Hapus"
        onConfirm={() => { if (confirmDeleteId !== null) deleteMutation.mutate(confirmDeleteId) }}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Typecheck frontend**

```bash
npm run typecheck
```
Expected: no errors.

---

### Task 5: Wire `DashboardHistory` into `Dashboard` export

**Files:**
- Modify: `src/pages/dashboard.tsx`

- [ ] **Step 1: Modify the `Dashboard` default export to branch by role**

Find:
```typescript
export default function Dashboard() {
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>(30)
```

Replace with:
```typescript
export default function Dashboard() {
  const { user } = useAuth()
  if (user?.role === 'admin_store') return <DashboardHistory />

  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>(30)
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```
Expected: no errors.

---

### Task 6: Build and deploy

**Files:** none new

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: `✓ built in <N>s` with no errors.

- [ ] **Step 2: Typecheck API**

```bash
npm run typecheck:api
```
Expected: no errors.

- [ ] **Step 3: Deploy**

```bash
npx vercel --prod
```
Expected: `✓ Ready in <N>s` and `Aliased https://www.gacoanku.my.id`.

- [ ] **Step 4: Smoke test — GET items endpoint**

```bash
# Should return 401 (auth working)
(Invoke-WebRequest -Uri "https://www.gacoanku.my.id/api/items?date=2026-06-10" -Method Get -MaximumRedirection 0 -ErrorAction Stop).StatusCode
```
Expected: `401`

---

## Self-Review

**Spec coverage check:**
- ✅ GET /api/items — Task 1
- ✅ POST /api/items — Task 2
- ✅ PUT /api/items — Task 3
- ✅ DELETE /api/items (+ daily_records cleanup) — Task 3
- ✅ DashboardHistory component with date picker — Task 4
- ✅ Inline edit row — Task 4
- ✅ Delete with ConfirmDialog — Task 4
- ✅ Add new item form — Task 4
- ✅ Role branch in Dashboard — Task 5
- ✅ super_admin unchanged — Task 5 (only admin_store gets DashboardHistory)

**No placeholders found.**

**Type consistency:**
- `ItemRow`, `EditForm`, `AddForm` defined in Task 4, used consistently throughout Task 4 and Task 5.
- `METHODS`, `REASONS`, `SHIFTS` imported from `@shared/schema` — already exported there.
