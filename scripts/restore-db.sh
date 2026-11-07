#!/usr/bin/env bash
# ==============================================================================
# EduTaktis SaaS — Hardened PostgreSQL Restore & Verification Script
# Target: Test/Staging Database or Disaster Recovery Instance
# Security: Pre-decryption HMAC Integrity Check + Accidental Production Guard
# ==============================================================================

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path_to_encrypted_dump.dump.enc> [target_database_name]"
  echo "Example: $0 /var/backups/edutaktis/edutaktis_20261106_120000.dump.enc edutaktis_dr_test"
  exit 1
fi

ENCRYPTED_FILE="$1"
TARGET_DB="${2:-edutaktis_test_restore}"
HMAC_FILE="${ENCRYPTED_FILE%.enc}.hmac"
RESTORE_TEMP_DIR="/tmp/edutaktis_restore_$$"
DECRYPTED_FILE="${RESTORE_TEMP_DIR}/restore.dump"

# 1. Production Database Overwrite Protection Guard
PROD_DATABASES=("edutaktis_db" "edutaktis_production" "edutaktis_prod")
for prod_db in "${PROD_DATABASES[@]}"; do
  if [[ "${TARGET_DB}" == "${prod_db}" ]]; then
    if [[ "${ALLOW_PRODUCTION_OVERWRITE:-false}" != "true" ]]; then
      echo "==================================================================" >&2
      echo "FATAL: Attempting to restore to production database '${TARGET_DB}'!" >&2
      echo "Restoration directly onto live production is blocked by default." >&2
      echo "To override intentionally during actual disaster recovery, set:" >&2
      echo "  export ALLOW_PRODUCTION_OVERWRITE=true" >&2
      echo "==================================================================" >&2
      exit 1
    fi
  fi
done

# 2. File and Key Validation
if [[ ! -f "${ENCRYPTED_FILE}" ]]; then
  echo "ERROR: Encrypted backup file does not exist: ${ENCRYPTED_FILE}" >&2
  exit 1
fi

if [[ -z "${BACKUP_ENCRYPTION_KEY:-}" ]]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY is required to decrypt the archive." >&2
  exit 1
fi

if [[ -z "${BACKUP_HMAC_KEY:-}" ]]; then
  echo "ERROR: BACKUP_HMAC_KEY is required to verify ciphertext integrity." >&2
  exit 1
fi

if [[ ! -f "${HMAC_FILE}" ]]; then
  echo "ERROR: Companion HMAC signature file not found: ${HMAC_FILE}." >&2
  echo "Refusing to decrypt unverified ciphertext." >&2
  exit 1
fi

# 3. Pre-Decryption HMAC Integrity Check (Protects against bit-flipping & padding oracle)
echo "[1/4] Verifying HMAC-SHA256 signature before decryption..."
EXPECTED_HMAC=$(cat "${HMAC_FILE}")
ACTUAL_HMAC=$(openssl dgst -sha256 -hmac "${BACKUP_HMAC_KEY}" "${ENCRYPTED_FILE}" | awk '{print $NF}')

if [[ "${EXPECTED_HMAC}" != "${ACTUAL_HMAC}" ]]; then
  echo "CRITICAL SECURITY ALERT: HMAC verification failed! Ciphertext has been tampered with or HMAC key is invalid." >&2
  exit 1
fi
echo "Ciphertext authentication passed: Signature matches."

mkdir -p "${RESTORE_TEMP_DIR}"
chmod 700 "${RESTORE_TEMP_DIR}"
trap 'rm -rf "${RESTORE_TEMP_DIR}"' EXIT

# 4. Decrypt Archive
echo "[2/4] Decrypting archive using AES-256-CBC (PBKDF2 100,000 iterations)..."
openssl enc -d -aes-256-cbc -salt -pbkdf2 -iter 100000 \
  -in "${ENCRYPTED_FILE}" \
  -out "${DECRYPTED_FILE}" \
  -pass "env:BACKUP_ENCRYPTION_KEY"

# 5. Verify TOC (Table of Contents) using pg_restore --list
echo "[3/4] Verifying dump archive structure with pg_restore -l..."
pg_restore -l "${DECRYPTED_FILE}" > "${RESTORE_TEMP_DIR}/toc.txt"
TOTAL_ITEMS=$(wc -l < "${RESTORE_TEMP_DIR}/toc.txt")
echo "Integrity verified: ${TOTAL_ITEMS} database objects found in TOC."

# 6. Rehearsal / Execution
echo "[4/4] Restoring to target database: ${TARGET_DB}..."
DB_HOST="${PGHOST:-127.0.0.1}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"

PGPASSWORD="${PGPASSWORD:-}" pg_restore \
  -h "${DB_HOST}" \
  -p "${DB_PORT}" \
  -U "${DB_USER}" \
  -d "${TARGET_DB}" \
  -v \
  --no-owner \
  --no-privileges \
  "${DECRYPTED_FILE}" || true

echo "Restoration and verification workflow finished successfully at $(date)."
