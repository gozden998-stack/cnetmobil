// app/api/stock/requests/route.ts
// CNETMOBIL V2 - Magazalar arasi IMEI bazli cihaz talep / red / gönderildi motoru.
// WingSM henüz bağlı değildir.
// Gönderildi -> TRANSFER_WAITING.
// Cihaz gerçek sahibinden ancak WingSM transferi doğrulanınca düşürülecek.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, type PoolClient } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetStockRequestsPool: Pool | undefined;
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

  if (!global.cnetStockRequestsPool) {
    global.cnetStockRequestsPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetStockRequestsPool;
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

function parsePositiveId(value: unknown) {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) return null;

  return id;
}

function cleanReason(value: unknown) {
  const text = String(value ?? '').trim();

  if (text.length > 500) {
    throw new Error('Red açıklaması çok uzun.');
  }

  return text;
}

async function branchExists(
  client: PoolClient,
  branchCode: string
) {
  const result = await client.query(
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

// Bir mağaza için stok limiti hesabını transaction içinde tekrar hesaplar.
// PENDING/SENT/TRANSFER_WAITING talepler kapasiteyi rezerve eder.
async function getCapacity(
  client: PoolClient,
  branchCode: string
) {
  const result = await client.query(
    `
      SELECT
        b.code AS branch_code,
        sl.max_stock,

        (
          SELECT COUNT(*)::integer
          FROM public.stock_devices sd
          WHERE sd.current_branch_code = b.code
            AND sd.status IN (
              'DETAILS_PENDING',
              'AVAILABLE',
              'REQUESTED',
              'TRANSFER_WAITING'
            )
        ) AS current_stock,

        (
          SELECT COUNT(*)::integer
          FROM public.device_requests dr
          WHERE dr.requester_branch_code = b.code
            AND dr.status IN (
              'PENDING',
              'SENT',
              'TRANSFER_WAITING'
            )
        ) AS active_incoming

      FROM public.branches b
      LEFT JOIN public.stock_limits sl
        ON sl.branch_code = b.code
      WHERE b.code = $1
        AND b.is_active = TRUE
      LIMIT 1
    `,
    [branchCode]
  );

  const row = result.rows[0];

  if (!row) return null;

  const maxStock =
    row.max_stock === null ? null : Number(row.max_stock);

  const currentStock = Number(row.current_stock || 0);
  const activeIncoming = Number(row.active_incoming || 0);
  const usedCapacity = currentStock + activeIncoming;

  return {
    maxStock,
    currentStock,
    activeIncoming,
    usedCapacity,
    remainingCapacity:
      maxStock === null
        ? null
        : Math.max(maxStock - usedCapacity, 0),
    canRequest:
      maxStock === null || usedCapacity < maxStock,
  };
}

// ============================================================
// GET /api/stock/requests
//
// Normal kullanıcı:
//   incoming = kendi stoğuna gelen talepler
//   outgoing = kendi mağazasının yaptığı talepler
//
// Super Admin:
//   tüm aktif/geçmiş talepler
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return json({ success: false, error: 'Oturum gerekli.' }, 401);
    }

    const pool = getPool();

    let whereSql = '';
    const params: unknown[] = [];

    if (!user.isSuperAdmin) {
      if (!user.stockBranchCode) {
        return json(
          {
            success: false,
            error: 'Kullanıcının stok mağazası tanımlı değil.',
          },
          403
        );
      }

      params.push(user.stockBranchCode);
      whereSql = `
        WHERE
          dr.requester_branch_code = $1
          OR dr.owner_branch_code = $1
      `;
    }

    const result = await pool.query(
      `
        SELECT
          dr.id AS request_id,
          dr.status AS request_status,
          dr.requester_branch_code,
          dr.owner_branch_code,
          dr.requested_by,
          dr.requested_at,
          dr.decision_by,
          dr.decision_at,
          dr.reject_reason,
          dr.sent_by,
          dr.sent_at,
          dr.completed_at,

          sd.id AS device_id,
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

        FROM public.device_requests dr
        JOIN public.stock_devices sd
          ON sd.id = dr.device_id

        ${whereSql}

        ORDER BY dr.requested_at DESC, dr.id DESC
        LIMIT 1000
      `,
      params
    );

    return json({
      success: true,
      currentUser: {
        id: user.id,
        username: user.username,
        stockBranchCode: user.stockBranchCode,
        isSuperAdmin: user.isSuperAdmin,
      },
      requests: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('STOCK REQUESTS GET ERROR:', error);

    return json(
      { success: false, error: 'Talepler alınamadı.' },
      500
    );
  }
}

// ============================================================
// POST /api/stock/requests
// Bir cihazı başka mağazadan talep et.
// body: { deviceId: 123 }
//
// Super Admin test/yönetim için requesterBranchCode gönderebilir.
// Normal kullanıcıda requester her zaman kendi stock_branch_code değeridir.
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

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const data = body as Record<string, unknown>;
    const deviceId = parsePositiveId(data.deviceId);

    if (!deviceId) {
      return json({ success: false, error: 'Geçersiz cihaz.' }, 400);
    }

    const requestedRequesterBranch = normalizeBranch(
      data.requesterBranchCode
    );

    let requesterBranch: string;

    if (user.isSuperAdmin && requestedRequesterBranch) {
      requesterBranch = requestedRequesterBranch;
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

      requesterBranch = user.stockBranchCode;
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    // Aynı mağazadan eş zamanlı çok istek gelirse limit aşılmasın.
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1))`,
      [`stock-request:${requesterBranch}`]
    );

    if (!(await branchExists(client, requesterBranch))) {
      await client.query('ROLLBACK');
      return json({ success: false, error: 'Talep eden mağaza bulunamadı.' }, 404);
    }

    const deviceResult = await client.query(
      `
        SELECT *
        FROM public.stock_devices
        WHERE id = $1
        LIMIT 1
        FOR UPDATE
      `,
      [deviceId]
    );

    const device = deviceResult.rows[0];

    if (!device) {
      await client.query('ROLLBACK');
      return json({ success: false, error: 'Cihaz bulunamadı.' }, 404);
    }

    if (device.current_branch_code === requesterBranch) {
      await client.query('ROLLBACK');
      return json(
        { success: false, error: 'Kendi mağazanızdaki cihazı talep edemezsiniz.' },
        400
      );
    }

    if (device.status === 'DETAILS_PENDING') {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: 'Cihaz bilgileri tamamlanmadan talep edilemez.',
        },
        409
      );
    }

    if (device.status !== 'AVAILABLE') {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: 'Bu cihaz şu anda talebe açık değil.',
        },
        409
      );
    }

    const capacity = await getCapacity(client, requesterBranch);

    if (!capacity) {
      await client.query('ROLLBACK');
      return json(
        { success: false, error: 'Stok kapasitesi okunamadı.' },
        500
      );
    }

    if (!capacity.canRequest) {
      await client.query('ROLLBACK');

      return json(
        {
          success: false,
          error:
            capacity.maxStock === null
              ? 'Talep oluşturulamadı.'
              : `Mağaza stok kapasitesi dolu. Limit: ${capacity.maxStock}, kullanılan: ${capacity.usedCapacity}.`,
          capacity,
        },
        409
      );
    }

    const insertResult = await client.query(
      `
        INSERT INTO public.device_requests (
          device_id,
          requester_branch_code,
          owner_branch_code,
          status,
          requested_by
        )
        VALUES ($1, $2, $3, 'PENDING', $4)
        RETURNING *
      `,
      [
        device.id,
        requesterBranch,
        device.current_branch_code,
        user.username,
      ]
    );

    const requestRow = insertResult.rows[0];

    await client.query(
      `
        UPDATE public.stock_devices
        SET status = 'REQUESTED'
        WHERE id = $1
      `,
      [device.id]
    );

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
          $1, $2, 'REQUEST_CREATED',
          $3, $4,
          'AVAILABLE', 'REQUESTED',
          $5,
          $6::jsonb
        )
      `,
      [
        device.id,
        device.imei,
        device.current_branch_code,
        requesterBranch,
        user.username,
        JSON.stringify({
          requestId: requestRow.id,
          brand: device.brand,
          model: device.model,
          memory: device.memory,
        }),
      ]
    );

    await client.query('COMMIT');

    return json(
      {
        success: true,
        message: 'Cihaz talebi oluşturuldu.',
        request: requestRow,
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
          error: 'Bu cihaz için zaten aktif bir talep bulunuyor.',
        },
        409
      );
    }

    console.error('STOCK REQUEST CREATE ERROR:', error);

    return json(
      { success: false, error: 'Cihaz talebi oluşturulamadı.' },
      500
    );
  } finally {
    client?.release();
  }
}

