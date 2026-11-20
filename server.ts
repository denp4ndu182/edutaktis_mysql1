import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import cookieParser from 'cookie-parser';
import { InstitutionRole, MembershipStatus } from '@prisma/client';
import { authService } from './src/security/authService';
import { toSafeUserProfile } from './src/security/userDto';
import {
  requireAuth,
  requireInstitutionMembership,
  requireRole,
  requireCsrf,
  AuthenticatedRequest,
} from './src/middleware/authMiddleware';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  SESSION_DURATION_MS,
  generateCsrfToken,
  verifyCsrfToken,
  validateSecurityConfiguration,
} from './src/security/tokens';
import {
  hasPermission,
  canViewProject,
  canEditProject,
  canDeleteProject,
} from './src/security/permissions';
import { projectRepository } from './src/repositories/projectRepository';
import { modulAjarRepository } from './src/repositories/modulAjarRepository';
import { auditLogRepository } from './src/repositories/auditLogRepository';
import { legacyMigrationService } from './src/services/legacyMigrationService';
import { academicMappingService } from './src/services/academicMappingService';
import { modulAjarAiService } from './src/services/modulAjarAiService';
import { institutionOnboardingService, type SubmitInstitutionRequestInput } from './src/services/institutionOnboardingService';
import { membershipApprovalService } from './src/services/membershipApprovalService';
import { validateGeneratorQuotaSecret,} from './src/security/generatorQuotaSecurity';
import { randomUUID } from 'node:crypto';
import { generatorQuotaService, GeneratorQuotaServiceError } from './src/services/generatorQuotaService';
import { validateGeneratorRequest, type ValidatedGeneratorRequest } from './src/security/generatorRequestValidator';
import { validateGeneratorOutput } from './src/security/generatorOutputValidator';
import {
  generateDeterministicACP,
  generateDeterministicTP,
  generateDeterministicATP,
  generateDeterministicPROTA,
  generateDeterministicPROSEM,
  generateDeterministicKKTP,
} from './src/shared/deterministicDocumentGenerators';
import type {
  AnyDocumentContent,
  AcpData,
  TpData,
  AtpData,
  ProtaData,
} from './src/types';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_MEMBERSHIP_ROLES = [
  InstitutionRole.SCHOOL_ADMIN,
  InstitutionRole.HEADMASTER,
  InstitutionRole.TEACHER,
  InstitutionRole.OPERATOR,
] as const;

const ALLOWED_MEMBERSHIP_STATUSES = [
  MembershipStatus.ACTIVE,
  MembershipStatus.PENDING,
  MembershipStatus.INACTIVE,
] as const;

function validateMembershipUpdateBody(
  body: unknown,
  userIdField: 'targetUserId' | 'userId'
):
  | {
      valid: true;
      data: {
        userId: string;
        institutionId: string;
        newRole?: InstitutionRole;
        newStatus?: MembershipStatus;
      };
    }
  | { valid: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { valid: false, error: 'Format data tidak valid.' };
  }

  const data = body as Record<string, unknown>;
  const allowedKeys = new Set([
    userIdField,
    'institutionId',
    'newRole',
    'newStatus',
  ]);

  if (Object.keys(data).some((key) => !allowedKeys.has(key))) {
    return { valid: false, error: 'Terdapat field yang tidak diizinkan.' };
  }

  const userId = data[userIdField];
  const institutionId = data.institutionId;

  if (
    typeof userId !== 'string' ||
    userId.trim().length === 0 ||
    userId.length > 36 ||
    typeof institutionId !== 'string' ||
    institutionId.trim().length === 0 ||
    institutionId.length > 36
  ) {
    return { valid: false, error: 'ID pengguna atau institusi tidak valid.' };
  }

  if (data.newRole === undefined && data.newStatus === undefined) {
    return {
      valid: false,
      error: 'Minimal satu perubahan role atau status wajib disertakan.',
    };
  }

  if (
    data.newRole !== undefined &&
    (typeof data.newRole !== 'string' ||
      !ALLOWED_MEMBERSHIP_ROLES.includes(
        data.newRole as (typeof ALLOWED_MEMBERSHIP_ROLES)[number]
      ))
  ) {
    return { valid: false, error: 'Role tidak diizinkan.' };
  }

  if (
    data.newStatus !== undefined &&
    (typeof data.newStatus !== 'string' ||
      !ALLOWED_MEMBERSHIP_STATUSES.includes(
        data.newStatus as (typeof ALLOWED_MEMBERSHIP_STATUSES)[number]
      ))
  ) {
    return { valid: false, error: 'Status keanggotaan tidak valid.' };
  }

  return {
    valid: true,
    data: {
      userId: userId.trim(),
      institutionId: institutionId.trim(),
      ...(data.newRole !== undefined
        ? { newRole: data.newRole as InstitutionRole }
        : {}),
      ...(data.newStatus !== undefined
        ? { newStatus: data.newStatus as MembershipStatus }
        : {}),
    },
  };
}



type InstitutionRequestBodyData = Omit<
  SubmitInstitutionRequestInput,
  'requesterUserId' | 'ipAddress'
>;

type ValidationResult<T> =
  | { valid: true; data: T }
  | { valid: false; error: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}

function readRequiredText(
  data: Record<string, unknown>,
  field: string,
  label: string,
  maxLength: number
): ValidationResult<string> {
  const value = data[field];

  if (typeof value !== 'string') {
    return { valid: false, error: `${label} wajib berupa teks.` };
  }

  const normalized = value.trim();

  if (!normalized) {
    return { valid: false, error: `${label} wajib diisi.` };
  }

  if (normalized.length > maxLength) {
    return {
      valid: false,
      error: `${label} maksimal ${maxLength} karakter.`,
    };
  }

  return { valid: true, data: normalized };
}

function readOptionalText(
  data: Record<string, unknown>,
  field: string,
  label: string,
  maxLength: number
): ValidationResult<string | null> {
  const value = data[field];

  if (value === undefined || value === null || value === '') {
    return { valid: true, data: null };
  }

  if (typeof value !== 'string') {
    return { valid: false, error: `${label} harus berupa teks.` };
  }

  const normalized = value.trim();

  if (!normalized) {
    return { valid: true, data: null };
  }

  if (normalized.length > maxLength) {
    return {
      valid: false,
      error: `${label} maksimal ${maxLength} karakter.`,
    };
  }

  return { valid: true, data: normalized };
}

function validateInstitutionRequestBody(
  body: unknown
): ValidationResult<InstitutionRequestBodyData> {
  if (!isPlainObject(body)) {
    return { valid: false, error: 'Format data pengajuan tidak valid.' };
  }

  const allowedKeys = new Set([
    'npsn',
    'namaResmi',
    'namaSingkat',
    'jenjang',
    'jenisInstitusi',
    'kementerianDinas',
    'alamatLengkap',
    'kelurahanDesa',
    'kecamatan',
    'kabupatenKota',
    'provinsi',
    'kodePos',
    'telepon',
    'email',
    'website',
  ]);

  if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
    return {
      valid: false,
      error: 'Terdapat field pengajuan yang tidak diizinkan.',
    };
  }

  const requiredFields = [
    ['npsn', 'NPSN', 20],
    ['namaResmi', 'Nama resmi', 255],
    ['namaSingkat', 'Nama singkat', 100],
    ['jenjang', 'Jenjang', 20],
    ['jenisInstitusi', 'Jenis institusi', 20],
    ['kementerianDinas', 'Kementerian/dinas', 255],
    ['alamatLengkap', 'Alamat lengkap', 10000],
    ['kabupatenKota', 'Kabupaten/kota', 100],
    ['provinsi', 'Provinsi', 100],
  ] as const;

  const required: Record<string, string> = {};

  for (const [field, label, maxLength] of requiredFields) {
    const result = readRequiredText(body, field, label, maxLength);
    if (!result.valid) return result;
    required[field] = result.data;
  }

  const optionalFields = [
    ['kelurahanDesa', 'Kelurahan/desa', 100],
    ['kecamatan', 'Kecamatan', 100],
    ['kodePos', 'Kode pos', 20],
    ['telepon', 'Telepon', 50],
    ['email', 'Email', 255],
    ['website', 'Website', 255],
  ] as const;

  const optional: Record<string, string | null> = {};

  for (const [field, label, maxLength] of optionalFields) {
    const result = readOptionalText(body, field, label, maxLength);
    if (!result.valid) return result;
    optional[field] = result.data;
  }

  if (optional.email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(optional.email)) {
      return { valid: false, error: 'Format email institusi tidak valid.' };
    }
  }

  if (optional.website) {
    try {
      const websiteUrl = new URL(optional.website);
      if (
        !['http:', 'https:'].includes(websiteUrl.protocol) ||
        !websiteUrl.hostname
      ) {
        throw new Error('invalid URL');
      }
    } catch {
      return {
        valid: false,
        error: 'Website harus berupa URL HTTP atau HTTPS yang valid.',
      };
    }
  }

  return {
    valid: true,
    data: {
      npsn: required.npsn,
      namaResmi: required.namaResmi,
      namaSingkat: required.namaSingkat,
      jenjang: required.jenjang,
      jenisInstitusi: required.jenisInstitusi,
      kementerianDinas: required.kementerianDinas,
      alamatLengkap: required.alamatLengkap,
      kabupatenKota: required.kabupatenKota,
      provinsi: required.provinsi,
      kelurahanDesa: optional.kelurahanDesa,
      kecamatan: optional.kecamatan,
      kodePos: optional.kodePos,
      telepon: optional.telepon,
      email: optional.email,
      website: optional.website,
    },
  };
}

function validateInstitutionRequestId(
  value: unknown
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return { valid: false, error: 'ID pengajuan tidak valid.' };
  }

  const normalized = value.trim();

  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(normalized)) {
    return { valid: false, error: 'ID pengajuan harus menggunakan format UUID yang valid.' };
  }

  return { valid: true, data: normalized };
}

function validateInstitutionRequestRejectionBody(
  body: unknown
): ValidationResult<{ rejectionReason: string }> {
  if (!isPlainObject(body)) {
    return { valid: false, error: 'Format alasan penolakan tidak valid.' };
  }

  if (
    Object.keys(body).some((key) => key !== 'rejectionReason')
  ) {
    return {
      valid: false,
      error: 'Terdapat field penolakan yang tidak diizinkan.',
    };
  }

  const result = readRequiredText(
    body,
    'rejectionReason',
    'Alasan penolakan',
    5000
  );

  if (!result.valid) return result;

  return {
    valid: true,
    data: { rejectionReason: result.data },
  };
}

function validatePaginationQuery(
  query: Record<string, unknown>
): ValidationResult<{ take: number; skip: number }> {
  const allowedKeys = new Set(['take', 'skip']);

  if (Object.keys(query).some((key) => !allowedKeys.has(key))) {
    return {
      valid: false,
      error: 'Parameter pagination tidak diizinkan.',
    };
  }

  function parseInteger(
    value: unknown,
    fallback: number,
    min: number,
    max: number
  ): number | null {
    if (value === undefined) return fallback;
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;

    const parsed = Number(value);

    if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
      return null;
    }

    return parsed;
  }

  const take = parseInteger(query.take, 25, 1, 100);
  const skip = parseInteger(query.skip, 0, 0, 1000000);

  if (take === null || skip === null) {
    return {
      valid: false,
      error: 'Parameter take atau skip tidak valid.',
    };
  }

  return { valid: true, data: { take, skip } };
}


// Trust proxy configured securely: restrict to 1 hop or explicit setting (never unbounded true)
const trustProxyEnv = process.env.TRUST_PROXY;
let trustProxySetting: boolean | number | string = false;
if (trustProxyEnv === 'true' || trustProxyEnv === '1') {
  trustProxySetting = 1;
} else if (trustProxyEnv && trustProxyEnv !== 'false' && trustProxyEnv !== '0') {
  trustProxySetting = trustProxyEnv;
} else if (process.env.NODE_ENV === 'production' && !process.env.DISABLE_TRUST_PROXY) {
  trustProxySetting = 1; // Trust single reverse proxy hop in production
}
app.set('trust proxy', trustProxySetting);

app.use(express.json({ limit: '15mb', verify: (req, _res, buffer) => { if (req.url?.split('?')[0] === '/api/generate-document' && buffer.length > 2 * 1024 * 1024) { const error = new Error('Generator payload too large') as Error & { status: number; code: string }; error.status = 413; error.code = 'GENERATOR_PAYLOAD_TOO_LARGE'; throw error; } } }));
app.use(cookieParser());

