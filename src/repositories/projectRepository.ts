import { prisma } from '../db/prisma';
import { Project, Prisma } from '@prisma/client';

export interface MemoryProject {
  id: string;
  institutionId: string;
  userId: string;
  name: string;
  masterInput: any;
  documents: any;
  createdAt: Date;
  updatedAt: Date;
}

export class ProjectRepository {
  private isProduction = process.env.NODE_ENV === 'production';
  private isDbConfigured = Boolean(process.env.DATABASE_URL);

  // In-memory project store for dev and testing environments
  private memProjects: Map<string, MemoryProject> = new Map();
  private initialized = false;

  constructor() {
    this.initDefaultProjects();
  }

  private checkProductionDatabase() {
    if (this.isProduction && !this.isDbConfigured) {
      throw new Error(
        'CRITICAL SECURITY ERROR: MariaDB/MySQL DATABASE_URL is strictly required in production mode. Ephemeral fallback is disallowed.'
      );
    }
  }

  private initDefaultProjects() {
    if (this.initialized) return;
    this.initialized = true;

    // Seed initial project for testing
    const proj1: MemoryProject = {
      id: 'proj_man1gk_ai_001',
      institutionId: 'inst_man1gk',
      userId: 'usr_pandu_001',
      name: 'Administrasi Guru KBC AI - Fase E (Informatika)',
      masterInput: {
        namaMadrasah: 'Madrasah Aliyah Negeri 1 Gunungkidul',
        mataPelajaran: 'Koding dan Kecerdasan Artifisial',
        namaGuru: 'Pandu Kusumahadi, S.Kom',
        nipGuru: '198703252023211023',
        fase: 'Fase E',
        kelas: 'Kelas X',
        tahunPelajaran: '2024/2025',
        alokasiWaktuTotal: 72,
        namaKepala: 'H. Kholis Muhajir, S.Ag., M.S.I.',
        nipKepala: '197505122003121003',
        kotaTandaTangan: 'Gunungkidul',
      },
      documents: {
        ACP: { title: 'Analisis Capaian Pembelajaran' },
        TP: { title: 'Tujuan Pembelajaran' },
      },
      createdAt: new Date('2024-03-01T08:00:00.000Z'),
      updatedAt: new Date('2024-03-01T08:00:00.000Z'),
    };

    const proj2: MemoryProject = {
      id: 'proj_mtsn2btl_inf_002',
      institutionId: 'inst_mtsn2btl',
      userId: 'usr_siti_003',
      name: 'Administrasi Guru Informatika MTsN 2 Bantul - Fase D',
      masterInput: {
        namaMadrasah: 'Madrasah Tsanawiyah Negeri 2 Bantul',
        mataPelajaran: 'Informatika',
        namaGuru: 'Dra. Hj. Siti Aminah, M.Pd.',
        nipGuru: '197906152005012004',
        fase: 'Fase D',
        kelas: 'Kelas VII',
        tahunPelajaran: '2024/2025',
        alokasiWaktuTotal: 72,
        namaKepala: 'Musa Surahman, S.Ag.',
        nipKepala: '197103141997031003',
        kotaTandaTangan: 'Bantul',
      },
      documents: {},
      createdAt: new Date('2024-03-10T08:00:00.000Z'),
      updatedAt: new Date('2024-03-10T08:00:00.000Z'),
    };

    this.memProjects.set(proj1.id, proj1);
    this.memProjects.set(proj2.id, proj2);
  }

  /**
   * Internal lookup by ID (strictly for system/internal operations)
   */
  async findById(id: string): Promise<Project | null> {
    if (this.isDbConfigured) {
      return prisma.project.findUnique({
        where: { id },
      });
    } else {
      this.checkProductionDatabase();
      this.initDefaultProjects();
      const p = this.memProjects.get(id);
      return (p as any) || null;
    }
  }

  /**
   * Alias for findById
   */
  async findProjectById(id: string): Promise<Project | null> {
    return this.findById(id);
  }

  /**
   * Secure tenant-isolated query: guarantees project belongs to the given institution
   * and optionally confirms ownership by userId.
   * Prevents BOLA/IDOR by filtering directly on the database query.
   */
  async findProjectByIdAndInstitution(
    id: string,
    institutionId: string,
    userId?: string
  ): Promise<Project | null> {
    if (this.isDbConfigured) {
      return prisma.project.findFirst({
        where: {
          id,
          institutionId,
          ...(userId ? { userId } : {}),
        },
        include: {
          membership: {
            select: {
              role: true,
              status: true,
            },
          },
        },
      });
    } else {
      this.checkProductionDatabase();
      this.initDefaultProjects();
      const p = this.memProjects.get(id);
      if (!p) return null;
      if (p.institutionId !== institutionId) return null;
      if (userId && p.userId !== userId) return null;
      return p as any;
    }
  }

