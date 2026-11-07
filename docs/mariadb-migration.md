# EduTaktis SaaS — MariaDB Migration Guide & Verification Protocol

## Overview
Panduan ini menjelaskan prosedur eksekusi dan verifikasi migrasi database MariaDB dari lingkungan PostgreSQL sebelumnya ke MariaDB 10.5+ di cPanel Rumahweb Shared Hosting Medium.

## Key Architecture Mappings
1. **Provider Update:** `provider = "mysql"` di `prisma/schema.prisma`.
2. **UUID Mapping:** Tipe `UUID` native PostgreSQL digantikan oleh `VARCHAR(36)` dengan generator `@default(uuid())` di tingkat Prisma Client.
3. **Timestamp Precision:** Tipe `@db.Timestamptz(6)` digantikan oleh `DATETIME(3)` native MariaDB.
4. **JSON Handling:** Tipe `JSON` MariaDB menggunakan format `LONGTEXT` dengan `JSON_VALID` constraint.
5. **InnoDB Composite Foreign Keys:** Composite Foreign Key `projects(user_id, institution_id)` $\rightarrow$ `institution_memberships(user_id, institution_id)` ditegakkan secara native di InnoDB engine.

## Migration Files Structure
- **Active Baseline Migration:** `prisma/migrations/0_mariadb_init/migration.sql`
- **Active Migration Lock:** `prisma/migrations/migration_lock.toml` (`provider = "mysql"`)
- **Archived PostgreSQL Migrations:**
  - `prisma/archive/postgres_migrations/0_init_migration.sql`

## Testing Environment Hierarchy
1. **Validasi Statis:**
   - `DATABASE_URL="mysql://..." npx prisma validate`
   - `npx tsc --noEmit`
2. **Pengujian Lokal / Staging Test Suite:**
   - `npx tsx scripts/test-phase3b.ts`
   - `npx tsx scripts/test-phase3c.ts`
3. **Pengujian MariaDB Live (Jika DATABASE_URL Server Live Tersedia):**
   - `npx tsx scripts/test-phase3d.ts` (Menguji pendaftaran, transaksi, presisi waktu, JSON Unicode, dan pengujian Composite Foreign Key Positif & Negatif)
4. **Pengujian Runtime cPanel:**
   - Menjalankan `node dist/server.js` pada lingkungan Phusion Passenger Rumahweb.

## Production Migration Steps (cPanel phpMyAdmin / MySQL CLI)
1. Buat basis data MySQL di cPanel (*MySQL Databases*):
   - Database name: `username_edutaktis`
   - User: `username_edutaktisuser`
   - Password: `[GENERATE_STRONG_SECURE_PASSWORD]`
   - Privileges: `ALL PRIVILEGES`
2. Impor file DDL baseline: `prisma/migrations/0_mariadb_init/migration.sql` melalui phpMyAdmin atau MySQL CLI.
3. Masukkan `DATABASE_URL` di cPanel Node.js Application Environment Variables:
   `DATABASE_URL="mysql://username_edutaktisuser:SECURE_PASSWORD@127.0.0.1:3306/username_edutaktis?connection_limit=5&pool_timeout=10"`
