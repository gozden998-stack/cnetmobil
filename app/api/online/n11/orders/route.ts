// app/api/online/n11/orders/route.ts
// CNETMOBIL ONLINE - N11 SIPARIS + STOK SENKRON MOTORU
// SADECE SUPER ADMIN.
// Yeni siparis görüldüğünde PostgreSQL stok/IMEI havuzu düşer
// ve kalan quantity N11 price-stock-update ile N11'e gönderilir.
// Eski orderStockLock kayıtları da otomatik tekrar senkronlanır.
//
// N11:
// GET https://api.n11.com/rest/delivery/v1/shipmentPackages
// Headers: appkey, appsecret

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11OrdersPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const N11_ORDERS_URL =
  'https://api.n11.com/rest/delivery/v1/shipmentPackages';
const N11_ORDER_UPDATE_URL =
  'https://api.n11.com/rest/order/v1/update';
const N11_PRICE_STOCK_UPDATE_URL =
  'https://api.n11.com/ms/product/tasks/price-stock-update';
const N11_INTEGRATOR = 'CNETMOBIL';

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

type N11OrderLine = {
  quantity: number;
  productId: string | null;
  productName: string | null;
  stockCode: string | null;
  price: number | null;
  dueAmount: number | null;
  sellerInvoiceAmount: number | null;
  orderLineId: string | null;
  status: string | null;
  variantAttributes: unknown[];
};

type N11Order = {
  packageId: string | null;
  orderNumber: string | null;
  customerFullName: string | null;
  customerEmail: string | null;
  customerId: string | null;
  city: string | null;
  district: string | null;
  cargoTrackingNumber: string | null;
  cargoTrackingLink: string | null;
  cargoProviderName: string | null;
  shipmentPackageStatus: string | null;
  lastModifiedDate: string | null;
  agreedDeliveryDate: string | null;
  totalAmount: number | null;
  totalDiscountAmount: number | null;
  totalQuantity: number;
  productSummary: string;
  lines: N11OrderLine[];
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

  if (!global.cnetN11OrdersPool) {
    global.cnetN11OrdersPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11OrdersPool;
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

function getN11Credentials() {
  const appKey = String(process.env.N11_APP_KEY || '').trim();
  const appSecret = String(process.env.N11_APP_SECRET || '').trim();

  if (!appKey || !appSecret) {
    return null;
  }

  return { appKey, appSecret };
}

function textOrNull(value: unknown) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text || null;
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : null;
}

function timestampToIso(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }

  try {
    return new Date(number).toISOString();
  } catch {
    return null;
  }
}

function safeLine(value: any): N11OrderLine {
  return {
    quantity: Number(value?.quantity || 0),
    productId: textOrNull(value?.productId),
    productName: textOrNull(value?.productName),
    stockCode: textOrNull(value?.stockCode),
    price: numberOrNull(value?.price),
    dueAmount: numberOrNull(value?.dueAmount),
    sellerInvoiceAmount: numberOrNull(
      value?.sellerInvoiceAmount
    ),
    orderLineId: textOrNull(value?.orderLineId),
    status: textOrNull(
      value?.orderItemLineItemStatusName
    ),
    variantAttributes: Array.isArray(
      value?.variantAttributes
    )
      ? value.variantAttributes
      : [],
  };
}