// Helper to extract client IP safely without trusting spoofed forwarded headers unless proxy is trusted
export function getClientIp(req: Request): string {
  if (trustProxySetting && req.ip) {
    return req.ip;
  }
  return req.socket.remoteAddress || '127.0.0.1';
}


// Initialize Google GenAI client if API key is provided
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check endpoint (Public, Sanitized)
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    timestamp: new Date().toISOString(),
  });
});

// Database connectivity diagnostic endpoint (Public, Sanitized - No credentials/stack leak)
app.get('/api/health/db', async (_req: Request, res: Response) => {
  try {
    const { checkDatabaseConnection } = await import('./src/db/prisma.js');
    const result = await checkDatabaseConnection();
    res.json({
      connected: result.connected,
      status: result.connected ? 'ok' : 'unavailable',
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('/api/health/db internal error:', err);
    res.status(500).json({
      connected: false,
      status: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// AUTHENTICATION & SECURITY ENDPOINTS (PHASE 3B)
// ==========================================

const isProd = process.env.NODE_ENV === 'production';
const SESSION_COOKIE_OPTIONS: express.CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  maxAge: SESSION_DURATION_MS,
  path: '/',
};

const CSRF_COOKIE_OPTIONS: express.CookieOptions = {
  httpOnly: false, // readable by client to place in X-CSRF-Token header
  secure: isProd,
  sameSite: 'lax',
  maxAge: SESSION_DURATION_MS,
  path: '/',
};

// CSRF Token Provider
app.get('/api/auth/csrf', (req: Request, res: Response) => {
  let token = req.cookies ? req.cookies[CSRF_COOKIE_NAME] : undefined;

  if (!token || !verifyCsrfToken(token)) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTIONS);
  }

  res.json({ success: true, csrfToken: token });
});

// Register
app.post('/api/auth/register', requireCsrf, async (req: Request, res: Response) => {
  try {
    const {
      namaLengkap,
      email,
      password,
      gelarDepan,
      gelarBelakang,
      nip,
      nuptk,
      nomorTelepon,
      preferensiMataPelajaran,
      npsn,
    } = req.body;

    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    const result = await authService.register(
      {
        namaLengkap,
        email,
        password,
        gelarDepan,
        gelarBelakang,
        nip,
        nuptk,
        nomorTelepon,
        preferensiMataPelajaran,
        npsn,
      },
      ipAddress,
      userAgent
    );

    if (!result.success || !result.session) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.cookie(SESSION_COOKIE_NAME, result.session.token, SESSION_COOKIE_OPTIONS);
    const csrfToken = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);

    return res.status(201).json({
      success: true,
      user: result.session.user,
      expiresAt: result.session.expiresAt,
      csrfToken,
    });
  } catch (err: any) {
    console.error('Register endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Kesalahan internal saat pendaftaran' });
  }
});

// Login
app.post('/api/auth/login', requireCsrf, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const ipAddress = getClientIp(req);
    const userAgent = req.headers['user-agent'];

    const result = await authService.login(email, password, ipAddress, userAgent);

    if (!result.success || !result.session) {
      return res.status(401).json({
        success: false,
        error: result.error,
        retryAfterSeconds: result.retryAfterSeconds,
      });
    }

    res.cookie(SESSION_COOKIE_NAME, result.session.token, SESSION_COOKIE_OPTIONS);
    const csrfToken = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, csrfToken, CSRF_COOKIE_OPTIONS);

    return res.json({
      success: true,
      user: result.session.user,
      expiresAt: result.session.expiresAt,
      csrfToken,
    });
  } catch (err: any) {
    console.error('Login endpoint error:', err);
    return res.status(500).json({ success: false, error: 'Kesalahan internal saat login' });
  }
});

// Logout (current session)
app.post('/api/auth/logout', requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rawToken = req.cookies ? req.cookies[SESSION_COOKIE_NAME] : undefined;
    const ipAddress = getClientIp(req);

    if (rawToken) {
      await authService.logout(rawToken, req.user?.id, ipAddress);
    }

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
    return res.json({ success: true, message: 'Berhasil keluar dari sesi saat ini.' });
  } catch (err: any) {
    console.error('Logout error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memproses logout' });
  }
});

// Logout all devices
app.post('/api/auth/logout-all', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ipAddress = getClientIp(req);
    const count = await authService.logoutAll(req.user!.id, ipAddress);

    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
    return res.json({
      success: true,
      message: `Seluruh sesi (${count}) berhasil dicabut. Silakan login kembali.`,
      revokedCount: count,
    });
  } catch (err: any) {
    console.error('Logout-all error:', err);
    return res.status(500).json({ success: false, error: 'Gagal mencabut seluruh sesi' });
  }
});

// Get current verified session & user info
app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const headerValue = req.headers['x-institution-id'];

    if (headerValue !== undefined && (typeof headerValue !== 'string' || !headerValue.trim())) {
      return res.status(400).json({
        success: false,
        error: 'X-Institution-Id tidak valid.',
        code: 'INVALID_INSTITUTION_ID',
      });
    }

    const targetInstitutionId = headerValue as string | undefined;
    const tenantCtx = await authService.getUserTenantContext(
      req.user!.id,
      targetInstitutionId
    );

    if (targetInstitutionId !== undefined) {
      const validMembership = tenantCtx.userInstitutions.find(
        (ui: any) =>
          ui.membership.institutionId === targetInstitutionId &&
          ui.membership.status === 'ACTIVE'
      );

      if (!validMembership) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki keanggotaan aktif pada institusi tersebut.',
          code: 'TENANT_FORBIDDEN',
          user: req.user,
          tenantContext: tenantCtx,
        });
      }
    }

    return res.json({
      success: true,
      user: req.user,
      tenantContext: tenantCtx,
    });
  } catch (err: any) {
    console.error('Get /api/auth/me error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memuat konteks sesi pengguna' });
  }
});

// Forgot password request
app.post('/api/auth/forgot-password', requireCsrf, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const ipAddress = getClientIp(req);
    const result = await authService.requestPasswordReset(email, ipAddress);
    if (result.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json(result);
    }
    return res.json(result);
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memproses permintaan reset password' });
  }
});

// Reset password with verified one-time token
app.post('/api/auth/reset-password', requireCsrf, async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Token dan password baru wajib disertakan.' });
    }
    const ipAddress = getClientIp(req);
    const result = await authService.resetPasswordWithToken(token, newPassword, ipAddress);
    if (result.retryAfterSeconds) {
      res.setHeader('Retry-After', String(result.retryAfterSeconds));
      return res.status(429).json(result);
    }
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.clearCookie(CSRF_COOKIE_NAME, { path: '/' });
    return res.json(result);
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ success: false, error: 'Gagal mereset password' });
  }
});

// ==========================================

// ==========================================
// INSTITUTION ONBOARDING - USER REQUEST API
// ==========================================

app.post(
  '/api/institution-requests',
  requireAuth,
  requireCsrf,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validateInstitutionRequestBody(req.body);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      const request = await institutionOnboardingService.submitRequest({
        ...validation.data,
        requesterUserId: req.user!.id,
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ success: true, request });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (
        message === 'NPSN_ALREADY_REGISTERED' ||
        message === 'NPSN_REQUEST_ALREADY_PENDING'
      ) {
        return res.status(409).json({
          success: false,
          error: message === 'NPSN_ALREADY_REGISTERED'
            ? 'NPSN sudah terdaftar pada institusi.'
            : 'Pengajuan dengan NPSN tersebut sedang menunggu peninjauan.',
          code: message,
        });
      }

      if (message === 'REQUESTER_NOT_ACTIVE') {
        return res.status(403).json({
          success: false,
          error: 'Akun pengguna tidak aktif.',
          code: message,
        });
      }

      if (message.startsWith('VALIDATION_ERROR:')) {
        return res.status(400).json({
          success: false,
          error: message.replace('VALIDATION_ERROR:', '').trim(),
          code: 'VALIDATION_ERROR',
        });
      }

      console.error('Submit institution request error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengirim pengajuan institusi.',
      });
    }
  }
);

app.get(
  '/api/institution-requests/my',
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pagination = validatePaginationQuery(
        req.query as Record<string, unknown>
      );

      if (!pagination.valid) {
        return res.status(400).json({
          success: false,
          error: pagination.error,
        });
      }

      const requests = await institutionOnboardingService.getMyRequests(
        req.user!.id,
        pagination.data
      );

      return res.json({
        success: true,
        requests,
        pagination: pagination.data,
      });
    } catch (err: unknown) {
      console.error('List own institution requests error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengambil daftar pengajuan institusi.',
      });
    }
  }
);

app.post(
  '/api/institution-requests/:id/cancel',
  requireAuth,
  requireCsrf,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idValidation = validateInstitutionRequestId(req.params.id);

      if (!idValidation.valid) {
        return res.status(400).json({
          success: false,
          error: idValidation.error,
        });
      }

      const request = await institutionOnboardingService.cancelRequest(
        idValidation.data,
        req.user!.id,
        getClientIp(req)
      );

      return res.json({ success: true, request });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message === 'INSTITUTION_REQUEST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Pengajuan institusi tidak ditemukan.',
          code: message,
        });
      }

      if (message === 'INSTITUTION_REQUEST_FORBIDDEN') {
        return res.status(403).json({
          success: false,
          error: 'Anda tidak memiliki akses untuk membatalkan pengajuan ini.',
          code: message,
        });
      }

      if (
        message === 'INSTITUTION_REQUEST_STATE_CONFLICT' ||
        message === 'INSTITUTION_REQUEST_NOT_PENDING'
      ) {
        return res.status(409).json({
          success: false,
          error: 'Pengajuan tidak lagi berstatus menunggu peninjauan.',
          code: message,
        });
      }

      if (message.startsWith('VALIDATION_ERROR:')) {
        return res.status(400).json({
          success: false,
          error: message.replace('VALIDATION_ERROR:', '').trim(),
          code: 'VALIDATION_ERROR',
        });
      }

      console.error('Cancel institution request error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal membatalkan pengajuan institusi.',
      });
    }
  }
);

// TENANT & MULTI-USER RBAC API ENDPOINTS
// ==========================================

// Authenticated Tenant Context
app.get('/api/tenant/context', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const headerValue = req.headers['x-institution-id'];

    if (headerValue !== undefined && (typeof headerValue !== 'string' || !headerValue.trim())) {
      return res.status(400).json({
        success: false,
        error: 'X-Institution-Id tidak valid.',
        code: 'INVALID_INSTITUTION_ID',
      });
    }

    const targetInstitutionId = headerValue as string | undefined;
    const tenantCtx = await authService.getUserTenantContext(req.user!.id, targetInstitutionId);

    if (targetInstitutionId !== undefined) {
      const validMembership = tenantCtx.userInstitutions.find(
        (ui: any) =>
          ui.membership.institutionId === targetInstitutionId &&
          ui.membership.status === 'ACTIVE'
      );

      if (!validMembership) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki keanggotaan aktif pada institusi tersebut.',
          code: 'TENANT_FORBIDDEN',
        });
      }
    }

    return res.json({
      success: true,
      context: tenantCtx,
    });
  } catch (err: any) {
    console.error('Tenant context error:', err);
    return res.status(500).json({ success: false, error: 'Gagal mengambil konteks tenant' });
  }
});

// Update User Profile (Self only)
app.post('/api/tenant/user-profile', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updatedProfile = req.body;
    // CRITICAL: Prevent impersonation by overriding id with verified session user id
    const userId = req.user!.id;

    const { userRepository } = await import('./src/repositories/userRepository.js');
    let user;
    if (process.env.DATABASE_URL) {
      user = await userRepository.update(userId, {
        namaLengkap: updatedProfile.namaLengkap,
        gelarDepan: updatedProfile.gelarDepan,
        gelarBelakang: updatedProfile.gelarBelakang,
        nip: updatedProfile.nip,
        nuptk: updatedProfile.nuptk,
        nomorTelepon: updatedProfile.nomorTelepon,
        fotoProfilUrl: updatedProfile.fotoProfilUrl,
        preferensiMataPelajaran: updatedProfile.preferensiMataPelajaran,
      });
    } else {
      user = {
        ...req.user,
        ...updatedProfile,
        id: userId,
      };
    }

    return res.json({ success: true, user: toSafeUserProfile(user) });
  } catch (err: any) {
    console.error('Update user profile error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memperbarui profil pengguna' });
  }
});

