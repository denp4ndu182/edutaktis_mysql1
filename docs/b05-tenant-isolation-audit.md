# B-05 — Tenant Isolation Audit

## 1. Informasi Audit

| Item | Keterangan |
|---|---|
| Nama pengujian | B-05 Tenant Isolation HTTP Test |
| Status | PASSED |
| Hasil assertion | 37/37 |
| Database pengujian | edutaktis_onboarding_test |
| Host database | 127.0.0.1:3307 |
| Port internal MySQL | 3306 |
| HTTP test server | 127.0.0.1:43105 |
| Perubahan skema database | Tidak ada |
| Fixture cleanup | Berhasil |
| Server shutdown | Berhasil |
| Prisma disconnect | Berhasil |

Audit ini mendokumentasikan hasil pengujian B-05 berdasarkan output aktual yang diperoleh dari terminal Codespaces.

## 2. Tujuan Pengujian

Memverifikasi bahwa mekanisme otorisasi tenant membatasi akses pengguna berdasarkan identitas, membership, status membership, peran, kepemilikan project, dan institusi yang menjadi konteks permintaan.

Pengujian juga mencakup akses terhadap koleksi Modul Ajar dan LKPD serta perlindungan terhadap mutasi HTTP yang tidak memenuhi pemeriksaan keamanan.

## 3. Temuan dan Akar Masalah

### 3.1 Masalah awal

Pengujian awal menemukan bahwa membership berstatus PENDING tidak ditolak dengan kode yang diharapkan oleh pengujian.

Akar masalah berada pada alur pengambilan konteks tenant:

- Repository sebelumnya hanya mengembalikan membership ACTIVE.
- Membership PENDING dan INACTIVE tidak tersedia dalam `userInstitutions`.
- Middleware tidak dapat membedakan membership yang tidak ditemukan dengan membership yang ditemukan tetapi tidak aktif.
- Akibatnya, membership non-ACTIVE dapat dikategorikan sebagai tenant yang tidak dikenal.

### 3.2 Perbaikan

Repository `listByUser()` diubah agar mengembalikan seluruh status membership, termasuk ACTIVE, PENDING, dan INACTIVE.

`getUserTenantContext()` diubah dengan prinsip:

1. Seluruh membership pengguna dikembalikan dalam `userInstitutions`.
2. Hanya membership ACTIVE yang dapat menjadi `currentMembership`.
3. `currentInstitution` hanya berasal dari membership ACTIVE.
4. Jika `activeInstitutionId` diberikan secara eksplisit, pencarian harus cocok dengan institusi tersebut.
5. Tidak ada fallback ke institusi lain ketika institusi yang diminta tidak ditemukan.
6. Perilaku yang sama diterapkan pada jalur database dan in-memory.

Middleware `requireInstitutionMembership()` kemudian memberikan pesan penolakan yang berbeda untuk membership PENDING dan INACTIVE.

Keduanya tetap menggunakan kode respons `MEMBERSHIP_PENDING`, sesuai kontrak assertion pengujian B-05.

## 4. File Utama Terkait Perbaikan

| File | Perubahan |
|---|---|
| `src/repositories/membershipRepository.ts` | Mengembalikan seluruh status membership pada `listByUser()` dan mendukung transaksi pada `findByUserAndInstitution()` |
| `src/security/authService.ts` | Memisahkan seluruh membership dari membership aktif dalam konteks tenant |
| `src/middleware/authMiddleware.ts` | Membedakan pesan penolakan membership PENDING dan INACTIVE |
| `scripts/test-b05-tenant-isolation-http.ts` | Runner pengujian HTTP B-05 |
| `scripts/fixture-b05-tenant.ts` | Fixture data pengujian B-05 |
| `scripts/onboarding-test-prisma.ts` | Verifikasi koneksi database pengujian |

Catatan: `authMiddleware.ts` juga memiliki perubahan pengamanan `requireSuperAdmin()` yang menghapus fallback otorisasi berdasarkan email. Perubahan tersebut terlihat dalam working tree, tetapi bukan akar masalah B-05 dan tidak diklaim sebagai hasil pengujian khusus B-05.

## 5. Hasil Pengujian HTTP

Seluruh 37 assertion berhasil.

### 5.1 Autentikasi dan membership

| No. | Skenario | Hasil |
|---:|---|---|
| 1 | Akses project tanpa sesi ditolak | PASS |
| 2 | Permintaan tanpa tenant ditolak | PASS |
| 3 | Teacher A tidak dapat memasuki tenant B | PASS |
| 4 | Membership PENDING ditolak | PASS |
| 5 | Membership INACTIVE ditolak | PASS |

### 5.2 Isolasi project dan hak akses