function safeOrder(value: any): N11Order {
  const lines = Array.isArray(value?.lines)
    ? value.lines.map(safeLine)
    : [];

  const totalQuantity = lines.reduce(
    (sum: number, line: N11OrderLine) =>
      sum + Number(line.quantity || 0),
    0
  );

  const productSummary = lines
    .map((line: N11OrderLine) => {
      const name = line.productName || 'Ürün';
      const qty = Number(line.quantity || 0);

      return qty > 1 ? `${name} x${qty}` : name;
    })
    .filter(Boolean)
    .join(' · ');

  return {
    packageId: textOrNull(value?.id),
    orderNumber: textOrNull(value?.orderNumber),
    customerFullName:
      textOrNull(value?.customerfullName) ||
      textOrNull(value?.shippingAddress?.fullName) ||
      textOrNull(value?.billingAddress?.fullName),
    customerEmail: textOrNull(value?.customerEmail),
    customerId: textOrNull(value?.customerId),
    city:
      textOrNull(value?.shippingAddress?.city) ||
      textOrNull(value?.billingAddress?.city),
    district:
      textOrNull(value?.shippingAddress?.district) ||
      textOrNull(value?.billingAddress?.district),
    cargoTrackingNumber: textOrNull(
      value?.cargoTrackingNumber
    ),
    cargoTrackingLink: textOrNull(
      value?.cargoTrackingLink
    ),
    cargoProviderName: textOrNull(
      value?.cargoProviderName
    ),
    shipmentPackageStatus: textOrNull(
      value?.shipmentPackageStatus
    ),
    lastModifiedDate: timestampToIso(
      value?.lastModifiedDate
    ),
    agreedDeliveryDate: timestampToIso(
      value?.agreedDeliveryDate
    ),
    totalAmount: numberOrNull(value?.totalAmount),
    totalDiscountAmount: numberOrNull(
      value?.totalDiscountAmount
    ),
    totalQuantity,
    productSummary,
    lines,
  };
}

async function fetchN11Orders(params: {
  appKey: string;
  appSecret: string;
  startDate: number;
  endDate: number;
  status: string;
}) {
  const allOrders: N11Order[] = [];

  let page = 0;
  let totalPages = 1;

  while (page < totalPages && page < 50) {
    const url = new URL(N11_ORDERS_URL);

    url.searchParams.set(
      'startDate',
      String(params.startDate)
    );
    url.searchParams.set(
      'endDate',
      String(params.endDate)
    );
    url.searchParams.set('status', params.status);
    url.searchParams.set('orderbyField', 'true');
    url.searchParams.set(
      'orderByDirection',
      'DESC'
    );
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', '100');

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      20_000
    );

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          appkey: params.appKey,
          appsecret: params.appSecret,
          Accept: 'application/json',
        },
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
          rawText.slice(0, 400) ||
          `HTTP ${response.status}`;

        throw new Error(
          `N11 sipariş API hatası: ${String(message)}`
        );
      }

      const content = Array.isArray(payload?.content)
        ? payload.content
        : [];

      for (const item of content) {
        allOrders.push(safeOrder(item));
      }

      const responseTotalPages = Number(
        payload?.totalPages ?? 0
      );

      totalPages =
        Number.isInteger(responseTotalPages) &&
        responseTotalPages > 0
          ? responseTotalPages
          : content.length < 100
          ? page + 1
          : page + 2;

      if (content.length === 0) {
        break;
      }

      page += 1;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return allOrders;
}




type OrderN11StockSyncResult = {
  success: boolean;
  stockCode: string;
  targetQuantity: number;
  taskId: string | null;
  taskStatus: string;
  reasons: string[];
  error: string | null;
};

function n11StockUpdateMessage(
  payload: any,
  rawText: string
) {
  const values = [
    payload?.message,
    payload?.error,
    payload?.errorMessage,
    payload?.reason,
    Array.isArray(payload?.reasons)
      ? payload.reasons.join(' | ')
      : null,
  ];

  for (const value of values) {
    const text =
      String(value ?? '').trim();

    if (text) {
      return text;
    }
  }

  return rawText
    .slice(0, 500)
    .trim();
}

