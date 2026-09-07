// app/api/online/n11/task/route.ts
// CNETMOBIL ONLINE - N11 TASK DETAIL KONTROLU
// SADECE SUPER ADMIN.
// N11 taskId sonucunu sorgular, online_tasks ve online_listings durumunu gunceller.
// N11'de veri degistirmez; sadece daha once gonderilmis task'in sonucunu okur.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11TaskPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const N11_TASK_DETAILS_URL =
  'https://api.n11.com/ms/product/task-details/page-query';

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

type ActiveUser = {
  id: number;
  username: string;
  isSuperAdmin: boolean;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetN11TaskPool) {
    global.cnetN11TaskPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11TaskPool;
}

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

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

    if (signatureBuffer.length !== expectedBuffer.length) return null;

    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as SessionPayload;

    if (
      !payload ||
      !payload.userId ||
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

async function getAuthenticatedUser(
  request: NextRequest
): Promise<ActiveUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const session = verifySession(token);

  if (!session?.userId) return null;

  const result = await getPool().query(
    `
      SELECT
        u.id,
        u.username,
        u.active,
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r
            ON r.id = ur.role_id
          WHERE ur.user_id = u.id
            AND r.code = 'super_admin'
            AND r.active = TRUE
        ) AS is_super_admin
      FROM public.users u
      WHERE u.id = $1
      LIMIT 1
    `,
    [session.userId]
  );

  const row = result.rows[0];

  if (!row || row.active !== true) {
    return null;
  }

  return {
    id: Number(row.id),
    username: String(row.username),
    isSuperAdmin: row.is_super_admin === true,
  };
}

async function requireSuperAdmin(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error: 'Oturum gerekli.',
        },
        401
      ),
    };
  }

  if (!user.isSuperAdmin) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error: 'Bu işlem yalnızca Super Admin tarafından yapılabilir.',
        },
        403
      ),
    };
  }

  return {
    user,
    response: null,
  };
}

function getN11Credentials() {
  const appKey = String(process.env.N11_APP_KEY || '').trim();
  const appSecret = String(process.env.N11_APP_SECRET || '').trim();

  if (!appKey || !appSecret) {
    return null;
  }

  return {
    appKey,
    appSecret,
  };
}

function parseTaskId(value: string | null) {
  const text = String(value || '').trim();

  if (!/^\d+$/.test(text)) return null;

  const number = Number(text);

  if (!Number.isSafeInteger(number) || number < 1) return null;

  return {
    text,
    number,
  };
}

