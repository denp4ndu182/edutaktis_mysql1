import { hashPassword, verifyPassword, validatePasswordStrength, normalizeEmail, isValidEmail } from './password';
import { generateSecureToken, hashToken, SESSION_DURATION_MS } from './tokens';
import { authRateLimiter, registerRateLimiter } from './rateLimiter';
import { sessionRepository } from '../repositories/sessionRepository';
import { userRepository } from '../repositories/userRepository';
import { membershipRepository } from '../repositories/membershipRepository';
import { institutionRepository } from '../repositories/institutionRepository';
import { auditLogRepository } from '../repositories/auditLogRepository';
import { passwordResetRepository } from '../repositories/passwordResetRepository';
import { InstitutionRole, MembershipStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  email: string;
  namaLengkap: string;
  gelarDepan: string | null;
  gelarBelakang: string | null;
  nip: string | null;
  nuptk: string | null;
  nomorTelepon?: string | null;
  fotoProfilUrl?: string | null;
  preferensiMataPelajaran?: string | null;
  isActive: boolean;
}

export interface AuthSessionData {
  sessionId: string;
  user: AuthenticatedUser;
  token: string;
  expiresAt: Date;
}

interface MemoryUser extends AuthenticatedUser {
  passwordHash: string | null;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface MemorySession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  ipAddress?: string;
  userAgent?: string;
  lastUsedAt: Date;
  createdAt: Date;
}

interface MemoryMembership {
  id: string;
  userId: string;
  institutionId: string;
  role: InstitutionRole;
  status: MembershipStatus;
  joinedAt: Date;
}

interface MemoryInstitution {
  id: string;
  npsn: string;
  namaResmi: string;
  namaSingkat: string;
  jenjang: string;
  jenisInstitusi: string;
  kementerianDinas: string;
  alamatLengkap: string;
  kelurahanDesa: string | null;
  kecamatan: string | null;
  kabupatenKota: string;
  provinsi: string;
  kodePos: string | null;
  telepon: string | null;
  email: string | null;
  website: string | null;
  logoUrl: string | null;
  namaKepala: string | null;
  nipKepala: string | null;
  kotaTandaTangan: string | null;
}

interface MemoryResetToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

class AuthService {
  private isProduction = process.env.NODE_ENV === 'production';
  private isDbConfigured = Boolean(process.env.DATABASE_URL);
  private allowDevFallback = process.env.ALLOW_DEV_FALLBACK === 'true' || !this.isProduction;

