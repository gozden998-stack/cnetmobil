// app/api/paratika/payment-link/route.ts
// CNETMOBIL - PARATIKA FINAL PAYMENT LINK
//
// Akış:
// 1) PAYBYLINKPAYMENT ile ödeme linki/session oluşturulur.
// 2) Paratika desteğinin verdiği INSTALLMENTSUPPORT formatı ile
//    sadece panelde seçilen taksit aktif edilir.
// 3) Aynı PayByLink kaydının token'ı bulunur ve SMS bildirimi RESEND ile istenir.
// 4) İşlem PostgreSQL'e kaydedilir.
//
// Not:
// - Taksit 2..12
// - INSTALLMENTSUPPORT CR1..CR24 için hem CONSUMER hem BUSINESS kayıtlarını içerir.
// - Seçilen taksit active=true, diğer tüm taksitler active=false olur.
// - active BOOLEAN, encryptable=false gönderilir.
// - URLSearchParams.toString() application/x-www-form-urlencoded encode işlemini yapar.
// - Tüm taksitleri açan fallback yoktur.
// - Paratika secret bilgileri yalnızca server-side env'de kalır.

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

function noStoreJson(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
    },
  });
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

function getSessionSecret() {
  const secret = String(
    process.env.SESSION_SECRET || ''
  ).trim();

  if (!secret) {
    throw new Error('SESSION_SECRET bulunamadı.');
  }

  return secret;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [encoded, signature] = token.split('.');

    if (!encoded || !signature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac(
        'sha256',
        getSessionSecret()
      )
      .update(encoded)
      .digest('base64url');

    const a = Buffer.from(
      signature,
      'utf8'
    );

    const b = Buffer.from(
      expectedSignature,
      'utf8'
    );

    if (
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(
        encoded,
        'base64url'
      ).toString('utf8')
    ) as SessionPayload;

    if (
      !payload ||
      !payload.exp ||
      payload.exp <
        Math.floor(Date.now() / 1000) ||
      !['admin', 'personel'].includes(
        payload.role
      ) ||
      typeof payload.branch !== 'string'
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function requireSession(
  request: NextRequest
) {
  const token =
    request.cookies.get(COOKIE_NAME)
      ?.value || '';

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

function sameOrigin(
  request: NextRequest
) {
  const origin =
    request.headers.get('origin');

  if (!origin) {
    return false;
  }

  try {
    const originUrl = new URL(origin);

    const expectedHost =
      request.headers.get(
        'x-forwarded-host'
      ) ||
      request.headers.get('host') ||
      request.nextUrl.host;

    return (
      originUrl.host === expectedHost
    );
  } catch {
    return false;
  }
}

function getParatikaConfig(): ParatikaConfig {
  const merchant = String(
    process.env.PARATIKA_MERCHANT ||
      ''
  ).trim();

  const merchantUser = String(
    process.env
      .PARATIKA_MERCHANT_USER || ''
  ).trim();

  const merchantPassword = String(
    process.env
      .PARATIKA_MERCHANT_PASSWORD ||
      ''
  ).trim();

  const baseUrl = String(
    process.env.PARATIKA_BASE_URL ||
      'https://vpos.paratika.com.tr/paratika/api/v2'
  )
    .trim()
    .replace(/\/+$/, '');

  const missing: string[] = [];

  if (!merchant) {
    missing.push(
      'PARATIKA_MERCHANT'
    );
  }

  if (!merchantUser) {
    missing.push(
      'PARATIKA_MERCHANT_USER'
    );
  }

  if (!merchantPassword) {
    missing.push(
      'PARATIKA_MERCHANT_PASSWORD'
    );
  }

  if (!baseUrl) {
    missing.push(
      'PARATIKA_BASE_URL'
    );
  }

  if (missing.length) {
    throw new Error(
      `Eksik environment variable: ${missing.join(
        ', '
      )}`
    );
  }

  if (
    !baseUrl.startsWith('https://')
  ) {
    throw new Error(
      'PARATIKA_BASE_URL HTTPS olmalıdır.'
    );
  }

  return {
    merchant,
    merchantUser,
    merchantPassword,
    baseUrl,
  };
}

function parseAmount(
  value: unknown
) {
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  let text = String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/₺/g, '')
    .replace(/TL/gi, '');

  if (!text) {
    return 0;
  }

  if (
    text.includes(',') &&
    text.includes('.')
  ) {
    text = text
      .replace(/\./g, '')
      .replace(',', '.');
  } else if (
    text.includes(',')
  ) {
    text = text.replace(',', '.');
  }

  const amount = Number(text);

  return Number.isFinite(amount)
    ? amount
    : 0;
}

function normalizePhone(
  value: unknown
) {
  let digits = String(value ?? '')
    .replace(/\D/g, '');

  if (
    digits.startsWith('0090')
  ) {
    digits = digits.slice(2);
  }

  if (
    digits.startsWith('0') &&
    digits.length === 11
  ) {
    digits =
      `90${digits.slice(1)}`;
  }

  if (
    digits.length === 10 &&
    digits.startsWith('5')
  ) {
    digits = `90${digits}`;
  }

  return digits;
}

function validEmail(
  value: string
) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value
  );
}

function createMerchantPaymentId() {
  const now = new Date();

  const stamp = [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, '0'),
    String(
      now.getDate()
    ).padStart(2, '0'),
    String(
      now.getHours()
    ).padStart(2, '0'),
    String(
      now.getMinutes()
    ).padStart(2, '0'),
    String(
      now.getSeconds()
    ).padStart(2, '0'),
  ].join('');

  return `CNETPBL-${stamp}-${crypto
    .randomBytes(4)
    .toString('hex')
    .toUpperCase()}`;
}

