import assert from 'node:assert/strict';
import { EMPTY_MASTER_INPUT } from '../src/services/defaultData';
import { validateGeneratorRequest } from '../src/security/generatorRequestValidator';

const clone = <T>(value: T): T => structuredClone(value);
const baseRequest = () => ({
  docType: 'ACP',
  masterInput: clone(EMPTY_MASTER_INPUT),
  previousDocs: {},
});

function validTpItem() {
  return {
    no: 1, kodeTP: 'TP-01', elemen: 'Berpikir Komputasional',
    rumusanTP: 'Peserta didik mampu menguraikan masalah.',
    kompetensi: 'Menguraikan masalah', materiPokok: 'Dekomposisi',
    integrasiPancaCinta: 'Cinta ilmu', integrasiPPRA: 'Bernalar kritis',
    alokasiJP: 2,
  };
}

function validAtpItem() {
  return {
    no: 1, alurUrutan: 1, kodeTP: 'TP-01', elemen: 'Berpikir Komputasional',
    rumusanTP: 'Peserta didik mampu menguraikan masalah.',
    materiPokok: 'Dekomposisi', aspekKompetensi: 'Berpikir kritis',
    integrasiKbcPpra: 'Cinta ilmu dan bernalar kritis', alokasiJP: 2,
    semester: 'Ganjil',
  };
}

function validProtaItem() {
  return {
    no: 1, semester: 'Ganjil', kodeTP: 'TP-01',
    tujuanDanMateri: 'Menguraikan masalah dengan dekomposisi',
    elemenCP: 'Berpikir Komputasional',
    integrasiKBCPPRA: 'Cinta ilmu dan bernalar kritis', alokasiJP: 2,
  };
}

function makeDocument(docType: string, content: Record<string, unknown>) {
  return {
    id: `test-${docType.toLowerCase()}`,
    docType,
    version: 1,
    status: 'completed',
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T00:00:00.000Z',
    content,
  };
}

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

function expectInvalid(request: unknown, code?: string) {
  const result = validateGeneratorRequest(request);
  assert.equal(result.valid, false);
  if (code && !result.valid) assert.equal(result.code, code);
}

test('Master Input kosong sesuai default diterima untuk ACP', () => {
  const result = validateGeneratorRequest(baseRequest());
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.data.docType, 'ACP');
});

test('docType lowercase dinormalisasi menjadi uppercase', () => {
  const request = baseRequest();
  request.docType = 'acp';
  const result = validateGeneratorRequest(request);
  assert.equal(result.valid, true);
  if (result.valid) assert.equal(result.data.docType, 'ACP');
});

test('Semua enam docType diterima saat prasyarat tersedia', () => {
  const documents = {
    ACP: makeDocument('ACP', { ringkasan: 'ACP' }),
    TP: makeDocument('TP', { listTP: [validTpItem()] }),
    ATP: makeDocument('ATP', { listATP: [validAtpItem()] }),
    PROTA: makeDocument('PROTA', { rencanaAlokasi: [validProtaItem()] }),
  };
  const cases = [
    ['ACP', {}],
    ['TP', { ACP: documents.ACP }],
    ['ATP', { TP: documents.TP }],
    ['PROTA', { TP: documents.TP, ATP: documents.ATP }],
    ['PROSEM', { PROTA: documents.PROTA }],
    ['KKTP', { TP: documents.TP }],
  ] as const;
  for (const [docType, previousDocs] of cases) {
    const result = validateGeneratorRequest({ ...baseRequest(), docType, previousDocs });
    assert.equal(result.valid, true, `${docType}: ${JSON.stringify(result)}`);
  }
});

test('Jenis dokumen tidak dikenal ditolak', () => {
  expectInvalid({ ...baseRequest(), docType: 'MODUL_AJAR' }, 'INVALID_DOC_TYPE');
});

test('Request bukan objek ditolak', () => {
  expectInvalid(null, 'INVALID_REQUEST');
});

test('Properti asing pada request ditolak', () => {
  expectInvalid({ ...baseRequest(), admin: true }, 'INVALID_REQUEST');
});

