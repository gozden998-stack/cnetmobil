// app/api/paratika/return/route.ts
// CNETMOBIL - PARATIKA RETURN / CALLBACK
//
// Paratika, ödeme tamamlandıktan sonra RETURNURL adresine POST eder.
// Bu endpoint callback verisine KÖRÜ KÖRÜNE güvenmez.
// Önce yerel kaydı bulur, ardından Paratika API'ye QUERYTRANSACTION
// isteği atarak işlemi server-to-server doğrular.
// Sadece doğrulanmış başarılı işlem APPROVED yapılır.
//
// PUBLIC endpoint'tir: müşteri Paratika ödeme sayfasından buraya döner.
// Auth cookie beklenmez.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetParatikaReturnPool: Pool | undefined;
}

type ParatikaConfig = {
  merchant: string;
  merchantUser: string;
  merchantPassword: string;
  baseUrl: string;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetParatikaReturnPool) {
    global.cnetParatikaReturnPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetParatikaReturnPool;
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

  if (missing.length) {
    throw new Error(
      `Eksik environment variable: ${missing.join(', ')}`
    );
  }

  return {
    merchant,
    merchantUser,
    merchantPassword,
    baseUrl,
  };
}

function normalizeObjectKeys(input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    out[key] = value;
    out[key.toLowerCase()] = value;
  }

  return out;
}

async function readCallbackBody(request: NextRequest) {
  const contentType = String(
    request.headers.get('content-type') || ''
  ).toLowerCase();

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));

    return normalizeObjectKeys(
      body && typeof body === 'object'
        ? (body as Record<string, unknown>)
        : {}
    );
  }

  const text = await request.text();

  const params = new URLSearchParams(text);
  const body: Record<string, unknown> = {};

  params.forEach((value, key) => {
    body[key] = value;
  });

  return normalizeObjectKeys(body);
}

function getString(
  obj: Record<string, unknown>,
  ...keys: string[]
) {
  for (const key of keys) {
    const value =
      obj[key] ??
      obj[key.toLowerCase()];

    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ''
    ) {
      return String(value).trim();
    }
  }

  return '';
}

function safeJson(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value ?? null));
  } catch {
    return null;
  }
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

async function queryTransaction(
  config: ParatikaConfig,
  merchantPaymentId: string
) {
  const params = new URLSearchParams();

  params.set('ACTION', 'QUERYTRANSACTION');
  params.set('MERCHANT', config.merchant);
  params.set('MERCHANTUSER', config.merchantUser);
  params.set('MERCHANTPASSWORD', config.merchantPassword);
  params.set('MERCHANTPAYMENTID', merchantPaymentId);
  params.set('LIMIT', '50');
  params.set('OFFSET', '0');

  return postParatika(config, params);
}

async function queryMerchantReconciliation(
  config: ParatikaConfig,
  pgTranId: string,
  pgOrderId: string,
  approvalCode: string
) {
  const params = new URLSearchParams();

  params.set(
    'ACTION',
    'QUERYMERCHANTRECONCILIATION'
  );
  params.set(
    'MERCHANT',
    config.merchant
  );
  params.set(
    'MERCHANTUSER',
    config.merchantUser
  );
  params.set(
    'MERCHANTPASSWORD',
    config.merchantPassword
  );
  params.set('LIMIT', '50');
  params.set('OFFSET', '0');

  if (pgTranId) {
    params.set(
      'TRANSACTIONID',
      pgTranId
    );
  } else if (pgOrderId) {
    params.set(
      'ORDERID',
      pgOrderId
    );
  } else if (approvalCode) {
    params.set(
      'APPROVALCODE',
      approvalCode
    );
  } else {
    return null;
  }

  return postParatika(
    config,
    params
  );
}

function selectMerchantRecon(
  data: any,
  pgTranId: string,
  pgOrderId: string
) {
  const list = Array.isArray(
    data?.reconcilationReportMerchant
  )
    ? data.reconcilationReportMerchant
    : [];

  if (!list.length) {
    return null;
  }

  return (
    list.find(
      (item: any) =>
        pgTranId &&
        String(
          item?.pgTranId || ''
        ) === pgTranId
    ) ||
    list.find(
      (item: any) =>
        pgOrderId &&
        String(
          item?.pgOrderId || ''
        ) === pgOrderId
    ) ||
    list[0]
  );
}


