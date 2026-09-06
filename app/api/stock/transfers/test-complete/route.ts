// app/api/stock/transfers/test-complete/route.ts
// CNETMOBIL V2 - GECICI SUPER ADMIN TEST TRANSFER TAMAMLAMA
// WingSM entegrasyonu gelince bu endpoint tamamen kaldirilacak.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, type PoolClient } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetStockTransferTestPool: Pool | undefined;
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
  stockBranchCode: string | null;
  isSuperAdmin: boolean;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL bulunamadı.');

  if (!global.cnetStockTransferTestPool) {
    global.cnetStockTransferTestPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetStockTransferTestPool;
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
      !['admin', 'personel'].includes(payload.role)
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
    stockBranchCode: row.stock_branch_code
      ? String(row.stock_branch_code)
      : null,
    isSuperAdmin: row.is_super_admin === true,
  };
}

function parsePositiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
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

    if (!user.isSuperAdmin) {
      return json(
        {
          success: false,
          error: 'Bu geçici test işlemi yalnızca Super Admin tarafından kullanılabilir.',
        },
        403
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const requestId = parsePositiveId(
      (body as Record<string, unknown>).requestId
    );

    if (!requestId) {
      return json({ success: false, error: 'Geçersiz talep.' }, 400);
    }

    client = await getPool().connect();
    await client.query('BEGIN');

    const result = await client.query(
      `
        SELECT
          dr.id AS request_id,
          dr.device_id,
          dr.status AS request_status,
          dr.requester_branch_code,
          dr.owner_branch_code,
          sd.imei,
          sd.current_branch_code,
          sd.status AS device_status,
          dt.id AS transfer_id,
          dt.status AS transfer_status,
          dt.from_branch_code,
          dt.to_branch_code
        FROM public.device_requests dr
        JOIN public.stock_devices sd
          ON sd.id = dr.device_id
        LEFT JOIN public.device_transfers dt
          ON dt.request_id = dr.id
         AND dt.device_id = dr.device_id
         AND dt.status = 'WAITING_WING'
        WHERE dr.id = $1
        LIMIT 1
        FOR UPDATE OF dr, sd
      `,
      [requestId]
    );

    const row = result.rows[0];

    if (!row) {
      await client.query('ROLLBACK');
      return json({ success: false, error: 'Talep bulunamadı.' }, 404);
    }

    if (
      String(row.request_status) !== 'TRANSFER_WAITING' ||
      String(row.device_status) !== 'TRANSFER_WAITING'
    ) {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: 'Bu cihaz transfer bekleyen durumda değil.',
        },
        409
      );
    }

    if (!row.transfer_id || String(row.transfer_status) !== 'WAITING_WING') {
      await client.query('ROLLBACK');
      return json(
        {
          success: false,
          error: 'Bekleyen transfer kaydı bulunamadı.',
        },
        409
      );
    }

    const fromBranch = String(row.owner_branch_code || row.from_branch_code || '');
    const toBranch = String(row.requester_branch_code || row.to_branch_code || '');

    if (!fromBranch || !toBranch || fromBranch === toBranch) {
      await client.query('ROLLBACK');
      return json(
        { success: false, error: 'Transfer mağaza bilgileri geçersiz.' },
        409
      );
    }

    // 1) Cihazi hedef magazaya tasi ve tekrar talebe acik hale getir.
    await client.query(
      `
        UPDATE public.stock_devices
        SET
          current_branch_code = $2,
          status = 'AVAILABLE'
        WHERE id = $1
      `,
      [row.device_id, toBranch]
    );

    // 2) Talebi tamamla.
    await client.query(
      `
        UPDATE public.device_requests
        SET
          status = 'COMPLETED',
          completed_at = now()
        WHERE id = $1
      `,
      [requestId]
    );

    // 3) Transfer kaydini tamamla.
    await client.query(
      `
        UPDATE public.device_transfers
        SET
          status = 'COMPLETED',
          completed_at = now(),
          wing_reference = 'MANUAL_TEST'
        WHERE id = $1
          AND status = 'WAITING_WING'
      `,
      [row.transfer_id]
    );

    // 4) Hareket gecmisine test transfer kaydi.
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
          'TRANSFER_COMPLETED_MANUAL_TEST',
          $3,
          $4,
          'TRANSFER_WAITING',
          'AVAILABLE',
          $5,
          $6::jsonb
        )
      `,
      [
        row.device_id,
        String(row.imei || ''),
        fromBranch,
        toBranch,
        user.username,
        JSON.stringify({
          requestId,
          transferId: row.transfer_id,
          manualTest: true,
          wingSMConnected: false,
        }),
      ]
    );

    await client.query('COMMIT');

    return json({
      success: true,
      message: 'Test transferi tamamlandı.',
      deviceId: Number(row.device_id),
      imei: String(row.imei || ''),
      fromBranch,
      toBranch,
      status: 'AVAILABLE',
      requestStatus: 'COMPLETED',
      transferStatus: 'COMPLETED',
    });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch {}
    }

    console.error('MANUAL TEST TRANSFER COMPLETE ERROR:', error);

    return json(
      {
        success: false,
        error: 'Test transferi tamamlanamadı.',
      },
      500
    );
  } finally {
    client?.release();
  }
}
