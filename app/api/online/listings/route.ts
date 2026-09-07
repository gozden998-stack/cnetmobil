// app/api/online/listings/route.ts
// CNETMOBIL ONLINE - N11 urun yonetimi
// GERCEK N11 urun olusturma + fiyat / stok guncelleme.
// Yeni fiziksel cihaz icin stockCode = IMEI.
// Ilk hizli create, ayni ozellikte mevcut N11 urununu katalog sablonu olarak kullanir.
// stock_devices / WingSM bagimliligi simdilik YOK.
// SADECE SUPER ADMIN.

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetOnlineListingsPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const N11_PRICE_STOCK_UPDATE_URL =
  'https://api.n11.com/ms/product/tasks/price-stock-update';
const N11_PRODUCT_CREATE_URL =
  'https://api.n11.com/ms/product/tasks/product-create';
const N11_TASK_DETAILS_URL =
  'https://api.n11.com/ms/product/task-details/page-query';
const N11_PRODUCT_QUERY_URL =
  'https://api.n11.com/ms/product-query';
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
  branch: string;
  role: string;
  stockBranchCode: string | null;
  isSuperAdmin: boolean;
};

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL bulunamadı.');
  }

  if (!global.cnetOnlineListingsPool) {
    global.cnetOnlineListingsPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetOnlineListingsPool;
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
    if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

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

function validateOrigin(request: NextRequest) {
  if (request.method === 'GET') return true;

  const origin = request.headers.get('origin');
  const expectedAppUrl = process.env.APP_URL;

  if (!expectedAppUrl) {
    const host = request.headers.get('host');
    const proto =
      request.headers.get('x-forwarded-proto') ||
      request.nextUrl.protocol.replace(':', '');

    if (!host || !origin) return false;
    return origin === `${proto}://${host}`;
  }

  try {
    return origin === new URL(expectedAppUrl).origin;
  } catch {
    return false;
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
        u.branch,
        u.role,
        u.active,
        u.stock_branch_code,
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN public.roles r ON r.id = ur.role_id
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
  if (!row || row.active !== true) return null;

  return {
    id: Number(row.id),
    username: String(row.username),
    branch: String(row.branch),
    role: String(row.role),
    stockBranchCode: row.stock_branch_code
      ? String(row.stock_branch_code)
      : null,
    isSuperAdmin: row.is_super_admin === true,
  };
}

async function requireSuperAdmin(request: NextRequest) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      user: null,
      response: json({ success: false, error: 'Oturum gerekli.' }, 401),
    };
  }

  if (!user.isSuperAdmin) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error: 'ONLINE modülü yalnızca Super Admin tarafından yönetilebilir.',
        },
        403
      ),
    };
  }

  return { user, response: null };
}

function cleanText(value: unknown, field: string, maxLength: number) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`${field} zorunludur.`);
  }

  if (text.length > maxLength) {
    throw new Error(`${field} çok uzun.`);
  }

  return text;
}

function parseMoney(value: unknown, field: string) {
  const text = String(value ?? '').trim();

  if (!text) {
    throw new Error(`${field} zorunludur.`);
  }

  let normalized = text.replace(/\s/g, '');

  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const amount = Number(normalized);

  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`${field} geçersiz.`);
  }

  return Number(amount.toFixed(2));
}

function parsePositiveId(value: unknown) {
  const id = Number(value);

  if (!Number.isInteger(id) || id < 1) return null;

  return id;
}


function getN11DefaultVatRate(channelRow: any) {
  const envValue = String(process.env.N11_DEFAULT_VAT_RATE || '').trim();

  const rawValue =
    envValue !== ''
      ? envValue
      : channelRow?.default_vat_rate !== null &&
        channelRow?.default_vat_rate !== undefined
      ? String(channelRow.default_vat_rate)
      : '';

  const vatRate = Number(rawValue);

  if (![0, 1, 10, 20].includes(vatRate)) {
    throw new Error(
      'N11_DEFAULT_VAT_RATE eksik/geçersiz. Coolify ENV içine mağazada kullandığınız KDV oranını 0, 1, 10 veya 20 olarak girin.'
    );
  }

  return vatRate;
}

function normalizeCompare(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR');
}

function rawN11Product(row: any) {
  const raw = row?.raw_data;

  if (!raw || typeof raw !== 'object') return null;

  const n11 = (raw as any).n11;

  return n11 && typeof n11 === 'object' ? n11 : null;
}

function positiveIntegerOrNull(value: unknown) {
  const number = Number(value);

  if (!Number.isInteger(number) || number < 1) {
    return null;
  }

  return number;
}

async function findCatalogTemplate(params: {
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
}) {
  const result = await getPool().query(
    `
      SELECT *
      FROM public.online_listings
      WHERE channel = 'N11'
        AND external_product_id IS NOT NULL
        AND category_id IS NOT NULL
        AND external_product_main_id IS NOT NULL
        AND shipment_template IS NOT NULL
        AND LOWER(TRIM(COALESCE(brand, ''))) = LOWER(TRIM($1))
        AND LOWER(TRIM(COALESCE(model, ''))) = LOWER(TRIM($2))
        AND LOWER(TRIM(COALESCE(memory, ''))) = LOWER(TRIM($3))
        AND LOWER(TRIM(COALESCE(color, ''))) = LOWER(TRIM($4))
        AND LOWER(TRIM(COALESCE(grade, ''))) = LOWER(TRIM($5))
        AND LOWER(TRIM(COALESCE(warranty, ''))) = LOWER(TRIM($6))
      ORDER BY
        CASE WHEN product_status = 'Active' THEN 0 ELSE 1 END,
        last_synced_at DESC NULLS LAST,
        updated_at DESC
      LIMIT 10
    `,
    [
      params.brand,
      params.model,
      params.memory,
      params.color,
      params.grade,
      params.warranty,
    ]
  );

  for (const row of result.rows) {
    const rawProduct = rawN11Product(row);
    const catalogId = positiveIntegerOrNull(rawProduct?.catalogId);

    if (!catalogId) continue;

    return {
      row,
      rawProduct,
      catalogId,
    };
  }

  return null;
}

