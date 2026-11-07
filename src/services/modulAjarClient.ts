/**
 * PHASE 2B — MODUL AJAR & LKPD CLIENT SERVICE
 * Handles API calls to protected tenant endpoints for Modul Ajar KBC and LKPD,
 * manages CSRF headers, handles OCC conflicts (HTTP 409), and keeps local storage synced.
 */

import {
  Project,
  TeacherGenerationInput,
  ModulAjarKbcRecord,
  LkpdRecord,
  ModulAjarKbcData,
  LkpdData,
} from '../types';
import { secureFetch } from './authClient';
import { saveProject } from './storageService';

export interface ClientApiResponse<T> {
  success: boolean;
  data?: T;
  source?: 'gemini_ai' | 'algorithmic_engine';
  message?: string;
  error?: string;
  code?: string;
  retryable?: boolean;
}

/**
 * Generate Modul Ajar KBC via backend AI Generation Endpoint
 */
export async function generateModulAjarKbcApi(
  projectId: string,
  input: TeacherGenerationInput,
  activeInstitutionId?: string,
  expectedProjectUpdatedAt?: string
): Promise<ClientApiResponse<ModulAjarKbcRecord>> {
  try {
    const res = await secureFetch(
      `/api/tenant/projects/${projectId}/modul-ajar/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          materiPokok: input.materiPokok,
          gayaMengajar: input.gayaMengajar,
          modelPembelajaran: input.modelPembelajaran,
          alokasiWaktu: input.alokasiWaktu,
          jumlahPertemuan: input.jumlahPertemuan,
          karakteristikKelas: input.karakteristikKelas,
          catatanKhusus: input.catatanKhusus,
          selectedTpCodes: input.selectedTpCodes,
          expectedProjectUpdatedAt,
        }),
      },
      activeInstitutionId
    );

    const data = await res.json();

    if (res.status === 409 || data.code === 'OCC_CONFLICT') {
      return {
        success: false,
        code: 'OCC_CONFLICT',
        error: 'Konflik Konkurensi: Proyek telah diperbarui oleh pengguna lain. Silakan muat ulang data terbaru.',
      };
    }

    if (res.status === 400 || data.code === 'PREREQUISITE_FAILED') {
      return {
        success: false,
        code: 'PREREQUISITE_FAILED',
        error: data.error || 'Prasyarat dokumen (ACP / TP) belum terpenuhi.',
      };
    }

    if (res.status === 403 || data.code === 'INSUFFICIENT_PROJECT_EDIT_PERMISSION') {
      return {
        success: false,
        code: 'FORBIDDEN',
        error: data.error || 'Akses ditolak: Anda tidak memiliki izin mengedit proyek ini.',
      };
    }

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Gagal memproses generasi Modul Ajar KBC.',
        code: data.code || 'SERVER_ERROR',
      };
    }

    return {
      success: true,
      data: data.data,
      source: data.source,
      message: data.message,
    };
  } catch (err: any) {
    console.error('generateModulAjarKbcApi error:', err);
    return {
      success: false,
      error: err.message || 'Gagal terhubung dengan server backend.',
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Generate LKPD via backend AI Generation Endpoint
 */
export async function generateLkpdApi(
  projectId: string,
  params: {
    mode: 'FROM_MODULE' | 'FROM_ACADEMIC_DATA';
    sourceModuleId?: string;
    materiPokok: string;
    teacherInput?: Partial<TeacherGenerationInput>;
  },
  activeInstitutionId?: string,
  expectedProjectUpdatedAt?: string
): Promise<ClientApiResponse<LkpdRecord>> {
  try {
    const res = await secureFetch(
      `/api/tenant/projects/${projectId}/lkpd/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          mode: params.mode,
          sourceModuleId: params.sourceModuleId,
          materiPokok: params.materiPokok,
          teacherInput: params.teacherInput,
          expectedProjectUpdatedAt,
        }),
      },
      activeInstitutionId
    );

    const data = await res.json();

    if (res.status === 409 || data.code === 'OCC_CONFLICT') {
      return {
        success: false,
        code: 'OCC_CONFLICT',
        error: 'Konflik Konkurensi: Proyek telah diperbarui oleh pengguna lain.',
      };
    }

    if (res.status === 400 || data.code === 'PREREQUISITE_FAILED') {
      return {
        success: false,
        code: 'PREREQUISITE_FAILED',
        error: data.error || 'Prasyarat data akademik belum terpenuhi.',
      };
    }

    if (res.status === 403) {
      return {
        success: false,
        code: 'FORBIDDEN',
        error: data.error || 'Akses ditolak: Anda tidak memiliki izin membuat LKPD.',
      };
    }

    if (!res.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Gagal memproses generasi LKPD.',
        code: data.code || 'SERVER_ERROR',
      };
    }

    return {
      success: true,
      data: data.data,
      source: data.source,
      message: data.message,
    };
  } catch (err: any) {
    console.error('generateLkpdApi error:', err);
    return {
      success: false,
      error: err.message || 'Gagal terhubung dengan server backend.',
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Update Modul Ajar record
 */
export async function updateModulAjarApi(
  projectId: string,
  documentId: string,
  data: {
    title?: string;
    content?: ModulAjarKbcData;
    status?: 'draft' | 'completed' | 'needs_revision';
    changelog?: string;
    teacherInput?: Partial<TeacherGenerationInput>;
    expectedProjectUpdatedAt?: string;
  },
  activeInstitutionId?: string
): Promise<ClientApiResponse<ModulAjarKbcRecord>> {
  try {
    const res = await secureFetch(
      `/api/tenant/projects/${projectId}/modul-ajar/${documentId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      activeInstitutionId
    );

    const resData = await res.json();

    if (res.status === 409 || resData.code === 'OCC_CONFLICT') {
      return {
        success: false,
        code: 'OCC_CONFLICT',
        error: 'Konflik Konkurensi: Data proyek telah diperbarui oleh pengguna lain. Silakan muat ulang.',
      };
    }

    if (!res.ok || !resData.success) {
      return {
        success: false,
        error: resData.error || 'Gagal memperbarui Modul Ajar.',
        code: resData.code || 'UPDATE_FAILED',
      };
    }

    return {
      success: true,
      data: resData.data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal terhubung dengan server backend.',
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Update LKPD record
 */
export async function updateLkpdApi(
  projectId: string,
  documentId: string,
  data: {
    title?: string;
    content?: LkpdData;
    status?: 'draft' | 'completed' | 'needs_revision';
    changelog?: string;
    teacherInput?: Partial<TeacherGenerationInput>;
    expectedProjectUpdatedAt?: string;
  },
  activeInstitutionId?: string
): Promise<ClientApiResponse<LkpdRecord>> {
  try {
    const res = await secureFetch(
      `/api/tenant/projects/${projectId}/lkpd/${documentId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
      activeInstitutionId
    );

    const resData = await res.json();

    if (res.status === 409 || resData.code === 'OCC_CONFLICT') {
      return {
        success: false,
        code: 'OCC_CONFLICT',
        error: 'Konflik Konkurensi: Data proyek telah diperbarui oleh pengguna lain.',
      };
    }

    if (!res.ok || !resData.success) {
      return {
        success: false,
        error: resData.error || 'Gagal memperbarui LKPD.',
        code: resData.code || 'UPDATE_FAILED',
      };
    }

    return {
      success: true,
      data: resData.data,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Gagal terhubung dengan server backend.',
      code: 'NETWORK_ERROR',
    };
  }
}

/**
 * Helper to update local project state with new or updated collection records
 */
export function syncProjectCollectionToLocal(
  project: Project,
  record: ModulAjarKbcRecord | LkpdRecord,
  type: 'modulAjar' | 'lkpd'
): Project {
  const currentCollections = project.collections || { modulAjar: [], lkpd: [] };
  const list = [...(currentCollections[type] || [])] as any[];

  const index = list.findIndex((item) => item.id === record.id);
  if (index >= 0) {
    list[index] = record;
  } else {
    list.unshift(record);
  }

  const updatedProject: Project = {
    ...project,
    updatedAt: new Date().toISOString(),
    collections: {
      ...currentCollections,
      [type]: list,
    },
  };

  saveProject(updatedProject);
  return updatedProject;
}