// Update Institution Profile (Server-side RBAC validation)
app.post(
  '/api/tenant/institution-profile',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN', 'HEADMASTER']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { institution } = req.body;

      if (!institution || !institution.id) {
        return res.status(400).json({ success: false, error: 'Data institusi tidak lengkap.' });
      }

      // Ensure caller is operating strictly on their verified active institution
      if (institution.id !== req.institutionId) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak diizinkan mengubah profil institusi lain.',
        });
      }

      const { institutionRepository } = await import('./src/repositories/institutionRepository.js');
      let updated;
      if (process.env.DATABASE_URL) {
        updated = await institutionRepository.update(institution.id, {
          namaResmi: institution.namaResmi,
          namaSingkat: institution.namaSingkat,
          jenjang: institution.jenjang,
          alamatLengkap: institution.alamatLengkap,
          namaKepala: institution.namaKepala,
          nipKepala: institution.nipKepala,
          kotaTandaTangan: institution.kotaTandaTangan,
          telepon: institution.telepon,
          email: institution.email,
          website: institution.website,
        });
      } else {
        updated = { ...institution, updatedAt: new Date().toISOString() };
      }

      return res.json({ success: true, institution: updated });
    } catch (err: any) {
      console.error('Update institution profile error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memperbarui profil institusi' });
    }
  }
);

// Update Membership Role & Status (Restricted to SUPER_ADMIN & SCHOOL_ADMIN)
app.post(
  '/api/tenant/memberships/update-role',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = validateMembershipUpdateBody(
        { ...req.body, institutionId: req.institutionId },
        'targetUserId'
      );

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      const ipAddress = getClientIp(req);
      const result = await authService.updateMembership({
        callerUserId: req.user!.id,
        targetUserId: validation.data.userId,
        institutionId: validation.data.institutionId,
        newRole: validation.data.newRole,
        newStatus: validation.data.newStatus,
        ipAddress,
      });

      if (!result.success) {
        return res.status(403).json(result);
      }
      return res.json(result);
    } catch (err: any) {
      console.error('Update membership role error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memperbarui peran keanggotaan' });
    }
  }
);


// List pending membership requests for the verified institution.
app.get(
  '/api/tenant/membership-requests',
  requireAuth,
  requireInstitutionMembership,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const pagination = validatePaginationQuery(
        req.query as Record<string, unknown>
      );

      if (!pagination.valid) {
        return res.status(400).json({
          success: false,
          error: pagination.error,
          code: 'VALIDATION_ERROR',
        });
      }

      const requests = await membershipApprovalService.listPending({
        institutionId: req.institutionId!,
        actorUserId: req.user!.id,
        ...pagination.data,
      });

      return res.json({
        success: true,
        requests,
        pagination: pagination.data,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message.startsWith('VALIDATION_ERROR:')) {
        return res.status(400).json({
          success: false,
          error: message.replace('VALIDATION_ERROR:', '').trim(),
          code: 'VALIDATION_ERROR',
        });
      }

      if (
        message === 'REVIEWER_NOT_ACTIVE' ||
        message === 'REVIEWER_MEMBERSHIP_NOT_ACTIVE' ||
        message === 'REVIEWER_NOT_AUTHORIZED'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Akun atau hak akses tidak memenuhi persyaratan.',
          code: message,
        });
      }

      console.error('List pending membership requests error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengambil daftar permintaan keanggotaan.',
      });
    }
  }
);

// Approve a pending membership request.
// The applicant's existing role is preserved by the service.
app.post(
  '/api/tenant/membership-requests/:id/approve',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idValidation = validateInstitutionRequestId(req.params.id);

      if (!idValidation.valid) {
        return res.status(400).json({
          success: false,
          error: idValidation.error,
          code: 'VALIDATION_ERROR',
        });
      }

      // Approval accepts no client-controlled fields.
      if (
        req.body !== undefined &&
        req.body !== null &&
        (!isPlainObject(req.body) || Object.keys(req.body).length > 0)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Body persetujuan tidak boleh memuat field tambahan.',
          code: 'VALIDATION_ERROR',
        });
      }

      const membership = await membershipApprovalService.approve({
        membershipId: idValidation.data,
        institutionId: req.institutionId!,
        actorUserId: req.user!.id,
        ipAddress: getClientIp(req),
      });

      return res.json({
        success: true,
        membership,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message === 'MEMBERSHIP_REQUEST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Permintaan keanggotaan tidak ditemukan.',
          code: message,
        });
      }

      if (message === 'MEMBERSHIP_REQUEST_STATE_CONFLICT') {
        return res.status(409).json({
          success: false,
          error: 'Permintaan keanggotaan tidak lagi berstatus menunggu.',
          code: message,
        });
      }

      if (
        message === 'REVIEWER_NOT_ACTIVE' ||
        message === 'REVIEWER_MEMBERSHIP_NOT_ACTIVE' ||
        message === 'REVIEWER_NOT_AUTHORIZED' ||
        message === 'APPLICANT_NOT_ACTIVE'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Akun atau hak akses tidak memenuhi persyaratan.',
          code: message,
        });
      }

      if (message.startsWith('VALIDATION_ERROR:')) {
        return res.status(400).json({
          success: false,
          error: message.replace('VALIDATION_ERROR:', '').trim(),
          code: 'VALIDATION_ERROR',
        });
      }

      console.error('Approve membership request error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal menyetujui permintaan keanggotaan.',
      });
    }
  }
);

// Reject a pending membership request.
// Rejection reason is optional and limited to 1000 characters.
app.post(
  '/api/tenant/membership-requests/:id/reject',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  requireRole(['SUPER_ADMIN', 'SCHOOL_ADMIN']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idValidation = validateInstitutionRequestId(req.params.id);

      if (!idValidation.valid) {
        return res.status(400).json({
          success: false,
          error: idValidation.error,
          code: 'VALIDATION_ERROR',
        });
      }

      let reason: string | undefined;

      if (req.body !== undefined && req.body !== null) {
        if (!isPlainObject(req.body)) {
          return res.status(400).json({
            success: false,
            error: 'Format alasan penolakan tidak valid.',
            code: 'VALIDATION_ERROR',
          });
        }

        if (
          Object.keys(req.body).some((key) => key !== 'rejectionReason')
        ) {
          return res.status(400).json({
            success: false,
            error: 'Terdapat field penolakan yang tidak diizinkan.',
            code: 'VALIDATION_ERROR',
          });
        }

        const reasonValidation = readOptionalText(
          req.body,
          'rejectionReason',
          'Alasan penolakan',
          1000
        );

        if (!reasonValidation.valid) {
          return res.status(400).json({
            success: false,
            error: reasonValidation.error,
            code: 'VALIDATION_ERROR',
          });
        }

        reason = reasonValidation.data ?? undefined;
      }

      const membership = await membershipApprovalService.reject({
        membershipId: idValidation.data,
        institutionId: req.institutionId!,
        actorUserId: req.user!.id,
        ipAddress: getClientIp(req),
        reason,
      });

      return res.json({
        success: true,
        membership,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message === 'MEMBERSHIP_REQUEST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Permintaan keanggotaan tidak ditemukan.',
          code: message,
        });
      }

      if (message === 'MEMBERSHIP_REQUEST_STATE_CONFLICT') {
        return res.status(409).json({
          success: false,
          error: 'Permintaan keanggotaan tidak lagi berstatus menunggu.',
          code: message,
        });
      }

      if (
        message === 'REVIEWER_NOT_ACTIVE' ||
        message === 'REVIEWER_MEMBERSHIP_NOT_ACTIVE' ||
        message === 'REVIEWER_NOT_AUTHORIZED'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Akun atau hak akses tidak memenuhi persyaratan.',
          code: message,
        });
      }

      if (message.startsWith('VALIDATION_ERROR:')) {
        return res.status(400).json({
          success: false,
          error: message.replace('VALIDATION_ERROR:', '').trim(),
          code: 'VALIDATION_ERROR',
        });
      }

      console.error('Reject membership request error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal menolak permintaan keanggotaan.',
      });
    }
  }
);

// Switch active institution (verified against user's server memberships)
app.post('/api/tenant/switch-institution', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { institutionId } = req.body || {};

    if (typeof institutionId !== 'string' || !institutionId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Institution ID wajib berupa string yang valid.',
        code: 'INVALID_INSTITUTION_ID',
      });
    }

    const tenantCtx = await authService.getUserTenantContext(req.user!.id, institutionId);
    const validMem = tenantCtx.userInstitutions.find(
      (ui: any) =>
        ui.membership.institutionId === institutionId &&
        ui.membership.status === 'ACTIVE'
    );

    if (!validMem) {
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak: Anda tidak memiliki keanggotaan aktif pada institusi tersebut.',
        code: 'TENANT_FORBIDDEN',
      });
    }

    return res.json({
      success: true,
      activeInstitutionId: institutionId,
      currentMembership: validMem.membership,
      currentInstitution: validMem.institution,
    });
  } catch (err: any) {
    console.error('Switch institution error:', err);
    return res.status(500).json({ success: false, error: 'Gagal mengganti institusi aktif' });
  }
});

// ==========================================
// TENANT PROJECT CRUD ENDPOINTS (TENANT ISOLATED)
// ==========================================

// List projects in active institution (Tenant Scoped & Paginated)
app.get(
  '/api/tenant/projects',
  requireAuth,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userRole = req.membership!.role;
      // Roles with project:view_school can see all school projects; others see only their own
      const canViewSchool = hasPermission(userRole, 'project:view_school');
      const userIdFilter = canViewSchool ? undefined : req.user!.id;

      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const projects = await projectRepository.listProjectsByInstitution(
        req.institutionId!,
        userIdFilter,
        limit,
        offset
      );
      const total = await projectRepository.countByInstitution(req.institutionId!, userIdFilter);

      return res.json({
        success: true,
        projects,
        pagination: {
          total,
          limit,
          offset,
        },
      });
    } catch (err: any) {
      console.error('List projects error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memuat proyek institusi' });
    }
  }
);

// Get single project by ID with strict tenant boundary and IDOR prevention
app.get(
  '/api/tenant/projects/:id',
  requireAuth,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const project = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      // BOLA/IDOR protection: generic 404 response to avoid confirming project existence in other tenants
      if (!project) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = project.userId === req.user!.id;
      if (!canViewProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin untuk melihat proyek ini.',
          code: 'INSUFFICIENT_PROJECT_VIEW_PERMISSION',
        });
      }

      return res.json({ success: true, project });
    } catch (err: any) {
      console.error('Get project error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memuat detail proyek' });
    }
  }
);

// Create project in active institution (Strict server-derived identity and permission check)
app.post(
  '/api/tenant/projects',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userRole = req.membership!.role;
      if (!hasPermission(userRole, 'project:create')) {
        return res.status(403).json({
          success: false,
          error: `Akses ditolak: Peran '${userRole}' tidak memiliki izin untuk membuat proyek administrasi baru.`,
          code: 'FORBIDDEN_PROJECT_CREATE',
        });
      }

      const { name, masterInput, documents } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ success: false, error: 'Nama proyek wajib diisi.' });
      }
      if (!masterInput || typeof masterInput !== 'object') {
        return res.status(400).json({ success: false, error: 'Data master input wajib berupa objek valid.' });
      }

      // CRITICAL DATA OWNERSHIP: Owner and institution are strictly derived from verified session
      const project = await projectRepository.createProject({
        name: name.trim(),
        masterInput,
        documents: documents || {},
        institutionId: req.institutionId!,
        userId: req.user!.id,
      });

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'PROJECT_CREATED',
        resource: 'Project',
        details: { projectId: project.id, name: project.name },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ success: true, project });
    } catch (err: any) {
      console.error('Create project error:', err);
      return res.status(500).json({ success: false, error: err.message || 'Gagal membuat proyek baru' });
    }
  }
);