async function sendN11ProductCreate(sku: Record<string, unknown>) {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.'
    );
  }

  const requestPayload = {
    payload: {
      integrator: N11_INTEGRATOR,
      skus: [sku],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(N11_PRODUCT_CREATE_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        appkey: credentials.appKey,
        appsecret: credentials.appSecret,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    const rawText = await response.text();

    let responsePayload: any = null;

    if (rawText) {
      try {
        responsePayload = JSON.parse(rawText);
      } catch {
        responsePayload = null;
      }
    }

    if (!response.ok) {
      const n11Message = safeN11Message(responsePayload, rawText);

      throw new Error(
        n11Message
          ? `N11 API: ${n11Message}`
          : `N11 ürün oluşturma servisi HTTP ${response.status} hatası döndürdü.`
      );
    }

    if (!responsePayload || typeof responsePayload !== 'object') {
      throw new Error('N11 ürün oluşturma servisi geçersiz cevap döndürdü.');
    }

    const taskId =
      responsePayload.id === null || responsePayload.id === undefined
        ? null
        : String(responsePayload.id);

    const taskStatus = String(responsePayload.status || '')
      .trim()
      .toUpperCase();

    const taskType = String(
      responsePayload.type || 'PRODUCT_CREATE'
    ).trim();

    const reasons = Array.isArray(responsePayload.reasons)
      ? responsePayload.reasons.map(String)
      : [];

    return {
      requestPayload,
      responsePayload,
      taskId,
      taskStatus,
      taskType,
      reasons,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.toLowerCase().includes('aborted'))
    ) {
      throw new Error('N11 ürün oluşturma servisi 20 saniye içinde yanıt vermedi.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function getN11TaskOnce(taskId: string) {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.'
    );
  }

  const numericTaskId = Number(taskId);

  if (!Number.isSafeInteger(numericTaskId) || numericTaskId < 1) {
    throw new Error('N11 taskId geçersiz.');
  }

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
      taskId: numericTaskId,
      pageable: {
        page: 0,
        size: 1000,
      },
    }),
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
    const message = safeN11Message(payload, rawText);

    throw new Error(
      message
        ? `N11 Task Detail: ${message}`
        : `N11 Task Detail HTTP ${response.status} hatası döndürdü.`
    );
  }

  const overallStatus = String(payload?.status || '')
    .trim()
    .toUpperCase();

  const content = Array.isArray(payload?.skus?.content)
    ? payload.skus.content
    : [];

  return {
    payload,
    overallStatus,
    content,
  };
}

async function waitForCreateTask(taskId: string, stockCode: string) {
  const maxAttempts = 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await getN11TaskOnce(taskId);

    if (result.overallStatus === 'REJECT') {
      return {
        completed: true,
        success: false,
        status: 'REJECT',
        reasons: ['N11 task reddedildi.'],
        payload: result.payload,
      };
    }

    if (result.overallStatus === 'PROCESSED') {
      const matched =
        result.content.find(
          (item: any) =>
            String(item?.itemCode || '').trim() === stockCode
        ) ||
        (result.content.length === 1 ? result.content[0] : null);

      const skuStatus = String(matched?.status || '')
        .trim()
        .toUpperCase();

      const reasons: string[] = [];

      if (Array.isArray(matched?.reasons)) {
        matched.reasons.forEach((item: unknown) => {
          if (typeof item === 'string' && item.trim()) {
            reasons.push(item.trim());
          }
        });
      }

      if (Array.isArray(matched?.sku?.reasons)) {
        matched.sku.reasons.forEach((item: unknown) => {
          if (
            typeof item === 'string' &&
            item.trim() &&
            !reasons.includes(item.trim())
          ) {
            reasons.push(item.trim());
          }
        });
      }

      return {
        completed: true,
        success: skuStatus === 'SUCCESS',
        status: skuStatus || 'FAIL',
        reasons,
        payload: result.payload,
      };
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    completed: false,
    success: false,
    status: 'IN_QUEUE',
    reasons: [],
    payload: null,
  };
}

async function queryN11ProductByStockCode(stockCode: string) {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.'
    );
  }

  const url = new URL(N11_PRODUCT_QUERY_URL);
  url.searchParams.set('stockCode', stockCode);
  url.searchParams.set('page', '0');
  url.searchParams.set('size', '20');

  const response = await fetch(url.toString(), {
    method: 'GET',
    cache: 'no-store',
    headers: {
      appkey: credentials.appKey,
      appsecret: credentials.appSecret,
      Accept: 'application/json',
    },
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
    const message = safeN11Message(payload, rawText);

    throw new Error(
      message
        ? `N11 ürün sorgulama: ${message}`
        : `N11 product-query HTTP ${response.status} hatası döndürdü.`
    );
  }

  const content = Array.isArray(payload?.content)
    ? payload.content
    : [];

  return (
    content.find(
      (item: any) =>
        String(item?.stockCode || '').trim() === stockCode
    ) || null
  );
}

