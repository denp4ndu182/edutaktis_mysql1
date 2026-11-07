# EduTaktis SaaS — Blueprint Migrasi Data Lokal Menuju PostgreSQL

## 1. Perlindungan Data Eksisting (Zero-Data-Loss Policy)
Selama PHASE 3A, seluruh data lokal pada browser (`localStorage`) tetap dipertahankan secara utuh dan menjadi fallback operasional:
- `kbc_user_profile_v1`
- `kbc_users_v2`
- `kbc_current_user_id_v2`
- `kbc_institutions_v2`
- `kbc_memberships_v2`
- `kbc_active_institution_id_v2`
- `kbc_administrasi_projects_v1`

Data demo percontohan (`Ahmad Fauzi, S.Kom.` / `MTs Negeri 1 Kota Yogyakarta`) **dilarang keras** diimpor ke database PostgreSQL produksi.

---

## 2. Alur 10 Tahapan Migrasi Data (Untuk Fase Berikutnya)

```
[1. Export JSON] --------> [2. Schema Validation] ----> [3. Review & Preview UI]
                                                                 |
[6. Assign Institution] <- [5. Assign Project Owner] <- [4. Map User & School]
       |
[7. Duplicate Detection] -> [8. User Explicit Consent] -> [9. ACID Transaction Import]
                                                                 |
                                                       [10. Audit Verification Report]
```

### Tahap 1 — Ekspor Cadangan Lokal
Pengguna mengunduh snapshot data lengkap dari browser dalam format JSON terenkripsi/tervalidasi.

### Tahap 2 — Validasi Struktur Data
Backend memvalidasi setiap record menggunakan skema Zod/TypeScript:
- Format email valid.
- NPSN 8 digit angka.
- Struktur Master Input dan 6 dokumen administrasi lengkap.

### Tahap 3 — Tampilan Pratinjau (Preview)
Antarmuka menampilkan daftar entitas yang terdeteksi:
- Berapa jumlah profil guru yang ditemukan.
- Berapa jumlah madrasah.
- Berapa jumlah proyek administrasi yang siap dimigrasi.

### Tahap 4 — Pemetaan Pengguna dan Institusi
Menghubungkan profil guru dengan institusi asal berdasarkan NPSN resmi.

### Tahap 5 — Penetapan Pemilik Proyek (Ownership Assignment)
Setiap proyek administrasi lama yang sebelumnya anonim wajib diasosiasikan secara eksplisit ke akun guru pemiliknya (`user_id`).

### Tahap 6 — Penetapan Institusi Proyek (Tenant Scope Assignment)
Setiap proyek diasosiasikan ke satuan pendidikan tempat guru mengajar (`institution_id`).

### Tahap 7 — Deteksi Duplikasi
Sistem mendeteksi apakah NPSN madrasah atau NIP/Email guru sudah ada di database PostgreSQL untuk mencegah duplikasi data.

### Tahap 8 — Konfirmasi Eksplisit Pengguna
Migrasi **hanya** berjalan setelah pengguna meninjau ringkasan pemetaan dan menekan tombol konfirmasi.

### Tahap 9 — Eksekusi Transaksional (ACID Transaction)
Proses penulisan ke PostgreSQL dijalankan dalam blok transaksi `prisma.$transaction`:
- Jika terjadi error pada salah satu dokumen, seluruh proses di-*rollback* otomatis.
- Data lokal di browser **tidak dihapus** sebelum proses verifikasi berhasil 100%.

### Tahap 10 — Laporan Hasil Migrasi & Verifikasi
Menampilkan laporan rinci: jumlah data yang berhasil masuk, ID referensi database, dan status keutuhan 6 dokumen administrasi.
