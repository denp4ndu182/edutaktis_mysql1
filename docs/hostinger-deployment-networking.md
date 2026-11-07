# EduTaktis SaaS — Hostinger Deployment, Networking & Security Guide

## 1. Arsitektur Target Hostinger
- **Aplikasi Backend & Frontend:** Hostinger Managed Node.js (Node.js runtime v20.x atau v22.x LTS).
- **Database Engine:** PostgreSQL 16+ pada Hostinger VPS terpisah.
- **Subdomain Produksi:** `app.edutaktis.com` mengarah ke aplikasi SaaS; website publik `edutaktis.com` tetap berada di landing page/WordPress yang sudah ada tanpa gangguan.

---

## 2. Analisis Konektivitas Jaringan & Firewall (Network Security)

### A. Jangan Pernah Membuka Port 5432 ke Internet Publik (`0.0.0.0/0`)
Membuka port PostgreSQL ke publik menghadapkan database pada serangan brute-force, eksploitasi zero-day, dan pencurian data (*data exfiltration*).

### B. Opsi Topologi Jaringan Hostinger:
1. **Opsi 1 (Prioritas Tertinggi — Private Networking / VPC):**
   - Jika paket Hostinger Managed Node.js dan VPS berada dalam *Data Center Region* yang sama dan mendukung internal private IP (misal `10.x.x.x` atau `192.168.x.x`), hubungkan `DATABASE_URL` melalui IP privat.
   - Keuntungan: Kecepatan tinggi (low latency), tidak ada paparan ke internet publik, dan tidak terpengaruh perubahan IP eksternal.
2. **Opsi 2 (Allowlist IP Outbound Spesifik dengan TLS):**
   - Jika Managed Node.js berada di cluster terpisah tanpa VPC internal:
     - Dapatkan rentang IP keluar (*egress IP / outbound IP*) dari Hostinger Managed Node.js.
     - Pasang aturan firewall ketat (`ufw` / Hostinger VPS Firewall) di VPS:
       ```bash
       sudo ufw allow from <IP_OUTBOUND_MANAGED_NODEJS> to any port 5432 proto tcp
       ```
     - **Wajib Enforce TLS:** Konfigurasi `postgresql.conf` dengan `ssl = on` dan sertifikat SSL valid. Koneksi dari aplikasi wajib menggunakan `sslmode=require` atau `sslmode=verify-full`.
3. **Opsi 3 (SSH Tunnel / Reverse Proxy / PgBouncer):**
   - Jika IP outbound Managed Node.js bersifat dinamis (*shared pool* yang berubah-ubah), **JANGAN membuka port ke 0.0.0.0/0**. Sebagai gantinya, gunakan PgBouncer connection pooler dengan otentikasi SCRAM-SHA-256 dan sertifikat TLS mutual, atau jalankan backend Express di VPS yang sama jika paket hosting tidak mendukung rute aman.

---

## 3. Konfigurasi Batas Koneksi (Connection Limit & Pooling)
- PostgreSQL di VPS memiliki batas koneksi default (`max_connections = 100`).
- Pada lingkungan serverless / Managed Node.js yang dapat melakukan *auto-scale*, koneksi langsung dapat dengan cepat menghabiskan kuota.
- **Rekomendasi URL Prisma:**
  ```text
  DATABASE_URL="postgresql://edutaktis_user:PASSWORD@HOST:5432/edutaktis_db?schema=public&sslmode=require&connection_limit=10&pool_timeout=20"
  ```
- Menetapkan `connection_limit=10` mencegah backend Express membanjiri pool database.

---

## 4. Dukungan Prisma di Hostinger Managed Node.js
- **Node.js Engine:** Wajib versi 20.x atau 22.x LTS.
- **Build Step:** Di Hostinger Cloud Console, tambahkan perintah build sebelum start:
  ```bash
  npm install && npx prisma generate && npm run build
  ```
- **Prisma Migrate:** Dilarang keras menjalankan `prisma db push` pada database produksi. Migrasi wajib diterapkan melalui:
  ```bash
  npx prisma migrate deploy
  ```
  yang hanya menerapkan file SQL migration yang telah di-audit dan disetujui.
