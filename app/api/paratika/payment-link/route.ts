// app/api/paratika/payment-link/route.ts
// CNETMOBIL - Paratika Pay By Link
// İlk aşama: ödeme linki oluşturur, SMS GÖNDERMEZ.
// Personel/Yönetici giriş yapmış olmalıdır.
// Tutar + Ad Soyad + E-posta + Telefon + Taksit Sayısı alır.

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

type ParatikaConfig = {
  merchant: string;
  merchantUser: string;
  merchantPassword: string;
  baseUrl: string;
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

function requireSession(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value || '';
  const session = verifySession(token);

  if (!session) {
    return {
      ok: false as const,
      response: noStoreJson(
        {
          success: false,
          error: 'Oturum gerekli.',
        },
        401
      ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');

  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const expectedHost =
      request.headers.get('x-forwarded-host') ||
      request.headers.get('host') ||
      request.nextUrl.host;

    return originUrl.host === expectedHost;
  } catch {
    return false;
  }
}

function getParatikaConfig(): ParatikaConfig {
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

function parseAmount(value: unknown) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  let text = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/₺/g, '')
    .replace(/TL/gi, '');

  if (!text) return 0;

  // 45.000,50 -> 45000.50
  if (text.includes(',') && text.includes('.')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  }

  const amount = Number(text);

  return Number.isFinite(amount) ? amount : 0;
}

function normalizePhone(value: unknown) {
  let digits = String(value ?? '').replace(/\D/g, '');

  if (digits.startsWith('0090')) {
    digits = digits.slice(2);
  }

  if (digits.startsWith('0') && digits.length === 11) {
    digits = `90${digits.slice(1)}`;
  }

  if (digits.length === 10 && digits.startsWith('5')) {
    digits = `90${digits}`;
  }

  return digits;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createMerchantPaymentId() {
  const now = new Date();

  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  return `CNETPBL-${stamp}-${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`;
}

async function postParatika(
  config: ParatikaConfig,
  params: URLSearchParams
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type':
          'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: params.toString(),
      signal: controller.signal,
    });

    const text = await response.text();

    let data: any = null;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        responseCode: '',
        responseMsg: text || 'Paratika boş cevap döndürdü.',
      };
    }

    return {
      response,
      data,
      text,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function collectInstallmentCounts(value: unknown) {
  const result = new Set<number>();
  const visited = new Set<object>();

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;

    const obj = node as Record<string, unknown>;

    if (visited.has(obj)) return;
    visited.add(obj);

    if (Array.isArray(obj.installmentList)) {
      for (const item of obj.installmentList) {
        const count = Number(
          item && typeof item === 'object'
            ? (item as Record<string, unknown>).count
            : NaN
        );

        if (Number.isInteger(count) && count >= 1 && count <= 99) {
          result.add(count);
        }
      }
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }

    for (const child of Object.values(obj)) {
      walk(child);
    }
  };

  walk(value);

  return [...result].sort((a, b) => a - b);
}

async function getAllowedInstallments(config: ParatikaConfig) {
  const params = new URLSearchParams();

  params.set('ACTION', 'QUERYCUSTOMERCOMMISSION');
  params.set('MERCHANT', config.merchant);
  params.set('MERCHANTUSER', config.merchantUser);
  params.set('MERCHANTPASSWORD', config.merchantPassword);

  const { response, data } = await postParatika(config, params);

  if (!response.ok) {
    throw new Error(
      `Paratika taksit bilgisi alınamadı. HTTP ${response.status}`
    );
  }

  const counts = collectInstallmentCounts(data);

  if (!counts.length) {
    throw new Error(
      'Paratika hesabından kullanılabilir taksit listesi alınamadı.'
    );
  }

  return counts;
}

function buildInstallmentSupport(installmentCount: number) {
  // Paratika PAYBYLINKPAYMENT dokümanındaki INSTALLMENTSUPPORT örneği
  // commissionKey alanında CR2, CR6 vb. kullanıyor.
  // Seçilen taksit için hem BUSINESS hem CONSUMER aktif edilir.
  return JSON.stringify([
    {
      commissionKey: `CR${installmentCount}`,
      installmentType: 'BUSINESS',
      active: 'true',
    },
    {
      commissionKey: `CR${installmentCount}`,
      installmentType: 'CONSUMER',
      active: 'true',
    },
  ]);
}

function getReturnUrl(request: NextRequest) {
  const configured = String(
    process.env.PARATIKA_RETURN_URL || ''
  ).trim();

  if (configured) {
    return configured;
  }

  const forwardedProto =
    request.headers.get('x-forwarded-proto') || 'https';
  const forwardedHost =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    request.nextUrl.host;

  return `${forwardedProto}://${forwardedHost}/api/paratika/return`;
}

