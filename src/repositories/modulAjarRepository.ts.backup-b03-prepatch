import { projectRepository } from './projectRepository';
import {
  ModulAjarKbcRecord,
  LkpdRecord,
  TeacherGenerationInput,
  AcademicSourceReferences,
  ModulAjarKbcData,
  LkpdData,
  DocumentCollection,
} from '../types';

export class ModulAjarRepository {
  /**
   * Safe helper to extract or initialize document collections from a project JSON
   */
  private getProjectCollections(projectDocs: any): DocumentCollection {
    const rawColls = projectDocs?.collections || {};
    return {
      modulAjar: Array.isArray(rawColls.modulAjar) ? rawColls.modulAjar : [],
      lkpd: Array.isArray(rawColls.lkpd) ? rawColls.lkpd : [],
    };
  }

  /**
   * Helper to retrieve verified project academic sources (ACP, TP, ATP)
   * Enforces backend-side validation of selected TP codes against project database records.
   */
  async getAcademicSources(
    projectId: string,
    institutionId: string,
    userId: string,
    selectedTpCodes?: string[]
  ): Promise<{
    allowed: boolean;
    error?: string;
    sources?: {
      masterInput: any;
      acpContent: any;
      tpContent: any;
      atpContent: any;
      sourceReferences: AcademicSourceReferences;
    };
  }> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) {
      return { allowed: false, error: 'Proyek tidak ditemukan atau akses ditolak.' };
    }

    const docs = (project.documents || {}) as any;
    const acp = docs.ACP;
    const tp = docs.TP;
    const atp = docs.ATP;

    // Prerequisite check: ACP and TP must be present and valid
    if (!acp || (!acp.content && acp.status !== 'completed')) {
      return {
        allowed: false,
        error: 'Prasyarat tidak terpenuhi: Dokumen Analisis Capaian Pembelajaran (ACP) belum dibuat pada proyek ini.',
      };
    }

    if (!tp || (!tp.content && tp.status !== 'completed')) {
      return {
        allowed: false,
        error: 'Prasyarat tidak terpenuhi: Dokumen Tujuan Pembelajaran (TP) belum dibuat pada proyek ini.',
      };
    }

    // Validate selected TP codes if provided by teacher
    const warnings: string[] = [];
    const validTpList = tp.content?.listTP || [];
    const validTpCodes = validTpList.map((t: any) => t.kodeTP);

    if (selectedTpCodes && selectedTpCodes.length > 0) {
      const invalidCodes = selectedTpCodes.filter((code) => !validTpCodes.includes(code));
      if (invalidCodes.length > 0) {
        return {
          allowed: false,
          error: `Kode TP yang dipilih [${invalidCodes.join(', ')}] tidak ditemukan pada dokumen TP proyek ini.`,
        };
      }
    }

    // Check ATP status
    let atpAvailable = false;
    if (atp && (atp.content || atp.status === 'completed')) {
      atpAvailable = true;
    } else {
      warnings.push('Dokumen Alur Tujuan Pembelajaran (ATP) belum tersedia. Urutan TP standar akan digunakan sebagai acuan dasar.');
    }

    const matchedTpItems = (selectedTpCodes && selectedTpCodes.length > 0
      ? validTpList.filter((t: any) => selectedTpCodes.includes(t.kodeTP))
      : validTpList
    ).map((t: any) => ({
      kodeTP: t.kodeTP,
      rumusanTP: t.rumusanTP,
      materiPokok: t.materiPokok,
    }));

    const sourceReferences: AcademicSourceReferences = {
      acpAvailable: true,
      tpAvailable: true,
      atpAvailable,
      selectedTpCodes: selectedTpCodes || [],
      tpItems: matchedTpItems,
      acpSummary: acp.content?.rasionalMapel || '',
      warnings,
    };

    return {
      allowed: true,
      sources: {
        masterInput: project.masterInput,
        acpContent: acp.content,
        tpContent: tp.content,
        atpContent: atp ? atp.content : null,
        sourceReferences,
      },
    };
  }

  // ==========================================
  // MODUL AJAR REPOSITORY OPERATIONS
  // ==========================================

  async createModulAjar(
    projectId: string,
    institutionId: string,
    userId: string,
    input: TeacherGenerationInput,
    initialData?: ModulAjarKbcData,
    options?: { expectedProjectUpdatedAt?: Date | string }
  ): Promise<ModulAjarKbcRecord> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) {
      throw new Error('Proyek tidak ditemukan atau akses ditolak.');
    }

    const academicCheck = await this.getAcademicSources(projectId, institutionId, userId, input.selectedTpCodes);
    if (!academicCheck.allowed || !academicCheck.sources) {
      throw new Error(academicCheck.error || 'Gagal memverifikasi sumber data akademik.');
    }

    const newId = `modul_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: ModulAjarKbcRecord = {
      id: newId,
      title: `Modul Ajar - ${input.materiPokok.substring(0, 50)}`,
      version: 1,
      status: initialData ? 'completed' : 'draft',
      createdAt: now,
      updatedAt: now,
      teacherInput: input,
      sourceReferences: academicCheck.sources.sourceReferences,
      content: initialData || null,
      changelog: 'Draf Modul Ajar KBC berhasil dibuat',
      versionsHistory: [
        {
          version: 1,
          updatedAt: now,
          changelog: 'Inisialisasi draf pertama',
          content: initialData || null,
        },
      ],
    };

    // Atomic update merging into collections without touching existing 6 documents
    const currentDocs = (project.documents || {}) as any;
    const collections = this.getProjectCollections(currentDocs);
    collections.modulAjar.unshift(record);

    const updatedDocs = {
      ...currentDocs,
      collections,
    };

    await projectRepository.updateProject(
      projectId,
      institutionId,
      {
        documents: updatedDocs,
        expectedProjectUpdatedAt: options?.expectedProjectUpdatedAt,
      },
      userId
    );
    return record;
  }

  async getModulAjarById(
    projectId: string,
    documentId: string,
    institutionId: string,
    userId: string
  ): Promise<ModulAjarKbcRecord | null> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) return null;

    const collections = this.getProjectCollections(project.documents);
    const item = collections.modulAjar.find((m) => m.id === documentId);
    return item || null;
  }

  async listModulAjar(
    projectId: string,
    institutionId: string,
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<{ items: ModulAjarKbcRecord[]; total: number }> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) {
      return { items: [], total: 0 };
    }

    const collections = this.getProjectCollections(project.documents);
    const list = collections.modulAjar;
    const safeOffset = Math.max(0, offset);
    const cappedLimit = Math.max(1, Math.min(limit, 100));

    return {
      items: list.slice(safeOffset, safeOffset + cappedLimit),
      total: list.length,
    };
  }

  async updateModulAjar(
    projectId: string,
    documentId: string,
    institutionId: string,
    userId: string,
    data: {
      title?: string;
      content?: ModulAjarKbcData;
      status?: 'draft' | 'completed' | 'needs_revision';
      changelog?: string;
      teacherInput?: Partial<TeacherGenerationInput>;
      expectedProjectUpdatedAt?: Date | string;
    }
  ): Promise<ModulAjarKbcRecord> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) {
      throw new Error('Proyek tidak ditemukan atau akses ditolak.');
    }

    const currentDocs = (project.documents || {}) as any;
    const collections = this.getProjectCollections(currentDocs);
    const index = collections.modulAjar.findIndex((m) => m.id === documentId);

    if (index === -1) {
      throw new Error(`Dokumen Modul Ajar ID '${documentId}' tidak ditemukan pada proyek ini.`);
    }

    const existing = collections.modulAjar[index];
    const newVersion = existing.version + 1;
    const now = new Date().toISOString();

    const updatedContent = data.content !== undefined ? data.content : existing.content;
    const updatedRecord: ModulAjarKbcRecord = {
      ...existing,
      title: data.title?.trim() || existing.title,
      status: data.status || existing.status,
      updatedAt: now,
      version: newVersion,
      teacherInput: data.teacherInput
        ? { ...existing.teacherInput, ...data.teacherInput }
        : existing.teacherInput,
      content: updatedContent,
      changelog: data.changelog || `Pembaruan revisi versi ${newVersion}`,
      versionsHistory: [
        ...(existing.versionsHistory || []),
        {
          version: newVersion,
          updatedAt: now,
          changelog: data.changelog || `Versi ${newVersion}`,
          content: updatedContent,
        },
      ],
    };

    collections.modulAjar[index] = updatedRecord;

    const updatedDocs = {
      ...currentDocs,
      collections,
    };

    await projectRepository.updateProject(
      projectId,
      institutionId,
      {
        documents: updatedDocs,
        expectedProjectUpdatedAt: data.expectedProjectUpdatedAt,
      },
      userId
    );
    return updatedRecord;
  }

  // ==========================================
  // LKPD REPOSITORY OPERATIONS
  // ==========================================

  async createLkpd(
    projectId: string,
    institutionId: string,
    userId: string,
    input: {
      mode: 'FROM_MODULE' | 'FROM_ACADEMIC_DATA';
      sourceModuleId?: string;
      materiPokok: string;
      teacherInput?: Partial<TeacherGenerationInput>;
    },
    initialData?: LkpdData,
    options?: { expectedProjectUpdatedAt?: Date | string }
  ): Promise<LkpdRecord> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) {
      throw new Error('Proyek tidak ditemukan atau akses ditolak.');
    }

    // Mode 1: FROM_MODULE validation
    if (input.mode === 'FROM_MODULE') {
      if (!input.sourceModuleId) {
        throw new Error("Mode 'FROM_MODULE' memerlukan 'sourceModuleId' Modul Ajar acuan.");
      }
      const collections = this.getProjectCollections(project.documents);
      const targetModule = collections.modulAjar.find((m) => m.id === input.sourceModuleId);
      if (!targetModule) {
        throw new Error(`Modul Ajar acuan ID '${input.sourceModuleId}' tidak ditemukan.`);
      }
    }

    // Academic Sources verification
    const academicCheck = await this.getAcademicSources(
      projectId,
      institutionId,
      userId,
      input.teacherInput?.selectedTpCodes
    );
    if (!academicCheck.allowed || !academicCheck.sources) {
      throw new Error(academicCheck.error || 'Gagal memverifikasi sumber data akademik.');
    }

    const newId = `lkpd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const record: LkpdRecord = {
      id: newId,
      title: `LKPD - ${input.materiPokok.substring(0, 50)}`,
      version: 1,
      status: initialData ? 'completed' : 'draft',
      mode: input.mode,
      sourceModuleId: input.sourceModuleId,
      createdAt: now,
      updatedAt: now,
      teacherInput: input.teacherInput || { materiPokok: input.materiPokok },
      sourceReferences: academicCheck.sources.sourceReferences,
      content: initialData || null,
      changelog: 'Draf LKPD berhasil dibuat',
      versionsHistory: [
        {
          version: 1,
          updatedAt: now,
          changelog: 'Inisialisasi draf pertama LKPD',
          content: initialData || null,
        },
      ],
    };

    const currentDocs = (project.documents || {}) as any;
    const collections = this.getProjectCollections(currentDocs);
    collections.lkpd.unshift(record);

    const updatedDocs = {
      ...currentDocs,
      collections,
    };

    await projectRepository.updateProject(
      projectId,
      institutionId,
      {
        documents: updatedDocs,
        expectedProjectUpdatedAt: options?.expectedProjectUpdatedAt,
      },
      userId
    );
    return record;
  }

  async getLkpdById(
    projectId: string,
    documentId: string,
    institutionId: string,
    userId: string
  ): Promise<LkpdRecord | null> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) return null;

    const collections = this.getProjectCollections(project.documents);
    const item = collections.lkpd.find((l) => l.id === documentId);
    return item || null;
  }

  async listLkpd(
    projectId: string,
    institutionId: string,
    userId: string,
    limit = 50,
    offset = 0
  ): Promise<{ items: LkpdRecord[]; total: number }> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) {
      return { items: [], total: 0 };
    }

    const collections = this.getProjectCollections(project.documents);
    const list = collections.lkpd;
    const safeOffset = Math.max(0, offset);
    const cappedLimit = Math.max(1, Math.min(limit, 100));

    return {
      items: list.slice(safeOffset, safeOffset + cappedLimit),
      total: list.length,
    };
  }

  async updateLkpd(
    projectId: string,
    documentId: string,
    institutionId: string,
    userId: string,
    data: {
      title?: string;
      content?: LkpdData;
      status?: 'draft' | 'completed' | 'needs_revision';
      changelog?: string;
      teacherInput?: Partial<TeacherGenerationInput>;
      expectedProjectUpdatedAt?: Date | string;
    }
  ): Promise<LkpdRecord> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) {
      throw new Error('Proyek tidak ditemukan atau akses ditolak.');
    }

    const currentDocs = (project.documents || {}) as any;
    const collections = this.getProjectCollections(currentDocs);
    const index = collections.lkpd.findIndex((l) => l.id === documentId);

    if (index === -1) {
      throw new Error(`Dokumen LKPD ID '${documentId}' tidak ditemukan pada proyek ini.`);
    }

    const existing = collections.lkpd[index];
    const newVersion = existing.version + 1;
    const now = new Date().toISOString();

    const updatedContent = data.content !== undefined ? data.content : existing.content;
    const updatedRecord: LkpdRecord = {
      ...existing,
      title: data.title?.trim() || existing.title,
      status: data.status || existing.status,
      updatedAt: now,
      version: newVersion,
      teacherInput: data.teacherInput
        ? { ...existing.teacherInput, ...data.teacherInput }
        : existing.teacherInput,
      content: updatedContent,
      changelog: data.changelog || `Pembaruan revisi versi ${newVersion}`,
      versionsHistory: [
        ...(existing.versionsHistory || []),
        {
          version: newVersion,
          updatedAt: now,
          changelog: data.changelog || `Versi ${newVersion}`,
          content: updatedContent,
        },
      ],
    };

    collections.lkpd[index] = updatedRecord;

    const updatedDocs = {
      ...currentDocs,
      collections,
    };

    await projectRepository.updateProject(
      projectId,
      institutionId,
      {
        documents: updatedDocs,
        expectedProjectUpdatedAt: data.expectedProjectUpdatedAt,
      },
      userId
    );
    return updatedRecord;
  }
}

export const modulAjarRepository = new ModulAjarRepository();
