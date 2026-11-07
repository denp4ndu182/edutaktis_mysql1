# Pre-Production Infrastructure Audit: EduTaktis SaaS

## 1. Ringkasan Arsitektur
Aplikasi EduTaktis adalah aplikasi web SaaS multi-tenant yang dibangun menggunakan arsitektur modern:
- **Frontend**: React 19 dengan Vite, menggunakan Tailwind CSS untuk styling.
- **Backend**: Express.js (Node.js) sebagai server API dengan integrasi Prisma ORM.
- **Database**: PostgreSQL (direncanakan), meskipun schema saat ini di `schema.prisma` tertulis `mysql`.
- **Deployment**: Standalone node.js build.

## 2. Diagram Alur
- **Frontend** (Vite/React) <-> **API Gateway** (Express.js/Vite Middleware) <-> **Database** (PostgreSQL/MariaDB)

## 3. Daftar Runtime dan Dependency
- **Runtime**: Node.js (v22 recommended).
- **Core Dependencies**: `express`, `@prisma/client`, `@google/genai`, `react`, `react-dom`.
- **Build Tools**: `vite`, `esbuild`, `tsx`.

## 4. Daftar Environment Variables (Placeholder)
- `DATABASE_URL`: Connection string.
- `SESSION_SECRET`: Session management secret.
- `CSRF_SECRET`: CSRF protection.
- `GEMINI_API_KEY`: For AI features.
- `PORT`: App port.

## 5. Kebutuhan Infrastruktur Production
- **Hosting**: Node.js support, PM2 process management, HTTPS support.
- **Database**: PostgreSQL Instance (Needs migration from MariaDB if migrating).
- **Storage**: Persistent storage for backups/uploads.

## 6. Kesesuaian dan Potensi Keterbatasan
- **Hosting (Hostinger)**: Hostinger VPS mendukung Node.js dan PostgreSQL. Shared hosting kemungkinan tidak mencukupi untuk kebutuhan node.js runtime yang persisten.
- **Database Migration**: Schema prisma saat ini menggunakan `mysql`. **Perlu migrasi ke `postgresql`** sebelum migrasi data.

## 7. Risiko Migrasi
- **Database Mismatch**: Perbedaan sintaks dan tipe data antara MariaDB dan PostgreSQL.
- **State Persistence**: Migrasi data tenant yang sensitif.
- **Environment Parity**: Pastikan env vars di production tidak terekspos.

## 8. Rekomendasi Deployment Architecture
- VPS (Hostinger VPS) dengan Docker atau PM2.
- Nginx sebagai Reverse Proxy untuk SSL/HTTPS.
- Database terpisah (Managed PostgreSQL).

## 9. Daftar Pekerjaan Sebelum Migrasi
- [NEEDS VERIFICATION] Migrasi schema Prisma dari `mysql` ke `postgresql`.
- [NEEDS VERIFICATION] Setup VPS environment (Node.js, PostgreSQL).
- [NEEDS VERIFICATION] Konfigurasi Nginx SSL.

## 10. Daftar Hal yang Belum Dapat Diverifikasi
- Aksesibilitas VPS Hostinger.
- Konfigurasi DNS production.
- Kecepatan latensi AI API dari lokasi hosting.

## Status Temuan
- Arsitektur: VERIFIED
- Database Compatibility: NEEDS VERIFICATION (Prisma schema fix required)
- Security: VERIFIED
- Hosting: NEEDS VERIFICATION
