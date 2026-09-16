// app/api/paratika/payment-link/route.ts
// CNETMOBIL - PARATIKA FINAL PAYMENT LINK
//
// Akış:
// 1) SESSIONTOKEN ile ödeme oturumu oluşturulur.
// 2) ALLOWEDINSTALLMENTS ile sadece panelde seçilen taksit açılır.
// 3) Aynı session token PAYBYLINKPAYMENT'e verilerek SMS bildirimi istenir.
// 4) İşlem PostgreSQL'e kaydedilir.
//
// Not:
// - Taksit 2..12
// - INSTALLMENTSUPPORT kullanılmaz.
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
          $11, $11, $12, $13,
          NOW(),
          CASE
            WHEN $12 = 'SENT'
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
    // SESSIONTOKEN + ALLOWEDINSTALLMENTS
    //
    const sessionParams =
      new URLSearchParams();

    sessionParams.set(
      'ACTION',
      'SESSIONTOKEN'
    );

    sessionParams.set(
      'MERCHANT',
      config.merchant
    );

    sessionParams.set(
      'MERCHANTUSER',
      config.merchantUser
    );

    sessionParams.set(
      'MERCHANTPASSWORD',
      config.merchantPassword
    );

    sessionParams.set(
      'SESSIONTYPE',
      'PAYMENTSESSION'
    );

    sessionParams.set(
      'SESSIONEXPIRY',
      '168h'
    );

    sessionParams.set(
      'MERCHANTPAYMENTID',
      merchantPaymentId
    );

    sessionParams.set(
      'AMOUNT',
      amount.toFixed(2)
    );

    sessionParams.set(
      'CURRENCY',
      'TRY'
    );

    sessionParams.set(
      'CUSTOMER',
      customerCode
    );

    sessionParams.set(
      'CUSTOMERNAME',
      customerName
    );

    sessionParams.set(
      'CUSTOMEREMAIL',
      customerEmail
    );

    sessionParams.set(
      'CUSTOMERPHONE',
      customerPhone
    );

    sessionParams.set(
      'LANGUAGE',
      'tr'
    );

    sessionParams.set(
      'RETURNURL',
      returnUrl
    );

    // Bu canlı merchant hesabında SESSIONTOKEN isteğinde ORDERITEMS
    // zorunlu dönüyor (ERR10010 / violatorParam=ORDERITEMS).
    // Tek ödeme kalemi gönderiyoruz ve toplamı AMOUNT ile birebir tutuyoruz.
    const orderItems = [
      {
        productCode: 'CNET-PARATIKA',
        name: 'CNETMOBIL Ödeme',
        description: `Paratika ödeme - ${installmentCount} taksit`,
        quantity: 1,
        amount: Number(amount.toFixed(2)),
      },
    ];

    sessionParams.set(
      'ORDERITEMS',
      JSON.stringify(orderItems)
    );

    // Sipariş kalemlerinin ödeme sayfasında ayrıca gösterilmesini istemiyoruz.
    sessionParams.set(
      'SHOWORDERDETAILS',
      'NO'
    );

    // Kritik:
    // Sadece panelde seçilen taksit.
    // Örnek: 2 seçildiyse "2".
    sessionParams.set(
      'ALLOWEDINSTALLMENTS',
      String(
        installmentCount
      )
    );

    const sessionResult =
      await postParatika(
        config,
        sessionParams
      );

    const sessionCode =
      paratikaField(
        sessionResult.data,
        'responseCode',
        'RESPONSECODE'
      );

    const sessionMsg =
      paratikaField(
        sessionResult.data,
        'responseMsg',
        'RESPONSEMSG'
      );

    const sessionToken =
      paratikaField(
        sessionResult.data,
        'sessionToken',
        'SESSIONTOKEN'
      ).trim();

    if (
      !sessionResult.response.ok ||
      sessionCode !== '00' ||
      !sessionToken
    ) {
      return noStoreJson(
        {
          success: false,
          channel: 'PARATIKA',
          stage: 'SESSIONTOKEN',
          message:
            sessionMsg ||
            'Paratika ödeme oturumu oluşturulamadı.',
          responseCode:
            sessionCode || null,
          responseMsg:
            sessionMsg || null,
          errorCode:
            paratikaField(
              sessionResult.data,
              'errorCode',
              'ERRORCODE'
            ) || null,
          errorDetail:
            paratikaField(
              sessionResult.data,
              'errorMsg',
              'ERRORMSG',
              'error',
              'ERROR'
            ) || null,
          violatorParam:
            paratikaField(
              sessionResult.data,
              'violatorParam',
              'VIOLATORPARAM'
            ) || null,
          merchantPaymentId,
          paratikaResponse:
            sessionResult.data,
          responseTimeMs:
            Date.now() -
            startedAt,
        },
        sessionResult.response.ok
          ? 400
          : 502
      );
    }

    const paymentUrl =
      buildPaymentUrl(
        config.baseUrl,
        sessionToken
      );

    //
    // ADIM 2
    // Aynı SESSIONTOKEN üzerinden PayByLink SMS bildirimi.
    //
    // Burada INSTALLMENTSUPPORT yok.
    // Taksit kuralı SESSIONTOKEN oluşturulurken
    // ALLOWEDINSTALLMENTS ile kilitlendi.
    //
    const smsParams =
      new URLSearchParams();

    smsParams.set(
      'ACTION',
      'PAYBYLINKPAYMENT'
    );

    smsParams.set(
      'MERCHANT',
      config.merchant
    );

    smsParams.set(
      'MERCHANTUSER',
      config.merchantUser
    );

    smsParams.set(
      'MERCHANTPASSWORD',
      config.merchantPassword
    );

    smsParams.set(
      'SESSIONTOKEN',
      sessionToken
    );

    smsParams.set(
      'SESSIONTYPE',
      'PAYMENTSESSION'
    );

    smsParams.set(
      'SESSIONEXPIRY',
      '168h'
    );

    smsParams.set(
      'MERCHANTPAYMENTID',
      merchantPaymentId
    );

    smsParams.set(
      'AMOUNT',
      amount.toFixed(2)
    );

    smsParams.set(
      'CURRENCY',
      'TRY'
    );

    smsParams.set(
      'CUSTOMER',
      customerCode
    );

    smsParams.set(
      'CUSTOMERNAME',
      customerName
    );

    smsParams.set(
      'CUSTOMEREMAIL',
      customerEmail
    );

    smsParams.set(
      'CUSTOMERPHONE',
      customerPhone
    );

    smsParams.set(
      'LANGUAGE',
      'tr'
    );

    smsParams.set(
      'RETURNURL',
      returnUrl
    );

    smsParams.set(
      'NOTIFICATIONCHANNELS',
      'SMS'
    );

    const smsResult =
      await postParatika(
        config,
        smsParams
      );

    const smsCode =
      paratikaField(
        smsResult.data,
        'responseCode',
        'RESPONSECODE'
      );

    const smsMsg =
      paratikaField(
        smsResult.data,
        'responseMsg',
        'RESPONSEMSG'
      );

    const smsSessionToken =
      paratikaField(
        smsResult.data,
        'sessionToken',
        'SESSIONTOKEN'
      ).trim();

    const payByLinkToken =
      paratikaField(
        smsResult.data,
        'payByLinkToken',
        'PAYBYLINKTOKEN'
      ).trim();

    const smsAccepted =
      smsResult.response.ok &&
      smsCode === '00' &&
      (
        !smsSessionToken ||
        smsSessionToken ===
          sessionToken
      );

    // Eğer Paratika farklı session token üretirse
    // bunu başarılı SMS olarak kabul etmiyoruz.
    // Çünkü farklı session taksit kuralını taşımayabilir.
    const smsSessionMismatch =
      Boolean(
        smsSessionToken &&
        smsSessionToken !==
          sessionToken
      );

    const dbStatus:
      | 'SENT'
      | 'LINK_CREATED' =
      smsAccepted
        ? 'SENT'
        : 'LINK_CREATED';

    const rawUserId =
      auth.session.userId;

    const normalizedUserId =
      rawUserId === null ||
      rawUserId === undefined ||
      rawUserId === ''
        ? null
        : Number(rawUserId);

    const safeCreatedByUserId =
      normalizedUserId !== null &&
      Number.isFinite(
        normalizedUserId
      ) &&
      Number.isInteger(
        normalizedUserId
      )
        ? normalizedUserId
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
                ? smsCode
                : sessionCode,

            responseMsg:
              smsAccepted
                ? smsMsg
                : sessionMsg,

            rawCreateResponse: {
              session:
                sessionResult.data,
              sms:
                smsResult.data,
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

          smsResponseCode:
            smsCode || null,

          smsResponseMsg:
            smsMsg || null,

          smsErrorCode:
            paratikaField(
              smsResult.data,
              'errorCode',
              'ERRORCODE'
            ) || null,

          smsErrorDetail:
            paratikaField(
              smsResult.data,
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
        smsCode,

      responseMsg:
        smsMsg,

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