function buildPaymentUrl(baseUrl: string, sessionToken: string) {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.host}/payment/${encodeURIComponent(
    sessionToken
  )}`;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  try {
    if (!sameOrigin(request)) {
      return noStoreJson(
        {
          success: false,
          error: 'Geçersiz istek kaynağı.',
        },
        403
      );
    }

    const auth = requireSession(request);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await request.json().catch(() => ({}));

    const amount = parseAmount(body?.amount);
    const customerName = String(body?.customerName || '').trim();
    const customerEmail = String(body?.customerEmail || '')
      .trim()
      .toLowerCase();
    const customerPhone = normalizePhone(body?.customerPhone);
    const installmentCount = Number(body?.installmentCount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return noStoreJson(
        {
          success: false,
          error: 'Geçerli bir tutar girin.',
        },
        400
      );
    }

    if (amount > 10_000_000) {
      return noStoreJson(
        {
          success: false,
          error: 'Tutar güvenlik sınırını aşıyor.',
        },
        400
      );
    }

    if (customerName.length < 3 || customerName.length > 128) {
      return noStoreJson(
        {
          success: false,
          error: 'Müşteri ad soyad bilgisi geçersiz.',
        },
        400
      );
    }

    if (
      !customerEmail ||
      customerEmail.length > 64 ||
      !validEmail(customerEmail)
    ) {
      return noStoreJson(
        {
          success: false,
          error: 'Geçerli bir e-posta adresi girin.',
        },
        400
      );
    }

    if (
      customerPhone.length !== 12 ||
      !customerPhone.startsWith('905')
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            'Telefon numarasını 05xx xxx xx xx formatında girin.',
        },
        400
      );
    }

    if (
      !Number.isInteger(installmentCount) ||
      installmentCount < 1 ||
      installmentCount > 24
    ) {
      return noStoreJson(
        {
          success: false,
          error: 'Geçerli bir taksit sayısı seçin.',
        },
        400
      );
    }

    const config = getParatikaConfig();

    // Seçilen taksit gerçekten Paratika hesabında tanımlı mı kontrol et.
    const allowedInstallments = await getAllowedInstallments(config);

    if (!allowedInstallments.includes(installmentCount)) {
      return noStoreJson(
        {
          success: false,
          error: `${installmentCount} taksit Paratika hesabında kullanıma açık değil.`,
          allowedInstallments,
        },
        400
      );
    }

    const merchantPaymentId = createMerchantPaymentId();
    const returnUrl = getReturnUrl(request);

    const params = new URLSearchParams();

    params.set('ACTION', 'PAYBYLINKPAYMENT');
    params.set('MERCHANT', config.merchant);
    params.set('MERCHANTUSER', config.merchantUser);
    params.set('MERCHANTPASSWORD', config.merchantPassword);

    params.set('SESSIONTYPE', 'PAYMENTSESSION');
    params.set('SESSIONEXPIRY', '168h');

    params.set('MERCHANTPAYMENTID', merchantPaymentId);
    params.set('AMOUNT', amount.toFixed(2));
    params.set('CURRENCY', 'TRY');

    params.set('CUSTOMERNAME', customerName);
    params.set('CUSTOMEREMAIL', customerEmail);
    params.set('CUSTOMERPHONE', customerPhone);

    params.set('LANGUAGE', 'tr');
    params.set('RETURNURL', returnUrl);

    // İlk aşamada SMS gönderilmez.
    // Link başarıyla oluşturulduktan sonra SMS adımını ayrıca ekleyeceğiz.

    params.set(
      'INSTALLMENTSUPPORT',
      buildInstallmentSupport(installmentCount)
    );

    const { response, data } = await postParatika(config, params);

    const responseCode = String(data?.responseCode ?? '');
    const responseMsg = String(data?.responseMsg ?? '');
    const sessionToken = String(data?.sessionToken ?? '').trim();

    if (
      !response.ok ||
      responseCode !== '00' ||
      !sessionToken
    ) {
      console.error('PARATIKA PAYBYLINK FAILED', {
        httpStatus: response.status,
        responseCode,
        responseMsg,
        merchantPaymentId,
      });

      return noStoreJson(
        {
          success: false,
          channel: 'PARATIKA',
          message:
            responseMsg ||
            'Paratika ödeme linki oluşturulamadı.',
          responseCode: responseCode || null,
          merchantPaymentId,
          responseTimeMs: Date.now() - startedAt,
        },
        response.ok ? 400 : 502
      );
    }

    const paymentUrl = buildPaymentUrl(
      config.baseUrl,
      sessionToken
    );

    return noStoreJson({
      success: true,
      channel: 'PARATIKA',
      message: 'Paratika ödeme linki oluşturuldu.',
      merchantPaymentId,
      sessionToken,
      paymentUrl,
      amount: Number(amount.toFixed(2)),
      currency: 'TRY',
      customerName,
      customerEmail,
      customerPhone,
      installmentCount,
      allowedInstallments,
      branch: auth.session.branch,
      responseCode,
      responseMsg,
      expiresIn: '168h',
      responseTimeMs: Date.now() - startedAt,
      createdAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const isAbort =
      error?.name === 'AbortError' ||
      String(error?.message || '')
        .toLowerCase()
        .includes('aborted');

    console.error('PARATIKA PAYMENT LINK ERROR:', error);

    return noStoreJson(
      {
        success: false,
        channel: 'PARATIKA',
        error: isAbort
          ? 'Paratika bağlantısı zaman aşımına uğradı.'
          : error instanceof Error
          ? error.message
          : 'Paratika ödeme linki oluşturulamadı.',
      },
      isAbort ? 504 : 500
    );
  }
}