async function finalizeCreatedListing(
  listingId: number,
  stockCode: string,
  taskId: string,
  product: any
) {
  const externalProductId =
    product?.n11ProductId === null ||
    product?.n11ProductId === undefined
      ? null
      : String(product.n11ProductId);

  const categoryId =
    product?.categoryId === null ||
    product?.categoryId === undefined
      ? null
      : String(product.categoryId);

  await getPool().query(
    `
      UPDATE public.online_listings
      SET
        external_product_id = $2,
        external_product_main_id = $3,
        category_id = $4::bigint,
        title = COALESCE($5, title),
        description = COALESCE($6, description),
        sale_price = COALESCE($7, sale_price),
        list_price = COALESCE($8, list_price),
        quantity = COALESCE($9, quantity),
        product_status = $10,
        sale_status = $11,
        preparing_day = $12,
        shipment_template = $13,
        currency_type = COALESCE($14, currency_type),
        attributes = COALESCE($15::jsonb, attributes),
        raw_data = $16::jsonb,
        sync_status = 'SYNCED',
        last_task_id = $17,
        last_task_status = 'SUCCESS',
        last_error = NULL,
        last_synced_at = now(),
        updated_at = now()
      WHERE id = $1
        AND channel = 'N11'
    `,
    [
      listingId,
      externalProductId,
      product?.productMainId ? String(product.productMainId) : null,
      categoryId,
      product?.title ? String(product.title) : null,
      product?.description ? String(product.description) : null,
      product?.salePrice ?? null,
      product?.listPrice ?? null,
      Number.isInteger(Number(product?.quantity))
        ? Number(product.quantity)
        : null,
      product?.status ? String(product.status) : null,
      product?.saleStatus ? String(product.saleStatus) : null,
      Number.isInteger(Number(product?.preparingDay))
        ? Number(product.preparingDay)
        : null,
      product?.shipmentTemplate
        ? String(product.shipmentTemplate)
        : null,
      product?.currencyType ? String(product.currencyType) : null,
      JSON.stringify(
        Array.isArray(product?.attributes)
          ? product.attributes
          : []
      ),
      JSON.stringify({
        source: 'N11_PRODUCT_QUERY_AFTER_CREATE',
        syncedAt: new Date().toISOString(),
        n11: product,
      }),
      taskId,
    ]
  );
}

// ============================================================
// GET /api/online/listings
// Mevcut N11 taslaklarini/listinglerini PostgreSQL'den okur.
// N11 API'ye istek ATMAZ.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);
    if (auth.response) return auth.response;

    const result = await getPool().query(
      `
        SELECT
          id,
          stock_device_id,
          channel,
          external_product_id,
          external_stock_code,
          title,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          sale_price,
          list_price,
          quantity,
          sync_status,
          product_status,
          sale_status,
          last_task_id,
          last_task_status,
          last_error,
          created_at,
          updated_at
        FROM public.online_listings
        WHERE channel = 'N11'
        ORDER BY updated_at DESC, id DESC
        LIMIT 1000
      `
    );

    return json({
      success: true,
      listings: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('ONLINE LISTINGS GET ERROR:', error);

    return json(
      {
        success: false,
        error: 'ONLINE ürünleri alınamadı.',
      },
      500
    );
  }
}