// Update project (ownership & immutability enforced)
app.put(
  '/api/tenant/projects/:id',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      // IDOR safe 404 response
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canEditProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin untuk mengubah proyek ini.',
          code: 'INSUFFICIENT_PROJECT_EDIT_PERMISSION',
        });
      }

      // IMMUTABILITY GUARD: Prevent ownership hijacking or cross-tenant transfer
      if (req.body.userId && req.body.userId !== existing.userId) {
        return res.status(400).json({
          success: false,
          error: 'Akses ditolak: Pemilik proyek (userId) bersifat permanen dan tidak dapat dialihkan secara bebas.',
          code: 'IMMUTABLE_USER_ID',
        });
      }
      if (req.body.institutionId && req.body.institutionId !== existing.institutionId) {
        return res.status(400).json({
          success: false,
          error: 'Akses ditolak: Institusi proyek (institutionId) bersifat permanen dan tidak dapat dipindahkan.',
          code: 'IMMUTABLE_INSTITUTION_ID',
        });
      }

      const { name, masterInput, documents } = req.body;
      const updated = await projectRepository.updateProject(
        projectId,
        req.institutionId!,
        { name, masterInput, documents },
        isOwner ? req.user!.id : undefined
      );

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'PROJECT_UPDATED',
        resource: 'Project',
        details: { projectId, isOwner, name: updated.name },
        ipAddress: getClientIp(req),
      });

      return res.json({ success: true, project: updated });
    } catch (err: any) {
      console.error('Update project error:', err);
      return res.status(403).json({ success: false, error: err.message || 'Gagal memperbarui proyek' });
    }
  }
);

// Delete project (ownership & authorization enforced)
app.delete(
  '/api/tenant/projects/:id',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canDeleteProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: `Akses ditolak: Peran '${req.membership!.role}' tidak memiliki izin menghapus proyek ini.`,
          code: 'INSUFFICIENT_PROJECT_DELETE_PERMISSION',
        });
      }

      await projectRepository.deleteProject(
        projectId,
        req.institutionId!,
        isOwner ? req.user!.id : undefined
      );

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'PROJECT_DELETED',
        resource: 'Project',
        details: { projectId, projectName: existing.name, isOwner },
        ipAddress: getClientIp(req),
      });

      return res.json({ success: true, message: 'Proyek berhasil dihapus' });
    } catch (err: any) {
      console.error('Delete project error:', err);
      return res.status(403).json({ success: false, error: err.message || 'Gagal menghapus proyek' });
    }
  }
);

// ==========================================
// TENANT MODUL AJAR KBC & LKPD ENDPOINTS (PHASE 1A)
// ==========================================

// 1. Create Modul Ajar Draft/Record
app.post(
  '/api/tenant/projects/:id/modul-ajar',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canEditProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin untuk membuat Modul Ajar pada proyek ini.',
          code: 'INSUFFICIENT_PROJECT_EDIT_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;

      const { teacherInput, content } = req.body;
      if (!teacherInput || typeof teacherInput !== 'object' || !teacherInput.materiPokok) {
        return res.status(400).json({
          success: false,
          error: 'teacherInput wajib berupa objek dan menyertakan materiPokok.',
        });
      }

      const record = await modulAjarRepository.createModulAjar(
        projectId,
        req.institutionId!,
        projectAccessUserId,
        teacherInput,
        content
      );

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'MODUL_AJAR_CREATED',
        resource: 'ModulAjarKbc',
        details: { projectId, documentId: record.id, title: record.title },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      console.error('Create Modul Ajar error:', err);
      return res.status(400).json({ success: false, error: err.message || 'Gagal membuat Modul Ajar' });
    }
  }
);

// 2. List Modul Ajar Records for Project
app.get(
  '/api/tenant/projects/:id/modul-ajar',
  requireAuth,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canViewProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin melihat dokumen proyek ini.',
          code: 'INSUFFICIENT_PROJECT_VIEW_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;

      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const result = await modulAjarRepository.listModulAjar(
        projectId,
        req.institutionId!,
        projectAccessUserId,
        limit,
        offset
      );

      return res.json({ success: true, data: result.items, total: result.total, limit, offset });
    } catch (err: any) {
      console.error('List Modul Ajar error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memuat daftar Modul Ajar' });
    }
  }
);

// 3. Get Single Modul Ajar Record
app.get(
  '/api/tenant/projects/:id/modul-ajar/:documentId',
  requireAuth,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, documentId } = req.params;
      const existing = await projectRepository.findProjectByIdAndInstitution(
        projectId,
        req.institutionId!
      );

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canViewProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin melihat dokumen proyek ini.',
          code: 'INSUFFICIENT_PROJECT_VIEW_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;
      const record = await modulAjarRepository.getModulAjarById(
        projectId,
        documentId,
        req.institutionId!,
        projectAccessUserId
      );

      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Dokumen Modul Ajar tidak ditemukan atau akses ditolak.',
          code: 'DOCUMENT_NOT_FOUND',
        });
      }

      return res.json({ success: true, data: record });
    } catch (err: any) {
      console.error('Get Modul Ajar error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memuat detail Modul Ajar' });
    }
  }
);

// 4. Update Modul Ajar Record
app.put(
  '/api/tenant/projects/:id/modul-ajar/:documentId',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, documentId } = req.params;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canEditProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin mengubah Modul Ajar proyek ini.',
          code: 'INSUFFICIENT_PROJECT_EDIT_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;

      const { title, content, status, changelog, teacherInput, expectedProjectUpdatedAt } = req.body;
      const updated = await modulAjarRepository.updateModulAjar(
        projectId,
        documentId,
        req.institutionId!,
        projectAccessUserId,
        { title, content, status, changelog, teacherInput, expectedProjectUpdatedAt }
      );

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'MODUL_AJAR_UPDATED',
        resource: 'ModulAjarKbc',
        details: { projectId, documentId, version: updated.version },
        ipAddress: getClientIp(req),
      });

      return res.json({ success: true, data: updated });
    } catch (err: any) {
      console.error('Update Modul Ajar error:', err);
      if (err.code === 'OCC_CONFLICT' || err.message?.includes('OCC_CONFLICT')) {
        return res.status(409).json({
          success: false,
          error: 'Konflik konkurensi: Data proyek telah diperbarui oleh pengguna lain. Silakan muat ulang.',
          code: 'OCC_CONFLICT',
        });
      }
      return res.status(400).json({ success: false, error: err.message || 'Gagal memperbarui Modul Ajar' });
    }
  }
);

// 5. Create LKPD Draft/Record
app.post(
  '/api/tenant/projects/:id/lkpd',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canEditProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin membuat LKPD pada proyek ini.',
          code: 'INSUFFICIENT_PROJECT_EDIT_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;

      const { mode, sourceModuleId, materiPokok, teacherInput, content } = req.body;
      if (!materiPokok || typeof materiPokok !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'materiPokok wajib diisi.',
        });
      }

      const record = await modulAjarRepository.createLkpd(
        projectId,
        req.institutionId!,
        projectAccessUserId,
        {
          mode: mode || 'FROM_ACADEMIC_DATA',
          sourceModuleId,
          materiPokok,
          teacherInput,
        },
        content
      );

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'LKPD_CREATED',
        resource: 'Lkpd',
        details: { projectId, documentId: record.id, mode: record.mode },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({ success: true, data: record });
    } catch (err: any) {
      console.error('Create LKPD error:', err);
      return res.status(400).json({ success: false, error: err.message || 'Gagal membuat LKPD' });
    }
  }
);

// 6. List LKPD Records for Project
app.get(
  '/api/tenant/projects/:id/lkpd',
  requireAuth,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canViewProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin melihat dokumen proyek ini.',
          code: 'INSUFFICIENT_PROJECT_VIEW_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;

      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const result = await modulAjarRepository.listLkpd(
        projectId,
        req.institutionId!,
        projectAccessUserId,
        limit,
        offset
      );

      return res.json({ success: true, data: result.items, total: result.total, limit, offset });
    } catch (err: any) {
      console.error('List LKPD error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memuat daftar LKPD' });
    }
  }
);

// 7. Get Single LKPD Record
app.get(
  '/api/tenant/projects/:id/lkpd/:documentId',
  requireAuth,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, documentId } = req.params;
      const existing = await projectRepository.findProjectByIdAndInstitution(
        projectId,
        req.institutionId!
      );

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canViewProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin melihat dokumen proyek ini.',
          code: 'INSUFFICIENT_PROJECT_VIEW_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;
      const record = await modulAjarRepository.getLkpdById(
        projectId,
        documentId,
        req.institutionId!,
        projectAccessUserId
      );

      if (!record) {
        return res.status(404).json({
          success: false,
          error: 'Dokumen LKPD tidak ditemukan atau akses ditolak.',
          code: 'DOCUMENT_NOT_FOUND',
        });
      }

      return res.json({ success: true, data: record });
    } catch (err: any) {
      console.error('Get LKPD error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memuat detail LKPD' });
    }
  }
);

// 8. Update LKPD Record
app.put(
  '/api/tenant/projects/:id/lkpd/:documentId',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: projectId, documentId } = req.params;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canEditProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin mengubah LKPD proyek ini.',
          code: 'INSUFFICIENT_PROJECT_EDIT_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;

      const { title, content, status, changelog, teacherInput, expectedProjectUpdatedAt } = req.body;
      const updated = await modulAjarRepository.updateLkpd(
        projectId,
        documentId,
        req.institutionId!,
        projectAccessUserId,
        { title, content, status, changelog, teacherInput, expectedProjectUpdatedAt }
      );

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'LKPD_UPDATED',
        resource: 'Lkpd',
        details: { projectId, documentId, version: updated.version },
        ipAddress: getClientIp(req),
      });

      return res.json({ success: true, data: updated });
    } catch (err: any) {
      console.error('Update LKPD error:', err);
      if (err.code === 'OCC_CONFLICT' || err.message?.includes('OCC_CONFLICT')) {
        return res.status(409).json({
          success: false,
          error: 'Konflik konkurensi: Data proyek telah diperbarui oleh pengguna lain. Silakan muat ulang.',
          code: 'OCC_CONFLICT',
        });
      }
      return res.status(400).json({ success: false, error: err.message || 'Gagal memperbarui LKPD' });
    }
  }
);

// ==========================================
// PHASE 2A — AI GENERATION ENGINE ENDPOINTS
// ==========================================

// Trigger Modul Ajar KBC AI Generation
app.post(
  '/api/tenant/projects/:id/modul-ajar/generate',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canEditProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin membuat Modul Ajar.',
          code: 'INSUFFICIENT_PROJECT_EDIT_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;

      const {
        materiPokok,
        gayaMengajar,
        modelPembelajaran,
        alokasiWaktu,
        jumlahPertemuan,
        karakteristikKelas,
        catatanKhusus,
        selectedTpCodes,
        expectedProjectUpdatedAt,
      } = req.body;

      if (!materiPokok || typeof materiPokok !== 'string' || materiPokok.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'materiPokok wajib diisi.',
          code: 'INVALID_INPUT',
        });
      }

      const teacherInput = {
        materiPokok: materiPokok.trim(),
        gayaMengajar: (gayaMengajar || 'Project Based').trim(),
        modelPembelajaran: (modelPembelajaran || 'Project-Based Learning (PjBL)').trim(),
        alokasiWaktu: Number(alokasiWaktu) || 6,
        jumlahPertemuan: Number(jumlahPertemuan) || 2,
        karakteristikKelas: (karakteristikKelas || 'Heterogen').trim(),
        catatanKhusus: (catatanKhusus || '').trim(),
        selectedTpCodes: Array.isArray(selectedTpCodes) ? selectedTpCodes : [],
      };

      // 1. Backend Academic Source Mapping & Verification
      const mapping = await academicMappingService.mapAcademicSources(
        projectId,
        req.institutionId!,
        projectAccessUserId,
        teacherInput
      );

      // 2. AI Generation / Fallback Execution
      const genResult = await modulAjarAiService.generateModulAjarKbc(mapping, teacherInput);

      // 3. Save generated record to collection with OCC check
      const record = await modulAjarRepository.createModulAjar(
        projectId,
        req.institutionId!,
        projectAccessUserId,
        teacherInput,
        genResult.content,
        { expectedProjectUpdatedAt }
      );

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'MODUL_AJAR_GENERATED',
        resource: 'ModulAjarKbc',
        details: { projectId, documentId: record.id, source: genResult.source },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({
        success: true,
        data: record,
        source: genResult.source,
        message: genResult.changelog,
      });
    } catch (err: any) {
      console.error('Generate Modul Ajar error:', err);
      if (err.code === 'OCC_CONFLICT' || err.message?.includes('OCC_CONFLICT')) {
        return res.status(409).json({
          success: false,
          error: 'Konflik konkurensi: Data proyek telah diperbarui oleh pengguna lain. Silakan muat ulang.',
          code: 'OCC_CONFLICT',
        });
      }
      if (err.message?.includes('PREREQUISITE_ERROR') || err.message?.includes('INVALID_TP_CODE')) {
        return res.status(400).json({
          success: false,
          error: err.message,
          code: 'PREREQUISITE_FAILED',
        });
      }
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal memproses generasi Modul Ajar KBC.',
      });
    }
  }
);

