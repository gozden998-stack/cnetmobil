// app/api/paratika/test/route.ts
// CNETMOBIL - PARATIKA API BAĞLANTI TESTİ
// Ödeme oluşturmaz, para çekmez, ödeme linki üretmez.
// /api/me'ye iç fetch YAPMAZ; oturumu doğrudan HttpOnly cnet_auth cookie'den doğrular.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COOKIE_NAME = 'cnet_auth';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function getSessionSecret() {
  const secret = String(process.env.SESSION_SECRET || '').trim();

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

function requireAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value || '';
  const session = verifySession(token);

  if (!session) {
    return {
      ok: false as const,
      response: noStoreJson(
        {
          success: false,
          connected: false,
          channel: 'PARATIKA',
          error: 'Oturum gerekli.',
        },
        401
      ),
    };
  }

  if (session.role !== 'admin') {
    return {
      ok: false as const,
      response: noStoreJson(
        {
          success: false,
          connected: false,
          channel: 'PARATIKA',
          error: 'Bu test yalnızca yönetici hesabıyla çalıştırılabilir.',
        },
        403
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

function getParatikaConfig() {
  const merchant = String(process.env.PARATIKA_MERCHANT || '').trim();
  const merchantUser = String(
    process.env.PARATIKA_MERCHANT_USER || ''
  ).trim();
  const merchantPassword = String(
    process.env.PARATIKA_MERCHANT_PASSWORD || ''
  ).trim();
  const baseUrl = String(
    process.env.PARATIKA_BASE_URL ||
      'https://vpos.paratika.com.tr/paratika/api/v2'
  )
    .trim()
    .replace(/\/+$/, '');

  const missing: string[] = [];

  if (!merchant) missing.push('PARATIKA_MERCHANT');
  if (!merchantUser) missing.push('PARATIKA_MERCHANT_USER');
  if (!merchantPassword) missing.push('PARATIKA_MERCHANT_PASSWORD');
  if (!baseUrl) missing.push('PARATIKA_BASE_URL');

  if (missing.length > 0) {
    throw new Error(
      `Eksik environment variable: ${missing.join(', ')}`
    );
  }

  if (!baseUrl.startsWith('https://')) {
    throw new Error('PARATIKA_BASE_URL HTTPS olmalıdır.');
  }

  return {
    merchant,
    merchantUser,
    merchantPassword,
    baseUrl,
  };
}

function detectEnvironment(baseUrl: string) {
  if (baseUrl.includes('entegrasyon.paratika.com.tr')) return 'TEST';
  if (baseUrl.includes('vpos.paratika.com.tr')) return 'LIVE';
  return 'CUSTOM';
}

function parseResponse(text: string) {
  const raw = String(text || '').trim();

  if (!raw) {
    return {
      parsed: null as any,
      responseCode: '',
      responseMsg: '',
    };
  }

  try {
    const json = JSON.parse(raw);

    return {
      parsed: json,
      responseCode: String(
        json?.responseCode ??
          json?.responsecode ??
          json?.RESPONSECODE ??
          ''
      ),
      responseMsg: String(
        json?.responseMsg ??
          json?.responseMessage ??
          json?.responsemsg ??
          json?.RESPONSEMSG ??
          ''
      ),
    };
  } catch {}

  try {
    const params = new URLSearchParams(raw);
    const plain: Record<string, string> = {};

    params.forEach((value, key) => {
      plain[key] = value;
    });

    if (Object.keys(plain).length > 0) {
      return {
        parsed: plain,
        responseCode: String(
          plain.responseCode ||
            plain.responsecode ||
            plain.RESPONSECODE ||
            ''
        ),
        responseMsg: String(
          plain.responseMsg ||
            plain.responseMessage ||
            plain.responsemsg ||
            plain.RESPONSEMSG ||
            ''
        ),
      };
    }
  } catch {}

  return {
    parsed: raw.slice(0, 2000),
    responseCode: '',
    responseMsg: '',
  };
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const auth = requireAdmin(request);

    if (!auth.ok) {
      return auth.response;
    }

    const {
      merchant,
      merchantUser,
      merchantPassword,
      baseUrl,
    } = getParatikaConfig();

    const form = new URLSearchParams();

    // Read-only test isteği:
    form.set('ACTION', 'QUERYCUSTOMERCOMMISSION');
    form.set('MERCHANT', merchant);
    form.set('MERCHANTUSER', merchantUser);
    form.set('MERCHANTPASSWORD', merchantPassword);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    let response: Response;

    try {
      response = await fetch(baseUrl, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'Content-Type':
            'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: form.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const text = await response.text();
    const parsed = parseResponse(text);

    // Burada HTTP cevap gelmesi ağ bağlantısının başarılı olduğunu gösterir.
    // Paratika kimlik doğrulaması ise responseCode / responseMsg ile anlaşılır.
    const connectedToParatika = response.status > 0;

    return noStoreJson({
      success: true,
      connected: connectedToParatika,
      authenticated:
        parsed.responseCode === '00' ||
        parsed.responseCode === '0',
      channel: 'PARATIKA',
      environment: detectEnvironment(baseUrl),
      httpStatus: response.status,
      responseCode: parsed.responseCode || null,
      responseMsg: parsed.responseMsg || null,
      paratikaResponse: parsed.parsed,
      responseTimeMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const isAbort =
      error?.name === 'AbortError' ||
      String(error?.message || '')
        .toLowerCase()
        .includes('aborted');

    console.error('PARATIKA TEST ERROR:', error);

    return noStoreJson(
      {
        success: false,
        connected: false,
        authenticated: false,
        channel: 'PARATIKA',
        error: isAbort
          ? 'Paratika bağlantısı zaman aşımına uğradı.'
          : error instanceof Error
          ? error.message
          : 'Paratika bağlantı testi başarısız.',
        cause:
          error?.cause && typeof error.cause === 'object'
            ? {
                code: error.cause.code || null,
                message: error.cause.message || null,
              }
            : null,
        responseTimeMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      isAbort ? 504 : 500
    );
  }
}
