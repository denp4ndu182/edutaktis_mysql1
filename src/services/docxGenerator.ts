import {
  Document,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  Packer,
  VerticalAlign,
  ShadingType,
  PageOrientation,
} from 'docx';
import saveAs from 'file-saver';
import {
  MasterInputData,
  DocumentType,
  AcpData,
  TpData,
  AtpData,
  ProtaData,
  ProsemData,
  KktpData,
  ModulAjarKbcData,
  LkpdData,
  ModulAjarKbcRecord,
  LkpdRecord,
} from '../types';

const NAVY_COLOR = '1A3A5C';
const WHITE_COLOR = 'FFFFFF';
const BORDER_COLOR = 'CCCCCC';
const GRAY_BG = 'F3F4F6';

// 1.5 cm = ~850 twips (1 inch = 1440 twips; 1.5 cm = (1.5 / 2.54) * 1440 = 850.39 twips)
const MARGIN_TWIPS = 850;

function createKopParagraphs(input: MasterInputData): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40, line: 240 },
      children: [
        new TextRun({
          text: (input.kemenagOrYayasan || 'KEMENTERIAN AGAMA REPUBLIK INDONESIA').toUpperCase(),
          bold: true,
          size: 22, // 11pt
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40, line: 240 },
      children: [
        new TextRun({
          text: (input.namaMadrasah || 'MADRASAH TSANAWIYAH').toUpperCase(),
          bold: true,
          size: 26, // 13pt
          color: NAVY_COLOR,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120, line: 220 },
      children: [
        new TextRun({
          text: input.alamatMadrasah || 'Alamat Madrasah',
          size: 18, // 9pt
          italics: true,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      border: {
        bottom: {
          color: NAVY_COLOR,
          space: 1,
          style: BorderStyle.DOUBLE,
          size: 18,
        },
      },
      children: [],
    }),
  ];
}

function createSignatureTable(input: MasterInputData): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [new TextRun({ text: 'Mengetahui,', size: 20, font: 'Arial' })],
              }),
              new Paragraph({
                spacing: { after: 900 },
                children: [
                  new TextRun({ text: 'Kepala Madrasah,', bold: true, size: 20, font: 'Arial' }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: input.namaKepala || 'Kepala Madrasah',
                    bold: true,
                    underline: {},
                    size: 20,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `NIP. ${input.nipKepala || '-'}`,
                    size: 18,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: `${input.kotaTandaTangan || 'Kota'}, ${input.tanggalTandaTangan || 'Tanggal'}`,
                    size: 20,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                spacing: { after: 900 },
                children: [
                  new TextRun({ text: 'Guru Mata Pelajaran,', bold: true, size: 20, font: 'Arial' }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: input.namaGuru || 'Guru Pengampu',
                    bold: true,
                    underline: {},
                    size: 20,
                    font: 'Arial',
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `NIP. ${input.nipGuru || '-'}`,
                    size: 18,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function createIdentityTable(data: Record<string, string>): Table {
  const rows = Object.entries(data).map(([key, val]) => {
    // Format camelCase key to readable Indonesian title
    const formattedKey = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .replace('Fase Kelas', 'Fase / Kelas')
      .replace('Kemenag Yayasan', 'Instansi / Yayasan')
      .replace('Satuan Pendidikan', 'Satuan Pendidikan');

    return new TableRow({
      children: [
        new TableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: formattedKey, bold: true, size: 19, font: 'Arial' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 72, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: `: ${val}`, size: 19, font: 'Arial' })],
            }),
          ],
        }),
      ],
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows,
  });
}

function createSectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 22, // 11pt
        color: NAVY_COLOR,
        font: 'Arial',
      }),
    ],
  });
}

function createTableHeaderCell(text: string, widthPercent: number): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { fill: NAVY_COLOR, type: ShadingType.CLEAR },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text,
            bold: true,
            color: WHITE_COLOR,
            size: 19,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

function createTableCell(
  text: string,
  widthPercent: number,
  align: any = AlignmentType.LEFT,
  bold = false
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text,
            size: 18,
            bold,
            font: 'Arial',
          }),
        ],
      }),
    ],
  });
}