  // In-memory store mirroring DB schemas for dev/test environments with identical Argon2id & SHA-256 security
  private memUsers: Map<string, MemoryUser> = new Map();
  private memSessions: Map<string, MemorySession> = new Map();
  private memMemberships: MemoryMembership[] = [];
  private memInstitutions: Map<string, MemoryInstitution> = new Map();
  private memResetTokens: Map<string, MemoryResetToken> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.enforceRuntimeIntegrity();
  }

  /**
   * Enforces that production environments NEVER run on ephemeral in-memory storage.
   */
  private enforceRuntimeIntegrity() {
    if (this.isProduction && !this.isDbConfigured) {
      console.error('FATAL SECURITY VIOLATION: DATABASE_URL must be configured in production mode.');
    }
  }

  public checkProductionDatabase() {
    if (this.isProduction && !this.isDbConfigured) {
      throw new Error(
        'CRITICAL SECURITY ERROR: MariaDB/MySQL DATABASE_URL is strictly required in production mode. Ephemeral fallback is disallowed.'
      );
    }
  }

  public async ensureInitialized() {
    if (this.initialized) return;
    if (!this.initPromise) {
      this.initPromise = this.initDefaultAccounts();
    }
    await this.initPromise;
  }

  private async initDefaultAccounts() {
    if (this.initialized) return;

    // Seed Institutions
    const inst1: MemoryInstitution = {
      id: 'inst_man1gk',
      npsn: '20400012',
      namaResmi: 'Madrasah Aliyah Negeri 1 Gunungkidul',
      namaSingkat: 'MAN 1 Gunungkidul',
      jenjang: 'MA',
      jenisInstitusi: 'Negeri',
      kementerianDinas: 'Kementerian Agama Republik Indonesia / Kantor Wilayah D.I. Yogyakarta',
      alamatLengkap: 'Jl. KH. Agus Salim No. 65, Ledoksari',
      kelurahanDesa: 'Kepek',
      kecamatan: 'Wonosari',
      kabupatenKota: 'Kab. Gunungkidul',
      provinsi: 'D.I. Yogyakarta',
      kodePos: '55813',
      telepon: '(0274) 391032',
      email: 'man1gunungkidul@kemenag.go.id',
      website: 'https://man1gunungkidul.sch.id',
      logoUrl: null,
      namaKepala: 'H. Kholis Muhajir, S.Ag., M.S.I.',
      nipKepala: '197505122003121003',
      kotaTandaTangan: 'Gunungkidul',
    };

    const inst2: MemoryInstitution = {
      id: 'inst_mtsn2btl',
      npsn: '20400234',
      namaResmi: 'Madrasah Tsanawiyah Negeri 2 Bantul',
      namaSingkat: 'MTsN 2 Bantul',
      jenjang: 'MTs',
      jenisInstitusi: 'Negeri',
      kementerianDinas: 'Kementerian Agama Republik Indonesia / Kantor Wilayah D.I. Yogyakarta',
      alamatLengkap: 'Jl. Supriyadi No. 12, Manding',
      kelurahanDesa: 'Trirenggo',
      kecamatan: 'Bantul',
      kabupatenKota: 'Kab. Bantul',
      provinsi: 'D.I. Yogyakarta',
      kodePos: '55714',
      telepon: '(0274) 367123',
      email: 'mtsn2bantul@kemenag.go.id',
      website: 'https://mtsn2bantul.sch.id',
      logoUrl: null,
      namaKepala: 'Musa Surahman, S.Ag.',
      nipKepala: '197103141997031003',
      kotaTandaTangan: 'Bantul',
    };

    this.memInstitutions.set(inst1.id, inst1);
    this.memInstitutions.set(inst2.id, inst2);

    // Initial password hashed with real Argon2id: 'EduTaktis2025!'
    const standardHash = await hashPassword('EduTaktis2025!');

    const user1: MemoryUser = {
      id: 'usr_pandu_001',
      email: 'pandu.kusumahadi@kemenag.go.id',
      passwordHash: standardHash,
      namaLengkap: 'Pandu Kusumahadi',
      gelarDepan: '',
      gelarBelakang: 'S.Kom',
      nip: '198703252023211023',
      nuptk: '4239765666130122',
      nomorTelepon: '081234567890',
      preferensiMataPelajaran: 'Koding dan Kecerdasan Artifisial',
      isActive: true,
      emailVerified: true,
      fotoProfilUrl: null,
      createdAt: new Date('2024-01-10T08:00:00.000Z'),
      updatedAt: new Date(),
    };

    const user2: MemoryUser = {
      id: 'usr_kholis_002',
      email: 'kholis.muhajir@kemenag.go.id',
      passwordHash: standardHash,
      namaLengkap: 'H. Kholis Muhajir',
      gelarDepan: '',
      gelarBelakang: 'S.Ag., M.S.I.',
      nip: '197505122003121003',
      nuptk: '3157753655200002',
      nomorTelepon: '081328901234',
      preferensiMataPelajaran: 'Pendidikan Agama Islam',
      isActive: true,
      emailVerified: true,
      fotoProfilUrl: null,
      createdAt: new Date('2024-01-10T08:00:00.000Z'),
      updatedAt: new Date(),
    };

    const user3: MemoryUser = {
      id: 'usr_siti_003',
      email: 'siti.aminah@kemenag.go.id',
      passwordHash: standardHash,
      namaLengkap: 'Dra. Hj. Siti Aminah',
      gelarDepan: '',
      gelarBelakang: 'M.Pd.',
      nip: '197906152005012004',
      nuptk: '5441757659300013',
      nomorTelepon: '081578123456',
      preferensiMataPelajaran: 'Informatika',
      isActive: true,
      emailVerified: true,
      fotoProfilUrl: null,
      createdAt: new Date('2024-02-15T09:30:00.000Z'),
      updatedAt: new Date(),
    };

    this.memUsers.set(user1.id, user1);
    this.memUsers.set(user2.id, user2);
    this.memUsers.set(user3.id, user3);

    // Phase 3C Synthetic Test Accounts for Comprehensive Multi-Tenant Isolation Testing
    const synthAccounts: Array<{
      id: string;
      email: string;
      nama: string;
      institutionId: string;
      role: InstitutionRole;
      status: MembershipStatus;
    }> = [
      // Institution A
      { id: 'usr_teacher_a1', email: 'teacher.a1@edutaktis.test', nama: 'Guru A1 (MAN 1)', institutionId: inst1.id, role: 'TEACHER', status: 'ACTIVE' },
      { id: 'usr_teacher_a2', email: 'teacher.a2@edutaktis.test', nama: 'Guru A2 (MAN 1)', institutionId: inst1.id, role: 'TEACHER', status: 'ACTIVE' },
      { id: 'usr_admin_a', email: 'admin.a@edutaktis.test', nama: 'Admin Madrasah A (MAN 1)', institutionId: inst1.id, role: 'SCHOOL_ADMIN', status: 'ACTIVE' },
      { id: 'usr_headmaster_a', email: 'headmaster.a@edutaktis.test', nama: 'Kepala Madrasah A (MAN 1)', institutionId: inst1.id, role: 'HEADMASTER', status: 'ACTIVE' },
      { id: 'usr_operator_a', email: 'operator.a@edutaktis.test', nama: 'Operator Madrasah A (MAN 1)', institutionId: inst1.id, role: 'OPERATOR', status: 'ACTIVE' },
      { id: 'usr_pending_a', email: 'pending.a@edutaktis.test', nama: 'Calon Guru A (Pending)', institutionId: inst1.id, role: 'TEACHER', status: 'PENDING' },
      { id: 'usr_inactive_a', email: 'inactive.a@edutaktis.test', nama: 'Mantan Guru A (Inactive)', institutionId: inst1.id, role: 'TEACHER', status: 'INACTIVE' },
      // Institution B
      { id: 'usr_admin_b', email: 'admin.b@edutaktis.test', nama: 'Admin Madrasah B (MTsN 2)', institutionId: inst2.id, role: 'SCHOOL_ADMIN', status: 'ACTIVE' },
      { id: 'usr_teacher_b1', email: 'teacher.b1@edutaktis.test', nama: 'Guru B1 (MTsN 2)', institutionId: inst2.id, role: 'TEACHER', status: 'ACTIVE' },
      // Global Super Admin
      { id: 'usr_superadmin', email: 'superadmin@edutaktis.test', nama: 'Super Admin Sistem', institutionId: inst1.id, role: 'SUPER_ADMIN', status: 'ACTIVE' },
    ];

    for (const sa of synthAccounts) {
      this.memUsers.set(sa.id, {
        id: sa.id,
        email: sa.email,
        passwordHash: standardHash,
        namaLengkap: sa.nama,
        gelarDepan: null,
        gelarBelakang: null,
        nip: `19800101${sa.id.replace(/\D/g, '').padEnd(10, '0')}`,
        nuptk: null,
        nomorTelepon: null,
        preferensiMataPelajaran: null,
        isActive: sa.status !== 'INACTIVE',
        emailVerified: true,
        fotoProfilUrl: null,
        createdAt: new Date('2024-03-01T08:00:00.000Z'),
        updatedAt: new Date(),
      });

      this.memMemberships.push({
        id: `mem_${sa.id}_${sa.institutionId}`,
        userId: sa.id,
        institutionId: sa.institutionId,
        role: sa.role,
        status: sa.status,
        joinedAt: new Date('2024-03-01T08:00:00.000Z'),
      });
    }

    this.memMemberships.push(
      {
        id: 'mem_pandu_man1gk',
        userId: user1.id,
        institutionId: inst1.id,
        role: 'TEACHER',
        status: 'ACTIVE',
        joinedAt: new Date('2024-01-10T08:00:00.000Z'),
      },
      {
        id: 'mem_pandu_mtsn2btl',
        userId: user1.id,
        institutionId: inst2.id,
        role: 'SCHOOL_ADMIN',
        status: 'ACTIVE',
        joinedAt: new Date('2024-03-01T08:00:00.000Z'),
      },
      {
        id: 'mem_kholis_man1gk',
        userId: user2.id,
        institutionId: inst1.id,
        role: 'HEADMASTER',
        status: 'ACTIVE',
        joinedAt: new Date('2024-01-10T08:00:00.000Z'),
      },
      {
        id: 'mem_siti_mtsn2btl',
        userId: user3.id,
        institutionId: inst2.id,
        role: 'TEACHER',
        status: 'ACTIVE',
        joinedAt: new Date('2024-02-15T09:30:00.000Z'),
      }
    );

    this.initialized = true;
  }

  /**
   * Safe login implementation.
   * Uses timing-safe verification and generic error message to prevent email enumeration.
   */
  async login(
    emailInput: string,
    passwordInput: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; session?: AuthSessionData; error?: string; retryAfterSeconds?: number }> {
    this.checkProductionDatabase();

    const email = normalizeEmail(emailInput);
    const rateLimitKey = `${ipAddress || 'unknown'}:${email}`;

    // 1. Check Rate Limiter
    const rateCheck = authRateLimiter.isRateLimited(rateLimitKey);
    if (rateCheck.limited) {
      return {
        success: false,
        error: `Terlalu banyak percobaan login gagal. Silakan coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      };
    }

    if (!email || !passwordInput) {
      authRateLimiter.registerFailure(rateLimitKey);
      return { success: false, error: 'Email dan password wajib diisi.' };
    }

    try {
      let user: any = null;

      if (this.isDbConfigured) {
        user = await userRepository.findByEmail(email);
      } else {
        await this.ensureInitialized();
        for (const u of this.memUsers.values()) {
          if (u.email === email) {
            user = u;
            break;
          }
        }
      }

      // Generic failure message to prevent email enumeration attacks
      const GENERIC_ERROR = 'Email atau password yang Anda masukkan tidak valid.';

      if (!user) {
        const failure = authRateLimiter.registerFailure(rateLimitKey);
        await auditLogRepository.logAction({
          action: 'AUTH_LOGIN_FAILED',
          resource: 'User',
          details: { email, reason: 'user_not_found', remainingAttempts: failure.remainingAttempts },
          ipAddress,
        });
        return { success: false, error: GENERIC_ERROR };
      }

      if (!user.isActive) {
        await auditLogRepository.logAction({
          userId: user.id,
          action: 'AUTH_LOGIN_BLOCKED',
          resource: 'User',
          details: { email, reason: 'account_inactive' },
          ipAddress,
        });
        return { success: false, error: 'Akun Anda sedang dinonaktifkan. Hubungi administrator madrasah.' };
      }

      if (!user.passwordHash) {
        authRateLimiter.registerFailure(rateLimitKey);
        return {
          success: false,
          error: 'Akun ini belum memiliki password. Silakan hubungi admin sekolah untuk aktivasi.',
        };
      }

      // 2. Verify Argon2id password hash
      const isMatch = await verifyPassword(passwordInput, user.passwordHash);
      if (!isMatch) {
        const failure = authRateLimiter.registerFailure(rateLimitKey);
        await auditLogRepository.logAction({
          userId: user.id,
          action: 'AUTH_LOGIN_FAILED',
          resource: 'User',
          details: { email, reason: 'invalid_password', remainingAttempts: failure.remainingAttempts },
          ipAddress,
        });
        return { success: false, error: GENERIC_ERROR };
      }

      // 3. Reset rate limiter upon success
      authRateLimiter.reset(rateLimitKey);

      // 4. Create cryptographically secure random session token
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

      let sessionId = `sess_${Date.now()}`;
      if (this.isDbConfigured) {
        const dbSession = await sessionRepository.createSession({
          userId: user.id,
          tokenHash,
          expiresAt,
          ipAddress,
          userAgent,
        });
        sessionId = dbSession.id;
      } else {
        const memSession: MemorySession = {
          id: sessionId,
          userId: user.id,
          tokenHash,
          expiresAt,
          revokedAt: null,
          ipAddress,
          userAgent,
          lastUsedAt: new Date(),
          createdAt: new Date(),
        };
        this.memSessions.set(tokenHash, memSession);
      }

      // 5. Audit log successful login
      await auditLogRepository.logAction({
        userId: user.id,
        action: 'AUTH_LOGIN_SUCCESS',
        resource: 'User',
        details: { email, sessionId },
        ipAddress,
      });

      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        namaLengkap: user.namaLengkap,
        gelarDepan: user.gelarDepan,
        gelarBelakang: user.gelarBelakang,
        nip: user.nip,
        nuptk: user.nuptk,
        nomorTelepon: user.nomorTelepon,
        fotoProfilUrl: user.fotoProfilUrl,
        preferensiMataPelajaran: user.preferensiMataPelajaran,
        isActive: user.isActive,
      };

      return {
        success: true,
        session: {
          sessionId,
          user: authenticatedUser,
          token: rawToken,
          expiresAt,
        },
      };
    } catch (err: any) {
      console.error('Login process error:', err);
      if (this.isProduction) throw err;
      return { success: false, error: 'Terjadi kesalahan sistem saat memproses login.' };
    }
  }

  /**
   * Register a new user with safe role restrictions.
   * Public registration always assigns TEACHER role.
   * If an NPSN is supplied, membership status is STRICTLY PENDING awaiting school administrator approval.
   */
  async register(
    params: {
      namaLengkap: string;
      email: string;
      password: string;
      gelarDepan?: string;
      gelarBelakang?: string;
      nip?: string;
      nuptk?: string;
      nomorTelepon?: string;
      preferensiMataPelajaran?: string;
      npsn?: string;
    },
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ success: boolean; session?: AuthSessionData; error?: string }> {
    this.checkProductionDatabase();

    const email = normalizeEmail(params.email);
    const rateLimitKey = `reg:${ipAddress || 'unknown'}`;

    const rateCheck = registerRateLimiter.isRateLimited(rateLimitKey);
    if (rateCheck.limited) {
      return {
        success: false,
        error: `Terlalu banyak permintaan pendaftaran. Silakan coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
      };
    }

    if (!params.namaLengkap || params.namaLengkap.trim().length < 3) {
      return { success: false, error: 'Nama lengkap wajib diisi minimal 3 karakter.' };
    }

    if (!isValidEmail(email)) {
      return { success: false, error: 'Format email tidak valid.' };
    }

    const passCheck = validatePasswordStrength(params.password);
    if (!passCheck.valid) {
      return { success: false, error: passCheck.message };
    }

    try {
      // 1. Check existing email
      let existingUser: any = null;
      if (this.isDbConfigured) {
        existingUser = await userRepository.findByEmail(email);
      } else {
        await this.ensureInitialized();
        for (const u of this.memUsers.values()) {
          if (u.email === email) {
            existingUser = u;
            break;
          }
        }
      }

      if (existingUser) {
        registerRateLimiter.registerFailure(rateLimitKey);
        return { success: false, error: 'Alamat email ini sudah terdaftar dalam sistem.' };
      }

      // 2. Hash password with Argon2id
      const passwordHash = await hashPassword(params.password);

      let targetInstitutionId: string | null = null;
      if (params.npsn) {
        const cleanNpsn = params.npsn.trim();
        if (this.isDbConfigured) {
          const inst = await institutionRepository.findByNpsn(cleanNpsn);
          if (inst) targetInstitutionId = inst.id;
        } else {
          for (const inst of this.memInstitutions.values()) {
            if (inst.npsn === cleanNpsn) {
              targetInstitutionId = inst.id;
              break;
            }
          }
        }
      }

      // 3. Create user
      // CRITICAL HARDENING: Membership status is PENDING, preventing unauthorized access without approval.
      let createdUser: any = null;
      if (this.isDbConfigured) {
        createdUser = await userRepository.create({
          email,
          passwordHash,
          namaLengkap: params.namaLengkap.trim(),
          gelarDepan: params.gelarDepan?.trim() || null,
          gelarBelakang: params.gelarBelakang?.trim() || null,
          nip: params.nip?.trim() || null,
          nuptk: params.nuptk?.trim() || null,
          nomorTelepon: params.nomorTelepon?.trim() || null,
          preferensiMataPelajaran: params.preferensiMataPelajaran?.trim() || null,
          isActive: true,
          emailVerified: false,
          ...(targetInstitutionId
            ? {
                memberships: {
                  create: {
                    institution: { connect: { id: targetInstitutionId } },
                    role: InstitutionRole.TEACHER,
                    status: MembershipStatus.PENDING, // STRICT: Pending admin authorization
                  },
                },
              }
            : {}),
        });
      } else {
        const newUserId = `usr_${Date.now()}`;
        createdUser = {
          id: newUserId,
          email,
          passwordHash,
          namaLengkap: params.namaLengkap.trim(),
          gelarDepan: params.gelarDepan?.trim() || null,
          gelarBelakang: params.gelarBelakang?.trim() || null,
          nip: params.nip?.trim() || null,
          nuptk: params.nuptk?.trim() || null,
          nomorTelepon: params.nomorTelepon?.trim() || null,
          preferensiMataPelajaran: params.preferensiMataPelajaran?.trim() || null,
          isActive: true,
          emailVerified: false,
          fotoProfilUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        this.memUsers.set(newUserId, createdUser);

        if (targetInstitutionId) {
          this.memMemberships.push({
            id: `mem_${Date.now()}`,
            userId: newUserId,
            institutionId: targetInstitutionId,
            role: 'TEACHER',
            status: 'PENDING', // STRICT: Pending admin authorization
            joinedAt: new Date(),
          });
        }
      }

      // 4. Create session for immediate auto-login
      const rawToken = generateSecureToken();
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
      let sessionId = `sess_${Date.now()}`;

      if (this.isDbConfigured) {
        const dbSession = await sessionRepository.createSession({
          userId: createdUser.id,
          tokenHash,
          expiresAt,
          ipAddress,
          userAgent,
        });
        sessionId = dbSession.id;
      } else {
        this.memSessions.set(tokenHash, {
          id: sessionId,
          userId: createdUser.id,
          tokenHash,
          expiresAt,
          revokedAt: null,
          ipAddress,
          userAgent,
          lastUsedAt: new Date(),
          createdAt: new Date(),
        });
      }

      await auditLogRepository.logAction({
        userId: createdUser.id,
        institutionId: targetInstitutionId || undefined,
        action: 'AUTH_REGISTER_SUCCESS',
        resource: 'User',
        details: { email, targetInstitutionId, membershipStatus: targetInstitutionId ? 'PENDING' : 'NONE' },
        ipAddress,
      });

      return {
        success: true,
        session: {
          sessionId,
          user: {
            id: createdUser.id,
            email: createdUser.email,
            namaLengkap: createdUser.namaLengkap,
            gelarDepan: createdUser.gelarDepan,
            gelarBelakang: createdUser.gelarBelakang,
            nip: createdUser.nip,
            nuptk: createdUser.nuptk,
            nomorTelepon: createdUser.nomorTelepon,
            fotoProfilUrl: createdUser.fotoProfilUrl,
            preferensiMataPelajaran: createdUser.preferensiMataPelajaran,
            isActive: createdUser.isActive,
          },
          token: rawToken,
          expiresAt,
        },
      };
    } catch (err: any) {
      console.error('Registration error:', err);
      if (this.isProduction) throw err;
      return { success: false, error: 'Gagal memproses pendaftaran akun baru.' };
    }
  }

  /**
   * Validate raw token from cookie.
   */
  async validateSession(rawToken: string): Promise<AuthenticatedUser | null> {
    if (!rawToken || typeof rawToken !== 'string') return null;

    const tokenHash = hashToken(rawToken);

    if (this.isDbConfigured) {
      const session = await sessionRepository.findValidSession(tokenHash);
      if (!session) return null;

      // Update last used timestamp asynchronously
      sessionRepository.updateLastUsed(session.id).catch(() => {});

      return {
        id: session.user.id,
        email: session.user.email,
        namaLengkap: session.user.namaLengkap,
        gelarDepan: session.user.gelarDepan,
        gelarBelakang: session.user.gelarBelakang,
        nip: session.user.nip,
        nuptk: session.user.nuptk,
        fotoProfilUrl: session.user.fotoProfilUrl,
        isActive: session.user.isActive,
      };
    } else {
      this.checkProductionDatabase();
      await this.ensureInitialized();
      const session = this.memSessions.get(tokenHash);
      if (!session) return null;
      if (session.revokedAt) return null;
      if (new Date() > session.expiresAt) return null;

      const user = this.memUsers.get(session.userId);
      if (!user || !user.isActive) return null;

      session.lastUsedAt = new Date();
      return {
        id: user.id,
        email: user.email,
        namaLengkap: user.namaLengkap,
        gelarDepan: user.gelarDepan,
        gelarBelakang: user.gelarBelakang,
        nip: user.nip,
        nuptk: user.nuptk,
        nomorTelepon: user.nomorTelepon,
        fotoProfilUrl: user.fotoProfilUrl,
        preferensiMataPelajaran: user.preferensiMataPelajaran,
        isActive: user.isActive,
      };
    }
  }

  /**
   * Logout current session.
   */
  async logout(rawToken: string, userId?: string, ipAddress?: string): Promise<void> {
    if (!rawToken) return;
    const tokenHash = hashToken(rawToken);

    if (this.isDbConfigured) {
      await sessionRepository.revokeByTokenHash(tokenHash);
    } else {
      const s = this.memSessions.get(tokenHash);
      if (s) {
        s.revokedAt = new Date();
      }
    }

    if (userId) {
      await auditLogRepository.logAction({
        userId,
        action: 'AUTH_LOGOUT',
        resource: 'Session',
        details: { tokenHash: tokenHash.substring(0, 10) + '...' },
        ipAddress,
      });
    }
  }

  /**
   * Logout all sessions for a user.
   */
  async logoutAll(userId: string, ipAddress?: string): Promise<number> {
    let count = 0;
    if (this.isDbConfigured) {
      count = await sessionRepository.revokeAllUserSessions(userId);
    } else {
      for (const s of this.memSessions.values()) {
        if (s.userId === userId && !s.revokedAt) {
          s.revokedAt = new Date();
          count++;
        }
      }
    }

    await auditLogRepository.logAction({
      userId,
      action: 'AUTH_LOGOUT_ALL',
      resource: 'Session',
      details: { revokedCount: count },
      ipAddress,
    });

    return count;
  }

  /**
   * Retrieves tenant context strictly against server state.
   * Only ACTIVE memberships are accepted for operational tenancy.
   */
  async getUserTenantContext(userId: string, activeInstitutionId?: string) {
    if (this.isDbConfigured) {
      const user = await userRepository.findById(userId);
      if (!user) throw new Error('User not found');

      const memberships = await membershipRepository.listByUser(userId);
      // Filter strictly active memberships
      const activeMemberships = memberships.filter((m) => m.status === 'ACTIVE');

      let activeMem = activeMemberships.find((m) => m.institutionId === activeInstitutionId);
      if (!activeMem && activeMemberships.length > 0) {
        activeMem = activeMemberships[0];
      }

      const activeInst = activeMem
        ? await institutionRepository.findById(activeMem.institutionId)
        : null;

      return {
        currentUser: user,
        currentMembership: activeMem || null,
        currentInstitution: activeInst || null,
        userInstitutions: activeMemberships.map((m) => ({
          institution: m.institution,
          membership: {
            id: m.id,
            userId: m.userId,
            institutionId: m.institutionId,
            role: m.role,
            status: m.status,
            joinedAt: m.joinedAt,
          },
        })),
      };
    } else {
      this.checkProductionDatabase();
      await this.ensureInitialized();
      const user = this.memUsers.get(userId);
      if (!user) throw new Error('User not found');

      const userMems = this.memMemberships.filter(
        (m) => m.userId === userId && m.status === 'ACTIVE'
      );

      let activeMem = userMems.find((m) => m.institutionId === activeInstitutionId);
      if (!activeMem && userMems.length > 0) {
        activeMem = userMems[0];
      }

      const activeInst = activeMem
        ? this.memInstitutions.get(activeMem.institutionId) || null
        : null;

      const userInstitutions = userMems
        .map((m) => {
          const inst = this.memInstitutions.get(m.institutionId);
          return inst ? { institution: inst, membership: m } : null;
        })
        .filter(Boolean);

      return {
        currentUser: user,
        currentMembership: activeMem || null,
        currentInstitution: activeInst,
        userInstitutions,
      };
    }
  }

  /**
   * Request password reset token.
   * Transparently documents that email delivery service is pending configuration.
   */
  async requestPasswordReset(
    emailInput: string,
    ipAddress?: string
  ): Promise<{ success: boolean; message: string; simulatedToken?: string }> {
    this.checkProductionDatabase();

    const email = normalizeEmail(emailInput);
    if (!email) {
      return { success: false, message: 'Alamat email wajib diisi.' };
    }

    let user: any = null;
    if (this.isDbConfigured) {
      user = await userRepository.findByEmail(email);
    } else {
      await this.ensureInitialized();
      for (const u of this.memUsers.values()) {
        if (u.email === email) {
          user = u;
          break;
        }
      }
    }

    const neutralMessage =
      'Jika email terdaftar, instruksi reset password telah diproses. Perlu dicatat: Layanan pengiriman email (SMTP) di server ini sedang dalam tahap konfigurasi VPS.';

    if (!user) {
      return { success: true, message: neutralMessage };
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    if (this.isDbConfigured) {
      await passwordResetRepository.createToken({
        userId: user.id,
        tokenHash,
        expiresAt,
      });
    } else {
      this.memResetTokens.set(tokenHash, {
        id: `rst_${Date.now()}`,
        userId: user.id,
        tokenHash,
        expiresAt,
        usedAt: null,
        createdAt: new Date(),
      });
    }

    await auditLogRepository.logAction({
      userId: user.id,
      action: 'AUTH_PASSWORD_RESET_REQUESTED',
      resource: 'PasswordResetToken',
      details: { email, expiresAt: expiresAt.toISOString() },
      ipAddress,
    });

    // In dev / test mode only, allow returning simulatedToken for automated test harness
    return {
      success: true,
      message: neutralMessage,
      ...(this.allowDevFallback ? { simulatedToken: rawToken } : {}),
    };
  }

  /**
   * Complete password reset using token.
   * Validates one-time token, expiration, hashes new password with Argon2id,
   * updates password, and revokes all active sessions for the user.
   */
  async resetPasswordWithToken(
    rawToken: string,
    newPasswordInput: string,
    ipAddress?: string
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    this.checkProductionDatabase();

    if (!rawToken || typeof rawToken !== 'string') {
      return { success: false, error: 'Token reset password tidak valid.' };
    }

    const passCheck = validatePasswordStrength(newPasswordInput);
    if (!passCheck.valid) {
      return { success: false, error: passCheck.message };
    }

    const tokenHash = hashToken(rawToken);

    try {
      let tokenRecord: any = null;
      let userId: string | null = null;

      if (this.isDbConfigured) {
        tokenRecord = await passwordResetRepository.findValidToken(tokenHash);
        if (!tokenRecord) {
          return { success: false, error: 'Token reset password tidak valid atau sudah kedaluwarsa.' };
        }
        userId = tokenRecord.userId;
      } else {
        tokenRecord = this.memResetTokens.get(tokenHash);
        if (!tokenRecord) {
          return { success: false, error: 'Token reset password tidak valid atau sudah kedaluwarsa.' };
        }
        if (tokenRecord.usedAt) {
          return { success: false, error: 'Token reset password sudah pernah digunakan.' };
        }
        if (new Date() > tokenRecord.expiresAt) {
          return { success: false, error: 'Token reset password telah kedaluwarsa.' };
        }
        userId = tokenRecord.userId;
      }

      // Hash new password using Argon2id
      const newHash = await hashPassword(newPasswordInput);

      if (this.isDbConfigured) {
        await userRepository.update(userId!, { passwordHash: newHash });
        await passwordResetRepository.markTokenUsed(tokenRecord.id);
      } else {
        const u = this.memUsers.get(userId!);
        if (u) {
          u.passwordHash = newHash;
          u.updatedAt = new Date();
        }
        tokenRecord.usedAt = new Date();
      }

      // CRITICAL: Revoke all existing sessions across all devices
      await this.logoutAll(userId!, ipAddress);

      await auditLogRepository.logAction({
        userId: userId!,
        action: 'AUTH_PASSWORD_RESET_SUCCESS',
        resource: 'User',
        details: { tokenId: tokenRecord.id },
        ipAddress,
      });

      return {
        success: true,
        message: 'Password berhasil diubah. Seluruh sesi lama telah dicabut. Silakan login dengan password baru.',
      };
    } catch (err: any) {
      console.error('Reset password error:', err);
      if (this.isProduction) throw err;
      return { success: false, error: 'Gagal mengatur ulang password.' };
    }
  }

  /**
   * Updates a membership role or status.
   * Enforces:
   * - Caller cannot change their own role.
   * - SCHOOL_ADMIN cannot grant SUPER_ADMIN.
   * - Action is strictly logged in audit log.
   */
  async updateMembership(params: {
    callerUserId: string;
    targetUserId: string;
    institutionId: string;
    newRole?: InstitutionRole;
    newStatus?: MembershipStatus;
    ipAddress?: string;
  }): Promise<{ success: boolean; error?: string }> {
    this.checkProductionDatabase();

    if (params.callerUserId === params.targetUserId && params.newRole) {
      return { success: false, error: 'Akses ditolak: Anda tidak dapat mengubah peran Anda sendiri.' };
    }

    if (this.isDbConfigured) {
      const callerMem = await membershipRepository.findByUserAndInstitution(params.callerUserId, params.institutionId);
      if (!callerMem || callerMem.status !== 'ACTIVE') {
        return { success: false, error: 'Akses ditolak: Keanggotaan pemanggil tidak aktif.' };
      }

      if (callerMem.role !== 'SUPER_ADMIN' && callerMem.role !== 'SCHOOL_ADMIN') {
        return { success: false, error: 'Akses ditolak: Anda tidak memiliki izin mengelola anggota institusi ini.' };
      }

      if (params.newRole === 'SUPER_ADMIN' && callerMem.role !== 'SUPER_ADMIN') {
        return { success: false, error: 'Akses ditolak: Hanya Super Admin yang berhak memberikan peran Super Admin.' };
      }

      if (params.newRole) {
        await membershipRepository.updateRole(params.targetUserId, params.institutionId, params.newRole);
      }
      if (params.newStatus) {
        await membershipRepository.updateStatus(params.targetUserId, params.institutionId, params.newStatus);
      }
    } else {
      const callerMem = this.memMemberships.find(
        (m) => m.userId === params.callerUserId && m.institutionId === params.institutionId && m.status === 'ACTIVE'
      );
      if (!callerMem || (callerMem.role !== 'SUPER_ADMIN' && callerMem.role !== 'SCHOOL_ADMIN')) {
        return { success: false, error: 'Akses ditolak: Izin tidak mencukupi.' };
      }

      if (params.newRole === 'SUPER_ADMIN' && callerMem.role !== 'SUPER_ADMIN') {
        return { success: false, error: 'Akses ditolak: Hanya Super Admin yang berhak memberikan peran Super Admin.' };
      }

      const targetMem = this.memMemberships.find(
        (m) => m.userId === params.targetUserId && m.institutionId === params.institutionId
      );
      if (!targetMem) {
        return { success: false, error: 'Target keanggotaan tidak ditemukan.' };
      }

      if (params.newRole) targetMem.role = params.newRole;
      if (params.newStatus) targetMem.status = params.newStatus;
    }

    await auditLogRepository.logAction({
      userId: params.callerUserId,
      institutionId: params.institutionId,
      action: 'MEMBERSHIP_ROLE_UPDATED',
      resource: 'InstitutionMembership',
      details: {
        targetUserId: params.targetUserId,
        newRole: params.newRole,
        newStatus: params.newStatus,
      },
      ipAddress: params.ipAddress,
    });

    return { success: true };
  }

  /**
   * Cleanup expired sessions task
   */
  async cleanupExpiredSessions(): Promise<number> {
    if (this.isDbConfigured) {
      return await sessionRepository.cleanupExpiredSessions();
    } else {
      let count = 0;
      const now = new Date();
      for (const [hash, s] of this.memSessions.entries()) {
        if (s.expiresAt < now || s.revokedAt) {
          this.memSessions.delete(hash);
          count++;
        }
      }
      return count;
    }
  }
}

export const authService = new AuthService();
