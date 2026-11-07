# AUDIT — INITIAL SUPER ADMIN ACCOUNT
## EDUTAKTIS SAAS

Laporan audit READ-ONLY mengenai status dan keberadaan akun SUPER_ADMIN pada aplikasi EduTaktis.

### 1. RINGKASAN STATUS
Status: **B. Role SUPER_ADMIN tersedia tetapi belum ada akun penggunanya.**

Berdasarkan audit pada database (`prisma/schema.prisma`) dan logika aplikasi, peran (role) `SUPER_ADMIN` telah didefinisikan dalam `InstitutionRole` enum, namun tidak ditemukan mekanisme seed, bootstrap, atau pengguna yang memiliki peran ini secara eksplisit dalam basis data maupun script inisialisasi.

### 2. AUDIT DETAIL

- **Role SUPER_ADMIN**: Tersedia dalam enum `InstitutionRole` dan digunakan dalam logika `PlatformAdminService`.
- **Akun SUPER_ADMIN**: Belum ditemukan dalam sistem.
- **Lokasi Seed/Bootstrap**: Tidak ditemukan script `seed.ts`, `seed.js`, atau konfigurasi environment variable untuk pembuatan admin awal.
- **Mekanisme Login**: Login dilakukan melalui `src/services/authClient.ts` dan `src/components/AuthModal.tsx`. Tidak ditemukan pengecualian atau mekanisme khusus untuk akun `SUPER_ADMIN` yang tidak terikat dengan institusi.

### 3. PENYEBAB
Sistem saat ini belum mengimplementasikan prosedur inisialisasi untuk membuat akun `SUPER_ADMIN` pertama kali. Aplikasi mengandalkan pendaftaran pengguna melalui `AuthModal` dan penugasan peran melalui tindakan admin platform, yang menciptakan situasi *deadlock* (membutuhkan admin untuk membuat admin).

### 4. REKOMENDASI

Untuk membuat akun `SUPER_ADMIN` pertama kali secara aman:

1. **Script Inisialisasi**: Buat script CLI menggunakan Prisma untuk membuat pengguna pertama, mengaitkannya dengan institusi dummy (jika diperlukan), dan memberikan peran `SUPER_ADMIN`.
2. **Environment Variable**: Gunakan variabel lingkungan (misalnya: `INITIAL_SUPER_ADMIN_EMAIL`) pada saat deployment pertama kali untuk memicu pembuatan admin melalui script startup backend.
3. **Penyetelan Manual**: Setelah deployment, gunakan CLI database untuk menyisipkan pengguna secara manual, lalu berikan peran `SUPER_ADMIN` melalui `institution_memberships`.
