// app/api/online/listings/route.ts
// CNETMOBIL ONLINE - N11 TASLAK LISTING API
// N11 API BAGLI DEGIL.
// GET  -> ONLINE'a uygun cihazlari ve mevcut taslaklari okur.
// POST -> Secilen cihaz icin N11 taslagi olusturur.
// SADECE SUPER ADMIN.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, type PoolClient } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetOnlineListingsPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';

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

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetOnlineListingsPool) {
    global.cnetOnlineListingsPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetOnlineListingsPool;
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
  if (request.method === 'GET') return true;

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

function cleanText(
  value: unknown,
  maxLength: number,
  required = false
): string {
  const text = String(value ?? '').trim();

  if (required && !text) {
    throw new Error('Zorunlu alan eksik.');
  }

  if (text.length > maxLength) {
    throw new Error('Alan uzunluğu geçersiz.');
  }

  return text;
}

function parsePositiveId(value: unknown) {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) return null;

  return id;
}

function parseMoney(value: unknown, fieldName: string) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .replace(/\./g, '')
    .replace(',', '.');

  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new Error(`${fieldName} geçersiz.`);
  }

  return Number(numberValue.toFixed(2));
}

function parseNullableInteger(
  value: unknown,
  fieldName: string,
  min = 0
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ''
  ) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue < min) {
    throw new Error(`${fieldName} geçersiz.`);
  }

  return numberValue;
}


async function requireSuperAdmin(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      user: null,
      response: json({ success: false, error: 'Oturum gerekli.' }, 401),
    };
  }

  if (!user.isSuperAdmin) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error: 'ONLINE modülü yalnızca Super Admin tarafından yönetilebilir.',
        },
        403
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

// ============================================================
// GET /api/online/listings
//
// ONLINE'a uygun cihazlari listeler.
// N11 API'ye istek ATMAZ.
//
// Uygun cihaz:
// - aktif stokta olacak
// - SOLD / PASSIVE olmayacak
// - IMEI 15 haneli olacak
// - ayni cihaz icin N11 listing zaten olmayacak
//
// query:
// ?q=356789...
// ?limit=100
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);

    if (auth.response) return auth.response;

    const q = String(request.nextUrl.searchParams.get('q') || '').trim();
    const requestedLimit = Number(
      request.nextUrl.searchParams.get('limit') || 100
    );

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit >= 1 &&
      requestedLimit <= 500
        ? requestedLimit
        : 100;

    const params: unknown[] = [];
    let searchSql = '';

    if (q) {
      params.push(`%${q}%`);

      searchSql = `
        AND (
          sd.imei ILIKE $1
          OR sd.brand ILIKE $1
          OR sd.model ILIKE $1
          OR sd.memory ILIKE $1
          OR sd.color ILIKE $1
          OR CONCAT_WS(' ', sd.brand, sd.model, sd.memory, sd.color) ILIKE $1
        )
      `;
    }

    params.push(limit);

    const limitParam = params.length;
    const pool = getPool();

    const [devicesResult, draftsResult] = await Promise.all([
      pool.query(
        `
          SELECT
            sd.id,
            sd.imei,
            sd.brand,
            sd.model,
            sd.memory,
            sd.color,
            sd.battery_percent,
            sd.grade,
            sd.warranty,
            sd.changed_parts,
            sd.box_invoice,
            sd.current_branch_code,
            sd.status,
            sd.source,
            sd.created_at,
            sd.updated_at
          FROM public.stock_devices sd
          WHERE sd.status NOT IN ('SOLD', 'PASSIVE')
            AND sd.imei ~ '^[0-9]{15}$'
            AND NOT EXISTS (
              SELECT 1
              FROM public.online_listings ol
              WHERE ol.stock_device_id = sd.id
                AND ol.channel = 'N11'
            )
            ${searchSql}
          ORDER BY
            sd.updated_at DESC,
            sd.id DESC
          LIMIT $${limitParam}
        `,
        params
      ),

      pool.query(
        `
          SELECT
            ol.id,
            ol.stock_device_id,
            ol.channel,
            ol.external_product_id,
            ol.external_stock_code,
            ol.title,
            ol.description,
            ol.category_id,
            ol.sale_price,
            ol.list_price,
            ol.quantity,
            ol.vat_rate,
            ol.preparing_day,
            ol.shipment_template,
            ol.currency_type,
            ol.images,
            ol.attributes,
            ol.product_status,
            ol.sale_status,
            ol.sync_status,
            ol.last_task_id,
            ol.last_task_status,
            ol.last_error,
            ol.last_synced_at,
            ol.created_at,
            ol.updated_at,

            sd.imei,
            sd.brand,
            sd.model,
            sd.memory,
            sd.color,
            sd.battery_percent,
            sd.grade,
            sd.warranty,
            sd.changed_parts,
            sd.box_invoice,
            sd.current_branch_code,
            sd.status AS device_status

          FROM public.online_listings ol
          LEFT JOIN public.stock_devices sd
            ON sd.id = ol.stock_device_id
          WHERE ol.channel = 'N11'
          ORDER BY ol.updated_at DESC, ol.id DESC
          LIMIT 500
        `
      ),
    ]);

    return json({
      success: true,
      availableDevices: devicesResult.rows,
      availableCount: devicesResult.rows.length,
      listings: draftsResult.rows,
      listingCount: draftsResult.rows.length,
    });
  } catch (error) {
    console.error('ONLINE LISTINGS GET ERROR:', error);

    return json(
      {
        success: false,
        error: 'ONLINE cihaz listesi alınamadı.',
      },
      500
    );
  }
}