// DOCX Builder for ACP
function buildAcpDocument(input: MasterInputData, acp: AcpData): Document {
  const kop = createKopParagraphs(input);

  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 180 },
    children: [
      new TextRun({
        text: 'ANALISIS CAPAIAN PEMBELAJARAN (ACP)',
        bold: true,
        size: 28, // 14pt
        color: NAVY_COLOR,
        font: 'Arial',
      }),
      new TextRun({
        text: `\nKURIKULUM BERBASIS CINTA (KBC) & PPRA`,
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
  });

  const identityTable = createIdentityTable(acp.identitas);

  // Table of Element Analysis
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 6),
      createTableHeaderCell('Elemen CP', 20),
      createTableHeaderCell('Kalimat Capaian Pembelajaran', 28),
      createTableHeaderCell('Kompetensi Ditargetkan', 22),
      createTableHeaderCell('Materi Esensial & Kedalaman', 24),
    ],
  });

  const dataRows = acp.analisisElemen.map((el, i) => {
    return new TableRow({
      children: [
        createTableCell((i + 1).toString(), 6, AlignmentType.CENTER),
        createTableCell(`${el.namaElemen} (${el.kodeElemen})`, 20, AlignmentType.LEFT, true),
        createTableCell(el.kalimatCP, 28),
        createTableCell(el.kompetensi.map((k) => `• ${k}`).join('\n'), 22),
        createTableCell(
          `Materi:\n${el.materiEsensial.map((m) => `• ${m}`).join('\n')}\n\nKedalaman:\n${el.kedalamanKeluasan}`,
          24
        ),
      ],
    });
  });

  const analysisTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows: [headerRow, ...dataRows],
  });

  const signatureTable = createSignatureTable(input);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children: [
          ...kop,
          titleP,
          createSectionHeading('A. IDENTITAS DOKUMEN'),
          identityTable,
          createSectionHeading('B. RASIONAL MATA PELAJARAN'),
          new Paragraph({
            spacing: { after: 120, line: 280 },
            children: [new TextRun({ text: acp.rasionalMapel, size: 20, font: 'Arial' })],
          }),
          createSectionHeading('C. CAPAIAN PEMBELAJARAN UMUM'),
          new Paragraph({
            spacing: { after: 120, line: 280 },
            children: [new TextRun({ text: acp.cpUmum, size: 20, font: 'Arial' })],
          }),
          createSectionHeading('D. ANALISIS ELEMEN, KOMPETENSI, DAN MATERI'),
          analysisTable,
          createSectionHeading('E. INTEGRASI KURIKULUM BERBASIS CINTA (KBC) & PPRA'),
          new Paragraph({
            spacing: { after: 60, line: 260 },
            children: [
              new TextRun({ text: 'Penerapan Panca Cinta:\n', bold: true, size: 20, font: 'Arial' }),
              new TextRun({ text: acp.integrasiKBCPPRA.kbcApplication, size: 20, font: 'Arial' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120, line: 260 },
            children: [
              new TextRun({ text: '\nPenanaman Nilai PPRA:\n', bold: true, size: 20, font: 'Arial' }),
              new TextRun({ text: acp.integrasiKBCPPRA.ppraApplication, size: 20, font: 'Arial' }),
            ],
          }),
          createSectionHeading('F. REKOMENDASI PEMBELAJARAN DAN ASESMEN'),
          new Paragraph({
            spacing: { after: 60, line: 260 },
            children: [
              new TextRun({ text: 'Rekomendasi Pembelajaran: ', bold: true, size: 20, font: 'Arial' }),
              new TextRun({ text: acp.rekomendasiPembelajaran, size: 20, font: 'Arial' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200, line: 260 },
            children: [
              new TextRun({ text: 'Rekomendasi Asesmen: ', bold: true, size: 20, font: 'Arial' }),
              new TextRun({ text: acp.rekomendasiAsesmen, size: 20, font: 'Arial' }),
            ],
          }),
          new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }),
          signatureTable,
        ],
      },
    ],
  });
}

// DOCX Builder for TP
function buildTpDocument(input: MasterInputData, tp: TpData): Document {
  const kop = createKopParagraphs(input);

  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 180 },
    children: [
      new TextRun({
        text: 'TUJUAN PEMBELAJARAN (TP)',
        bold: true,
        size: 28,
        color: NAVY_COLOR,
        font: 'Arial',
      }),
      new TextRun({
        text: `\nINTEGRASI KBC & PROFIL PELAJAR RAHMATAN LIL 'ALAMIN`,
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
  });

  const identityTable = createIdentityTable(tp.identitas);

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 5),
      createTableHeaderCell('Kode TP', 10),
      createTableHeaderCell('Elemen CP', 15),
      createTableHeaderCell('Rumusan Tujuan Pembelajaran', 32),
      createTableHeaderCell('Materi Pokok', 16),
      createTableHeaderCell('Nilai KBC & PPRA', 16),
      createTableHeaderCell('JP', 6),
    ],
  });

  const dataRows = tp.listTP.map((item) => {
    return new TableRow({
      children: [
        createTableCell(item.no.toString(), 5, AlignmentType.CENTER),
        createTableCell(item.kodeTP, 10, AlignmentType.CENTER, true),
        createTableCell(item.elemen, 15),
        createTableCell(item.rumusanTP, 32),
        createTableCell(item.materiPokok, 16),
        createTableCell(`${item.integrasiPancaCinta}\n(${item.integrasiPPRA})`, 16),
        createTableCell(`${item.alokasiJP}`, 6, AlignmentType.CENTER, true),
      ],
    });
  });

  const totalRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 6,
        width: { size: 94, type: WidthType.PERCENTAGE },
        shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: 'TOTAL ALOKASI WAKTU SATU TAHUN PELAJARAN:',
                bold: true,
                size: 19,
                font: 'Arial',
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 6, type: WidthType.PERCENTAGE },
        shading: { fill: GRAY_BG, type: ShadingType.CLEAR },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [
              new TextRun({
                text: `${tp.totalJP} JP`,
                bold: true,
                size: 19,
                color: NAVY_COLOR,
                font: 'Arial',
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const tpTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows: [headerRow, ...dataRows, totalRow],
  });

  const signatureTable = createSignatureTable(input);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children: [
          ...kop,
          titleP,
          createSectionHeading('A. IDENTITAS DOKUMEN'),
          identityTable,
          createSectionHeading('B. DAFTAR TUJUAN PEMBELAJARAN (TP)'),
          tpTable,
          new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }),
          signatureTable,
        ],
      },
    ],
  });
}

