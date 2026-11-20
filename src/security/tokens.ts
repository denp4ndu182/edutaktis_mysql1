
import crypto from 'crypto';

/**
 * Validates mandatory security configuration before the HTTP server starts.
 *
 * Production must never use the development fallback secret.
 */
export function validateSecurityConfiguration(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const secret = process.env.SESSION_SECRET;

  if (
    typeof secret !== 'string' ||
    secret.length < 32 ||
    secret.trim() !== secret ||
    secret ===
      'edutaktis_dev_secret_key_32_characters_minimum_entropy_salt_2025'
  ) {
    throw new Error(
      'CRITICAL SECURITY ERROR: Production requires a valid SESSION_SECRET of at least 32 characters.'
    );
  }

  if (process.env.ALLOW_SIMULATED_RESET_TOKEN === 'true') {
    throw new Error(
      'CRITICAL SECURITY ERROR: Simulated reset tokens are forbidden in production.'
    );
  }
}

/**
 * Retrieves the session secret key for HMAC token signing and verification.
 *
 * In production, SESSION_SECRET is strictly required.
 * In development and test, a deterministic fallback is used
 * when SESSION_SECRET is not configured.
 */
function getSecretKey(): string {
  const secret = process.env.SESSION_SECRET;

  if (secret && secret.length >= 32) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CRITICAL SECURITY ERROR: SESSION_SECRET must be defined with at least 32 characters in production.'
    );
  }

  // Deterministic local development fallback key.
  return 'edutaktis_dev_secret_key_32_characters_minimum_entropy_salt_2025';
}

/**
 * Generates a cryptographically secure random session token.
 * 32 bytes = 64 hexadecimal characters.
 */
export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Computes an HMAC-SHA256 hash of the raw token.
 * Only the hash should be stored in the database.
 */
export function hashToken(rawToken: string): string {
  return crypto
    .createHmac('sha256', getSecretKey())
    .update(rawToken)
    .digest('hex');
}

/**
 * Generates a cryptographically signed CSRF token.
 *
 * Format:
 * nonce.signature
 *
 * Nonce: 24 random bytes = 48 hexadecimal characters.
 * Signature: HMAC-SHA256 = 64 hexadecimal characters.
 */
export function generateCsrfToken(): string {
  const nonce = crypto.randomBytes(24).toString('hex');

  const signature = crypto
    .createHmac('sha256', getSecretKey())
    .update(nonce)
    .digest('hex');

  return `${nonce}.${signature}`;
}

/**
 * Verifies a CSRF token using HMAC-SHA256.
 * Uses timingSafeEqual to reduce timing attack risks.
 */
export function verifyCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  const parts = token.split('.');

  if (parts.length !== 2) {
    return false;
  }

  const [nonce, providedSignature] = parts;

  // Validate exact token format before cryptographic verification.
  if (
    !/^[a-f0-9]{48}$/i.test(nonce) ||
    !/^[a-f0-9]{64}$/i.test(providedSignature)
  ) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', getSecretKey())
      .update(nonce)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const providedBuffer = Buffer.from(providedSignature, 'utf8');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
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