function createCustomerCode(
  customerPhone: string,
  customerEmail: string
) {
  const normalizedPhone =
    customerPhone.replace(
      /\D/g,
      ''
    );

  const normalizedEmail =
    customerEmail
      .trim()
      .toLowerCase();

  const hash = crypto
    .createHash('sha256')
    .update(
      `${normalizedPhone}|${normalizedEmail}`,
      'utf8'
    )
    .digest('hex')
    .slice(0, 24)
    .toUpperCase();

  return `CNET-${hash}`;
}

function buildInstallmentSupport(
  selectedInstallment: number
) {
  const result: Array<{
    commissionKey: string;
    active: boolean;
    installmentType:
      | 'CONSUMER'
      | 'BUSINESS';
    encryptable: boolean;
  }> = [];

  const installmentTypes: Array<
    'CONSUMER' | 'BUSINESS'
  > = [
    'CONSUMER',
    'BUSINESS',
  ];

  for (
    const installmentType
    of installmentTypes
  ) {
    for (
      let installment = 1;
      installment <= 24;
      installment++
    ) {
      result.push({
        commissionKey:
          `CR${installment}`,
        active:
          installment ===
          selectedInstallment,
        installmentType,
        encryptable: false,
      });
    }
  }

  return JSON.stringify(result);
}

function getReturnUrl(
  request: NextRequest
) {
  const configured = String(
    process.env.PARATIKA_RETURN_URL ||
      ''
  ).trim();

  if (configured) {
    return configured;
  }

  const forwardedProto =
    request.headers.get(
      'x-forwarded-proto'
    ) || 'https';

  const forwardedHost =
    request.headers.get(
      'x-forwarded-host'
    ) ||
    request.headers.get('host') ||
    request.nextUrl.host;

  return `${forwardedProto}://${forwardedHost}/api/paratika/return`;
}

function buildPaymentUrl(
  baseUrl: string,
  sessionToken: string
) {
  const url = new URL(baseUrl);

  return `${url.protocol}//${url.host}/merchant/payment/${encodeURIComponent(
    sessionToken
  )}`;
}

