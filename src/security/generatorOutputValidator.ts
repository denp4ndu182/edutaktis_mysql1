import type { AnyDocumentContent, DocumentType } from '../types';

export type GeneratorOutputErrorCode = 'INVALID_GENERATOR_OUTPUT';

export type GeneratorOutputValidationResult =
  | { valid: true; data: AnyDocumentContent }
  | { valid: false; code: GeneratorOutputErrorCode; error: string };

type Schema =
  | { kind: 'string'; max: number }
  | { kind: 'number'; min: number; max: number }
  | { kind: 'array'; items: Schema; maxItems: number; minItems: number; exactItems?: number }
  | { kind: 'object'; fields: Record<string, Schema>; optional?: readonly string[] }
  | { kind: 'record'; values: Schema; maxKeys: number };

const str = (max = 12000): Schema => ({ kind: 'string', max });
const num = (min = 0, max = 1000000): Schema => ({ kind: 'number', min, max });
const arr = (
  items: Schema,
  maxItems = 200,
  minItems = 0,
  exactItems?: number,
): Schema => ({ kind: 'array', items, maxItems, minItems, exactItems });
const obj = (
  fields: Record<string, Schema>,
  optional: readonly string[] = [],
): Schema => ({ kind: 'object', fields, optional });
const record = (values: Schema, maxKeys = 50): Schema => ({
  kind: 'record',
  values,
  maxKeys,
});

const identity = record(str(1000), 50);

const calendarMonth = obj({
  bulan: str(100),
  mingguKalender: num(0, 100),
  mingguTidakEfektif: num(0, 100),
  mingguEfektif: num(0, 100),
  jp: num(0, 1000),
  keterangan: str(1000),
});

const acpSchema = obj({
  identitas: identity,
  rasionalMapel: str(),
  cpUmum: str(),
  analisisElemen: arr(
    obj({
      kodeElemen: str(100),
      namaElemen: str(500),
      kalimatCP: str(5000),
      kompetensi: arr(str(1000), 50),
      materiEsensial: arr(str(1000), 50),
      kedalamanKeluasan: str(5000),
    }),
    100,
  ),
  integrasiKBCPPRA: obj({
    kbcApplication: str(5000),
    ppraApplication: str(5000),
  }),
  rekomendasiPembelajaran: str(5000),
  rekomendasiAsesmen: str(5000),
});

const tpItem = obj({
  no: num(1, 10000),
  kodeTP: str(100),
  elemen: str(500),
  rumusanTP: str(5000),
  kompetensi: str(1000),
  materiPokok: str(5000),
  integrasiPancaCinta: str(3000),
  integrasiPPRA: str(3000),
  alokasiJP: num(0, 1000),
});

const tpSchema = obj({
  identitas: identity,
  pemetaanElemen: arr(
    obj({
      elemen: str(500),
      ringkasanCP: str(5000),
      jumlahTP: num(0, 10000),
    }),
    100,
  ),
  listTP: arr(tpItem, 200),
  totalJP: num(0, 100000),
});

const atpItem = obj({
  no: num(1, 10000),
  alurUrutan: num(1, 10000),
  kodeTP: str(100),
  elemen: str(500),
  rumusanTP: str(5000),
  materiPokok: str(5000),
  aspekKompetensi: str(3000),
  integrasiKbcPpra: str(5000),
  alokasiJP: num(0, 1000),
  semester: str(100),
});

const atpSchema = obj({
  identitas: identity,
  visualDiagram: arr(
    obj({
      tahap: str(1000),
      semester: str(100),
      deskripsiAlur: str(5000),
      tpCodes: arr(str(100), 200),
    }),
    50,
  ),
  listATP: arr(atpItem, 200),
  totalJPSemester1: num(0, 100000),
  totalJPSemester2: num(0, 100000),
  totalJPTahunan: num(0, 200000),
});

const protaDistribution = obj({
  semester: str(100),
  bulanList: arr(calendarMonth, 12),
  totalMingguKalender: num(0, 1000),
  totalMingguTidakEfektif: num(0, 1000),
  totalMingguEfektif: num(0, 1000),
  totalJP: num(0, 100000),
});

const protaSchema = obj({
  identitas: identity,
  distribusiMinggu: obj({
    semesterGanjil: protaDistribution,
    semesterGenap: protaDistribution,
  }),
  rencanaAlokasi: arr(
    obj({
      no: num(1, 10000),
      semester: str(100),
      kodeTP: str(100),
      tujuanDanMateri: str(10000),
      elemenCP: str(1000),
      integrasiKBCPPRA: str(5000),
      alokasiJP: num(0, 1000),
    }),
    200,
  ),
  rekapitulasi: obj({
    subtotalGanjilJP: num(0, 100000),
    subtotalGenapJP: num(0, 100000),
    totalTahunJP: num(0, 200000),
    alokasiTargetJP: num(0, 200000),
    keteranganStatus: str(1000),
  }),
});

const prosemItem = obj({
  no: num(1, 10000),
  kodeTP: str(100),
  tujuanDanMateri: str(10000),
  alokasiJP: num(0, 1000),
  integrasiKbcPpra: str(5000),
  distribusiBulan: record(arr(num(0, 1000), 5, 5, 5), 12),
});

const prosemSemester = obj({
  semesterName: str(100),
  months: arr(str(100), 12),
  items: arr(prosemItem, 200),
  totalJPSemester: num(0, 100000),
  mingguEfektifCount: num(0, 1000),
});