// ============================================================
// POST /api/online/listings
//
// Manuel N11 ürün taslağı.
// N11 API'ye istek ATMAZ.
//
// body:
// {
//   imei,
//   brand,
//   model,
//   memory,
//   color,
//   grade,
//   warranty,
//   salePrice,
//   listPrice
// }
//
// Otomatik:
// stock_device_id = NULL
// external_stock_code = IMEI
// channel = N11
// quantity = 1
// sync_status = DRAFT
// ============================================================
export async function POST(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return json({ success: false, error: 'Geçersiz istek kaynağı.' }, 403);
    }

    const auth = await requireSuperAdmin(request);

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const contentLength = Number(request.headers.get('content-length') || 0);

    if (contentLength > 50_000) {
      return json({ success: false, error: 'İstek çok büyük.' }, 413);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const data = body as Record<string, unknown>;

    const imei = String(data.imei ?? '')
      .replace(/\s+/g, '')
      .trim();

    if (!/^[0-9]{15}$/.test(imei)) {
      return json(
        {
          success: false,
          error: 'IMEI tam 15 haneli ve yalnızca rakamlardan oluşmalıdır.',
        },
        400
      );
    }

    let brand: string;
    let model: string;
    let memory: string;
    let color: string;
    let grade: string;
    let warranty: string;
    let salePrice: number;
    let listPrice: number;

    try {
      brand = cleanText(data.brand, 'Marka', 100);
      model = cleanText(data.model, 'Model', 180);
      memory = cleanText(data.memory, 'Hafıza', 50);
      color = cleanText(data.color, 'Renk', 100);
      grade = cleanText(data.grade, 'Grade', 50);
      warranty = cleanText(data.warranty, 'Garanti', 100);
      salePrice = parseMoney(data.salePrice, 'N11 satış fiyatı');
      listPrice = parseMoney(data.listPrice, 'N11 liste fiyatı');
    } catch (error) {
      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'Ürün bilgileri geçersiz.',
        },
        400
      );
    }

    if (listPrice < salePrice) {
      return json(
        {
          success: false,
          error: 'N11 liste fiyatı satış fiyatından düşük olamaz.',
        },
        400
      );
    }

    const pool = getPool();

    const duplicate = await pool.query(
      `
        SELECT id, external_stock_code, sync_status, external_product_id
        FROM public.online_listings
        WHERE channel = 'N11'
          AND external_stock_code = $1
        LIMIT 1
      `,
      [imei]
    );

    if (duplicate.rowCount) {
      return json(
        {
          success: false,
          error: 'Bu IMEI için zaten N11 ONLINE kaydı bulunuyor.',
          existingListing: duplicate.rows[0],
        },
        409
      );
    }

    const channelResult = await pool.query(
      `
        SELECT
          default_vat_rate,
          default_preparing_day,
          default_shipment_template
        FROM public.online_channels
        WHERE channel = 'N11'
        LIMIT 1
      `
    );

    const channel = channelResult.rows[0] ?? null;

    let vatRate: number;

    try {
      vatRate = getN11DefaultVatRate(channel);
    } catch (error) {
      return json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : 'N11 KDV oranı bulunamadı.',
        },
        409
      );
    }

    // İlk gerçek ürün testinde kategori/attribute tahmini YAPMIYORUZ.
    // Aynı özellikte, zaten N11'de bulunan ürünü katalog şablonu olarak kullanıyoruz.
    const template = await findCatalogTemplate({
      brand,
      model,
      memory,
      color,
      grade,
      warranty,
    });

    if (!template) {
      return json(
        {
          success: false,
          error:
            'Aynı Marka/Model/Hafıza/Renk/Grade/Garanti özelliklerinde mevcut bir N11 ürünü bulunamadı. İlk test için N11’de zaten bulunan aynı özellikte bir cihazın yeni IMEI’sini girin.',
        },
        409
      );
    }

    const templateRow = template.row;
    const templateRaw = template.rawProduct;

    const preparingDay =
      positiveIntegerOrNull(templateRaw?.preparingDay) ||
      positiveIntegerOrNull(templateRow.preparing_day) ||
      positiveIntegerOrNull(channel?.default_preparing_day);

    const shipmentTemplate = String(
      templateRaw?.shipmentTemplate ||
        templateRow.shipment_template ||
        channel?.default_shipment_template ||
        ''
    ).trim();

    const categoryId =
      positiveIntegerOrNull(templateRaw?.categoryId) ||
      positiveIntegerOrNull(templateRow.category_id);

    const productMainId = String(
      templateRaw?.productMainId ||
        templateRow.external_product_main_id ||
        ''
    ).trim();

    if (
      !preparingDay ||
      !shipmentTemplate ||
      !categoryId ||
      !productMainId
    ) {
      return json(
        {
          success: false,
          error:
            'N11 katalog şablonunda categoryId / productMainId / hazırlık süresi / kargo şablonu eksik. Başka bir aynı ürünle test edin.',
        },
        409
      );
    }

    const title = [brand, model, memory, color, grade]
      .filter(Boolean)
      .join(' ');

    // Önce yerel kayıt açılır. N11 hata verirse kayıt ERROR olarak kalır ve sebebi görülür.
    const insertResult = await pool.query(
      `
        INSERT INTO public.online_listings (
          stock_device_id,
          channel,
          external_product_id,
          external_stock_code,
          external_product_main_id,
          category_id,
          title,
          description,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          sale_price,
          list_price,
          quantity,
          product_status,
          sale_status,
          sync_status,
          preparing_day,
          shipment_template,
          currency_type,
          vat_rate,
          raw_data,
          created_at,
          updated_at
        )
        VALUES (
          NULL,
          'N11',
          NULL,
          $1,
          $2,
          $3::bigint,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11,
          $12,
          $13,
          1,
          NULL,
          NULL,
          'CREATING',
          $14,
          $15,
          'TL',
          $16,
          $17::jsonb,
          now(),
          now()
        )
        RETURNING *
      `,
      [
        imei,
        productMainId,
        categoryId,
        title,
        templateRow.description ||
          templateRaw?.description ||
          `${brand} ${model} ${memory} ${color} ${grade} ${warranty}`,
        brand,
        model,
        memory,
        color,
        grade,
        warranty,
        salePrice,
        listPrice,
        preparingDay,
        shipmentTemplate,
        vatRate,
        JSON.stringify({
          draftSource: 'PANEL_MANUAL_REAL_N11_CREATE',
          createdBy: auth.user.username,
          imei,
          templateListingId: templateRow.id,
          templateN11ProductId: templateRow.external_product_id,
          templateCatalogId: template.catalogId,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          salePrice,
          listPrice,
        }),
      ]
    );

    const listing = insertResult.rows[0];

    const createSku = {
      description:
        templateRow.description ||
        templateRaw?.description ||
        `${brand} ${model} ${memory} ${color} ${grade} ${warranty}`,
      categoryId,
      productMainId,
      preparingDay,
      shipmentTemplate,
      maxPurchaseQuantity:
        positiveIntegerOrNull(templateRaw?.maxPurchaseQuantity) || 1,
      stockCode: imei,
      catalogId: template.catalogId,
      barcode:
        templateRaw?.barcode === null ||
        templateRaw?.barcode === undefined ||
        String(templateRaw.barcode).trim() === ''
          ? null
          : templateRaw.barcode,
      quantity: 1,
      images: [],
      attributes: [],
      salePrice,
      listPrice,
      vatRate,
    };

    let createResult: Awaited<ReturnType<typeof sendN11ProductCreate>>;

    try {
      createResult = await sendN11ProductCreate(createSku);
    } catch (error) {
      await pool.query(
        `
          UPDATE public.online_listings
          SET
            sync_status = 'ERROR',
            last_error = $2,
            updated_at = now()
          WHERE id = $1
        `,
        [
          listing.id,
          error instanceof Error
            ? error.message
            : 'N11 ürün oluşturma isteği başarısız.',
        ]
      );

      throw error;
    }

    if (createResult.taskStatus === 'REJECT') {
      const errorMessage =
        createResult.reasons.join(' | ') ||
        'N11 ürün oluşturma isteğini reddetti.';

      await pool.query(
        `
          UPDATE public.online_listings
          SET
            sync_status = 'ERROR',
            last_task_id = $2,
            last_task_status = 'REJECT',
            last_error = $3,
            updated_at = now()
          WHERE id = $1
        `,
        [listing.id, createResult.taskId, errorMessage]
      );

      if (createResult.taskId) {
        await saveN11Task({
          listingId: Number(listing.id),
          stockCode: imei,
          taskId: createResult.taskId,
          taskType: createResult.taskType,
          taskStatus: 'REJECT',
          requestPayload: createResult.requestPayload,
          responsePayload: createResult.responsePayload,
          reasons: createResult.reasons,
        });
      }

      return json(
        {
          success: false,
          error: `N11 ürün oluşturmayı reddetti: ${errorMessage}`,
          listingId: listing.id,
          taskId: createResult.taskId,
        },
        422
      );
    }

    if (
      createResult.taskStatus !== 'IN_QUEUE' ||
      !createResult.taskId
    ) {
      await pool.query(
        `
          UPDATE public.online_listings
          SET
            sync_status = 'ERROR',
            last_error = $2,
            updated_at = now()
          WHERE id = $1
        `,
        [
          listing.id,
          `N11 beklenmeyen create cevabı: ${
            createResult.taskStatus || 'STATUS YOK'
          }`,
        ]
      );

      return json(
        {
          success: false,
          error: `N11 beklenmeyen create cevabı döndürdü: ${
            createResult.taskStatus || 'STATUS YOK'
          }`,
        },
        502
      );
    }

    await saveN11Task({
      listingId: Number(listing.id),
      stockCode: imei,
      taskId: createResult.taskId,
      taskType: createResult.taskType,
      taskStatus: 'IN_QUEUE',
      requestPayload: createResult.requestPayload,
      responsePayload: createResult.responsePayload,
      reasons: createResult.reasons,
    });

    await pool.query(
      `
        UPDATE public.online_listings
        SET
          sync_status = 'IN_QUEUE',
          last_task_id = $2,
          last_task_status = 'IN_QUEUE',
          last_error = NULL,
          updated_at = now()
        WHERE id = $1
      `,
      [listing.id, createResult.taskId]
    );

    const taskResult = await waitForCreateTask(
      createResult.taskId,
      imei
    );

    if (!taskResult.completed) {
      return json(
        {
          success: true,
          n11Requested: true,
          created: false,
          taskId: createResult.taskId,
          taskStatus: 'IN_QUEUE',
          message:
            `Ürün N11’e gönderildi. Task #${createResult.taskId} hâlâ kuyrukta; otomatik N11 senkronizasyonu ürünü panele çekecek.`,
          listing: {
            ...listing,
            sync_status: 'IN_QUEUE',
            last_task_id: createResult.taskId,
          },
        },
        202
      );
    }

    if (!taskResult.success) {
      const errorMessage =
        taskResult.reasons.join(' | ') ||
        `N11 ürün oluşturma task sonucu: ${taskResult.status}`;

      await pool.query(
        `
          UPDATE public.online_tasks
          SET
            task_status = $2,
            response_payload = $3::jsonb,
            reasons = $4::jsonb,
            error_message = $5,
            checked_at = now(),
            completed_at = now()
          WHERE channel = 'N11'
            AND task_id = $1
        `,
        [
          createResult.taskId,
          taskResult.status,
          JSON.stringify(taskResult.payload),
          JSON.stringify(taskResult.reasons),
          errorMessage,
        ]
      );

      await pool.query(
        `
          UPDATE public.online_listings
          SET
            sync_status = 'ERROR',
            last_task_status = $2,
            last_error = $3,
            updated_at = now()
          WHERE id = $1
        `,
        [listing.id, taskResult.status, errorMessage]
      );

      return json(
        {
          success: false,
          n11Requested: true,
          created: false,
          taskId: createResult.taskId,
          taskStatus: taskResult.status,
          error: `N11 ürün oluşturulamadı: ${errorMessage}`,
        },
        422
      );
    }

    await pool.query(
      `
        UPDATE public.online_tasks
        SET
          task_status = 'SUCCESS',
          response_payload = $2::jsonb,
          reasons = $3::jsonb,
          error_message = NULL,
          checked_at = now(),
          completed_at = now()
        WHERE channel = 'N11'
          AND task_id = $1
      `,
      [
        createResult.taskId,
        JSON.stringify(taskResult.payload),
        JSON.stringify(taskResult.reasons),
      ]
    );

    // N11 create başarılıysa yeni ürünün gerçek N11 productId'sini stockCode=IMEI ile geri oku.
    let createdProduct: any = null;

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      createdProduct = await queryN11ProductByStockCode(imei);

      if (createdProduct) break;

      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    if (createdProduct) {
      await finalizeCreatedListing(
        Number(listing.id),
        imei,
        createResult.taskId,
        createdProduct
      );

      const finalResult = await pool.query(
        `
          SELECT *
          FROM public.online_listings
          WHERE id = $1
          LIMIT 1
        `,
        [listing.id]
      );

      return json(
        {
          success: true,
          n11Requested: true,
          created: true,
          taskId: createResult.taskId,
          taskStatus: 'SUCCESS',
          message:
            `Cihaz N11’de başarıyla oluşturuldu. IMEI/Stok Kodu: ${imei}`,
          listing: finalResult.rows[0],
        },
        201
      );
    }

    // Task SUCCESS ama product-query henüz görünmüyorsa otomatik sync biraz sonra tamamlar.
    await pool.query(
      `
        UPDATE public.online_listings
        SET
          sync_status = 'SYNCED_PENDING_QUERY',
          last_task_status = 'SUCCESS',
          last_error = NULL,
          updated_at = now()
        WHERE id = $1
      `,
      [listing.id]
    );

    return json(
      {
        success: true,
        n11Requested: true,
        created: true,
        taskId: createResult.taskId,
        taskStatus: 'SUCCESS',
        message:
          `N11 ürün oluşturma SUCCESS. IMEI ${imei}. N11 ürün kodu otomatik senkronizasyonda panele alınacak.`,
        listing: {
          ...listing,
          sync_status: 'SYNCED_PENDING_QUERY',
          last_task_id: createResult.taskId,
          last_task_status: 'SUCCESS',
        },
      },
      201
    );
  } catch (error: any) {
    if (error?.code === '23505') {
      return json(
        {
          success: false,
          error: 'Bu IMEI için N11 ONLINE kaydı zaten mevcut.',
        },
        409
      );
    }

    console.error('ONLINE LISTINGS POST / N11 CREATE ERROR:', error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 cihaz oluşturma işlemi tamamlanamadı.',
      },
      500
    );
  }
}


