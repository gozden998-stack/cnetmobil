// app/api/paratika/status-sync/route.ts
//
// FIX 18.09.2026:
// - Banka/vPOS başarı varyantları 000 / 0000 / VPB-0000 desteklenir.
// - "000 ONAY KODU ..." hata olarak gösterilmez.
// - Başarı için yine AP + doğru tutar + doğru para birimi şartı korunur.
//
// FIX 17.09.2026:
// - Aynı linkte başarılı AP işlem varsa sonraki/önceki başarısız deneme
//   başarılı ödemeyi FAILED yapamaz.
// - AP + 00/0000 + doğru tutar/para birimi önceliklidir.
// - "İŞLEM BAŞARILI" ve 0000 artık hata nedeni/kodu olarak gösterilmez.
// - Gerçek FAILED sonucu anında hata mesajıyla gösterilir.
// - Mevcut SQL cast düzeltmeleri ve ÜÖT/ÖSN mantığı korunur.
//
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
  paratika_status: string | null;
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

async function queryTransactionByMerchantNote(
  config: ParatikaConfig,
  merchantPaymentId: string
) {
  const params = new URLSearchParams();

  params.set(
    'ACTION',
    'QUERYTRANSACTION'
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

  // PAYBYLINKPAYMENT oluştururken MERCHANTNOTE alanına
  // merchantPaymentId yazıyoruz. QUERYTRANSACTION içinde
  // MERCHANTPAYMENTID yalnız başarılı işlemleri döndürebildiği için
  // başarısız kart denemelerini bu tekil note üzerinden arıyoruz.
  params.set(
    'MERCHANTNOTE',
    merchantPaymentId
  );

  params.set('LIMIT', '50');
  params.set('OFFSET', '0');

  return postParatika(
    config,
    params
  );
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

async function queryReconTransaction(
  config: ParatikaConfig,
  pgTranId: string,
  pgOrderId: string,
  merchantPaymentId: string
) {
  const params = new URLSearchParams();

  params.set(
    'ACTION',
    'RECONTRANSACTION'
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

  // Paratika dokümanındaki Recon Transaction alanları.
  // En güçlü eşleştirme PGTRANID; yoksa PGORDERID;
  // en son MERCHANTPAYMENTID kullanılır.
  if (pgTranId) {
    params.set(
      'PGTRANID',
      pgTranId
    );
  } else if (pgOrderId) {
    params.set(
      'PGORDERID',
      pgOrderId
    );
  } else if (merchantPaymentId) {
    params.set(
      'MERCHANTPAYMENTID',
      merchantPaymentId
    );
  } else {
    return null;
  }

  return postParatika(
    config,
    params
  );
}

function selectReconTransaction(
  data: any,
  pgTranId: string,
  pgOrderId: string,
  merchantPaymentId: string
) {
  const list = Array.isArray(
    data?.transactionList
  )
    ? data.transactionList
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
    list.find(
      (item: any) =>
        merchantPaymentId &&
        String(
          item?.merchantPaymentId || ''
        ) === merchantPaymentId
    ) ||
    list[0]
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

  const exactTransaction =
    list.find(
      (item: any) =>
        pgTranId &&
        String(
          item?.pgTranId || ''
        ) === pgTranId
    );

  if (exactTransaction) {
    return exactTransaction;
  }

  const exactOrder =
    list.find(
      (item: any) =>
        pgOrderId &&
        String(
          item?.pgOrderId || ''
        ) === pgOrderId
    );

  if (exactOrder) {
    return exactOrder;
  }

  return list[0];
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

function normalizeParatikaMessage(
  value: unknown
) {
  return String(value ?? '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/Ş/g, 'S')
    .replace(/Ğ/g, 'G')
    .replace(/Ç/g, 'C')
    .replace(/Ö/g, 'O')
    .replace(/Ü/g, 'U');
}

function isApprovalMessage(
  value: unknown
) {
  const message =
    normalizeParatikaMessage(
      value
    );

  return (
    message === 'APPROVED' ||
    message === 'SUCCESS' ||
    message === 'SUCCESSFUL' ||
    message === 'ISLEM BASARILI' ||
    /^0{2,4}\s+ONAY\s+KODU\b/.test(
      message
    )
  );
}

function isSuccessReturnCode(
  value: unknown
) {
  const code = String(
    value ?? ''
  )
    .trim()
    .toUpperCase();

  // Paratika'nın standart başarılı kodu 00'dır.
  // Bazı banka/vPOS katmanları başarılı sonucu 000, 0000 veya
  // VPB-0000 şeklinde döndürebiliyor.
  return (
    code === '00' ||
    code === '000' ||
    code === '0000' ||
    code === 'VPB-0000'
  );
}

function hasApprovedBankSignal(
  item: any
) {
  if (!item) {
    return false;
  }

  if (
    isSuccessReturnCode(
      item?.pgTranReturnCode
    )
  ) {
    return true;
  }

  const approvalCode =
    String(
      item?.pgTranApprCode ?? ''
    ).trim();

  const successText =
    isApprovalMessage(
      item?.pgTranReturnText
    ) ||
    isApprovalMessage(
      item?.pgTranErrorText
    ) ||
    isApprovalMessage(
      item?.responseMsg
    );

  const successMetaCode =
    isSuccessReturnCode(
      item?.pgTranErrorCode
    );

  // Bu ek sinyaller yalnızca AP kaydını doğrulamak için kullanılır.
  // Tek başına bir FA kaydını başarılı yapmaz.
  return Boolean(
    approvalCode &&
    (
      successText ||
      successMetaCode
    )
  );
}

function transactionTime(
  item: any
) {
  const candidates = [
    item?.pgTranDate,
    item?.timePsReceived,
    item?.timeCreated,
    item?.timePsSent,
  ];

  for (const candidate of candidates) {
    const parsed =
      parseParatikaDate(
        candidate
      );

    if (parsed) {
      return parsed.getTime();
    }
  }

  return 0;
}

function selectRelevantTransaction(
  data: any,
  payment?: PaymentRow
) {
  const list = Array.isArray(
    data?.transactionList
  )
    ? data.transactionList
    : [];

  if (!list.length) {
    return null;
  }

  const saleTransactions =
    list.filter((item: any) => {
      const type = String(
        item?.transactionType || ''
      ).toUpperCase();

      return (
        type === 'SALE' ||
        type === ''
      );
    });

  const source =
    saleTransactions.length
      ? saleTransactions
      : list;

  // KRİTİK DÜZELTME:
  // Aynı ödeme/link altında önce başarısız bir deneme, sonra başarılı
  // bir çekim oluşabiliyor. Eski kod "en yeni terminal kayıt" mantığıyla
  // yanlış bir FA kaydını seçebiliyordu.
  //
  // Paratika'da gerçekten AP + başarılı dönüş kodu + aynı tutar/para
  // birimi varsa, bu başarılı SALE işlemi önceliklidir.
  const approved =
    source.filter((item: any) => {
      const status = String(
        item?.transactionStatus || ''
      ).toUpperCase();

      if (
        status !== 'AP' ||
        !hasApprovedBankSignal(
          item
        )
      ) {
        return false;
      }

      if (!payment) {
        return true;
      }

      const sameAmount =
        amountMatches(
          payment.amount,
          item?.amount
        );

      const sameCurrency =
        String(
          item?.currency || ''
        ).toUpperCase() ===
        String(
          payment.currency || ''
        ).toUpperCase();

      return (
        sameAmount &&
        sameCurrency
      );
    });

  const latestApproved =
    approved.length
      ? [...approved].sort(
          (a: any, b: any) =>
            transactionTime(b) -
            transactionTime(a)
        )[0]
      : null;

  // Başarılı işlemden SONRA açık bir iptal/void geldiyse onu koru.
  // Aksi halde sonradan oluşmuş bir FA denemesi başarılı ödemeyi
  // FAILED'a çeviremez.
  if (latestApproved) {
    const cancellations =
      source.filter((item: any) => {
        const status = String(
          item?.transactionStatus || ''
        ).toUpperCase();

        return (
          status === 'VD' ||
          status === 'CA'
        );
      });

    const latestCancellation =
      cancellations.length
        ? [...cancellations].sort(
            (a: any, b: any) =>
              transactionTime(b) -
              transactionTime(a)
          )[0]
        : null;

    if (
      latestCancellation &&
      transactionTime(
        latestCancellation
      ) >
        transactionTime(
          latestApproved
        )
    ) {
      return latestCancellation;
    }

    return latestApproved;
  }

  function isTerminal(
    item: any
  ) {
    const status = String(
      item?.transactionStatus || ''
    ).toUpperCase();

    const returnCode = String(
      item?.pgTranReturnCode ??
        ''
    ).trim();

    return (
      ['AP', 'VD', 'FA', 'CA'].includes(
        status
      ) ||
      (
        returnCode !== '' &&
        !isSuccessReturnCode(
          returnCode
        )
      )
    );
  }

  const terminal =
    source.filter(isTerminal);

  const candidates =
    terminal.length
      ? terminal
      : source;

  // Başarılı işlem yoksa en güncel terminal sonuç kullanılır.
  return [...candidates].sort(
    (a: any, b: any) =>
      transactionTime(b) -
      transactionTime(a)
  )[0];
}

function mapTransactionStatus(
  transactionStatus: string,
  pgTranReturnCode: string,
  currentStatus: string,
  transaction?: any
) {
  const status = String(
    transactionStatus || ''
  ).toUpperCase();

  const returnCode = String(
    pgTranReturnCode || ''
  ).trim();

  if (
    status === 'AP' &&
    (
      isSuccessReturnCode(
        returnCode
      ) ||
      hasApprovedBankSignal(
        transaction
      )
    )
  ) {
    return 'APPROVED';
  }

  if (
    status === 'VD' ||
    status === 'CA'
  ) {
    return 'CANCELLED';
  }

  // Kritik:
  // Bazı banka/Paratika cevaplarında işlem statusü IP/MR kalsa bile
  // pgTranReturnCode başarısızlık kodu dönebiliyor.
  // 00 dışındaki gerçek banka sonucu FAILED kabul edilir.
  if (
    returnCode !== '' &&
    !isSuccessReturnCode(
      returnCode
    )
  ) {
    return 'FAILED';
  }

  if (status === 'FA') {
    return 'FAILED';
  }

  if (
    status === 'IP' ||
    status === 'MR'
  ) {
    if (
      currentStatus ===
        'APPROVED' ||
      currentStatus ===
        'CANCELLED' ||
      currentStatus ===
        'EXPIRED'
    ) {
      return currentStatus;
    }

    return 'PENDING';
  }

  return currentStatus;
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


function getFailureInfo(
  transactionData: any,
  transaction: any
) {
  const returnCode = String(
    transaction?.pgTranReturnCode ??
      ''
  ).trim();

  const rawErrorCode = String(
    transaction?.pgTranErrorCode ??
      transaction?.errorCode ??
      transactionData?.errorCode ??
      ''
  ).trim();

  const code =
    rawErrorCode &&
    !isSuccessReturnCode(
      rawErrorCode
    )
      ? rawErrorCode
      : (
          returnCode &&
          !isSuccessReturnCode(
            returnCode
          )
            ? returnCode
            : ''
        );

  const rawText = String(
    transaction?.pgTranErrorText ??
      transaction?.pgTranReturnText ??
      transaction?.errorMsg ??
      transaction?.responseMsg ??
      transactionData?.errorMsg ??
      ''
  ).trim();

  // "000 ONAY KODU ..." gerçek hata değildir; banka onay mesajıdır.
  const text =
    isApprovalMessage(
      rawText
    )
      ? ''
      : rawText;

  const topLevelMsg = String(
    transactionData?.responseMsg ??
      ''
  ).trim();

  const normalizedTopLevelMsg =
    normalizeParatikaMessage(
      topLevelMsg
    );

  const usefulTopLevelMsg =
    topLevelMsg &&
    ![
      'APPROVED',
      'DECLINED',
      'SUCCESS',
      'SUCCESSFUL',
      'ISLEM BASARILI',
    ].includes(
      normalizedTopLevelMsg
    ) &&
    !isApprovalMessage(
      topLevelMsg
    )
      ? topLevelMsg
      : '';

  const message =
    text ||
    usefulTopLevelMsg ||
    (
      code
        ? `Ödeme banka/ödeme sistemi tarafından reddedildi. Hata kodu: ${code}`
        : 'Ödeme banka/ödeme sistemi tarafından reddedildi.'
    );

  return {
    code,
    message,
  };
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

  // 1) Önce normal sorgu:
  // MERCHANTPAYMENTID ile başarılı işlemleri bulur.
  const transactionQuery =
    await queryTransaction(
      config,
      payment.merchant_payment_id
    );

  const primaryTransactionData =
    transactionQuery.data ?? null;

  let transactionData =
    primaryTransactionData;

  let transaction =
    selectRelevantTransaction(
      primaryTransactionData,
      payment
    );

  let merchantNoteTransactionData:
    any = null;

  // 2) Normal sorguda işlem yoksa PayByLink oluştururken
  // yazdığımız tekil MERCHANTNOTE üzerinden tekrar ara.
  // Bu yol başarısız kart denemelerini de yakalar.
  if (!transaction) {
    const merchantNoteQuery =
      await queryTransactionByMerchantNote(
        config,
        payment.merchant_payment_id
      );

    merchantNoteTransactionData =
      merchantNoteQuery.data ?? null;

    const merchantNoteTransaction =
      selectRelevantTransaction(
        merchantNoteTransactionData,
        payment
      );

    if (merchantNoteTransaction) {
      transactionData =
        merchantNoteTransactionData;

      transaction =
        merchantNoteTransaction;
    }
  }

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
      hasApprovedBankSignal(
        transaction
      ) &&
      (!sameAmount || !sameCurrency)
    ) {
      // Güvenlik: eşleşmeyen ödeme APPROVED yapılmaz.
      newStatus = payment.status;
    } else {
      newStatus = mapTransactionStatus(
        transactionStatus,
        pgTranReturnCode,
        String(payment.status || ''),
        transaction
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

  const transactionPgOrderId =
    String(
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

  let reconciliationData: any =
    null;

  let reconciliationItem: any =
    null;

  let reconTransactionData: any =
    null;

  let reconTransactionItem: any =
    null;

  if (newStatus === 'APPROVED') {
    // MPD / ÜÖT için Paratika Recon Transaction verisini kullan.
    // Dokümanda bu alan transactionList[].merchant.paymentDate
    // olarak dönüyor.
    const reconTransactionQuery =
      await queryReconTransaction(
        config,
        pgTranId,
        transactionPgOrderId,
        String(
          payment.merchant_payment_id ||
            ''
        )
      );

    reconTransactionData =
      reconTransactionQuery?.data ??
      null;

    reconTransactionItem =
      reconTransactionData
        ? selectReconTransaction(
            reconTransactionData,
            pgTranId,
            transactionPgOrderId,
            String(
              payment.merchant_payment_id ||
                ''
            )
          )
        : null;

    // Eski mutabakat sorgusunu yedek kaynak olarak koruyoruz.
    const reconciliationQuery =
      await queryMerchantReconciliation(
        config,
        pgTranId,
        transactionPgOrderId,
        approvalCode
      );

    reconciliationData =
      reconciliationQuery?.data ??
      null;

    reconciliationItem =
      reconciliationData
        ? selectMerchantRecon(
            reconciliationData,
            pgTranId,
            transactionPgOrderId
          )
        : null;
  }

  // ÖSN:
  // Paratika panelindeki ÖSN ile eşleşen
  // mutabakat pgOrderId değeri.
  const pgOrderId = String(
    reconciliationItem?.pgOrderId ||
      transactionPgOrderId ||
      ''
  ).trim();

  // ÜÖT:
  // Üye İşyeri Ödeme Tarihi =
  // merchantPaymentDate.
  // pgTranDate banka işlem tarihidir;
  // burada kullanılmaz.
  const merchantPaymentDate =
    parseParatikaDate(
      reconTransactionItem
        ?.merchant
        ?.paymentDate
    ) ||
    parseParatikaDate(
      reconTransactionItem
        ?.merchantPaymentDate
    ) ||
    parseParatikaDate(
      reconciliationItem
        ?.merchantPaymentDate
    );

  const failureInfo =
    getFailureInfo(
      transactionData,
      transaction
    );

  const responseCode =
    newStatus === 'FAILED'
      ? (
          failureInfo.code ||
          (
            pgTranReturnCode &&
            !isSuccessReturnCode(
              pgTranReturnCode
            )
              ? pgTranReturnCode
              : ''
          )
        )
      : String(
          transactionData?.responseCode ??
            payByLinkData?.responseCode ??
            ''
        );

  const responseMsg =
    newStatus === 'FAILED'
      ? failureInfo.message
      : String(
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

    // FIX 26.09.2026 - CIDDI HATA:
    // Eski kural "oldStatus === 'APPROVED' ise asla dusurme" idi.
    // Bu, GERCEK bir yaris durumuyla (biz Paratika'yi sorgularken
    // BASKA bir surecin ayni odemeyi az once APPROVED yapmasi) ile
    // "bu odeme zaten uzun suredir APPROVED, simdi rutin yeniden
    // kontrol ediyoruz" durumunu ayirt edemiyordu. Sonuc: Paratika
    // sonradan (fraud/guvenlik kontrolu) bir odemeyi FA yapsa bile
    // status sutunu sonsuza kadar APPROVED'da donup kaliyordu -
    // panelde "onaylandi" gorunup Paratika'da "basarisiz" olan
    // vakalarin kok nedeni buydu (bkz. id 103/104, response_code 63
    // "Guvenlik Ihlali").
    //
    // Duzeltme: sadece GERCEK yaris durumunda (bu sync baslarken
    // okunan payment.status HENUZ APPROVED degilken, kilit alindiginda
    // APPROVED gorulduyse) APPROVED'da sabit kal. Odeme sync baslamadan
    // ONCE zaten APPROVED ise, Paratika'nin yeni verdigi sonuc (ornegin
    // sonradan iptal/red) GECERLI ve GUNCEL bilgidir - asla gizlenmez.
    const wasAlreadyApprovedBeforeSync =
      String(payment.status || '') === 'APPROVED';

    if (
      !wasAlreadyApprovedBeforeSync &&
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
            COALESCE(
              NULLIF($2::varchar, ''),
              paybylink_token
            ),

          status = $3::varchar,

          paratika_status =
            COALESCE(
              NULLIF($4::varchar, ''),
              NULLIF($5::varchar, ''),
              paratika_status
            ),

          response_code =
            COALESCE(
              NULLIF($6::varchar, ''),
              response_code
            ),

          response_msg =
            COALESCE(
              NULLIF($7::text, ''),
              response_msg
            ),

          pg_tran_id =
            COALESCE(
              NULLIF($8::varchar, ''),
              pg_tran_id
            ),

          pg_tran_ref_id =
            COALESCE(
              NULLIF($9::varchar, ''),
              pg_tran_ref_id
            ),

          pg_order_id =
            COALESCE(
              NULLIF($10::varchar, ''),
              pg_order_id
            ),

          approval_code =
            COALESCE(
              NULLIF($11::varchar, ''),
              approval_code
            ),

          issuer =
            COALESCE(
              NULLIF($12::varchar, ''),
              issuer
            ),

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
              WHEN $3::text = 'APPROVED'
                THEN COALESCE(
                  $16::timestamptz,
                  paratika_payment_date
                )
              ELSE paratika_payment_date
            END,

          approved_at =
            CASE
              WHEN $3::text = 'APPROVED'
                THEN COALESCE(approved_at, NOW())
              ELSE approved_at
            END,

          cancelled_at =
            CASE
              WHEN $3::text = 'CANCELLED'
                THEN COALESCE(cancelled_at, NOW())
              ELSE cancelled_at
            END,

          expired_at =
            CASE
              WHEN $3::text = 'EXPIRED'
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
        merchantPaymentDate
          ? merchantPaymentDate.toISOString()
          : null,
        JSON.stringify(
          safeJson({
            payByLink: payByLinkData,
            transaction:
              transactionData,
            transactionByMerchantPaymentId:
              primaryTransactionData,
            transactionByMerchantNote:
              merchantNoteTransactionData,
            merchantReconciliation:
              reconciliationData,
            reconTransaction:
              reconTransactionData,
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
          failureCode:
            newStatus === 'FAILED'
              ? failureInfo.code || null
              : null,
          failureMessage:
            newStatus === 'FAILED'
              ? failureInfo.message
              : null,
          pgTranId: pgTranId || null,
          transactionLookup:
            merchantNoteTransactionData
              ? 'MERCHANTNOTE'
              : 'MERCHANTPAYMENTID',
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
        merchantPaymentDate
          ? merchantPaymentDate.toISOString()
          : null,
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
            status,
            paratika_status
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

      // Bir çağrıda en fazla 50 canlı takip kaydı.
      // LINK_CREATED / SENT / PENDING sürekli doğrulanır.
      // FAILED sonucu kullanıcıya anında gösterilir.
      // Ancak personel aynı linkte yeniden kart denerse başarılı sonucu
      // kaçırmamak için son 15 dakikadaki FAILED kayıtlar da tekrar kontrol edilir.
      // Frontend 5 saniyede bir sync yaptığı için başarılı yeni çekim hızla APPROVED olur.
      // APPROVED olup ÜÖT bekleyen kayıtlar da kontrol edilmeye devam eder.
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
            status,
            paratika_status
          FROM public.paratika_payments
          WHERE (
            status IN (
              'LINK_CREATED',
              'SENT',
              'PENDING'
            )
            OR (
              status = 'FAILED'
              AND created_at >=
                NOW() - INTERVAL '15 minutes'
              AND (
                paratika_due_date IS NULL
                OR paratika_due_date >= NOW()
              )
            )
            OR (
              status = 'APPROVED'
              AND paratika_payment_date IS NULL
              AND created_at >=
                NOW() - INTERVAL '30 days'
            )
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
