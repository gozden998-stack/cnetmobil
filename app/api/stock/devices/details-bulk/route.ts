// app/api/stock/devices/details-bulk/route.ts
// CNETMOBIL V2 - CNET DEPO EXCEL DETAY TOPLU GUNCELLEME
// SADECE YONETICI MAIL (admin rolu) + Super Admin kullanabilir.
// SADECE CNET deposundaki mevcut cihaz detaylarini gunceller.
// WingSM'e HICBIR veri yazmaz.
// IMEI / marka / model / hafiza / magaza bilgileri degismez.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, type PoolClient } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetStockDetailsBulkPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const TARGET_BRANCH = 'CNET';
const MAX_ROWS = 1500;
const MAX_BODY_BYTES = 3_000_000;

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

type ActiveUser = {
  id: number;
  username: string;
  branch: string;
  role: string;
  stockBranchCode: string | null;
  isSuperAdmin: boolean;
};

type BulkDetailInput = {
  imei: string;
  color: string;
  batteryPercent: number;
  grade: string;
  warranty: string;
  changedParts: string;
  boxInvoice: string;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetStockDetailsBulkPool) {
    global.cnetStockDetailsBulkPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetStockDetailsBulkPool;
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

    if (signatureBuffer.length !== expectedBuffer.length) return null;
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

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

function validateOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  const expectedAppUrl = process.env.APP_URL;

  if (!expectedAppUrl) {
    const host = request.headers.get('host');
    const proto =
      request.headers.get('x-forwarded-proto') ||
      request.nextUrl.protocol.replace(':', '');

    if (!host || !origin) return false;
    return origin === `${proto}://${host}`;
  }

  try {
    return origin === new URL(expectedAppUrl).origin;
  } catch {
    return false;
  }
}

