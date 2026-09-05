// app/api/stock/devices/bulk/route.ts
// CNETMOBIL V2 - Toplu IMEI cihaz ekleme API
// WingSM yok: manuel/toplu Excel yükleme için PostgreSQL'e direkt kayıt.
// Her mağaza sadece kendi stokuna toplu cihaz ekleyebilir.
// Super Admin tüm mağazalara ekleyebilir.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, type PoolClient } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetStockBulkPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const MAX_BULK_DEVICES = 500;

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

type BulkDeviceInput = {
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  batteryPercent: number | null;
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

  if (!global.cnetStockBulkPool) {
    global.cnetStockBulkPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetStockBulkPool;
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

  if (!row || row.active !== true) {
    return null;
  }

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

function normalizeBranch(value: unknown) {
  return String(value ?? '').trim().toLocaleUpperCase('tr-TR');
}

function normalizeImei(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').trim();
}

function cleanText(
  value: unknown,
  fieldName: string,
  maxLength: number,
  required = false
) {
  const text = String(value ?? '').trim();

  if (required && !text) {
    throw new Error(`${fieldName} zorunludur.`);
  }

  if (text.length > maxLength) {
    throw new Error(`${fieldName} çok uzun.`);
  }

  // Excel formula enjeksiyonunu veri tabanına taşımayalım.
  if (/^[=+\-@]/.test(text)) {
    throw new Error(`${fieldName} geçersiz karakterle başlıyor.`);
  }

  return text;
}

function parseBattery(value: unknown): number | null {
  if (
    value === null ||
    typeof value === 'undefined' ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const n = Number(String(value).replace('%', '').trim());

  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new Error('Pil yüzdesi 0-100 arasında olmalıdır.');
  }

  return n;
}

async function branchExists(branchCode: string) {
  const result = await getPool().query(
    `
      SELECT code
      FROM public.branches
      WHERE code = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [branchCode]
  );

  return result.rowCount === 1;
}

function parseDevice(
  raw: unknown,
  rowNumber: number
): BulkDeviceInput {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${rowNumber}. satır geçersiz.`);
  }

  const row = raw as Record<string, unknown>;

  const imei = normalizeImei(row.imei);

  if (!/^[0-9]{14,16}$/.test(imei)) {
    throw new Error(
      `${rowNumber}. satır: IMEI 14-16 haneli yalnızca rakamlardan oluşmalıdır.`
    );
  }

  return {
    imei,
    brand: cleanText(row.brand, `${rowNumber}. satır Marka`, 100, true),
    model: cleanText(row.model, `${rowNumber}. satır Model`, 180, true),
    memory: cleanText(row.memory, `${rowNumber}. satır Hafıza`, 50, true),
    color: cleanText(row.color, `${rowNumber}. satır Renk`, 100),
    batteryPercent: parseBattery(row.batteryPercent),
    grade: cleanText(row.grade, `${rowNumber}. satır Grade`, 50),
    warranty: cleanText(row.warranty, `${rowNumber}. satır Garanti`, 100),
    changedParts: cleanText(
      row.changedParts,
      `${rowNumber}. satır Değişen Parça`,
      300
    ),
    boxInvoice: cleanText(
      row.boxInvoice,
      `${rowNumber}. satır Kutu/Fatura`,
      100
    ),
  };
}

function isDetailsComplete(device: BulkDeviceInput) {
  return (
    Boolean(device.color) &&
    device.batteryPercent !== null &&
    Boolean(device.grade) &&
    Boolean(device.warranty) &&
    Boolean(device.changedParts) &&
    Boolean(device.boxInvoice)
  );
}

// ============================================================
// POST /api/stock/devices/bulk
//
// body:
// {
//   branchCode?: "CMR",
//   devices: [
//     {
//       imei,
//       brand,
//       model,
//       memory,
//       color,
//       batteryPercent,
//       grade,
//       warranty,
//       changedParts,
//       boxInvoice
//     }
//   ]
// }
// ============================================================
export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;

  try {
    if (!validateOrigin(request)) {
      return json(
        { success: false, error: 'Geçersiz istek kaynağı.' },
        403
      );
    }

    const user = await getAuthenticatedUser(request);

    if (!user) {
      return json({ success: false, error: 'Oturum gerekli.' }, 401);
    }

    const contentLength = Number(
      request.headers.get('content-length') || 0
    );

    if (contentLength > 2_000_000) {
      return json(
        { success: false, error: 'Toplu yükleme isteği çok büyük.' },
        413
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const data = body as Record<string, unknown>;

    const rawDevices = Array.isArray(data.devices)
      ? data.devices
      : [];

    if (
      rawDevices.length < 1 ||
      rawDevices.length > MAX_BULK_DEVICES
    ) {
      return json(
        {
          success: false,
          error: `Toplu yüklemede 1-${MAX_BULK_DEVICES} cihaz olmalıdır.`,
        },
        400
      );
    }

    const requestedBranch = normalizeBranch(data.branchCode);

    let targetBranch: string;

    if (user.isSuperAdmin && requestedBranch) {
      targetBranch = requestedBranch;
    } else {
      if (!user.stockBranchCode) {
        return json(
          {
            success: false,
            error: 'Kullanıcının stok mağazası tanımlı değil.',
          },
          403
        );
      }

      targetBranch = user.stockBranchCode;
    }

    if (
      !user.isSuperAdmin &&
      requestedBranch &&
      requestedBranch !== user.stockBranchCode
    ) {
      return json(
        {
          success: false,
          error: 'Başka mağazanın stoğuna toplu cihaz ekleyemezsiniz.',
        },
        403
      );
    }

    if (!(await branchExists(targetBranch))) {
      return json({ success: false, error: 'Mağaza bulunamadı.' }, 404);
    }

    let devices: BulkDeviceInput[];

    try {
      devices = rawDevices.map((row, index) =>
        parseDevice(row, index + 2)
      );
    } catch (error) {
      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Excel cihaz bilgileri geçersiz.',
        },
        400
      );
    }

    // Excel'in kendi içinde aynı IMEI varsa işlem başlamadan reddet.
    const seen = new Set<string>();
    const duplicateInsideFile: string[] = [];

    for (const device of devices) {
      if (seen.has(device.imei)) {
        duplicateInsideFile.push(device.imei);
      }
      seen.add(device.imei);
    }

    if (duplicateInsideFile.length) {
      return json(
        {
          success: false,
          error: `Excel içinde tekrar eden IMEI var: ${[
            ...new Set(duplicateInsideFile),
          ]
            .slice(0, 10)
            .join(', ')}`,
        },
        409
      );
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    // DB'de zaten kayıtlı IMEI'leri toplu kontrol et.
    const existingResult = await client.query(
      `
        SELECT imei, current_branch_code, status
        FROM public.stock_devices
        WHERE imei = ANY($1::text[])
        ORDER BY imei
      `,
      [devices.map((device) => device.imei)]
    );

    if (existingResult.rows.length) {
      await client.query('ROLLBACK');

      const firstRows = existingResult.rows
        .slice(0, 10)
        .map(
          (row) =>
            `${row.imei} (${row.current_branch_code})`
        )
        .join(', ');

      return json(
        {
          success: false,
          error: `Sistemde kayıtlı IMEI bulundu: ${firstRows}`,
          duplicates: existingResult.rows,
        },
        409
      );
    }

    const insertedDevices: Array<Record<string, unknown>> = [];

    // Transaction içinde ekliyoruz:
    // tek bir satır bile hata verirse hiçbir cihaz yarım kalmaz.
    for (const device of devices) {
      const detailsComplete = isDetailsComplete(device);
      const status = detailsComplete
        ? 'AVAILABLE'
        : 'DETAILS_PENDING';

      const insertResult = await client.query(
        `
          INSERT INTO public.stock_devices (
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
            status,
            source,
            details_completed_at,
            details_completed_by,
            created_by
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, 'MANUAL',
            CASE WHEN $13::boolean THEN now() ELSE NULL END,
            CASE WHEN $13::boolean THEN $14 ELSE NULL END,
            $14
          )
          RETURNING
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
            status,
            source,
            created_at
        `,
        [
          device.imei,
          device.brand,
          device.model,
          device.memory,
          device.color || null,
          device.batteryPercent,
          device.grade || null,
          device.warranty || null,
          device.changedParts || null,
          device.boxInvoice || null,
          targetBranch,
          status,
          detailsComplete,
          user.username,
        ]
      );

      const inserted = insertResult.rows[0];

      insertedDevices.push(inserted);

      await client.query(
        `
          INSERT INTO public.stock_events (
            device_id,
            imei,
            event_type,
            to_branch_code,
            old_status,
            new_status,
            performed_by,
            metadata
          )
          VALUES (
            $1,
            $2,
            'DEVICE_BULK_ADDED',
            $3,
            NULL,
            $4,
            $5,
            $6::jsonb
          )
        `,
        [
          inserted.id,
          inserted.imei,
          targetBranch,
          inserted.status,
          user.username,
          JSON.stringify({
            source: 'MANUAL_BULK',
            brand: device.brand,
            model: device.model,
            memory: device.memory,
            detailsComplete,
          }),
        ]
      );
    }

    await client.query('COMMIT');

    const detailsPendingCount = insertedDevices.filter(
      (device) => device.status === 'DETAILS_PENDING'
    ).length;

    return json(
      {
        success: true,
        message: `${insertedDevices.length} cihaz stoğa eklendi.`,
        branchCode: targetBranch,
        insertedCount: insertedDevices.length,
        detailsPendingCount,
        availableCount:
          insertedDevices.length - detailsPendingCount,
        devices: insertedDevices,
      },
      201
    );
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // rollback hatası asıl hatayı gizlemesin
      }
    }

    if (error?.code === '23505') {
      return json(
        {
          success: false,
          error: 'Aynı IMEI sistemde zaten kayıtlı.',
        },
        409
      );
    }

    console.error('STOCK DEVICES BULK POST ERROR:', error);

    return json(
      {
        success: false,
        error: 'Toplu cihaz ekleme işlemi başarısız.',
      },
      500
    );
  } finally {
    client?.release();
  }
}
