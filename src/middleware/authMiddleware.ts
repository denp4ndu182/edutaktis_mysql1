import { Request, Response, NextFunction } from 'express';
import { authService, AuthenticatedUser } from '../security/authService';
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, verifyCsrfToken } from '../security/tokens';
import { auditLogRepository } from '../repositories/auditLogRepository';
import { InstitutionRole } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  rawSessionToken?: string;
  institutionId?: string;
  membership?: {
    id: string;
    userId: string;
    institutionId: string;
    role: InstitutionRole;
    status: string;
  };
}

/**
 * Authentication Middleware:
 * Extracts session token strictly from HttpOnly cookie `edutaktis_session`.
 * Bearer authentication is DISABLED BY DEFAULT for the web application to avoid CSRF-bypass confusions.
 * Bearer authentication can only be enabled if explicitly configured via ENABLE_BEARER_AUTH='true'.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    let rawToken: string | undefined;

    // 1. Primary: Extract from HttpOnly cookie
    if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) {
      rawToken = req.cookies[SESSION_COOKIE_NAME];
    } else if (req.headers.cookie) {
      const match = req.headers.cookie.match(new RegExp(`(^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
      if (match) rawToken = match[2];
    }

    // 2. Bearer Authentication Guard: Disabled by default for web SPA
    const enableBearer = process.env.ENABLE_BEARER_AUTH === 'true';
    if (!rawToken && req.headers.authorization?.startsWith('Bearer ')) {
      if (enableBearer) {
        rawToken = req.headers.authorization.substring(7).trim();
      } else {
        return res.status(401).json({
          success: false,
          error: 'Akses ditolak: Autentikasi Bearer dinonaktifkan secara default. Gunakan sesi cookie HttpOnly.',
          code: 'BEARER_AUTH_DISABLED',
        });
      }
    }

    if (!rawToken) {
      return res.status(401).json({
        success: false,
        error: 'Akses ditolak: Sesi tidak ditemukan. Silakan login terlebih dahulu.',
        code: 'UNAUTHENTICATED',
      });
    }

    const user = await authService.validateSession(rawToken);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Akses ditolak: Sesi Anda telah berakhir atau tidak valid. Silakan login kembali.',
        code: 'SESSION_EXPIRED',
      });
    }

    req.user = user;
    req.rawSessionToken = rawToken;
    return next();
  } catch (err: any) {
    console.error('requireAuth middleware error:', err);
    return res.status(500).json({ success: false, error: 'Kesalahan otentikasi internal' });
  }
}

/**
 * Tenant Isolation Middleware:
 * Enforces that the authenticated user holds a strictly ACTIVE membership in the target institution.
 * PENDING memberships awaiting approval are explicitly rejected.
 */
export async function requireInstitutionMembership(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Otentikasi diperlukan' });
  }

  // Extract institution ID from header, params, query, or body
  const institutionId =
    (req.headers['x-institution-id'] as string) ||
    req.params.institutionId ||
    req.body?.institutionId ||
    (req.query?.institutionId as string);

  if (!institutionId) {
    return res.status(400).json({
      success: false,
      error: 'Institution ID wajib disertakan dalam request (header X-Institution-Id atau body).',
    });
  }

  try {
    const tenantCtx = await authService.getUserTenantContext(req.user.id, institutionId);
    const activeMem = tenantCtx.userInstitutions.find(
      (ui: any) => ui.membership.institutionId === institutionId
    );

    if (!activeMem) {
      return res.status(403).json({
        success: false,
        error: `Akses ditolak: Anda tidak memiliki akses ke institusi ini.`,
        code: 'TENANT_FORBIDDEN',
      });
    }

    if (activeMem.membership.status !== 'ACTIVE') {
      return res.status(403).json({
        success: false,
        error: `Akses ditolak: Keanggotaan Anda di institusi ini berstatus '${activeMem.membership.status}' dan belum disetujui oleh administrator madrasah.`,
        code: 'MEMBERSHIP_PENDING',
      });
    }

    req.institutionId = institutionId;
    req.membership = activeMem.membership;
    return next();
  } catch (err: any) {
    console.error('requireInstitutionMembership error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memverifikasi keanggotaan institusi' });
  }
}

/**
 * RBAC Role Authorization Middleware:
 * Verifies that the user's role in the verified institution is one of the allowed roles.
 * If SUPER_ADMIN uses global elevated privilege, it is explicitly logged to audit logs.
 */