// DOCX Builder for ATP
function buildAtpDocument(input: MasterInputData, atp: AtpData): Document {
  const kop = createKopParagraphs(input);

  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 180 },
    children: [
      new TextRun({
        text: 'ALUR TUJUAN PEMBELAJARAN (ATP)',
        bold: true,
        size: 28,
        color: NAVY_COLOR,
        font: 'Arial',
      }),
      new TextRun({
        text: `\nROADMAP ALUR BELAJAR BERKELANJUTAN BERBASIS KBC`,
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
  });

  const identityTable = createIdentityTable(atp.identitas);

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('Urutan', 7),
      createTableHeaderCell('Kode TP', 9),
      createTableHeaderCell('Semester', 12),
      createTableHeaderCell('Elemen CP', 14),
      createTableHeaderCell('Rumusan Alur Tujuan Pembelajaran', 30),
      createTableHeaderCell('Materi Pokok & Aspek', 16),
      createTableHeaderCell('Integrasi KBC & PPRA', 12),
      createTableHeaderCell('JP', 6),
    ],
  });

  const dataRows = atp.listATP.map((item) => {
    return new TableRow({
      children: [
        createTableCell(`Ke-${item.alurUrutan}`, 7, AlignmentType.CENTER, true),
        createTableCell(item.kodeTP, 9, AlignmentType.CENTER, true),
        createTableCell(item.semester, 12, AlignmentType.CENTER),
        createTableCell(item.elemen, 14),
        createTableCell(item.rumusanTP, 30),
        createTableCell(`${item.materiPokok}\n\n[${item.aspekKompetensi}]`, 16),
        createTableCell(item.integrasiKbcPpra, 12),
        createTableCell(`${item.alokasiJP}`, 6, AlignmentType.CENTER, true),
      ],
    });
  });

  const atpTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows: [headerRow, ...dataRows],
  });

  const signatureTable = createSignatureTable(input);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children: [
          ...kop,
          titleP,
          createSectionHeading('A. IDENTITAS DOKUMEN'),
          identityTable,
          createSectionHeading('B. TAHAPAN ALUR BELAJAR BERBASIS SEMESTER'),
          ...atp.visualDiagram.map(
            (v) =>
              new Paragraph({
                spacing: { after: 80 },
                children: [
                  new TextRun({ text: `• ${v.tahap}: `, bold: true, color: NAVY_COLOR, size: 20, font: 'Arial' }),
                  new TextRun({ text: `${v.deskripsiAlur} [TP: ${v.tpCodes.join(', ')}]`, size: 19, font: 'Arial' }),
                ],
              })
          ),
          createSectionHeading('C. TABEL ALUR TUJUAN PEMBELAJARAN (ATP)'),
          atpTable,
          new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }),
          signatureTable,
        ],
      },
    ],
  });
}

