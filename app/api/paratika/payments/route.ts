// app/api/paratika/payments/route.ts
// CNETMOBIL - PARATIKA ÖDEME LİSTESİ
//
// - Personel: kendi mağazası
// - Admin/Yönetici oturumu: tüm mağazalar
// - Liste ve özet seçilen GÜNE göre döner.
// - Gün hesabı Europe/Istanbul saat dilimine göre yapılır.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const COOKIE_NAME = 'cnet_auth';
const ISTANBUL_TZ = 'Europe/Istanbul';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var cnetParatikaPaymentsPool: Pool | undefined;
}

const ALLOWED_STATUSES = new Set([
  'LINK_CREATED',
  'SENT',
  'PENDING',
  'APPROVED',
  'FAILED',
  'CANCELLED',
  'EXPIRED',
]);

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetParatikaPaymentsPool) {
    global.cnetParatikaPaymentsPool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetParatikaPaymentsPool;
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

function getSessionSecret() {
  const secret = String(
    process.env.SESSION_SECRET || ''
  ).trim();

  if (!secret) {
    throw new Error(
      'SESSION_SECRET bulunamadı.'
    );
  }

  return secret;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [encoded, signature] =
      token.split('.');

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

    const signatureBuffer = Buffer.from(
      signature,
      'utf8'
    );

    const expectedBuffer = Buffer.from(
      expectedSignature,
      'utf8'
    );

    if (
      signatureBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        signatureBuffer,
        expectedBuffer
      )
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

function parsePositiveInt(
  value: string | null,
  fallback: number,
  min: number,
  max: number
) {
  const n = Number(value);

  if (!Number.isInteger(n)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(min, n)
  );
}

function todayInIstanbul() {
  return new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: ISTANBUL_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }
  ).format(new Date());
}

function parseDateKey(
  value: string | null
) {
  const dateKey = String(
    value || todayInIstanbul()
  ).trim();

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dateKey
    )
  ) {
    return null;
  }

  const parsed = new Date(
    `${dateKey}T12:00:00+03:00`
  );

  if (
    Number.isNaN(parsed.getTime())
  ) {
    return null;
  }

  return dateKey;
}

