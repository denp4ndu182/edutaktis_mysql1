import type {
  DocumentRecord,
  DocumentStatus,
  DocumentType,
  MasterInputData,
} from '../types';

const DOCUMENT_TYPES = ['ACP', 'TP', 'ATP', 'PROTA', 'PROSEM', 'KKTP'] as const;
const DOCUMENT_STATUSES: DocumentStatus[] = [
  'not_created',
  'generating',
  'completed',
  'needs_revision',
  'failed',
];

const MASTER_INPUT_KEYS = [
  'kemenagOrYayasan', 'namaMadrasah', 'alamatMadrasah', 'mataPelajaran',
  'kodeMapel', 'fase', 'kelas', 'tahunPelajaran', 'semester',
  'alokasiWaktuTotal', 'jpPerMinggu', 'modelPembelajaran', 'namaGuru',
  'nipGuru', 'namaKepala', 'nipKepala', 'kotaTandaTangan',
  'tanggalTandaTangan', 'kurikulum', 'rasionalMapel', 'cpUmum',
  'elemenCP', 'materiPokok', 'karakteristikPesertaDidik', 'modelPendekatan',
  'strategiAsesmen', 'pancaCinta', 'ppraValues', 'catatanKBC',
  'kalenderSemester1', 'kalenderSemester2', 'attachments',
] as const;

const STRING_LIMITS: Record<string, number> = {
  kemenagOrYayasan: 300,
  namaMadrasah: 200,
  alamatMadrasah: 500,
  mataPelajaran: 200,
  kodeMapel: 100,
  fase: 100,
  kelas: 100,
  tahunPelajaran: 30,
  semester: 50,
  modelPembelajaran: 1000,
  namaGuru: 200,
  nipGuru: 50,
  namaKepala: 200,
  nipKepala: 50,
  kotaTandaTangan: 100,
  tanggalTandaTangan: 50,
  kurikulum: 500,
  rasionalMapel: 12000,
  cpUmum: 12000,
  materiPokok: 10000,
  karakteristikPesertaDidik: 10000,
  modelPendekatan: 3000,
  strategiAsesmen: 5000,
  catatanKBC: 5000,
};

export type GeneratorRequestErrorCode =
  | 'INVALID_REQUEST'
  | 'INVALID_DOC_TYPE'
  | 'INVALID_MASTER_INPUT'
  | 'INVALID_PREVIOUS_DOCUMENTS'
  | 'GENERATION_PREREQUISITE_MISSING';

export interface ValidatedGeneratorRequest {
  docType: DocumentType;
  masterInput: MasterInputData;
  previousDocs: Partial<Record<DocumentType, DocumentRecord>>;
}

export type GeneratorRequestValidationResult =
  | { valid: true; data: ValidatedGeneratorRequest }
  | { valid: false; code: GeneratorRequestErrorCode; error: string };

class RequestValidationError extends Error {
  constructor(
    readonly code: GeneratorRequestErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

function fail(
  code: GeneratorRequestErrorCode,
  message: string,
): never {
  throw new RequestValidationError(code, message);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPlainObject(
  value: unknown,
  path: string,
  code: GeneratorRequestErrorCode,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) fail(code, `${path} harus berupa objek.`);
}

function assertExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  code: GeneratorRequestErrorCode,
): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!allowedSet.has(key)) fail(code, `${path}.${key} tidak dikenal.`);
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      fail(code, `${path}.${key} tidak diizinkan.`);
    }
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      fail(code, `${path}.${key} wajib tersedia.`);
    }
  }
}

function assertString(
  value: unknown,
  path: string,
  maxLength: number,
  code: GeneratorRequestErrorCode,
): asserts value is string {
  if (typeof value !== 'string') fail(code, `${path} harus berupa teks.`);
  if (value.length > maxLength) {
    fail(code, `${path} melebihi batas ${maxLength} karakter.`);
  }
}

function assertInteger(
  value: unknown,
  path: string,
  min: number,
  max: number,
  code: GeneratorRequestErrorCode,
): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) {
    fail(code, `${path} harus berupa bilangan bulat antara ${min} dan ${max}.`);
  }
}