async function sendN11OrderStockQuantity(
  params: {
    stockCode: string;
    quantity: number;
  }
): Promise<OrderN11StockSyncResult> {
  const credentials =
    getN11Credentials();

  const stockCode =
    String(
      params.stockCode || ''
    ).trim();

  const targetQuantity =
    Math.max(
      0,
      Math.floor(
        Number(
          params.quantity || 0
        )
      )
    );

  if (!credentials) {
    return {
      success: false,
      stockCode,
      targetQuantity,
      taskId: null,
      taskStatus: 'CONFIG_ERROR',
      reasons: [],
      error:
        'N11_APP_KEY veya N11_APP_SECRET eksik.',
    };
  }

  const requestPayload = {
    payload: {
      integrator:
        N11_INTEGRATOR,
      skus: [
        {
          stockCode,
          quantity:
            targetQuantity,
        },
      ],
    },
  };

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      20_000
    );

  try {
    const response =
      await fetch(
        N11_PRICE_STOCK_UPDATE_URL,
        {
          method: 'POST',
          cache: 'no-store',
          headers: {
            appkey:
              credentials.appKey,
            appsecret:
              credentials.appSecret,
            Accept:
              'application/json',
            'Content-Type':
              'application/json',
          },
          body:
            JSON.stringify(
              requestPayload
            ),
          signal:
            controller.signal,
        }
      );

    const rawText =
      await response.text();

    let payload: any = null;

    if (rawText) {
      try {
        payload =
          JSON.parse(rawText);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      return {
        success: false,
        stockCode,
        targetQuantity,
        taskId: null,
        taskStatus:
          `HTTP_${response.status}`,
        reasons: [],
        error:
          n11StockUpdateMessage(
            payload,
            rawText
          ) ||
          `N11 HTTP ${response.status}`,
      };
    }

    const taskId =
      payload?.id === null ||
      payload?.id === undefined
        ? null
        : String(
            payload.id
          );

    const taskStatus =
      String(
        payload?.status ||
          ''
      )
        .trim()
        .toUpperCase();

    const reasons =
      Array.isArray(
        payload?.reasons
      )
        ? payload.reasons.map(
            String
          )
        : [];

    if (
      taskStatus === 'REJECT'
    ) {
      return {
        success: false,
        stockCode,
        targetQuantity,
        taskId,
        taskStatus,
        reasons,
        error:
          reasons.join(' | ') ||
          'N11 stok güncellemesini reddetti.',
      };
    }

    if (
      !taskId ||
      taskStatus !==
        'IN_QUEUE'
    ) {
      return {
        success: false,
        stockCode,
        targetQuantity,
        taskId,
        taskStatus:
          taskStatus ||
          'UNKNOWN',
        reasons,
        error:
          `N11 stok güncellemesi beklenmeyen cevap döndürdü: ${
            taskStatus ||
            'STATUS YOK'
          }`,
      };
    }

    return {
      success: true,
      stockCode,
      targetQuantity,
      taskId,
      taskStatus,
      reasons,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      stockCode,
      targetQuantity,
      taskId: null,
      taskStatus:
        'REQUEST_ERROR',
      reasons: [],
      error:
        error instanceof Error
          ? error.message
          : 'N11 stok güncelleme bağlantı hatası.',
    };
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

async function saveOrderN11StockSyncResult(
  result: OrderN11StockSyncResult
) {
  const patch = {
    orderN11StockSyncPending:
      true,
    orderN11StockTargetQuantity:
      result.targetQuantity,
    orderN11StockTaskId:
      result.taskId,
    orderN11StockTaskStatus:
      result.taskStatus,
    orderN11StockLastSentAt:
      new Date().toISOString(),
    orderN11StockLastError:
      result.error,
  };

  await getPool().query(
    `
      UPDATE public.online_listings
      SET
        raw_data =
          COALESCE(
            raw_data,
            '{}'::jsonb
          )
          || $2::jsonb,
        updated_at = now()
      WHERE channel = 'N11'
        AND external_stock_code = $1
    `,
    [
      result.stockCode,
      JSON.stringify(
        patch
      ),
    ]
  );
}

async function syncOrderTargetsToN11(
  targets: Array<{
    stockCode: string;
    quantity: number;
  }>
) {
  const unique =
    new Map<
      string,
      number
    >();

  for (const target of targets) {
    const stockCode =
      String(
        target.stockCode ||
          ''
      ).trim();

    if (!stockCode) {
      continue;
    }

    unique.set(
      stockCode,
      Math.max(
        0,
        Math.floor(
          Number(
            target.quantity ||
              0
          )
        )
      )
    );
  }

  const entries =
    Array.from(
      unique.entries()
    );

  const results:
    OrderN11StockSyncResult[] =
    [];

  let nextIndex = 0;

  const worker =
    async () => {
      while (true) {
        const index =
          nextIndex;

        nextIndex += 1;

        if (
          index >=
          entries.length
        ) {
          return;
        }

        const [
          stockCode,
          quantity,
        ] = entries[index];

        const syncResult =
          await sendN11OrderStockQuantity(
            {
              stockCode,
              quantity,
            }
          );

        results.push(
          syncResult
        );

        await saveOrderN11StockSyncResult(
          syncResult
        ).catch(
          () => undefined
        );
      }
    };

  const workerCount =
    Math.min(
      3,
      entries.length
    );

  if (workerCount > 0) {
    await Promise.all(
      Array.from(
        {
          length:
            workerCount,
        },
        () => worker()
      )
    );
  }

  return results;
}

function orderStockSentRecently(
  value: unknown
) {
  const time =
    new Date(
      String(
        value ?? ''
      )
    ).getTime();

  return (
    Number.isFinite(time) &&
    Date.now() - time <
      45_000
  );
}

async function repairPendingOrderStockLocks() {
  const result =
    await getPool().query(
      `
        SELECT
          external_stock_code,
          quantity,
          raw_data
        FROM public.online_listings
        WHERE channel = 'N11'
          AND COALESCE(
            raw_data->>'orderStockLock',
            'false'
          ) = 'true'
          AND external_stock_code IS NOT NULL
        ORDER BY updated_at ASC
        LIMIT 100
      `
    );

  const targets: Array<{
    stockCode: string;
    quantity: number;
  }> = [];

  let skippedRecent = 0;

  for (const row of result.rows) {
    const raw =
      orderRawObject(
        row.raw_data
      );

    if (
      orderStockSentRecently(
        raw.orderN11StockLastSentAt
      )
    ) {
      skippedRecent += 1;
      continue;
    }

    targets.push({
      stockCode:
        String(
          row.external_stock_code
        ).trim(),
      quantity:
        orderNonNegativeInt(
          raw.orderExpectedMaxQuantity,
          orderNonNegativeInt(
            row.quantity,
            0
          )
        ),
    });
  }

  const results =
    targets.length
      ? await syncOrderTargetsToN11(
          targets
        )
      : [];

  return {
    lockedCount:
      result.rows.length,
    attemptedCount:
      targets.length,
    skippedRecent,
    successCount:
      results.filter(
        (item) =>
          item.success
      ).length,
    errorCount:
      results.filter(
        (item) =>
          !item.success
      ).length,
    results,
  };
}

function orderRawObject(
  value: unknown
): Record<string, any> {
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  ) {
    return value as Record<string, any>;
  }

  return {};
}

function orderUniqueStrings(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          String(item ?? '').trim()
        )
        .filter(Boolean)
    )
  );
}