test('Master Input bukan objek ditolak', () => {
  const request = baseRequest();
  request.masterInput = null as never;
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

test('Properti asing pada Master Input ditolak', () => {
  const request = baseRequest();
  (request.masterInput as unknown as Record<string, unknown>).unexpected = 'x';
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

test('Tipe numerik Master Input salah ditolak', () => {
  const request = baseRequest();
  (request.masterInput as unknown as Record<string, unknown>).jpPerMinggu = 'dua';
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

test('Angka di luar batas ditolak', () => {
  const request = baseRequest();
  request.masterInput.jpPerMinggu = 101;
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

test('Panca Cinta dengan tipe boolean salah ditolak', () => {
  const request = baseRequest();
  (request.masterInput.pancaCinta as unknown as Record<string, unknown>).cintaIlmu = 'true';
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

test('Elemen CP melebihi batas ditolak', () => {
  const request = baseRequest();
  request.masterInput.elemenCP = Array.from({ length: 101 }, (_, index) => ({
    id: String(index), kode: 'K', nama: 'N', deskripsi: 'D',
  }));
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

test('Kalender lebih dari 12 bulan ditolak', () => {
  const request = baseRequest();
  request.masterInput.kalenderSemester1 = Array.from({ length: 13 }, () => ({
    bulan: 'Juli', mingguKalender: 4, mingguTidakEfektif: 0,
    mingguEfektif: 4, jp: 8, keterangan: '',
  }));
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

test('Lampiran dengan ukuran negatif ditolak', () => {
  const request = baseRequest();
  request.masterInput.attachments = [{
    id: 'x', name: 'x.pdf', size: -1, type: 'application/pdf', uploadDate: '2026-01-01',
  }];
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

test('TP tanpa ACP ditolak sebagai prasyarat hilang', () => {
  expectInvalid({ ...baseRequest(), docType: 'TP' }, 'GENERATION_PREREQUISITE_MISSING');
});

test('Dokumen prasyarat dengan docType tidak cocok ditolak', () => {
  const wrong = makeDocument('TP', { ringkasan: 'salah' });
  expectInvalid(
    { ...baseRequest(), docType: 'TP', previousDocs: { ACP: wrong } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('ATP menolak TP tanpa listTP', () => {
  const tp = makeDocument('TP', { daftar: [] });
  expectInvalid(
    { ...baseRequest(), docType: 'ATP', previousDocs: { TP: tp } },
    'GENERATION_PREREQUISITE_MISSING',
  );
});

test('TP menerima kompetensi berupa string sesuai tipe resmi', () => {
  const tp = makeDocument('TP', { listTP: [validTpItem()] });
  const result = validateGeneratorRequest({
    ...baseRequest(),
    docType: 'ATP',
    previousDocs: { TP: tp },
  });
  assert.equal(result.valid, true);
});

test('TP menolak kompetensi berupa array', () => {
  const item = { ...validTpItem(), kompetensi: ['Menguraikan masalah'] };
  const tp = makeDocument('TP', { listTP: [item] });
  expectInvalid(
    { ...baseRequest(), docType: 'ATP', previousDocs: { TP: tp } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('TP menolak item listTP yang bukan objek', () => {
  const tp = makeDocument('TP', { listTP: ['data-tidak-valid'] });
  expectInvalid(
    { ...baseRequest(), docType: 'ATP', previousDocs: { TP: tp } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('TP menolak item listTP yang kehilangan field wajib', () => {
  const item = validTpItem() as Record<string, unknown>;
  delete item.rumusanTP;
  const tp = makeDocument('TP', { listTP: [item] });
  expectInvalid(
    { ...baseRequest(), docType: 'ATP', previousDocs: { TP: tp } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('TP menolak properti asing pada item listTP', () => {
  const item = { ...validTpItem(), injected: true };
  const tp = makeDocument('TP', { listTP: [item] });
  expectInvalid(
    { ...baseRequest(), docType: 'ATP', previousDocs: { TP: tp } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('ATP menolak item listATP dengan tipe alokasiJP salah', () => {
  const item = { ...validAtpItem(), alokasiJP: 'dua' };
  const atp = makeDocument('ATP', { listATP: [item] });
  const tp = makeDocument('TP', { listTP: [validTpItem()] });
  expectInvalid(
    { ...baseRequest(), docType: 'PROTA', previousDocs: { TP: tp, ATP: atp } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('PROTA menolak item rencanaAlokasi dengan field wajib hilang', () => {
  const item = validProtaItem() as Record<string, unknown>;
  delete item.tujuanDanMateri;
  const prota = makeDocument('PROTA', { rencanaAlokasi: [item] });
  expectInvalid(
    { ...baseRequest(), docType: 'PROSEM', previousDocs: { PROTA: prota } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('Array item dokumen sumber dibatasi maksimal 200 elemen', () => {
  const tp = makeDocument('TP', { listTP: Array.from({ length: 201 }, validTpItem) });
  expectInvalid(
    { ...baseRequest(), docType: 'ATP', previousDocs: { TP: tp } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('PROTA memerlukan TP dan ATP', () => {
  const tp = makeDocument('TP', { listTP: [validTpItem()] });
  expectInvalid(
    { ...baseRequest(), docType: 'PROTA', previousDocs: { TP: tp } },
    'GENERATION_PREREQUISITE_MISSING',
  );
});

test('Properti asing pada previousDocs ditolak', () => {
  expectInvalid(
    { ...baseRequest(), previousDocs: { UNKNOWN: {} } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('Payload previous document dengan struktur terlalu dalam ditolak', () => {
  let nested: Record<string, unknown> = { value: 'x' };
  for (let index = 0; index < 10; index++) nested = { child: nested };
  const acp = makeDocument('ACP', nested);
  expectInvalid(
    { ...baseRequest(), docType: 'TP', previousDocs: { ACP: acp } },
    'INVALID_PREVIOUS_DOCUMENTS',
  );
});

test('Teks Master Input terlalu panjang ditolak', () => {
  const request = baseRequest();
  request.masterInput.namaMadrasah = 'M'.repeat(201);
  expectInvalid(request, 'INVALID_MASTER_INPUT');
});

console.log('');
console.log(`B12-05G-04C-01 RESULT: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