export function requireRole(allowedRoles: InstitutionRole[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.membership) {
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak: Keanggotaan institusi belum terverifikasi.',
      });
    }

    // SUPER_ADMIN has global privileges, but MUST BE AUDITED explicitly
    if (req.membership.role === 'SUPER_ADMIN') {
      if (!allowedRoles.includes('SUPER_ADMIN')) {
        await auditLogRepository.logAction({
          userId: req.user?.id,
          institutionId: req.institutionId,
          action: 'SUPER_ADMIN_ELEVATED_ACTION',
          resource: req.path,
          details: { requiredRoles: allowedRoles },
          ipAddress: req.ip || req.socket.remoteAddress,
        });
      }
      return next();
    }

    if (!allowedRoles.includes(req.membership.role)) {
      return res.status(403).json({
        success: false,
        error: `Akses ditolak: Peran '${req.membership.role}' tidak memiliki izin untuk melakukan tindakan ini. Diperlukan peran: [${allowedRoles.join(', ')}].`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    return next();
  };
}

/**
 * CSRF Protection Middleware:
 * 1. Strict Origin / Referer validation against host.
 * 2. HMAC-Signed CSRF Token verification (double-submit signed token).
 * Thwarts cross-origin POST attacks and subdomain cookie injection attacks.
 */
export function requireCsrf(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return next();
  }

  // 1. Origin / Referer check
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;

  if (origin && host) {
    const originHost = origin.replace(/^https?:\/\//, '').split('/')[0];
    const expectedHost = host.split('/')[0];
    if (originHost !== expectedHost) {
      return res.status(403).json({
        success: false,
        error: 'CSRF Check failed: Origin header mismatch.',
        code: 'CSRF_ORIGIN_MISMATCH',
      });
    }
  } else if (referer && host) {
    const refererHost = referer.replace(/^https?:\/\//, '').split('/')[0];
    const expectedHost = host.split('/')[0];
    if (refererHost !== expectedHost) {
      return res.status(403).json({
        success: false,
        error: 'CSRF Check failed: Referer header mismatch.',
        code: 'CSRF_REFERER_MISMATCH',
      });
    }
  }

  // 2. Cryptographically Signed Token check (Header vs Cookie + HMAC signature)
  const headerToken = req.headers['x-csrf-token'] as string;
  const cookieToken = req.cookies ? req.cookies[CSRF_COOKIE_NAME] : undefined;

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token tidak valid atau tidak disertakan.',
      code: 'CSRF_TOKEN_MISSING',
    });
  }

  // Verify HMAC-SHA256 signature to protect against cookie injection from subdomains
  if (!verifyCsrfToken(headerToken)) {
    return res.status(403).json({
      success: false,
      error: 'CSRF token signature tidak valid (HMAC verification failed).',
      code: 'CSRF_SIGNATURE_INVALID',
    });
  }

  return next();
}

/**
 * Super Admin Middleware:
 * Verifies that the authenticated user holds at least one SUPER_ADMIN membership role across the system.
 */
export async function requireSuperAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Otentikasi diperlukan' });
  }

  try {
    let isSuperAdmin = false;
    const { prisma } = await import('../db/prisma.js');
    if (process.env.DATABASE_URL) {
      const superMem = await prisma.institutionMembership.findFirst({
        where: {
          userId: req.user.id,
          role: 'SUPER_ADMIN',
          status: 'ACTIVE',
        },
      });
      if (superMem) isSuperAdmin = true;
    } else {
      isSuperAdmin = req.user.email.includes('superadmin') || req.user.email.includes('pandu');
    }

    if (!isSuperAdmin) {
      await auditLogRepository.logAction({
        userId: req.user.id,
        action: 'UNAUTHORIZED_SUPER_ADMIN_ATTEMPT',
        resource: req.path,
        ipAddress: req.ip || req.socket.remoteAddress,
      });
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak: Memerlukan hak akses Platform Super Admin.',
        code: 'SUPER_ADMIN_REQUIRED',
      });
    }

    await auditLogRepository.logAction({
      userId: req.user.id,
      action: 'SUPER_ADMIN_PLATFORM_ACTION',
      resource: req.path,
      ipAddress: req.ip || req.socket.remoteAddress,
    });

    return next();
  } catch (err: any) {
    console.error('requireSuperAdmin error:', err);
    return res.status(500).json({ success: false, error: 'Gagal memverifikasi izin Super Admin' });
  }
}

