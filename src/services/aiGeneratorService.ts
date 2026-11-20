import {
  DocumentType,
  MasterInputData,
  Project,
} from '../types';
import { secureFetch } from './authClient';

export interface PrerequisiteCheck {
  allowed: boolean;
  missingDocs: DocumentType[];
  message: string;
}

export function checkPrerequisites(
  docType: DocumentType,
  documents: Project['documents']
): PrerequisiteCheck {
  const missing: DocumentType[] = [];

  switch (docType) {
    case 'ACP':
      // ACP only requires Master Input
      return { allowed: true, missingDocs: [], message: 'Siap dibuat berdasarkan Master Input.' };

    case 'TP':
      if (documents.ACP.status !== 'completed' && !documents.ACP.content) {
        missing.push('ACP');
      }
      return {
        allowed: missing.length === 0,
        missingDocs: missing,
        message:
          missing.length === 0
            ? 'Siap dibuat (ACP tersedia).'
            : 'Disarankan menyusun Analisis Capaian Pembelajaran (ACP) terlebih dahulu agar rumusan TP konsisten.',
      };

    case 'ATP':
      if (documents.TP.status !== 'completed' && !documents.TP.content) {
        missing.push('TP');
      }
      return {
        allowed: missing.length === 0,
        missingDocs: missing,
        message:
          missing.length === 0
            ? 'Siap dibuat (TP tersedia).'
            : 'Wajib membuat Tujuan Pembelajaran (TP) terlebih dahulu sebelum menyusun Alur Tujuan Pembelajaran.',
      };

    case 'PROTA':
      if (documents.TP.status !== 'completed' && !documents.TP.content) missing.push('TP');
      if (documents.ATP.status !== 'completed' && !documents.ATP.content) missing.push('ATP');
      return {
        allowed: missing.length === 0,
        missingDocs: missing,
        message:
          missing.length === 0
            ? 'Siap dibuat (TP & ATP tersedia).'
            : `Memerlukan dokumen: ${missing.join(', ')} sebagai sumber alokasi JP tahunan.`,
      };

    case 'PROSEM':
      if (documents.PROTA.status !== 'completed' && !documents.PROTA.content) missing.push('PROTA');
      return {
        allowed: missing.length === 0,
        missingDocs: missing,
        message:
          missing.length === 0
            ? 'Siap dibuat (PROTA tersedia).'
            : 'Wajib menyusun Program Tahunan (PROTA) terlebih dahulu untuk mendistribusikan JP ke minggu efektif semester.',
      };

    case 'KKTP':
      if (documents.TP.status !== 'completed' && !documents.TP.content) missing.push('TP');
      return {
        allowed: missing.length === 0,
        missingDocs: missing,
        message:
          missing.length === 0
            ? 'Siap dibuat (TP tersedia).'
            : 'Wajib menyusun Tujuan Pembelajaran (TP) terlebih dahulu sebagai acuan rubrik kriteria ketercapaian.',
      };

    default:
      return { allowed: true, missingDocs: [], message: '' };
  }
}

// Generate document exclusively through the secured backend API.
export async function executeDocumentGeneration(
  docType: DocumentType,
  masterInput: MasterInputData,
  documents: Project['documents']
): Promise<{ content: any; source: 'gemini_ai' | 'algorithmic_engine' }> {
  const response = await secureFetch('/api/generate-document', {
    method: 'POST',
    body: JSON.stringify({
      docType,
      masterInput,
      previousDocs: {
        ACP: documents.ACP,
        TP: documents.TP,
        ATP: documents.ATP,
        PROTA: documents.PROTA,
        PROSEM: documents.PROSEM,
        KKTP: documents.KKTP,
      },
    }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof result?.error === 'string'
        ? result.error
        : `Permintaan generator gagal (HTTP ${response.status}).`;

    throw new Error(message);
  }

  if (!result || result.success !== true || !result.data) {
    throw new Error('Respons generator dari server tidak valid.');
  }

  if (
    result.source !== 'gemini_ai' &&
    result.source !== 'algorithmic_engine'
  ) {
    throw new Error('Sumber hasil generator dari server tidak dikenal.');
  }

  return {
    content: result.data,
    source: result.source,
  };
}
