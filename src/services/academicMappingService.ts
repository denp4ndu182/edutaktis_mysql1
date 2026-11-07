import { projectRepository } from '../repositories/projectRepository';
import {
  TeacherGenerationInput,
  AcademicSourceReferences,
  AcpData,
  TpData,
  AtpData,
  TujuanPembelajaranItem,
  AcpElemenAnalisis,
} from '../types';

export interface AcademicMappingResult {
  projectId: string;
  masterInput: any;
  acpData: AcpData;
  tpData: TpData;
  atpData: AtpData | null;
  matchedTpItems: TujuanPembelajaranItem[];
  matchedAcpElements: AcpElemenAnalisis[];
  timeAllocationPerMeeting: {
    totalJP: number;
    jumlahPertemuan: number;
    jpPerPertemuan: number;
    keterangan: string;
  };
  sourceReferences: AcademicSourceReferences;
}

export class AcademicMappingService {
  /**
   * Verified backend mapping of project academic sources (ACP, TP, ATP).
   * Strictly validates selected TP codes against project database records.
   */
  async mapAcademicSources(
    projectId: string,
    institutionId: string,
    userId: string,
    input: TeacherGenerationInput
  ): Promise<AcademicMappingResult> {
    const project = await projectRepository.findProjectByIdAndInstitution(projectId, institutionId, userId);
    if (!project) {
      throw new Error('PREREQUISITE_ERROR: Proyek tidak ditemukan atau akses ditolak.');
    }

    const docs = (project.documents || {}) as any;
    const acpRecord = docs.ACP;
    const tpRecord = docs.TP;
    const atpRecord = docs.ATP;

    // 1. Prerequisite Validation: ACP and TP must exist in database
    if (!acpRecord || (!acpRecord.content && acpRecord.status !== 'completed')) {
      throw new Error('PREREQUISITE_ERROR: Dokumen Analisis Capaian Pembelajaran (ACP) belum disusun pada proyek ini.');
    }

    if (!tpRecord || (!tpRecord.content && tpRecord.status !== 'completed')) {
      throw new Error('PREREQUISITE_ERROR: Dokumen Tujuan Pembelajaran (TP) belum disusun pada proyek ini.');
    }

    const acpData = acpRecord.content as AcpData;
    const tpData = tpRecord.content as TpData;
    const atpData = (atpRecord && (atpRecord.content || atpRecord.status === 'completed'))
      ? (atpRecord.content as AtpData)
      : null;

    const warnings: string[] = [];

    // 2. Validate selected TP codes against official project TP list
    const validTpList: TujuanPembelajaranItem[] = tpData.listTP || [];
    const validTpCodes = validTpList.map((t) => t.kodeTP);

    let matchedTpItems: TujuanPembelajaranItem[] = [];
    if (input.selectedTpCodes && input.selectedTpCodes.length > 0) {
      const invalidCodes = input.selectedTpCodes.filter((code) => !validTpCodes.includes(code));
      if (invalidCodes.length > 0) {
        throw new Error(
          `INVALID_TP_CODE: Kode TP yang dipilih [${invalidCodes.join(', ')}] tidak ditemukan pada dokumen TP proyek resmi ini.`
        );
      }
      matchedTpItems = validTpList.filter((t) => input.selectedTpCodes!.includes(t.kodeTP));
    } else {
      // If no explicit TP code selected, find TP items matching the materiPokok or select all
      const lowerTopic = input.materiPokok.toLowerCase();
      matchedTpItems = validTpList.filter(
        (t) =>
          t.materiPokok.toLowerCase().includes(lowerTopic) ||
          t.rumusanTP.toLowerCase().includes(lowerTopic)
      );
      if (matchedTpItems.length === 0) {
        matchedTpItems = validTpList; // Fallback to all available TP items
      }
    }

    // 3. Check ATP availability
    let atpAvailable = false;
    if (atpData) {
      atpAvailable = true;
    } else {
      warnings.push('Dokumen Alur Tujuan Pembelajaran (ATP) belum tersedia. Urutan TP standar digunakan sebagai acuan alur dasar.');
    }

    // 4. Map teacher topic to ACP elements & essential topics
    const matchedAcpElements: AcpElemenAnalisis[] = (acpData.analisisElemen || []).filter((el) => {
      const topicLower = input.materiPokok.toLowerCase();
      const matchName = el.namaElemen.toLowerCase().includes(topicLower);
      const matchEssential = el.materiEsensial.some((m) => m.toLowerCase().includes(topicLower));
      return matchName || matchEssential;
    });

    // 5. Calculate time allocation per meeting
    const totalJP = input.alokasiWaktu > 0 ? input.alokasiWaktu : 6;
    const jumlahPertemuan = input.jumlahPertemuan > 0 ? input.jumlahPertemuan : 2;
    const jpPerPertemuan = Math.max(1, Math.round(totalJP / jumlahPertemuan));

    const sourceReferences: AcademicSourceReferences = {
      acpAvailable: true,
      tpAvailable: true,
      atpAvailable,
      selectedTpCodes: matchedTpItems.map((t) => t.kodeTP),
      tpItems: matchedTpItems.map((t) => ({
        kodeTP: t.kodeTP,
        rumusanTP: t.rumusanTP,
        materiPokok: t.materiPokok,
      })),
      acpSummary: acpData.rasionalMapel || '',
      warnings,
    };

    return {
      projectId,
      masterInput: project.masterInput,
      acpData,
      tpData,
      atpData,
      matchedTpItems,
      matchedAcpElements: matchedAcpElements.length > 0 ? matchedAcpElements : acpData.analisisElemen || [],
      timeAllocationPerMeeting: {
        totalJP,
        jumlahPertemuan,
        jpPerPertemuan,
        keterangan: `${jpPerPertemuan} JP per pertemuan (Total ${totalJP} JP / ${jumlahPertemuan} Pertemuan)`,
      },
      sourceReferences,
    };
  }
}

export const academicMappingService = new AcademicMappingService();
