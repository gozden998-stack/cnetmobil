// app/api/stock/devices/route.ts
// CNETMOBIL V2 - IMEI bazli magaza stok API
// WingSM YOK: simdilik manuel tekli cihaz girisi + magaza stok listeleme.
// Her magaza sadece kendi stokuna cihaz ekleyebilir.
// Super Admin tum magazalara ekleyebilir.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, type PoolClient } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetStockDevicesPool: Pool | undefined;
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

  if (!global.cnetStockDevicesPool) {
    global.cnetStockDevicesPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetStockDevicesPool;
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

  // GET is same-site read; Origin her tarayicida gelmeyebilir.
  if (request.method === 'GET') return true;

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

  const pool = getPool();

  const result = await pool.query(
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

function normalizeBranch(value: unknown) {
  return String(value ?? '').trim().toLocaleUpperCase('tr-TR');
}

function normalizeImei(value: unknown) {
  return String(value ?? '').replace(/\s+/g, '').trim();
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
      SELECT code, name
      FROM public.branches
      WHERE code = $1
        AND is_active = TRUE
      LIMIT 1
    `,
    [branchCode]
  );

  return result.rows[0] ?? null;
}

// ============================================================
// GET /api/stock/devices?branch=CMR
// Her aktif kullanici tum magazalarin stoklarini gorebilir.
// Ancak canManage sadece kendi magazasinda true olur.
// Super Admin tum magazalari yonetebilir.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return json({ success: false, error: 'Oturum gerekli.' }, 401);
    }

    const requestedBranch = normalizeBranch(
      request.nextUrl.searchParams.get('branch') ||
        user.stockBranchCode ||
        'CMR'
    );

    const branch = await branchExists(requestedBranch);

    if (!branch) {
      return json({ success: false, error: 'Mağaza bulunamadı.' }, 404);
    }

    const canManage =
      user.isSuperAdmin || user.stockBranchCode === requestedBranch;

    const pool = getPool();

    const [devicesResult, capacityResult] = await Promise.all([
      pool.query(
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
            source,
            wing_product_code,
            wing_branch_code,
            wing_status,
            wing_last_seen_at,
            details_completed_at,
            details_completed_by,
            created_by,
            created_at,
            updated_at
          FROM public.stock_devices
          WHERE current_branch_code = $1
            AND status NOT IN ('SOLD', 'PASSIVE')
          ORDER BY
            CASE status
              WHEN 'REQUESTED' THEN 1
              WHEN 'TRANSFER_WAITING' THEN 2
              WHEN 'DETAILS_PENDING' THEN 3
              WHEN 'AVAILABLE' THEN 4
              ELSE 5
            END,
            updated_at DESC,
            id DESC
        `,
        [requestedBranch]
      ),
      pool.query(
        `
          SELECT
            branch_code,
            branch_name,
            max_stock,
            current_stock,
            incoming_waiting,
            used_capacity,
            remaining_capacity,
            can_request
          FROM public.v_branch_stock_capacity
          WHERE branch_code = $1
          LIMIT 1
        `,
        [requestedBranch]
      ),
    ]);

    return json({
      success: true,
      branch: {
        code: String(branch.code),
        name: String(branch.name),
      },
      canManage,
      currentUser: {
        id: user.id,
        username: user.username,
        stockBranchCode: user.stockBranchCode,
        isSuperAdmin: user.isSuperAdmin,
      },
      capacity: capacityResult.rows[0] ?? null,
      devices: devicesResult.rows,
      count: devicesResult.rows.length,
    });
  } catch (error) {
    console.error('STOCK DEVICES GET ERROR:', error);

    return json(
      {
        success: false,
        error: 'Stok listesi alınamadı.',
      },
      500
    );
  }
}

