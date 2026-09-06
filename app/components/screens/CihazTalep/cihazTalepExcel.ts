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
  // Eski Sheet fallback yolu için iç uyumluluk; yeni PostgreSQL akışında kullanılmaz.
  stokAdet?: number;
};

const CIHAZ_TALEP_TEMPLATE_BASE64 = `UEsDBBQAAAAIAKtKJl1JQOtg6AAAALYBAAAPAAAAeGwvd29ya2Jvb2sueG1stdFBTsMwEAXQq1izJ06TuqRR3QrBhi03mCbjxortiWwXIi7EmjPAwRAFtYgVG3ajv/h6+rPZzd6JR4rJctCwKEoQFDrubThoOGZz1cBuu5nbJ47jnnkUs3chtbOGIeeplTJ1A3lMBU8UZu8MR485FRwPMk2RsE8DUfZOVmW5kh5tgM++U5rOlwjoScOtHfDZYQRxSu97DQsQsbW9hgdVr5Xqm3VT1bjsVA3flvgXCxtjO7rj7ugp5C9MJIfZckiDnRII+Vtz8/by/jo69PjDU509TbVS1d6UjVLl0lz/h0dehpKXH2w/AFBLAwQUAAAACACrSiZdvIz0QtABAABzCwAADQAAAHhsL3N0eWxlcy54bWzlVk1v2zAM/SuC7outZBmGoGqxtTCwSy/tYVfFph0BlGRISur01w+S/LUORb+wokh9MUmLj4+yKLyzi04hOYB10mhO2SKnBHRpKqkbTve+/vKdXpyfdRvnjwg3OwBPOoXabTpOd963myxz5Q6UcAvTgu4U1sYq4d3C2CZzrQVRuZCmMFvm+bdMCalpQKyN9o6UZq89p8sxFIvdk4NAThmjJAsBLRSk0KWwKL2J8WzKGN7btP4fgNKgscQ2W06L/nkedG+4WEQijoxXibFEDO9WeA9WFxKR9PbtsQVOtdEwIvaLn0xqrDiy5frFec6grBKv5nLeMVuvvq6vBrxZ/gy/N2KnW2MrsA/+TgqmXZvsbFwd9xkQb8JR+V2P2SxmdzXRe1Uo/6viNKck7OpgSsTeTFC9k9DnkEOJOfrqtfBdPdV5OQCbAYi2xeP1Xm3BFvH0x88xWhg99yTi5P2MYNF/LoXlYz38Zwrss1CI/g+UjVYwHV4xBMidFe0tdAkqHdCu/vi0d8bKe6N9uOdK0B4sPaVWDmC9LN/U3GND9o5zzj4LhXcbMnY6Q8ZObMjyD3eH91pjJjOi7HigY8Y4CcqR0+vAEf9WE3PV4qI7yefzP1BLAwQUAAAACACsSiZd+lwBWQMDAADaDQAAEwAAAHhsL3RoZW1lL3RoZW1lMS54bWy9V9tymzAU/BVG7w03c/OEZBLHbh/SaafJD8ggQI0QHkmOnb/vIG4CjOM0duwHS2LP2UXnsMLXt/ucaK+IcVzQEJhXBtAQjYoY0zQEW5F888HtzTWciwzlSKMwRyFYZFB8//0MtH1OKJ/DEGRCbOa6zqMM5ZBfFRtE9zlJCpZDwa8KluoxgztM05zolmG4eg4xBW3eJUE5ooKXCxFhT9EBsvJa/GKWP/yNLwjTXiEJwQ7TuNg9o70AGoFcLAgLgSE/QNNvrvU2ioiJYCVwJT9NYB0Rv1gykKXrNtJYWv7M7BgkgogxcOmX3y6jRMAoQrSWo4JNxzV8qwErqGp4IHvgmfYgQGGwxwyBe2/N+gESVQ1n4xtdBcsHpx8gUdXQGQXcGdZ9YPcDJKoauqOA2fLOs5b9AInKCKYvY7jr+b7bwFtMUpAfB/GB6xreQ4PvYLrSalUCKnqN9ytJcIRk3+Xwb8FWBRWyylBgqom3DUpgVDYoJHjNsPaI00xIHjhH8B1AxI8C9AFnjum7Ao5QHyFt6ToGXd0MuTW5mHwkE0zIk3gj6JFLcbwgOF5hQuRERrWl2GQLwhrCHjBlsBvzOlXKtU3BQ2CAyVzSQTAV1ZrrNU89nJNt/rOI66Y3WzuAcw5Fd8FwFJ9oGeQs5aqGEneyDs+e0NHRDXXYJ+qQd3KyEN/8sJDgqBBdKQ/BVIPlKeHMarvlESQoLgtWJ+iV9SwlDmZTd2R9dmtPKDHPYIyavMaUkqlm67rwDEVWpHj+YSVBMCGk3KpLFFkf2wGh/Zm2K/m95u7+yyw2jIsHyLMKJy+15ytVaALD+QIaq9yZy9Howz1ESYIiMbHSTR+5qLMcvPxZdDkptgKxpyzeaWuyZX9gHALHMx0DaDHmoimAFmPWtc/4/aJbh2STwdrJew9thZfjllMRK+UMpffnteJ1ujrLcfV+1MC1puzWm34SL3A+Bsq5pPhH4H/UUyurPPexqepQ5U0arT0hz76Q0XZd+XWGOmzZ0mOb1zE5G/yBalZu/gFQSwMEFAAAAAgArEomXQ0euehlAAAAcwAAABQAAAB4bC9zaGFyZWRTdHJpbmdzLnhtbAXBUQrDIAwA0KtI/mfcPsaQ2p5F2rQKJhaTDY+/95ZtcnM/Glq7JHj6AI5k70eVK8HXzscHtnWZUdXc5CYaZ4JidkdE3QtxVt9vksnt7IOzqe/jQr0H5UMLkXHDVwhv5FwFHK5/UEsDBBQAAAAIAKxKJl3b81bzvQEAAF0FAAAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sndRdr5sgGAfwr0Ke+1VrX09z7Ak72tZ07RrXZsnumOJLJmKAtn78RXSak7As7gqR/w8Envj6VrMCPaiQOS9dmE5sQLSMeJyXqQt3lXxaw9v2td48ufglM0oVqllRyk3tQqZUtbEsGWWUETnhFS1rViRcMKLkhIvUkpWgJNaMFZZj20uLkbyEZkL9dqfDF4FimpB7oUL+PNA8zZQL0wUgqwlGvJBdi1jefCQgRmrdPvNYZS44NqAsj2NaumADiu5Scfa9HZsO07Tc6bgz8PUIPuv4rOfT+Qg+7/h84GNWX3R8MXBnBF92fDnw5Qi+6vjq//i64+vh5Mcc3UvHXwb+z71bQ/3ogvOIIk1H8CcSOtTUWlMALe6rT9do1GTwFJDUR6ZckErokcc2OPlBM/2jXaSPfzbHTzg8YnT66vlfTOrdrA54F/zAJuCZQeifj6a4b45fAuPX7MzpfYg935Tf/yWPQ3y+Gk/pYBaevw+++Wd0weG7cduB2R1v1xva4est/KgsfdO6/XD9FUnpiYg0LyUqaKJcsCcrQKK9fP2seKWfFoB+cqU4+9PLKImpaHozQAnnqu+09db/Kbe/AVBLAwQUAAAACACsSiZdR5JGbXYCAABhBgAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQyLnhtbI2Vy07bQBSGX+VopO4gjp0LIcKgQNOCEhOEgqqyO8STeJS5RONxbi/QN+iqEku28TPEvFdlhwYXOW5XM2fm/P//aWQdn10sBYc51SFT0iV2pUqAypHymZy4JDLj4xa5OD9bthdKT8OAUgNLwWXYXrokMGbWtqxwFFCBYUXNqFwKPlZaoAkrSk+scKYp+plMcMupVpuWQCZJapidfsma7zT4dIwRN/dqcU3ZJDAusRsErLRxpHj4toJgKSQBgctsXTDfBC6xWwQC5vtUuqRKYBSFRolvb3fvNju58yZ39vKG8y+59Y6RcX9Gg2mh1QJ02pQlpNuOTSB0SZ2AcUlodHYzP7+67Q69wWWy6cNwcNd/gKtkc915hG6v303d57uMvc1lsU1n+5LEU44C/xJZGUkOyMkBOZmT7Xyw6kUaOdiF4QckNoRokliDCzaM2ZpNQ8phxAJcZ0c3XvemnKuW46qVcTmFXAckaS7Y9WO7CQFKyhnMKayQyyRejxA0TlGA4gJ5EvtJrCvlkPUcZL0MslYIeUDSWckkzp4IfBWuENj2hUmfwhPTMKVreIp4JP+XsZFjbBQHPiodSR4VMh6QpHRH4KGeInjKp/wIrnGcxGs8gnsqp+VMzRxTszjgq0afFhIdEHjbX72u53X7YMH2x6AHyeZ7sgFrvw4ehv3usBzsJAd2Upxzx3gh1oH27U8t23DagDldIXw6bZQDtHIArWLHW2UKAQ60X+LrM89GgU5i8GnyzF6fDdOCrpgs/nasD7NrhhPqoZ4wGQKnY+OSauWEgN6N32xv1CzbNQg8KWOU+FMFFH2q06pGYKyU2Re7Ybn/W5z/BlBLAwQUAAAAAACsSiZdSYHG7SgBAAAoAQAACwAAAF9yZWxzLy5yZWxz77u/PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz48UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNoaXBzIj48UmVsYXRpb25zaGlwIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0iL3hsL3dvcmtib29rLnhtbCIgSWQ9IlIxZTExYzkyMmZmNWU0YTQ4IiAvPjwvUmVsYXRpb25zaGlwcz5QSwMEFAAAAAgArEomXY7NlKQiAQAAkQMAABoAAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc83TTU7DMBAF4KtE3hM7Tty4qGk3bNiWXmBqj5OosR3ZLqRnY8GRuALiRyhBLNhUYjOLN9LT55H8+vyy2U12yB4xxN67hhQ5Ixk65XXv2oack7mRZLfd7HGA1HsXu36M2WQHFxvSpTTeUhpVhxZi7kd0kx2MDxZSzH1o6QjqBC1SztiKhnkHWXZmh8uIf2n0xvQK77w6W3Tpl2Ia02XASLIDhBZTQ+g0fGX5ZAeS3euG7MEIDmBkVRzLiumCZPRqoNShxaXnI/qcxUxVK1UXqGsNHCtRX1UVOwioH1LoXfvzWvPVjIdomILVWsgCKi3hmrwnH06xQ0xL2nf8/gDENL+eKNdCaLmWvIRKifIf8PiMJ/lK8KNhUghWmfqTRxcfa/sGUEsDBBQAAAAIAKxKJl2hO89OGwEAANwDAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbLWTQU7DMBBFrxJ5i2K3XSCEknYBbAEJLmA5k8SqPbY8k5KejQVH4gqoLqoAIUVV241nM37v/8V8vn9Uq9G7YgOJbMBazOVMFIAmNBa7WgzcljditaxetxGoGL1DqkXPHG+VItOD1yRDBBy9a0PymkmG1KmozVp3oBaz2bUyARmQS94xxLK6h1YPjouHkQH32tE7Udzt93aqWugYnTWabUC1weaPpAxtaw00wQwekCXFBLqhHoC9k3lKry1eZbD615nA0XHS71Yygcs71NtIB8XTBlKyDRTPOvGj9lALNTpFvHVA8swNM3RKzT142L/zkwNkzGTZXidoXjhZ7M7e+Sd7KshbSOv8kVQep/f/HebAPzbI4uJBVL7V5RdQSwECFAMUAAAACACrSiZdSUDrYOgAAAC2AQAADwAAAAAAAAAAAAAApIEAAAAAeGwvd29ya2Jvb2sueG1sUEsBAhQDFAAAAAgAq0omXbyM9ELQAQAAcwsAAA0AAAAAAAAAAAAAAKSBFQEAAHhsL3N0eWxlcy54bWxQSwECFAMUAAAACACsSiZd+lwBWQMDAADaDQAAEwAAAAAAAAAAAAAApIEQAwAAeGwvdGhlbWUvdGhlbWUxLnhtbFBLAQIUAxQAAAAIAKxKJl0NHrnoZQAAAHMAAAAUAAAAAAAAAAAAAACkgUQGAAB4bC9zaGFyZWRTdHJpbmdzLnhtbFBLAQIUAxQAAAAIAKxKJl3b81bzvQEAAF0FAAAYAAAAAAAAAAAAAACkgdsGAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwECFAMUAAAACACsSiZdR5JGbXYCAABhBgAAGAAAAAAAAAAAAAAApIHOCAAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sUEsBAhQDFAAAAAAArEomXUmBxu0oAQAAKAEAAAsAAAAAAAAAAAAAAKSBegsAAF9yZWxzLy5yZWxzUEsBAhQDFAAAAAgArEomXY7NlKQiAQAAkQMAABoAAAAAAAAAAAAAAKSBywwAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAhQDFAAAAAgArEomXaE7z04bAQAA3AMAABMAAAAAAAAAAAAAAKSBJQ4AAFtDb250ZW50X1R5cGVzXS54bWxQSwUGAAAAAAkACQBJAgAAcQ8AAAAA`;

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
  a.download = 'cihaz_talep_toplu_sablon.xlsx';
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
  const seenImeis = new Set<string>();

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

    const imei =
      getValue(row, 'IMEI')
        .replace(/\D/g, '')
        .trim();

    const excelLine = rowIndex + 1;

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

    if (!/^[0-9]{14,16}$/.test(imei)) {
      errors.push(
        `${excelLine}. satır: IMEI 14-16 haneli yalnızca rakamlardan oluşmalıdır.`
      );
    }

    if (imei && seenImeis.has(imei)) {
      errors.push(
        `${excelLine}. satır: Aynı IMEI Excel içinde birden fazla kez bulunuyor.`
      );
    } else if (imei) {
      seenImeis.add(imei);
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
      stokAdet: 1,
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
