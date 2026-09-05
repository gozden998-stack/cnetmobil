// app/api/admin/prices/route.ts
// CNETMOBIL - Fiyat Yönetimi V1
//
// GET   -> Ana cihaz fiyat listesini PostgreSQL'den okur.
// PATCH -> prices.edit yetkisini kontrol eder, Google Sheets'i UPDATE_DEVICE
//          ile günceller, PostgreSQL'i anında günceller ve audit_logs'a yazar.
//
// Bu ilk modül şu sheet içindir:
// "Google Sheets ile Kurumsal Alım Sistemi"
// Kolonlar:
// A Marka | B Model | C Hafıza | D Baz Fiyat | E Görsel | F Minimum Fiyat

import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetAdminPricesPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const SHEET_NAME = 'Google Sheets ile Kurumsal Alım Sistemi';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetAdminPricesPool) {
    global.cnetAdminPricesPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetAdminPricesPool;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET bulunamadı.');
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

    const a = Buffer.from(signature, 'utf8');
    const b = Buffer.from(expectedSignature, 'utf8');

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (
      !payload ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000) ||
      typeof payload.userId !== 'number'
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
  try {
    const appUrl = process.env.APP_URL;

    const expectedOrigin = appUrl
      ? new URL(appUrl).origin
      : `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host')}`;

    return request.headers.get('origin') === expectedOrigin;
  } catch {
    return false;
  }
}

async function getAuthenticatedUser(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = verifySession(token);
  if (!session?.userId) return null;

  const result = await getPool().query(
    `
      SELECT id, email, branch, active
      FROM public.users
      WHERE id = $1
        AND active = TRUE
      LIMIT 1
    `,
    [session.userId]
  );

  if (result.rowCount !== 1) return null;

  return {
    id: Number(result.rows[0].id),
    email: result.rows[0].email
      ? String(result.rows[0].email)
      : null,
    branch: String(result.rows[0].branch || ''),
  };
}

async function hasPermission(
  userId: number,
  permissionCode: string
): Promise<boolean> {
  const pool = getPool();

  const superAdmin = await pool.query(
    `
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
        AND r.code = 'super_admin'
        AND r.active = TRUE
      LIMIT 1
    `,
    [userId]
  );

  if (superAdmin.rowCount === 1) {
    return true;
  }

  const override = await pool.query(
    `
      SELECT up.allowed
      FROM public.user_permissions up
      JOIN public.permissions p ON p.id = up.permission_id
      WHERE up.user_id = $1
        AND p.code = $2
        AND p.active = TRUE
      LIMIT 1
    `,
    [userId, permissionCode]
  );

  if (override.rowCount === 1) {
    return override.rows[0].allowed === true;
  }

  const rolePermission = await pool.query(
    `
      SELECT 1
      FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      JOIN public.role_permissions rp ON rp.role_id = r.id
      JOIN public.permissions p ON p.id = rp.permission_id
      WHERE ur.user_id = $1
        AND r.active = TRUE
        AND p.active = TRUE
        AND p.code = $2
      LIMIT 1
    `,
    [userId, permissionCode]
  );

  return rolePermission.rowCount === 1;
}

function parsePrice(value: unknown): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value);
  }

  const raw = String(value ?? '').trim();
  if (!raw) return 0;

  // Fiyatlar tam TL olarak tutuluyor:
  // "25.000", "25,000", "25000 TL" -> 25000
  const normalized = raw.replace(/[^\d-]/g, '');
  if (!normalized || normalized === '-') return null;

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;

  return Math.round(n);
}

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  return (
    forwardedFor?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null
  );
}

async function writeAuditLog(params: {
  client: PoolClient;
  userId: number;
  rowNumber: number;
  oldData: Record<string, unknown>;
  newData: Record<string, unknown>;
  ip: string | null;
}) {
  await params.client.query(
    `
      INSERT INTO public.audit_logs
        (
          user_id,
          action,
          module,
          target_type,
          target_id,
          old_data,
          new_data,
          ip_address
        )
      VALUES
        ($1, 'PRICE_UPDATED', 'prices', 'sheet_row', $2, $3::jsonb, $4::jsonb, $5)
    `,
    [
      params.userId,
      `${SHEET_NAME}:${params.rowNumber}`,
      JSON.stringify(params.oldData),
      JSON.stringify(params.newData),
      params.ip,
    ]
  );
}

// ======================================================
// GET /api/admin/prices
// ======================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return json({ success: false, error: 'Oturum gerekli.' }, 401);
    }

    if (!(await hasPermission(user.id, 'prices.view'))) {
      return json(
        { success: false, error: 'Fiyat görüntüleme yetkisi gerekli.' },
        403
      );
    }

    const result = await getPool().query(
      `
        SELECT row_number, data, updated_at
        FROM public.sheet_rows
        WHERE sheet_name = $1
          AND row_number >= 2
        ORDER BY row_number ASC
      `,
      [SHEET_NAME]
    );

    const rows = result.rows
      .map((row) => {
        const data = Array.isArray(row.data) ? row.data : [];

        return {
          rowNumber: Number(row.row_number),
          brand: String(data[0] ?? ''),
          model: String(data[1] ?? ''),
          capacity: String(data[2] ?? ''),
          basePrice: parsePrice(data[3]) ?? 0,
          image: String(data[4] ?? ''),
          minPrice: parsePrice(data[5]) ?? 0,
          updatedAt: row.updated_at,
        };
      })
      .filter((row) => row.brand || row.model);

    return json({
      success: true,
      sheetName: SHEET_NAME,
      rows,
      count: rows.length,
      canEdit: await hasPermission(user.id, 'prices.edit'),
    });
  } catch (error) {
    console.error('ADMIN PRICES GET ERROR:', error);

    return json(
      { success: false, error: 'Fiyat listesi alınamadı.' },
      500
    );
  }
}

