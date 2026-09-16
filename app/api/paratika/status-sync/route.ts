// app/api/paratika/status-sync/route.ts
// CNETMOBIL - PARATIKA DURUM SENKRONİZASYONU
//
// Amaç:
// - Callback gelmezse / gecikirse Paratika'ya tekrar sorar.
// - Pay By Link bilgilerini QUERYPAYBYLINKPAYMENT ile günceller.
// - Gerçek ödeme sonucunu QUERYTRANSACTION ile doğrular.
// - PostgreSQL kaydını günceller.
//
// Yetki:
// - Personel: sadece kendi mağazasının kayıtlarını senkronlayabilir.
// - Admin/Yönetici/Super Admin: tüm mağazaları senkronlayabilir.
//
// POST örnekleri:
// 1) Tek kayıt:
//    { "paymentId": 123 }
//
// 2) Erişebildiğim bekleyen kayıtları:
//    { "syncAll": true }
//
// Not:
// Bu route ödeme oluşturmaz, iptal etmez, para çekmez.

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

type PaymentRow = {
  id: number;
  merchant_payment_id: string;
  session_token: string | null;
  paybylink_token: string | null;
  branch_code: string;
  amount: string | number;
  currency: string;
  installment_count: number;
  status: string;
};

declare global {
  // eslint-disable-next-line no-var
  var cnetParatikaStatusSyncPool: Pool | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetParatikaStatusSyncPool) {
    global.cnetParatikaStatusSyncPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetParatikaStatusSyncPool;
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

async function queryPayByLink(
  config: ParatikaConfig,
  sessionToken: string | null,
  payByLinkToken: string | null
) {
  const params = new URLSearchParams();

  params.set('ACTION', 'QUERYPAYBYLINKPAYMENT');
  params.set('MERCHANT', config.merchant);
  params.set('MERCHANTUSER', config.merchantUser);
  params.set('MERCHANTPASSWORD', config.merchantPassword);

  if (payByLinkToken) {
    params.set('PAYBYLINKTOKEN', payByLinkToken);
  } else if (sessionToken) {
    params.set('SESSIONTOKEN', sessionToken);
  } else {
    return null;
  }

  return postParatika(config, params);
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

function selectPayByLinkItem(data: any) {
  const list = Array.isArray(data?.payByLinkPaymentList)
    ? data.payByLinkPaymentList
    : [];

  if (!list.length) return null;

  // Tek token/session sorgusunda normalde tek kayıt beklenir.
  // Birden çok dönerse en yeni createdTs tercih edilir.
  return [...list].sort((a: any, b: any) => {
    const aDate = String(a?.createdTs || '');
    const bDate = String(b?.createdTs || '');

    return bDate.localeCompare(aDate);
  })[0];
}

function selectRelevantTransaction(data: any) {
  const list = Array.isArray(data?.transactionList)
    ? data.transactionList
    : [];

  if (!list.length) return null;

  const saleTransactions = list.filter((item: any) => {
    const type = String(item?.transactionType || '').toUpperCase();

    return type === 'SALE' || type === '';
  });

  const source = saleTransactions.length
    ? saleTransactions
    : list;

  // Öncelik:
  // AP -> VD -> MR/IP -> FA/CA -> diğer
  const priority: Record<string, number> = {
    AP: 1,
    VD: 2,
    MR: 3,
    IP: 4,
    FA: 5,
    CA: 6,
  };

  return [...source].sort((a: any, b: any) => {
    const aStatus = String(
      a?.transactionStatus || ''
    ).toUpperCase();
    const bStatus = String(
      b?.transactionStatus || ''
    ).toUpperCase();

    const aPriority = priority[aStatus] ?? 99;
    const bPriority = priority[bStatus] ?? 99;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    const aDate = String(
      a?.timePsReceived ||
        a?.timeCreated ||
        a?.timePsSent ||
        ''
    );

    const bDate = String(
      b?.timePsReceived ||
        b?.timeCreated ||
        b?.timePsSent ||
        ''
    );

    return bDate.localeCompare(aDate);
  })[0];
}

function mapTransactionStatus(
  transactionStatus: string,
  pgTranReturnCode: string,
  currentStatus: string
) {
  const status = String(transactionStatus || '').toUpperCase();
  const returnCode = String(pgTranReturnCode || '');

  if (status === 'AP' && returnCode === '00') {
    return 'APPROVED';
  }

  if (status === 'VD') {
    return 'CANCELLED';
  }

  if (status === 'CA') {
    return 'CANCELLED';
  }

  if (status === 'FA') {
    return 'FAILED';
  }

  if (status === 'IP' || status === 'MR') {
    // Terminal durumu geri PENDING'e düşürmeyelim.
    if (
      currentStatus === 'APPROVED' ||
      currentStatus === 'CANCELLED' ||
      currentStatus === 'EXPIRED'
    ) {
      return currentStatus;
    }

    return 'PENDING';
  }

  return currentStatus;
}

function parseParatikaDate(value: unknown): Date | null {
  const raw = String(value || '').trim();

  if (!raw) return null;

  // ISO_8601
  const direct = new Date(raw);

  if (!Number.isNaN(direct.getTime())) {
    return direct;
  }

  // Banka işlem tarihi örneği:
  // 20260916 20:39:02
  const compact = raw.match(
    /^(\d{4})(\d{2})(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/
  );

  if (compact) {
    const [, y, m, d, hh, mm, ss] = compact;

    const parsed = new Date(
      `${y}-${m}-${d}T${hh}:${mm}:${ss}+03:00`
    );

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  // QUERYTRANSACTION örneği:
  // 2018-10-12 14:16:27.967
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

  return null;
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

async function syncOnePayment(
  pool: Pool,
  config: ParatikaConfig,
  payment: PaymentRow
) {
  const payByLinkQuery = await queryPayByLink(
    config,
    payment.session_token,
    payment.paybylink_token
  );

  const payByLinkData = payByLinkQuery?.data ?? null;
  const payByLinkItem = payByLinkData
    ? selectPayByLinkItem(payByLinkData)
    : null;

  const transactionQuery = await queryTransaction(
    config,
    payment.merchant_payment_id
  );

  const transactionData = transactionQuery.data ?? null;
  const transaction = selectRelevantTransaction(
    transactionData
  );

  let newStatus = String(payment.status || 'LINK_CREATED');

  const transactionStatus = String(
    transaction?.transactionStatus || ''
  ).toUpperCase();

  const pgTranReturnCode = String(
    transaction?.pgTranReturnCode ?? ''
  );

  // QUERYTRANSACTION varsa asıl ödeme durumunu buradan belirliyoruz.
  if (transaction) {
    const sameAmount = amountMatches(
      payment.amount,
      transaction?.amount
    );

    const sameCurrency =
      String(transaction?.currency || '').toUpperCase() ===
      String(payment.currency || '').toUpperCase();

    // APPROVED ancak tutar ve para birimi de doğrulanırsa kabul edilir.
    if (
      transactionStatus === 'AP' &&
      pgTranReturnCode === '00' &&
      (!sameAmount || !sameCurrency)
    ) {
      // Güvenlik: eşleşmeyen ödeme APPROVED yapılmaz.
      newStatus = payment.status;
    } else {
      newStatus = mapTransactionStatus(
        transactionStatus,
        pgTranReturnCode,
        String(payment.status || '')
      );
    }
  }

  const pblCreatedAt = parseParatikaDate(
    payByLinkItem?.createdTs
  );

  const pblDueDate = parseParatikaDate(
    payByLinkItem?.dueDate
  );

  // Hiç transaction yoksa ve linkin son kullanım tarihi geçtiyse EXPIRED.
  if (
    !transaction &&
    pblDueDate &&
    pblDueDate.getTime() < Date.now() &&
    !['APPROVED', 'CANCELLED'].includes(newStatus)
  ) {
    newStatus = 'EXPIRED';
  }

  const payByLinkToken = String(
    payByLinkItem?.token ||
      payment.paybylink_token ||
      ''
  ).trim();

  const rawPayByLinkStatus = String(
    payByLinkItem?.status || ''
  ).trim();

  const pgTranId = String(
    transaction?.pgTranId || ''
  ).trim();

  // Panelde ÖSN olarak banka referans numarasını gösteriyoruz.
  // Bazı sanal POS cevaplarında pgTranRefId yerine aynı değer
  // pgTranTraceAudit alanında gelebiliyor.
  const pgTranRefId = String(
    transaction?.pgTranRefId ||
      transaction?.pgTranTraceAudit ||
      ''
  ).trim();

  const pgOrderId = String(
    transaction?.pgOrderId || ''
  ).trim();

  const approvalCode = String(
    transaction?.pgTranApprCode || ''
  ).trim();

  const issuer = String(
    transaction?.issuer ||
      transaction?.paymentSystem ||
      ''
  ).trim();

  const actualInstallments = Number(
    transaction?.installmentCount || 0
  );

  // ÜÖT: önce bankanın işlem tarihini kullan.
  const paymentDate =
    parseParatikaDate(transaction?.pgTranDate) ||
    parseParatikaDate(transaction?.timePsReceived) ||
    parseParatikaDate(transaction?.timeCreated) ||
    parseParatikaDate(transaction?.timePsSent);

  const responseCode = String(
    transactionData?.responseCode ??
      payByLinkData?.responseCode ??
      ''
  );

  const responseMsg = String(
    transactionData?.responseMsg ??
      payByLinkData?.responseMsg ??
      ''
  );

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const lockedResult = await client.query(
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
        `Paratika ödeme kaydı bulunamadı. ID: ${payment.id}`
      );
    }

    const oldStatus = String(locked.status || '');

    // Lock alındıktan sonra arada başka süreç APPROVED yaptıysa
    // geriye düşürmeyelim.
    if (
      oldStatus === 'APPROVED' &&
      newStatus !== 'CANCELLED'
    ) {
      newStatus = 'APPROVED';
    }

    await client.query(
      `
        UPDATE public.paratika_payments
        SET
          paybylink_token =
            COALESCE(NULLIF($2, ''), paybylink_token),

          status = $3,

          paratika_status =
            COALESCE(
              NULLIF($4, ''),
              NULLIF($5, ''),
              paratika_status
            ),

          response_code =
            COALESCE(NULLIF($6, ''), response_code),

          response_msg =
            COALESCE(NULLIF($7, ''), response_msg),

          pg_tran_id =
            COALESCE(NULLIF($8, ''), pg_tran_id),

          pg_tran_ref_id =
            COALESCE(NULLIF($9, ''), pg_tran_ref_id),

          pg_order_id =
            COALESCE(NULLIF($10, ''), pg_order_id),

          approval_code =
            COALESCE(NULLIF($11, ''), approval_code),

          issuer =
            COALESCE(NULLIF($12, ''), issuer),

          number_of_installments =
            CASE
              WHEN $13::int > 0 THEN $13::int
              ELSE number_of_installments
            END,

          paratika_created_at =
            COALESCE(
              $14::timestamptz,
              paratika_created_at
            ),

          paratika_due_date =
            COALESCE(
              $15::timestamptz,
              paratika_due_date
            ),

          paratika_payment_date =
            CASE
              WHEN $3 = 'APPROVED'
                THEN COALESCE(
                  $16::timestamptz,
                  paratika_payment_date,
                  NOW()
                )
              ELSE paratika_payment_date
            END,

          approved_at =
            CASE
              WHEN $3 = 'APPROVED'
                THEN COALESCE(approved_at, NOW())
              ELSE approved_at
            END,

          cancelled_at =
            CASE
              WHEN $3 = 'CANCELLED'
                THEN COALESCE(cancelled_at, NOW())
              ELSE cancelled_at
            END,

          expired_at =
            CASE
              WHEN $3 = 'EXPIRED'
                THEN COALESCE(expired_at, NOW())
              ELSE expired_at
            END,

          last_synced_at = NOW(),

          raw_last_response = $17::jsonb

        WHERE id = $1
      `,
      [
        payment.id,
        payByLinkToken,
        newStatus,
        transactionStatus,
        rawPayByLinkStatus,
        responseCode,
        responseMsg,
        pgTranId,
        pgTranRefId,
        pgOrderId,
        approvalCode,
        issuer,
        Number.isInteger(actualInstallments)
          ? actualInstallments
          : 0,
        pblCreatedAt
          ? pblCreatedAt.toISOString()
          : null,
        pblDueDate
          ? pblDueDate.toISOString()
          : null,
        paymentDate
          ? paymentDate.toISOString()
          : null,
        JSON.stringify(
          safeJson({
            payByLink: payByLinkData,
            transaction: transactionData,
          })
        ),
      ]
    );

    if (oldStatus !== newStatus) {
      await addEvent(
        client,
        payment.id,
        'STATUS_CHANGED',
        oldStatus,
        newStatus,
        {
          merchantPaymentId:
            payment.merchant_payment_id,
          payByLinkStatus:
            rawPayByLinkStatus || null,
          transactionStatus:
            transactionStatus || null,
          pgTranReturnCode:
            pgTranReturnCode || null,
          pgTranId: pgTranId || null,
          syncedAt: new Date().toISOString(),
        }
      );
    } else {
      await addEvent(
        client,
        payment.id,
        'STATUS_SYNCED',
        oldStatus,
        newStatus,
        {
          merchantPaymentId:
            payment.merchant_payment_id,
          payByLinkStatus:
            rawPayByLinkStatus || null,
          transactionStatus:
            transactionStatus || null,
          syncedAt: new Date().toISOString(),
        }
      );
    }

    await client.query('COMMIT');

    return {
      id: payment.id,
      merchantPaymentId:
        payment.merchant_payment_id,
      branchCode: payment.branch_code,
      oldStatus,
      newStatus,
      changed: oldStatus !== newStatus,
      payByLinkStatus:
        rawPayByLinkStatus || null,
      transactionStatus:
        transactionStatus || null,
      pgTranId: pgTranId || null,
      approvalCode:
        approvalCode || null,
      paymentSystem:
        issuer || null,
      paymentDate:
        paymentDate?.toISOString() || null,
      payByLinkCreatedAt:
        pblCreatedAt?.toISOString() || null,
      payByLinkDueDate:
        pblDueDate?.toISOString() || null,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}

    throw error;
  } finally {
    client.release();
  }
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

    const paymentId = Number(body?.paymentId || 0);
    const syncAll = body?.syncAll === true;

    if (!paymentId && !syncAll) {
      return noStoreJson(
        {
          success: false,
          error:
            'paymentId veya syncAll=true gönderilmelidir.',
        },
        400
      );
    }

    const pool = getPool();
    const config = getParatikaConfig();

    const canViewAllBranches =
      auth.session.role === 'admin';

    let payments: PaymentRow[] = [];

    if (paymentId) {
      const values: unknown[] = [paymentId];

      let branchSql = '';

      if (!canViewAllBranches) {
        values.push(
          String(auth.session.branch || '').trim()
        );

        branchSql = `
          AND branch_code = $2
        `;
      }

      const result = await pool.query(
        `
          SELECT
            id,
            merchant_payment_id,
            session_token,
            paybylink_token,
            branch_code,
            amount,
            currency,
            installment_count,
            status
          FROM public.paratika_payments
          WHERE id = $1
          ${branchSql}
          LIMIT 1
        `,
        values
      );

      payments = result.rows;

      if (!payments.length) {
        return noStoreJson(
          {
            success: false,
            error:
              'Ödeme kaydı bulunamadı veya bu mağaza için yetkiniz yok.',
          },
          404
        );
      }
    } else {
      const values: unknown[] = [];
      let branchSql = '';

      if (!canViewAllBranches) {
        values.push(
          String(auth.session.branch || '').trim()
        );

        branchSql = `
          AND branch_code = $1
        `;
      }

      // Bir çağrıda en fazla 50 açık işlem.
      // Paratika'yı gereksiz yüklememek için terminal durumları dışarıda bırakılır.
      const result = await pool.query(
        `
          SELECT
            id,
            merchant_payment_id,
            session_token,
            paybylink_token,
            branch_code,
            amount,
            currency,
            installment_count,
            status
          FROM public.paratika_payments
          WHERE status IN (
            'LINK_CREATED',
            'SENT',
            'PENDING'
          )
          ${branchSql}
          ORDER BY
            COALESCE(last_synced_at, created_at) ASC
          LIMIT 50
        `,
        values
      );

      payments = result.rows;
    }

    const results: Array<Record<string, unknown>> = [];

    // Bilerek seri çalıştırıyoruz.
    // Finansal endpointi aynı anda onlarca kez vurmayalım.
    for (const payment of payments) {
      try {
        const result = await syncOnePayment(
          pool,
          config,
          payment
        );

        results.push({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error(
          'PARATIKA SINGLE STATUS SYNC ERROR:',
          {
            paymentId: payment.id,
            merchantPaymentId:
              payment.merchant_payment_id,
            error,
          }
        );

        results.push({
          success: false,
          id: payment.id,
          merchantPaymentId:
            payment.merchant_payment_id,
          error:
            error instanceof Error
              ? error.message
              : 'Senkronizasyon hatası.',
        });
      }
    }

    const successful = results.filter(
      (item) => item.success === true
    ).length;

    const failed = results.length - successful;

    const changed = results.filter(
      (item) =>
        item.success === true &&
        item.changed === true
    ).length;

    return noStoreJson({
      success: failed === 0,
      channel: 'PARATIKA',

      permissions: {
        canViewAllBranches,
        ownBranch: String(
          auth.session.branch || ''
        ).trim(),
        role: auth.session.role,
      },

      requested: payments.length,
      successful,
      failed,
      changed,

      results,

      responseTimeMs: Date.now() - startedAt,
      syncedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    const isAbort =
      error?.name === 'AbortError' ||
      String(error?.message || '')
        .toLowerCase()
        .includes('aborted');

    console.error(
      'PARATIKA STATUS SYNC ERROR:',
      error
    );

    return noStoreJson(
      {
        success: false,
        channel: 'PARATIKA',
        error: isAbort
          ? 'Paratika bağlantısı zaman aşımına uğradı.'
          : error instanceof Error
          ? error.message
          : 'Paratika durum senkronizasyonu başarısız.',
      },
      isAbort ? 504 : 500
    );
  }
}

// Bu endpoint'i yanlışlıkla tarayıcıdan GET ile çalıştırmayalım.
export async function GET() {
  return noStoreJson(
    {
      success: false,
      error:
        'Bu endpoint POST ile çalışır.',
    },
    405
  );
}