// Trigger LKPD AI Generation
app.post(
  '/api/tenant/projects/:id/lkpd/generate',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const projectId = req.params.id;
      const existing = await projectRepository.findProjectByIdAndInstitution(projectId, req.institutionId!);

      if (!existing) {
        return res.status(404).json({
          success: false,
          error: 'Proyek tidak ditemukan atau akses ditolak.',
          code: 'PROJECT_NOT_FOUND',
        });
      }

      const isOwner = existing.userId === req.user!.id;
      if (!canEditProject(req.membership!.role, isOwner)) {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: Anda tidak memiliki izin membuat LKPD.',
          code: 'INSUFFICIENT_PROJECT_EDIT_PERMISSION',
        });
      }

      const projectAccessUserId = isOwner ? req.user!.id : undefined;

      const { mode, sourceModuleId, materiPokok, teacherInput, expectedProjectUpdatedAt } = req.body;

      if (!materiPokok || typeof materiPokok !== 'string' || materiPokok.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'materiPokok wajib diisi.',
          code: 'INVALID_INPUT',
        });
      }

      const lkpdMode: 'FROM_MODULE' | 'FROM_ACADEMIC_DATA' =
        mode === 'FROM_MODULE' ? 'FROM_MODULE' : 'FROM_ACADEMIC_DATA';

      let targetModuleRecord: any = null;
      if (lkpdMode === 'FROM_MODULE') {
        if (!sourceModuleId) {
          return res.status(400).json({
            success: false,
            error: "Mode 'FROM_MODULE' memerlukan 'sourceModuleId' Modul Ajar acuan.",
            code: 'MISSING_SOURCE_MODULE_ID',
          });
        }
        targetModuleRecord = await modulAjarRepository.getModulAjarById(
          projectId,
          sourceModuleId,
          req.institutionId!,
          projectAccessUserId
        );
        if (!targetModuleRecord) {
          return res.status(404).json({
            success: false,
            error: `Modul Ajar acuan ID '${sourceModuleId}' tidak ditemukan pada proyek ini.`,
            code: 'SOURCE_MODULE_NOT_FOUND',
          });
        }
      }

      const inputForMapping = {
        materiPokok: materiPokok.trim(),
        gayaMengajar: teacherInput?.gayaMengajar || 'Project Based',
        alokasiWaktu: Number(teacherInput?.alokasiWaktu) || 6,
        jumlahPertemuan: Number(teacherInput?.jumlahPertemuan) || 2,
        selectedTpCodes: Array.isArray(teacherInput?.selectedTpCodes) ? teacherInput.selectedTpCodes : [],
      };

      // 1. Backend Academic Source Mapping
      const mapping = await academicMappingService.mapAcademicSources(
        projectId,
        req.institutionId!,
        projectAccessUserId,
        inputForMapping
      );

      // 2. AI Generation / Fallback Execution
      const genResult = await modulAjarAiService.generateLkpd(mapping, {
        mode: lkpdMode,
        materiPokok: materiPokok.trim(),
        sourceModule: targetModuleRecord,
      });

      // 3. Save generated LKPD record to collection with OCC check
      const record = await modulAjarRepository.createLkpd(
        projectId,
        req.institutionId!,
        projectAccessUserId,
        {
          mode: lkpdMode,
          sourceModuleId: lkpdMode === 'FROM_MODULE' ? sourceModuleId : undefined,
          materiPokok: materiPokok.trim(),
          teacherInput: inputForMapping,
        },
        genResult.content,
        { expectedProjectUpdatedAt }
      );

      await auditLogRepository.logAction({
        userId: req.user!.id,
        institutionId: req.institutionId!,
        action: 'LKPD_GENERATED',
        resource: 'Lkpd',
        details: { projectId, documentId: record.id, mode: lkpdMode, source: genResult.source },
        ipAddress: getClientIp(req),
      });

      return res.status(201).json({
        success: true,
        data: record,
        source: genResult.source,
        message: genResult.changelog,
      });
    } catch (err: any) {
      console.error('Generate LKPD error:', err);
      if (err.code === 'OCC_CONFLICT' || err.message?.includes('OCC_CONFLICT')) {
        return res.status(409).json({
          success: false,
          error: 'Konflik konkurensi: Data proyek telah diperbarui oleh pengguna lain.',
          code: 'OCC_CONFLICT',
        });
      }
      if (err.message?.includes('PREREQUISITE_ERROR') || err.message?.includes('INVALID_TP_CODE')) {
        return res.status(400).json({
          success: false,
          error: err.message,
          code: 'PREREQUISITE_FAILED',
        });
      }
      return res.status(500).json({
        success: false,
        error: err.message || 'Gagal memproses generasi LKPD.',
      });
    }
  }
);

// Legacy Data Migration Preview & Planning Endpoints (Phase 3C)
app.post(
  '/api/tenant/migration/preview',
  requireAuth,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { rawProjects } = req.body;
      if (!Array.isArray(rawProjects)) {
        return res.status(400).json({ success: false, error: 'rawProjects wajib berupa array.' });
      }

      const tenantCtx = await authService.getUserTenantContext(req.user!.id, req.institutionId!);
      const currentInst = tenantCtx.currentInstitution;
      if (!currentInst) {
        return res.status(400).json({ success: false, error: 'Institusi aktif tidak ditemukan.' });
      }

      const existingProjects = await projectRepository.listProjectsByInstitution(req.institutionId!);
      const existingNames = existingProjects.map((p) => p.name);

      const report = legacyMigrationService.previewLegacyProjects({
        rawProjects,
        currentUser: req.user!,
        currentInstitution: {
          id: currentInst.id,
          namaResmi: currentInst.namaResmi,
          namaSingkat: currentInst.namaSingkat,
          npsn: currentInst.npsn,
        },
        existingTenantProjectNames: existingNames,
      });

      return res.json({ success: true, report });
    } catch (err: any) {
      console.error('Migration preview error:', err);
      return res.status(500).json({ success: false, error: 'Gagal memproses pratinjau migrasi data' });
    }
  }
);

app.post(
  '/api/tenant/migration/plan',
  requireAuth,
  requireCsrf,
  requireInstitutionMembership,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { report, userApprovalConfirmed } = req.body;
      if (!report) {
        return res.status(400).json({ success: false, error: 'Laporan pratinjau migrasi wajib disertakan.' });
      }

      const result = legacyMigrationService.planMigrationExecution(report, Boolean(userApprovalConfirmed));
      return res.json({ success: true, result });
    } catch (err: any) {
      console.error('Migration plan error:', err);
      return res.status(500).json({ success: false, error: 'Gagal menyusun rencana migrasi' });
    }
  }
);

// Deprecated endpoint: Insecure user-switching is strictly disabled in production
app.post('/api/tenant/switch-user', (_req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    error: 'Akses ditolak: Simulasi pergantian pengguna dinonaktifkan dalam mode keamanan autentikasi.',
    code: 'INSECURE_ENDPOINT_DISABLED',
  });
});



function generateDeterministicGeneratorDocument(
  request: ValidatedGeneratorRequest
): AnyDocumentContent {
  const { docType, masterInput, previousDocs } = request;

  switch (docType) {
    case 'ACP':
      return generateDeterministicACP(masterInput);
    case 'TP':
      return generateDeterministicTP(
        masterInput,
        previousDocs.ACP?.content as AcpData
      );
    case 'ATP':
      return generateDeterministicATP(
        masterInput,
        previousDocs.TP?.content as TpData
      );
    case 'PROTA':
      return generateDeterministicPROTA(
        masterInput,
        previousDocs.ATP?.content as AtpData
      );
    case 'PROSEM':
      return generateDeterministicPROSEM(
        masterInput,
        previousDocs.PROTA?.content as ProtaData
      );
    case 'KKTP':
      return generateDeterministicKKTP(
        masterInput,
        previousDocs.TP?.content as TpData
      );
    default:
      throw new Error('Jenis dokumen generator tidak dikenal.');
  }
}