function assertArray(
  value: unknown,
  path: string,
  maxItems: number,
  code: GeneratorRequestErrorCode,
): asserts value is unknown[] {
  if (!Array.isArray(value)) fail(code, `${path} harus berupa array.`);
  if (value.length > maxItems) {
    fail(code, `${path} melebihi batas ${maxItems} elemen.`);
  }
}

function validateMasterInput(value: unknown): MasterInputData {
  const code: GeneratorRequestErrorCode = 'INVALID_MASTER_INPUT';
  assertPlainObject(value, 'masterInput', code);
  assertExactKeys(value, MASTER_INPUT_KEYS, 'masterInput', code);

  for (const [field, maxLength] of Object.entries(STRING_LIMITS)) {
    assertString(value[field], `masterInput.${field}`, maxLength, code);
  }

  assertInteger(value.alokasiWaktuTotal, 'masterInput.alokasiWaktuTotal', 0, 2000, code);
  assertInteger(value.jpPerMinggu, 'masterInput.jpPerMinggu', 0, 100, code);

  assertArray(value.elemenCP, 'masterInput.elemenCP', 100, code);
  for (let index = 0; index < value.elemenCP.length; index++) {
    const item = value.elemenCP[index];
    const path = `masterInput.elemenCP[${index}]`;
    assertPlainObject(item, path, code);
    assertExactKeys(item, ['id', 'kode', 'nama', 'deskripsi'], path, code);
    assertString(item.id, `${path}.id`, 100, code);
    assertString(item.kode, `${path}.kode`, 100, code);
    assertString(item.nama, `${path}.nama`, 300, code);
    assertString(item.deskripsi, `${path}.deskripsi`, 5000, code);
  }

  assertPlainObject(value.pancaCinta, 'masterInput.pancaCinta', code);
  assertExactKeys(
    value.pancaCinta,
    [
      'cintaAllahRasul', 'cintaIlmu', 'cintaDiriSesama',
      'cintaLingkungan', 'cintaTanahAir', 'catatanPancaCinta',
    ],
    'masterInput.pancaCinta',
    code,
  );
  for (const key of [
    'cintaAllahRasul', 'cintaIlmu', 'cintaDiriSesama',
    'cintaLingkungan', 'cintaTanahAir',
  ]) {
    if (typeof value.pancaCinta[key] !== 'boolean') {
      fail(code, `masterInput.pancaCinta.${key} harus berupa boolean.`);
    }
  }
  assertString(
    value.pancaCinta.catatanPancaCinta,
    'masterInput.pancaCinta.catatanPancaCinta',
    5000,
    code,
  );

  assertArray(value.ppraValues, 'masterInput.ppraValues', 100, code);
  for (let index = 0; index < value.ppraValues.length; index++) {
    const item = value.ppraValues[index];
    const path = `masterInput.ppraValues[${index}]`;
    assertPlainObject(item, path, code);
    assertExactKeys(item, ['id', 'nama', 'arab', 'arti', 'terpilih', 'catatan'], path, code);
    assertString(item.id, `${path}.id`, 100, code);
    assertString(item.nama, `${path}.nama`, 300, code);
    assertString(item.arab, `${path}.arab`, 1000, code);
    assertString(item.arti, `${path}.arti`, 2000, code);
    if (typeof item.terpilih !== 'boolean') fail(code, `${path}.terpilih harus berupa boolean.`);
    assertString(item.catatan, `${path}.catatan`, 3000, code);
  }

  for (const field of ['kalenderSemester1', 'kalenderSemester2'] as const) {
    assertArray(value[field], `masterInput.${field}`, 12, code);
    for (let index = 0; index < value[field].length; index++) {
      const item = value[field][index];
      const path = `masterInput.${field}[${index}]`;
      assertPlainObject(item, path, code);
      assertExactKeys(
        item,
        ['bulan', 'mingguKalender', 'mingguTidakEfektif', 'mingguEfektif', 'jp', 'keterangan'],
        path,
        code,
      );
      assertString(item.bulan, `${path}.bulan`, 40, code);
      assertInteger(item.mingguKalender, `${path}.mingguKalender`, 0, 6, code);
      assertInteger(item.mingguTidakEfektif, `${path}.mingguTidakEfektif`, 0, 6, code);
      assertInteger(item.mingguEfektif, `${path}.mingguEfektif`, 0, 6, code);
      assertInteger(item.jp, `${path}.jp`, 0, 100, code);
      assertString(item.keterangan, `${path}.keterangan`, 1000, code);
    }
  }

  assertArray(value.attachments, 'masterInput.attachments', 20, code);
  let attachmentBytes = 0;
  for (let index = 0; index < value.attachments.length; index++) {
    const item = value.attachments[index];
    const path = `masterInput.attachments[${index}]`;
    assertPlainObject(item, path, code);
    assertExactKeys(item, ['id', 'name', 'size', 'type', 'uploadDate'], path, code);
    assertString(item.id, `${path}.id`, 100, code);
    assertString(item.name, `${path}.name`, 255, code);
    assertInteger(item.size, `${path}.size`, 0, 100 * 1024 * 1024, code);
    attachmentBytes += item.size as number;
    assertString(item.type, `${path}.type`, 150, code);
    assertString(item.uploadDate, `${path}.uploadDate`, 40, code);
  }
  if (attachmentBytes > 200 * 1024 * 1024) {
    fail(code, 'Total ukuran metadata lampiran melampaui batas 200 MB.');
  }

  return value as unknown as MasterInputData;
}