// ======================================================
// PATCH /api/admin/prices
// body:
// {
//   rowNumber: number,
//   basePrice: number,
//   minPrice: number
// }
// ======================================================
export async function PATCH(request: NextRequest) {
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

    if (!(await hasPermission(user.id, 'prices.edit'))) {
      return json(
        { success: false, error: 'Fiyat değiştirme yetkisi gerekli.' },
        403
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const rowNumber = Number(body.rowNumber);
    const basePrice = parsePrice(body.basePrice);
    const minPrice = parsePrice(body.minPrice);

    if (!Number.isInteger(rowNumber) || rowNumber < 2) {
      return json({ success: false, error: 'Geçersiz satır.' }, 400);
    }

    if (
      basePrice === null ||
      minPrice === null ||
      basePrice < 0 ||
      minPrice < 0
    ) {
      return json(
        { success: false, error: 'Geçerli fiyat girin.' },
        400
      );
    }

    if (basePrice > 100_000_000 || minPrice > 100_000_000) {
      return json(
        { success: false, error: 'Fiyat değeri çok yüksek.' },
        400
      );
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    const currentResult = await client.query(
      `
        SELECT row_number, data, updated_at
        FROM public.sheet_rows
        WHERE sheet_name = $1
          AND row_number = $2
        FOR UPDATE
      `,
      [SHEET_NAME, rowNumber]
    );

    if (currentResult.rowCount !== 1) {
      await client.query('ROLLBACK');
      return json({ success: false, error: 'Cihaz bulunamadı.' }, 404);
    }

    const currentData = Array.isArray(currentResult.rows[0].data)
      ? [...currentResult.rows[0].data]
      : [];

    while (currentData.length < 6) currentData.push('');

    const oldBasePrice = parsePrice(currentData[3]) ?? 0;
    const oldMinPrice = parsePrice(currentData[5]) ?? 0;

    if (oldBasePrice === basePrice && oldMinPrice === minPrice) {
      await client.query('ROLLBACK');

      return json({
        success: true,
        message: 'Fiyat değişmedi.',
        rowNumber,
        basePrice,
        minPrice,
      });
    }

    const brand = String(currentData[0] ?? '');
    const model = String(currentData[1] ?? '');
    const capacity = String(currentData[2] ?? '');
    const image = String(currentData[4] ?? '');

    // Önce Sheets'i güncelle.
    // Mevcut Apps Script UPDATE_DEVICE işlemi A:F satırını güncelleyip
    // mevcut dual-sync fonksiyonu ile geçiş sistemini de besliyor.
    const scriptUrl =
      process.env.APPS_SCRIPT_URL ||
      process.env.NEXT_PUBLIC_SCRIPT_URL;

    if (!scriptUrl) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: 'Apps Script URL yapılandırılmamış.',
        },
        500
      );
    }

    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'User-Agent': 'CNETMOBIL-Admin-Prices/1.0',
      },
      body: JSON.stringify({
        type: 'UPDATE_DEVICE',
        row: rowNumber,
        brand,
        name: model,
        cap: capacity,
        base: basePrice,
        img: image,
        minPrice,
      }),
      cache: 'no-store',
      redirect: 'follow',
    });

    const upstreamText = await upstream.text();

    let upstreamData: Record<string, unknown> = {};

    try {
      upstreamData = JSON.parse(upstreamText);
    } catch {
      console.error(
        'Apps Script fiyat cevabı JSON değil:',
        upstreamText.slice(0, 300)
      );

      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: 'Google Sheets güncelleme cevabı geçersiz.',
        },
        502
      );
    }

    if (!upstream.ok || upstreamData.result !== 'success') {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error:
            typeof upstreamData.message === 'string'
              ? upstreamData.message
              : 'Google Sheets fiyatı güncellenemedi.',
        },
        502
      );
    }

    // Panelin anında görmesi için PostgreSQL'i de aynı request içinde güncelle.
    currentData[3] = basePrice;
    currentData[5] = minPrice;

    await client.query(
      `
        UPDATE public.sheet_rows
        SET data = $1::jsonb,
            updated_at = NOW()
        WHERE sheet_name = $2
          AND row_number = $3
      `,
      [JSON.stringify(currentData), SHEET_NAME, rowNumber]
    );

    await writeAuditLog({
      client,
      userId: user.id,
      rowNumber,
      oldData: {
        brand,
        model,
        capacity,
        basePrice: oldBasePrice,
        minPrice: oldMinPrice,
      },
      newData: {
        brand,
        model,
        capacity,
        basePrice,
        minPrice,
      },
      ip: getRequestIp(request),
    });

    await client.query('COMMIT');

    return json({
      success: true,
      message: 'Fiyat güncellendi.',
      row: {
        rowNumber,
        brand,
        model,
        capacity,
        basePrice,
        minPrice,
      },
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }

    console.error('ADMIN PRICES PATCH ERROR:', error);

    return json(
      { success: false, error: 'Fiyat güncellenemedi.' },
      500
    );
  } finally {
    client?.release();
  }
}
