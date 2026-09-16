// app/api/paratika/payment-link/route.ts
// CNETMOBIL - PARATIKA PAY BY LINK + POSTGRES KAYIT
// Tutar + Ad Soyad + E-posta + Telefon + Taksit Sayısı alır.
// Paratika linkini oluşturur, ardından işlemi PostgreSQL'e kaydeder.
// Ödeme linkini oluşturur ve Paratika üzerinden SMS bildirim talebi gönderir.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
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

declare global {
  // eslint-disable-next-line no-var
  var cnetParatikaPool: Pool | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetParatikaPool) {
    global.cnetParatikaPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetParatikaPool;
}

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

function createCustomerCode(customerPhone: string, customerEmail: string) {
  // Paratika live PAYBYLINKPAYMENT isteği CUSTOMER alanını zorunlu
  // isteyebiliyor. Aynı müşteri için aynı kodu üretelim; kişisel veriyi
  // CUSTOMER alanına açıkça yazmak yerine SHA-256 tabanlı kısa bir kod kullanıyoruz.
  const normalizedPhone = customerPhone.replace(/\D/g, '');
  const normalizedEmail = customerEmail.trim().toLowerCase();

  const hash = crypto
    .createHash('sha256')
    .update(`${normalizedPhone}|${normalizedEmail}`, 'utf8')
    .digest('hex')
    .slice(0, 24)
    .toUpperCase();

  return `CNET-${hash}`;
}

function buildExactInstallmentSupport(
  installmentCount: number
) {
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

  return `${url.protocol}//${url.host}/merchant/payment/${encodeURIComponent(
    sessionToken
  )}`;
}

function safeJson(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
}

