// app/api/online/n11/test/route.ts
// CNETMOBIL ONLINE - N11 KEY / SECRET TESHIS TESTI
// SADECE SUPER ADMIN.
// Secret response'a yazilmaz.
// 1) Category endpoint: sadece APP KEY test edilir.
// 2) Product Query: APP KEY + APP SECRET birlikte test edilir.
// N11 tarafinda veri DEGISTIRMEZ.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11DiagPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const N11_CATEGORIES_URL = 'https://api.n11.com/cdn/categories';
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

  if (!global.cnetN11DiagPool) {
    global.cnetN11DiagPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11DiagPool;
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

  if (!row || row.active !== true) return null;

  return {
    id: Number(row.id),
    username: String(row.username),
    isSuperAdmin: row.is_super_admin === true,
  };
}

function getN11Credentials() {
  const appKey = String(process.env.N11_APP_KEY || '').trim();
  const appSecret = String(process.env.N11_APP_SECRET || '').trim();

  if (!appKey || !appSecret) return null;

  return { appKey, appSecret };
}

async function readResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return { text: '', payload: null as any };
  }

  try {
    return { text, payload: JSON.parse(text) };
  } catch {
    return { text, payload: null as any };
  }
}

function extractMessage(payload: any, rawText: string) {
  const message =
    payload?.message ||
    payload?.error ||
    payload?.errorMessage ||
    payload?.title ||
    payload?.reason ||
    null;

  if (message) return String(message);
  if (rawText && rawText.length <= 300) return rawText;
  return null;
}

function safeSampleProduct(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;

  return {
    n11ProductId:
      row.n11ProductId == null ? null : String(row.n11ProductId),
    stockCode: row.stockCode == null ? null : String(row.stockCode),
    title: row.title == null ? null : String(row.title),
    status: row.status == null ? null : String(row.status),
    saleStatus: row.saleStatus == null ? null : String(row.saleStatus),
    quantity: Number(row.quantity || 0),
    salePrice: row.salePrice == null ? null : Number(row.salePrice),
    listPrice: row.listPrice == null ? null : Number(row.listPrice),
  };
}

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 12_000
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      headers,
      signal: controller.signal,
    });

    return {
      response,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

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

    // 1) Sadece APP KEY testi
    let keyTest: {
      success: boolean;
      httpStatus: number | null;
      durationMs: number | null;
      error: string | null;
    };

    try {
      const { response, durationMs } = await fetchWithTimeout(
        N11_CATEGORIES_URL,
        {
          appkey: credentials.appKey,
          Accept: 'application/json',
        }
      );

      const { text, payload } = await readResponse(response);

      keyTest = {
        success: response.ok,
        httpStatus: response.status,
        durationMs,
        error: response.ok
          ? null
          : extractMessage(payload, text) ||
            `N11 kategori servisi HTTP ${response.status}`,
      };
    } catch (error) {
      keyTest = {
        success: false,
        httpStatus: null,
        durationMs: null,
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'N11 kategori servisi zaman aşımına uğradı.'
            : 'N11 kategori servisine ulaşılamadı.',
      };
    }

    // 2) APP KEY + APP SECRET testi
    let authTest: {
      success: boolean;
      httpStatus: number | null;
      durationMs: number | null;
      error: string | null;
      totalElements: number | null;
      sampleProduct: ReturnType<typeof safeSampleProduct>;
    };

    try {
      const { response, durationMs } = await fetchWithTimeout(
        N11_PRODUCT_QUERY_URL,
        {
          appkey: credentials.appKey,
          appsecret: credentials.appSecret,
          Accept: 'application/json',
        }
      );

      const { text, payload } = await readResponse(response);
      const content = Array.isArray(payload?.content) ? payload.content : [];

      authTest = {
        success: response.ok,
        httpStatus: response.status,
        durationMs,
        error: response.ok
          ? null
          : extractMessage(payload, text) ||
            `N11 ürün servisi HTTP ${response.status}`,
        totalElements: response.ok
          ? Number(payload?.totalElements || 0)
          : null,
        sampleProduct:
          response.ok && content.length > 0
            ? safeSampleProduct(content[0])
            : null,
      };
    } catch (error) {
      authTest = {
        success: false,
        httpStatus: null,
        durationMs: null,
        error:
          error instanceof Error && error.name === 'AbortError'
            ? 'N11 ürün servisi zaman aşımına uğradı.'
            : 'N11 ürün servisine ulaşılamadı.',
        totalElements: null,
        sampleProduct: null,
      };
    }

    let diagnosis = '';

    if (keyTest.success && authTest.success) {
      diagnosis = 'N11 API KEY ve API SECRET doğrulaması başarılı.';
    } else if (!keyTest.success) {
      diagnosis =
        'API KEY doğrulanamadı. N11 panelindeki API Anahtarı ile Coolify N11_APP_KEY değerini birebir kontrol edin.';
    } else {
      diagnosis =
        'API KEY doğrulandı ancak KEY + SECRET doğrulaması reddedildi. N11_APP_SECRET veya KEY/SECRET eşleşmesi hatalı.';
    }

    return json(
      {
        success: keyTest.success && authTest.success,
        configured: true,
        connected: authTest.success,
        keyTest,
        authTest,
        diagnosis,
        checkedBy: user.username,
      },
      keyTest.success && authTest.success ? 200 : 401
    );
  } catch (error) {
    console.error('N11 DIAGNOSTIC TEST ERROR:', error);

    return json(
      {
        success: false,
        configured: Boolean(
          process.env.N11_APP_KEY && process.env.N11_APP_SECRET
        ),
        connected: false,
        error: 'N11 teşhis testi tamamlanamadı.',
      },
      500
    );
  }
}
