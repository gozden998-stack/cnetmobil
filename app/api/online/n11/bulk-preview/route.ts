// app/api/online/n11/bulk-preview/route.ts
// CNETMOBIL ONLINE - EXCEL TOPLU CIHAZ ONIZLEME
// SADECE SUPER ADMIN.
// Bu adim N11'e urun GONDERMEZ.
// Sadece .xlsx dosyasini okur, kolonlari ve satirlari dogrular.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11BulkPreviewPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const MAX_ROWS = 500;

const REQUIRED_HEADERS = [
  'IMEI',
  'MARKA',
  'MODEL',
  'HAFIZA',
  'RENK',
  'GRADE',
  'GARANTI',
  'N11_SATIS_FIYATI',
  'N11_LISTE_FIYATI',
] as const;

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetN11BulkPreviewPool) {
    global.cnetN11BulkPreviewPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11BulkPreviewPool;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error('SESSION_SECRET bulunamadı.');
  }

  return secret;
}

function verifySession(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split('.');

    if (!encoded || !signature) return null;

    const expectedSignature = crypto
      .createHmac('sha256', getSessionSecret())
      .update(encoded)
      .digest('base64url');

    const signatureBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (
      !payload ||
      !payload.userId ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000) ||
      !['admin', 'personel'].includes(payload.role) ||
      typeof payload.branch !== 'string'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return {
      ok: false as const,
      status: 401,
      error: 'Oturum gerekli.',
    };
  }

  const session = verifySession(token);

  if (!session?.userId) {
    return {
      ok: false as const,
      status: 401,
      error: 'Oturum geçersiz.',
    };
  }

  const result = await getPool().query(
    `
      SELECT
        u.id,
        u.username,
        u.active,
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r
            ON r.id = ur.role_id
          WHERE ur.user_id = u.id
            AND r.code = 'super_admin'
            AND r.active = TRUE
        ) AS is_super_admin
      FROM public.users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [session.userId]
  );

  const row = result.rows[0];

  if (!row || row.active !== true) {
    return {
      ok: false as const,
      status: 401,
      error: 'Kullanıcı aktif değil.',
    };
  }

  if (row.is_super_admin !== true) {
    return {
      ok: false as const,
      status: 403,
      error: 'Bu işlem yalnızca Super Admin tarafından yapılabilir.',
    };
  }

  return {
    ok: true as const,
    username: String(row.username),
  };
}

function normalizeText(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }

  return String(value).trim();
}

function normalizeHeader(value: unknown) {
  return normalizeText(value)
    .toLocaleUpperCase('tr-TR')
    .replace(/\s+/g, '_');
}

function parsePrice(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  const raw = normalizeText(value)
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  if (!raw) return NaN;

  return Number(raw);
}

function validateImei(value: string) {
  return /^[0-9]{15}$/.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);

    if (!auth.ok) {
      return json(
        {
          success: false,
          error: auth.error,
        },
        auth.status
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return json(
        {
          success: false,
          error: 'Excel dosyası seçilmedi.',
        },
        400
      );
    }

    const lowerName = file.name.toLocaleLowerCase('tr-TR');

    if (!lowerName.endsWith('.xlsx')) {
      return json(
        {
          success: false,
          error: 'Yalnızca .xlsx Excel dosyası yükleyebilirsiniz.',
        },
        400
      );
    }

    if (file.size <= 0) {
      return json(
        {
          success: false,
          error: 'Excel dosyası boş.',
        },
        400
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return json(
        {
          success: false,
          error: 'Excel dosyası en fazla 10 MB olabilir.',
        },
        400
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let workbook: XLSX.WorkBook;

    try {
      workbook = XLSX.read(buffer, {
        type: 'buffer',
        cellText: false,
        cellDates: false,
        raw: true,
      });
    } catch {
      return json(
        {
          success: false,
          error: 'Excel dosyası okunamadı veya bozuk.',
        },
        400
      );
    }

    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      return json(
        {
          success: false,
          error: 'Excel içinde çalışma sayfası bulunamadı.',
        },
        400
      );
    }

    const worksheet = workbook.Sheets[firstSheetName];

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });

    if (matrix.length === 0) {
      return json(
        {
          success: false,
          error: 'Excel sayfası boş.',
        },
        400
      );
    }

    const headerRow = Array.isArray(matrix[0])
      ? matrix[0].map(normalizeHeader)
      : [];

    const headerIndexes: Record<string, number> = {};

    headerRow.forEach((header, index) => {
      if (header && headerIndexes[header] === undefined) {
        headerIndexes[header] = index;
      }
    });

    const missingHeaders = REQUIRED_HEADERS.filter(
      (header) => headerIndexes[header] === undefined
    );

    if (missingHeaders.length > 0) {
      return json(
        {
          success: false,
          error: `Eksik Excel kolonları: ${missingHeaders.join(', ')}`,
          requiredHeaders: REQUIRED_HEADERS,
        },
        400
      );
    }

    const rawRows = matrix
      .slice(1)
      .filter((row) =>
        Array.isArray(row) &&
        row.some((value) => normalizeText(value) !== '')
      );

    if (rawRows.length === 0) {
      return json(
        {
          success: false,
          error: 'Excel içinde cihaz satırı bulunamadı.',
        },
        400
      );
    }

    if (rawRows.length > MAX_ROWS) {
      return json(
        {
          success: false,
          error: `Tek seferde en fazla ${MAX_ROWS} cihaz yüklenebilir.`,
        },
        400
      );
    }

    const seenImeis = new Set<string>();

    const rows = rawRows.map((row, index) => {
      const get = (header: typeof REQUIRED_HEADERS[number]) =>
        (row as unknown[])[headerIndexes[header]];

      const imei = normalizeText(get('IMEI')).replace(/\s+/g, '');
      const brand = normalizeText(get('MARKA'));
      const model = normalizeText(get('MODEL'));
      const memory = normalizeText(get('HAFIZA'));
      const color = normalizeText(get('RENK'));
      const grade = normalizeText(get('GRADE'));
      const warranty = normalizeText(get('GARANTI'));
      const salePrice = parsePrice(get('N11_SATIS_FIYATI'));
      const listPrice = parsePrice(get('N11_LISTE_FIYATI'));

      const errors: string[] = [];

      if (!validateImei(imei)) {
        errors.push('IMEI tam 15 haneli olmalı.');
      }

      if (!brand) errors.push('Marka boş.');
      if (!model) errors.push('Model boş.');
      if (!memory) errors.push('Hafıza boş.');
      if (!color) errors.push('Renk boş.');
      if (!grade) errors.push('Grade boş.');
      if (!warranty) errors.push('Garanti boş.');

      if (!Number.isFinite(salePrice) || salePrice <= 0) {
        errors.push('N11 satış fiyatı geçersiz.');
      }

      if (!Number.isFinite(listPrice) || listPrice <= 0) {
        errors.push('N11 liste fiyatı geçersiz.');
      }

      if (
        Number.isFinite(salePrice) &&
        Number.isFinite(listPrice) &&
        listPrice < salePrice
      ) {
        errors.push('Liste fiyatı satış fiyatından düşük olamaz.');
      }

      if (imei && seenImeis.has(imei)) {
        errors.push('Excel içinde aynı IMEI tekrar ediyor.');
      }

      if (imei) {
        seenImeis.add(imei);
      }

      return {
        rowNumber: index + 2,
        imei,
        brand,
        model,
        memory,
        color,
        grade,
        warranty,
        salePrice: Number.isFinite(salePrice) ? salePrice : null,
        listPrice: Number.isFinite(listPrice) ? listPrice : null,
        valid: errors.length === 0,
        errors,
      };
    });

    const validRows = rows.filter((row) => row.valid);
    const invalidRows = rows.filter((row) => !row.valid);

    return json({
      success: true,
      previewOnly: true,
      fileName: file.name,
      sheetName: firstSheetName,
      totalRows: rows.length,
      validCount: validRows.length,
      invalidCount: invalidRows.length,
      canContinue: invalidRows.length === 0 && validRows.length > 0,
      rows,
      checkedBy: auth.username,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('N11 BULK PREVIEW ERROR:', error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Excel önizleme işlemi başarısız.',
      },
      500
    );
  }
}
