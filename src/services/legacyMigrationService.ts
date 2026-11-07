/**
 * EduTaktis SaaS — Legacy Project Data Migration Service (Phase 3C)
 *
 * Implements a strict, 8-phase safe migration architecture from browser localStorage
 * to the MariaDB / MySQL tenant relational database:
 * 1. Data Preview
 * 2. Ownership Identification
 * 3. Institution Identification
 * 4. Structural Schema Validation
 * 5. User Explicit Approval
 * 6. Duplicate Detection
 * 7. Pre-commit Composite Integrity Validation
 * 8. Comprehensive Audit & Migration Report
 *
 * NOTE: As per Phase 3C security constraints, real user data migration is NOT
 * executed automatically without user review and confirmation.
 */

import { Project } from '../types';
import { AuthenticatedUser } from '../security/authService';

export type MigrationStatus =
  | 'READY_FOR_MIGRATION'
  | 'NEEDS_CONFIRMATION'
  | 'DUPLICATE_SKIPPED'
  | 'INVALID_SCHEMA'
  | 'MIGRATED_SUCCESS';

export interface LegacyMigrationItem {
  localId: string;
  projectName: string;
  identifiedOwnerName?: string;
  identifiedOwnerNip?: string;
  isOwnerMatch: boolean;
  identifiedInstitutionName?: string;
  isInstitutionMatch: boolean;
  structuralErrors: string[];
  status: MigrationStatus;
  statusReason: string;
  sanitizedProjectData?: any;
}

export interface LegacyMigrationReport {
  timestamp: string;
  totalLegacyProjects: number;
  readyCount: number;
  needsConfirmationCount: number;
  duplicateCount: number;
  invalidCount: number;
  approvalConfirmed: boolean;
  canProceedToCommit: boolean;
  items: LegacyMigrationItem[];
}

export class LegacyMigrationService {
  /**
   * Phase 4: Structural Schema Validation
   */
  validateProjectStructure(project: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!project || typeof project !== 'object') {
      return { valid: false, errors: ['Format data proyek bukan objek JSON valid.'] };
    }

    if (!project.id || typeof project.id !== 'string') {
      errors.push('ID proyek hilang atau tidak valid.');
    }

    if (!project.name || typeof project.name !== 'string' || project.name.trim().length === 0) {
      errors.push('Nama proyek kosong atau tidak valid.');
    }

