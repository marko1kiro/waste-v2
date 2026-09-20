# BACKUP & RESTORE DATABASE (Neon PostgreSQL)

Runbook operasional untuk database produksi AWAS v4. Database ini menyimpan
dokumen compliance (Berita Acara pemusnahan) — kehilangan data bukan opsi.

---

## 1. Target RPO / RTO

| Metrik | Target | Keterangan |
|--------|--------|------------|
| **RPO** (data maksimal hilang) | ≤ 1 jam | Backup logis berkala + PITR Neon bila tersedia di plan |
| **RTO** (waktu pulih) | ≤ 4 jam | Restore `pg_dump` ke database baru + ganti `DATABASE_URL` |

Target ini realistis untuk operasional resto; naikkan ke tier plan Neon
yang lebih tinggi bila butuh RPO menit.

---

## 2. Verifikasi fitur Neon pada plan yang dipakai

Neon menyediakan dua mekanisme pemulihan bawaan. **Verifikasi di dashboard
Neon (project → Settings / Restore)** plan mana yang aktif:

1. **Point-in-Time Recovery (PITR)** — restore ke detik tertentu dalam
   retention window (tergantung plan; biasanya 7 hari di plan berbayar).
2. **Branching** — clone database ke branch terpisah (bagus untuk uji
   restore tanpa menyentuh produksi).

Checklist verifikasi (lakukan sekali, catat hasilnya):
- [ ] Retention window PITR: ____ hari
- [ ] Branching tersedia: ya / tidak
- [ ] Restore history point terakhir berhasil dibuat: tanggal ____

> Tanpa PITR (plan free), satu-satunya jaring pengaman adalah `pg_dump`
> berkala di bawah ini. Jangan lewatkan.

---

## 3. Backup logis berkala (`pg_dump`)

Jalankan dari mesin yang punya akses `DATABASE_URL` produksi
(bukan dari Vercel function — gunakan CI terjadwal / cron server / laptop ops).

```bash
# 1. Dump (format custom, terkompresi)
pg_dump "$DATABASE_URL" -Fc -f "awas-backup-$(date +%F-%H%M).dump"

# 2. Verifikasi file tidak korup (list isi tanpa restore)
pg_restore --list "awas-backup-$(date +%F).dump" | head

# 3. Simpan di 2 lokasi berbeda (mis. R2 + disk lokal terenkripsi),
#    retensi minimal 30 hari.
```

Jadwal yang disarankan:

| Frekuensi | Waktu (WIB) | Alasan |
|-----------|-------------|--------|
| Harian | 06:00 (setelah cutoff 05:00) | Menangkap seluruh business date kemarin |
| Mingguan | Minggu 06:00, retensi 90 hari | Cadangan jangka menengah |

Otomatisasi: GitHub Actions `schedule` cron atau cron di server ops.
Jangan taruh `DATABASE_URL` produksi di log — pakai GitHub Secrets.

### Backup pra-operasi destruktif

Setiap script destruktif (`scripts/deactivate-all-personnel.ts`,
`scripts/cleanup-personnel-dupes.ts`, migrasi skema) WAJIB didahului dump
tabel terdampak:

```bash
pg_dump "$DATABASE_URL" -t personnel -Fc -f "pre-deactivate-personnel-$(date +%F).dump"
```

Script destruktif di repo ini default **dry-run** dan menolak berjalan
ke database produksi tanpa `--confirm --i-know-this-is-prod`.

---

## 4. Prosedur restore (uji minimal 1x per kuartal)

Uji restore ke database **baru/kosong** — jangan pernah restore menimpa
produksi tanpa persetujuan tertulis.

```bash
# 1. Buat database kosong baru (Neon dashboard / psql)
createdb "$RESTORE_DATABASE_URL" # atau via Neon: database baru

# 2. Restore
pg_restore -d "$RESTORE_DATABASE_URL" --no-owner awas-backup-YYYY-MM-DD.dump

# 3. Verifikasi
psql "$RESTORE_DATABASE_URL" -c "SELECT count(*) FROM product_destructions;"
psql "$RESTORE_DATABASE_URL" -c "SELECT max(business_date) FROM daily_records;"
```

Checklist uji restore:
- [ ] Restore selesai tanpa error
- [ ] Jumlah baris `product_destructions` sesuai ekspektasi (± dari backup)
- [ ] `business_date` terakhir = tanggal backup
- [ ] Aplikasi bisa login dengan `DATABASE_URL` restore (mode baca, di staging)
- [ ] Tanggal uji & hasil dicatat: ____

### Failover darurat (produksi down / data rusak)

1. Buat database baru di Neon (atau restore PITR ke point terakhir yang sehat).
2. Restore dump terakhir yang terverifikasi.
3. Update env var `DATABASE_URL` di Vercel → redeploy (atau restart).
4. Verifikasi: login, buka dashboard, cek data hari berjalan.
5. Catat insiden: kapan, penyebab, RPO aktual, RTO aktual.

---

## 5. Yang TIDAK di-backup oleh runbook ini

- **Foto dokumentasi** → sudah di Cloudflare R2 / Vercel Blob (replikasi bawaan provider).
- **PDF Berita Acara** → sudah di-backup otomatis ke Google Drive + R2
  (lihat `docs/09-GOOGLE-DRIVE-BACKUP.md`).
- Runbook ini khusus **database relasional** (Neon PostgreSQL).