function safeJson(
  value: unknown
) {
  try {
    return JSON.parse(
      JSON.stringify(
        value ?? null
      )
    );
  } catch {
    return null;
  }
}

async function postParatika(
  config: ParatikaConfig,
  params: URLSearchParams
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      20_000
    );

  try {
    const response = await fetch(
      config.baseUrl,
      {
        method: 'POST',
        cache: 'no-store',
        headers: {
          Accept:
            'application/json, text/plain, */*',
          'Content-Type':
            'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: params.toString(),
        signal: controller.signal,
      }
    );

    const text =
      await response.text();

    let data: any = null;

    try {
      data = text
        ? JSON.parse(text)
        : {};
    } catch {
      data = {
        responseCode: '',
        responseMsg:
          text ||
          'Paratika boş cevap döndürdü.',
      };
    }

    return {
      response,
      data,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function paratikaField(
  data: any,
  ...keys: string[]
) {
  for (const key of keys) {
    const value = data?.[key];

    if (
      value !== undefined &&
      value !== null
    ) {
      return String(value);
    }
  }

  return '';
}

function findDeepStringByKeys(
  value: unknown,
  keys: string[]
): string {
  const wanted = new Set(
    keys.map((key) =>
      key.toLowerCase()
    )
  );

  const visit = (
    node: unknown
  ): string => {
    if (
      node === null ||
      node === undefined
    ) {
      return '';
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const found =
          visit(item);

        if (found) {
          return found;
        }
      }

      return '';
    }

    if (
      typeof node !== 'object'
    ) {
      return '';
    }

    for (const [
      key,
      child,
    ] of Object.entries(
      node as Record<
        string,
        unknown
      >
    )) {
      if (
        wanted.has(
          key.toLowerCase()
        ) &&
        child !== null &&
        child !== undefined
      ) {
        const text =
          String(child).trim();

        if (text) {
          return text;
        }
      }

      const nested =
        visit(child);

      if (nested) {
        return nested;
      }
    }

    return '';
  };

  return visit(value);
}



function formatParatikaQueryDate(
  value: Date
) {
  const parts =
    new Intl.DateTimeFormat(
      'en-GB',
      {
        timeZone:
          'Europe/Istanbul',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }
    ).formatToParts(value);

  const map = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ])
  );

  return `${map.day}-${map.month}-${map.year} ${map.hour}:${map.minute}`;
}

function extractPayByLinkToken(
  data: any,
  amount: number,
  customerEmail: string
) {
  const list =
    Array.isArray(
      data?.payByLinkPaymentList
    )
      ? data.payByLinkPaymentList
      : Array.isArray(
          data?.PAYBYLINKPAYMENTLIST
        )
      ? data.PAYBYLINKPAYMENTLIST
      : [];

  const normalizedEmail =
    customerEmail
      .trim()
      .toLowerCase();

  const candidates = list
    .map((item: any) => ({
      token: String(
        item?.token ??
          item?.payByLinkToken ??
          item?.PAYBYLINKTOKEN ??
          ''
      ).trim(),
      amount: Number(
        item?.amount ?? NaN
      ),
      email: String(
        item?.cardHolderEmail ??
          item?.customerEmail ??
          ''
      )
        .trim()
        .toLowerCase(),
      createdTs: String(
        item?.createdTs ??
          item?.createdAt ??
          ''
      ).trim(),
    }))
    .filter(
      (item: any) =>
        item.token &&
        (
          !Number.isFinite(
            item.amount
          ) ||
          Math.abs(
            item.amount - amount
          ) < 0.001
        ) &&
        (
          !item.email ||
          item.email ===
            normalizedEmail
        )
    )
    .sort(
      (a: any, b: any) =>
        String(
          b.createdTs
        ).localeCompare(
          String(a.createdTs)
        )
    );

  return (
    candidates[0]?.token || ''
  );
}

