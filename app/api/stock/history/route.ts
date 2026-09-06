// app/api/stock/history/route.ts
// CNETMOBIL V2 - IMEI bazli stok hareket gecmisi
// WingSM entegrasyonundan once mevcut stock_events kayitlarini okur.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetStockHistoryPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const BRANCHES = new Set(['CNET', 'CMR', 'CADDE', 'KAPAKLI', 'SARAY']);
const MAX_ROWS = 500;

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

  if (!global.cnetStockHistoryPool) {
    global.cnetStockHistoryPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetStockHistoryPool;
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

async function getAuthenticatedUser(request: NextRequest): Promise<ActiveUser | null> {
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
    stockBranchCode: row.stock_branch_code ? String(row.stock_branch_code) : null,
    isSuperAdmin: row.is_super_admin === true,
  };
}

function normalizeBranch(value: unknown) {
  const branch = String(value ?? '').trim().toLocaleUpperCase('tr-TR');
  return BRANCHES.has(branch) ? branch : '';
}

function normalizeDate(value: unknown) {
  const text = String(value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeImei(value: unknown) {
  return String(value ?? '').replace(/\D/g, '').slice(0, 16);
}

function normalizeEventType(value: unknown) {
  return String(value ?? '').trim().toUpperCase().slice(0, 80);
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return json({ success: false, error: 'Oturum gerekli.' }, 401);

    const branch = normalizeBranch(
      request.nextUrl.searchParams.get('branch') || user.stockBranchCode || 'CMR'
    );

    if (!branch) {
      return json({ success: false, error: 'Geçersiz mağaza.' }, 400);
    }

    const todayInIstanbul = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Istanbul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const dateFrom = normalizeDate(request.nextUrl.searchParams.get('dateFrom')) || todayInIstanbul;
    const dateTo = normalizeDate(request.nextUrl.searchParams.get('dateTo')) || dateFrom;
    const imei = normalizeImei(request.nextUrl.searchParams.get('imei'));
    const eventType = normalizeEventType(request.nextUrl.searchParams.get('eventType'));

    if (dateFrom > dateTo) {
      return json({ success: false, error: 'Başlangıç tarihi bitiş tarihinden büyük olamaz.' }, 400);
    }

    const params: unknown[] = [branch, dateFrom, dateTo];
    const conditions = [
      `(se.from_branch_code = $1 OR se.to_branch_code = $1)`,
      `(se.created_at AT TIME ZONE 'Europe/Istanbul')::date BETWEEN $2::date AND $3::date`,
    ];

    if (imei) {
      params.push(`%${imei}%`);
      conditions.push(`COALESCE(se.imei, '') LIKE $${params.length}`);
    }

    if (eventType && eventType !== 'ALL') {
      params.push(eventType);
      conditions.push(`se.event_type = $${params.length}`);
    }

    params.push(MAX_ROWS);

    const result = await getPool().query(
      `
        SELECT
          se.id,
          se.device_id,
          se.imei,
          se.event_type,
          se.from_branch_code,
          se.to_branch_code,
          se.old_status,
          se.new_status,
          se.performed_by,
          se.metadata,
          se.created_at,
          COALESCE(sd.brand, se.metadata->>'brand', '') AS brand,
          COALESCE(sd.model, se.metadata->>'model', '') AS model,
          COALESCE(sd.memory, se.metadata->>'memory', '') AS memory,
          sd.current_branch_code,
          sd.status AS device_status
        FROM public.stock_events se
        LEFT JOIN public.stock_devices sd ON sd.id = se.device_id
        WHERE ${conditions.join('\n          AND ')}
        ORDER BY se.created_at DESC, se.id DESC
        LIMIT $${params.length}
      `,
      params
    );

    return json({
      success: true,
      branchCode: branch,
      dateFrom,
      dateTo,
      count: result.rows.length,
      events: result.rows,
      currentUser: {
        id: user.id,
        username: user.username,
        stockBranchCode: user.stockBranchCode,
        isSuperAdmin: user.isSuperAdmin,
      },
    });
  } catch (error) {
    console.error('STOCK HISTORY GET ERROR:', error);
    return json({ success: false, error: 'Stok hareket geçmişi alınamadı.' }, 500);
  }
}