// ============================================================
// PATCH /api/stock/requests
//
// RED:
// { requestId, action: "REJECT", reason: "..." }
//
// GÖNDERİLDİ:
// { requestId, action: "SEND" }
//
// Normal kullanıcı yalnızca kendi stoğuna gelen talepte RED/GÖNDERİLDİ yapabilir.
// Super Admin tüm talepleri yönetebilir.
// ============================================================
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

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const data = body as Record<string, unknown>;
    const requestId = parsePositiveId(data.requestId);
    const action = String(data.action ?? '')
      .trim()
      .toLocaleUpperCase('tr-TR');

    if (!requestId || !['REJECT', 'SEND'].includes(action)) {
      return json({ success: false, error: 'Geçersiz işlem.' }, 400);
    }

    let rejectReason = '';

    if (action === 'REJECT') {
      try {
        rejectReason = cleanReason(data.reason);
      } catch (error) {
        return json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Red açıklaması geçersiz.',
          },
          400
        );
      }

      if (!rejectReason) {
        return json(
          { success: false, error: 'Red nedeni zorunludur.' },
          400
        );
      }
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    const requestResult = await client.query(
      `
        SELECT
          dr.*,
          sd.imei,
          sd.brand,
          sd.model,
          sd.memory,
          sd.current_branch_code,
          sd.status AS device_status
        FROM public.device_requests dr
        JOIN public.stock_devices sd
          ON sd.id = dr.device_id
        WHERE dr.id = $1
        LIMIT 1
        FOR UPDATE OF dr, sd
      `,
      [requestId]
    );

    const requestRow = requestResult.rows[0];

    if (!requestRow) {
      await client.query('ROLLBACK');
      return json({ success: false, error: 'Talep bulunamadı.' }, 404);
    }

    if (
      !user.isSuperAdmin &&
      user.stockBranchCode !== requestRow.owner_branch_code
    ) {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: 'Başka mağazanın talebini yönetemezsiniz.',
        },
        403
      );
    }

    if (requestRow.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: 'Bu talep artık bekleyen durumda değil.',
        },
        409
      );
    }

    if (action === 'REJECT') {
      await client.query(
        `
          UPDATE public.device_requests
          SET
            status = 'REJECTED',
            decision_by = $2,
            decision_at = now(),
            reject_reason = $3
          WHERE id = $1
        `,
        [requestId, user.username, rejectReason]
      );

      await client.query(
        `
          UPDATE public.stock_devices
          SET status = 'AVAILABLE'
          WHERE id = $1
        `,
        [requestRow.device_id]
      );

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
            $1, $2, 'REQUEST_REJECTED',
            $3, $4,
            'REQUESTED', 'AVAILABLE',
            $5,
            $6::jsonb
          )
        `,
        [
          requestRow.device_id,
          requestRow.imei,
          requestRow.owner_branch_code,
          requestRow.requester_branch_code,
          user.username,
          JSON.stringify({
            requestId,
            reason: rejectReason,
          }),
        ]
      );

      await client.query('COMMIT');

      return json({
        success: true,
        message: 'Talep reddedildi.',
      });
    }

    // SEND / GÖNDERİLDİ
    // Sahip mağaza değişmez. WingSM TR doğrulanana kadar cihaz eski mağazada tutulur.
    const existingTransfer = await client.query(
      `
        SELECT id
        FROM public.device_transfers
        WHERE device_id = $1
          AND status = 'WAITING_WING'
        LIMIT 1
      `,
      [requestRow.device_id]
    );

    if (existingTransfer.rowCount) {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: 'Bu cihaz için zaten bekleyen transfer bulunuyor.',
        },
        409
      );
    }

    await client.query(
      `
        UPDATE public.device_requests
        SET
          status = 'TRANSFER_WAITING',
          decision_by = $2,
          decision_at = now(),
          sent_by = $2,
          sent_at = now()
        WHERE id = $1
      `,
      [requestId, user.username]
    );

    await client.query(
      `
        UPDATE public.stock_devices
        SET status = 'TRANSFER_WAITING'
        WHERE id = $1
      `,
      [requestRow.device_id]
    );

    const transferResult = await client.query(
      `
        INSERT INTO public.device_transfers (
          device_id,
          request_id,
          imei,
          from_branch_code,
          to_branch_code,
          status,
          panel_sent_by,
          panel_sent_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          'WAITING_WING',
          $6,
          now()
        )
        RETURNING *
      `,
      [
        requestRow.device_id,
        requestId,
        requestRow.imei,
        requestRow.owner_branch_code,
        requestRow.requester_branch_code,
        user.username,
      ]
    );

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
          $1, $2, 'DEVICE_SENT',
          $3, $4,
          'REQUESTED', 'TRANSFER_WAITING',
          $5,
          $6::jsonb
        )
      `,
      [
        requestRow.device_id,
        requestRow.imei,
        requestRow.owner_branch_code,
        requestRow.requester_branch_code,
        user.username,
        JSON.stringify({
          requestId,
          transferId: transferResult.rows[0].id,
          waitingForWingSM: true,
        }),
      ]
    );

    await client.query('COMMIT');

    return json({
      success: true,
      message: 'Cihaz gönderildi. WingSM transferi bekleniyor.',
      transfer: transferResult.rows[0],
    });
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
          error: 'Bu cihaz için aktif talep veya transfer zaten mevcut.',
        },
        409
      );
    }

    console.error('STOCK REQUEST PATCH ERROR:', error);

    return json(
      { success: false, error: 'Talep işlemi tamamlanamadı.' },
      500
    );
  } finally {
    client?.release();
  }
}
