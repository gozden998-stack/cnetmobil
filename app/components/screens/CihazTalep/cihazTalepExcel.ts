// CNETMOBİL V2
// Cihaz Talep toplu Excel şablonu ve .xlsx parser.
// Cihaz Talep modülü ile birlikte page.tsx dışına taşınmıştır.

export type CihazTalepBulkRow = {
  imei: string;
  markaModel: string;
  hafiza: string;
  renk: string;
  pil: string;
  grade: string;
  garanti: string;
  degisenParca: string;
  kutuFatura: string;
};

const CIHAZ_TALEP_TEMPLATE_BASE64 = `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`;

export function downloadCihazTalepTemplate() {
  const binary = atob(CIHAZ_TALEP_TEMPLATE_BASE64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cihaz_talep_toplu_sablon_IMEI15.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const BULK_CIHAZ_HEADERS = [
  'IMEI',
  'MARKA MODEL',
  'HAFIZA',
  'RENK',
  'PIL',
  'GRADE',
  'GARANTI',
  'DEGISEN PARCA',
  'KUTU FATURA',
] as const;

function normalizeBulkHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C')
    .replace(/▼/g, '')
    .replace(/[\/_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function xlsxColumnIndex(cellRef: string) {
  const letters = String(cellRef || '').match(/^[A-Z]+/i)?.[0] || 'A';
  let result = 0;

  for (const char of letters.toUpperCase()) {
    result = result * 26 + (char.charCodeAt(0) - 64);
  }

  return Math.max(0, result - 1);
}

async function inflateXlsxDeflateRaw(data: Uint8Array) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error(
      'Tarayıcınız Excel dosyasını açmayı desteklemiyor. Güncel Chrome veya Edge kullanın.'
    );
  }

  // TypeScript / Next.js BlobPart uyumluluğu:
  // Uint8Array buffer'ı SharedArrayBuffer olabileceği için
  // veriyi kesin ArrayBuffer içine kopyalıyoruz.
  const safeBuffer = new ArrayBuffer(data.byteLength);
  new Uint8Array(safeBuffer).set(data);

  const stream = new Blob([safeBuffer])
    .stream()
    .pipeThrough(new DecompressionStream('deflate-raw'));

  return new Uint8Array(
    await new Response(stream).arrayBuffer()
  );
}

async function unzipSimpleXlsx(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);

  let eocd = -1;
  const minOffset = Math.max(0, bytes.length - 65557);

  for (let i = bytes.length - 22; i >= minOffset; i--) {
    if (
      view.getUint32(i, true) === 0x06054b50
    ) {
      eocd = i;
      break;
    }
  }

  if (eocd < 0) {
    throw new Error('Geçerli bir .xlsx dosyası değil.');
  }

  const totalEntries =
    view.getUint16(eocd + 10, true);

  let centralOffset =
    view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder('utf-8');
  const files = new Map<string, Uint8Array>();

  for (let entry = 0; entry < totalEntries; entry++) {
    if (
      view.getUint32(centralOffset, true) !==
      0x02014b50
    ) {
      throw new Error('Excel ZIP yapısı okunamadı.');
    }

    const method =
      view.getUint16(centralOffset + 10, true);

    const compressedSize =
      view.getUint32(centralOffset + 20, true);

    const fileNameLength =
      view.getUint16(centralOffset + 28, true);

    const extraLength =
      view.getUint16(centralOffset + 30, true);

    const commentLength =
      view.getUint16(centralOffset + 32, true);

    const localOffset =
      view.getUint32(centralOffset + 42, true);

    const fileName = decoder.decode(
      bytes.slice(
        centralOffset + 46,
        centralOffset + 46 + fileNameLength
      )
    );

    if (
      view.getUint32(localOffset, true) !==
      0x04034b50
    ) {
      throw new Error('Excel dosya başlığı okunamadı.');
    }

    const localNameLength =
      view.getUint16(localOffset + 26, true);

    const localExtraLength =
      view.getUint16(localOffset + 28, true);

    const dataStart =
      localOffset +
      30 +
      localNameLength +
      localExtraLength;

    const compressed = bytes.slice(
      dataStart,
      dataStart + compressedSize
    );

    let content: Uint8Array;

    if (method === 0) {
      content = compressed;
    } else if (method === 8) {
      content =
        await inflateXlsxDeflateRaw(compressed);
    } else {
      throw new Error(
        `Desteklenmeyen Excel sıkıştırma tipi: ${method}`
      );
    }

    files.set(fileName, content);

    centralOffset +=
      46 +
      fileNameLength +
      extraLength +
      commentLength;
  }

  return files;
}

function readXlsxSharedStrings(
  files: Map<string, Uint8Array>
) {
  const bytes =
    files.get('xl/sharedStrings.xml');

  if (!bytes) return [] as string[];

  const xml = new TextDecoder('utf-8').decode(bytes);
  const doc = new DOMParser().parseFromString(
    xml,
    'application/xml'
  );

  return Array.from(
    doc.getElementsByTagNameNS('*', 'si')
  ).map((item) =>
    Array.from(
      item.getElementsByTagNameNS('*', 't')
    )
      .map((node) => node.textContent || '')
      .join('')
  );
}

function parseXlsxWorksheet(
  sheetBytes: Uint8Array,
  sharedStrings: string[]
) {
  const xml =
    new TextDecoder('utf-8').decode(sheetBytes);

  const doc =
    new DOMParser().parseFromString(
      xml,
      'application/xml'
    );

  if (
    doc.getElementsByTagName('parsererror').length
  ) {
    throw new Error(
      'Excel çalışma sayfası okunamadı.'
    );
  }

  const parsedRows: string[][] = [];

  const xmlRows = Array.from(
    doc.getElementsByTagNameNS('*', 'row')
  );

  for (const xmlRow of xmlRows) {
    const rowNumber =
      Math.max(
        1,
        Number(xmlRow.getAttribute('r')) || 1
      );

    while (parsedRows.length < rowNumber) {
      parsedRows.push([]);
    }

    const output =
      parsedRows[rowNumber - 1];

    const cells = Array.from(
      xmlRow.getElementsByTagNameNS('*', 'c')
    );

    for (const cell of cells) {
      const cellRef =
        cell.getAttribute('r') || 'A1';

      const colIndex =
        xlsxColumnIndex(cellRef);

      const type =
        cell.getAttribute('t') || '';

      const valueNode =
        cell.getElementsByTagNameNS('*', 'v')[0];

      let value = '';

      if (type === 'inlineStr') {
        value = Array.from(
          cell.getElementsByTagNameNS('*', 't')
        )
          .map((node) => node.textContent || '')
          .join('');
      } else {
        const raw =
          valueNode?.textContent || '';

        if (type === 's') {
          value =
            sharedStrings[
              Number(raw)
            ] ?? '';
        } else {
          value = raw;
        }
      }

      output[colIndex] =
        String(value ?? '').trim();
    }
  }

  return parsedRows;
}

export async function parseCihazTalepBulkXlsx(
  file: File
): Promise<CihazTalepBulkRow[]> {
  if (
    !file.name
      .toLocaleLowerCase('tr-TR')
      .endsWith('.xlsx')
  ) {
    throw new Error(
      'Sadece .xlsx Excel dosyası yükleyebilirsiniz.'
    );
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error(
      'Excel dosyası en fazla 8 MB olabilir.'
    );
  }

  const files =
    await unzipSimpleXlsx(
      await file.arrayBuffer()
    );

  const worksheetPaths =
    Array.from(files.keys())
      .filter((name) =>
        /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)
      )
      .sort((a, b) => {
        const aNo =
          Number(a.match(/sheet(\d+)/i)?.[1] || 0);
        const bNo =
          Number(b.match(/sheet(\d+)/i)?.[1] || 0);

        return aNo - bNo;
      });

  if (!worksheetPaths.length) {
    throw new Error(
      'Excel dosyasında çalışma sayfası bulunamadı.'
    );
  }

  const sharedStrings =
    readXlsxSharedStrings(files);

  let rows: string[][] = [];
  let headerIndexes =
    new Map<string, number>();
  let foundTemplateSheet = false;

  // Excel bazen sayfa XML sırasını değiştirebilir.
  // Bu yüzden sheet1 varsaymak yerine, başlıkları gerçekten
  // "IMEI, Marka / Model, Hafıza, Renk..." olan sayfayı buluyoruz.
  for (const worksheetPath of worksheetPaths) {
    const candidateRows =
      parseXlsxWorksheet(
        files.get(worksheetPath)!,
        sharedStrings
      );

    if (!candidateRows.length) {
      continue;
    }

    // Başlık satırını ilk 10 satır içinde ara.
    // Böylece Excel dosyası farklı bir programda kaydedilse bile
    // şablon daha dayanıklı olur.
    for (
      let headerRowIndex = 0;
      headerRowIndex < Math.min(candidateRows.length, 10);
      headerRowIndex++
    ) {
      const candidateHeader =
        (candidateRows[headerRowIndex] || [])
          .map(normalizeBulkHeader);

      const candidateIndexes =
        new Map<string, number>();

      candidateHeader.forEach(
        (header, index) => {
          candidateIndexes.set(
            header,
            index
          );
        }
      );

      const hasAllHeaders =
        BULK_CIHAZ_HEADERS.every(
          (header) =>
            candidateIndexes.has(header)
        );

      if (hasAllHeaders) {
        rows =
          candidateRows.slice(
            headerRowIndex
          );

        headerIndexes =
          candidateIndexes;

        foundTemplateSheet = true;
        break;
      }
    }

    if (foundTemplateSheet) {
      break;
    }
  }

  if (!foundTemplateSheet) {
    throw new Error(
      'Cihazlar sayfası bulunamadı. Lütfen panelden indirdiğiniz Excel şablonunu kullanın ve başlıkları değiştirmeyin.'
    );
  }

  const getValue = (
    row: string[],
    header: typeof BULK_CIHAZ_HEADERS[number]
  ) => {
    const index =
      headerIndexes.get(header);

    return String(
      index === undefined
        ? ''
        : row[index] ?? ''
    ).trim();
  };

  const devices: CihazTalepBulkRow[] = [];
  const errors: string[] = [];

  for (
    let rowIndex = 1;
    rowIndex < rows.length;
    rowIndex++
  ) {
    const row = rows[rowIndex] || [];

    const allEmpty =
      BULK_CIHAZ_HEADERS.every(
        (header) =>
          getValue(row, header) === ''
      );

    if (allEmpty) continue;

    const imei =
      getValue(row, 'IMEI')
        .replace(/\s+/g, '')
        .trim();

    const markaModel =
      getValue(row, 'MARKA MODEL');

    const hafiza =
      getValue(row, 'HAFIZA');

    const renk =
      getValue(row, 'RENK');

    const pil =
      getValue(row, 'PIL');

    const grade =
      getValue(row, 'GRADE')
        .toLocaleUpperCase('tr-TR');

    const garanti =
      getValue(row, 'GARANTI');

    const degisenParca =
      getValue(row, 'DEGISEN PARCA') ||
      'Orijinal / Yok';

    const kutuFatura =
      getValue(row, 'KUTU FATURA');


    const excelLine = rowIndex + 1;

    if (!/^[0-9]{15}$/.test(imei)) {
      errors.push(
        `${excelLine}. satır: IMEI tam 15 haneli ve yalnızca rakamlardan oluşmalıdır.`
      );
    }

    if (!markaModel) {
      errors.push(
        `${excelLine}. satır: Marka / Model boş.`
      );
    }

    if (!hafiza) {
      errors.push(
        `${excelLine}. satır: Hafıza boş.`
      );
    }

    if (!renk) {
      errors.push(
        `${excelLine}. satır: Renk boş.`
      );
    }


    if (
      grade &&
      ![
        'MÜKEMMEL',
        'ÇOK İYİ',
        'İYİ',
        'OUTLET',
      ].includes(grade)
    ) {
      errors.push(
        `${excelLine}. satır: Grade geçersiz.`
      );
    }

    devices.push({
      imei,
      markaModel,
      hafiza,
      renk,
      pil,
      grade,
      garanti,
      degisenParca,
      kutuFatura,
    });
  }

  if (errors.length) {
    throw new Error(
      errors.slice(0, 8).join('\n') +
        (errors.length > 8
          ? `\n+${errors.length - 8} hata daha`
          : '')
    );
  }

  if (!devices.length) {
    throw new Error(
      'Yüklenecek cihaz bulunamadı. Excel içinde “Cihazlar” sayfasında, başlık satırının altına en az 1 cihaz girin.'
    );
  }

  if (devices.length > 500) {
    throw new Error(
      'Tek seferde en fazla 500 cihaz yükleyebilirsiniz.'
    );
  }

  return devices;
}