export async function GET(
  request: NextRequest
) {
  const startedAt = Date.now();

  try {
    const auth =
      requireSession(request);

    if (!auth.ok) {
      return auth.response;
    }

    const { session } = auth;

    const canViewAllBranches =
      session.role === 'admin';

    const page = parsePositiveInt(
      request.nextUrl.searchParams.get(
        'page'
      ),
      1,
      1,
      1_000_000
    );

    const limit = parsePositiveInt(
      request.nextUrl.searchParams.get(
        'limit'
      ),
      100,
      1,
      100
    );

    const offset =
      (page - 1) * limit;

    const requestedStatus = String(
      request.nextUrl.searchParams.get(
        'status'
      ) || ''
    )
      .trim()
      .toUpperCase();

    const requestedBranch = String(
      request.nextUrl.searchParams.get(
        'branch'
      ) || ''
    ).trim();

    const search = String(
      request.nextUrl.searchParams.get(
        'q'
      ) || ''
    ).trim();

    const selectedDate = parseDateKey(
      request.nextUrl.searchParams.get(
        'date'
      )
    );

    if (!selectedDate) {
      return noStoreJson(
        {
          success: false,
          error:
            'Geçersiz tarih filtresi.',
        },
        400
      );
    }

    if (
      requestedStatus &&
      requestedStatus !== 'ALL' &&
      !ALLOWED_STATUSES.has(
        requestedStatus
      )
    ) {
      return noStoreJson(
        {
          success: false,
          error:
            'Geçersiz durum filtresi.',
        },
        400
      );
    }

    const where: string[] = [];
    const values: unknown[] = [];

    const addParam = (
      value: unknown
    ) => {
      values.push(value);
      return `$${values.length}`;
    };

    // Her zaman seçilen güne kilitlenir.
    const dateParam =
      addParam(selectedDate);

    where.push(
      `(p.created_at AT TIME ZONE '${ISTANBUL_TZ}')::date = ${dateParam}::date`
    );

    // Mağaza yetkisi.
    if (!canViewAllBranches) {
      const branchParam = addParam(
        String(
          session.branch || ''
        ).trim()
      );

      where.push(
        `p.branch_code = ${branchParam}`
      );
    } else if (
      requestedBranch &&
      requestedBranch.toUpperCase() !==
        'ALL' &&
      requestedBranch.toLocaleUpperCase(
        'tr-TR'
      ) !== 'TÜM ŞUBELER'
    ) {
      const branchParam =
        addParam(requestedBranch);

      where.push(
        `p.branch_code = ${branchParam}`
      );
    }

    if (
      requestedStatus &&
      requestedStatus !== 'ALL'
    ) {
      const statusParam =
        addParam(requestedStatus);

      where.push(
        `p.status = ${statusParam}`
      );
    }

    if (search) {
      const searchParam =
        addParam(`%${search}%`);

      where.push(`
        (
          p.customer_name ILIKE ${searchParam}
          OR p.customer_email ILIKE ${searchParam}
          OR p.customer_phone ILIKE ${searchParam}
          OR p.merchant_payment_id ILIKE ${searchParam}
          OR COALESCE(p.pg_tran_id, '') ILIKE ${searchParam}
          OR COALESCE(p.pg_tran_ref_id, '') ILIKE ${searchParam}
          OR COALESCE(p.approval_code, '') ILIKE ${searchParam}
        )
      `);
    }

    const whereSql =
      `WHERE ${where.join(
        ' AND '
      )}`;

    const pool = getPool();

    const listValues = [
      ...values,
      limit,
      offset,
    ];

    const limitParam =
      `$${values.length + 1}`;
    const offsetParam =
      `$${values.length + 2}`;

    const listResult =
      await pool.query(
        `
          SELECT
            p.id,
            p.merchant_payment_id,
            p.payment_url,

            p.branch_code,
            p.created_by_user_id,
            p.created_by_email,

            p.customer_name,
            p.customer_email,
            p.customer_phone,

            p.amount,
            p.currency,
            p.installment_count,

            p.status,
            p.paratika_status,
            p.response_code,
            p.response_msg,

            p.pg_tran_id,
            p.pg_tran_ref_id,
            p.pg_order_id,
            p.approval_code,
            p.issuer,
            p.number_of_installments,

            p.link_created_at,
            p.sent_at,
            p.approved_at,
            p.cancelled_at,
            p.expired_at,

            p.paratika_created_at,
            p.paratika_due_date,
            p.paratika_payment_date,

            p.last_synced_at,
            p.created_at,
            p.updated_at

          FROM public.paratika_payments p

          ${whereSql}

          ORDER BY
            CASE p.status
              WHEN 'PENDING' THEN 1
              WHEN 'SENT' THEN 2
              WHEN 'LINK_CREATED' THEN 3
              WHEN 'APPROVED' THEN 4
              WHEN 'FAILED' THEN 5
              WHEN 'EXPIRED' THEN 6
              WHEN 'CANCELLED' THEN 7
              ELSE 8
            END ASC,
            p.created_at DESC

          LIMIT ${limitParam}
          OFFSET ${offsetParam}
        `,
        listValues
      );

    const countResult =
      await pool.query(
        `
          SELECT
            COUNT(*)::int AS total
          FROM public.paratika_payments p
          ${whereSql}
        `,
        values
      );

    const total = Number(
      countResult.rows[0]?.total ||
        0
    );

    // Özet: status/search filtresinden bağımsız,
    // ama mağaza + seçili gün filtresine bağlı.
    const summaryWhere: string[] =
      [];
    const summaryValues: unknown[] =
      [];

    summaryValues.push(
      selectedDate
    );

    summaryWhere.push(
      `(created_at AT TIME ZONE '${ISTANBUL_TZ}')::date = $1::date`
    );

    if (!canViewAllBranches) {
      summaryValues.push(
        String(
          session.branch || ''
        ).trim()
      );

      summaryWhere.push(
        `branch_code = $2`
      );
    } else if (
      requestedBranch &&
      requestedBranch.toUpperCase() !==
        'ALL' &&
      requestedBranch.toLocaleUpperCase(
        'tr-TR'
      ) !== 'TÜM ŞUBELER'
    ) {
      summaryValues.push(
        requestedBranch
      );

      summaryWhere.push(
        `branch_code = $2`
      );
    }

    const summaryWhereSql =
      `WHERE ${summaryWhere.join(
        ' AND '
      )}`;

    const summaryResult =
      await pool.query(
        `
          SELECT
            COUNT(*)::int AS total,

            COUNT(*) FILTER (
              WHERE status =
                'LINK_CREATED'
            )::int AS link_created,

            COUNT(*) FILTER (
              WHERE status = 'SENT'
            )::int AS sent,

            COUNT(*) FILTER (
              WHERE status = 'PENDING'
            )::int AS pending,

            COUNT(*) FILTER (
              WHERE status = 'APPROVED'
            )::int AS approved,

            COUNT(*) FILTER (
              WHERE status = 'FAILED'
            )::int AS failed,

            COUNT(*) FILTER (
              WHERE status = 'CANCELLED'
            )::int AS cancelled,

            COUNT(*) FILTER (
              WHERE status = 'EXPIRED'
            )::int AS expired,

            COALESCE(
              SUM(amount) FILTER (
                WHERE status =
                  'APPROVED'
              ),
              0
            )::numeric
              AS approved_amount,

            COALESCE(
              SUM(amount) FILTER (
                WHERE status IN (
                  'LINK_CREATED',
                  'SENT',
                  'PENDING'
                )
              ),
              0
            )::numeric
              AS waiting_amount

          FROM public.paratika_payments
          ${summaryWhereSql}
        `,
        summaryValues
      );

    const s =
      summaryResult.rows[0] || {};

    return noStoreJson({
      success: true,

      permissions: {
        canViewAllBranches,
        ownBranch: String(
          session.branch || ''
        ).trim(),
        role: session.role,
      },

      filters: {
        date: selectedDate,
        branch:
          !canViewAllBranches
            ? String(
                session.branch || ''
              ).trim()
            : requestedBranch ||
              'ALL',
        status:
          requestedStatus || 'ALL',
        q: search,
      },

      summary: {
        total: Number(
          s.total || 0
        ),
        linkCreated: Number(
          s.link_created || 0
        ),
        sent: Number(
          s.sent || 0
        ),
        pending: Number(
          s.pending || 0
        ),
        approved: Number(
          s.approved || 0
        ),
        failed: Number(
          s.failed || 0
        ),
        cancelled: Number(
          s.cancelled || 0
        ),
        expired: Number(
          s.expired || 0
        ),
        approvedAmount: Number(
          s.approved_amount || 0
        ),
        waitingAmount: Number(
          s.waiting_amount || 0
        ),
      },

      payments:
        listResult.rows.map(
          (row) => ({
            id: Number(row.id),

            merchantPaymentId:
              row.merchant_payment_id,
            paymentUrl:
              row.payment_url,

            branchCode:
              row.branch_code,
            createdByUserId:
              row.created_by_user_id !==
              null
                ? Number(
                    row.created_by_user_id
                  )
                : null,
            createdByEmail:
              row.created_by_email,

            customerName:
              row.customer_name,
            customerEmail:
              row.customer_email,
            customerPhone:
              row.customer_phone,

            amount: Number(
              row.amount || 0
            ),
            currency:
              row.currency,
            installmentCount:
              Number(
                row.installment_count ||
                  0
              ),

            status: row.status,
            paratikaStatus:
              row.paratika_status,
            responseCode:
              row.response_code,
            responseMsg:
              row.response_msg,

            pgTranId:
              row.pg_tran_id,
            pgTranRefId:
              row.pg_tran_ref_id,
            pgOrderId:
              row.pg_order_id,
            approvalCode:
              row.approval_code,
            issuer: row.issuer,

            numberOfInstallments:
              row.number_of_installments !==
              null
                ? Number(
                    row.number_of_installments
                  )
                : null,

            linkCreatedAt:
              row.link_created_at,
            sentAt: row.sent_at,
            approvedAt:
              row.approved_at,
            cancelledAt:
              row.cancelled_at,
            expiredAt:
              row.expired_at,

            paratikaCreatedAt:
              row.paratika_created_at,
            paratikaDueDate:
              row.paratika_due_date,
            paratikaPaymentDate:
              row.paratika_payment_date,

            lastSyncedAt:
              row.last_synced_at,
            createdAt:
              row.created_at,
            updatedAt:
              row.updated_at,
          })
        ),

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(
          1,
          Math.ceil(total / limit)
        ),
      },

      responseTimeMs:
        Date.now() - startedAt,
      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      'PARATIKA PAYMENTS LIST ERROR:',
      error
    );

    return noStoreJson(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Paratika ödeme listesi alınamadı.',
      },
      500
    );
  }
}