function orderNonNegativeInt(
  value: unknown,
  fallback = 0
) {
  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return fallback;
  }

  return Math.floor(parsed);
}

function buildOrderLineKey(
  order: N11Order,
  line: N11OrderLine
) {
  const lineId = String(
    line.orderLineId || ''
  ).trim();

  if (lineId) {
    return `N11-LINE:${lineId}`;
  }

  return [
    'N11-FALLBACK',
    order.packageId || '',
    order.orderNumber || '',
    line.stockCode || '',
    line.productId || '',
    String(line.quantity || 0),
  ].join(':');
}

async function applyOrderStockLocks(
  orders: N11Order[]
) {
  const events = new Map<
    string,
    {
      eventKey: string;
      stockCode: string;
      quantity: number;
      orderNumber: string | null;
      packageId: string | null;
      orderLineId: string | null;
      status: string | null;
      productName: string | null;
    }
  >();

  for (const order of orders) {
    for (const line of order.lines || []) {
      const stockCode = String(
        line.stockCode || ''
      ).trim();

      if (!stockCode) continue;

      const eventKey =
        buildOrderLineKey(
          order,
          line
        );

      if (events.has(eventKey)) {
        continue;
      }

      events.set(eventKey, {
        eventKey,
        stockCode,
        quantity:
          Math.max(
            1,
            orderNonNegativeInt(
              line.quantity,
              1
            )
          ),
        orderNumber:
          order.orderNumber || null,
        packageId:
          order.packageId || null,
        orderLineId:
          line.orderLineId || null,
        status:
          order.shipmentPackageStatus ||
          null,
        productName:
          line.productName || null,
      });
    }
  }

  if (events.size === 0) {
    return {
      matchedStockCodeCount: 0,
      updatedListingCount: 0,
      processedOrderLineCount: 0,
      skippedProcessedCount: 0,
      n11StockSync: {
        attemptedCount: 0,
        successCount: 0,
        errorCount: 0,
        results: [] as OrderN11StockSyncResult[],
      },
      stockCodes: [] as string[],
    };
  }

  const client =
    await getPool().connect();

  let updatedListingCount = 0;
  let processedOrderLineCount = 0;
  let skippedProcessedCount = 0;

  const touchedStockCodes =
    new Set<string>();

  const n11StockTargets =
    new Map<
      string,
      number
    >();

  try {
    await client.query('BEGIN');

    for (const item of events.values()) {
      const listingResult =
        await client.query(
          `
            SELECT *
            FROM public.online_listings
            WHERE channel = 'N11'
              AND external_stock_code = $1
            LIMIT 1
            FOR UPDATE
          `,
          [item.stockCode]
        );

      const listing =
        listingResult.rows[0];

      if (!listing) {
        continue;
      }

      const raw =
        orderRawObject(
          listing.raw_data
        );

      let processedKeys =
        orderUniqueStrings(
          raw.processedOrderLineKeys
        );

      if (
        processedKeys.includes(
          item.eventKey
        )
      ) {
        skippedProcessedCount += 1;
        continue;
      }

      const poolEnabled =
        raw.poolEnabled === true;

      let pooledImeis =
        orderUniqueStrings(
          raw.pooledImeis
        );

      let availableImeis =
        orderUniqueStrings(
          raw.availableImeis
        );

      let soldImeis =
        orderUniqueStrings(
          raw.soldImeis
        );

      let legacyUnmappedQuantity =
        orderNonNegativeInt(
          raw.legacyUnmappedQuantity,
          0
        );

      const currentQuantity =
        orderNonNegativeInt(
          listing.quantity,
          0
        );

      // Pool varsa fiziksel stok kaynağımız raw_data içindeki
      // legacy + available IMEI havuzudur.
      // Böylece N11 product-query siparişi bizden önce yansıtsa bile
      // quantity'yi ikinci kez düşürmeyiz.
      let poolQuantityBefore =
        legacyUnmappedQuantity +
        availableImeis.length;

      if (
        poolEnabled &&
        currentQuantity >
          poolQuantityBefore
      ) {
        legacyUnmappedQuantity +=
          currentQuantity -
          poolQuantityBefore;

        poolQuantityBefore =
          legacyUnmappedQuantity +
          availableImeis.length;
      }

      let remaining =
        item.quantity;

      const consumedImeis: string[] =
        [];

      if (poolEnabled) {
        const legacyConsumed =
          Math.min(
            legacyUnmappedQuantity,
            remaining
          );

        legacyUnmappedQuantity -=
          legacyConsumed;

        remaining -=
          legacyConsumed;

        while (
          remaining > 0 &&
          availableImeis.length > 0
        ) {
          const consumed =
            availableImeis.shift();

          if (consumed) {
            consumedImeis.push(
              consumed
            );

            if (
              !soldImeis.includes(
                consumed
              )
            ) {
              soldImeis.push(
                consumed
              );
            }
          }

          remaining -= 1;
        }
      }

      const newQuantity =
        poolEnabled
          ? Math.max(
              0,
              legacyUnmappedQuantity +
                availableImeis.length
            )
          : Math.max(
              0,
              currentQuantity -
                item.quantity
            );

      processedKeys = Array.from(
        new Set([
          ...processedKeys,
          item.eventKey,
        ])
      ).slice(-500);

      const updatedRaw = {
        ...raw,
        poolEnabled:
          poolEnabled ||
          raw.poolEnabled === true,
        pooledImeis,
        availableImeis,
        soldImeis,
        legacyUnmappedQuantity,
        processedOrderLineKeys:
          processedKeys,
        orderStockLock: true,
        orderExpectedMaxQuantity:
          newQuantity,
        lastOrderNumber:
          item.orderNumber,
        lastOrderPackageId:
          item.packageId,
        lastOrderLineId:
          item.orderLineId,
        lastOrderStatus:
          item.status,
        lastOrderQuantity:
          item.quantity,
        lastOrderConsumedImeis:
          consumedImeis,
        lastOrderSeenAt:
          new Date().toISOString(),
      };

      const updateResult =
        await client.query(
          `
            UPDATE public.online_listings
            SET
              quantity = $2,
              sale_status =
                CASE
                  WHEN $2 <= 0
                    THEN 'ORDER_RECEIVED'
                  ELSE 'ORDER_RECEIVED_PARTIAL'
                END,
              raw_data = $3::jsonb,
              updated_at = now()
            WHERE id = $1
            RETURNING id
          `,
          [
            Number(listing.id),
            newQuantity,
            JSON.stringify(
              updatedRaw
            ),
          ]
        );

      if (
        updateResult.rowCount
      ) {
        updatedListingCount += 1;
        processedOrderLineCount += 1;
        touchedStockCodes.add(
          item.stockCode
        );

        n11StockTargets.set(
          item.stockCode,
          newQuantity
        );
      }
    }

    await client.query('COMMIT');

    const n11SyncResults =
      n11StockTargets.size > 0
        ? await syncOrderTargetsToN11(
            Array.from(
              n11StockTargets.entries()
            ).map(
              ([
                stockCode,
                quantity,
              ]) => ({
                stockCode,
                quantity,
              })
            )
          )
        : [];

    return {
      matchedStockCodeCount:
        touchedStockCodes.size,
      updatedListingCount,
      processedOrderLineCount,
      skippedProcessedCount,
      n11StockSync: {
        attemptedCount:
          n11SyncResults.length,
        successCount:
          n11SyncResults.filter(
            (item) =>
              item.success
          ).length,
        errorCount:
          n11SyncResults.filter(
            (item) =>
              !item.success
          ).length,
        results:
          n11SyncResults,
      },
      stockCodes:
        Array.from(
          touchedStockCodes
        ),
    };
  } catch (error) {
    await client
      .query('ROLLBACK')
      .catch(() => undefined);

    throw error;
  } finally {
    client.release();
  }
}

