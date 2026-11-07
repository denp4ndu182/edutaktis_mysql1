#!/usr/bin/env bash
# ==============================================================================
# EduTaktis SaaS — Hardened PostgreSQL Backup Script
# Encryption Strategy: Encrypt-then-MAC (AES-256-CBC + HMAC-SHA256)
# Integrity Guarantee: Authenticated ciphertext prevents tampering & bit-flipping
# ==============================================================================

set -euo pipefail

# 1. Configuration (Loaded from secure environment, NEVER hardcoded)
BACKUP_DIR="${BACKUP_TEMP_DIR:-/var/backups/edutaktis}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
STAGING_DIR="${BACKUP_DIR}/staging_${TIMESTAMP}"
RAW_DUMP_FILE="${STAGING_DIR}/edutaktis_${TIMESTAMP}.dump"
ENCRYPTED_FILE="${BACKUP_DIR}/edutaktis_${TIMESTAMP}.dump.enc"
HMAC_FILE="${BACKUP_DIR}/edutaktis_${TIMESTAMP}.dump.hmac"

DB_HOST="${PGHOST:-127.0.0.1}"
DB_PORT="${PGPORT:-5432}"
DB_NAME="${PGDATABASE:-edutaktis_db}"
DB_USER="${PGUSER:-edutaktis_backup_user}"

echo "[1/6] Validating backup prerequisites..."
mkdir -p "${BACKUP_DIR}"
chmod 700 "${BACKUP_DIR}"

if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY is not defined. Refusing to create unencrypted backup." >&2
  exit 1
fi

if [[ -z "${BACKUP_HMAC_KEY:-}" ]]; then
  echo "ERROR: BACKUP_HMAC_KEY is not defined. A separate key is required for ciphertext integrity." >&2
  exit 1
fi

mkdir -p "${STAGING_DIR}"
chmod 700 "${STAGING_DIR}"

# 2. Execute pg_dump with Custom Format (-Fc)
echo "[2/6] Executing pg_dump (-Fc custom compressed format)..."
PGPASSWORD="${PGPASSWORD:-}" pg_dump \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${DB_NAME}" \
  -F c \
  -b \
  -f "${RAW_DUMP_FILE}"

if [[ ! -s "${RAW_DUMP_FILE}" ]]; then
  echo "ERROR: pg_dump produced an empty or missing file. Aborting." >&2
  rm -rf "${STAGING_DIR}"
  exit 1
fi

DUMP_SIZE=$(du -h "${RAW_DUMP_FILE}" | cut -f1)
echo "Raw dump created: ${RAW_DUMP_FILE} (Size: ${DUMP_SIZE})"

# 3. Encrypt dump using AES-256-CBC with PBKDF2 (100,000 iterations)
echo "[3/6] Encrypting dump using AES-256-CBC with PBKDF2..."
if ! openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 \
  -in "${RAW_DUMP_FILE}" \
  -out "${ENCRYPTED_FILE}.tmp" \
  -pass "env:BACKUP_ENCRYPTION_KEY"; then
  echo "CRITICAL ERROR: Encryption process failed! Raw dump is preserved at ${RAW_DUMP_FILE}." >&2
  exit 1
fi

mv "${ENCRYPTED_FILE}.tmp" "${ENCRYPTED_FILE}"
chmod 600 "${ENCRYPTED_FILE}"

# 4. Generate Authenticated HMAC-SHA256 signature (Encrypt-then-MAC)
echo "[4/6] Generating HMAC-SHA256 integrity signature..."
# Compute HMAC of the encrypted archive
openssl dgst -sha256 -hmac "${BACKUP_HMAC_KEY}" "${ENCRYPTED_FILE}" | awk '{print $NF}' > "${HMAC_FILE}.tmp"
mv "${HMAC_FILE}.tmp" "${HMAC_FILE}"
chmod 600 "${HMAC_FILE}"

# 5. Immediate Verification Check (Verify HMAC matches before raw dump removal)
echo "[5/6] Verifying archive integrity..."
CALCULATED_HMAC=$(openssl dgst -sha256 -hmac "${BACKUP_HMAC_KEY}" "${ENCRYPTED_FILE}" | awk '{print $NF}')
STORED_HMAC=$(cat "${HMAC_FILE}")

if [[ "${CALCULATED_HMAC}" != "${STORED_HMAC}" ]]; then
  echo "CRITICAL ERROR: Generated backup failed immediate HMAC verification! Raw dump preserved." >&2
  exit 1
fi

# Verification passed: Safely remove unencrypted raw dump from staging
rm -rf "${STAGING_DIR}"
echo "Archive verified successfully: ${ENCRYPTED_FILE} + ${HMAC_FILE}"

# 6. Retention Management: Only delete older backups AFTER new backup verification succeeds
echo "[6/6] Applying local retention policy (older than 7 days)..."
find "${BACKUP_DIR}" -type f \( -name "*.dump.enc" -o -name "*.dump.hmac" \) -mtime +7 -delete

echo "EduTaktis hardened backup completed successfully at $(date)."