function validateJsonLike(
  value: unknown,
  path: string,
  depth = 0,
  budget = { nodes: 0 },
): void {
  budget.nodes++;
  if (budget.nodes > 10000) {
    fail('INVALID_PREVIOUS_DOCUMENTS', `${path} terlalu kompleks.`);
  }
  if (depth > 8) fail('INVALID_PREVIOUS_DOCUMENTS', `${path} terlalu dalam.`);

  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'string') {
    if (value.length > 20000) fail('INVALID_PREVIOUS_DOCUMENTS', `${path} terlalu panjang.`);
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('INVALID_PREVIOUS_DOCUMENTS', `${path} berisi angka tidak valid.`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 500) fail('INVALID_PREVIOUS_DOCUMENTS', `${path} memiliki terlalu banyak elemen.`);
    value.forEach((entry, index) => validateJsonLike(entry, `${path}[${index}]`, depth + 1, budget));
    return;
  }
  if (!isPlainObject(value)) {
    fail('INVALID_PREVIOUS_DOCUMENTS', `${path} harus berisi data JSON biasa.`);
  }
  const keys = Object.keys(value);
  if (keys.length > 100) fail('INVALID_PREVIOUS_DOCUMENTS', `${path} memiliki terlalu banyak properti.`);
  for (const key of keys) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      fail('INVALID_PREVIOUS_DOCUMENTS', `${path}.${key} tidak diizinkan.`);
    }
    validateJsonLike(value[key], `${path}.${key}`, depth + 1, budget);
  }
}

function validatePreviousDocument(
  value: unknown,
  expectedType: DocumentType,
): DocumentRecord {
  const code: GeneratorRequestErrorCode = 'INVALID_PREVIOUS_DOCUMENTS';
  const path = `previousDocs.${expectedType}`;
  assertPlainObject(value, path, code);
  const allowed = ['id', 'docType', 'version', 'status', 'createdAt', 'updatedAt', 'content', 'changelog', 'error'];
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) fail(code, `${path}.${key} tidak dikenal.`);
  }
  for (const key of ['id', 'docType', 'version', 'status', 'createdAt', 'updatedAt', 'content']) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) fail(code, `${path}.${key} wajib tersedia.`);
  }
  assertString(value.id, `${path}.id`, 100, code);
  if (value.docType !== expectedType) fail(code, `${path}.docType harus ${expectedType}.`);
  assertInteger(value.version, `${path}.version`, 1, 1000000, code);
  if (!DOCUMENT_STATUSES.includes(value.status as DocumentStatus)) {
    fail(code, `${path}.status tidak valid.`);
  }
  assertString(value.createdAt, `${path}.createdAt`, 50, code);
  assertString(value.updatedAt, `${path}.updatedAt`, 50, code);
  if (value.changelog !== undefined) assertString(value.changelog, `${path}.changelog`, 5000, code);
  if (value.error !== undefined) assertString(value.error, `${path}.error`, 2000, code);
  assertPlainObject(value.content, `${path}.content`, code);
  validateJsonLike(value.content, `${path}.content`);
  return value as unknown as DocumentRecord;
}