function getN11Credentials() {
  const appKey = String(process.env.N11_APP_KEY || '').trim();
  const appSecret = String(process.env.N11_APP_SECRET || '').trim();

  if (!appKey || !appSecret) {
    return null;
  }

  return { appKey, appSecret };
}

function safeN11Message(payload: any, rawText: string) {
  const message =
    payload?.message ||
    payload?.error ||
    payload?.errorMessage ||
    payload?.title ||
    payload?.reason ||
    null;

  if (message) return String(message);

  if (rawText && rawText.length <= 500) {
    return rawText;
  }

  return null;
}

async function sendN11PriceStockUpdate(
  sku: Record<string, unknown>
) {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.'
    );
  }

  const requestPayload = {
    payload: {
      integrator: N11_INTEGRATOR,
      skus: [sku],
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(N11_PRICE_STOCK_UPDATE_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: {
        appkey: credentials.appKey,
        appsecret: credentials.appSecret,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });

    const rawText = await response.text();

    let responsePayload: any = null;

    if (rawText) {
      try {
        responsePayload = JSON.parse(rawText);
      } catch {
        responsePayload = null;
      }
    }

    if (!response.ok) {
      const n11Message = safeN11Message(responsePayload, rawText);

      throw new Error(
        n11Message
          ? `N11 API: ${n11Message}`
          : `N11 fiyat/stok servisi HTTP ${response.status} hatası döndürdü.`
      );
    }

    if (!responsePayload || typeof responsePayload !== 'object') {
      throw new Error('N11 fiyat/stok servisi geçersiz cevap döndürdü.');
    }

    const taskId =
      responsePayload.id === null || responsePayload.id === undefined
        ? null
        : String(responsePayload.id);

    const taskStatus = String(responsePayload.status || '').trim().toUpperCase();
    const taskType = String(responsePayload.type || 'SKU_UPDATE').trim();
    const reasons = Array.isArray(responsePayload.reasons)
      ? responsePayload.reasons
      : [];

    return {
      requestPayload,
      responsePayload,
      taskId,
      taskStatus,
      taskType,
      reasons,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'AbortError' ||
        error.message.toLowerCase().includes('aborted'))
    ) {
      throw new Error('N11 API 15 saniye içinde yanıt vermedi.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function saveN11Task(params: {
  listingId: number;
  stockCode: string;
  taskId: string;
  taskType: string;
  taskStatus: string;
  requestPayload: unknown;
  responsePayload: unknown;
  reasons: unknown[];
}) {
  const pool = getPool();

  await pool.query(
    `
      INSERT INTO public.online_tasks (
        channel,
        task_id,
        task_type,
        task_status,
        stock_code,
        online_listing_id,
        request_payload,
        response_payload,
        reasons,
        created_at
      )
      VALUES (
        'N11',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::jsonb,
        $7::jsonb,
        $8::jsonb,
        now()
      )
      ON CONFLICT (channel, task_id)
      DO UPDATE SET
        task_type = EXCLUDED.task_type,
        task_status = EXCLUDED.task_status,
        stock_code = EXCLUDED.stock_code,
        online_listing_id = EXCLUDED.online_listing_id,
        request_payload = EXCLUDED.request_payload,
        response_payload = EXCLUDED.response_payload,
        reasons = EXCLUDED.reasons
    `,
    [
      params.taskId,
      params.taskType,
      params.taskStatus,
      params.stockCode,
      params.listingId,
      JSON.stringify(params.requestPayload),
      JSON.stringify(params.responsePayload),
      JSON.stringify(params.reasons),
    ]
  );
}

// ============================================================
// PATCH /api/online/listings
//
// PostgreSQL tarafinda urun duzenleme / fiyat / stok islemleri.
// N11 API'ye istek ATMAZ.
//
// UPDATE_DETAILS:
// { action, listingId, brand, model, memory, color, grade, warranty }
//
// UPDATE_PRICE:
// { action, listingId, salePrice, listPrice }
//
// SET_STOCK_ZERO:
// { action, listingId }
// ============================================================
export async function PATCH(request: NextRequest) {
  try {
    if (!validateOrigin(request)) {
      return json({ success: false, error: 'Geçersiz istek kaynağı.' }, 403);
    }

    const auth = await requireSuperAdmin(request);

    if (auth.response || !auth.user) {
      return auth.response!;
    }

    const contentLength = Number(request.headers.get('content-length') || 0);

    if (contentLength > 50_000) {
      return json({ success: false, error: 'İstek çok büyük.' }, 413);
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ success: false, error: 'Geçersiz istek.' }, 400);
    }

    const data = body as Record<string, unknown>;
    const listingId = parsePositiveId(data.listingId);
    const action = String(data.action ?? '').trim().toUpperCase();

    if (!listingId) {
      return json({ success: false, error: 'Geçersiz ONLINE kaydı.' }, 400);
    }

    if (!['UPDATE_DETAILS', 'UPDATE_PRICE', 'SET_STOCK_ZERO'].includes(action)) {
      return json({ success: false, error: 'Geçersiz işlem.' }, 400);
    }

    const pool = getPool();

    const existingResult = await pool.query(
      `
        SELECT *
        FROM public.online_listings
        WHERE id = $1
          AND channel = 'N11'
        LIMIT 1
      `,
      [listingId]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return json({ success: false, error: 'ONLINE ürünü bulunamadı.' }, 404);
    }

    // --------------------------------------------------------
    // URUN DETAYLARI
    // Bu adım hâlâ PostgreSQL tarafında düzenlenir.
    // Gerçek N11 product-update ayrı adımda bağlanacak.
    // --------------------------------------------------------
    if (action === 'UPDATE_DETAILS') {
      let brand: string;
      let model: string;
      let memory: string;
      let color: string;
      let grade: string;
      let warranty: string;

      try {
        brand = cleanText(data.brand, 'Marka', 100);
        model = cleanText(data.model, 'Model', 180);
        memory = cleanText(data.memory, 'Hafıza', 50);
        color = cleanText(data.color, 'Renk', 100);
        grade = cleanText(data.grade, 'Grade', 50);
        warranty = cleanText(data.warranty, 'Garanti', 100);
      } catch (error) {
        return json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Ürün bilgileri geçersiz.',
          },
          400
        );
      }

      const title = [brand, model, memory, color, grade]
        .filter(Boolean)
        .join(' ');

      const result = await pool.query(
        `
          UPDATE public.online_listings
          SET
            brand = $2,
            model = $3,
            memory = $4,
            color = $5,
            grade = $6,
            warranty = $7,
            title = $8,
            sync_status = CASE
              WHEN external_product_id IS NULL THEN 'DRAFT'
              ELSE 'READY'
            END,
            updated_at = now()
          WHERE id = $1
            AND channel = 'N11'
          RETURNING *
        `,
        [listingId, brand, model, memory, color, grade, warranty, title]
      );

      return json({
        success: true,
        n11Requested: false,
        message:
          existing.external_product_id
            ? 'Ürün bilgileri PostgreSQL’de güncellendi. N11 ürün detayı güncellemesi henüz bağlı değil.'
            : 'Yerel ürün taslağı güncellendi.',
        listing: result.rows[0],
      });
    }

    const stockCode = String(existing.external_stock_code || '').trim();

    if (!stockCode) {
      return json(
        {
          success: false,
          error: 'N11 stockCode bulunamadı.',
        },
        409
      );
    }

    const isN11Product = Boolean(existing.external_product_id);

    // --------------------------------------------------------
    // FIYAT
    // --------------------------------------------------------
    if (action === 'UPDATE_PRICE') {
      let salePrice: number;
      let listPrice: number;

      try {
        salePrice = parseMoney(data.salePrice, 'N11 satış fiyatı');
        listPrice = parseMoney(data.listPrice, 'N11 liste fiyatı');
      } catch (error) {
        return json(
          {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Fiyat bilgileri geçersiz.',
          },
          400
        );
      }

      if (listPrice < salePrice) {
        return json(
          {
            success: false,
            error: 'N11 liste fiyatı satış fiyatından düşük olamaz.',
          },
          400
        );
      }

      // N11'de henüz oluşturulmamış yerel taslak.
      if (!isN11Product) {
        const result = await pool.query(
          `
            UPDATE public.online_listings
            SET
              sale_price = $2,
              list_price = $3,
              sync_status = 'DRAFT',
              updated_at = now()
            WHERE id = $1
              AND channel = 'N11'
            RETURNING *
          `,
          [listingId, salePrice, listPrice]
        );

        return json({
          success: true,
          n11Requested: false,
          message:
            'Yerel taslak fiyatı güncellendi. Ürün henüz N11’de olmadığı için API çağrısı yapılmadı.',
          listing: result.rows[0],
        });
      }

      const n11 = await sendN11PriceStockUpdate({
        stockCode,
        listPrice,
        salePrice,
        currencyType: String(existing.currency_type || 'TL'),
      });

      if (n11.taskStatus === 'REJECT') {
        await pool.query(
          `
            UPDATE public.online_listings
            SET
              last_task_id = $2,
              last_task_status = 'REJECT',
              last_error = $3,
              sync_status = 'ERROR',
              updated_at = now()
            WHERE id = $1
          `,
          [
            listingId,
            n11.taskId,
            n11.reasons.length
              ? n11.reasons.map(String).join(' | ')
              : 'N11 fiyat güncellemesini reddetti.',
          ]
        );

        if (n11.taskId) {
          await saveN11Task({
            listingId,
            stockCode,
            taskId: n11.taskId,
            taskType: n11.taskType,
            taskStatus: n11.taskStatus,
            requestPayload: n11.requestPayload,
            responsePayload: n11.responsePayload,
            reasons: n11.reasons,
          });
        }

        return json(
          {
            success: false,
            n11Requested: true,
            taskId: n11.taskId,
            taskStatus: n11.taskStatus,
            error:
              n11.reasons.length
                ? `N11 reddetti: ${n11.reasons.map(String).join(' | ')}`
                : 'N11 fiyat güncellemesini reddetti.',
          },
          422
        );
      }

      if (n11.taskStatus !== 'IN_QUEUE' || !n11.taskId) {
        return json(
          {
            success: false,
            n11Requested: true,
            error: `N11 beklenmeyen task cevabı döndürdü: ${
              n11.taskStatus || 'STATUS YOK'
            }`,
          },
          502
        );
      }

      await saveN11Task({
        listingId,
        stockCode,
        taskId: n11.taskId,
        taskType: n11.taskType,
        taskStatus: n11.taskStatus,
        requestPayload: n11.requestPayload,
        responsePayload: n11.responsePayload,
        reasons: n11.reasons,
      });

      const result = await pool.query(
        `
          UPDATE public.online_listings
          SET
            sale_price = $2,
            list_price = $3,
            sync_status = 'IN_QUEUE',
            last_task_id = $4,
            last_task_status = 'IN_QUEUE',
            last_error = NULL,
            updated_at = now()
          WHERE id = $1
            AND channel = 'N11'
          RETURNING *
        `,
        [listingId, salePrice, listPrice, n11.taskId]
      );

      return json({
        success: true,
        n11Requested: true,
        taskId: n11.taskId,
        taskStatus: n11.taskStatus,
        message: `Fiyat güncellemesi N11’e gönderildi. Task #${n11.taskId} kuyrukta.`,
        listing: result.rows[0],
      });
    }

    // --------------------------------------------------------
    // STOK 0
    // --------------------------------------------------------
    if (!isN11Product) {
      const result = await pool.query(
        `
          UPDATE public.online_listings
          SET
            quantity = 0,
            sync_status = 'DRAFT',
            updated_at = now()
          WHERE id = $1
            AND channel = 'N11'
          RETURNING *
        `,
        [listingId]
      );

      return json({
        success: true,
        n11Requested: false,
        message:
          'Yerel taslak stok 0 yapıldı. Ürün henüz N11’de olmadığı için API çağrısı yapılmadı.',
        listing: result.rows[0],
      });
    }

    const n11 = await sendN11PriceStockUpdate({
      stockCode,
      quantity: 0,
    });

    if (n11.taskStatus === 'REJECT') {
      await pool.query(
        `
          UPDATE public.online_listings
          SET
            last_task_id = $2,
            last_task_status = 'REJECT',
            last_error = $3,
            sync_status = 'ERROR',
            updated_at = now()
          WHERE id = $1
        `,
        [
          listingId,
          n11.taskId,
          n11.reasons.length
            ? n11.reasons.map(String).join(' | ')
            : 'N11 stok güncellemesini reddetti.',
        ]
      );

      if (n11.taskId) {
        await saveN11Task({
          listingId,
          stockCode,
          taskId: n11.taskId,
          taskType: n11.taskType,
          taskStatus: n11.taskStatus,
          requestPayload: n11.requestPayload,
          responsePayload: n11.responsePayload,
          reasons: n11.reasons,
        });
      }

      return json(
        {
          success: false,
          n11Requested: true,
          taskId: n11.taskId,
          taskStatus: n11.taskStatus,
          error:
            n11.reasons.length
              ? `N11 reddetti: ${n11.reasons.map(String).join(' | ')}`
              : 'N11 stok güncellemesini reddetti.',
        },
        422
      );
    }

    if (n11.taskStatus !== 'IN_QUEUE' || !n11.taskId) {
      return json(
        {
          success: false,
          n11Requested: true,
          error: `N11 beklenmeyen task cevabı döndürdü: ${
            n11.taskStatus || 'STATUS YOK'
          }`,
        },
        502
      );
    }

    await saveN11Task({
      listingId,
      stockCode,
      taskId: n11.taskId,
      taskType: n11.taskType,
      taskStatus: n11.taskStatus,
      requestPayload: n11.requestPayload,
      responsePayload: n11.responsePayload,
      reasons: n11.reasons,
    });

    const result = await pool.query(
      `
        UPDATE public.online_listings
        SET
          quantity = 0,
          sync_status = 'IN_QUEUE',
          last_task_id = $2,
          last_task_status = 'IN_QUEUE',
          last_error = NULL,
          updated_at = now()
        WHERE id = $1
          AND channel = 'N11'
        RETURNING *
      `,
      [listingId, n11.taskId]
    );

    return json({
      success: true,
      n11Requested: true,
      taskId: n11.taskId,
      taskStatus: n11.taskStatus,
      message: `Stok 0 güncellemesi N11’e gönderildi. Task #${n11.taskId} kuyrukta.`,
      listing: result.rows[0],
    });
  } catch (error) {
    console.error('ONLINE LISTINGS PATCH ERROR:', error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'ONLINE ürün işlemi tamamlanamadı.',
      },
      500
    );
  }
}

