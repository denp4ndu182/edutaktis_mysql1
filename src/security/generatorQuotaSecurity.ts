import crypto from 'node:crypto';
import { isIP } from 'node:net';

const MIN_SECRET_LENGTH = 32;

const DEVELOPMENT_SECRET =
  'edutaktis_dev_secret_key_32_characters_minimum_entropy_salt_2025';

/**
 * Validates the independent secret used for generator quota hashing.
 *
 * Production must provide a dedicated secret shared by all application
 * instances. It must never reuse SESSION_SECRET.
 */
export function validateGeneratorQuotaSecret(): void {
  const secret = process.env.GENERATOR_QUOTA_SECRET;

  if (process.env.NODE_ENV === 'production' && !secret) {
    throw new Error(
      'CRITICAL SECURITY ERROR: Production requires GENERATOR_QUOTA_SECRET.'
    );
  }

  if (!secret) {
    return;
  }

  if (
    secret.length < MIN_SECRET_LENGTH ||
    secret.trim() !== secret ||
    secret === DEVELOPMENT_SECRET ||
    secret === process.env.SESSION_SECRET
  ) {
    throw new Error(
      'CRITICAL SECURITY ERROR: GENERATOR_QUOTA_SECRET is invalid or must be different from SESSION_SECRET.'
    );
  }
}

/**
 * Retrieves the dedicated quota secret.
 * Hash generation always fails closed when the secret is unavailable.
 */
function getGeneratorQuotaSecret(): string {
  const secret = process.env.GENERATOR_QUOTA_SECRET;

  if (
    typeof secret !== 'string' ||
    secret.length < MIN_SECRET_LENGTH ||
    secret.trim() !== secret ||
    secret === DEVELOPMENT_SECRET ||
    secret === process.env.SESSION_SECRET
  ) {
    throw new Error('GENERATOR_QUOTA_SECRET is missing or invalid.');
  }

  return secret;
}

/**
 * Canonicalizes an IP address before hashing.
 * Rejects malformed addresses and normalizes IPv6 representation.
 */
export function normalizeClientIp(ip: string): string {
  if (typeof ip !== 'string' || isIP(ip) === 0) {
    throw new Error('Invalid client IP address.');
  }

  // Normalize IPv4-mapped IPv6 addresses to their IPv4 representation.
  const mappedIpv4 = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);

  if (mappedIpv4 && isIP(mappedIpv4[1]) === 4) {
    return mappedIpv4[1]
      .split('.')
      .map((part) => String(Number(part)))
      .join('.');
  }

  if (isIP(ip) === 4) {
    return ip
      .split('.')
      .map((part) => String(Number(part)))
      .join('.');
  }

  // WHATWG URL serialization canonicalizes IPv6 notation.
  const hostname = new URL(`http://[${ip}]/`).hostname;

  return hostname.slice(1, -1).toLowerCase();
}

/**
 * Creates a domain-separated HMAC-SHA256 quota key.
 * The raw identifier is never stored in the database.
 */
export function createGeneratorQuotaHash(
  namespace: 'ip' | 'user',
  value: string
): string {
  if (
    (namespace !== 'ip' && namespace !== 'user') ||
    typeof value !== 'string' ||
    value.length === 0
  ) {
    throw new Error('Invalid generator quota hash input.');
  }

  const normalizedValue =
    namespace === 'ip' ? normalizeClientIp(value) : value;

  return crypto
    .createHmac('sha256', getGeneratorQuotaSecret())
    .update(`edutaktis:generator-quota:v1:${namespace}:${normalizedValue}`)
    .digest('hex');
}