// Generate document endpoint (Stateless Utility Endpoint with Input Validation & Size Limits)
app.post('/api/generate-document', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  let quotaConsumed = false;
  let docTypeForAudit: string | undefined;

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        code: 'AUTHENTICATION_REQUIRED',
        error: 'Sesi autentikasi tidak valid. Silakan login kembali.',
      });
    }

    const quotaContext = {
      userId,
      clientIp: getClientIp(req),
    };

    try {
      await generatorQuotaService.consumeIpQuota(quotaContext);
    } catch (error) {
      if (error instanceof GeneratorQuotaServiceError) {
        if (error.retryAfterSeconds) {
          res.setHeader('Retry-After', String(error.retryAfterSeconds));
        }

        return res.status(error.statusCode).json({
          success: false,
          code: error.code,
          error: error.code === 'IP_RATE_LIMITED'
            ? 'Batas permintaan dari jaringan Anda telah tercapai. Silakan coba kembali nanti.'
            : 'Layanan pembatasan penggunaan sementara tidak tersedia.',
        });
      }

      return res.status(503).json({
        success: false,
        code: 'QUOTA_SERVICE_UNAVAILABLE',
        error: 'Layanan pembatasan penggunaan sementara tidak tersedia.',
      });
    }

    const validation = validateGeneratorRequest(req.body);

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        code: validation.code,
        error: validation.error,
      });
    }

    const { docType, masterInput, previousDocs } = validation.data;
    docTypeForAudit = docType;

    // Typed references: prerequisite validation guarantees the document types.
    const previousTp = previousDocs.TP?.content as TpData | null | undefined;
    const previousAtp = previousDocs.ATP?.content as AtpData | null | undefined;
    const previousProta = previousDocs.PROTA?.content as ProtaData | null | undefined;

    const generated = await generatorQuotaService.runWithUserQuota(
      quotaContext,
      async () => {
        quotaConsumed = true;

        const createDeterministicFallback = () => {
          const fallbackOutput = generateDeterministicGeneratorDocument(validation.data);
          const fallbackValidation = validateGeneratorOutput(docType, fallbackOutput);

          if (!fallbackValidation.valid) {
            throw new Error('DETERMINISTIC_FALLBACK_INVALID');
          }

          return {
            data: fallbackValidation.data,
            source: 'algorithmic_engine' as const,
          };
        };

        if (!aiClient) {
          return createDeterministicFallback();
        }

    // Prepare system instructions and prompt based on docType
    const systemPrompt = `Anda adalah pakar kurikulum madrasah Kementerian Agama RI, Kurikulum Merdeka, dan Kurikulum Berbasis Cinta (KBC) serta Profil Pelajar Rahmatan lil 'Alamin (PPRA).
Tugas Anda adalah menghasilkan dokumen administrasi guru madrasah terstruktur dalam format JSON murni.
Pastikan tidak mengarang data di luar konteks master input guru. Seluruh rumusan Tujuan Pembelajaran harus menggunakan Kata Kerja Operasional (KKO) Taksonomi Bloom revisi yang terukur.
Integrasikan Panca Cinta (Cinta Allah & Rasul, Cinta Ilmu, Cinta Diri & Sesama, Cinta Lingkungan, Cinta Tanah Air) dan 10 Nilai PPRA secara relevan dan kontekstual.
Keluarkan HANYA JSON valid tanpa blok markdown tambahan.`;

    let userPrompt = '';

    if (docType === 'ACP') {
      userPrompt = `Susun Analisis Capaian Pembelajaran (ACP) untuk:
Madrasah: ${masterInput.namaMadrasah}
Mata Pelajaran: ${masterInput.mataPelajaran} (${masterInput.fase} / ${masterInput.kelas})
Alokasi Waktu: ${masterInput.alokasiWaktuTotal} JP
Rasional Mapel: ${masterInput.rasionalMapel}
CP Umum: ${masterInput.cpUmum}
Elemen CP: ${JSON.stringify(masterInput.elemenCP)}
Catatan KBC & PPRA: ${masterInput.catatanKBC}

Format JSON yang dibutuhkan:
{
  "identitas": {
    "satuanPendidikan": "${masterInput.namaMadrasah}",
    "kemenagYayasan": "${masterInput.kemenagOrYayasan}",
    "mataPelajaran": "${masterInput.mataPelajaran}",
    "faseKelas": "${masterInput.fase} / ${masterInput.kelas}",
    "tahunPelajaran": "${masterInput.tahunPelajaran}",
    "alokasiWaktu": "${masterInput.alokasiWaktuTotal} JP",
    "penyusun": "${masterInput.namaGuru} (NIP. ${masterInput.nipGuru})",
    "kepalaMadrasah": "${masterInput.namaKepala} (NIP. ${masterInput.nipKepala})",
    "pengesahan": "${masterInput.kotaTandaTangan}, ${masterInput.tanggalTandaTangan}"
  },
  "rasionalMapel": "...",
  "cpUmum": "...",
  "analisisElemen": [
    {
      "kodeElemen": "...",
      "namaElemen": "...",
      "kalimatCP": "...",
      "kompetensi": ["..."],
      "materiEsensial": ["..."],
      "kedalamanKeluasan": "..."
    }
  ],
  "integrasiKBCPPRA": {
    "kbcApplication": "...",
    "ppraApplication": "..."
  },
  "rekomendasiPembelajaran": "...",
  "rekomendasiAsesmen": "..."
}`;
    } else if (docType === 'TP') {
      userPrompt = `Susun dokumen Tujuan Pembelajaran (TP) untuk ${masterInput.mataPelajaran} Fase ${masterInput.fase}.
Total JP: ${masterInput.alokasiWaktuTotal} JP.
Elemen CP: ${JSON.stringify(masterInput.elemenCP)}
Materi Pokok: ${masterInput.materiPokok}
Data ACP terdahulu: ${JSON.stringify(previousDocs?.ACP?.content || {})}

Susun 8-10 Tujuan Pembelajaran berurutan dari dasar ke kompleks dengan total JP tepat ${masterInput.alokasiWaktuTotal} JP.
Format JSON:
{
  "identitas": { ... },
  "pemetaanElemen": [
    { "elemen": "...", "ringkasanCP": "...", "jumlahTP": 2 }
  ],
  "listTP": [
    {
      "no": 1,
      "kodeTP": "TP.7.1",
      "elemen": "...",
      "rumusanTP": "...",
      "kompetensi": "...",
      "materiPokok": "...",
      "integrasiPancaCinta": "...",
      "integrasiPPRA": "...",
      "alokasiJP": 6
    }
  ],
  "totalJP": ${masterInput.alokasiWaktuTotal}
}`;
    } else if (docType === 'ATP') {
      userPrompt = `Susun Alur Tujuan Pembelajaran (ATP) berdasarkan TP berikut:
TP List: ${JSON.stringify(previousTp?.listTP || [])}
Total JP: ${masterInput.alokasiWaktuTotal} JP.
Bagi alur TP ke dalam 4 tahapan logis (Tahap 1 & 2 di Semester 1, Tahap 3 & 4 di Semester 2).

Format JSON:
{
  "identitas": { ... },
  "visualDiagram": [
    {
      "tahap": "Tahap 1: ...",
      "semester": "Semester 1",
      "deskripsiAlur": "...",
      "tpCodes": ["TP.7.1", "TP.7.2"]
    }
  ],
  "listATP": [
    {
      "no": 1,
      "alurUrutan": 1,
      "kodeTP": "TP.7.1",
      "elemen": "...",
      "rumusanTP": "...",
      "materiPokok": "...",
      "aspekKompetensi": "...",
      "integrasiKbcPpra": "...",
      "alokasiJP": 6,
      "semester": "Semester 1 (Ganjil)"
    }
  ],
  "totalJPSemester1": 36,
  "totalJPSemester2": 36,
  "totalJPTahunan": ${masterInput.alokasiWaktuTotal}
}`;
    } else if (docType === 'PROTA') {
      userPrompt = `Susun Program Tahunan (PROTA) berdasarkan ATP dan Kalender Pendidikan:
Kalender Sem 1: ${JSON.stringify(masterInput.kalenderSemester1)}
Kalender Sem 2: ${JSON.stringify(masterInput.kalenderSemester2)}
ATP List: ${JSON.stringify(previousAtp?.listATP || [])}
Target JP Total: ${masterInput.alokasiWaktuTotal} JP.

Format JSON:
{
  "identitas": { ... },
  "distribusiMinggu": {
    "semesterGanjil": { ... },
    "semesterGenap": { ... }
  },
  "rencanaAlokasi": [
    {
      "no": 1,
      "semester": "Ganjil",
      "kodeTP": "TP.7.1",
      "tujuanDanMateri": "...",
      "elemenCP": "...",
      "integrasiKBCPPRA": "...",
      "alokasiJP": 6
    }
  ],
  "rekapitulasi": {
    "subtotalGanjilJP": 36,
    "subtotalGenapJP": 36,
    "totalTahunJP": ${masterInput.alokasiWaktuTotal},
    "alokasiTargetJP": ${masterInput.alokasiWaktuTotal},
    "keteranganStatus": "Sesuai dengan Alokasi Kurikulum (100% Match)"
  }
}`;
    } else if (docType === 'PROSEM') {
      userPrompt = `Susun Program Semester (PROSEM) berdasarkan PROTA:
PROTA Rencana Alokasi: ${JSON.stringify(previousProta?.rencanaAlokasi || [])}
Kalender Sem 1: ${JSON.stringify(masterInput.kalenderSemester1)}
Kalender Sem 2: ${JSON.stringify(masterInput.kalenderSemester2)}
Setiap bulan memiliki 5 minggu (W1 s/d W5). Distribusikan 2 JP per minggu efektif. Berikan tanda 0 untuk minggu tidak efektif.

Format JSON:
{
  "identitas": { ... },
  "legenda": [
    { "simbol": "2", "keterangan": "Pembelajaran Aktif (2 JP)", "warna": "bg-teal-100 text-teal-800" },
    { "simbol": "ATS", "keterangan": "Asesmen Tengah Semester", "warna": "bg-amber-100 text-amber-800" }
  ],
  "semesterGanjil": {
    "semesterName": "Semester Ganjil",
    "months": ["Juli", "Agustus", "September", "Oktober", "November", "Desember"],
    "items": [
      {
        "no": 1,
        "kodeTP": "TP.7.1",
        "tujuanDanMateri": "...",
        "alokasiJP": 6,
        "integrasiKbcPpra": "...",
        "distribusiBulan": {
          "Juli": [0, 0, 2, 2, 2],
          "Agustus": [0, 0, 0, 0, 0],
          "September": [0, 0, 0, 0, 0],
          "Oktober": [0, 0, 0, 0, 0],
          "November": [0, 0, 0, 0, 0],
          "Desember": [0, 0, 0, 0, 0]
        }
      }
    ],
    "totalJPSemester": 36,
    "mingguEfektifCount": 18
  },
  "semesterGenap": {
    "semesterName": "Semester Genap",
    "months": ["Januari", "Februari", "Maret", "April", "Mei", "Juni"],
    "items": [ ... ],
    "totalJPSemester": 36,
    "mingguEfektifCount": 18
  },
  "rekapitulasi": { "ganjilJP": 36, "genapJP": 36, "totalJP": 72 }
}`;
    } else if (docType === 'KKTP') {
      userPrompt = `Susun Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) berdasarkan daftar TP:
List TP: ${JSON.stringify(previousTp?.listTP || [])}
Karakteristik & Asesmen: ${masterInput.strategiAsesmen}

Format JSON:
{
  "identitas": { ... },
  "deskripsiLevelUmum": [
    { "interval": "0 - 69%", "kategori": "Perlu Bimbingan", "keterangan": "..." },
    { "interval": "70 - 79%", "kategori": "Cukup", "keterangan": "..." },
    { "interval": "80 - 89%", "kategori": "Baik", "keterangan": "..." },
    { "interval": "90 - 100%", "kategori": "Sangat Baik (Mahir)", "keterangan": "..." }
  ],
  "listRubrik": [
    {
      "kodeTP": "TP.7.1",
      "rumusanTP": "...",
      "indikatorKetercapaian": ["..."],
      "kriteria": {
        "perluBimbingan": "...",
        "cukup": "...",
        "baik": "...",
        "mahir": "..."
      },
      "buktiAsesmen": "...",
      "rencanaTindakLanjut": {
        "remedial": "...",
        "pengayaan": "..."
      }
    }
  ],
  "strategiAsesmen": "${masterInput.strategiAsesmen}",
  "tindakLanjutUmum": "..."
}`;
    }

        try {
          const response = await aiClient.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: userPrompt,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              httpOptions: {
                timeout: 60_000,
              },
            },
          });

          const text = response.text || '{}';
          let parsedData: unknown;

          try {
            parsedData = JSON.parse(text);
          } catch {
            const jsonMatch = text.match(/\{[\s\S]*\}/);

            if (!jsonMatch) {
              throw new Error('GEMINI_INVALID_JSON');
            }

            parsedData = JSON.parse(jsonMatch[0]);
          }

          const outputValidation = validateGeneratorOutput(docType, parsedData);

          if (!outputValidation.valid) {
            throw new Error('GEMINI_OUTPUT_VALIDATION_FAILED');
          }

          return {
            data: outputValidation.data,
            source: 'gemini_ai' as const,
          };
        } catch (geminiError) {
          console.warn('Generator Gemini failed; using deterministic fallback', {
            requestId,
            docType,
            errorName: geminiError instanceof Error ? geminiError.name : 'UnknownError',
          });

          return createDeterministicFallback();
        }
      }
    );

    await auditLogRepository.logAction({
      userId,
      action: 'GENERATOR_DOCUMENT_CREATED',
      resource: 'GeneratorDocument',
      details: {
        requestId,
        docType,
        source: generated.source,
        status: 'SUCCESS',
        durationMs: Date.now() - startedAt,
        quotaConsumed: true,
      },
    });

    return res.json({
      success: true,
      data: generated.data,
      source: generated.source,
      requestId,
    });
  } catch (error: unknown) {
    const durationMs = Date.now() - startedAt;

    if (error instanceof GeneratorQuotaServiceError) {
      if (error.retryAfterSeconds) {
        res.setHeader('Retry-After', String(error.retryAfterSeconds));
      }

      const safeMessages: Record<string, string> = {
        USER_QUOTA_EXCEEDED: 'Kuota pembuatan dokumen Anda telah tercapai.',
        GENERATION_IN_PROGRESS: 'Anda masih memiliki proses pembuatan dokumen yang berjalan.',
        QUOTA_SERVICE_UNAVAILABLE: 'Layanan pembatasan penggunaan sementara tidak tersedia.',
      };

      return res.status(error.statusCode).json({
        success: false,
        code: error.code,
        error: safeMessages[error.code] || 'Permintaan generator tidak dapat diproses.',
        requestId,
      });
    }

    if (quotaConsumed && docTypeForAudit) {
      await auditLogRepository.logAction({
        userId: req.user?.id,
        action: 'GENERATOR_DOCUMENT_FAILED',
        resource: 'GeneratorDocument',
        details: {
          requestId,
          docType: docTypeForAudit,
          status: 'FAILED',
          durationMs,
          quotaConsumed: true,
          errorCode: 'GENERATOR_FAILED',
        },
      });
    }

    console.error('Generator document request failed', {
      requestId,
      docType: docTypeForAudit,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });

    return res.status(500).json({
      success: false,
      code: 'GENERATOR_FAILED',
      error: 'Dokumen gagal dibuat. Silakan coba kembali.',
      requestId,
    });
  }
});

// ==========================================
// PLATFORM ADMIN CONSOLE ENDPOINTS (PHASE 2A)
// ==========================================

import { requireSuperAdmin } from './src/middleware/authMiddleware.js';
import { platformAdminService } from './src/services/platformAdminService.js';


// ==========================================
// INSTITUTION ONBOARDING - PLATFORM REVIEW API
// SUPER ADMIN ONLY
// ==========================================

// List pending institution registration requests.
app.get(
  '/api/platform/institution-requests',
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const pagination = validatePaginationQuery(
        req.query as Record<string, unknown>
      );

      if (!pagination.valid) {
        return res.status(400).json({
          success: false,
          error: pagination.error,
        });
      }

      const requests = await institutionOnboardingService.listPendingRequests(
        pagination.data
      );

      return res.json({
        success: true,
        requests,
        pagination: pagination.data,
      });
    } catch (err: unknown) {
      console.error('Platform list institution requests error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengambil daftar pengajuan institusi.',
      });
    }
  }
);

