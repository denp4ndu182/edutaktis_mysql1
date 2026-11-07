# EduTaktis SaaS — Rumahweb Shared Hosting Deployment Guide

## Architecture Topology
- **WordPress Site:** `edutaktis.com` (Main Marketing Website, untouched in `public_html`).
- **SaaS Application:** `app.edutaktis.com` (Express + React SPA Single-Origin Deployment).
- **Application Directory:** `/home/username/app.edutaktis.com/`
- **Node.js Selector:** Phusion Passenger (CloudLinux / cPanel).

## Build & Production Runtime Configuration
 Production **TIDAK BUKAN** mengeksekusi `tsx server.ts` (mencegah Out-Of-Memory/OOM pada shared hosting).
 Proyek dikompilasi menggunakan bundler `esbuild` dengan `--target=es2022` menjadi JavaScript murni `dist/server.js`.

### Build Commands:
```bash
# Build React Frontend & Express Backend
npm run build

# Artifacts Produced:
# - dist/index.html & dist/assets/* (React SPA)
# - dist/server.js (Express Backend JS Bundle)
```

### cPanel Node.js Application Setup:
1. **Node.js Version:** Pilih versi LTS aktif di cPanel (Node.js 20 LTS atau 22 LTS). Target build dikompilasi untuk `es2022`.
2. **Application Mode:** `Production`
3. **Application Root:** `app.edutaktis.com`
4. **Application URL:** `app.edutaktis.com`
5. **Application Startup File:** `dist/server.js`
6. **Environment Variables:**
   - `NODE_ENV="production"`
   - `PORT="3000"` (atau disesuaikan oleh Phusion Passenger)
   - `DATABASE_URL="mysql://username_dbuser:SECURE_PASSWORD@127.0.0.1:3306/username_edutaktis?connection_limit=5&pool_timeout=10"`
   - `SESSION_SECRET="[RANDOM_64_CHAR_HEX_STRING]"`
   - `GEMINI_API_KEY="[YOUR_API_KEY]"`

## Verification Commands
```bash
# 1. Validasi Statis
DATABASE_URL="mysql://..." npx prisma validate
npx tsc --noEmit

# 2. Pengujian Staging Test Suites
npx tsx scripts/test-phase3b.ts
npx tsx scripts/test-phase3c.ts

# 3. Pengujian MariaDB Live (Memerlukan DATABASE_URL MariaDB Live)
npx tsx scripts/test-phase3d.ts
```