// ============================================================
// GET /api/online/n11/orders
// READ-ONLY.
// Varsayilan son 30 gun + Created.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user =
      await getAuthenticatedUser(request);

    if (!user) {
      return json(
        {
          success: false,
          error: 'Oturum gerekli.',
        },
        401
      );
    }

    if (!user.isSuperAdmin) {
      return json(
        {
          success: false,
          error:
            'Bu işlem yalnızca Super Admin tarafından yapılabilir.',
        },
        403
      );
    }

    const credentials = getN11Credentials();

    if (!credentials) {
      return json(
        {
          success: false,
          error:
            'N11_APP_KEY veya N11_APP_SECRET eksik.',
        },
        503
      );
    }

    const url = new URL(request.url);
    const requestedStatus = String(
      url.searchParams.get('status') || 'ALL'
    ).trim();

    const stockOnly =
      url.searchParams.get('stockOnly') === '1';

    const supportedStatuses = [
      'Created',
      'Picking',
      'Shipped',
      'Delivered',
    ] as const;

    if (
      requestedStatus !== 'ALL' &&
      !supportedStatuses.includes(
        requestedStatus as
          | 'Created'
          | 'Picking'
          | 'Shipped'
          | 'Delivered'
      )
    ) {
      return json(
        {
          success: false,
          error:
            'N11 sipariş statüsü geçersiz.',
        },
        400
      );
    }

    const now = Date.now();
    const startDate =
      now - 30 * 24 * 60 * 60 * 1000;

    const statusesToFetch =
      requestedStatus === 'ALL'
        ? supportedStatuses
        : [
            requestedStatus as
              | 'Created'
              | 'Picking'
              | 'Shipped'
              | 'Delivered',
          ];

    const results = await Promise.all(
      statusesToFetch.map(async (status) => {
        const orders = await fetchN11Orders({
          appKey: credentials.appKey,
          appSecret: credentials.appSecret,
          startDate,
          endDate: now,
          status,
        });

        orders.sort((a, b) => {
          const aTime = a.lastModifiedDate
            ? new Date(
                a.lastModifiedDate
              ).getTime()
            : 0;

          const bTime = b.lastModifiedDate
            ? new Date(
                b.lastModifiedDate
              ).getTime()
            : 0;

          return bTime - aTime;
        });

        const totalAmount = orders.reduce(
          (sum, order) =>
            sum +
            Number(order.totalAmount || 0),
          0
        );

        const totalQuantity = orders.reduce(
          (sum, order) =>
            sum +
            Number(order.totalQuantity || 0),
          0
        );

        return {
          status,
          count: orders.length,
          totalQuantity,
          totalAmount,
          orders,
        };
      })
    );

    const groups: Record<
      string,
      {
        status: string;
        count: number;
        totalQuantity: number;
        totalAmount: number;
        orders: N11Order[];
      }
    > = {};

    for (const result of results) {
      groups[result.status] = result;
    }

    const emptyGroup = (status: string) => ({
      status,
      count: 0,
      totalQuantity: 0,
      totalAmount: 0,
      orders: [] as N11Order[],
    });

    const created =
      groups.Created ||
      emptyGroup('Created');
    const picking =
      groups.Picking ||
      emptyGroup('Picking');
    const shipped =
      groups.Shipped ||
      emptyGroup('Shipped');
    const delivered =
      groups.Delivered ||
      emptyGroup('Delivered');

    const allOrders = [
      ...created.orders,
      ...picking.orders,
      ...shipped.orders,
      ...delivered.orders,
    ];

    // KRİTİK:
    // Yalnızca YENİ (Created) siparişler stok motoruna girer.
    // Tek cihazda quantity 1 -> 0 olur.
    // Aynı varyant IMEI havuzu varsa quantity sadece sipariş adedi kadar azalır.
    // processedOrderLineKeys aynı sipariş satırının ikinci kez düşmesini engeller.
    // orderExpectedMaxQuantity canlı product-query gecikmesine karşı geçici üst sınırdır.
    const stockLockResult =
      await applyOrderStockLocks(
        created.orders
      );

    const stockRepairResult =
      await repairPendingOrderStockLocks();

    if (stockOnly) {
      return json({
        success: true,
        channel: 'N11',
        stockOnly: true,
        requestedStatus,
        orderCount:
          allOrders.length,
        matchedStockCodeCount:
          stockLockResult
            .matchedStockCodeCount,
        updatedListingCount:
          stockLockResult
            .updatedListingCount,
        n11StockSync:
          stockLockResult
            .n11StockSync,
        stockRepair:
          stockRepairResult,
        checkedAt:
          new Date().toISOString(),
        checkedBy:
          user.username,
      });
    }

    return json({
      success: true,
      channel: 'N11',
      period: {
        startDate:
          new Date(startDate).toISOString(),
        endDate: new Date(now).toISOString(),
        days: 30,
      },
      groups: {
        Created: created,
        Picking: picking,
        Shipped: shipped,
        Delivered: delivered,
      },
      counts: {
        newOrders: created.count,
        preparing: picking.count,
        shipped: shipped.count,
        delivered: delivered.count,
        total: allOrders.length,
      },
      count: allOrders.length,
      orders: allOrders,
      stockSync: {
        matchedStockCodeCount:
          stockLockResult
            .matchedStockCodeCount,
        updatedListingCount:
          stockLockResult
            .updatedListingCount,
        processedOrderLineCount:
          stockLockResult
            .processedOrderLineCount,
        skippedProcessedCount:
          stockLockResult
            .skippedProcessedCount,
        n11StockSync:
          stockLockResult
            .n11StockSync,
        repair:
          stockRepairResult,
      },
      checkedAt: new Date().toISOString(),
      checkedBy: user.username,
    });
  } catch (error) {
    console.error('N11 ORDERS ERROR:', error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 siparişleri alınamadı.',
      },
      500
    );
  }
}


