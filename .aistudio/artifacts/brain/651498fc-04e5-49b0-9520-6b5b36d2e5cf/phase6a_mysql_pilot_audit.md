# MySQL Pilot Deployment Audit Report: EduTaktis SaaS (Rumahweb)

## 1. Ringkasan Arsitektur
Aplikasi EduTaktis tetap menggunakan stack pengembangan yang ada:
- **Frontend**: React 19 + Vite (SPA).
- **Backend**: Express.js (Node.js) dibundel via `esbuild`.
- **Database**: MySQL.
- **ORM**: Prisma (sudah dikonfigurasi dengan provider `mysql`).

## 2. Status Kompatibilitas MySQL
- **Provider**: `mysql` (VERIFIED).
- **Schema**: Saat ini sesuai dengan MySQL.
- **Relasi**: Foreign keys dan index sudah dioptimalkan untuk performa kueri multi-tenant (`@@unique`, `@@index`).
- **Migration History**: Sudah berjalan di lingkungan pengembangan (Baseline VERIFIED).

## 3. Kebutuhan Node.js
- **Runtime**: Memerlukan environment Node.js (disarankan v20+).
- **Persistence**: Aplikasi membutuhkan proses server yang persisten (misal: PM2). Shared hosting tradisional mungkin tidak mendukung ini; VPS Rumahweb sangat disarankan.

## 4. Kebutuhan Paket Hosting Rumahweb
- **Database**: Akses MySQL via cPanel/DirectAdmin (VERIFIED).
- **Node.js Support**: Memerlukan paket hosting yang mendukung Node.js (Node.js Selector atau VPS).
- **SSL**: HTTPS wajib untuk autentikasi sesi dan keamanan.

## 5. Kebutuhan Deployment
- **Build**: `npm run build` (menghasilkan `dist/server.js` dan aset frontend).
- **Start**: `node dist/server.js` (Membutuhkan persistent runtime).
- **Environment**: `DATABASE_URL`, `SESSION_SECRET`, `CSRF_SECRET`, `GEMINI_API_KEY`, `PORT`.

## 6. Risiko dan Keterbatasan Shared Hosting
- **Persistence**: Risiko proses Node.js dihentikan secara otomatis pada shared hosting.
- **Resource Limits**: Pembatasan RAM/CPU mungkin memengaruhi performa AI generation jika dijalankan di server yang sama.
- **Environment Variables**: Akses pengaturan variabel lingkungan mungkin terbatas di shared hosting (memerlukan penggunaan `.env` file yang aman atau panel).

## 7. Kebutuhan Keamanan
- **CSRF & CORS**: Sudah terimplementasi di backend.
- **RBAC**: Multi-tenant isolation dipastikan tidak berubah.
- **Backup**: Strategi backup database via panel kontrol hosting harus diotomatisasi.

## 8. Strategi Backup dan Restore
- **Backup**: Menggunakan fitur *Export* database dari panel kontrol.
- **Restore**: Menggunakan fitur *Import* database dari panel kontrol.
- **Baseline**: Struktur database MySQL saat ini sudah cukup stabil untuk pilot.

## 9. Rekomendasi Deployment Pilot
- **Rekomendasi**: Gunakan paket **Rumahweb VPS** atau **Node.js Hosting** yang mendukung PM2/process manager untuk menjaga server tetap berjalan.
- **Deployment**: Jalankan build di lokal, upload `dist/` dan `server.js`, kemudian jalankan menggunakan proses manager di server.

## 10. Hal yang Belum Dapat Diverifikasi
- [NOT TESTED] Ketersediaan PM2 atau proses manager pada paket Rumahweb yang dibeli.
- [NOT TESTED] Latensi koneksi ke AI API dari server Rumahweb.
- [NOT TESTED] Konfigurasi spesifik panel kontrol (cPanel/DirectAdmin) Rumahweb.

## Status Temuan
- MySQL Compatibility: VERIFIED
- Hosting (Node.js): NEEDS VERIFICATION
- Deployment Strategy: RISK (if using shared hosting)
- Multi-tenant Baseline: VERIFIED