// Get one institution request detail.
app.get(
  '/api/platform/institution-requests/:id',
  requireAuth,
  requireSuperAdmin,
  async (req: Request, res: Response) => {
    try {
      const idValidation = validateInstitutionRequestId(req.params.id);

      if (!idValidation.valid) {
        return res.status(400).json({
          success: false,
          error: idValidation.error,
        });
      }

      const request = await institutionOnboardingService.getRequestDetail(
        idValidation.data
      );

      return res.json({ success: true, request });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message === 'INSTITUTION_REQUEST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Pengajuan institusi tidak ditemukan.',
          code: message,
        });
      }

      console.error('Platform institution request detail error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal mengambil detail pengajuan institusi.',
      });
    }
  }
);

// Approve a pending request and assign its requester as SCHOOL_ADMIN.
app.post(
  '/api/platform/institution-requests/:id/approve',
  requireAuth,
  requireCsrf,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idValidation = validateInstitutionRequestId(req.params.id);

      if (!idValidation.valid) {
        return res.status(400).json({
          success: false,
          error: idValidation.error,
        });
      }

      if (
        req.body !== undefined &&
        (!isPlainObject(req.body) || Object.keys(req.body).length !== 0)
      ) {
        return res.status(400).json({
          success: false,
          error: 'Endpoint persetujuan tidak menerima field tambahan.',
        });
      }

      const request = await institutionOnboardingService.approveRequest({
        requestId: idValidation.data,
        reviewerUserId: req.user!.id,
        ipAddress: getClientIp(req),
      });

      return res.json({
        success: true,
        request,
        message: 'Pengajuan disetujui dan pemohon ditetapkan sebagai School Admin.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message === 'REVIEWER_NOT_PLATFORM_SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: reviewer harus memiliki hak Platform Super Admin aktif.',
          code: message,
        });
      }

      if (message === 'INSTITUTION_REQUEST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Pengajuan institusi tidak ditemukan.',
          code: message,
        });
      }

      if (
        message === 'INSTITUTION_REQUEST_STATE_CONFLICT' ||
        message === 'INSTITUTION_REQUEST_NOT_PENDING'
      ) {
        return res.status(409).json({
          success: false,
          error: 'Pengajuan tidak lagi berstatus menunggu peninjauan.',
          code: message,
        });
      }

      if (message === 'NPSN_ALREADY_REGISTERED') {
        return res.status(409).json({
          success: false,
          error: 'NPSN sudah terdaftar pada institusi lain.',
          code: message,
        });
      }

      if (message === 'REQUESTER_NOT_ACTIVE') {
        return res.status(409).json({
          success: false,
          error: 'Akun pemohon tidak aktif.',
          code: message,
        });
      }

      if (message === 'REVIEWER_NOT_ACTIVE') {
        return res.status(403).json({
          success: false,
          error: 'Akun reviewer tidak aktif.',
          code: message,
        });
      }

      console.error('Platform approve institution request error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal menyetujui pengajuan institusi.',
      });
    }
  }
);

// Reject a pending request with a mandatory reason.
app.post(
  '/api/platform/institution-requests/:id/reject',
  requireAuth,
  requireCsrf,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const idValidation = validateInstitutionRequestId(req.params.id);

      if (!idValidation.valid) {
        return res.status(400).json({
          success: false,
          error: idValidation.error,
        });
      }

      const bodyValidation = validateInstitutionRequestRejectionBody(req.body);

      if (!bodyValidation.valid) {
        return res.status(400).json({
          success: false,
          error: bodyValidation.error,
        });
      }

      const request = await institutionOnboardingService.rejectRequest({
        requestId: idValidation.data,
        reviewerUserId: req.user!.id,
        rejectionReason: bodyValidation.data.rejectionReason,
        ipAddress: getClientIp(req),
      });

      return res.json({
        success: true,
        request,
        message: 'Pengajuan institusi berhasil ditolak.',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message === 'REVIEWER_NOT_PLATFORM_SUPER_ADMIN') {
        return res.status(403).json({
          success: false,
          error: 'Akses ditolak: reviewer harus memiliki hak Platform Super Admin aktif.',
          code: message,
        });
      }

      if (message === 'INSTITUTION_REQUEST_NOT_FOUND') {
        return res.status(404).json({
          success: false,
          error: 'Pengajuan institusi tidak ditemukan.',
          code: message,
        });
      }

      if (
        message === 'INSTITUTION_REQUEST_STATE_CONFLICT' ||
        message === 'INSTITUTION_REQUEST_NOT_PENDING'
      ) {
        return res.status(409).json({
          success: false,
          error: 'Pengajuan tidak lagi berstatus menunggu peninjauan.',
          code: message,
        });
      }

      if (message === 'REVIEWER_NOT_ACTIVE') {
        return res.status(403).json({
          success: false,
          error: 'Akun reviewer tidak aktif.',
          code: message,
        });
      }

      if (message.startsWith('VALIDATION_ERROR:')) {
        return res.status(400).json({
          success: false,
          error: message.replace('VALIDATION_ERROR:', '').trim(),
          code: 'VALIDATION_ERROR',
        });
      }

      console.error('Platform reject institution request error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal menolak pengajuan institusi.',
      });
    }
  }
);

// 1. Platform Global Stats
app.get('/api/platform/stats', requireAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const stats = await platformAdminService.getPlatformStats();
    return res.json({ success: true, stats });
  } catch (err: any) {
    console.error('Platform stats error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memuat statistik platform' });
  }
});

// 2. List Institutions (Global)
app.get('/api/platform/institutions', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || '';

    const result = await platformAdminService.listInstitutions({ limit, offset, search });
    return res.json({ success: true, institutions: result.institutions, pagination: { total: result.total, limit: result.limit, offset: result.offset } });
  } catch (err: any) {
    console.error('Platform list institutions error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar institusi platform' });
  }
});

// 3. Create Institution - strict allowlist and mandatory initial School Admin.
app.post(
  '/api/platform/institutions',
  requireAuth,
  requireCsrf,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({
          success: false,
          error: 'Format data institusi tidak valid.',
        });
      }

      const body = req.body;
      const allowedKeys = new Set([
        'npsn',
        'namaResmi',
        'namaSingkat',
        'jenjang',
        'jenisInstitusi',
        'kementerianDinas',
        'alamatLengkap',
        'kabupatenKota',
        'provinsi',
        'telepon',
        'email',
        'website',
        'namaKepala',
        'nipKepala',
        'kotaTandaTangan',
        'initialAdminUserId',
      ]);

      if (Object.keys(body).some((key) => !allowedKeys.has(key))) {
        return res.status(400).json({
          success: false,
          error: 'Terdapat field pembuatan institusi yang tidak diizinkan.',
        });
      }

      const initialAdminUserId = body.initialAdminUserId;

      if (
        typeof initialAdminUserId !== 'string' ||
        initialAdminUserId.trim().length === 0 ||
        initialAdminUserId.trim().length > 36
      ) {
        return res.status(400).json({
          success: false,
          error: 'Pengguna aktif untuk School Admin pertama wajib dipilih.',
        });
      }

      const institutionBody: Record<string, unknown> = { ...body };
      delete institutionBody.initialAdminUserId;
      delete institutionBody.namaKepala;
      delete institutionBody.nipKepala;
      delete institutionBody.kotaTandaTangan;

      const validation = validateInstitutionRequestBody(institutionBody);

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      const namaKepalaResult = readOptionalText(
        body,
        'namaKepala',
        'Nama kepala institusi',
        255
      );
      if (!namaKepalaResult.valid) {
        return res.status(400).json({
          success: false,
          error: namaKepalaResult.error,
        });
      }

      const nipKepalaResult = readOptionalText(
        body,
        'nipKepala',
        'NIP kepala institusi',
        30
      );
      if (!nipKepalaResult.valid) {
        return res.status(400).json({
          success: false,
          error: nipKepalaResult.error,
        });
      }

      const kotaTandaTanganResult = readOptionalText(
        body,
        'kotaTandaTangan',
        'Kota tanda tangan',
        100
      );
      if (!kotaTandaTanganResult.valid) {
        return res.status(400).json({
          success: false,
          error: kotaTandaTanganResult.error,
        });
      }

      const data = validation.data;

      const created = await platformAdminService.createInstitution({
        npsn: data.npsn,
        namaResmi: data.namaResmi,
        namaSingkat: data.namaSingkat ?? undefined,
        jenjang: data.jenjang,
        jenisInstitusi: data.jenisInstitusi ?? undefined,
        kementerianDinas: data.kementerianDinas ?? undefined,
        alamatLengkap: data.alamatLengkap ?? undefined,
        kabupatenKota: data.kabupatenKota,
        provinsi: data.provinsi,
        telepon: data.telepon ?? undefined,
        email: data.email ?? undefined,
        website: data.website ?? undefined,
        namaKepala: namaKepalaResult.data ?? undefined,
        nipKepala: nipKepalaResult.data ?? undefined,
        kotaTandaTangan: kotaTandaTanganResult.data ?? undefined,
        initialAdminUserId: initialAdminUserId.trim(),
        actorUserId: req.user!.id,
        ipAddress: getClientIp(req),
      });

      const safeInstitution = {
        id: created.id,
        npsn: created.npsn,
        namaResmi: created.namaResmi,
        namaSingkat: created.namaSingkat,
        jenjang: created.jenjang,
        jenisInstitusi: created.jenisInstitusi,
        kementerianDinas: created.kementerianDinas,
        alamatLengkap: created.alamatLengkap,
        kabupatenKota: created.kabupatenKota,
        provinsi: created.provinsi,
        namaKepala: created.namaKepala,
        nipKepala: created.nipKepala,
        kotaTandaTangan: created.kotaTandaTangan,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };

      return res.status(201).json({
        success: true,
        institution: safeInstitution,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';

      if (message === 'NPSN_ALREADY_REGISTERED') {
        return res.status(409).json({
          success: false,
          error: 'NPSN sudah terdaftar.',
          code: message,
        });
      }

      const prismaError = err as {
        code?: unknown;
        meta?: { target?: unknown };
      };

      const uniqueTarget = prismaError.meta?.target;
      const isNpsnUniqueConflict =
        prismaError.code === 'P2002' &&
        (
          (Array.isArray(uniqueTarget) &&
            uniqueTarget.includes('npsn')) ||
          (typeof uniqueTarget === 'string' &&
            uniqueTarget.toLowerCase().includes('npsn'))
        );

      if (isNpsnUniqueConflict) {
        return res.status(409).json({
          success: false,
          error: 'NPSN sudah terdaftar.',
          code: 'NPSN_ALREADY_REGISTERED',
        });
      }

      if (message === 'INITIAL_ADMIN_NOT_ACTIVE') {
        return res.status(409).json({
          success: false,
          error: 'Pengguna yang dipilih sebagai School Admin tidak aktif atau tidak ditemukan.',
          code: message,
        });
      }

      if (
        message === 'PLATFORM_ACTOR_NOT_ACTIVE' ||
        message === 'SUPER_ADMIN_REQUIRED'
      ) {
        return res.status(403).json({
          success: false,
          error: 'Aktor tidak memiliki otorisasi untuk membuat institusi.',
          code: message,
        });
      }

      console.error('Platform create institution error:', err);
      return res.status(500).json({
        success: false,
        error: 'Gagal membuat institusi baru.',
      });
    }
  }
);

// 4. Get Institution Detail
app.get('/api/platform/institutions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('./src/db/prisma.js');
    const id = req.params.id;
    const institution = await prisma.institution.findUnique({
      where: { id },
      select: {
        id: true,
        npsn: true,
        namaResmi: true,
        namaSingkat: true,
        jenjang: true,
        jenisInstitusi: true,
        kementerianDinas: true,
        alamatLengkap: true,
        kelurahanDesa: true,
        kecamatan: true,
        kabupatenKota: true,
        provinsi: true,
        kodePos: true,
        telepon: true,
        email: true,
        website: true,
        logoUrl: true,
        namaKepala: true,
        nipKepala: true,
        kotaTandaTangan: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            user: {
              select: {
                id: true,
                namaLengkap: true,
                email: true,
                nip: true,
                nuptk: true,
              },
            },
          },
        },
        _count: {
          select: { projects: true },
        },
      },
    });

    if (!institution) {
      return res.status(404).json({ success: false, error: 'Institusi tidak ditemukan' });
    }

    return res.json({ success: true, institution });
  } catch (err: any) {
    console.error('Platform get institution detail error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memuat detail institusi' });
  }
});