async function getAuthenticatedUser(
  request: NextRequest
): Promise<ActiveUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySession(token);
  if (!session?.userId) return null;

  const result = await getPool().query(
    `
      SELECT
        u.id,
        u.username,
        u.branch,
        u.role,
        u.active,
        u.stock_branch_code,
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
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
  if (!row || row.active !== true) return null;

  return {
    id: Number(row.id),
    username: String(row.username),
    branch: String(row.branch),
    role: String(row.role),
    stockBranchCode: row.stock_branch_code
      ? String(row.stock_branch_code)
      : null,
    isSuperAdmin: row.is_super_admin === true,
  };
}

function isManagerUser(user: ActiveUser) {
  return (
    !user.isSuperAdmin &&
    String(user.role || '').trim().toLowerCase() === 'admin'
  );
}

function normalizeImei(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

function cleanRequiredText(
  value: unknown,
  fieldLabel: string,
  maxLength: number
) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`${fieldLabel} boş bırakılamaz.`);
  }

  if (text.length > maxLength) {
    throw new Error(`${fieldLabel} çok uzun.`);
  }

  return text;
}

function parseBattery(value: unknown) {
  const text = String(value ?? '').replace('%', '').trim();
  const batteryPercent = Number(text);

  if (
    !text ||
    !Number.isInteger(batteryPercent) ||
    batteryPercent < 0 ||
    batteryPercent > 100
  ) {
    throw new Error('Pil 0 ile 100 arasında tam sayı olmalıdır.');
  }

  return batteryPercent;
}

function normalizeAndValidateRows(rawRows: unknown[]): {
  rows: BulkDetailInput[];
  errors: Array<{ row: number; imei: string; error: string }>;
} {
  const rows: BulkDetailInput[] = [];
  const errors: Array<{ row: number; imei: string; error: string }> = [];
  const seenImeis = new Set<string>();

  rawRows.forEach((raw, index) => {
    const excelRow = index + 2;

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      errors.push({
        row: excelRow,
        imei: '',
        error: 'Satır biçimi geçersiz.',
      });
      return;
    }

    const item = raw as Record<string, unknown>;
    const imei = normalizeImei(item.imei);

    try {
      if (!/^[0-9]{14,16}$/.test(imei)) {
        throw new Error('IMEI 14-16 haneli ve yalnızca rakamlardan oluşmalıdır.');
      }

      if (seenImeis.has(imei)) {
        throw new Error('Aynı IMEI Excel içinde birden fazla kez bulunuyor.');
      }

      seenImeis.add(imei);

      const color = cleanRequiredText(item.color, 'Renk', 100);
      const batteryPercent = parseBattery(item.batteryPercent);
      const grade = cleanRequiredText(item.grade, 'Grade', 50);
      const warranty = cleanRequiredText(item.warranty, 'Garanti', 100);
      const changedParts = cleanRequiredText(
        item.changedParts,
        'Değişen Parça',
        300
      );
      const boxInvoice = cleanRequiredText(
        item.boxInvoice,
        'Kutu / Fatura',
        100
      );

      rows.push({
        imei,
        color,
        batteryPercent,
        grade,
        warranty,
        changedParts,
        boxInvoice,
      });
    } catch (error) {
      errors.push({
        row: excelRow,
        imei,
        error: error instanceof Error ? error.message : 'Satır geçersiz.',
      });
    }
  });

  return { rows, errors };
}

export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;

  try {
    if (!validateOrigin(request)) {
      return json({ success: false, error: 'Geçersiz istek kaynağı.' }, 403);
    }

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return json({ success: false, error: 'Oturum gerekli.' }, 401);
    }

    const managerAccess = isManagerUser(user);

    if (!managerAccess && !user.isSuperAdmin) {
      return json(
        {
          success: false,
          error:
            'CNET Excel detay güncelleme işlemi yalnızca yönetici tarafından kullanılabilir.',
        },
        403
      );
    }

    const contentLength = Number(request.headers.get('content-length') || 0);

    if (contentLength > MAX_BODY_BYTES) {
      return json({ success: false, error: 'Excel verisi çok büyük.' }, 413);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const rawRows = Array.isArray((body as Record<string, unknown>).updates)
      ? ((body as Record<string, unknown>).updates as unknown[])
      : [];

    if (rawRows.length < 1) {
      return json(
        { success: false, error: 'Güncellenecek cihaz bulunamadı.' },
        400
      );
    }

    if (rawRows.length > MAX_ROWS) {
      return json(
        {
          success: false,
          error: `Tek yüklemede en fazla ${MAX_ROWS} cihaz güncellenebilir.`,
        },
        400
      );
    }

    const { rows, errors } = normalizeAndValidateRows(rawRows);

    if (errors.length > 0) {
      return json(
        {
          success: false,
          error: 'Excel içinde hatalı veya eksik satırlar var.',
          code: 'EXCEL_VALIDATION_ERROR',
          errors: errors.slice(0, 100),
          errorCount: errors.length,
        },
        400
      );
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    // Aynı anda iki toplu yükleme CNET detaylarını yarıştırmasın.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      ['stock-details-bulk:CNET']
    );

    const imeis = rows.map((item) => item.imei);

    const existingResult = await client.query(
      `
        SELECT
          id,
          imei,
          brand,
          model,
          memory,
          color,
          battery_percent,
          grade,
          warranty,
          changed_parts,
          box_invoice,
          current_branch_code,
          status
        FROM public.stock_devices
        WHERE imei = ANY($1::text[])
        FOR UPDATE
      `,
      [imeis]
    );

    const existingByImei = new Map<string, any>();

    for (const row of existingResult.rows) {
      existingByImei.set(String(row.imei || ''), row);
    }

    const ownershipErrors: Array<{
      row: number;
      imei: string;
      error: string;
    }> = [];

    rows.forEach((item, index) => {
      const device = existingByImei.get(item.imei);
      const excelRow = index + 2;

      if (!device) {
        ownershipErrors.push({
          row: excelRow,
          imei: item.imei,
          error: 'IMEI sistemde bulunamadı.',
        });
        return;
      }

      if (String(device.current_branch_code || '').toUpperCase() !== TARGET_BRANCH) {
        ownershipErrors.push({
          row: excelRow,
          imei: item.imei,
          error: 'Bu IMEI artık CNET deposunda değil. Güncelleme yapılmadı.',
        });
        return;
      }

      const status = String(device.status || '').toUpperCase();

      if (status === 'SOLD' || status === 'PASSIVE' || status === 'MISSING') {
        ownershipErrors.push({
          row: excelRow,
          imei: item.imei,
          error: `Bu cihaz ${status} durumunda olduğu için güncellenemez.`,
        });
      }
    });

    if (ownershipErrors.length > 0) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error:
            'Bazı IMEI kayıtları CNET deposuyla eşleşmedi. Hiçbir cihaz güncellenmedi.',
          code: 'CNET_DEVICE_MATCH_ERROR',
          errors: ownershipErrors.slice(0, 100),
          errorCount: ownershipErrors.length,
        },
        409
      );
    }

    let updatedCount = 0;

    for (const item of rows) {
      const existing = existingByImei.get(item.imei);
      const oldStatus = String(existing.status || '').toUpperCase();

      // Aktif talep / transfer varsa durum korunur.
      // Normal CNET stok cihazinda detaylar artik eksiksiz oldugu icin AVAILABLE olur.
      const newStatus =
        oldStatus === 'DETAILS_PENDING' || oldStatus === 'AVAILABLE'
          ? 'AVAILABLE'
          : oldStatus;

      const updateResult = await client.query(
        `
          UPDATE public.stock_devices
          SET
            color = $2,
            battery_percent = $3,
            grade = $4,
            warranty = $5,
            changed_parts = $6,
            box_invoice = $7,
            status = $8,
            details_completed_at = COALESCE(details_completed_at, now()),
            details_completed_by = $9
          WHERE id = $1
            AND current_branch_code = 'CNET'
          RETURNING id, imei, status
        `,
        [
          existing.id,
          item.color,
          item.batteryPercent,
          item.grade,
          item.warranty,
          item.changedParts,
          item.boxInvoice,
          newStatus,
          user.username,
        ]
      );

      if (updateResult.rowCount !== 1) {
        throw new Error(`${item.imei} IMEI güncellenemedi.`);
      }

      await client.query(
        `
          INSERT INTO public.stock_events (
            device_id,
            imei,
            event_type,
            from_branch_code,
            to_branch_code,
            old_status,
            new_status,
            performed_by,
            metadata
          )
          VALUES (
            $1,
            $2,
            'DEVICE_DETAILS_BULK_UPDATED',
            'CNET',
            'CNET',
            $3,
            $4,
            $5,
            $6::jsonb
          )
        `,
        [
          existing.id,
          item.imei,
          oldStatus,
          newStatus,
          user.username,
          JSON.stringify({
            source: 'CNET_EXCEL_DETAILS',
            old: {
              color: existing.color,
              batteryPercent: existing.battery_percent,
              grade: existing.grade,
              warranty: existing.warranty,
              changedParts: existing.changed_parts,
              boxInvoice: existing.box_invoice,
            },
            new: {
              color: item.color,
              batteryPercent: item.batteryPercent,
              grade: item.grade,
              warranty: item.warranty,
              changedParts: item.changedParts,
              boxInvoice: item.boxInvoice,
            },
          }),
        ]
      );

      updatedCount += 1;
    }

    await client.query('COMMIT');

    return json({
      success: true,
      message: `${updatedCount} CNET cihazının detayları Excel üzerinden güncellendi.`,
      branch: TARGET_BRANCH,
      updatedCount,
      totalRows: rows.length,
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }

    console.error('CNET STOCK DETAILS BULK UPDATE ERROR:', error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'CNET cihaz detayları toplu güncellenemedi.',
      },
      500
    );
  } finally {
    client?.release();
  }
}