function assertStringArray(
  value: unknown,
  path: string,
  maxItems: number,
  maxLength: number,
  code: GeneratorRequestErrorCode,
): asserts value is string[] {
  assertArray(value, path, maxItems, code);
  for (let index = 0; index < value.length; index++) {
    assertString(value[index], `${path}[${index}]`, maxLength, code);
  }
}

function validateTujuanPembelajaranItem(value: unknown, path: string): void {
  const code: GeneratorRequestErrorCode = 'INVALID_PREVIOUS_DOCUMENTS';
  assertPlainObject(value, path, code);
  assertExactKeys(
    value,
    [
      'no', 'kodeTP', 'elemen', 'rumusanTP', 'kompetensi',
      'materiPokok', 'integrasiPancaCinta', 'integrasiPPRA', 'alokasiJP',
    ],
    path,
    code,
  );
  assertInteger(value.no, `${path}.no`, 1, 10000, code);
  assertString(value.kodeTP, `${path}.kodeTP`, 100, code);
  assertString(value.elemen, `${path}.elemen`, 300, code);
  assertString(value.rumusanTP, `${path}.rumusanTP`, 5000, code);
  assertString(value.kompetensi, `${path}.kompetensi`, 1000, code);
  assertString(value.materiPokok, `${path}.materiPokok`, 5000, code);
  assertString(value.integrasiPancaCinta, `${path}.integrasiPancaCinta`, 3000, code);
  assertString(value.integrasiPPRA, `${path}.integrasiPPRA`, 3000, code);
  assertInteger(value.alokasiJP, `${path}.alokasiJP`, 0, 1000, code);
}

function validateAtpItem(value: unknown, path: string): void {
  const code: GeneratorRequestErrorCode = 'INVALID_PREVIOUS_DOCUMENTS';
  assertPlainObject(value, path, code);
  assertExactKeys(
    value,
    [
      'no', 'alurUrutan', 'kodeTP', 'elemen', 'rumusanTP', 'materiPokok',
      'aspekKompetensi', 'integrasiKbcPpra', 'alokasiJP', 'semester',
    ],
    path,
    code,
  );
  assertInteger(value.no, `${path}.no`, 1, 10000, code);
  assertInteger(value.alurUrutan, `${path}.alurUrutan`, 1, 10000, code);
  assertString(value.kodeTP, `${path}.kodeTP`, 100, code);
  assertString(value.elemen, `${path}.elemen`, 300, code);
  assertString(value.rumusanTP, `${path}.rumusanTP`, 5000, code);
  assertString(value.materiPokok, `${path}.materiPokok`, 5000, code);
  assertString(value.aspekKompetensi, `${path}.aspekKompetensi`, 2000, code);
  assertString(value.integrasiKbcPpra, `${path}.integrasiKbcPpra`, 3000, code);
  assertInteger(value.alokasiJP, `${path}.alokasiJP`, 0, 1000, code);
  assertString(value.semester, `${path}.semester`, 50, code);
}

function validateProtaAllocationItem(value: unknown, path: string): void {
  const code: GeneratorRequestErrorCode = 'INVALID_PREVIOUS_DOCUMENTS';
  assertPlainObject(value, path, code);
  assertExactKeys(
    value,
    [
      'no', 'semester', 'kodeTP', 'tujuanDanMateri',
      'elemenCP', 'integrasiKBCPPRA', 'alokasiJP',
    ],
    path,
    code,
  );
  assertInteger(value.no, `${path}.no`, 1, 10000, code);
  assertString(value.semester, `${path}.semester`, 50, code);
  assertString(value.kodeTP, `${path}.kodeTP`, 100, code);
  assertString(value.tujuanDanMateri, `${path}.tujuanDanMateri`, 5000, code);
  assertString(value.elemenCP, `${path}.elemenCP`, 300, code);
  assertString(value.integrasiKBCPPRA, `${path}.integrasiKBCPPRA`, 3000, code);
  assertInteger(value.alokasiJP, `${path}.alokasiJP`, 0, 1000, code);
}

