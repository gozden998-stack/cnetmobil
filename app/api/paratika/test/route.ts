// app/api/paratika/test/route.ts
// CNETMOBIL - Paratika bağlantı testi
// Ödeme oluşturmaz, para çekmez, link üretmez.
// Sadece Paratika API kimlik bilgilerini READ-ONLY bir sorgu ile test eder.

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function noStoreJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
}

function getConfig() {
  const merchant = String(process.env.PARATIKA_MERCHANT || '').trim();
  const merchantUser = String(process.env.PARATIKA_MERCHANT_USER || '').trim();
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

  if (missing.length) {
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
  if (baseUrl.includes('entegrasyon.paratika.com.tr')) {
    return 'TEST';
  }

  if (baseUrl.includes('vpos.paratika.com.tr')) {
    return 'LIVE';
  }

  return 'CUSTOM';
}

async function requireSuperAdmin(request: NextRequest) {
  const cookie = request.headers.get('cookie') || '';

  const meUrl = new URL('/api/me', request.url);

  const res = await fetch(meUrl, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data?.isSuperAdmin) {
    return false;
  }

  return true;
}

function parseParatikaResponse(text: string) {
  const trimmed = String(text || '').trim();

  if (!trimmed) {
    return {
      parsed: null,
      responseCode: '',
      responseMsg: '',
    };
  }

  try {
    const json = JSON.parse(trimmed);

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
    const params = new URLSearchParams(trimmed);

    const plain: Record<string, string> = {};
    params.forEach((value, key) => {
      plain[key] = value;
    });

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
  } catch {
    return {
      parsed: null,
      responseCode: '',
      responseMsg: '',
    };
  }
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  try {
    const authorized = await requireSuperAdmin(request);

    if (!authorized) {
      return noStoreJson(
        {
          success: false,
          error: 'Bu test yalnızca Super Admin içindir.',
        },
        403
      );
    }

    const {
      merchant,
      merchantUser,
      merchantPassword,
      baseUrl,
    } = getConfig();

    // READ-ONLY sorgu.
    // Paratika dokümanında QUERYCUSTOMERCOMMISSION sorgusu
    // MERCHANT / MERCHANTUSER / MERCHANTPASSWORD ile çalışır.
    const body = new URLSearchParams();
    body.set('ACTION', 'QUERYCUSTOMERCOMMISSION');
    body.set('MERCHANT', merchant);
    body.set('MERCHANTUSER', merchantUser);
    body.set('MERCHANTPASSWORD', merchantPassword);

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
        body: body.toString(),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    const parsed = parseParatikaResponse(responseText);

    const looksSuccessful =
      response.ok &&
      (
        parsed.responseCode === '00' ||
        parsed.responseCode === '0' ||
        parsed.responseCode.toUpperCase() === 'SUCCESS'
      );

    return noStoreJson({
      success: true,
      connected: looksSuccessful,
      channel: 'PARATIKA',
      environment: detectEnvironment(baseUrl),
      httpStatus: response.status,
      responseCode: parsed.responseCode || null,
      responseMsg: parsed.responseMsg || null,

      // İlk bağlantı testinde Paratika'nın gerçek cevabını görmemiz için.
      // İstek içindeki MERCHANT / kullanıcı / şifre BURADA DÖNDÜRÜLMEZ.
      paratikaResponse: parsed.parsed ?? responseText.slice(0, 1500),

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
        channel: 'PARATIKA',
        error: isAbort
          ? 'Paratika bağlantısı zaman aşımına uğradı.'
          : error instanceof Error
          ? error.message
          : 'Paratika bağlantı testi başarısız.',
        responseTimeMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      isAbort ? 504 : 500
    );
  }
}