// 5. Update Institution
app.put('/api/platform/institutions/:id', requireAuth, requireCsrf, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id;
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ success: false, error: 'Format data institusi tidak valid.' });
    }

    const fieldRules = {
      namaResmi: { maxLength: 255, nullable: false },
      namaSingkat: { maxLength: 100, nullable: false },
      jenjang: { maxLength: 20, nullable: false },
      alamatLengkap: { maxLength: 10000, nullable: false },
      namaKepala: { maxLength: 255, nullable: true },
      nipKepala: { maxLength: 30, nullable: true },
      kotaTandaTangan: { maxLength: 100, nullable: true },
      telepon: { maxLength: 50, nullable: true },
      email: { maxLength: 255, nullable: true },
      website: { maxLength: 255, nullable: true },
    } as const;

    const keys = Object.keys(body);
    if (keys.length === 0) {
      return res.status(400).json({ success: false, error: 'Tidak ada data yang diperbarui.' });
    }

    const updateData: Record<string, string | null> = {};

    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(fieldRules, key)) {
        return res.status(400).json({
          success: false,
          error: `Field '${key}' tidak diizinkan untuk diperbarui.`,
        });
      }

      const rule = fieldRules[key as keyof typeof fieldRules];
      const value = body[key];

      if (value === null && rule.nullable) {
        updateData[key] = null;
        continue;
      }

      if (typeof value !== 'string') {
        return res.status(400).json({
          success: false,
          error: `Field '${key}' harus berupa teks${rule.nullable ? ' atau null' : ''}.`,
        });
      }

      const normalized = value.trim();

      if (!rule.nullable && normalized.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Field '${key}' tidak boleh kosong.`,
        });
      }

      if (normalized.length > rule.maxLength) {
        return res.status(400).json({
          success: false,
          error: `Field '${key}' melebihi batas ${rule.maxLength} karakter.`,
        });
      }

      if (key === 'email' && normalized !== '' &&
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return res.status(400).json({
          success: false,
          error: 'Format email institusi tidak valid.',
        });
      }

      updateData[key] = normalized === '' && rule.nullable ? null : normalized;
    }

    const updated = await platformAdminService.updateInstitution(
      id,
      updateData as Parameters<typeof platformAdminService.updateInstitution>[1],
      req.user!.id,
      getClientIp(req)
    );

    const safeInstitution = {
      id: updated.id,
      npsn: updated.npsn,
      namaResmi: updated.namaResmi,
      namaSingkat: updated.namaSingkat,
      jenjang: updated.jenjang,
      jenisInstitusi: updated.jenisInstitusi,
      kementerianDinas: updated.kementerianDinas,
      alamatLengkap: updated.alamatLengkap,
      kabupatenKota: updated.kabupatenKota,
      provinsi: updated.provinsi,
      telepon: updated.telepon,
      email: updated.email,
      website: updated.website,
      namaKepala: updated.namaKepala,
      nipKepala: updated.nipKepala,
      kotaTandaTangan: updated.kotaTandaTangan,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    return res.json({
      success: true,
      institution: safeInstitution,
    });
  } catch (err: any) {
    console.error('Platform update institution error:', err);

    if (err instanceof Error && err.message === 'Institusi tidak ditemukan.') {
      return res.status(404).json({ success: false, error: 'Institusi tidak ditemukan.' });
    }

    return res.status(500).json({
      success: false,
      error: 'Gagal memperbarui institusi.',
    });
  }
});

// 6. List Users (Global)
app.get('/api/platform/users', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = parseInt(req.query.offset as string) || 0;
    const search = (req.query.search as string) || '';

    const result = await platformAdminService.listUsers({ limit, offset, search });
    return res.json({ success: true, users: result.users, pagination: { total: result.total, limit: result.limit, offset: result.offset } });
  } catch (err: any) {
    console.error('Platform list users error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memuat direktori pengguna platform' });
  }
});

// 7. Get User Detail
app.get('/api/platform/users/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('./src/db/prisma.js');
    const id = req.params.id;
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        namaLengkap: true,
        gelarDepan: true,
        gelarBelakang: true,
        nip: true,
        nuptk: true,
        nomorTelepon: true,
        fotoProfilUrl: true,
        preferensiMataPelajaran: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            id: true,
            role: true,
            status: true,
            joinedAt: true,
            institution: {
              select: {
                id: true,
                namaResmi: true,
                namaSingkat: true,
                npsn: true,
                kabupatenKota: true,
                provinsi: true,
              },
            },
          },
        },
        _count: {
          select: { projects: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
    }

    return res.json({ success: true, user });
  } catch (err: any) {
    console.error('Platform get user detail error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memuat profil pengguna' });
  }
});

// 8. Update User Status (Active / Inactive)
app.post('/api/platform/users/:id/status', requireAuth, requireCsrf, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ success: false, error: 'Parameter isActive wajib berupa boolean.' });
    }

    const safeUser = await platformAdminService.updateUserStatus(id, isActive, req.user!.id, getClientIp(req));
    return res.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error('Platform update user status error:', err);
    return res.status(400).json({ success: false, error: err.message || 'Gagal memperbarui status akun pengguna' });
  }
});

// 9. List Memberships (Global)
app.get('/api/platform/memberships', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 25;
    const offset = parseInt(req.query.offset as string) || 0;
    const institutionId = req.query.institutionId as string | undefined;
    const role = req.query.role as any;
    const status = req.query.status as any;

    const result = await platformAdminService.listMemberships({ limit, offset, institutionId, role, status });
    return res.json({ success: true, memberships: result.memberships, pagination: { total: result.total, limit: result.limit, offset: result.offset } });
  } catch (err: any) {
    console.error('Platform list memberships error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memuat daftar keanggotaan platform' });
  }
});

// 10. Update Membership Role & Status (Platform-wide)
app.post('/api/platform/memberships/update-role', requireAuth, requireCsrf, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validation = validateMembershipUpdateBody(req.body, 'userId');

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
      });
    }

    await platformAdminService.updateMembership(
      validation.data.userId,
      validation.data.institutionId,
      validation.data.newRole,
      validation.data.newStatus,
      req.user!.id,
      getClientIp(req)
    );
    return res.json({ success: true, message: 'Keanggotaan berhasil diperbarui.' });
  } catch (err: any) {
    console.error('Platform update membership error:', err);
    return res.status(400).json({ success: false, error: err.message || 'Gagal memperbarui keanggotaan institusi' });
  }
});

// 11. List Audit Logs (Global Platform)
app.get('/api/platform/audit-logs', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 25, 1), 100);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const action = req.query.action as string | undefined;

    const result = await auditLogRepository.listLogs({
      limit,
      offset,
      action,
    });

    return res.json({ success: true, logs: result.logs, total: result.total, limit, offset });
  } catch (err: any) {
    console.error('Platform list audit logs error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memuat log audit platform' });
  }
});


// Generator JSON parser errors: return safe API responses before Vite/static middleware.
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (req.path !== '/api/generate-document') return next(err);

  const error = err && typeof err === 'object'
    ? err as { status?: unknown; statusCode?: unknown; type?: unknown; code?: unknown }
    : {};
  const status = error.status ?? error.statusCode;

  if (status === 413 || error.code === 'GENERATOR_PAYLOAD_TOO_LARGE' || error.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      code: 'GENERATOR_PAYLOAD_TOO_LARGE',
      error: 'Ukuran data permintaan generator melebihi batas 2 MB.',
    });
  }

  if (status === 400 || error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_JSON',
      error: 'Format JSON permintaan tidak valid.',
    });
  }

  return next(err);
});

// Setup Vite middleware in dev or serve static files in production
async function startServer() {
  validateSecurityConfiguration();
  validateGeneratorQuotaSecret();
  const isProd = process.env.NODE_ENV === 'production';

  const { checkDatabaseConnection, prisma } = await import('./src/db/prisma.js');

  let viteServer: import('vite').ViteDevServer | undefined;
  let server: ReturnType<typeof app.listen> | undefined;

  // Startup is transactional with respect to acquired runtime resources:
  // if any initialization step fails, release everything already created.
  try {
    const databaseStatus = await checkDatabaseConnection();

    if (!databaseStatus.connected) {
      throw new Error(
        `Database readiness check failed: ${databaseStatus.message}`
      );
    }

    console.log('Database readiness check passed.');

    if (!isProd) {
      const { createServer: createViteServer } = await import('vite');

      viteServer = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });

      app.use(viteServer.middlewares);
    } else {
      const staticDir = path.resolve(__dirname, 'dist');

      app.use(express.static(staticDir));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.resolve(staticDir, 'index.html'));
      });
    }

    // Wait for the actual listening event. app.listen() alone does not
    // guarantee that the operating system accepted the requested port.
    server = app.listen(PORT);

    await new Promise<void>((resolve, reject) => {
      const activeServer = server!;

      const onListening = () => {
        activeServer.off('error', onError);
        resolve();
      };

      const onError = (error: Error) => {
        activeServer.off('listening', onListening);
        reject(error);
      };

      activeServer.once('listening', onListening);
      activeServer.once('error', onError);
    });

    console.log(
      `EduTaktis SaaS Server listening on ${
        typeof PORT === 'string' ? PORT : `http://localhost:${PORT}`
      }`
    );
  } catch (startupError) {
    console.error('FATAL: EduTaktis startup failed. Cleaning up resources.');

    if (server?.listening) {
      server.closeAllConnections();

      await new Promise<void>((resolve) => {
        server!.close(() => resolve());
      }).catch((error) => {
        console.error('Startup HTTP cleanup failed:', error);
      });
    }

    if (viteServer) {
      try {
        await viteServer.close();
        console.log('Startup cleanup: Vite server closed.');
      } catch (error) {
        console.error('Startup Vite cleanup failed:', error);
      }
    }

    try {
      await prisma.$disconnect();
      console.log('Startup cleanup: Prisma disconnected.');
    } catch (error) {
      console.error('Startup Prisma cleanup failed:', error);
    }

    throw startupError;
  }

  if (!server) {
    throw new Error('HTTP server was not initialized.');
  }

  let isShuttingDown = false;
  let shutdownExitCode = 0;

  const gracefulShutdown = (reason: string, requestedExitCode = 0): void => {
    if (isShuttingDown) {
      if (requestedExitCode !== 0) {
        shutdownExitCode = 1;
      }
      return;
    }

    isShuttingDown = true;
    shutdownExitCode = requestedExitCode;

    console.log(`Shutdown initiated: ${reason}`);

    const shutdownTimeout = setTimeout(() => {
      console.error(
        'CRITICAL: Graceful shutdown exceeded 10 seconds. Forcing process exit.'
      );

      server!.closeAllConnections();
      process.exit(1);
    }, 10_000);

    void (async () => {
      let shutdownFailed = false;

      const httpClosed = new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });

      server!.closeIdleConnections();

      if (viteServer) {
        try {
          await viteServer.close();
          console.log('Vite server closed.');
        } catch (error) {
          shutdownFailed = true;
          console.error('Failed to close Vite server:', error);
        }
      }

      try {
        await httpClosed;
        console.log('HTTP server closed.');
      } catch (error) {
        shutdownFailed = true;
        console.error('Failed to close HTTP server:', error);
      }

      try {
        await prisma.$disconnect();
        console.log('Prisma disconnected.');
      } catch (error) {
        shutdownFailed = true;
        console.error('Failed to disconnect Prisma:', error);
      }

      clearTimeout(shutdownTimeout);

      const finalExitCode =
        shutdownFailed || shutdownExitCode !== 0 ? 1 : 0;

      console.log(`Shutdown completed with exit code ${finalExitCode}.`);
      process.exit(finalExitCode);
    })().catch((error: unknown) => {
      console.error('CRITICAL: Unexpected graceful shutdown failure:', error);
      clearTimeout(shutdownTimeout);
      process.exit(1);
    });
  };

  // Handle HTTP server errors occurring after successful startup.
  server.on('error', (error: Error) => {
    console.error('CRITICAL HTTP SERVER ERROR:', error);
    gracefulShutdown('httpServerError', 1);
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', error);
    gracefulShutdown('uncaughtException', 1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    console.error('CRITICAL UNHANDLED PROMISE REJECTION:', reason);
    gracefulShutdown('unhandledRejection', 1);
  });

  process.on('SIGTERM', () => {
    gracefulShutdown('SIGTERM', 0);
  });

  process.on('SIGINT', () => {
    gracefulShutdown('SIGINT', 0);
  });
}

startServer().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Unknown startup error';
  console.error('FATAL: EduTaktis startup aborted:', message);
  process.exitCode = 1;
});
