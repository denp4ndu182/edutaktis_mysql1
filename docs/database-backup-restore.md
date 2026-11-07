# EduTaktis SaaS — PostgreSQL External Backup & Disaster Recovery Guide

## 1. Prinsip Utama Strategi Backup
- **Penyimpanan Terpisah:** File backup dilarang keras hanya disimpan di VPS yang sama dengan database utama. Jika VPS mengalami kegagalan disk atau *catastrophic failure*, data tidak boleh hilang.
- **Format Aman & Fleksibel:** Menggunakan `pg_dump -Fc` (custom archive format) yang terkompresi dan mendukung seleksi skema/data saat pemulihan.
- **Enkripsi Sebelum Transit:** Seluruh dump dienkripsi secara lokal menggunakan algoritma AES-256-CBC dengan PBKDF2 (`openssl enc -aes-256-cbc`) sebelum dipindahkan ke penyimpanan *off-site*.
- **Pemisahan Kredensial:** Kredensial backup (`PGUSER=edutaktis_backup_user`) menggunakan role database yang dibatasi hak aksesnya (hanya `SELECT` dan `LOCK TABLES`, bukan `SUPERUSER`). Kunci enkripsi (`BACKUP_ENCRYPTION_KEY`) disimpan di luar repository Git.

---

## 2. Prosedur Backup Rutin (Automated Cron)

### Environment Variables yang Diperlukan:
```bash
PGHOST=127.0.0.1
PGPORT=5432
PGDATABASE=edutaktis_db
PGUSER=edutaktis_backup_user
PGPASSWORD=STRONG_BACKUP_PASSWORD
BACKUP_TEMP_DIR=/var/backups/edutaktis
BACKUP_ENCRYPTION_KEY=MINIMAL_32_CHAR_RANDOM_PASSPHRASE
BACKUP_HMAC_KEY=SEPARATE_32_CHAR_RANDOM_HMAC_KEY
EXTERNAL_S3_BUCKET=edutaktis-offsite-cold-storage
```

### Keamanan Kriptografi (Encrypt-then-MAC):
1. **Enkripsi Data:** AES-256-CBC dengan salting dan PBKDF2 (100.000 iterasi) untuk privasi data.
2. **Otentikasi Integritas (HMAC-SHA256):** Tanda tangan digital HMAC dihasilkan menggunakan kunci terpisah (`BACKUP_HMAC_KEY`) dan diverifikasi **sebelum** proses dekripsi berjalan untuk mencegah manipulasi bit (*bit-flipping*) dan serangan padding oracle.
3. **Penyimpanan Eksternal:** Jangan menganggap `EXTERNAL_S3_BUCKET` aktif secara mandiri tanpa kredensial AWS CLI / S3 API yang terkonfigurasi.

### Penjadwalan Cron di Hostinger VPS:
Jalankan backup harian setiap pukul 02:00 dini hari (WIB):
```bash
0 2 * * * /path/to/app/scripts/backup-db.sh >> /var/log/edutaktis-backup.log 2>&1
```

---

## 3. Prosedur Uji Pemulihan (Disaster Recovery & Restore Rehearsal)

**PENTING:** Jangan pernah menyatakan backup berhasil hanya karena file `.dump.enc` terbuat. Uji pemulihan wajib dijalankan pada database terpisah (`edutaktis_dr_test`) secara berkala.

### Langkah-langkah Pemulihan:
1. **Siapkan Database Target Pengujian:**
   ```bash
   psql -U postgres -c "DROP DATABASE IF EXISTS edutaktis_dr_test;"
   psql -U postgres -c "CREATE DATABASE edutaktis_dr_test;"
   ```
2. **Jalankan Skrip Restore:**
   ```bash
   BACKUP_ENCRYPTION_KEY="PASSPHRASE_ANDA" BACKUP_HMAC_KEY="HMAC_KEY_ANDA" ./scripts/restore-db.sh \
     /var/backups/edutaktis/edutaktis_20261106_020000.dump.enc \
     edutaktis_dr_test
   ```
3. **Validasi Integritas Data:**
   - Periksa keberadaan tabel utama: `users`, `institutions`, `institution_memberships`, `projects`, `audit_logs`.
   - Jalankan query validasi:
     ```sql
     SELECT count(*) FROM users;
     SELECT count(*) FROM institutions;
     SELECT count(*) FROM projects;
     ```
