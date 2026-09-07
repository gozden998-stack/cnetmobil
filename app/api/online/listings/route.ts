// app/api/online/listings/route.ts
// CNETMOBIL ONLINE - Manuel N11 urun taslagi
// N11 API BAGLI DEGIL.
// stock_devices / WingSM bagimliligi YOK.
// SADECE SUPER ADMIN.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
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

  return { user, response: null };
}

function cleanText(value: unknown, field: string, maxLength: number) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`${field} zorunludur.`);
  }

  if (text.length > maxLength) {
    throw new Error(`${field} çok uzun.`);
  }

  return text;
}

function parseMoney(value: unknown, field: string) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`${field} zorunludur.`);
  }

  let normalized = text.replace(/\s/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${field} geçersiz.`);
  }

  return Number(amount.toFixed(2));
}

// ============================================================
// GET /api/online/listings
// Mevcut N11 taslaklarini/listinglerini PostgreSQL'den okur.
// N11 API'ye istek ATMAZ.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.response) return auth.response;

    const result = await getPool().query(
      `
        SELECT
          id,
          stock_device_id,
          channel,
          external_product_id,
          external_stock_code,
          title,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          sale_price,
          list_price,
          quantity,
          sync_status,
          product_status,
          sale_status,
          last_task_id,
          last_task_status,
          last_error,
          created_at,
          updated_at
        FROM public.online_listings
        WHERE channel = 'N11'
        ORDER BY updated_at DESC, id DESC
        LIMIT 1000
      `
    );

    return json({
      success: true,
      listings: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('ONLINE LISTINGS GET ERROR:', error);

    return json(
      {
        success: false,
        error: 'ONLINE ürünleri alınamadı.',
      },
      500
    );
  }
}

// ============================================================
// POST /api/online/listings
//
// Manuel N11 ürün taslağı.
// N11 API'ye istek ATMAZ.
//
// body:
// {
//   imei,
//   brand,
//   model,
//   memory,
//   color,
//   grade,
//   warranty,
//   salePrice,
//   listPrice
// }
//
// Otomatik:
// stock_device_id = NULL
// external_stock_code = IMEI
// channel = N11
// quantity = 1
// sync_status = DRAFT
// ============================================================
export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return json({ success: false, error: 'Geçersiz istek kaynağı.' }, 403);
    }

    const auth = await requireSuperAdmin(request);

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const contentLength = Number(request.headers.get('content-length') || 0);

    if (contentLength > 50_000) {
      return json({ success: false, error: 'İstek çok büyük.' }, 413);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const data = body as Record<string, unknown>;

    const imei = String(data.imei ?? '')
      .replace(/\s+/g, '')
      .trim();

    if (!/^[0-9]{15}$/.test(imei)) {
      return json(
        {
          success: false,
          error: 'IMEI tam 15 haneli ve yalnızca rakamlardan oluşmalıdır.',
        },
        400
      );
    }

    let brand: string;
    let model: string;
    let memory: string;
    let color: string;
    let grade: string;
    let warranty: string;
    let salePrice: number;
    let listPrice: number;

    try {
      brand = cleanText(data.brand, 'Marka', 100);
      model = cleanText(data.model, 'Model', 180);
      memory = cleanText(data.memory, 'Hafıza', 50);
      color = cleanText(data.color, 'Renk', 100);
      grade = cleanText(data.grade, 'Grade', 50);
      warranty = cleanText(data.warranty, 'Garanti', 100);
      salePrice = parseMoney(data.salePrice, 'N11 satış fiyatı');
      listPrice = parseMoney(data.listPrice, 'N11 liste fiyatı');
    } catch (error) {
      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ürün bilgileri geçersiz.',
        },
        400
      );
    }

    if (listPrice < salePrice) {
      return json(
        {
          success: false,
          error: 'N11 liste fiyatı satış fiyatından düşük olamaz.',
        },
        400
      );
    }

    const pool = getPool();

    const duplicate = await pool.query(
      `
        SELECT id, external_stock_code, sync_status
        FROM public.online_listings
        WHERE channel = 'N11'
          AND external_stock_code = $1
        LIMIT 1
      `,
      [imei]
    );

    if (duplicate.rowCount) {
      return json(
        {
          success: false,
          error: 'Bu IMEI için zaten N11 ONLINE kaydı bulunuyor.',
          existingListing: duplicate.rows[0],
        },
        409
      );
    }

    const title = [brand, model, memory, color, grade]
      .filter(Boolean)
      .join(' ');

    const insertResult = await pool.query(
      `
        INSERT INTO public.online_listings (
          stock_device_id,
          channel,
          external_product_id,
          external_stock_code,
          title,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
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
          NULL,
          'N11',
          NULL,
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          1,
          NULL,
          NULL,
          'DRAFT',
          'TL',
          $11::jsonb,
          now(),
          now()
        )
        RETURNING *
      `,
      [
        imei,
        title,
        brand,
        model,
        memory,
        color,
        grade,
        warranty,
        salePrice,
        listPrice,
        JSON.stringify({
          draftSource: 'PANEL_MANUAL',
          createdBy: auth.user.username,
          imei,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          salePrice,
          listPrice,
        }),
      ]
    );

    return json(
      {
        success: true,
        message: 'N11 ürün taslağı kaydedildi. Henüz N11 API’ye gönderilmedi.',
        listing: insertResult.rows[0],
      },
      201
    );
  } catch (error: any) {
    if (error?.code === '23505') {
      return json(
        {
          success: false,
          error: 'Bu IMEI için N11 ONLINE kaydı zaten mevcut.',
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
  }
}
