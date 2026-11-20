import assert from 'node:assert/strict';
import { EMPTY_MASTER_INPUT } from '../src/services/defaultData';
import {
  generateDeterministicACP,
  generateDeterministicTP,
  generateDeterministicATP,
  generateDeterministicPROTA,
  generateDeterministicPROSEM,
  generateDeterministicKKTP,
} from '../src/shared/deterministicDocumentGenerators';
import { validateGeneratorOutput } from '../src/security/generatorOutputValidator';
import type { DocumentType } from '../src/types';

const input = structuredClone(EMPTY_MASTER_INPUT);
const acp = generateDeterministicACP(input);
const tp = generateDeterministicTP(input, acp);
const atp = generateDeterministicATP(input, tp);
const prota = generateDeterministicPROTA(input, atp);
const prosem = generateDeterministicPROSEM(input, prota);
const kktp = generateDeterministicKKTP(input, tp);

const outputs: Record<DocumentType, unknown> = {
  ACP: acp,
  TP: tp,
  ATP: atp,
  PROTA: prota,
  PROSEM: prosem,
  KKTP: kktp,
};

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL: ${name}`, error);
  }
}

function expectInvalid(docType: DocumentType, value: unknown) {
  const result = validateGeneratorOutput(docType, value);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.code, 'INVALID_GENERATOR_OUTPUT');
  }
}

for (const [docType, output] of Object.entries(outputs) as [DocumentType, unknown][]) {
  test(`Output deterministik ${docType} diterima`, () => {
    const result = validateGeneratorOutput(docType, output);
    assert.equal(result.valid, true, JSON.stringify(result));
  });
}

test('ACP menolak field wajib yang hilang', () => {
  const value = structuredClone(acp) as unknown as Record<string, unknown>;
  delete value.cpUmum;
  expectInvalid('ACP', value);
});

test('ACP menolak properti asing', () => {
  expectInvalid('ACP', { ...acp, injected: true });
});

test('ACP menerima analisisElemen kosong', () => {
  assert.equal(
    validateGeneratorOutput('ACP', { ...acp, analisisElemen: [] }).valid,
    true,
  );
});

test('TP menerima kompetensi berupa string', () => {
  assert.equal(validateGeneratorOutput('TP', tp).valid, true);
});

test('TP menolak kompetensi berupa array', () => {
  const value = structuredClone(tp);
  (value.listTP[0] as { kompetensi: unknown }).kompetensi = ['teks'];
  expectInvalid('TP', value);
});

test('TP menolak listTP lebih dari 200 item', () => {
  const value = structuredClone(tp);
  value.listTP = Array.from({ length: 201 }, () => value.listTP[0]);
  expectInvalid('TP', value);
});

test('ATP menolak alokasiJP berupa teks', () => {
  const value = structuredClone(atp);
  (value.listATP[0] as { alokasiJP: unknown }).alokasiJP = 'dua';
  expectInvalid('ATP', value);
});

test('PROTA menolak mingguEfektif berupa angka negatif', () => {
  const value = structuredClone(prota);
  value.distribusiMinggu.semesterGanjil.totalMingguEfektif = -1;
  expectInvalid('PROTA', value);
});

test('PROSEM menerima key dinamis pada distribusiBulan', () => {
  const value = structuredClone(prosem);
  const firstItem = value.semesterGanjil.items[0];
  if (firstItem) {
    firstItem.distribusiBulan['Bulan Tambahan'] = [0, 0, 0, 0, 0];
  }
  assert.equal(validateGeneratorOutput('PROSEM', value).valid, true);
});

test('PROSEM menolak distribusi bulan bukan lima angka', () => {
  const value = structuredClone(prosem);
  const firstItem = value.semesterGanjil.items[0];
  if (firstItem) firstItem.distribusiBulan.Juli = [2, 0, 0];
  expectInvalid('PROSEM', value);
});

test('KKTP menerima field kriteria opsional yang tidak tersedia', () => {
  const value = structuredClone(kktp);
  const criteria = value.listRubrik[0]?.kriteria;
  if (criteria) {
    delete criteria.mahir;
    delete criteria.sangatBaik;
  }
  assert.equal(validateGeneratorOutput('KKTP', value).valid, true);
});

test('KKTP menolak field kriteria wajib yang hilang', () => {
  const value = structuredClone(kktp);
  const criteria = value.listRubrik[0]?.kriteria as Record<string, unknown>;
  delete criteria.baik;
  expectInvalid('KKTP', value);
});

test('Identitas menerima key dinamis dengan nilai string', () => {
  const value = structuredClone(acp);
  value.identitas.identitasTambahan = 'Data tambahan';
  assert.equal(validateGeneratorOutput('ACP', value).valid, true);
});

test('Identitas menolak nilai selain string', () => {
  const value = structuredClone(acp);
  (value.identitas as Record<string, unknown>).tambahan = { nested: true };
  expectInvalid('ACP', value);
});

test('Output null ditolak', () => {
  expectInvalid('ACP', null);
});

test('Output array pada root ditolak', () => {
  expectInvalid('ACP', []);
});

test('docType properti bawaan JavaScript ditolak', () => {
  expectInvalid('toString' as DocumentType, acp);
  expectInvalid('constructor' as DocumentType, acp);
});

console.log('');
console.log(`B12-05G-04C-03 RESULT: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