async function savePayment(
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

    status:
      | 'SENT'
      | 'LINK_CREATED';

    responseCode: string;
    responseMsg: string;

    rawCreateResponse: unknown;
  }
) {
  const result =
    await client.query(
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
          $11::varchar, $11::varchar, $12::varchar, $13::text,
          NOW(),
          CASE
            WHEN $11::text = 'SENT'
            THEN NOW()
            ELSE NULL
          END,
          $14::jsonb,
          $14::jsonb,
          NOW()
        )
        RETURNING *
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

        input.status,
        input.responseCode ||
          null,
        input.responseMsg ||
          null,

        JSON.stringify(
          safeJson(
            input.rawCreateResponse
          )
        ),
      ]
    );

  const payment =
    result.rows[0];

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
        $2,
        'PANEL',
        NULL,
        $3,
        $4::jsonb
      )
    `,
    [
      payment.id,
      input.status === 'SENT'
        ? 'PAYMENT_LINK_CREATED_SMS_REQUESTED'
        : 'PAYMENT_SESSION_CREATED',
      input.status,
      JSON.stringify({
        merchantPaymentId:
          input.merchantPaymentId,
        branchCode:
          input.branchCode,
        createdByUserId:
          input.createdByUserId,
        amount:
          input.amount,
        installmentCount:
          input.installmentCount,
      }),
    ]
  );

  return payment;
}

export async function POST(
  request: NextRequest
) {
  const startedAt = Date.now();

  try {
    if (!sameOrigin(request)) {
      return noStoreJson(
        {
          success: false,
          error:
            'Geçersiz istek kaynağı.',
        },
        403
      );
    }

    const auth =
      requireSession(request);

    if (!auth.ok) {
      return auth.response;
    }

    const body =
      await request
        .json()
        .catch(() => ({}));

    const amount =
      parseAmount(
        body?.amount
      );

    const customerName =
      String(
        body?.customerName || ''
      ).trim();

    const customerEmail =
      String(
        body?.customerEmail || ''
      )
        .trim()
        .toLowerCase();

    const customerPhone =
      normalizePhone(
        body?.customerPhone
      );

    const installmentCount =
      Number(
        body?.installmentCount
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            'Geçerli bir tutar girin.',
        },
        400
      );
    }

    if (
      amount > 10_000_000
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            'Tutar güvenlik sınırını aşıyor.',
        },
        400
      );
    }

    if (
      customerName.length < 3 ||
      customerName.length > 128
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            'Müşteri ad soyad bilgisi geçersiz.',
        },
        400
      );
    }

    if (
      !customerEmail ||
      customerEmail.length > 64 ||
      !validEmail(
        customerEmail
      )
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            'Geçerli bir e-posta adresi girin.',
        },
        400
      );
    }

    if (
      customerPhone.length !== 12 ||
      !customerPhone.startsWith(
        '905'
      )
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
      !Number.isInteger(
        installmentCount
      ) ||
      installmentCount < 2 ||
      installmentCount > 12
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            'Taksit sayısı 2 ile 12 arasında olmalıdır.',
        },
        400
      );
    }

    const config =
      getParatikaConfig();

    const merchantPaymentId =
      createMerchantPaymentId();

    const customerCode =
      createCustomerCode(
        customerPhone,
        customerEmail
      );

    const returnUrl =
      getReturnUrl(request);

    //
    // ADIM 1
    // PayByLink kaydını, seçilen taksit kuralı ile oluştur.
    //
    // Paratika desteğinin verdiği format:
    // - CR1..CR24 tamamı gönderilir.
    // - CONSUMER + BUSINESS tamamı gönderilir.
    // - Sadece panelde seçilen CR active=true olur.
    // - Diğer CR kayıtları active=false olur.
    // - active BOOLEAN'dır.
    // - encryptable=false gönderilir.
    //
    // NOTIFICATIONCHANNELS burada yok.
    // SMS'i daha sonra aynı PayByLink kaydı için RESEND ile tetikliyoruz.
    //
    const installmentSupport =
      buildInstallmentSupport(
        installmentCount
      );

    const payByLinkParams =
      new URLSearchParams();

    payByLinkParams.set(
      'ACTION',
      'PAYBYLINKPAYMENT'
    );

    payByLinkParams.set(
      'MERCHANT',
      config.merchant
    );

    payByLinkParams.set(
      'MERCHANTUSER',
      config.merchantUser
    );

    payByLinkParams.set(
      'MERCHANTPASSWORD',
      config.merchantPassword
    );

    payByLinkParams.set(
      'SESSIONTYPE',
      'PAYMENTSESSION'
    );

    payByLinkParams.set(
      'SESSIONEXPIRY',
      '168h'
    );

    payByLinkParams.set(
      'MERCHANTPAYMENTID',
      merchantPaymentId
    );

    payByLinkParams.set(
      'AMOUNT',
      amount.toFixed(2)
    );

    payByLinkParams.set(
      'CURRENCY',
      'TRY'
    );

    payByLinkParams.set(
      'CUSTOMER',
      customerCode
    );

    payByLinkParams.set(
      'CUSTOMERNAME',
      customerName
    );

    payByLinkParams.set(
      'CUSTOMEREMAIL',
      customerEmail
    );

    payByLinkParams.set(
      'CUSTOMERPHONE',
      customerPhone
    );

    payByLinkParams.set(
      'LANGUAGE',
      'tr'
    );

    payByLinkParams.set(
      'RETURNURL',
      returnUrl
    );

    // QUERYPAYBYLINKPAYMENT tarafında bu kaydı güvenli biçimde
    // filtreleyebilmek için tekil merchant note kullanıyoruz.
    // MERCHANTNOTE max 50 karakter; merchantPaymentId bu sınırın altında.
    payByLinkParams.set(
      'MERCHANTNOTE',
      merchantPaymentId
    );

    // Paratika desteği bu parametrenin encode edilmesini istedi.
    // URLSearchParams + params.toString() bunu form-urlencoded olarak
    // tek kez encode eder. Burada ayrıca encodeURIComponent kullanmıyoruz.
    payByLinkParams.set(
      'INSTALLMENTSUPPORT',
      installmentSupport
    );

    const payByLinkResult =
      await postParatika(
        config,
        payByLinkParams
      );

    const payByLinkCode =
      paratikaField(
        payByLinkResult.data,
        'responseCode',
        'RESPONSECODE'
      );

    const payByLinkMsg =
      paratikaField(
        payByLinkResult.data,
        'responseMsg',
        'RESPONSEMSG'
      );

    const payByLinkSessionToken =
      paratikaField(
        payByLinkResult.data,
        'sessionToken',
        'SESSIONTOKEN'
      ).trim();

    if (
      !payByLinkResult.response.ok ||
      payByLinkCode !== '00' ||
      !payByLinkSessionToken
    ) {
      return noStoreJson(
        {
          success: false,
          channel: 'PARATIKA',
          stage: 'PAYBYLINK_CREATE',
          message:
            payByLinkMsg ||
            'Paratika PayByLink kaydı oluşturulamadı.',
          responseCode:
            payByLinkCode || null,
          responseMsg:
            payByLinkMsg || null,
          errorCode:
            paratikaField(
              payByLinkResult.data,
              'errorCode',
              'ERRORCODE'
            ) || null,
          errorDetail:
            paratikaField(
              payByLinkResult.data,
              'errorMsg',
              'ERRORMSG',
              'error',
              'ERROR'
            ) || null,
          violatorParam:
            paratikaField(
              payByLinkResult.data,
              'violatorParam',
              'VIOLATORPARAM'
            ) || null,
          merchantPaymentId,
          paratikaResponse:
            payByLinkResult.data,
        },
        payByLinkResult.response.ok
          ? 400
          : 502
      );
    }

    //
    // ADIM 2
    // PayByLink oluşturulurken INSTALLMENTSUPPORT zaten uygulandı.
    // Bu nedenle ayrıca SESSIONTOKEN + ALLOWEDINSTALLMENTS ile ikinci
    // bir taksit güncellemesi yapmıyoruz.
    //
    // Böylece:
    // - çalışan PayByLink session'ını değiştirmiyoruz,
    // - farklı session token riski oluşturmuyoruz,
    // - Paratika desteğinin verdiği resmi INSTALLMENTSUPPORT formatını
    //   doğrudan ödeme linki oluşturulurken kullanıyoruz.
    //
    const sessionToken =
      payByLinkSessionToken;

    const sessionCode =
      payByLinkCode;

    const sessionMsg =
      payByLinkMsg;

    const paymentUrl =
      buildPaymentUrl(
        config.baseUrl,
        sessionToken
      );

    //
    // ADIM 3
    // PayByLink token'ını bul.
    //
    const queryParams =
      new URLSearchParams();

    queryParams.set(
      'ACTION',
      'QUERYPAYBYLINKPAYMENT'
    );

    queryParams.set(
      'MERCHANT',
      config.merchant
    );

    queryParams.set(
      'MERCHANTUSER',
      config.merchantUser
    );

    queryParams.set(
      'MERCHANTPASSWORD',
      config.merchantPassword
    );

    // Bu canlı hesapta SESSIONTOKEN tek başına sorgu filtresi olarak
    // kabul edilmiyor ve PAYBYLINKTOKEN istiyor. Dokümante edilen diğer
    // sorgu yolu olan tarih aralığı + MERCHANTNOTE ile kaydı buluyoruz.
    const queryNow =
      new Date();

    const queryStart =
      new Date(
        queryNow.getTime() -
          5 * 60 * 1000
      );

    const queryEnd =
      new Date(
        queryNow.getTime() +
          5 * 60 * 1000
      );

    queryParams.set(
      'STARTDATE',
      formatParatikaQueryDate(
        queryStart
      )
    );

    queryParams.set(
      'ENDDATE',
      formatParatikaQueryDate(
        queryEnd
      )
    );

    queryParams.set(
      'MERCHANTNOTE',
      merchantPaymentId
    );

    queryParams.set(
      'CUSTOMEREMAIL',
      customerEmail
    );

    const queryResult =
      await postParatika(
        config,
        queryParams
      );

    const queryCode =
      paratikaField(
        queryResult.data,
        'responseCode',
        'RESPONSECODE'
      );

    let payByLinkToken =
      findDeepStringByKeys(
        payByLinkResult.data,
        [
          'payByLinkToken',
          'PAYBYLINKTOKEN',
        ]
      );

    if (!payByLinkToken) {
      payByLinkToken =
        extractPayByLinkToken(
          queryResult.data,
          amount,
          customerEmail
        );
    }

    if (!payByLinkToken) {
      payByLinkToken =
        findDeepStringByKeys(
          queryResult.data,
          [
            'payByLinkToken',
            'PAYBYLINKTOKEN',
            'token',
          ]
        );
    }

    if (
      !queryResult.response.ok ||
      (
        queryCode &&
        queryCode !== '00'
      ) ||
      !payByLinkToken
    ) {
      return noStoreJson(
        {
          success: false,
          channel: 'PARATIKA',
          stage:
            'QUERYPAYBYLINKPAYMENT',
          message:
            'PayByLink oluşturuldu fakat SMS için PAYBYLINKTOKEN alınamadı.',
          responseCode:
            queryCode || null,
          errorCode:
            paratikaField(
              queryResult.data,
              'errorCode',
              'ERRORCODE'
            ) || null,
          errorDetail:
            paratikaField(
              queryResult.data,
              'errorMsg',
              'ERRORMSG',
              'error',
              'ERROR'
            ) || null,
          merchantPaymentId,
          sessionToken,
          selectedInstallment:
            installmentCount,
          queryFilters: {
            startDate:
              formatParatikaQueryDate(
                queryStart
              ),
            endDate:
              formatParatikaQueryDate(
                queryEnd
              ),
            merchantNote:
              merchantPaymentId,
            customerEmail,
          },
          queryResponse:
            queryResult.data,
        },
        400
      );
    }

    //
    // ADIM 4
    // SMS'i Paratika'nın kendi RESEND aksiyonu ile gönder.
    //
    const resendParams =
      new URLSearchParams();

    resendParams.set(
      'ACTION',
      'PAYBYLINKPAYMENTRESEND'
    );

    resendParams.set(
      'MERCHANT',
      config.merchant
    );

    resendParams.set(
      'MERCHANTUSER',
      config.merchantUser
    );

    resendParams.set(
      'MERCHANTPASSWORD',
      config.merchantPassword
    );

    resendParams.set(
      'PAYBYLINKTOKEN',
      payByLinkToken
    );

    resendParams.set(
      'NOTIFICATIONCHANNELS',
      'SMS'
    );

    const resendResult =
      await postParatika(
        config,
        resendParams
      );

    const resendCode =
      paratikaField(
        resendResult.data,
        'responseCode',
        'RESPONSECODE'
      );

    const resendMsg =
      paratikaField(
        resendResult.data,
        'responseMsg',
        'RESPONSEMSG'
      );

    const smsAccepted =
      resendResult.response.ok &&
      resendCode === '00';

    const smsSessionMismatch =
      false;

    const dbStatus:
      | 'SENT'
      | 'LINK_CREATED' =
      smsAccepted
        ? 'SENT'
        : 'LINK_CREATED';

    const rawUserId =
      auth.session.userId;

    const safeCreatedByUserId =
      typeof rawUserId === 'number' &&
      Number.isFinite(rawUserId) &&
      Number.isInteger(rawUserId)
        ? rawUserId
        : null;

    const pool = getPool();
    const client =
      await pool.connect();

    let savedPayment: any = null;

    try {
      await client.query('BEGIN');

      savedPayment =
        await savePayment(
          client,
          {
            merchantPaymentId,
            sessionToken,
            paymentUrl,

            branchCode:
              String(
                auth.session.branch ||
                  ''
              ).trim(),

            createdByUserId:
              safeCreatedByUserId,

            customerName,
            customerEmail,
            customerPhone,

            amount:
              Number(
                amount.toFixed(2)
              ),

            installmentCount,

            status:
              dbStatus,

            responseCode:
              smsAccepted
                ? resendCode
                : payByLinkCode,

            responseMsg:
              smsAccepted
                ? resendMsg
                : payByLinkMsg,

            rawCreateResponse: {
              session:
                payByLinkResult.data,
              payByLink:
                payByLinkResult.data,
              installmentSupport: {
                selectedInstallment:
                  installmentCount,
                source:
                  'PARATIKA_SUPPORT',
                consumerAndBusiness:
                  true,
                crRange:
                  'CR1-CR24',
              },
              queryPayByLink:
                queryResult.data,
              resend:
                resendResult.data,
              payByLinkToken,
              selectedInstallment:
                installmentCount,
            },
          }
        );

      await client.query(
        'COMMIT'
      );
    } catch (dbError) {
      try {
        await client.query(
          'ROLLBACK'
        );
      } catch {}

      console.error(
        'PARATIKA SESSION OLUŞTU AMA DB KAYDI BAŞARISIZ:',
        {
          merchantPaymentId,
          dbError,
        }
      );

      const pgError =
        dbError as {
          message?: string;
          code?: string;
          detail?: string;
          constraint?: string;
          column?: string;
          table?: string;
        };

      return noStoreJson(
        {
          success: false,
          paratikaLinkCreated:
            true,
          databaseSaved: false,
          channel: 'PARATIKA',
          message:
            'Paratika ödeme oturumu oluştu fakat PostgreSQL kaydı yapılamadı. Aynı ödemeyi tekrar oluşturmayın.',
          merchantPaymentId,
          sessionToken,
          paymentUrl,
          selectedInstallment:
            installmentCount,

          // Secret içermez. DB şema/constraint hatasını net görmek için.
          databaseError:
            pgError?.message ||
            'Bilinmeyen PostgreSQL hatası',
          databaseCode:
            pgError?.code || null,
          databaseDetail:
            pgError?.detail || null,
          databaseConstraint:
            pgError?.constraint ||
            null,
          databaseColumn:
            pgError?.column || null,
          databaseTable:
            pgError?.table || null,
        },
        500
      );
    } finally {
      client.release();
    }

    if (!smsAccepted) {
      return noStoreJson(
        {
          success: true,
          databaseSaved: true,
          channel: 'PARATIKA',

          warning: true,
          smsSent: false,

          message:
            smsSessionMismatch
              ? 'Ödeme linki oluşturuldu ve seçilen taksit kilitlendi; ancak Paratika SMS isteğinde farklı session token döndürdüğü için SMS güvenli kabul edilmedi.'
              : 'Ödeme linki oluşturuldu ve seçilen taksit kilitlendi; ancak Paratika SMS bildirimi onaylanmadı.',

          id:
            savedPayment.id,

          merchantPaymentId,
          sessionToken,
          paymentUrl,

          amount:
            Number(
              amount.toFixed(2)
            ),

          currency: 'TRY',

          customerName,
          customerEmail,
          customerPhone,

          installmentCount,

          status:
            'LINK_CREATED',

          sessionResponseCode:
            sessionCode,

          payByLinkResponseCode:
            payByLinkCode || null,

          smsResponseCode:
            resendCode || null,

          smsResponseMsg:
            resendMsg || null,

          smsErrorCode:
            paratikaField(
              resendResult.data,
              'errorCode',
              'ERRORCODE'
            ) || null,

          smsErrorDetail:
            paratikaField(
              resendResult.data,
              'errorMsg',
              'ERRORMSG',
              'error',
              'ERROR'
            ) || null,

          smsSessionMismatch,

          responseTimeMs:
            Date.now() -
            startedAt,
        }
      );
    }

    return noStoreJson({
      success: true,
      databaseSaved: true,
      channel: 'PARATIKA',

      message:
        'Ödeme linki oluşturuldu, seçilen taksit kilitlendi ve SMS talebi Paratika tarafından onaylandı.',

      id:
        savedPayment.id,

      merchantPaymentId,
      sessionToken,
      payByLinkToken:
        payByLinkToken ||
        null,

      paymentUrl,

      amount:
        Number(
          amount.toFixed(2)
        ),

      currency: 'TRY',

      customerName,
      customerEmail,
      customerPhone,

      installmentCount,

      status: 'SENT',
      smsSent: true,

      responseCode:
        resendCode,

      responseMsg:
        resendMsg,

      expiresIn: '168h',

      responseTimeMs:
        Date.now() -
        startedAt,

      createdAt:
        new Date().toISOString(),
    });
  } catch (error: any) {
    const isAbort =
      error?.name ===
        'AbortError' ||
      String(
        error?.message || ''
      )
        .toLowerCase()
        .includes('aborted');

    console.error(
      'PARATIKA PAYMENT LINK ERROR:',
      error
    );

    return noStoreJson(
      {
        success: false,
        channel: 'PARATIKA',
        error:
          isAbort
            ? 'Paratika bağlantısı zaman aşımına uğradı.'
            : error instanceof Error
            ? error.message
            : 'Paratika ödeme linki oluşturulamadı.',
      },
      isAbort ? 504 : 500
    );
  }
}
