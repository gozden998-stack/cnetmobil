// app/api/online/n11/orders/route.ts
// CNETMOBIL ONLINE - N11 GERCEK SIPARIS LISTESI
// READ-ONLY.
// SADECE SUPER ADMIN.
// N11 REST GetShipmentPackages kullanir.
// Varsayilan: son 30 gun + Created statulu yeni siparisler.
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

    const requestedStatus =
      String(
        url.searchParams.get('status') || 'Created'
      ).trim() || 'Created';

    const allowedStatuses = new Set([
      'Created',
      'Picking',
      'Shipped',
      'Cancelled',
      'Delivered',
      'UnPacked',
      'UnSupplied',
    ]);

    if (!allowedStatuses.has(requestedStatus)) {
      return json(
        {
          success: false,
          error: 'N11 sipariş statüsü geçersiz.',
        },
        400
      );
    }

    const now = Date.now();
    const startDate =
      now - 30 * 24 * 60 * 60 * 1000;

    const orders = await fetchN11Orders({
      appKey: credentials.appKey,
      appSecret: credentials.appSecret,
      startDate,
      endDate: now,
      status: requestedStatus,
    });

    orders.sort((a, b) => {
      const aTime = a.lastModifiedDate
        ? new Date(a.lastModifiedDate).getTime()
        : 0;

      const bTime = b.lastModifiedDate
        ? new Date(b.lastModifiedDate).getTime()
        : 0;

      return bTime - aTime;
    });

    const totalAmount = orders.reduce(
      (sum, order) =>
        sum + Number(order.totalAmount || 0),
      0
    );

    const totalQuantity = orders.reduce(
      (sum, order) =>
        sum + Number(order.totalQuantity || 0),
      0
    );

    return json({
      success: true,
      channel: 'N11',
      readOnly: true,
      status: requestedStatus,
      period: {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(now).toISOString(),
        days: 30,
      },
      count: orders.length,
      totalQuantity,
      totalAmount,
      orders,
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