// DOCX Builder for PROTA
function buildProtaDocument(input: MasterInputData, prota: ProtaData): Document {
  const kop = createKopParagraphs(input);

  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 180 },
    children: [
      new TextRun({
        text: 'PROGRAM TAHUNAN (PROTA)',
        bold: true,
        size: 28,
        color: NAVY_COLOR,
        font: 'Arial',
      }),
      new TextRun({
        text: `\nDISTRIBUSI ALOKASI WAKTU TAHUN PELAJARAN ${input.tahunPelajaran}`,
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
  });

  const identityTable = createIdentityTable(prota.identitas);

  // Table of Calendar distribution
  const calHeader = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('Semester', 15),
      createTableHeaderCell('Bulan', 15),
      createTableHeaderCell('Jml Minggu', 12),
      createTableHeaderCell('Mgg Tdk Efektif', 15),
      createTableHeaderCell('Mgg Efektif', 13),
      createTableHeaderCell('Jam (JP)', 10),
      createTableHeaderCell('Keterangan Kegiatan', 20),
    ],
  });

  const sem1Rows = prota.distribusiMinggu.semesterGanjil.bulanList.map((b) => {
    return new TableRow({
      children: [
        createTableCell('Ganjil', 15, AlignmentType.CENTER),
        createTableCell(b.bulan, 15),
        createTableCell(`${b.mingguKalender}`, 12, AlignmentType.CENTER),
        createTableCell(`${b.mingguTidakEfektif}`, 15, AlignmentType.CENTER),
        createTableCell(`${b.mingguEfektif}`, 13, AlignmentType.CENTER, true),
        createTableCell(`${b.jp}`, 10, AlignmentType.CENTER, true),
        createTableCell(b.keterangan, 20),
      ],
    });
  });

  const sem2Rows = prota.distribusiMinggu.semesterGenap.bulanList.map((b) => {
    return new TableRow({
      children: [
        createTableCell('Genap', 15, AlignmentType.CENTER),
        createTableCell(b.bulan, 15),
        createTableCell(`${b.mingguKalender}`, 12, AlignmentType.CENTER),
        createTableCell(`${b.mingguTidakEfektif}`, 15, AlignmentType.CENTER),
        createTableCell(`${b.mingguEfektif}`, 13, AlignmentType.CENTER, true),
        createTableCell(`${b.jp}`, 10, AlignmentType.CENTER, true),
        createTableCell(b.keterangan, 20),
      ],
    });
  });

  const calTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows: [calHeader, ...sem1Rows, ...sem2Rows],
  });

  // Allocation Table
  const allocHeader = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 6),
      createTableHeaderCell('Semester', 12),
      createTableHeaderCell('Kode TP', 10),
      createTableHeaderCell('Tujuan Pembelajaran & Materi Pokok', 40),
      createTableHeaderCell('Elemen CP', 16),
      createTableHeaderCell('Nilai KBC & PPRA', 10),
      createTableHeaderCell('Alokasi JP', 6),
    ],
  });

  const allocRows = prota.rencanaAlokasi.map((item) => {
    return new TableRow({
      children: [
        createTableCell(`${item.no}`, 6, AlignmentType.CENTER),
        createTableCell(item.semester, 12, AlignmentType.CENTER),
        createTableCell(item.kodeTP, 10, AlignmentType.CENTER, true),
        createTableCell(item.tujuanDanMateri, 40),
        createTableCell(item.elemenCP, 16),
        createTableCell(item.integrasiKBCPPRA, 10),
        createTableCell(`${item.alokasiJP}`, 6, AlignmentType.CENTER, true),
      ],
    });
  });

  const allocTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows: [allocHeader, ...allocRows],
  });

  const signatureTable = createSignatureTable(input);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children: [
          ...kop,
          titleP,
          createSectionHeading('A. IDENTITAS DOKUMEN'),
          identityTable,
          createSectionHeading('B. DISTRIBUSI MINGGU EFEKTIF DAN ALOKASI JP'),
          calTable,
          createSectionHeading('C. RENCANA ALOKASI PROGRAM TAHUNAN'),
          allocTable,
          createSectionHeading('D. REKAPITULASI ALOKASI WAKTU'),
          new Paragraph({
            children: [
              new TextRun({
                text: `• Subtotal Semester Ganjil: ${prota.rekapitulasi.subtotalGanjilJP} JP\n• Subtotal Semester Genap: ${prota.rekapitulasi.subtotalGenapJP} JP\n• Total Keseluruhan: ${prota.rekapitulasi.totalTahunJP} JP (Target: ${prota.rekapitulasi.alokasiTargetJP} JP) -> Status: ${prota.rekapitulasi.keteranganStatus}`,
                size: 20,
                font: 'Arial',
              }),
            ],
          }),
          new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }),
          signatureTable,
        ],
      },
    ],
  });
}

