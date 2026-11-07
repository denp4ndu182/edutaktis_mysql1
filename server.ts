import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import cookieParser from 'cookie-parser';
import { authService } from './src/security/authService';
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use(express.json({ limit: '15mb' }));
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
  if (!token) {
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
app.post('/api/auth/logout', async (req: AuthenticatedRequest, res: Response) => {
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
    const tenantCtx = await authService.getUserTenantContext(req.user!.id);
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
app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const ipAddress = getClientIp(req);
    const result = await authService.requestPasswordReset(email, ipAddress);
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
// TENANT & MULTI-USER RBAC API ENDPOINTS
// ==========================================

// Authenticated Tenant Context
app.get('/api/tenant/context', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetInstitutionId = req.headers['x-institution-id'] as string;
    const tenantCtx = await authService.getUserTenantContext(req.user!.id, targetInstitutionId);
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

    return res.json({ success: true, user });
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
      const { targetUserId, newRole, newStatus } = req.body;
      if (!targetUserId) {
        return res.status(400).json({ success: false, error: 'targetUserId wajib disertakan.' });
      }
      const ipAddress = getClientIp(req);
      const result = await authService.updateMembership({
        callerUserId: req.user!.id,
        targetUserId,
        institutionId: req.institutionId!,
        newRole,
        newStatus,
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

// Switch active institution (verified against user's server memberships)
app.post('/api/tenant/switch-institution', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { institutionId } = req.body;
    if (!institutionId) {
      return res.status(400).json({ success: false, error: 'Institution ID wajib disertakan.' });
    }

    const tenantCtx = await authService.getUserTenantContext(req.user!.id, institutionId);
    const validMem = tenantCtx.userInstitutions.find((ui: any) => ui.membership.institutionId === institutionId);

    if (!validMem) {
      return res.status(403).json({
        success: false,
        error: 'Akses ditolak: Anda bukan anggota dari institusi tersebut.',
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
        req.user!.id,
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

      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const result = await modulAjarRepository.listModulAjar(
        projectId,
        req.institutionId!,
        req.user!.id,
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
      const record = await modulAjarRepository.getModulAjarById(
        projectId,
        documentId,
        req.institutionId!,
        req.user!.id
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

      const { title, content, status, changelog, teacherInput, expectedProjectUpdatedAt } = req.body;
      const updated = await modulAjarRepository.updateModulAjar(
        projectId,
        documentId,
        req.institutionId!,
        req.user!.id,
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
        req.user!.id,
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

      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

      const result = await modulAjarRepository.listLkpd(
        projectId,
        req.institutionId!,
        req.user!.id,
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
      const record = await modulAjarRepository.getLkpdById(
        projectId,
        documentId,
        req.institutionId!,
        req.user!.id
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

      const { title, content, status, changelog, teacherInput, expectedProjectUpdatedAt } = req.body;
      const updated = await modulAjarRepository.updateLkpd(
        projectId,
        documentId,
        req.institutionId!,
        req.user!.id,
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
        req.user!.id,
        teacherInput
      );

      // 2. AI Generation / Fallback Execution
      const genResult = await modulAjarAiService.generateModulAjarKbc(mapping, teacherInput);

      // 3. Save generated record to collection with OCC check
      const record = await modulAjarRepository.createModulAjar(
        projectId,
        req.institutionId!,
        req.user!.id,
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
          req.user!.id
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
        req.user!.id,
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
        req.user!.id,
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



// Generate document endpoint (Stateless Utility Endpoint with Input Validation & Size Limits)
app.post('/api/generate-document', async (req: Request, res: Response) => {
  try {
    // 1. Payload size check (Max 2MB)
    const payloadLength = JSON.stringify(req.body || {}).length;
    if (payloadLength > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Ukuran payload permintaan melebihi batas maksimum 2MB.' });
    }

    const { docType, masterInput, previousDocs } = req.body;

    // 2. Strict Input & Whitelist Validation
    const ALLOWED_DOC_TYPES = ['ACP', 'TP', 'ATP', 'PROTA', 'PROSEM', 'KKTP'];
    if (!docType || typeof docType !== 'string' || !ALLOWED_DOC_TYPES.includes(docType.toUpperCase())) {
      return res.status(400).json({
        success: false,
        error: `docType tidak valid. Harus salah satu dari: [${ALLOWED_DOC_TYPES.join(', ')}].`,
      });
    }

    if (!masterInput || typeof masterInput !== 'object' || Array.isArray(masterInput)) {
      return res.status(400).json({ success: false, error: 'masterInput wajib berupa objek JSON valid.' });
    }

    if (!aiClient) {
      // Fallback flag when API key is not present so frontend can use deterministic generator
      return res.json({
        success: false,
        fallbackRequired: true,
        message: 'No GEMINI_API_KEY found, fallback to educational algorithm generator',
      });
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
TP List: ${JSON.stringify(previousDocs?.TP?.content?.listTP || [])}
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
ATP List: ${JSON.stringify(previousDocs?.ATP?.content?.listATP || [])}
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
PROTA Rencana Alokasi: ${JSON.stringify(previousDocs?.PROTA?.content?.rencanaAlokasi || [])}
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
List TP: ${JSON.stringify(previousDocs?.TP?.content?.listTP || [])}
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

    const response = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text || '{}';
    let parsedData: any;
    try {
      parsedData = JSON.parse(text);
    } catch {
      // If parsing fails, extract potential JSON block
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('AI returned non-JSON response');
      }
    }

    return res.json({
      success: true,
      data: parsedData,
    });
  } catch (err: any) {
    console.error('Error generating document:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Internal server error while generating document',
      fallbackRequired: true,
    });
  }
});

// ==========================================
// PLATFORM ADMIN CONSOLE ENDPOINTS (PHASE 2A)
// ==========================================

import { requireSuperAdmin } from './src/middleware/authMiddleware.js';
import { platformAdminService } from './src/services/platformAdminService.js';

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

// 3. Create Institution
app.post('/api/platform/institutions', requireAuth, requireCsrf, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = req.body;
    if (!data.npsn || !data.namaResmi || !data.jenjang || !data.kabupatenKota || !data.provinsi) {
      return res.status(400).json({ success: false, error: 'Data institusi utama wajib diisi.' });
    }
    const created = await platformAdminService.createInstitution({
      ...data,
      actorUserId: req.user!.id,
      ipAddress: getClientIp(req),
    });
    return res.status(201).json({ success: true, institution: created });
  } catch (err: any) {
    console.error('Platform create institution error:', err);
    return res.status(400).json({ success: false, error: err.message || 'Gagal membuat institusi baru' });
  }
});

// 4. Get Institution Detail
app.get('/api/platform/institutions/:id', requireAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { prisma } = await import('./src/db/prisma.js');
    const id = req.params.id;
    const institution = await prisma.institution.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, namaLengkap: true, email: true, nip: true } },
          },
        },
        _count: { select: { projects: true } },
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
    const data = req.body;
    const updated = await platformAdminService.updateInstitution(id, data, req.user!.id, getClientIp(req));
    return res.json({ success: true, institution: updated });
  } catch (err: any) {
    console.error('Platform update institution error:', err);
    return res.status(400).json({ success: false, error: err.message || 'Gagal memperbarui institusi' });
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
      include: {
        memberships: {
          include: {
            institution: { select: { id: true, namaResmi: true, namaSingkat: true, npsn: true } },
          },
        },
        _count: { select: { projects: true } },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
    }

    const { passwordHash: _, ...safeUser } = user;
    return res.json({ success: true, user: safeUser });
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
    const { userId, institutionId, newRole, newStatus } = req.body;
    if (!userId || !institutionId) {
      return res.status(400).json({ success: false, error: 'userId dan institutionId wajib disertakan.' });
    }

    await platformAdminService.updateMembership(userId, institutionId, newRole, newStatus, req.user!.id, getClientIp(req));
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


// Setup Vite middleware in dev or serve static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Robust static directory resolution for source execution vs compiled bundle (dist/server.js)
    const staticDir = fs.existsSync(path.resolve(__dirname, 'index.html'))
      ? __dirname
      : path.resolve(__dirname, 'dist');

    app.use(express.static(staticDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(staticDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, () => {
    console.log(`EduTaktis SaaS Server listening on ${typeof PORT === 'string' ? PORT : `http://localhost:${PORT}`}`);
  });

  // Phusion Passenger & Node.js Process Safety Handlers
  process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('UNHANDLED PROMISE REJECTION:', reason);
  });

  let isShuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down HTTP server gracefully...`);

    const timeout = setTimeout(() => {
      console.error('Graceful shutdown timeout reached (5s). Forcing process exit.');
      process.exit(1);
    }, 5000);
    if (timeout.unref) timeout.unref();

    server.close(async () => {
      try {
        const { prisma } = await import('./src/db/prisma.js');
        await prisma.$disconnect();
      } catch {
        // ignore
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

startServer();