// ============================================================
// POST /api/online/listings
//
// N11 TASLAGI olusturur.
// N11 API'ye istek ATMAZ.
//
// body:
// {
//   stockDeviceId,
//   salePrice,
//   listPrice
// }
//
// Otomatik:
// channel = N11
// external_stock_code = IMEI
// quantity = 1
// sync_status = DRAFT
// external_product_id = NULL
// ============================================================
export async function POST(request: NextRequest) {
  let client: PoolClient | null = null;

  try {
    if (!validateOrigin(request)) {
      return json(
        {
          success: false,
          error: 'Geçersiz istek kaynağı.',
        },
        403
      );
    }

    const auth = await requireSuperAdmin(request);

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const contentLength = Number(
      request.headers.get('content-length') || 0
    );

    if (contentLength > 100_000) {
      return json(
        {
          success: false,
          error: 'İstek çok büyük.',
        },
        413
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json(
        {
          success: false,
          error: 'Geçersiz istek.',
        },
        400
      );
    }

    const data = body as Record<string, unknown>;

    const stockDeviceId = parsePositiveId(data.stockDeviceId);

    if (!stockDeviceId) {
      return json(
        {
          success: false,
          error: 'Geçersiz cihaz.',
        },
        400
      );
    }

    let salePrice: number | null;
    let listPrice: number | null;

    try {
      salePrice = parseMoney(data.salePrice, 'N11 satış fiyatı');
      listPrice = parseMoney(data.listPrice, 'N11 liste fiyatı');
    } catch (error) {
      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Fiyat bilgileri geçersiz.',
        },
        400
      );
    }

    if (salePrice === null || listPrice === null) {
      return json(
        {
          success: false,
          error: 'N11 satış fiyatı ve N11 liste fiyatı zorunludur.',
        },
        400
      );
    }

    if (
      salePrice !== null &&
      listPrice !== null &&
      listPrice < salePrice
    ) {
      return json(
        {
          success: false,
          error: 'Liste fiyatı satış fiyatından düşük olamaz.',
        },
        400
      );
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    const deviceResult = await client.query(
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
          status,
          source
        FROM public.stock_devices
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [stockDeviceId]
    );

    const device = deviceResult.rows[0];

    if (!device) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: 'Cihaz bulunamadı.',
        },
        404
      );
    }

    const imei = String(device.imei || '').trim();

    if (!/^[0-9]{15}$/.test(imei)) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: 'ONLINE ürün için cihaz IMEI bilgisi tam 15 haneli olmalıdır.',
        },
        409
      );
    }

    const deviceStatus = String(device.status || '');

    if (['SOLD', 'PASSIVE'].includes(deviceStatus)) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: 'Satılmış veya pasif cihaz ONLINE ürüne açılamaz.',
        },
        409
      );
    }

    const duplicateResult = await client.query(
      `
        SELECT
          id,
          channel,
          external_stock_code,
          sync_status
        FROM public.online_listings
        WHERE channel = 'N11'
          AND (
            stock_device_id = $1
            OR external_stock_code = $2
          )
        LIMIT 1
        FOR UPDATE
      `,
      [stockDeviceId, imei]
    );

    if (duplicateResult.rowCount) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: 'Bu cihaz için zaten N11 ONLINE kaydı bulunuyor.',
          existingListing: duplicateResult.rows[0],
        },
        409
      );
    }

    const finalTitle = [
      device.brand,
      device.model,
      device.memory,
      device.color,
      device.grade,
    ]
      .filter(Boolean)
      .map((item) => String(item).trim())
      .filter(Boolean)
      .join(' ') || `CNETMOBIL ${imei}`;

    const insertResult = await client.query(
      `
        INSERT INTO public.online_listings (
          stock_device_id,
          channel,
          external_product_id,
          external_stock_code,
          title,
          sale_price,
          list_price,
          quantity,
          product_status,
          sale_status,
          sync_status,
          currency_type,
          raw_data,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          'N11',
          NULL,
          $2,
          $3,
          $4,
          $5,
          1,
          NULL,
          NULL,
          'DRAFT',
          'TL',
          $6::jsonb,
          now(),
          now()
        )
        RETURNING *
      `,
      [
        stockDeviceId,
        imei,
        finalTitle,
        salePrice,
        listPrice,
        JSON.stringify({
          draftSource: 'PANEL',
          createdBy: auth.user.username,
          deviceSnapshot: {
            id: Number(device.id),
            imei,
            brand: device.brand ?? null,
            model: device.model ?? null,
            memory: device.memory ?? null,
            color: device.color ?? null,
            grade: device.grade ?? null,
            warranty: device.warranty ?? null,
            branchCode: device.current_branch_code ?? null,
            status: device.status ?? null,
            source: device.source ?? null,
          },
        }),
      ]
    );

    await client.query('COMMIT');

    return json(
      {
        success: true,
        message: 'N11 ürün taslağı kaydedildi. Henüz N11 API’ye gönderilmedi.',
        listing: insertResult.rows[0],
      },
      201
    );
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
    }

    if (error?.code === '23505') {
      return json(
        {
          success: false,
          error: 'Bu cihaz için N11 ONLINE kaydı zaten mevcut.',
        },
        409
      );
    }

    console.error('ONLINE LISTINGS POST ERROR:', error);

    return json(
      {
        success: false,
        error: 'N11 ürün taslağı oluşturulamadı.',
      },
      500
    );
  } finally {
    client?.release();
  }
}