const prosemSchema = obj({
  identitas: identity,
  legenda: arr(
    obj({
      simbol: str(100),
      keterangan: str(1000),
      warna: str(200),
    }),
    30,
  ),
  semesterGanjil: prosemSemester,
  semesterGenap: prosemSemester,
  rekapitulasi: obj({
    ganjilJP: num(0, 100000),
    genapJP: num(0, 100000),
    totalJP: num(0, 200000),
  }),
});

const kktpRubric = obj({
  kodeTP: str(100),
  rumusanTP: str(5000),
  indikatorKetercapaian: arr(str(3000), 50),
  kriteria: obj(
    {
      perluBimbingan: str(5000),
      cukup: str(5000),
      baik: str(5000),
      sangatBaik: str(5000),
      mahir: str(5000),
    },
    ['sangatBaik', 'mahir'],
  ),
  buktiAsesmen: str(5000),
  rencanaTindakLanjut: obj({
    remedial: str(5000),
    pengayaan: str(5000),
  }),
});

const kktpSchema = obj({
  identitas: identity,
  deskripsiLevelUmum: arr(
    obj({
      interval: str(100),
      kategori: str(200),
      keterangan: str(3000),
    }),
    20,
  ),
  listRubrik: arr(kktpRubric, 200),
  strategiAsesmen: str(5000),
  tindakLanjutUmum: str(5000),
});

const SCHEMAS: Record<DocumentType, Schema> = {
  ACP: acpSchema,
  TP: tpSchema,
  ATP: atpSchema,
  PROTA: protaSchema,
  PROSEM: prosemSchema,
  KKTP: kktpSchema,
};

class OutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OutputValidationError';
  }
}

function fail(path: string, message: string): never {
  throw new OutputValidationError(`${path}: ${message}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validate(
  value: unknown,
  schema: Schema,
  path: string,
  depth = 0,
): void {
  if (depth > 8) fail(path, 'kedalaman struktur melebihi batas 8 tingkat.');

  switch (schema.kind) {
    case 'string': {
      if (typeof value !== 'string') fail(path, 'harus berupa teks.');
      if (value.length > schema.max) {
        fail(path, `melebihi batas ${schema.max} karakter.`);
      }
      return;
    }

    case 'number': {
      if (
        typeof value !== 'number' ||
        !Number.isSafeInteger(value) ||
        value < schema.min ||
        value > schema.max
      ) {
        fail(path, `harus berupa bilangan bulat ${schema.min} sampai ${schema.max}.`);
      }
      return;
    }

    case 'array': {
      if (!Array.isArray(value)) fail(path, 'harus berupa array.');
      if (value.length < schema.minItems || value.length > schema.maxItems) {
        fail(path, `jumlah elemen harus ${schema.minItems} sampai ${schema.maxItems}.`);
      }
      if (schema.exactItems !== undefined && value.length !== schema.exactItems) {
        fail(path, `harus memiliki tepat ${schema.exactItems} elemen.`);
      }

      value.forEach((item, index) => {
        validate(item, schema.items, `${path}[${index}]`, depth + 1);
      });
      return;
    }

    case 'object': {
      if (!isPlainObject(value)) fail(path, 'harus berupa objek biasa.');

      const allowed = new Set(Object.keys(schema.fields));
      const optional = new Set(schema.optional ?? []);

      for (const key of Object.keys(value)) {
        if (
          key === '__proto__' ||
          key === 'prototype' ||
          key === 'constructor' ||
          !allowed.has(key)
        ) {
          fail(`${path}.${key}`, 'properti tidak dikenal atau tidak diizinkan.');
        }
      }

      for (const [key, fieldSchema] of Object.entries(schema.fields)) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          if (!optional.has(key)) fail(`${path}.${key}`, 'field wajib tidak tersedia.');
          continue;
        }

        validate(value[key], fieldSchema, `${path}.${key}`, depth + 1);
      }
      return;
    }

    case 'record': {
      if (!isPlainObject(value)) fail(path, 'harus berupa objek record.');
      const keys = Object.keys(value);

      if (keys.length > schema.maxKeys) {
        fail(path, `jumlah properti melebihi batas ${schema.maxKeys}.`);
      }

      for (const key of keys) {
        if (
          key.length === 0 ||
          key.length > 100 ||
          key === '__proto__' ||
          key === 'prototype' ||
          key === 'constructor'
        ) {
          fail(`${path}.${key}`, 'nama properti tidak valid.');
        }

        validate(value[key], schema.values, `${path}.${key}`, depth + 1);
      }
      return;
    }
  }
}

export function validateGeneratorOutput(
  docType: DocumentType,
  value: unknown,
): GeneratorOutputValidationResult {
  try {
    const schema = Object.prototype.hasOwnProperty.call(SCHEMAS, docType)
      ? SCHEMAS[docType]
      : undefined;

    if (!schema) {
      fail('docType', 'jenis dokumen tidak dikenal.');
    }

    validate(value, schema, `output.${docType}`);

    return {
      valid: true,
      data: value as AnyDocumentContent,
    };
  } catch (error) {
    return {
      valid: false,
      code: 'INVALID_GENERATOR_OUTPUT',
      error:
        error instanceof OutputValidationError
          ? error.message
          : 'Struktur output tidak dapat divalidasi.',
    };
  }
}
