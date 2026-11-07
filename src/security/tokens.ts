import crypto from 'crypto';

/**
 * Retrieves the session secret key for HMAC token signing and verification.
 * In production, SESSION_SECRET is strictly required.
 * In development, generates a stable fallback derived from machine state.
 */
function getSecretKey(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CRITICAL SECURITY ERROR: SESSION_SECRET must be defined with at least 32 characters in production.');
  }
  // Deterministic local development fallback key
  return 'edutaktis_dev_secret_key_32_characters_minimum_entropy_salt_2025';
}

/**
 * Generates a cryptographically secure random session token (32 bytes = 64 hex characters).
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes an HMAC-SHA256 hash of the raw token using SESSION_SECRET for safe database storage.
 * Only the hash is stored in the database to prevent token theft from database backups.
 */
export function hashToken(rawToken: string): string {
  return crypto.createHmac('sha256', getSecretKey()).update(rawToken).digest('hex');
}

/**
 * Generates a cryptographically signed CSRF token using HMAC-SHA256:
 * Format: `${nonce}.${signature}`
 * Prevents attackers on subdomains or untrusted origins from injecting arbitrary CSRF tokens.
 */
export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(24).toString('hex');
  const signature = crypto.createHmac('sha256', getSecretKey()).update(nonce).digest('hex');
  return `${nonce}.${signature}`;
}

/**
 * Verifies that a CSRF token has a valid HMAC-SHA256 signature.
 * Uses timingSafeEqual to prevent timing attacks.
 */
export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [nonce, providedSignature] = parts;
  if (!nonce || !providedSignature || providedSignature.length !== 64) return false;

  try {
    const expectedSignature = crypto.createHmac('sha256', getSecretKey()).update(nonce).digest('hex');
    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const providedBuf = Buffer.from(providedSignature, 'utf8');

    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    return false;
  }
}

/**
 * Session duration configuration:
 * 7 days in milliseconds.
 */
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE_NAME = 'edutaktis_session';
export const CSRF_COOKIE_NAME = 'edutaktis_csrf';