| No. | Skenario | Hasil |
|---:|---|---|
| 6 | Teacher A hanya melihat project miliknya | PASS |
| 7 | Headmaster A hanya melihat project tenant A | PASS |
| 8 | Operator A hanya melihat project tenant A | PASS |
| 9 | School Admin A hanya melihat project tenant A | PASS |
| 10 | Teacher A dapat melihat project miliknya | PASS |
| 11 | Teacher A tidak dapat melihat project pemilik lain | PASS |
| 12 | Project tenant B disamarkan sebagai tidak ditemukan | PASS |
| 13 | Headmaster A dapat melihat project guru dalam tenant A | PASS |
| 14 | Operator A dapat melihat project guru dalam tenant A | PASS |
| 15 | Create project mengabaikan identitas tenant dari klien | PASS |
| 16 | Operator tidak memiliki izin membuat project | PASS |
| 17 | Teacher tidak dapat mengubah project milik pengguna lain | PASS |
| 18 | Perubahan userId project ditolak | PASS |
| 19 | Pemindahan project lintas tenant ditolak | PASS |
| 20 | Tenant B tidak dapat menghapus project tenant A | PASS |
| 21 | Operator tidak dapat menghapus project | PASS |

### 5.3 Isolasi Modul Ajar dan LKPD

| No. | Skenario | Hasil |
|---:|---|---|
| 22 | Teacher A dapat melihat koleksi Modul Ajar miliknya | PASS |
| 23 | Teacher A dapat melihat detail Modul Ajar miliknya | PASS |
| 24 | Teacher A tidak dapat melihat Modul Ajar pemilik lain | PASS |
| 25 | Teacher A tidak dapat melihat Modul Ajar tenant B | PASS |
| 26 | Headmaster A dapat melihat Modul Ajar project guru | PASS |
| 27 | Teacher A tidak dapat mengubah Modul Ajar project lain | PASS |
| 28 | Teacher A dapat melihat koleksi LKPD miliknya | PASS |
| 29 | Teacher A dapat melihat detail LKPD miliknya | PASS |
| 30 | Teacher A tidak dapat melihat LKPD pemilik lain | PASS |
| 31 | Teacher A tidak dapat melihat LKPD tenant B | PASS |
| 32 | Headmaster A dapat melihat LKPD project guru | PASS |
| 33 | Teacher A tidak dapat mengubah LKPD project lain | PASS |

### 5.4 Proteksi HTTP dan akses lintas peran

| No. | Skenario | Hasil |
|---:|---|---|
| 34 | Mutasi project tanpa CSRF ditolak | PASS |
| 35 | Mutasi project dari origin yang tidak sah ditolak | PASS |
| 36 | School Admin B hanya melihat project tenant B | PASS |
| 37 | SUPER_ADMIN membership B melihat project tenant B | PASS |

## 6. Verifikasi Database dan Cleanup

Output pengujian mengonfirmasi:

- Database aktual: `edutaktis_onboarding_test`.
- Port internal MySQL: `3306`.
- Koneksi menggunakan port host `3307`.
- Fixture B-05 berhasil dibuat.
- Project sementara berhasil dihapus dan diverifikasi.
- HTTP test server berhenti.
- Fixture utama berhasil dibersihkan.
- Prisma berhasil disconnect.
- Tidak ada perubahan skema database.

Hasil akhir runner:

`B-05 HTTP TEST PASSED: 37 assertions.`

`Fixture sudah dibersihkan.`

`Tidak ada perubahan skema database.`

## 7. Pemeriksaan Statis

Pemeriksaan setelah perubahan kode:

| Pemeriksaan | Hasil |
|---|---|
| `git diff --check` | LULUS |
| `npx tsc --noEmit` | LULUS |

Kedua perintah selesai tanpa pesan error.

## 8. Batas Cakupan dan Risiko Residual

Kelulusan B-05 hanya membuktikan skenario yang tercantum dalam 37 assertion.

Pengujian ini tidak dengan sendirinya membuktikan bahwa:

1. Seluruh endpoint aplikasi sudah menerapkan tenant isolation.
2. Semua repository dan service telah bebas dari akses lintas tenant.
3. Seluruh skenario concurrency dan race condition sudah diuji.
4. Seluruh kontrol SUPER_ADMIN sudah diuji untuk setiap kemungkinan penyalahgunaan.
5. Seluruh alur onboarding, persetujuan membership, dan perubahan role sudah lulus audit menyeluruh.

Audit endpoint dan service lain tetap diperlukan.

## 9. Kesimpulan

B-05 Tenant Isolation HTTP Test dinyatakan LULUS dengan 37 dari 37 assertion berhasil.

Perbaikan konteks membership berhasil membedakan visibilitas membership dari hak akses tenant operasional. Membership non-ACTIVE dapat dikenali oleh middleware, tetapi tidak dapat menjadi konteks tenant aktif.

Pengujian project, Modul Ajar, LKPD, proteksi CSRF, validasi origin, dan pembatasan akses lintas tenant berhasil sesuai skenario yang diuji.

Tidak ada perubahan skema database dalam pelaksanaan pengujian B-05.

## 10. Status Audit

**B-05: PASSED — 37/37 assertions.**

Dokumen ini mencatat hasil pengujian dan pemeriksaan yang telah dilakukan. Dokumen ini bukan pernyataan bahwa seluruh keamanan aplikasi telah selesai diaudit.

Status Git: belum dilakukan staging atau commit sebagai bagian dari audit ini.