function validateRequiredContentItems(
  document: DocumentRecord,
  documentType: DocumentType,
): void {
  const code: GeneratorRequestErrorCode = 'GENERATION_PREREQUISITE_MISSING';
  const content = document.content as unknown as Record<string, unknown>;
  const config: Partial<Record<DocumentType, {
    key: string;
    validate: (item: unknown, path: string) => void;
  }>> = {
    TP: { key: 'listTP', validate: validateTujuanPembelajaranItem },
    ATP: { key: 'listATP', validate: validateAtpItem },
    PROTA: { key: 'rencanaAlokasi', validate: validateProtaAllocationItem },
  };
  const requirement = config[documentType];
  if (!requirement) return;

  const entries = content[requirement.key];
  if (!Array.isArray(entries) || entries.length === 0) {
    fail(code, `Dokumen ${documentType} belum memiliki ${requirement.key} yang dapat digunakan.`);
  }
  if (entries.length > 200) {
    fail('INVALID_PREVIOUS_DOCUMENTS', `Dokumen ${documentType}.${requirement.key} melebihi 200 item.`);
  }
  for (let index = 0; index < entries.length; index++) {
    requirement.validate(entries[index], `previousDocs.${documentType}.content.${requirement.key}[${index}]`);
  }
}

function validatePreviousDocs(
  value: unknown,
  docType: DocumentType,
): Partial<Record<DocumentType, DocumentRecord>> {
  const code: GeneratorRequestErrorCode = 'INVALID_PREVIOUS_DOCUMENTS';
  if (value === undefined || value === null) value = {};
  assertPlainObject(value, 'previousDocs', code);
  for (const key of Object.keys(value)) {
    if (!DOCUMENT_TYPES.includes(key as DocumentType)) {
      fail(code, `previousDocs.${key} bukan jenis dokumen yang dikenal.`);
    }
  }

  const requiredByType: Record<DocumentType, DocumentType[]> = {
    ACP: [],
    TP: ['ACP'],
    ATP: ['TP'],
    PROTA: ['TP', 'ATP'],
    PROSEM: ['PROTA'],
    KKTP: ['TP'],
  };

  const validated: Partial<Record<DocumentType, DocumentRecord>> = {};
  for (const requiredType of requiredByType[docType]) {
    if (!Object.prototype.hasOwnProperty.call(value, requiredType)) {
      fail('GENERATION_PREREQUISITE_MISSING', `Dokumen prasyarat ${requiredType} belum tersedia.`);
    }
    validated[requiredType] = validatePreviousDocument(value[requiredType], requiredType);
  }

  for (const requiredType of requiredByType[docType]) {
    validateRequiredContentItems(validated[requiredType]!, requiredType);
  }

  return validated;
}

export function validateGeneratorRequest(
  body: unknown,
): GeneratorRequestValidationResult {
  try {
    assertPlainObject(body, 'request', 'INVALID_REQUEST');
    assertExactKeys(body, ['docType', 'masterInput', 'previousDocs'], 'request', 'INVALID_REQUEST');
    assertString(body.docType, 'docType', 20, 'INVALID_DOC_TYPE');
    const normalizedDocType = body.docType.trim().toUpperCase();
    if (!DOCUMENT_TYPES.includes(normalizedDocType as DocumentType)) {
      fail('INVALID_DOC_TYPE', 'Jenis dokumen tidak didukung.');
    }

    const docType = normalizedDocType as DocumentType;
    const masterInput = validateMasterInput(body.masterInput);
    const previousDocs = validatePreviousDocs(body.previousDocs, docType);

    return { valid: true, data: { docType, masterInput, previousDocs } };
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return { valid: false, code: error.code, error: error.message };
    }
    return {
      valid: false,
      code: 'INVALID_REQUEST',
      error: 'Format permintaan tidak valid.',
    };
  }
}
