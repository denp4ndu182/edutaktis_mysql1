#!/usr/bin/env python3
"""
EduTaktis ONBOARDING-4 schema patch.
- Preflight only; no database connection and no Prisma migration.
- Creates a timestamped backup before writing.
- Applies all schema edits atomically after every preflight check passes.
"""
from datetime import datetime
from pathlib import Path
import os
import re
import sys
import tempfile

SCHEMA = Path("prisma/schema.prisma")

def fail(message: str) -> None:
    print(f"[ABORT] {message}", file=sys.stderr)
    raise SystemExit(1)

if not SCHEMA.is_file():
    fail(f"File tidak ditemukan: {SCHEMA}. Jalankan dari root repository.")

original = SCHEMA.read_text(encoding="utf-8")

# Idempotency / collision checks.
for token in (
    "enum InstitutionRequestStatus",
    "model InstitutionRequest",
    "institutionRequestsSubmitted",
    "institutionRequestsReviewed",
    "institutionRequest InstitutionRequest?",
):
    if token in original:
        fail(f"Token sudah ada ({token!r}). Tidak ada file yang diubah; audit manual diperlukan.")

# Require the exact enum structure observed in the audited schema.
membership_enum = re.compile(
    r"(?m)^enum MembershipStatus \{\r?\n"
    r"[ \t]+ACTIVE\r?\n"
    r"[ \t]+PENDING\r?\n"
    r"[ \t]+INACTIVE\r?\n"
    r"\}\s*"
)
matches = list(membership_enum.finditer(original))
if len(matches) != 1:
    fail("Blok enum MembershipStatus tidak cocok dengan hasil audit atau jumlahnya bukan satu.")

# Require exact relation insertion anchors and ensure each appears exactly once.
user_anchor = "  passwordResetTokens     PasswordResetToken[]\n"
institution_anchor = "  auditLogs        AuditLog[]\n"
if original.count(user_anchor) != 1:
    fail("Anchor relasi User tidak cocok. Tidak ada file yang diubah.")
if original.count(institution_anchor) != 1:
    fail("Anchor relasi Institution tidak cocok. Tidak ada file yang diubah.")

# Ensure expected model insertion point is unique.
project_anchor = "model Project {\n"
if original.count(project_anchor) != 1:
    fail("Anchor model Project tidak ditemukan secara unik. Tidak ada file yang diubah.")

new_enum = """enum InstitutionRequestStatus {
  PENDING_REVIEW
  APPROVED
  REJECTED
  CANCELLED
}

"""

new_user_relations = (
    user_anchor
    + '  institutionRequestsSubmitted InstitutionRequest[] @relation("InstitutionRequestRequester")\n'
    + '  institutionRequestsReviewed  InstitutionRequest[] @relation("InstitutionRequestReviewer")\n'
)

new_institution_relations = (
    institution_anchor
    + "  institutionRequest InstitutionRequest?\n"
)

new_model = """model InstitutionRequest {
  id              String                    @id @default(uuid()) @db.VarChar(36)
  requesterUserId String                    @map("requester_user_id") @db.VarChar(36)

  npsn             String                   @db.VarChar(20)
  namaResmi        String                   @map("nama_resmi") @db.VarChar(255)
  namaSingkat      String                   @map("nama_singkat") @db.VarChar(100)
  jenjang          String                   @db.VarChar(20)
  jenisInstitusi   String                   @map("jenis_institusi") @db.VarChar(20)
  kementerianDinas String                   @map("kementerian_dinas") @db.VarChar(255)
  alamatLengkap    String                   @map("alamat_lengkap") @db.Text
  kelurahanDesa    String?                  @map("kelurahan_desa") @db.VarChar(100)
  kecamatan        String?                  @db.VarChar(100)
  kabupatenKota    String                   @map("kabupaten_kota") @db.VarChar(100)
  provinsi         String                   @db.VarChar(100)
  kodePos          String?                  @map("kode_pos") @db.VarChar(20)
  telepon          String?                  @db.VarChar(50)
  email            String?                  @db.VarChar(255)
  website          String?                  @db.VarChar(255)

  status           InstitutionRequestStatus @default(PENDING_REVIEW)
  institutionId    String?                  @unique @map("institution_id") @db.VarChar(36)
  reviewedBy       String?                  @map("reviewed_by") @db.VarChar(36)
  reviewedAt       DateTime?                @map("reviewed_at")
  rejectionReason  String?                  @map("rejection_reason") @db.Text

  createdAt        DateTime                 @default(now()) @map("created_at")
  updatedAt        DateTime                 @updatedAt @map("updated_at")

  requester        User                     @relation("InstitutionRequestRequester", fields: [requesterUserId], references: [id], onDelete: Restrict)
  reviewer         User?                    @relation("InstitutionRequestReviewer", fields: [reviewedBy], references: [id], onDelete: SetNull)
  institution      Institution?             @relation(fields: [institutionId], references: [id], onDelete: Restrict)

  @@index([requesterUserId, status])
  @@index([npsn, status])
  @@index([status, createdAt])
  @@map("institution_requests")
}

"""

# Build candidate entirely in memory, then validate before any write.
candidate = original[:matches[0].end()] + "\n" + new_enum + original[matches[0].end():]
candidate = candidate.replace(user_anchor, new_user_relations, 1)
candidate = candidate.replace(institution_anchor, new_institution_relations, 1)
candidate = candidate.replace(project_anchor, new_model + project_anchor, 1)

# Basic structural checks.
for token in (
    "enum InstitutionRequestStatus",
    "model InstitutionRequest",
    'institutionRequestsSubmitted InstitutionRequest[] @relation("InstitutionRequestRequester")',
    'institutionRequestsReviewed  InstitutionRequest[] @relation("InstitutionRequestReviewer")',
    "institutionRequest InstitutionRequest?",
    '@@map("institution_requests")',
):
    if candidate.count(token) != 1:
        fail(f"Validasi kandidat gagal: token {token!r} harus muncul tepat satu kali.")

if candidate.count("model InstitutionRequest {") != 1:
    fail("Validasi kandidat gagal: jumlah model InstitutionRequest tidak tepat.")

# Backup original bytes only after all preflight and candidate checks pass.
timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
backup = SCHEMA.with_name(f"{SCHEMA.name}.backup-onboarding-4-{timestamp}")
if backup.exists():
    fail(f"File backup sudah ada: {backup}. Tidak ada file yang diubah.")

try:
    backup.write_bytes(SCHEMA.read_bytes())
    # Atomic replacement in the same directory.
    fd, temp_name = tempfile.mkstemp(
        prefix="schema.prisma.onboarding4.",
        suffix=".tmp",
        dir=str(SCHEMA.parent),
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="") as handle:
            handle.write(candidate)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, SCHEMA)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise
except Exception as exc:
    # Restore original if backup exists and replacement partially failed.
    if backup.exists():
        SCHEMA.write_bytes(backup.read_bytes())
    fail(f"Penulisan patch gagal; file asli dipulihkan bila diperlukan. Detail: {exc}")

print("[OK] Patch ONBOARDING-4 diterapkan pada prisma/schema.prisma.")
print(f"[BACKUP] {backup}")
print("[INFO] Tidak ada migrasi, generate Prisma, atau perubahan database yang dijalankan.")
print("[NEXT] Jalankan pemeriksaan diff dan validasi schema secara terpisah sebelum menyetujui migrasi.")
