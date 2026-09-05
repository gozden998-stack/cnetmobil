// app/api/panel-action/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetPanelActionPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

const ALL_ACTIONS = new Set([
  'SAVE_ALIM',
  'ADD_CIHAZ_TALEP_DEVICE',
  'SAVE_TALEP',
  'GONDER_TALEP',
  'RED_TALEP',
  'DELETE_CIHAZ_ROW_FULL_V5',
  'SAVE_THH',
  'UPDATE_THH',
  'DELETE_THH',
  'DELETE_ALIM',
  'DELETE_ALL_ALIM',
  'UPDATE_CONFIG',
  'ADD_DEVICE',
  'USE_IMEI',
]);

const ADMIN_ONLY_ACTIONS = new Set([
  'ADD_CIHAZ_TALEP_DEVICE',
  'GONDER_TALEP',
  'RED_TALEP',
  'DELETE_CIHAZ_ROW_FULL_V5',
  'SAVE_THH',
  'UPDATE_THH',
  'DELETE_THH',
  'DELETE_ALIM',
  'DELETE_ALL_ALIM',
  'UPDATE_CONFIG',
  'ADD_DEVICE',
]);

const BRANCH_BOUND_ACTIONS = new Set([
  'SAVE_ALIM',
  'SAVE_TALEP',
]);

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetPanelActionPool) {
    global.cnetPanelActionPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetPanelActionPool;
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

    if (!encoded || !signature) {
      return null;
    }

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

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      'Pragma': 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function authenticate(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const session = verifySession(token);

  if (!session) {
    return null;
  }

  if (session.userId) {
    const pool = getPool();

    const result = await pool.query(
      `
        SELECT id, branch, role, active
        FROM public.users
        WHERE id = $1
        LIMIT 1
      `,
      [session.userId]
    );

    const user = result.rows[0];

    if (!user || !user.active) {
      return null;
    }

    if (
      String(user.role) !== session.role ||
      String(user.branch) !== session.branch
    ) {
      return null;
    }
  }

  return session;
}

function validateOrigin(request: NextRequest) {
  const expectedAppUrl = process.env.APP_URL;

  if (!expectedAppUrl) {
    const host = request.headers.get('host');
    const proto =
      request.headers.get('x-forwarded-proto') ||
      request.nextUrl.protocol.replace(':', '');

    if (!host) return false;

    const expectedOrigin = `${proto}://${host}`;
    return request.headers.get('origin') === expectedOrigin;
  }

  try {
    const expectedOrigin = new URL(expectedAppUrl).origin;
    return request.headers.get('origin') === expectedOrigin;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return jsonResponse(
        { result: 'error', message: 'Geçersiz istek kaynağı.' },
        403
      );
    }

    const session = await authenticate(request);

    if (!session) {
      return jsonResponse(
        { result: 'error', message: 'Oturum gerekli.' },
        401
      );
    }

    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 100_000) {
      return jsonResponse(
        { result: 'error', message: 'İstek çok büyük.' },
        413
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return jsonResponse(
        { result: 'error', message: 'Geçersiz istek.' },
        400
      );
    }

    const payload = { ...(body as Record<string, unknown>) };
    const actionType =
      typeof payload.type === 'string' ? payload.type.trim() : '';

    if (!ALL_ACTIONS.has(actionType)) {
      return jsonResponse(
        { result: 'error', message: 'Bu işlem desteklenmiyor.' },
        400
      );
    }

    if (
      ADMIN_ONLY_ACTIONS.has(actionType) &&
      session.role !== 'admin'
    ) {
      return jsonResponse(
        { result: 'error', message: 'Bu işlem için yönetici yetkisi gerekli.' },
        403
      );
    }

    if (
      session.role === 'personel' &&
      BRANCH_BOUND_ACTIONS.has(actionType)
    ) {
      payload.branch = session.branch;
    }

    const scriptUrl =
      process.env.APPS_SCRIPT_URL ||
      process.env.NEXT_PUBLIC_SCRIPT_URL;

    if (!scriptUrl) {
      console.error('APPS_SCRIPT_URL bulunamadı.');
      return jsonResponse(
        { result: 'error', message: 'İşlem servisi yapılandırılmamış.' },
        500
      );
    }

    const upstream = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'User-Agent': 'CNETMOBIL-Portal/1.0',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      redirect: 'follow',
    });

    const upstreamText = await upstream.text();

    let upstreamData: Record<string, unknown>;

    try {
      upstreamData = JSON.parse(upstreamText);
    } catch {
      console.error(
        'Apps Script JSON olmayan cevap döndürdü:',
        upstreamText.slice(0, 300)
      );

      return jsonResponse(
        {
          result: 'error',
          message: 'İşlem servisinden geçersiz cevap alındı.',
        },
        502
      );
    }

    if (!upstream.ok) {
      return jsonResponse(
        {
          result: 'error',
          message:
            typeof upstreamData.message === 'string'
              ? upstreamData.message
              : 'İşlem servisi hata döndürdü.',
        },
        502
      );
    }

    return jsonResponse(upstreamData, 200);
  } catch (error) {
    console.error('PANEL ACTION API ERROR:', error);

    return jsonResponse(
      {
        result: 'error',
        message: 'İşlem sırasında sunucu hatası oluştu.',
      },
      500
    );
  }
}