async function savePaymentToPostgres(
  client: PoolClient,
  input: {
    merchantPaymentId: string;
    sessionToken: string;
    paymentUrl: string;
    branchCode: string;
    createdByUserId: number | null;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    amount: number;
    installmentCount: number;
    responseCode: string;
    responseMsg: string;
    rawResponse: unknown;
  }
) {
  const insertResult = await client.query(
    `
      INSERT INTO public.paratika_payments (
        merchant_payment_id,
        session_token,
        payment_url,

        branch_code,
        created_by_user_id,

        customer_name,
        customer_email,
        customer_phone,

        amount,
        currency,
        installment_count,

        status,
        paratika_status,
        response_code,
        response_msg,

        link_created_at,
        sent_at,
        raw_create_response,
        raw_last_response,
        last_synced_at
      )
      VALUES (
        $1, $2, $3,
        $4, $5,
        $6, $7, $8,
        $9, 'TRY', $10,
        'SENT', 'SENT', $11, $12,
        NOW(), NOW(), $13::jsonb, $13::jsonb, NOW()
      )
      RETURNING
        id,
        merchant_payment_id,
        branch_code,
        customer_name,
        customer_email,
        customer_phone,
        amount,
        currency,
        installment_count,
        status,
        link_created_at,
        created_at
    `,
    [
      input.merchantPaymentId,
      input.sessionToken,
      input.paymentUrl,

      input.branchCode,
      input.createdByUserId,

      input.customerName,
      input.customerEmail,
      input.customerPhone,

      input.amount,
      input.installmentCount,

      input.responseCode || null,
      input.responseMsg || null,

      JSON.stringify(safeJson(input.rawResponse)),
    ]
  );

  const payment = insertResult.rows[0];

  await client.query(
    `
      INSERT INTO public.paratika_payment_events (
        payment_id,
        event_type,
        source,
        old_status,
        new_status,
        detail
      )
      VALUES (
        $1,
        'PAYMENT_LINK_CREATED_SMS_REQUESTED',
        'PANEL',
        NULL,
        'SENT',
        $2::jsonb
      )
    `,
    [
      payment.id,
      JSON.stringify({
        merchantPaymentId: input.merchantPaymentId,
        branchCode: input.branchCode,
        createdByUserId: input.createdByUserId,
        amount: input.amount,
        installmentCount: input.installmentCount,
      }),
    ]
  );

  return payment;
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
      customerEmail.length > 128 ||
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
      installmentCount < 2 ||
      installmentCount > 12
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
    const customerCode = createCustomerCode(
      customerPhone,
      customerEmail
    );
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

    // Paratika PAYBYLINKPAYMENT örneğinde CUSTOMER alanı da gönderiliyor.
    // Live API ERR10010 / violatorParam=CUSTOMER döndürdüğü için
    // bu alanı stabil müşteri kodu ile gönderiyoruz.
    params.set('CUSTOMER', customerCode);
    params.set('CUSTOMERNAME', customerName);
    params.set('CUSTOMEREMAIL', customerEmail);
    params.set('CUSTOMERPHONE', customerPhone);

    params.set('LANGUAGE', 'tr');
    params.set('RETURNURL', returnUrl);

    // Paratika Pay By Link bildirimi:
    // Müşteriye ödeme linkinin SMS ile iletilmesini ister.
    params.set('NOTIFICATIONCHANNELS', 'SMS');

    // PAYBYLINKPAYMENT'te ödeme ekranında sadece panelde seçilen
    // taksitin görünmesi için Paratika'nın dokümante ettiği
    // INSTALLMENTSUPPORT alanını kullanıyoruz.
    //
    // Önemli: Paratika örneğinde "active" BOOLEAN değil STRING "true".
    // Önceki sürüm boolean true gönderdiği için ERR10237 oluşuyor,
    // fallback çalışınca link açılıyor fakat tüm taksitler görünüyordu.
    params.set(
      'INSTALLMENTSUPPORT',
      buildExactInstallmentSupport(
        installmentCount
      )
    );

    const paratikaResult =
      await postParatika(
        config,
        params
      );

    const response =
      paratikaResult.response;
    const data =
      paratikaResult.data;

    const responseCode = String(
      data?.responseCode ??
      data?.RESPONSECODE ??
      ''
    );

    const responseMsg = String(
      data?.responseMsg ??
      data?.RESPONSEMSG ??
      ''
    );

    // Paratika, responseCode 00 dışındaki hatalarda ERROR / ERRORCODE
    // alanlarını döndürebilir. Teşhis için güvenli şekilde kullanıcıya
    // geri döndürüyoruz; API kullanıcı adı/şifre gibi secret alanları
    // kesinlikle response'a eklenmez.
    const paratikaError = String(
      data?.errorMsg ??
      data?.ERRORMSG ??
      data?.error ??
      data?.ERROR ??
      ''
    );

    const paratikaErrorCode = String(
      data?.errorCode ??
      data?.ERRORCODE ??
      ''
    );

    const sessionToken = String(
      data?.sessionToken ??
      data?.SESSIONTOKEN ??
      ''
    ).trim();

    if (
      !response.ok ||
      responseCode !== '00' ||
      !sessionToken
    ) {
      console.error('PARATIKA PAYBYLINK FAILED', {
        httpStatus: response.status,
        responseCode,
        responseMsg,
        paratikaError,
        paratikaErrorCode,
        merchantPaymentId,
        // Secret içermez; yalnızca Paratika response body'sidir.
        paratikaResponse: data,
      });

      return noStoreJson(
        {
          success: false,
          channel: 'PARATIKA',
          message:
            responseMsg ||
            'Paratika ödeme linki oluşturulamadı.',
          responseCode: responseCode || null,
          responseMsg: responseMsg || null,
          errorCode: paratikaErrorCode || null,
          errorDetail: paratikaError || null,
          violatorParam: String(
            data?.violatorParam ??
            data?.VIOLATORPARAM ??
            ''
          ) || null,
          merchantPaymentId,
          // Geçici teşhis alanı. Paratika'nın hata cevabını görmemizi sağlar.
          // İstek credential'ları burada yer almaz.
          paratikaResponse: data,
          responseTimeMs: Date.now() - startedAt,
        },
        response.ok ? 400 : 502
      );
    }

    const paymentUrl = buildPaymentUrl(
      config.baseUrl,
      sessionToken
    );

    const pool = getPool();
    const client = await pool.connect();

    let savedPayment: any = null;

    try {
      await client.query('BEGIN');

      savedPayment = await savePaymentToPostgres(client, {
        merchantPaymentId,
        sessionToken,
        paymentUrl,
        branchCode: String(auth.session.branch || '').trim(),
        createdByUserId:
          auth.session.userId !== null
            ? Number(auth.session.userId)
            : null,
        customerName,
        customerEmail,
        customerPhone,
        amount: Number(amount.toFixed(2)),
        installmentCount,
        responseCode,
        responseMsg,
        rawResponse: data,
      });

      await client.query('COMMIT');
    } catch (dbError) {
      try {
        await client.query('ROLLBACK');
      } catch {}

      console.error(
        'PARATIKA LINK OLUŞTU AMA POSTGRES KAYDI BAŞARISIZ:',
        {
          merchantPaymentId,
          dbError,
        }
      );

      // Kritik:
      // Paratika linki gerçekten oluştuğu için kullanıcıya bunu gizlemiyoruz.
      // Duplicate ödeme oluşturmaması için aynı isteği otomatik tekrar etmiyoruz.
      return noStoreJson(
        {
          success: false,
          paratikaLinkCreated: true,
          databaseSaved: false,
          channel: 'PARATIKA',
          message:
            'Paratika ödeme linki oluştu ve SMS gönderim talebi iletildi fakat PostgreSQL kaydı yapılamadı. Aynı ödemeyi tekrar oluşturmayın.',
          merchantPaymentId,
          sessionToken,
          paymentUrl,
          responseCode,
          responseMsg,
        },
        500
      );
    } finally {
      client.release();
    }

    return noStoreJson({
      success: true,
      databaseSaved: true,
      channel: 'PARATIKA',
      message:
        'Paratika ödeme linki oluşturuldu, SMS gönderim talebi Paratika\'ya iletildi ve kayıt PostgreSQL\'e kaydedildi.',

      id: savedPayment.id,
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

      branch: String(auth.session.branch || '').trim(),
      createdByUserId: auth.session.userId,

      status: 'SENT',
      notificationChannels: ['SMS'],
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