  /**
   * Alias for findProjectByIdAndInstitution
   */
  async findByIdAndInstitution(
    id: string,
    institutionId: string,
    userId?: string
  ): Promise<Project | null> {
    return this.findProjectByIdAndInstitution(id, institutionId, userId);
  }

  /**
   * Lists projects owned by a specific user within an institution
   */
  async findProjectByOwner(
    userId: string,
    institutionId: string,
    limit = 100
  ): Promise<Project[]> {
    return this.listByInstitution(institutionId, userId, limit);
  }

  /**
   * Lists projects scoped strictly to an institution (and optionally filtered by teacher user).
   * Implements strict pagination (max 100 per query) and order by updatedAt desc.
   */
  async listByInstitution(
    institutionId: string,
    userId?: string,
    limit = 50,
    offset = 0
  ): Promise<Project[]> {
    const cappedLimit = Math.max(1, Math.min(limit, 100));
    const safeOffset = Math.max(0, offset);

    if (this.isDbConfigured) {
      const where: Prisma.ProjectWhereInput = {
        institutionId,
        ...(userId ? { userId } : {}),
      };

      return prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: cappedLimit,
        skip: safeOffset,
      });
    } else {
      this.checkProductionDatabase();
      this.initDefaultProjects();
      const list: MemoryProject[] = [];
      for (const p of this.memProjects.values()) {
        if (p.institutionId === institutionId) {
          if (!userId || p.userId === userId) {
            list.push(p);
          }
        }
      }
      list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
      return list.slice(safeOffset, safeOffset + cappedLimit) as any;
    }
  }

  /**
   * Alias for listByInstitution
   */
  async listProjectsByInstitution(
    institutionId: string,
    userId?: string,
    limit = 50,
    offset = 0
  ): Promise<Project[]> {
    return this.listByInstitution(institutionId, userId, limit, offset);
  }

  /**
   * Count total projects matching institution and optional user scope
   */
  async countByInstitution(institutionId: string, userId?: string): Promise<number> {
    if (this.isDbConfigured) {
      return prisma.project.count({
        where: {
          institutionId,
          ...(userId ? { userId } : {}),
        },
      });
    } else {
      this.checkProductionDatabase();
      this.initDefaultProjects();
      let count = 0;
      for (const p of this.memProjects.values()) {
        if (p.institutionId === institutionId) {
          if (!userId || p.userId === userId) count++;
        }
      }
      return count;
    }
  }

  /**
   * Creates a project enforcing that the user is an active member of the specified institution.
   * Database composite foreign key projects(userId, institutionId) -> institution_memberships(userId, institutionId)
   * enforces relational integrity directly in the PostgreSQL engine.
   */
  async createProject(data: {
    id?: string;
    institutionId: string;
    userId: string;
    name: string;
    masterInput: any;
    documents?: any;
  }): Promise<Project> {
    // 1. Validate inputs
    const trimmedName = data.name?.trim();
    if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 255) {
      throw new Error('Nama proyek wajib diisi dan maksimal 255 karakter.');
    }
    if (!data.masterInput || typeof data.masterInput !== 'object') {
      throw new Error('Data master input proyek wajib berupa objek valid.');
    }

    // 2. Validate payload size (< 10MB)
    const payloadStr = JSON.stringify({ masterInput: data.masterInput, documents: data.documents });
    if (payloadStr.length > 10 * 1024 * 1024) {
      throw new Error('Ukuran data proyek melebihi batas maksimum 10MB.');
    }

    if (this.isDbConfigured) {
      return prisma.project.create({
        data: {
          id: data.id,
          name: trimmedName,
          masterInput: data.masterInput,
          documents: data.documents || {},
          institution: {
            connect: { id: data.institutionId },
          },
          user: {
            connect: { id: data.userId },
          },
          membership: {
            connect: {
              userId_institutionId: {
                userId: data.userId,
                institutionId: data.institutionId,
              },
            },
          },
        },
      });
    } else {
      this.checkProductionDatabase();
      this.initDefaultProjects();
      const projId = data.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const newProj: MemoryProject = {
        id: projId,
        institutionId: data.institutionId,
        userId: data.userId,
        name: trimmedName,
        masterInput: data.masterInput,
        documents: data.documents || {},
        createdAt: now,
        updatedAt: now,
      };
      this.memProjects.set(projId, newProj);
      return newProj as any;
    }
  }

  /**
   * Alias for createProject
   */
  async create(data: {
    id?: string;
    institutionId: string;
    userId: string;
    name: string;
    masterInput: any;
    documents?: any;
  }): Promise<Project> {
    return this.createProject(data);
  }

  /**
   * Updates a project with strict tenant boundary and ownership verification.
   * CRITICAL SECURITY RULE: userId and institutionId are strictly immutable.
   * They cannot be changed through this operation.
   */
  async updateProject(
    id: string,
    institutionId: string,
    data: {
      name?: string;
      masterInput?: any;
      documents?: any;
      expectedProjectUpdatedAt?: Date | string;
    },
    userId?: string
  ): Promise<Project> {
    // 1. Validate payload size
    if (data.masterInput || data.documents) {
      const payloadStr = JSON.stringify({ masterInput: data.masterInput, documents: data.documents });
      if (payloadStr.length > 10 * 1024 * 1024) {
        throw new Error('Ukuran data pembaruan proyek melebihi batas maksimum 10MB.');
      }
    }

    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (trimmedName.length < 1 || trimmedName.length > 255) {
        throw new Error('Nama proyek tidak boleh kosong dan maksimal 255 karakter.');
      }
      data.name = trimmedName;
    }

    if (this.isDbConfigured) {
      // Direct scoped lookup prevents IDOR
      const existing = await prisma.project.findFirst({
        where: {
          id,
          institutionId,
          ...(userId ? { userId } : {}),
        },
      });

      if (!existing) {
        throw new Error(`Proyek tidak ditemukan atau akses ditolak untuk ID: ${id}`);
      }

      // Optimistic Concurrency Control (OCC) Check
      if (data.expectedProjectUpdatedAt) {
        const expectedTime = new Date(data.expectedProjectUpdatedAt).getTime();
        const actualTime = new Date(existing.updatedAt).getTime();
        if (expectedTime !== actualTime) {
          const err = new Error(
            'OCC_CONFLICT: Data proyek telah diperbarui oleh pengguna atau sesi lain. Silakan muat ulang data terbaru.'
          );
          (err as any).code = 'OCC_CONFLICT';
          throw err;
        }
      }

      return prisma.project.update({
        where: { id },
        data: {
          ...(data.name ? { name: data.name } : {}),
          ...(data.masterInput ? { masterInput: data.masterInput } : {}),
          ...(data.documents ? { documents: data.documents } : {}),
        },
      });
    } else {
      this.checkProductionDatabase();
      this.initDefaultProjects();
      const existing = this.memProjects.get(id);
      if (!existing || existing.institutionId !== institutionId || (userId && existing.userId !== userId)) {
        throw new Error(`Proyek tidak ditemukan atau akses ditolak untuk ID: ${id}`);
      }

      // Optimistic Concurrency Control (OCC) Check
      if (data.expectedProjectUpdatedAt) {
        const expectedTime = new Date(data.expectedProjectUpdatedAt).getTime();
        const actualTime = new Date(existing.updatedAt).getTime();
        if (expectedTime !== actualTime) {
          const err = new Error(
            'OCC_CONFLICT: Data proyek telah diperbarui oleh pengguna atau sesi lain. Silakan muat ulang data terbaru.'
          );
          (err as any).code = 'OCC_CONFLICT';
          throw err;
        }
      }

      if (data.name) existing.name = data.name;
      if (data.masterInput) existing.masterInput = data.masterInput;
      if (data.documents) existing.documents = data.documents;
      existing.updatedAt = new Date();

      return existing as any;
    }
  }

  /**
   * Alias for updateProject
   */
  async update(
    id: string,
    institutionId: string,
    data: {
      name?: string;
      masterInput?: any;
      documents?: any;
    },
    userId?: string
  ): Promise<Project> {
    return this.updateProject(id, institutionId, data, userId);
  }

  /**
   * Deletes a project with strict tenant boundary and ownership verification.
   */
  async deleteProject(id: string, institutionId: string, userId?: string): Promise<Project> {
    if (this.isDbConfigured) {
      // Verify existence and tenant ownership
      const existing = await prisma.project.findFirst({
        where: {
          id,
          institutionId,
          ...(userId ? { userId } : {}),
        },
      });

      if (!existing) {
        throw new Error(`Proyek tidak ditemukan atau akses ditolak untuk ID: ${id}`);
      }

      return prisma.project.delete({
        where: { id },
      });
    } else {
      this.checkProductionDatabase();
      this.initDefaultProjects();
      const existing = this.memProjects.get(id);
      if (!existing || existing.institutionId !== institutionId || (userId && existing.userId !== userId)) {
        throw new Error(`Proyek tidak ditemukan atau akses ditolak untuk ID: ${id}`);
      }

      this.memProjects.delete(id);
      return existing as any;
    }
  }

  /**
   * Alias for deleteProject
   */
  async delete(id: string, institutionId: string, userId?: string): Promise<Project> {
    return this.deleteProject(id, institutionId, userId);
  }
}

export const projectRepository = new ProjectRepository();