// ============================================================
// PUT /api/online/n11/orders
// ACTION: APPROVE
// Created siparis kalemlerini Picking durumuna alir.
// N11 dokumanina gore su an UpdateOrder ile desteklenen
// tek write islemi Picking/onaydir.
// ============================================================
export async function PUT(request: NextRequest) {
  try {
    const user =
      await getAuthenticatedUser(request);

    if (!user) {
      return json(
        {
          success: false,
          error: 'Oturum gerekli.',
        },
        401
      );
    }

    if (!user.isSuperAdmin) {
      return json(
        {
          success: false,
          error:
            'Bu işlem yalnızca Super Admin tarafından yapılabilir.',
        },
        403
      );
    }

    const credentials = getN11Credentials();

    if (!credentials) {
      return json(
        {
          success: false,
          error:
            'N11_APP_KEY veya N11_APP_SECRET eksik.',
        },
        503
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return json(
        {
          success: false,
          error: 'Geçersiz istek.',
        },
        400
      );
    }

    const action = String(
      (body as Record<string, unknown>).action || ''
    )
      .trim()
      .toUpperCase();

    if (action !== 'APPROVE') {
      return json(
        {
          success: false,
          error:
            'Bu endpoint şu an yalnızca APPROVE işlemini destekliyor.',
        },
        400
      );
    }

    const rawLineIds = (
      body as Record<string, unknown>
    ).lineIds;

    if (!Array.isArray(rawLineIds)) {
      return json(
        {
          success: false,
          error: 'lineIds alanı zorunludur.',
        },
        400
      );
    }

    const lineIds = Array.from(
      new Set(
        rawLineIds
          .map((value) => Number(value))
          .filter(
            (value) =>
              Number.isInteger(value) &&
              value > 0
          )
      )
    );

    if (lineIds.length === 0) {
      return json(
        {
          success: false,
          error:
            'Onaylanacak geçerli N11 orderLineId bulunamadı.',
        },
        400
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      20_000
    );

    let response: Response;
    let rawText = '';

    try {
      response = await fetch(N11_ORDER_UPDATE_URL, {
        method: 'PUT',
        cache: 'no-store',
        headers: {
          appkey: credentials.appKey,
          appsecret: credentials.appSecret,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          lines: lineIds.map((lineId) => ({
            lineId,
          })),
          status: 'Picking',
        }),
        signal: controller.signal,
      });

      rawText = await response.text();
    } finally {
      clearTimeout(timeoutId);
    }

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
        rawText.slice(0, 500) ||
        `HTTP ${response.status}`;

      return json(
        {
          success: false,
          error: `N11 sipariş onayı başarısız: ${String(
            message
          )}`,
          n11HttpStatus: response.status,
        },
        response.status >= 400 &&
          response.status < 600
          ? response.status
          : 502
      );
    }

    const content = Array.isArray(payload?.content)
      ? payload.content
      : [];

    const results = content.map((item: any) => ({
      lineId:
        item?.lineId === null ||
        item?.lineId === undefined
          ? null
          : String(item.lineId),
      status: textOrNull(item?.status),
      reasons: textOrNull(item?.reasons),
    }));

    const failed = results.filter(
      (item: any) =>
        String(item.status || '').toUpperCase() !==
        'SUCCESS'
    );

    if (results.length === 0) {
      return json(
        {
          success: false,
          error:
            'N11 sipariş onayı yanıt verdi ancak satır sonucu dönmedi.',
          rawResponse: payload,
        },
        502
      );
    }

    if (failed.length > 0) {
      return json(
        {
          success: false,
          partial: failed.length < results.length,
          error:
            failed.length < results.length
              ? 'Sipariş kalemlerinin bir kısmı onaylandı, bir kısmı reddedildi.'
              : 'N11 sipariş kalemlerini onaylamadı.',
          results,
        },
        409
      );
    }

    return json({
      success: true,
      action: 'APPROVE',
      newStatus: 'Picking',
      approvedLineCount: results.length,
      results,
      message:
        'Sipariş N11 üzerinde onaylandı ve Hazırlanıyor (Picking) durumuna geçti.',
      updatedBy: user.username,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('N11 ORDER APPROVE ERROR:', error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 sipariş onayı tamamlanamadı.',
      },
      500
    );
  }
}