// DOCX Builder for PROSEM
function buildProsemDocument(input: MasterInputData, prosem: ProsemData): Document {
  const kop = createKopParagraphs(input);

  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 180 },
    children: [
      new TextRun({
        text: 'PROGRAM SEMESTER (PROSEM)',
        bold: true,
        size: 28,
        color: NAVY_COLOR,
        font: 'Arial',
      }),
      new TextRun({
        text: `\nMATRIKS DISTRIBUSI PEMBELAJARAN PER MINGGU`,
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
  });

  const identityTable = createIdentityTable(prosem.identitas);

  // Build matrix table for Semester Ganjil
  const ganjilMonths = prosem.semesterGanjil.months; // ['Juli', 'Agustus', ...]
  const sem1HeaderTop = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 4),
      createTableHeaderCell('Kode', 7),
      createTableHeaderCell('Tujuan Pembelajaran & Materi', 35),
      createTableHeaderCell('JP', 6),
      ...ganjilMonths.map((m) => createTableHeaderCell(m, 8)),
    ],
  });

  const sem1Rows = prosem.semesterGanjil.items.map((item) => {
    return new TableRow({
      children: [
        createTableCell(`${item.no}`, 4, AlignmentType.CENTER),
        createTableCell(item.kodeTP, 7, AlignmentType.CENTER, true),
        createTableCell(item.tujuanDanMateri, 35),
        createTableCell(`${item.alokasiJP}`, 6, AlignmentType.CENTER, true),
        ...ganjilMonths.map((m) => {
          const weeks = item.distribusiBulan[m] || [0, 0, 0, 0, 0];
          const text = weeks.map((w) => (w > 0 ? `${w}` : '-')).join(' ');
          return createTableCell(text, 8, AlignmentType.CENTER);
        }),
      ],
    });
  });

  const sem1Table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows: [sem1HeaderTop, ...sem1Rows],
  });

  const signatureTable = createSignatureTable(input);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children: [
          ...kop,
          titleP,
          createSectionHeading('A. IDENTITAS DOKUMEN'),
          identityTable,
          createSectionHeading('B. LEGENDA KETERANGAN'),
          new Paragraph({
            children: prosem.legenda.map(
              (l) =>
                new TextRun({
                  text: `[${l.simbol}] = ${l.keterangan}    `,
                  size: 19,
                  font: 'Arial',
                })
            ),
          }),
          createSectionHeading('C. MATRIKS PROGRAM SEMESTER GANJIL'),
          sem1Table,
          new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }),
          signatureTable,
        ],
      },
    ],
  });
}

// DOCX Builder for KKTP
function buildKktpDocument(input: MasterInputData, kktp: KktpData): Document {
  const kop = createKopParagraphs(input);

  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 180 },
    children: [
      new TextRun({
        text: 'KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)',
        bold: true,
        size: 28,
        color: NAVY_COLOR,
        font: 'Arial',
      }),
      new TextRun({
        text: `\nPANDUAN RUBRIK ASESMEN DAN TINDAK LANJUT BERBASIS KBC`,
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
  });

  const identityTable = createIdentityTable(kktp.identitas);

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('Kode & TP', 22),
      createTableHeaderCell('Indikator Ketercapaian', 22),
      createTableHeaderCell('Rubrik Kriteria Ketercapaian', 36),
      createTableHeaderCell('Bukti & Tindak Lanjut', 20),
    ],
  });

  const dataRows = kktp.listRubrik.map((r) => {
    return new TableRow({
      children: [
        createTableCell(`[${r.kodeTP}]\n${r.rumusanTP}`, 22, AlignmentType.LEFT, true),
        createTableCell(r.indikatorKetercapaian.map((i) => `• ${i}`).join('\n\n'), 22),
        createTableCell(
          `1. Perlu Bimbingan (<70):\n${r.kriteria.perluBimbingan}\n\n2. Cukup (70-79):\n${r.kriteria.cukup}\n\n3. Baik (80-89):\n${r.kriteria.baik}\n\n4. Mahir (90-100):\n${r.kriteria.sangatBaik || r.kriteria.mahir}`,
          36
        ),
        createTableCell(
          `Bukti Asesmen:\n${r.buktiAsesmen}\n\nRemedial:\n${r.rencanaTindakLanjut.remedial}\n\nPengayaan:\n${r.rencanaTindakLanjut.pengayaan}`,
          20
        ),
      ],
    });
  });

  const kktpTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows: [headerRow, ...dataRows],
  });

  const signatureTable = createSignatureTable(input);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              orientation: PageOrientation.LANDSCAPE,
            },
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children: [
          ...kop,
          titleP,
          createSectionHeading('A. IDENTITAS DOKUMEN'),
          identityTable,
          createSectionHeading('B. INTERVAL TINGKAT KETERCAPAIAN SECARA UMUM'),
          ...kktp.deskripsiLevelUmum.map(
            (lvl) =>
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({ text: `• ${lvl.interval} (${lvl.kategori}): `, bold: true, color: NAVY_COLOR, size: 20, font: 'Arial' }),
                  new TextRun({ text: lvl.keterangan, size: 19, font: 'Arial' }),
                ],
              })
          ),
          createSectionHeading('C. RUBRIK DAN KRITERIA KETERCAPAIAN PER TUJUAN PEMBELAJARAN'),
          kktpTable,
          createSectionHeading('D. STRATEGI ASESMEN & TINDAK LANJUT UMUM'),
          new Paragraph({
            spacing: { after: 120, line: 260 },
            children: [new TextRun({ text: kktp.tindakLanjutUmum, size: 20, font: 'Arial' })],
          }),
          new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }),
          signatureTable,
        ],
      },
    ],
  });
}

