import {
  DocumentType,
  MasterInputData,
  Project,
  AcpData,
  TpData,
  AtpData,
  ProtaData,
  ProsemData,
  KktpData,
} from '../types';
import {
  generateDeterministicACP,
  generateDeterministicTP,
  generateDeterministicATP,
  generateDeterministicPROTA,
  generateDeterministicPROSEM,
  generateDeterministicKKTP,
} from './defaultData';

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

// Generate document using Server API or reliable deterministic engine
export async function executeDocumentGeneration(
  docType: DocumentType,
  masterInput: MasterInputData,
  documents: Project['documents']
): Promise<{ content: any; source: 'gemini_ai' | 'algorithmic_engine' }> {
  try {
    const response = await fetch('/api/generate-document', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    if (response.ok) {
      const result = await response.json();
      if (result.success && result.data) {
        return { content: result.data, source: 'gemini_ai' };
      }
    }
  } catch (err) {
    console.warn('Backend Gemini API call encountered error, using pedagogical algorithm:', err);
  }

  // Algorithmic high-precision engine fallback
  let generatedContent: any;
  switch (docType) {
    case 'ACP':
      generatedContent = generateDeterministicACP(masterInput);
      break;
    case 'TP':
      generatedContent = generateDeterministicTP(masterInput, documents.ACP.content as AcpData);
      break;
    case 'ATP':
      const tpData = (documents.TP.content as TpData) || generateDeterministicTP(masterInput);
      generatedContent = generateDeterministicATP(masterInput, tpData);
      break;
    case 'PROTA':
      const atpData =
        (documents.ATP.content as AtpData) ||
        generateDeterministicATP(
          masterInput,
          (documents.TP.content as TpData) || generateDeterministicTP(masterInput)
        );
      generatedContent = generateDeterministicPROTA(masterInput, atpData);
      break;
    case 'PROSEM':
      const protaData =
        (documents.PROTA.content as ProtaData) ||
        generateDeterministicPROTA(
          masterInput,
          (documents.ATP.content as AtpData) ||
            generateDeterministicATP(
              masterInput,
              (documents.TP.content as TpData) || generateDeterministicTP(masterInput)
            )
        );
      generatedContent = generateDeterministicPROSEM(masterInput, protaData);
      break;
    case 'KKTP':
      const kktpTp = (documents.TP.content as TpData) || generateDeterministicTP(masterInput);
      generatedContent = generateDeterministicKKTP(masterInput, kktpTp);
      break;
  }

  return { content: generatedContent, source: 'algorithmic_engine' };
}