// ============================================================
// POST /api/stock/devices
// Tekli cihaz ekleme.
//
// Normal kullanici:
//   sadece kendi stock_branch_code magazasina ekleyebilir.
//
// Super Admin:
//   body.branchCode ile istedigi magazaya ekleyebilir.
// ============================================================
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

    const contentLength = Number(
      request.headers.get('content-length') || 0
    );

    if (contentLength > 50_000) {
      return json({ success: false, error: 'İstek çok büyük.' }, 413);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const data = body as Record<string, unknown>;

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

    const branch = await branchExists(targetBranch);

    if (!branch) {
      return json({ success: false, error: 'Mağaza bulunamadı.' }, 404);
    }

    // Normal kullanici body'den baska magazayi zorlayamaz.
    if (
      !user.isSuperAdmin &&
      requestedBranch &&
      requestedBranch !== user.stockBranchCode
    ) {
      return json(
        {
          success: false,
          error: 'Başka mağazanın stoğuna cihaz ekleyemezsiniz.',
        },
        403
      );
    }

    const imei = normalizeImei(data.imei);

    if (!/^[0-9]{14,16}$/.test(imei)) {
      return json(
        {
          success: false,
          error: 'IMEI 14-16 haneli yalnızca rakamlardan oluşmalıdır.',
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
    let changedParts: string;
    let boxInvoice: string;
    let batteryPercent: number | null;

    try {
      brand = cleanText(data.brand, 100, true);
      model = cleanText(data.model, 180, true);
      memory = cleanText(data.memory, 50, true);

      color = cleanText(data.color, 100);
      grade = cleanText(data.grade, 50);
      warranty = cleanText(data.warranty, 100);
      changedParts = cleanText(data.changedParts, 300);
      boxInvoice = cleanText(data.boxInvoice, 100);

      batteryPercent = parseBattery(data.batteryPercent);
    } catch (error) {
      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Cihaz bilgileri geçersiz.',
        },
        400
      );
    }

    const detailsComplete =
      Boolean(color) &&
      batteryPercent !== null &&
      Boolean(grade) &&
      Boolean(warranty) &&
      Boolean(changedParts) &&
      Boolean(boxInvoice);

    const status = detailsComplete ? 'AVAILABLE' : 'DETAILS_PENDING';

    client = await getPool().connect();

    await client.query('BEGIN');

    const duplicate = await client.query(
      `
        SELECT id, imei, current_branch_code, status
        FROM public.stock_devices
        WHERE imei = $1
        LIMIT 1
        FOR UPDATE
      `,
      [imei]
    );

    if (duplicate.rowCount) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error: `Bu IMEI zaten sistemde kayıtlı. Mevcut mağaza: ${duplicate.rows[0].current_branch_code}`,
        },
        409
      );
    }

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
        RETURNING *
      `,
      [
        imei,
        brand,
        model,
        memory,
        color || null,
        batteryPercent,
        grade || null,
        warranty || null,
        changedParts || null,
        boxInvoice || null,
        targetBranch,
        status,
        detailsComplete,
        user.username,
      ]
    );

    const device = insertResult.rows[0];

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
          'DEVICE_ADDED',
          $3,
          NULL,
          $4,
          $5,
          $6::jsonb
        )
      `,
      [
        device.id,
        imei,
        targetBranch,
        status,
        user.username,
        JSON.stringify({
          source: 'MANUAL',
          brand,
          model,
          memory,
          detailsComplete,
        }),
      ]
    );

    await client.query('COMMIT');

    return json(
      {
        success: true,
        message: 'Cihaz stoğa eklendi.',
        device,
      },
      201
    );
  } catch (error: any) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
    }

    if (error?.code === '23505') {
      return json(
        {
          success: false,
          error: 'Bu IMEI zaten sistemde kayıtlı.',
        },
        409
      );
    }

    console.error('STOCK DEVICES POST ERROR:', error);

    return json(
      {
        success: false,
        error: 'Cihaz eklenemedi.',
      },
      500
    );
  } finally {
    client?.release();
  }
}