function collectReasons(item: any) {
  const values: string[] = [];

  const add = (value: unknown) => {
    if (typeof value !== 'string') return;

    const text = value.trim();

    if (text && !values.includes(text)) {
      values.push(text);
    }
  };

  if (Array.isArray(item?.reasons)) {
    item.reasons.forEach(add);
  }

  if (Array.isArray(item?.sku?.reasons)) {
    item.sku.reasons.forEach(add);
  }

  return values;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function integerOrNull(value: unknown) {
  const number = numberOrNull(value);

  if (number === null) return null;

  return Math.trunc(number);
}


function requestIntent(requestPayload: any) {
  const sku =
    requestPayload?.payload &&
    Array.isArray(requestPayload.payload.skus) &&
    requestPayload.payload.skus.length > 0
      ? requestPayload.payload.skus[0]
      : null;

  const has = (key: string) =>
    Boolean(
      sku &&
        typeof sku === 'object' &&
        Object.prototype.hasOwnProperty.call(sku, key)
    );

  return {
    requestedPrice: has('salePrice') || has('listPrice'),
    requestedStock: has('quantity'),
  };
}

function detectN11PartialReason(reasons: string[]) {
  const joined = reasons.join(' ').toLocaleLowerCase('tr-TR');

  const priceNotUpdated =
    joined.includes('fiyat güncellenme izni olmadığı') ||
    joined.includes('fiyat güncelleme işlemi gerçekleştirilememiştir') ||
    joined.includes('fiyat güncellemesi gerçekleştirilememiştir');

  return {
    priceNotUpdated,
  };
}

async function fetchTaskDetails(
  taskId: number,
  credentials: { appKey: string; appSecret: string }
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(N11_TASK_DETAILS_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        appkey: credentials.appKey,
        appsecret: credentials.appSecret,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        taskId,
        pageable: {
          page: 0,
          size: 1000,
        },
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();

    let payload: any = null;

    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message =
        payload?.message ||
        payload?.error ||
        payload?.errorMessage ||
        payload?.title ||
        null;

      throw new Error(
        message
          ? `N11 API: ${String(message)}`
          : `N11 Task Detail HTTP ${response.status} hatası döndürdü.`
      );
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('N11 Task Detail geçersiz cevap döndürdü.');
    }

    return payload;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.toLowerCase().includes('aborted'))
    ) {
      throw new Error('N11 Task Detail 15 saniye içinde yanıt vermedi.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function updateDatabaseFromTask(params: {
  taskId: string;
  overallStatus: string;
  finalStatus: string;
  stockCode: string | null;
  listingId: number | null;
  skuStatus: string | null;
  reasons: string[];
  salePrice: number | null;
  listPrice: number | null;
  stock: number | null;
  rawPayload: unknown;
}) {
  const pool = getPool();

  const errorMessage =
    ['FAIL', 'REJECT', 'PARTIAL_SUCCESS', 'PRICE_NOT_UPDATED'].includes(
      params.finalStatus
    )
      ? params.reasons.join(' | ') || 'N11 task tam olarak uygulanmadı.'
      : null;

  await pool.query(
    `
      UPDATE public.online_tasks
      SET
        task_status = $2,
        checked_at = now(),
        completed_at = CASE
          WHEN $2 IN (
            'SUCCESS',
            'FAIL',
            'REJECT',
            'PARTIAL_SUCCESS',
            'PRICE_NOT_UPDATED'
          ) THEN now()
          ELSE completed_at
        END,
        response_payload = $3::jsonb,
        reasons = $4::jsonb,
        error_message = $5
      WHERE channel = 'N11'
        AND task_id = $1
    `,
    [
      params.taskId,
      params.finalStatus,
      JSON.stringify(params.rawPayload),
      JSON.stringify(params.reasons),
      errorMessage,
    ]
  );

  if (!params.listingId) {
    return;
  }

  if (params.finalStatus === 'SUCCESS') {
    await pool.query(
      `
        UPDATE public.online_listings
        SET
          sale_price = COALESCE($2, sale_price),
          list_price = COALESCE($3, list_price),
          quantity = COALESCE($4, quantity),
          sync_status = 'SYNCED',
          last_task_id = $5,
          last_task_status = 'SUCCESS',
          last_error = NULL,
          last_synced_at = now(),
          updated_at = now()
        WHERE id = $1
          AND channel = 'N11'
      `,
      [
        params.listingId,
        params.salePrice,
        params.listPrice,
        params.stock,
        params.taskId,
      ]
    );

    return;
  }

  if (
    params.finalStatus === 'FAIL' ||
    params.finalStatus === 'REJECT' ||
    params.finalStatus === 'PARTIAL_SUCCESS' ||
    params.finalStatus === 'PRICE_NOT_UPDATED'
  ) {
    await pool.query(
      `
        UPDATE public.online_listings
        SET
          sync_status = 'ERROR',
          last_task_id = $2,
          last_task_status = $3,
          last_error = $4,
          updated_at = now()
        WHERE id = $1
          AND channel = 'N11'
      `,
      [
        params.listingId,
        params.taskId,
        params.finalStatus,
        errorMessage,
      ]
    );

    return;
  }

  await pool.query(
    `
      UPDATE public.online_listings
      SET
        sync_status = 'IN_QUEUE',
        last_task_id = $2,
        last_task_status = 'IN_QUEUE',
        updated_at = now()
      WHERE id = $1
        AND channel = 'N11'
    `,
    [params.listingId, params.taskId]
  );
}