function pickApprovedTransaction(data: any) {
  const list = Array.isArray(data?.transactionList)
    ? data.transactionList
    : [];

  const approved = list.filter((item: any) => {
    const status = String(
      item?.transactionStatus || ''
    ).toUpperCase();

    const returnCode = String(
      item?.pgTranReturnCode ?? ''
    );

    const type = String(
      item?.transactionType || ''
    ).toUpperCase();

    return (
      status === 'AP' &&
      returnCode === '00' &&
      (type === 'SALE' || type === '')
    );
  });

  if (!approved.length) return null;

  // Aynı MerchantPaymentID altında birden çok başarılı kayıt varsa
  // en yeni kaydı tercih et.
  approved.sort((a: any, b: any) => {
    const aTime = String(
      a?.timePsReceived ||
        a?.timeCreated ||
        a?.timePsSent ||
        ''
    );
    const bTime = String(
      b?.timePsReceived ||
        b?.timeCreated ||
        b?.timePsSent ||
        ''
    );

    return bTime.localeCompare(aTime);
  });

  return approved[0];
}

function parseParatikaDate(value: unknown): Date | null {
  if (
    typeof value === 'number' &&
    Number.isFinite(value)
  ) {
    const epochDate =
      new Date(value);

    return Number.isNaN(
      epochDate.getTime()
    )
      ? null
      : epochDate;
  }

  const raw =
    String(value || '').trim();

  if (!raw) return null;

  if (/^\d{12,13}$/.test(raw)) {
    const epochDate =
      new Date(Number(raw));

    return Number.isNaN(
      epochDate.getTime()
    )
      ? null
      : epochDate;
  }

  // Callback örneği: 20170113 12:20:35
  const compact = raw.match(
    /^(\d{4})(\d{2})(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );

  if (compact) {
    const [, y, m, d, hh, mm, ss] = compact;

    const parsed = new Date(
      `${y}-${m}-${d}T${hh}:${mm}:${ss}+03:00`
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  // QUERYTRANSACTION örneği: 2018-10-12 14:16:27.967
  const sqlLike = raw.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(\.\d+)?$/
  );

  if (sqlLike) {
    const [, y, m, d, hh, mm, ss, fraction = ''] = sqlLike;

    const parsed = new Date(
      `${y}-${m}-${d}T${hh}:${mm}:${ss}${fraction}+03:00`
    );

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(raw);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function amountMatches(
  storedAmount: unknown,
  transactionAmount: unknown
) {
  const a = Number(storedAmount);
  const b = Number(transactionAmount);

  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return false;
  }

  return Math.abs(a - b) < 0.01;
}

async function addEvent(
  client: PoolClient,
  paymentId: number,
  eventType: string,
  oldStatus: string | null,
  newStatus: string | null,
  detail: unknown
) {
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
        'PARATIKA',
        $3,
        $4,
        $5::jsonb
      )
    `,
    [
      paymentId,
      eventType,
      oldStatus,
      newStatus,
      JSON.stringify(safeJson(detail)),
    ]
  );
}

function resultHtml(
  success: boolean,
  title: string,
  message: string
) {
  const accent = success ? '#059669' : '#dc2626';
  const bg = success ? '#ecfdf5' : '#fef2f2';
  const symbol = success ? '✓' : '!';

  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    *{box-sizing:border-box}
    body{
      margin:0;
      min-height:100vh;
      display:flex;
      align-items:center;
      justify-content:center;
      background:#f5f8fc;
      font-family:Arial,Helvetica,sans-serif;
      color:#0f172a;
      padding:20px;
    }
    .card{
      width:100%;
      max-width:520px;
      background:#fff;
      border:1px solid #e2e8f0;
      border-radius:24px;
      padding:32px;
      box-shadow:0 18px 50px rgba(15,23,42,.08);
      text-align:center;
    }
    .icon{
      width:68px;height:68px;
      display:flex;
      align-items:center;
      justify-content:center;
      margin:0 auto 18px;
      border-radius:50%;
      background:${bg};
      color:${accent};
      font-size:36px;
      font-weight:900;
    }
    h1{margin:0;font-size:24px;color:#102a56}
    p{margin:14px 0 0;line-height:1.6;color:#64748b}
    .brand{
      margin-top:24px;
      padding-top:18px;
      border-top:1px solid #e2e8f0;
      font-size:12px;
      font-weight:800;
      color:#94a3b8;
      letter-spacing:.08em;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${symbol}</div>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    <div class="brand">CNETMOBİL • PARATİKA</div>
  </div>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function htmlResponse(
  success: boolean,
  title: string,
  message: string,
  status = 200
) {
  return new NextResponse(
    resultHtml(success, title, message),
    {
      status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
      },
    }
  );
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  let callbackBody: Record<string, unknown> = {};

  try {
    callbackBody = await readCallbackBody(request);

    const merchantPaymentId = getString(
      callbackBody,
      'merchantPaymentId',
      'MERCHANTPAYMENTID'
    );

    const callbackSessionToken = getString(
      callbackBody,
      'sessionToken',
      'SESSIONTOKEN'
    );

    const callbackResponseCode = getString(
      callbackBody,
      'responseCode',
      'RESPONSECODE'
    );

    const callbackResponseMsg = getString(
      callbackBody,
      'responseMsg',
      'RESPONSEMSG'
    );

    const callbackPgTranId = getString(
      callbackBody,
      'pgTranId',
      'PGTRANID',
      'pgTransactionId',
      'PGTRANSACTIONID'
    );

    if (!merchantPaymentId && !callbackSessionToken) {
      console.error(
        'PARATIKA RETURN: merchantPaymentId/sessionToken yok',
        callbackBody
      );

      return htmlResponse(
        false,
        'Ödeme sonucu alınamadı',
        'İşlem bilgileri doğrulanamadı. Lütfen mağaza personeli ile iletişime geçin.',
        400
      );
    }

    const pool = getPool();

    const paymentResult = await pool.query(
      `
        SELECT
          id,
          merchant_payment_id,
          session_token,
          branch_code,
          amount,
          currency,
          installment_count,
          status,
          pg_tran_id
        FROM public.paratika_payments
        WHERE
          (
            $1 <> ''
            AND merchant_payment_id = $1
          )
          OR
          (
            $2 <> ''
            AND session_token = $2
          )
        ORDER BY id DESC
        LIMIT 1
      `,
      [
        merchantPaymentId,
        callbackSessionToken,
      ]
    );

    const payment = paymentResult.rows[0];

    if (!payment) {
      console.error(
        'PARATIKA RETURN: yerel kayıt bulunamadı',
        {
          merchantPaymentId,
          callbackSessionToken,
        }
      );

      return htmlResponse(
        false,
        'Ödeme kaydı bulunamadı',
        'Ödeme sonucu alındı ancak CNETMOBİL kaydı bulunamadı. Lütfen mağaza personeli ile iletişime geçin.',
        404
      );
    }

    // Callback'teki token varsa yereldeki token ile eşleşmek zorunda.
    if (
      callbackSessionToken &&
      payment.session_token &&
      callbackSessionToken !== payment.session_token
    ) {
      console.error(
        'PARATIKA RETURN: session token uyuşmazlığı',
        {
          paymentId: payment.id,
          merchantPaymentId: payment.merchant_payment_id,
        }
      );

      return htmlResponse(
        false,
        'Ödeme doğrulanamadı',
        'Güvenlik doğrulaması başarısız oldu.',
        400
      );
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await addEvent(
        client,
        Number(payment.id),
        'RETURN_RECEIVED',
        String(payment.status || ''),
        String(payment.status || ''),
        {
          callback: safeJson(callbackBody),
          receivedAt: new Date().toISOString(),
        }
      );

      await client.query('COMMIT');
    } catch (eventError) {
      try {
        await client.query('ROLLBACK');
      } catch {}

      console.error(
        'PARATIKA RETURN EVENT LOG ERROR:',
        eventError
      );
    } finally {
      client.release();
    }

    // ===============================================
    // SERVER-TO-SERVER DOĞRULAMA
    // Callback tek başına APPROVED yapamaz.
    // ===============================================
    const config = getParatikaConfig();

    const query = await queryTransaction(
      config,
      String(payment.merchant_payment_id)
    );

    const queryResponseCode = String(
      query.data?.responseCode ?? ''
    );

    const verifiedTransaction =
      query.response.ok &&
      queryResponseCode === '00'
        ? pickApprovedTransaction(query.data)
        : null;

    const verified =
      Boolean(verifiedTransaction) &&
      amountMatches(
        payment.amount,
        verifiedTransaction?.amount
      ) &&
      String(
        verifiedTransaction?.currency || ''
      ).toUpperCase() ===
        String(payment.currency || '').toUpperCase();

    if (verified && verifiedTransaction) {
      const pgTranId = String(
        verifiedTransaction?.pgTranId ||
          callbackPgTranId ||
          ''
      ).trim();

      const pgTranRefId = String(
        verifiedTransaction?.pgTranRefId ||
          getString(
            callbackBody,
            'pgTranRefId',
            'PGTRANREFID'
          ) ||
          ''
      ).trim();

      const pgOrderId = String(
        verifiedTransaction?.pgOrderId ||
          getString(
            callbackBody,
            'pgOrderId',
            'PGORDERID'
          ) ||
          ''
      ).trim();

      const approvalCode = String(
        verifiedTransaction?.pgTranApprCode ||
          getString(
            callbackBody,
            'pgTranApprCode',
            'PGTRANAPPRCODE',
            'approvalCode',
            'APPROVALCODE'
          ) ||
          ''
      ).trim();

      const issuer = String(
        verifiedTransaction?.issuer ||
          verifiedTransaction?.paymentSystem ||
          verifiedTransaction?.paymentSystemType ||
          ''
      ).trim();

      const numberOfInstallments = Number(
        verifiedTransaction?.installmentCount ||
          getString(
            callbackBody,
            'installment',
            'INSTALLMENT',
            'installmentCount',
            'INSTALLMENTCOUNT'
          ) ||
          payment.installment_count ||
          0
      );

      const reconciliationQuery =
        await queryMerchantReconciliation(
          config,
          pgTranId,
          pgOrderId,
          approvalCode
        );

      const reconciliationData =
        reconciliationQuery?.data ??
        null;

      const reconciliationItem =
        reconciliationData
          ? selectMerchantRecon(
              reconciliationData,
              pgTranId,
              pgOrderId
            )
          : null;

      // ÖSN için Paratika mutabakatındaki
      // pgOrderId öncelikli.
      const exactPgOrderId =
        String(
          reconciliationItem
            ?.pgOrderId ||
            pgOrderId ||
            ''
        ).trim();

      // ÜÖT = Üye İşyeri Ödeme Tarihi.
      const merchantPaymentDate =
        parseParatikaDate(
          reconciliationItem
            ?.merchantPaymentDate
        );

      const updateClient = await pool.connect();

      try {
        await updateClient.query('BEGIN');

        const lockedResult = await updateClient.query(
          `
            SELECT
              id,
              status
            FROM public.paratika_payments
            WHERE id = $1
            FOR UPDATE
          `,
          [payment.id]
        );

        const locked = lockedResult.rows[0];

        if (!locked) {
          throw new Error(
            'Paratika ödeme kaydı güncelleme sırasında bulunamadı.'
          );
        }

        const oldStatus = String(
          locked.status || ''
        );

        await updateClient.query(
          `
            UPDATE public.paratika_payments
            SET
              status = 'APPROVED',
              paratika_status = $2,

              response_code = $3,
              response_msg = $4,

              pg_tran_id = NULLIF($5, ''),
              pg_tran_ref_id = NULLIF($6, ''),
              pg_order_id = NULLIF($7, ''),
              approval_code = NULLIF($8, ''),
              issuer = NULLIF($9, ''),

              number_of_installments =
                CASE
                  WHEN $10::int > 0 THEN $10::int
                  ELSE number_of_installments
                END,

              approved_at =
                COALESCE(approved_at, NOW()),

              paratika_payment_date =
                COALESCE(
                  $11::timestamptz,
                  paratika_payment_date
                ),

              last_synced_at = NOW(),
              raw_last_response = $12::jsonb

            WHERE id = $1
          `,
          [
            payment.id,
            String(
              verifiedTransaction?.transactionStatus ||
                'AP'
            ),
            callbackResponseCode ||
              queryResponseCode ||
              '00',
            callbackResponseMsg ||
              String(query.data?.responseMsg || 'Approved'),
            pgTranId,
            pgTranRefId,
            exactPgOrderId,
            approvalCode,
            issuer,
            Number.isInteger(numberOfInstallments)
              ? numberOfInstallments
              : 0,
            merchantPaymentDate
              ? merchantPaymentDate.toISOString()
              : null,
            JSON.stringify(
              safeJson({
                callback:
                  callbackBody,
                queryTransaction:
                  query.data,
                merchantReconciliation:
                  reconciliationData,
              })
            ),
          ]
        );

        if (oldStatus !== 'APPROVED') {
          await addEvent(
            updateClient,
            Number(payment.id),
            'PAYMENT_APPROVED',
            oldStatus,
            'APPROVED',
            {
              merchantPaymentId:
                payment.merchant_payment_id,
              pgTranId,
              pgTranRefId,
              pgOrderId,
              approvalCode,
              issuer,
              installmentCount:
                Number.isInteger(numberOfInstallments)
                  ? numberOfInstallments
                  : null,
              paymentDate:
                paymentDate.toISOString(),
              verifiedBy:
                'QUERYTRANSACTION',
            }
          );
        }

        await updateClient.query('COMMIT');
      } catch (updateError) {
        try {
          await updateClient.query('ROLLBACK');
        } catch {}

        throw updateError;
      } finally {
        updateClient.release();
      }

      console.info('PARATIKA PAYMENT APPROVED', {
        paymentId: payment.id,
        merchantPaymentId:
          payment.merchant_payment_id,
        pgTranId,
        durationMs: Date.now() - startedAt,
      });

      return htmlResponse(
        true,
        'Ödemeniz başarıyla alındı',
        'Ödeme işleminiz onaylandı. Mağaza personelimiz sistem üzerinden ödemenizi görebilir.'
      );
    }

    // ===============================================
    // DOĞRULANAMAYAN CALLBACK
    // Sahte/erken/gecikmiş callback APPROVED yapamaz.
    // Mevcut durum korunur; sadece log ve son cevap saklanır.
    // ===============================================
    const failedClient = await pool.connect();

    try {
      await failedClient.query('BEGIN');

      await failedClient.query(
        `
          UPDATE public.paratika_payments
          SET
            response_code =
              COALESCE(NULLIF($2, ''), response_code),
            response_msg =
              COALESCE(NULLIF($3, ''), response_msg),
            last_synced_at = NOW(),
            raw_last_response = $4::jsonb
          WHERE id = $1
        `,
        [
          payment.id,
          callbackResponseCode ||
            queryResponseCode ||
            null,
          callbackResponseMsg ||
            String(query.data?.responseMsg || '') ||
            null,
          JSON.stringify(
            safeJson({
              callback: callbackBody,
              queryTransaction: query.data,
            })
          ),
        ]
      );

      await addEvent(
        failedClient,
        Number(payment.id),
        'RETURN_NOT_VERIFIED',
        String(payment.status || ''),
        String(payment.status || ''),
        {
          callbackResponseCode,
          callbackResponseMsg,
          queryResponseCode,
          callbackPgTranId,
          queryTransaction:
            safeJson(query.data),
        }
      );

      await failedClient.query('COMMIT');
    } catch (failedLogError) {
      try {
        await failedClient.query('ROLLBACK');
      } catch {}

      console.error(
        'PARATIKA RETURN NOT VERIFIED LOG ERROR:',
        failedLogError
      );
    } finally {
      failedClient.release();
    }

    console.warn('PARATIKA RETURN NOT VERIFIED', {
      paymentId: payment.id,
      merchantPaymentId:
        payment.merchant_payment_id,
      callbackResponseCode,
      queryResponseCode,
      durationMs: Date.now() - startedAt,
    });

    return htmlResponse(
      false,
      'Ödeme sonucu kontrol ediliyor',
      'Ödeme sonucu Paratika üzerinden henüz doğrulanamadı. İşleminiz kayıt altına alındı; mağaza personelimiz durumunu sistemden kontrol edecektir.'
    );
  } catch (error: any) {
    console.error(
      'PARATIKA RETURN ERROR:',
      error,
      {
        callback: safeJson(callbackBody),
      }
    );

    return htmlResponse(
      false,
      'Ödeme sonucu kontrol ediliyor',
      'Ödeme sonucu alındı ancak doğrulama sırasında teknik bir hata oluştu. Lütfen işlemi tekrar ödemeyin; mağaza personeli durumunuzu kontrol edecektir.',
      200
    );
  }
}

// Tarayıcıdan yanlışlıkla GET açılırsa açıklayıcı cevap.
export async function GET() {
  return htmlResponse(
    false,
    'Paratika ödeme dönüş noktası',
    'Bu adres yalnızca Paratika ödeme sistemi tarafından POST isteği ile kullanılır.',
    405
  );
}
