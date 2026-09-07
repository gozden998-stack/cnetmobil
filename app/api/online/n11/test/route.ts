// app/api/online/n11/test/route.ts
// CNETMOBIL ONLINE - N11 GERCEK BAGLANTI TESTI
// SADECE SUPER ADMIN.
// N11 anahtarlari sadece server-side ENV'den okunur.
// Bu endpoint N11'de veri DEGISTIRMEZ; sadece urun sorgulama GET istegi atar.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11TestPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const N11_PRODUCT_QUERY_URL =
  'https://api.n11.com/ms/product-query?page=0&size=1';

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
  isSuperAdmin: boolean;
};

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

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetN11TestPool) {
    global.cnetN11TestPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11TestPool;
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
    isSuperAdmin: row.is_super_admin === true,
  };
}

function getN11Credentials() {
  const appKey = String(process.env.N11_APP_KEY || '').trim();
  const appSecret = String(process.env.N11_APP_SECRET || '').trim();

  if (!appKey || !appSecret) {
    return null;
  }

  return {
    appKey,
    appSecret,
  };
}

function safeSampleProduct(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;

  return {
    n11ProductId:
      row.n11ProductId === null || row.n11ProductId === undefined
        ? null
        : String(row.n11ProductId),
    stockCode:
      row.stockCode === null || row.stockCode === undefined
        ? null
        : String(row.stockCode),
    title:
      row.title === null || row.title === undefined
        ? null
        : String(row.title),
    status:
      row.status === null || row.status === undefined
        ? null
        : String(row.status),
    saleStatus:
      row.saleStatus === null || row.saleStatus === undefined
        ? null
        : String(row.saleStatus),
    quantity: Number(row.quantity || 0),
    salePrice:
      row.salePrice === null || row.salePrice === undefined
        ? null
        : Number(row.salePrice),
    listPrice:
      row.listPrice === null || row.listPrice === undefined
        ? null
        : Number(row.listPrice),
  };
}

// ============================================================
// GET /api/online/n11/test
//
// Gercek N11 baglanti testi.
// N11'de herhangi bir veri degistirmez.
// GET product-query page=0 size=1 kullanir.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

    if (!user) {
      return json(
        {
          success: false,
          configured: false,
          connected: false,
          error: 'Oturum gerekli.',
        },
        401
      );
    }

    if (!user.isSuperAdmin) {
      return json(
        {
          success: false,
          configured: false,
          connected: false,
          error: 'Bu işlem yalnızca Super Admin tarafından yapılabilir.',
        },
        403
      );
    }

    const credentials = getN11Credentials();

    if (!credentials) {
      return json(
        {
          success: false,
          configured: false,
          connected: false,
          error:
            'N11_APP_KEY veya N11_APP_SECRET Coolify environment değişkenlerinde eksik.',
        },
        503
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12_000);
    const startedAt = Date.now();

    let response: Response;

    try {
      response = await fetch(N11_PRODUCT_QUERY_URL, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          appkey: credentials.appKey,
          appsecret: credentials.appSecret,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);

      if (
        error instanceof Error &&
        (error.name === 'AbortError' ||
          error.message.toLowerCase().includes('aborted'))
      ) {
        return json(
          {
            success: false,
            configured: true,
            connected: false,
            error: 'N11 API bağlantısı 12 saniye içinde yanıt vermedi.',
          },
          504
        );
      }

      console.error('N11 CONNECTION TEST FETCH ERROR:', error);

      return json(
        {
          success: false,
          configured: true,
          connected: false,
          error: 'N11 API bağlantısı kurulamadı.',
        },
        502
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const durationMs = Date.now() - startedAt;
    const rawText = await response.text();

    let payload: any = null;

    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      console.error('N11 CONNECTION TEST HTTP ERROR:', {
        status: response.status,
        bodyPreview: rawText.slice(0, 1000),
      });

      const n11Message =
        payload?.message ||
        payload?.error ||
        payload?.errorMessage ||
        payload?.title ||
        null;

      return json(
        {
          success: false,
          configured: true,
          connected: false,
          n11HttpStatus: response.status,
          durationMs,
          error: n11Message
            ? `N11 API hatası: ${String(n11Message)}`
            : `N11 API HTTP ${response.status} hatası döndürdü.`,
        },
        response.status >= 400 && response.status < 600
          ? response.status
          : 502
      );
    }

    const content = Array.isArray(payload?.content)
      ? payload.content
      : [];

    return json({
      success: true,
      configured: true,
      connected: true,
      message: 'N11 API bağlantısı başarılı.',
      durationMs,
      n11HttpStatus: response.status,
      totalElements: Number(payload?.totalElements || 0),
      totalPages: Number(payload?.totalPages || 0),
      returnedElements: content.length,
      sampleProduct:
        content.length > 0 ? safeSampleProduct(content[0]) : null,
      checkedBy: user.username,
    });
  } catch (error) {
    console.error('N11 CONNECTION TEST ERROR:', error);

    return json(
      {
        success: false,
        configured: Boolean(
          process.env.N11_APP_KEY && process.env.N11_APP_SECRET
        ),
        connected: false,
        error: 'N11 bağlantı testi tamamlanamadı.',
      },
      500
    );
  }
}
