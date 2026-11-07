# EduTaktis SaaS — MariaDB Database Architecture & Schema Reference

## Overview
Dokumentasi ini menjelaskan arsitektur skema MariaDB / MySQL (InnoDB Storage Engine) untuk EduTaktis SaaS pada Rumahweb Shared Hosting Medium (`app.edutaktis.com`).

## Technical Specifications
- **Database Engine:** MariaDB 10.5+ / MySQL 8.0+
- **Storage Engine:** InnoDB (Strict ACID Compliance & Foreign Key Enforcement)
- **JSON Column Format:** Storage format MariaDB untuk JSON adalah `LONGTEXT` dengan constraint `CHECK (JSON_VALID(column))`. Prisma Client menangani parsing/serialisasi JSON secara otomatis.
- **Default Charset:** `utf8mb4`
- **Default Collation:** `utf8mb4_unicode_ci`
- **ORM:** Prisma 6.19.3 (`provider = "mysql"`)
- **Connection Pool Limit:** `connection_limit=5&pool_timeout=10`

---

## Testing Environment Hierarchy
Sistem verifikasi EduTaktis SaaS membagi pengujian menjadi 4 tingkatan terpisah:
1. **Validasi Statis:** Menjalankan `npx prisma validate`, `npx prisma generate`, dan `npx tsc --noEmit` untuk memastikan tipe data, syntax, dan DDL migration valid secara kompilasi.
2. **Pengujian Lokal / Dev Store:** Menjalankan `npx tsx scripts/test-phase3b.ts` dan `test-phase3c.ts` di lingkungan lokal/development.
3. **Pengujian MariaDB Live:** Menjalankan `npx tsx scripts/test-phase3d.ts` dengan `DATABASE_URL` terhubung ke MariaDB live (menguji query MariaDB, versi, InnoDB engine, JSON, dan Composite Foreign Key negatif/positif).
4. **Pengujian Runtime cPanel:** Menguji eksekusi bundel `dist/server.js` melalui Phusion Passenger cPanel Rumahweb.

---

## Data Models & Type Mappings

### 1. User (`users`)
- `id`: `VARCHAR(36)` Primary Key (UUID v4 generated via `@default(uuid())`)
- `email`: `VARCHAR(255)` UNIQUE
- `password_hash`: `VARCHAR(255)` (Argon2id Hash: `m=65536, t=3, p=1`)
- `nama_lengkap`: `VARCHAR(255)`
- `gelar_depan`, `gelar_belakang`: `VARCHAR(50)`
- `nip`, `nuptk`, `nomor_telepon`: `VARCHAR(30)`
- `foto_profil_url`: `TEXT`
- `preferensi_mata_pelajaran`: `VARCHAR(150)`
- `is_active`, `email_verified`: `BOOLEAN`
- `created_at`, `updated_at`: `DATETIME(3)`

### 2. Institution (`institutions`)
- `id`: `VARCHAR(36)` Primary Key
- `npsn`: `VARCHAR(20)` UNIQUE
- `nama_resmi`, `kementerian_dinas`: `VARCHAR(255)`
- `nama_singkat`, `kabupaten_kota`, `provinsi`, `kota_tanda_tangan`: `VARCHAR(100)`
- `jenjang`, `jenis_institusi`, `kode_pos`: `VARCHAR(20)`
- `alamat_lengkap`, `logo_url`: `TEXT`
- `created_at`, `updated_at`: `DATETIME(3)`

### 3. InstitutionMembership (`institution_memberships`)
- `id`: `VARCHAR(36)` Primary Key
- `user_id`: `VARCHAR(36)` Foreign Key $\rightarrow$ `users(id)` ON DELETE RESTRICT
- `institution_id`: `VARCHAR(36)` Foreign Key $\rightarrow$ `institutions(id)` ON DELETE RESTRICT
- `role`: `ENUM('SUPER_ADMIN', 'SCHOOL_ADMIN', 'HEADMASTER', 'TEACHER', 'OPERATOR')`
- `status`: `ENUM('ACTIVE', 'PENDING', 'INACTIVE')`
- **Unique Composite Key:** `UNIQUE(user_id, institution_id)`

### 4. Project (`projects`) — Multi-Tenant Core
- `id`: `VARCHAR(36)` Primary Key
- `institution_id`: `VARCHAR(36)` Foreign Key $\rightarrow$ `institutions(id)` ON DELETE RESTRICT
- `user_id`: `VARCHAR(36)` Foreign Key $\rightarrow$ `users(id)` ON DELETE RESTRICT
- `name`: `VARCHAR(255)`
- `master_input`: `JSON` (Dipetakan sebagai LONGTEXT + JSON_VALID)
- `documents`: `JSON` (Dipetakan sebagai LONGTEXT + JSON_VALID)
- `created_at`, `updated_at`: `DATETIME(3)`
- **Composite Foreign Key (Tenant Isolation Guarantee):**
  `FOREIGN KEY (user_id, institution_id) REFERENCES institution_memberships(user_id, institution_id) ON DELETE RESTRICT ON UPDATE CASCADE`

### 5. AuditLog (`audit_logs`)
- `id`: `VARCHAR(36)` Primary Key
- `user_id`: `VARCHAR(36)` Foreign Key $\rightarrow$ `users(id)` ON DELETE SET NULL
- `institution_id`: `VARCHAR(36)` Foreign Key $\rightarrow$ `institutions(id)` ON DELETE SET NULL
- `action`, `resource`: `VARCHAR(100)`
- `details`: `JSON`
- `ip_address`: `VARCHAR(50)`
- `created_at`: `DATETIME(3)`

---

## Active & Archived Migrations
- **Active Migration Directory:** `/prisma/migrations/0_mariadb_init/migration.sql` (MariaDB baseline migration).
- **Active Lock File:** `/prisma/migrations/migration_lock.toml` (`provider = "mysql"`).
- **Archived Migration Directory:** `/prisma/archive/postgres_migrations/` (Arsip migrasi PostgreSQL lama).