// ============================================================
// GET /api/online/n11/task?taskId=3276748599
//
// N11 task sonucunu kontrol eder.
// PROCESSED + SKU SUCCESS => SUCCESS
// PROCESSED + SKU FAIL    => FAIL
// REJECT                  => REJECT
// digerleri               => IN_QUEUE
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const parsedTaskId = parseTaskId(
      request.nextUrl.searchParams.get('taskId')
    );

    if (!parsedTaskId) {
      return json(
        {
          success: false,
          error: 'Geçerli bir taskId gerekli.',
        },
        400
      );
    }

    const credentials = getN11Credentials();

    if (!credentials) {
      return json(
        {
          success: false,
          error:
            'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.',
        },
        503
      );
    }

    const pool = getPool();

    const localTaskResult = await pool.query(
      `
        SELECT
          t.online_listing_id,
          t.stock_code,
          t.request_payload
        FROM public.online_tasks t
        WHERE t.channel = 'N11'
          AND t.task_id = $1
        LIMIT 1
      `,
      [parsedTaskId.text]
    );

    const localTask = localTaskResult.rows[0] ?? null;

    const listingId = localTask?.online_listing_id
      ? Number(localTask.online_listing_id)
      : null;

    const stockCode = localTask?.stock_code
      ? String(localTask.stock_code)
      : null;

    const intent = requestIntent(localTask?.request_payload ?? null);

    const payload = await fetchTaskDetails(
      parsedTaskId.number,
      credentials
    );

    const overallStatus = String(payload?.status || '')
      .trim()
      .toUpperCase();

    const content = Array.isArray(payload?.skus?.content)
      ? payload.skus.content
      : [];

    let matchedItem: any = null;

    if (stockCode) {
      matchedItem =
        content.find(
          (item: any) =>
            String(item?.itemCode || '').trim() === stockCode
        ) || null;
    }

    if (!matchedItem && content.length === 1) {
      matchedItem = content[0];
    }

    const skuStatus = matchedItem?.status
      ? String(matchedItem.status).trim().toUpperCase()
      : null;

    const reasons = collectReasons(matchedItem);

    const partial = detectN11PartialReason(reasons);

    let finalStatus = 'IN_QUEUE';

    if (overallStatus === 'REJECT') {
      finalStatus = 'REJECT';
    } else if (overallStatus === 'PROCESSED') {
      if (
        intent.requestedPrice &&
        partial.priceNotUpdated
      ) {
        finalStatus = intent.requestedStock
          ? 'PARTIAL_SUCCESS'
          : 'PRICE_NOT_UPDATED';
      } else if (skuStatus === 'SUCCESS') {
        finalStatus = 'SUCCESS';
      } else if (
        skuStatus === 'FAIL' ||
        skuStatus === 'FAILED' ||
        skuStatus === 'REJECT'
      ) {
        finalStatus = 'FAIL';
      } else {
        finalStatus = 'FAIL';

        if (!reasons.length) {
          reasons.push(
            'Task işlendi ancak SKU sonucu SUCCESS dönmedi.'
          );
        }
      }
    }

    const salePrice = numberOrNull(matchedItem?.sku?.salePrice);
    const listPrice = numberOrNull(matchedItem?.sku?.listPrice);
    const stock = integerOrNull(matchedItem?.sku?.stock);

    await updateDatabaseFromTask({
      taskId: parsedTaskId.text,
      overallStatus,
      finalStatus,
      stockCode,
      listingId,
      skuStatus,
      reasons,
      salePrice,
      listPrice,
      stock,
      rawPayload: payload,
    });

    return json({
      success: true,
      taskId: parsedTaskId.text,
      overallStatus,
      finalStatus,
      completed:
        finalStatus === 'SUCCESS' ||
        finalStatus === 'FAIL' ||
        finalStatus === 'REJECT' ||
        finalStatus === 'PARTIAL_SUCCESS' ||
        finalStatus === 'PRICE_NOT_UPDATED',
      stockCode:
        matchedItem?.itemCode !== null &&
        matchedItem?.itemCode !== undefined
          ? String(matchedItem.itemCode)
          : stockCode,
      skuStatus,
      salePrice,
      listPrice,
      stock,
      reasons,
      requestedPrice: intent.requestedPrice,
      requestedStock: intent.requestedStock,
      message:
        finalStatus === 'SUCCESS'
          ? 'N11 işlemi başarıyla tamamlandı.'
          : finalStatus === 'PRICE_NOT_UPDATED'
          ? `N11 task tamamlandı ancak fiyat güncellenmedi: ${
              reasons.join(' | ') || 'N11 fiyat güncellemesine izin vermedi.'
            }`
          : finalStatus === 'PARTIAL_SUCCESS'
          ? `N11 işlemi kısmen tamamlandı: ${
              reasons.join(' | ') || 'Bazı alanlar uygulanmadı.'
            }`
          : finalStatus === 'IN_QUEUE'
          ? 'N11 işlemi hâlâ kuyrukta.'
          : `N11 işlemi başarısız: ${
              reasons.join(' | ') || finalStatus
            }`,
      checkedBy: auth.user.username,
    });
  } catch (error) {
    console.error('N11 TASK DETAIL ERROR:', error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 task sonucu kontrol edilemedi.',
      },
      500
    );
  }
}