// Master exporter function
export async function downloadDocxDocument(
  docType: DocumentType,
  input: MasterInputData,
  content: any
): Promise<void> {
  let doc: Document;

  switch (docType) {
    case 'ACP':
      doc = buildAcpDocument(input, content as AcpData);
      break;
    case 'TP':
      doc = buildTpDocument(input, content as TpData);
      break;
    case 'ATP':
      doc = buildAtpDocument(input, content as AtpData);
      break;
    case 'PROTA':
      doc = buildProtaDocument(input, content as ProtaData);
      break;
    case 'PROSEM':
      doc = buildProsemDocument(input, content as ProsemData);
      break;
    case 'KKTP':
      doc = buildKktpDocument(input, content as KktpData);
      break;
    default:
      throw new Error(`Unsupported document type: ${docType}`);
  }

  const blob = await Packer.toBlob(doc);
  const cleanMapel = (input.mataPelajaran || 'MAPEL').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  const cleanFase = (input.fase || 'FASE').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  const cleanTahun = (input.tahunPelajaran || 'TAHUN').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();

  const fileName = `${docType}_${cleanMapel}_${cleanFase}_${cleanTahun}.docx`;
  saveAs(blob, fileName);
}

// DOCX Builder for Modul Ajar KBC (26 Sections)
function buildModulAjarKbcDocument(input: MasterInputData, modul: ModulAjarKbcData): Document {
  const kop = createKopParagraphs(input);

  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 180 },
    children: [
      new TextRun({
        text: 'MODUL AJAR KURIKULUM BERBASIS CINTA (KBC)',
        bold: true,
        size: 28,
        color: NAVY_COLOR,
        font: 'Arial',
      }),
      new TextRun({
        text: `\n${modul.identitas?.judulModul || 'MODUL PEMBELAJARAN MENDALAM'}`,
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
  });

  const identityTable = createIdentityTable(modul.identitas || {});
  const info = modul.informasiUmum || {};
  const kbc = modul.pembuktianKBC || {};
  const cpTujuan = modul.capaianDanTujuan || {};
  const pertemuanList = modul.pertemuanList || [];
  const asesmen = modul.asesmenDanRubrik || {};
  const diferensiasi = modul.diferensiasiDanPengayaan || {};

  const children: any[] = [
    ...kop,
    titleP,
    createSectionHeading('1. SAMPUL & HALAMAN IDENTITAS'),
    identityTable,
    createSectionHeading('2. KOP MADRASAH / KEMENTERIAN AGAMA'),
    new Paragraph({
      spacing: { after: 120 },
      children: [new TextRun({ text: `Kementerian / Instansi: ${input.kemenagOrYayasan}\nSatuan Pendidikan: ${input.namaMadrasah}\nAlamat: ${input.alamatMadrasah}`, size: 20, font: 'Arial' })],
    }),
    createSectionHeading('3 & 4. INFORMASI UMUM & IDENTITAS MODUL AJAR'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `• Materi Pokok: ${info.materiPokok || '-'}\n• Gaya Mengajar & Pendekatan: ${info.gayaMengajar || '-'} (${info.modelPembelajaran || '-'})\n• Alokasi Waktu Total: ${info.alokasiWaktuTotal || '2 JP'} (${info.jumlahPertemuan || 1} Pertemuan)\n• Karakteristik Kelas: ${info.karakteristikKelas || '-'}\n• Sarana dan Prasarana: ${info.saranaPrasarana || '-'}`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('5, 6 & 7. KOMPETENSI AWAL, KARAKTERISTIK PESERTA DIDIK, SARANA & PRASARANA'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `Peserta didik telah menguasai kompetensi prasyarat dasar pada fase sebelumnya. Karakteristik peserta didik diakomodasi melalui pendekatan berpusat pada siswa (student-centered learning). Sarana pendukung: ${info.saranaPrasarana || 'Perangkat digital, papan tulis, lembar kerja'}.`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('8, 9 & 10. CAPAIAN PEMBELAJARAN, TUJUAN PEMBELAJARAN & ALUR TUJUAN PEMBELAJARAN'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `Rasional:\n${cpTujuan.rasional || '-'}\n\nElemen CP:\n${cpTujuan.cpElemen || '-'}\n\nTujuan Pembelajaran (TP):\n` +
            (cpTujuan.tujuanPembelajaran || []).map((tp: any) => `• [${tp.kodeTP}] ${tp.rumusanTP}`).join('\n'),
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('11, 12 & 13. MATERI POKOK, PEMAHAMAN BERMAKNA & PERTANYAAN PEMANTIK'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `Materi Pokok:\n${info.materiPokok}\n\nPemahaman Bermakna:\nPembelajaran ini membekali peserta didik memahami aplikasi nyata konsep dalam kehidupan sehari-hari.\n\nPertanyaan Pemantik:\n1. Bagaimana konsep ini dapat kita amati di lingkungan sekitar?\n2. Nilai kebaikan apa yang dapat kita teladani dari materi ini?`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('14, 15 & 16. INTEGRASI KBC, PANCA CINTA & PPRA'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `• Fokus Panca Cinta:\n${(kbc.pancaCintaFocus || []).map((p: string) => `  - ${p}`).join('\n')}\n\n• Nilai PPRA (Profil Pelajar Rahmatan lil 'Alamin):\n${(kbc.ppraValuesFocus || []).map((p: string) => `  - ${p}`).join('\n')}\n\n• Catatan KBC:\n${kbc.catatanKBC || '-'}`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('17 & 18. MODEL, METODE, PENDEKATAN, GAYA MENGAJAR, MEDIA & SUMBER BELAJAR'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `Model & Pendekatan: ${info.modelPembelajaran} | Gaya Mengajar: ${info.gayaMengajar}\nMedia Belajar: Lembar kerja, tayangan visual interaktif, benda konkret\nSumber Belajar: Buku teks resmi Kemenag, lingkungan madrasah, sumber digital terverifikasi`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('19. LANGKAH PEMBELAJARAN PER PERTEMUAN (DEEP LEARNING KBC)'),
  ];

  pertemuanList.forEach((p: any, idx: number) => {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: `Pertemuan ke-${p.pertemuanKe || idx + 1} (${p.alokasiJP || 2} JP) — Topik: ${p.topik}`,
            bold: true,
            color: NAVY_COLOR,
            size: 20,
            font: 'Arial',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120, line: 260 },
        children: [
          new TextRun({
            text: `• Tujuan Pertemuan: ${p.tujuanPertemuan}\n• Pemahaman Bermakna: ${p.pemahamanBermakna}\n• Kegiatan Pendahuluan: ${p.kegiatanPendahuluan}\n• Kegiatan Inti KBC (Mindful, Meaningful, Joyful): ${p.kegiatanInti}\n• Kegiatan Penutup: ${p.kegiatanPenutup}\n• Rencana Asesmen Formatif: ${p.rencanaAsesmenFormatif}`,
            size: 19,
            font: 'Arial',
          }),
        ],
      })
    );
  });

  children.push(
    createSectionHeading('20 & 21. ASESMEN (DIAGNOSTIK, FORMATIF, SUMATIF) & INSTRUMEN / RUBRIK'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `• Asesmen Diagnostik: ${asesmen.asesmenDiagnostik || '-'}\n• Asesmen Formatif: ${asesmen.asesmenFormatif || '-'}\n• Asesmen Sumatif: ${asesmen.asesmenSumatif || '-'}\n• Rubrik Penilaian:\n${asesmen.rubrikPenilaian || '-'}`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('22 & 23. PEMBELAJARAN BERDIFERENSIASI, REMEDIAL & PENGAYAAN'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `• Pembelajaran Diferensiasi: ${diferensiasi.pembelajaranDiferensiasi || '-'}\n• Program Remedial: ${diferensiasi.remedial || '-'}\n• Program Pengayaan: ${diferensiasi.pengayaan || '-'}`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('24. REFLEKSI GURU DAN PESERTA DIDIK'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: diferensiasi.refleksiGuruDanSiswa || 'Refleksi dilakukan di akhir pembelajaran untuk mengevaluasi ketercapaian pemahaman bermakna dan kenyamanan belajar siswa.',
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('25 & 26. LAMPIRAN PENDUKUNG & REFERENSI'),
    new Paragraph({
      spacing: { after: 200, line: 260 },
      children: [
        new TextRun({
          text: `Lampiran: Lembar kerja peserta didik, instrumen penilaian, bahan bacaan.\nReferensi: Kurikulum Merdeka Kemenag RI, Buku Teks Mata Pelajaran Terkait, Modul Kurikulum Berbasis Cinta (KBC).`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }),
    createSignatureTable(input)
  );

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children,
      },
    ],
  });
}

// DOCX Builder for LKPD (16 Components)
function buildLkpdDocument(input: MasterInputData, lkpd: LkpdData): Document {
  const kop = createKopParagraphs(input);

  const titleP = new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 180 },
    children: [
      new TextRun({
        text: 'LEMBAR KERJA PESERTA DIDIK (LKPD)',
        bold: true,
        size: 28,
        color: NAVY_COLOR,
        font: 'Arial',
      }),
      new TextRun({
        text: `\n${lkpd.materiPokok || 'AKTIVITAS PEMBELAJARAN INTERAKTIF'}`,
        bold: true,
        size: 22,
        font: 'Arial',
      }),
    ],
  });

  const studentIdentityTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideHorizontal: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
      insideVertical: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 4 },
    },
    rows: [
      new TableRow({
        children: [
          createTableCell('Nama Peserta Didik:', 30, AlignmentType.LEFT, true),
          createTableCell('................................................................', 70),
        ],
      }),
      new TableRow({
        children: [
          createTableCell('Kelas / No. Absen:', 30, AlignmentType.LEFT, true),
          createTableCell(`${input.kelas} / ......`, 70),
        ],
      }),
      new TableRow({
        children: [
          createTableCell('Mata Pelajaran:', 30, AlignmentType.LEFT, true),
          createTableCell(input.mataPelajaran, 70),
        ],
      }),
    ],
  });

  const children: any[] = [
    ...kop,
    titleP,
    createSectionHeading('1, 2, 3 & 4. KOP, JUDUL & IDENTITAS PESERTA DIDIK'),
    studentIdentityTable,
    createSectionHeading('5 & 6. MATERI POKOK & TUJUAN PEMBELAJARAN'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `Materi Pokok: ${lkpd.materiPokok}\n\nTujuan Pembelajaran:\n` +
            (lkpd.tujuanPembelajaran || []).map((t: string) => `• ${t}`).join('\n'),
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('7 & 8. PETUNJUK PENGGUNAAN & ALAT/BAHAN'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `Petunjuk Penggunaan:\n` +
            (lkpd.petunjukPenggunaan || []).map((p: string) => `• ${p}`).join('\n') +
            `\n\nAlat dan Bahan:\n` +
            (lkpd.alatDanBahan || []).map((a: string) => `• ${a}`).join('\n'),
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('9 & 10. RINGKASAN MATERI & STIMULUS PERMASALAHAN'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: `Ringkasan Materi:\n${lkpd.ringkasanMateri}\n\nStimulus / Permasalahan:\n${lkpd.stimulusPermasalahan}`,
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('11, 12 & 13. LANGKAH KEGIATAN, TUGAS & RUANG JAWABAN'),
  ];

  (lkpd.aktivitasLangkahKerja || []).forEach((act: any, idx: number) => {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: `Langkah Kerja ${act.langkahKe || idx + 1}: ${act.instruksi}`,
            bold: true,
            size: 20,
            font: 'Arial',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 120, line: 260 },
        children: [
          new TextRun({
            text: `[Ruang Jawaban / Pengerjaan Peserta Didik]\n${act.ruangJawaban || '........................................................................................................................\n........................................................................................................................'}`,
            italics: true,
            size: 19,
            font: 'Arial',
          }),
        ],
      })
    );
  });

  if (lkpd.pertanyaanDanTugas && lkpd.pertanyaanDanTugas.length > 0) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: 'Pertanyaan & Soal Evaluasi:',
            bold: true,
            size: 20,
            color: NAVY_COLOR,
            font: 'Arial',
          }),
        ],
      })
    );
    lkpd.pertanyaanDanTugas.forEach((q: any) => {
      children.push(
        new Paragraph({
          spacing: { after: 60, line: 260 },
          children: [
            new TextRun({
              text: `${q.nomor || 1}. ${q.soal} (Bobot: ${q.bobot || 20})\n[Tulis jawaban di sini]:\n........................................................................................................................`,
              size: 19,
              font: 'Arial',
            }),
          ],
        })
      );
    });
  }

  children.push(
    createSectionHeading('14. REFLEKSI PESERTA DIDIK'),
    new Paragraph({
      spacing: { after: 120, line: 260 },
      children: [
        new TextRun({
          text: lkpd.refleksiSiswa || 'Bagian manakah yang paling berkesan dan menantang dalam pembelajaran hari ini?',
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    createSectionHeading('15 & 16. PENILAIAN, RUBRIK & REFERENSI'),
    new Paragraph({
      spacing: { after: 200, line: 260 },
      children: [
        new TextRun({
          text: `Rubrik Penilaian:\n${lkpd.rubrikPenilaian || 'Penilaian didasarkan pada ketepatan konsep, proses kerja, dan kreativitas.'}\n\nReferensi:\n` +
            (lkpd.referensi || []).map((r: string) => `• ${r}`).join('\n'),
          size: 20,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 240, after: 120 }, children: [] }),
    createSignatureTable(input)
  );

  return new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: MARGIN_TWIPS,
              bottom: MARGIN_TWIPS,
              left: MARGIN_TWIPS,
              right: MARGIN_TWIPS,
            },
          },
        },
        children,
      },
    ],
  });
}

export async function downloadModulAjarDocx(
  input: MasterInputData,
  record: ModulAjarKbcRecord
): Promise<void> {
  const doc = buildModulAjarKbcDocument(input, record.content as ModulAjarKbcData);
  const blob = await Packer.toBlob(doc);
  const cleanTitle = (record.title || 'Modul_Ajar_KBC').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${cleanTitle}.docx`;
  saveAs(blob, fileName);
}

export async function downloadLkpdDocx(
  input: MasterInputData,
  record: LkpdRecord
): Promise<void> {
  const doc = buildLkpdDocument(input, record.content as LkpdData);
  const blob = await Packer.toBlob(doc);
  const cleanTitle = (record.title || 'LKPD').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `${cleanTitle}.docx`;
  saveAs(blob, fileName);
}