    if (!project.masterInput || typeof project.masterInput !== 'object') {
      errors.push('Data Master Input hilang atau rusak.');
    } else {
      const mi = project.masterInput;
      if (!mi.mataPelajaran || typeof mi.mataPelajaran !== 'string') {
        errors.push('Mata pelajaran pada Master Input belum diisi.');
      }
      if (!mi.fase || typeof mi.fase !== 'string') {
        errors.push('Fase kurikulum belum ditentukan.');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Phase 1 to 4: Preview legacy projects and match ownership & institution
   */
  previewLegacyProjects(params: {
    rawProjects: any[];
    currentUser: AuthenticatedUser;
    currentInstitution: {
      id: string;
      namaResmi: string;
      namaSingkat: string;
      npsn?: string;
    };
    existingTenantProjectNames?: string[];
  }): LegacyMigrationReport {
    const items: LegacyMigrationItem[] = [];
    const existingNames = new Set((params.existingTenantProjectNames || []).map((n) => n.trim().toLowerCase()));

    let readyCount = 0;
    let needsConfirmationCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    for (const raw of params.rawProjects) {
      // 1. Structure validation
      const validation = this.validateProjectStructure(raw);
      if (!validation.valid) {
        items.push({
          localId: raw?.id || 'unknown',
          projectName: raw?.name || 'Proyek Tanpa Nama',
          isOwnerMatch: false,
          isInstitutionMatch: false,
          structuralErrors: validation.errors,
          status: 'INVALID_SCHEMA',
          statusReason: `Struktur data tidak valid: ${validation.errors.join('; ')}`,
        });
        invalidCount++;
        continue;
      }

      const mi = raw.masterInput;
      const cleanProjName = raw.name.trim();

      // 2. Duplicate detection
      if (existingNames.has(cleanProjName.toLowerCase())) {
        items.push({
          localId: raw.id,
          projectName: cleanProjName,
          identifiedOwnerName: mi.namaGuru,
          identifiedOwnerNip: mi.nipGuru,
          isOwnerMatch: true,
          identifiedInstitutionName: mi.namaMadrasah,
          isInstitutionMatch: true,
          structuralErrors: [],
          status: 'DUPLICATE_SKIPPED',
          statusReason: 'Proyek dengan nama yang sama sudah tersimpan di server institusi.',
        });
        duplicateCount++;
        continue;
      }

      // 3. Ownership identification
      const userFullName = params.currentUser.namaLengkap.toLowerCase();
      const teacherName = (mi.namaGuru || '').toLowerCase();
      const userNip = params.currentUser.nip?.replace(/\D/g, '') || '';
      const teacherNip = (mi.nipGuru || '').replace(/\D/g, '');

      const isNipMatch = Boolean(userNip && teacherNip && userNip === teacherNip);
      const isNameMatch = Boolean(
        teacherName && (userFullName.includes(teacherName) || teacherName.includes(userFullName))
      );
      const isOwnerMatch = isNipMatch || isNameMatch;

      // 4. Institution identification
      const instOfficial = params.currentInstitution.namaResmi.toLowerCase();
      const instShort = params.currentInstitution.namaSingkat.toLowerCase();
      const schoolName = (mi.namaMadrasah || '').toLowerCase();
      const isInstitutionMatch = Boolean(
        schoolName && (instOfficial.includes(schoolName) || schoolName.includes(instShort))
      );

      // Determine readiness
      if (isOwnerMatch && isInstitutionMatch) {
        items.push({
          localId: raw.id,
          projectName: cleanProjName,
          identifiedOwnerName: mi.namaGuru,
          identifiedOwnerNip: mi.nipGuru,
          isOwnerMatch: true,
          identifiedInstitutionName: mi.namaMadrasah,
          isInstitutionMatch: true,
          structuralErrors: [],
          status: 'READY_FOR_MIGRATION',
          statusReason: 'Identitas guru dan madrasah terverifikasi cocok dengan sesi aktif.',
          sanitizedProjectData: {
            name: cleanProjName,
            masterInput: mi,
            documents: raw.documents || {},
          },
        });
        readyCount++;
      } else {
        const reasonParts: string[] = [];
        if (!isOwnerMatch) reasonParts.push('Identitas guru pada data lokal berbeda dari akun yang sedang login');
        if (!isInstitutionMatch) reasonParts.push('Madrasah pada data lokal berbeda dari institusi aktif');

        items.push({
          localId: raw.id,
          projectName: cleanProjName,
          identifiedOwnerName: mi.namaGuru,
          identifiedOwnerNip: mi.nipGuru,
          isOwnerMatch,
          identifiedInstitutionName: mi.namaMadrasah,
          isInstitutionMatch,
          structuralErrors: [],
          status: 'NEEDS_CONFIRMATION',
          statusReason: `Memerlukan konfirmasi pengguna: ${reasonParts.join(', ')}.`,
          sanitizedProjectData: {
            name: cleanProjName,
            masterInput: mi,
            documents: raw.documents || {},
          },
        });
        needsConfirmationCount++;
      }
    }

    return {
      timestamp: new Date().toISOString(),
      totalLegacyProjects: params.rawProjects.length,
      readyCount,
      needsConfirmationCount,
      duplicateCount,
      invalidCount,
      approvalConfirmed: false,
      canProceedToCommit: readyCount > 0,
      items,
    };
  }

  /**
   * Phase 5 to 8: Plan migration execution with explicit user approval guard
   */
  planMigrationExecution(
    report: LegacyMigrationReport,
    userApprovalConfirmed: boolean
  ): {
    success: boolean;
    migratedCount: number;
    skippedCount: number;
    error?: string;
    finalReport: LegacyMigrationReport;
  } {
    if (!userApprovalConfirmed) {
      return {
        success: false,
        migratedCount: 0,
        skippedCount: report.totalLegacyProjects,
        error: 'Persetujuan pengguna belum dikonfirmasi. Migrasi data dibatalkan secara aman.',
        finalReport: { ...report, approvalConfirmed: false },
      };
    }

    const updatedItems = report.items.map((item) => {
      if (item.status === 'READY_FOR_MIGRATION') {
        return {
          ...item,
          status: 'MIGRATED_SUCCESS' as MigrationStatus,
          statusReason: 'Data tervalidasi dan siap ditransfer ke database MariaDB.',
        };
      }
      return item;
    });

    return {
      success: true,
      migratedCount: report.readyCount,
      skippedCount: report.needsConfirmationCount + report.duplicateCount + report.invalidCount,
      finalReport: {
        ...report,
        approvalConfirmed: true,
        items: updatedItems,
      },
    };
  }
}

export const legacyMigrationService = new LegacyMigrationService();
