// app/api/online/n11/import/route.ts
// CNETMOBIL ONLINE - N11 URUNLERINI CEK / POSTGRESQL'E IMPORT
//
// GET  -> SADECE PREVIEW: N11'deki tum urunleri sayfalayarak ceker, DB'ye YAZMAZ.
// POST -> Gercek import/upsert: N11 urunlerini public.online_listings tablosuna yazar.
//
// Guvenlik:
// - Tarayicidan: sadece Super Admin
// - Otomatik senkronizasyon: server-to-server Bearer N11_SYNC_SECRET
// - N11 APP KEY / SECRET sadece server-side ENV
// - Secret response/log'a yazilmaz
// - Normal POST isteklerinde origin kontrolu var
//
// N11:
// GET https://api.n11.com/ms/product-query
// Headers: appkey + appsecret
// page 0'dan baslar, size maksimum 50.

import { NextRequest, NextResponse } from 'next/server';
import { Pool, PoolClient } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11ImportPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const N11_PRODUCT_QUERY_URL = 'https://api.n11.com/ms/product-query';
const AUTO_SYNC_USERNAME = 'system:n11-auto-sync';
const PAGE_SIZE = 50;
const MAX_PAGES = 100;

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

type N11Attribute = {
  attributeId?: unknown;
  attributeName?: unknown;
  attributeValue?: unknown;
};

type N11Product = Record<string, unknown> & {
  n11ProductId?: unknown;
  stockCode?: unknown;
  title?: unknown;
  description?: unknown;
  categoryId?: unknown;
  productMainId?: unknown;
  status?: unknown;
  saleStatus?: unknown;
  preparingDay?: unknown;
  shipmentTemplate?: unknown;
  currencyType?: unknown;
  salePrice?: unknown;
  listPrice?: unknown;
  quantity?: unknown;
  attributes?: unknown;
};

type N11PageResponse = {
  content?: unknown;
  totalElements?: unknown;
  totalPages?: unknown;
  number?: unknown;
  numberOfElements?: unknown;
  size?: unknown;
};

type FetchAllResult = {
  products: N11Product[];
  reportedTotalElements: number;
  reportedTotalPages: number;
  fetchedPages: number;
  duplicateStockCodes: number;
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

  if (!global.cnetN11ImportPool) {
    global.cnetN11ImportPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11ImportPool;
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

  if (!row || row.active !== true) return null;

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


function safeEqualText(left: string, right: string) {
  const leftBuffer = Buffer.from(left, 'utf8');
  const rightBuffer = Buffer.from(right, 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getAutoSyncUser(request: NextRequest): ActiveUser | null {
  const configuredSecret = String(
    process.env.N11_SYNC_SECRET || ''
  ).trim();

  if (!configuredSecret) {
    return null;
  }

  const authorization = String(
    request.headers.get('authorization') || ''
  ).trim();

  if (!authorization.toLowerCase().startsWith('bearer ')) {
    return null;
  }

  const receivedSecret = authorization.slice(7).trim();

  if (
    !receivedSecret ||
    !safeEqualText(receivedSecret, configuredSecret)
  ) {
    return null;
  }

  return {
    id: 0,
    username: AUTO_SYNC_USERNAME,
    isSuperAdmin: true,
  };
}

async function authorizeImportPost(request: NextRequest) {
  // Coolify cron / server-to-server otomatik senkronizasyon.
  // Bu yol browser session ve Origin gerektirmez; Bearer secret zorunludur.
  const autoSyncUser = getAutoSyncUser(request);

  if (autoSyncUser) {
    return {
      user: autoSyncUser,
      mode: 'AUTO_SYNC' as const,
      response: null,
    };
  }

  // Normal panel kullanimi eski guvenlik yapisini aynen korur.
  if (!validateOrigin(request)) {
    return {
      user: null,
      mode: 'PANEL' as const,
      response: json(
        {
          success: false,
          error: 'Geçersiz istek kaynağı.',
        },
        403
      ),
    };
  }

  const auth = await requireSuperAdmin(request);

  return {
    user: auth.user,
    mode: 'PANEL' as const,
    response: auth.response,
  };
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

function stringOrNull(value: unknown, maxLength = 5000) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  if (!text) return null;

  return text.slice(0, maxLength);
}

function integerOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return Math.trunc(number);
}

function nonNegativeInteger(value: unknown, fallback = 0) {
  const number = integerOrNull(value);

  if (number === null) return fallback;

  return Math.max(0, number);
}

function moneyOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;

  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) return null;

  return Number(number.toFixed(2));
}

function bigintTextOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;

  const text = String(value).trim();

  if (!/^-?\d+$/.test(text)) return null;

  return text;
}

function normalizeAttributeName(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/\s+/g, ' ');
}

function getAttributes(product: N11Product): N11Attribute[] {
  if (!Array.isArray(product.attributes)) return [];

  return product.attributes.filter(
    (item): item is N11Attribute =>
      Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  );
}

function findAttributeValue(
  product: N11Product,
  candidateNames: string[]
): string | null {
  const normalizedCandidates = new Set(
    candidateNames.map((name) => normalizeAttributeName(name))
  );

  for (const attribute of getAttributes(product)) {
    const name = normalizeAttributeName(attribute.attributeName);

    if (!normalizedCandidates.has(name)) continue;

    const value = stringOrNull(attribute.attributeValue, 500);

    if (value) return value;
  }

  return null;
}

function normalizeMemory(value: string | null) {
  if (!value) return null;

  const match = value.match(/(\d+)\s*(GB|TB)/i);

  if (!match) return value.trim();

  return `${match[1]} ${match[2].toUpperCase()}`;
}

function parseStructuredFieldsFromTitle(
  product: N11Product,
  attributeBrand: string | null,
  attributeColor: string | null
) {
  const title = stringOrNull(product.title, 1000);

  if (!title) {
    return {
      model: null as string | null,
      memory: null as string | null,
      grade: null as string | null,
      warranty: null as string | null,
      color: attributeColor,
    };
  }

  // Örnek N11 başlık yapısı:
  // Yenilenmiş iPhone 15 256 GB A Kalite (12 Ay Garantili) Yeşil
  // Yenilenmiş Samsung Galaxy S21 FE 128GB A Kalite (12 Ay Garantili) Mor
  //
  // Burada başlıktan yalnızca açıkça bulunan alanları çıkarıyoruz.
  // Eşleşme yoksa tahmin YAPMIYORUZ.

  const memoryMatch = title.match(/\b(\d+)\s*(GB|TB)\b/i);
  const gradeMatch = title.match(/\b([ABC])\s*Kalite\b/i);
  const warrantyMatch = title.match(/\((\d+)\s*Ay\s*Garantili\)/i);

  let model: string | null = null;

  if (memoryMatch && typeof memoryMatch.index === 'number') {
    let beforeMemory = title.slice(0, memoryMatch.index).trim();

    beforeMemory = beforeMemory
      .replace(/^Yenilenmiş\s+/i, '')
      .trim();

    if (
      attributeBrand &&
      beforeMemory
        .toLocaleLowerCase('tr-TR')
        .startsWith(attributeBrand.toLocaleLowerCase('tr-TR') + ' ')
    ) {
      beforeMemory = beforeMemory.slice(attributeBrand.length).trim();
    }

    model = beforeMemory || null;
  }

  let parsedColor = attributeColor;

  if (!parsedColor && warrantyMatch) {
    const warrantyEnd =
      (warrantyMatch.index || 0) + warrantyMatch[0].length;

    const afterWarranty = title.slice(warrantyEnd).trim();

    if (afterWarranty) {
      parsedColor = afterWarranty;
    }
  }

  return {
    model,
    memory: memoryMatch
      ? `${memoryMatch[1]} ${memoryMatch[2].toUpperCase()}`
      : null,
    grade: gradeMatch ? gradeMatch[1].toUpperCase() : null,
    warranty: warrantyMatch ? `${warrantyMatch[1]} Ay` : null,
    color: parsedColor,
  };
}

function deriveStructuredFields(product: N11Product) {
  const brand = findAttributeValue(product, ['Marka', 'Brand']);

  const modelFromAttribute = findAttributeValue(product, [
    'Model',
    'Model Adı',
    'Model Adi',
    'Telefon Modeli',
  ]);

  const memoryFromAttribute = findAttributeValue(product, [
    'Hafıza',
    'Hafiza',
    'Dahili Hafıza',
    'Dahili Hafiza',
    'Depolama',
    'Depolama Kapasitesi',
    'Kapasite',
  ]);

  const colorFromAttribute = findAttributeValue(product, ['Renk', 'Color']);

  const gradeFromAttribute = findAttributeValue(product, [
    'Grade',
    'Kalite',
    'Kondisyon',
    'Ürün Kondisyonu',
    'Urun Kondisyonu',
    'Kozmetik Durum',
  ]);

  const warrantyFromAttribute = findAttributeValue(product, [
    'Garanti',
    'Garanti Süresi',
    'Garanti Suresi',
    'Garanti Tipi',
  ]);

  const fromTitle = parseStructuredFieldsFromTitle(
    product,
    brand,
    colorFromAttribute
  );

  return {
    brand,
    model: modelFromAttribute || fromTitle.model,
    memory: normalizeMemory(memoryFromAttribute) || fromTitle.memory,
    color: colorFromAttribute || fromTitle.color,
    grade: gradeFromAttribute || fromTitle.grade,
    warranty: warrantyFromAttribute || fromTitle.warranty,
  };
}

async function fetchN11Page(
  page: number,
  credentials: { appKey: string; appSecret: string }
): Promise<N11PageResponse> {
  const url = new URL(N11_PRODUCT_QUERY_URL);

  url.searchParams.set('page', String(page));
  url.searchParams.set('size', String(PAGE_SIZE));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      headers: {
        appkey: credentials.appKey,
        appsecret: credentials.appSecret,
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
      const n11Message =
        payload?.message ||
        payload?.error ||
        payload?.errorMessage ||
        payload?.title ||
        null;

      throw new Error(
        n11Message
          ? `N11 API: ${String(n11Message)}`
          : `N11 ürün sorgusu HTTP ${response.status} hatası döndürdü.`
      );
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error('N11 ürün sorgusu geçersiz JSON döndürdü.');
    }

    return payload as N11PageResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchAllN11Products(
  credentials: { appKey: string; appSecret: string }
): Promise<FetchAllResult> {
  const productsByStockCode = new Map<string, N11Product>();

  let reportedTotalElements = 0;
  let reportedTotalPages = 1;
  let fetchedPages = 0;
  let duplicateStockCodes = 0;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const payload = await fetchN11Page(page, credentials);

    const content = Array.isArray(payload.content)
      ? (payload.content.filter(
          (item): item is N11Product =>
            Boolean(item) &&
            typeof item === 'object' &&
            !Array.isArray(item)
        ) as N11Product[])
      : [];

    if (page === 0) {
      reportedTotalElements = Math.max(
        0,
        Number(payload.totalElements || content.length)
      );

      reportedTotalPages = Math.max(
        1,
        Number(payload.totalPages || 1)
      );
    }

    fetchedPages += 1;

    for (const product of content) {
      const stockCode = stringOrNull(product.stockCode, 250);

      if (!stockCode) continue;

      if (productsByStockCode.has(stockCode)) {
        duplicateStockCodes += 1;
      }

      productsByStockCode.set(stockCode, product);
    }

    const currentTotalPages = Math.max(
      reportedTotalPages,
      Number(payload.totalPages || reportedTotalPages || 1)
    );

    if (
      content.length === 0 ||
      page + 1 >= currentTotalPages ||
      content.length < PAGE_SIZE
    ) {
      break;
    }
  }

  if (fetchedPages >= MAX_PAGES) {
    throw new Error(
      `N11 ürün sayfalaması güvenlik limiti olan ${MAX_PAGES} sayfaya ulaştı.`
    );
  }

  return {
    products: Array.from(productsByStockCode.values()),
    reportedTotalElements,
    reportedTotalPages,
    fetchedPages,
    duplicateStockCodes,
  };
}

async function setChannelSyncState(
  client: PoolClient | Pool,
  state: 'IN_PROGRESS' | 'SUCCESS' | 'ERROR',
  errorMessage: string | null = null,
  markEnabled = false
) {
  await client.query(
    `
      INSERT INTO public.online_channels (
        channel,
        enabled,
        integrator_name,
        default_currency,
        auto_stock_sync,
        auto_price_sync,
        last_sync_at,
        last_sync_status,
        last_sync_error,
        updated_at
      )
      VALUES (
        'N11',
        $1,
        'CNETMOBIL',
        'TL',
        FALSE,
        FALSE,
        CASE WHEN $2 = 'SUCCESS' THEN now() ELSE NULL END,
        $2,
        $3,
        now()
      )
      ON CONFLICT (channel)
      DO UPDATE SET
        enabled = CASE
          WHEN $1 = TRUE THEN TRUE
          ELSE public.online_channels.enabled
        END,
        last_sync_at = CASE
          WHEN $2 = 'SUCCESS' THEN now()
          ELSE public.online_channels.last_sync_at
        END,
        last_sync_status = $2,
        last_sync_error = $3,
        updated_at = now()
    `,
    [markEnabled, state, errorMessage]
  );
}

async function importProducts(
  products: N11Product[],
  importedBy: ActiveUser
) {
  const pool = getPool();
  const client = await pool.connect();

  const stockCodes = products
    .map((product) => stringOrNull(product.stockCode, 250))
    .filter((value): value is string => Boolean(value));

  let existingStockCodes = new Set<string>();

  if (stockCodes.length > 0) {
    const existingResult = await client.query(
      `
        SELECT external_stock_code
        FROM public.online_listings
        WHERE channel = 'N11'
          AND external_stock_code = ANY($1::text[])
      `,
      [stockCodes]
    );

    existingStockCodes = new Set(
      existingResult.rows.map((row) => String(row.external_stock_code))
    );
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  try {
    await client.query('BEGIN');

    await setChannelSyncState(client, 'IN_PROGRESS');

    for (const product of products) {
      const stockCode = stringOrNull(product.stockCode, 250);

      if (!stockCode) {
        skipped += 1;
        continue;
      }

      const structured = deriveStructuredFields(product);

      const n11ProductId = stringOrNull(product.n11ProductId, 250);
      const productMainId = stringOrNull(product.productMainId, 500);
      const categoryId = bigintTextOrNull(product.categoryId);
      const title = stringOrNull(product.title, 1000);
      const description = stringOrNull(product.description, 50_000);
      const status = stringOrNull(product.status, 100);
      const saleStatus = stringOrNull(product.saleStatus, 100);
      const preparingDay = integerOrNull(product.preparingDay);
      const shipmentTemplate = stringOrNull(product.shipmentTemplate, 500);
      const currencyType =
        stringOrNull(product.currencyType, 20) || 'TL';
      const salePrice = moneyOrNull(product.salePrice);
      const listPrice = moneyOrNull(product.listPrice);
      const quantity = nonNegativeInteger(product.quantity, 0);
      const attributes = getAttributes(product);

      await client.query(
        `
          INSERT INTO public.online_listings AS ol (
            stock_device_id,
            channel,
            external_product_id,
            external_stock_code,
            external_product_main_id,
            category_id,
            title,
            description,
            sale_price,
            list_price,
            quantity,
            product_status,
            sale_status,
            sync_status,
            preparing_day,
            shipment_template,
            currency_type,
            attributes,
            raw_data,
            last_synced_at,
            brand,
            model,
            memory,
            color,
            grade,
            warranty,
            updated_at
          )
          VALUES (
            NULL,
            'N11',
            $1,
            $2,
            $3,
            $4::bigint,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            'SYNCED',
            $12,
            $13,
            $14,
            $15::jsonb,
            $16::jsonb,
            now(),
            $17,
            $18,
            $19,
            $20,
            $21,
            $22,
            now()
          )
          ON CONFLICT (channel, external_stock_code)
          DO UPDATE SET
            external_product_id = EXCLUDED.external_product_id,
            external_product_main_id = EXCLUDED.external_product_main_id,
            category_id = EXCLUDED.category_id,
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            sale_price = EXCLUDED.sale_price,
            list_price = EXCLUDED.list_price,

            -- ------------------------------------------------
            -- CANLI STOK KORUMASI
            --
            -- 1) Sipariş panelde N11 product-query'den önce görüldüyse:
            --    orderExpectedMaxQuantity üst sınırını koru.
            --
            -- 2) Aynı varyanta yeni IMEI eklendi ve N11 task henüz
            --    product-query'ye yansımadıysa en fazla 2 dakika
            --    poolStockTargetQuantity'yi koru.
            --
            -- Sonra tekrar N11 product-query authoritative olur.
            -- ------------------------------------------------
            quantity = CASE
              WHEN COALESCE(
                ol.raw_data->>'orderStockLock',
                'false'
              ) = 'true'
              THEN LEAST(
                EXCLUDED.quantity,
                CASE
                  WHEN COALESCE(
                    ol.raw_data->>'orderExpectedMaxQuantity',
                    ''
                  ) ~ '^[0-9]+$'
                  THEN (
                    ol.raw_data->>'orderExpectedMaxQuantity'
                  )::integer
                  ELSE 0
                END
              )

              WHEN COALESCE(
                ol.raw_data->>'poolStockIncreasePending',
                'false'
              ) = 'true'
              AND COALESCE(
                ol.raw_data->>'poolStockPendingUntil',
                ''
              ) <> ''
              AND now() <
                (
                  ol.raw_data->>'poolStockPendingUntil'
                )::timestamptz
              THEN GREATEST(
                EXCLUDED.quantity,
                CASE
                  WHEN COALESCE(
                    ol.raw_data->>'poolStockTargetQuantity',
                    ''
                  ) ~ '^[0-9]+$'
                  THEN (
                    ol.raw_data->>'poolStockTargetQuantity'
                  )::integer
                  ELSE EXCLUDED.quantity
                END
              )

              ELSE EXCLUDED.quantity
            END,

            product_status =
              EXCLUDED.product_status,

            sale_status = CASE
              WHEN COALESCE(
                ol.raw_data->>'orderStockLock',
                'false'
              ) = 'true'
              AND (
                CASE
                  WHEN COALESCE(
                    ol.raw_data->>'orderExpectedMaxQuantity',
                    ''
                  ) ~ '^[0-9]+$'
                  THEN (
                    ol.raw_data->>'orderExpectedMaxQuantity'
                  )::integer
                  ELSE 0
                END
              ) <= 0
              THEN COALESCE(
                ol.sale_status,
                'ORDER_RECEIVED'
              )
              ELSE EXCLUDED.sale_status
            END,

            sync_status = 'SYNCED',
            preparing_day =
              EXCLUDED.preparing_day,
            shipment_template =
              EXCLUDED.shipment_template,
            currency_type =
              EXCLUDED.currency_type,
            attributes =
              EXCLUDED.attributes,

            -- N11 raw_data güncellenirken bizim IMEI pool alanlarımız
            -- COALESCE(ol.raw_data) sayesinde korunur.
            raw_data =
              (
                COALESCE(
                  ol.raw_data,
                  '{}'::jsonb
                )
                || EXCLUDED.raw_data
              )
              ||
              CASE
                WHEN COALESCE(
                  ol.raw_data->>'orderStockLock',
                  'false'
                ) = 'true'
                THEN jsonb_build_object(
                  'orderStockLock',
                  CASE
                    WHEN EXCLUDED.quantity >
                      (
                        CASE
                          WHEN COALESCE(
                            ol.raw_data->>'orderExpectedMaxQuantity',
                            ''
                          ) ~ '^[0-9]+$'
                          THEN (
                            ol.raw_data->>'orderExpectedMaxQuantity'
                          )::integer
                          ELSE 0
                        END
                      )
                    THEN true
                    ELSE false
                  END,
                  'orderExpectedMaxQuantity',
                  CASE
                    WHEN COALESCE(
                      ol.raw_data->>'orderExpectedMaxQuantity',
                      ''
                    ) ~ '^[0-9]+$'
                    THEN (
                      ol.raw_data->>'orderExpectedMaxQuantity'
                    )::integer
                    ELSE 0
                  END,
                  'lastOrderNumber',
                  ol.raw_data->'lastOrderNumber',
                  'lastOrderPackageId',
                  ol.raw_data->'lastOrderPackageId',
                  'lastOrderLineId',
                  ol.raw_data->'lastOrderLineId',
                  'lastOrderStatus',
                  ol.raw_data->'lastOrderStatus',
                  'lastOrderSeenAt',
                  ol.raw_data->'lastOrderSeenAt'
                )
                ELSE '{}'::jsonb
              END
              ||
              CASE
                WHEN COALESCE(
                  ol.raw_data->>'poolStockIncreasePending',
                  'false'
                ) = 'true'
                THEN jsonb_build_object(
                  'poolStockIncreasePending',
                  CASE
                    WHEN (
                      COALESCE(
                        ol.raw_data->>'poolStockTargetQuantity',
                        ''
                      ) ~ '^[0-9]+$'
                      AND EXCLUDED.quantity >=
                        (
                          ol.raw_data->>'poolStockTargetQuantity'
                        )::integer
                    )
                    OR (
                      COALESCE(
                        ol.raw_data->>'poolStockPendingUntil',
                        ''
                      ) <> ''
                      AND now() >=
                        (
                          ol.raw_data->>'poolStockPendingUntil'
                        )::timestamptz
                    )
                    THEN false
                    ELSE true
                  END,
                  'poolStockTargetQuantity',
                  CASE
                    WHEN COALESCE(
                      ol.raw_data->>'poolStockTargetQuantity',
                      ''
                    ) ~ '^[0-9]+$'
                    THEN (
                      ol.raw_data->>'poolStockTargetQuantity'
                    )::integer
                    ELSE EXCLUDED.quantity
                  END,
                  'poolStockPendingUntil',
                  ol.raw_data->'poolStockPendingUntil',
                  'poolStockTaskId',
                  ol.raw_data->'poolStockTaskId'
                )
                ELSE '{}'::jsonb
              END,

            last_synced_at = now(),

            -- Manuel girilmis duzenli alanlari silme.
            -- N11 attribute'ta varsa sadece bos alani doldur.
            brand = COALESCE(ol.brand, EXCLUDED.brand),
            model = COALESCE(ol.model, EXCLUDED.model),
            memory = COALESCE(ol.memory, EXCLUDED.memory),
            color = COALESCE(ol.color, EXCLUDED.color),
            grade = COALESCE(ol.grade, EXCLUDED.grade),
            warranty = COALESCE(ol.warranty, EXCLUDED.warranty),

            updated_at = now()
        `,
        [
          n11ProductId,
          stockCode,
          productMainId,
          categoryId,
          title,
          description,
          salePrice,
          listPrice,
          quantity,
          status,
          saleStatus,
          preparingDay,
          shipmentTemplate,
          currencyType,
          JSON.stringify(attributes),
          JSON.stringify({
            source: 'N11_PRODUCT_QUERY',
            importedBy: importedBy.username,
            importedAt: new Date().toISOString(),
            n11: product,
          }),
          structured.brand,
          structured.model,
          structured.memory,
          structured.color,
          structured.grade,
          structured.warranty,
        ]
      );

      if (existingStockCodes.has(stockCode)) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    await setChannelSyncState(client, 'SUCCESS', null, true);

    await client.query('COMMIT');

    return {
      inserted,
      updated,
      skipped,
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);

    const message =
      error instanceof Error
        ? error.message.slice(0, 1000)
        : 'Bilinmeyen import hatası';

    await setChannelSyncState(pool, 'ERROR', message).catch(
      () => undefined
    );

    throw error;
  } finally {
    client.release();
  }
}

function makePreview(products: N11Product[]) {
  return products.slice(0, 5).map((product) => ({
    n11ProductId: stringOrNull(product.n11ProductId, 250),
    stockCode: stringOrNull(product.stockCode, 250),
    title: stringOrNull(product.title, 1000),
    salePrice: moneyOrNull(product.salePrice),
    listPrice: moneyOrNull(product.listPrice),
    quantity: nonNegativeInteger(product.quantity, 0),
    status: stringOrNull(product.status, 100),
    saleStatus: stringOrNull(product.saleStatus, 100),
    structured: deriveStructuredFields(product),
  }));
}

// ============================================================
// GET /api/online/n11/import
//
// SADECE PREVIEW.
// Tum sayfalari ceker fakat PostgreSQL'e YAZMAZ.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperAdmin(request);

    if (auth.response || !auth.user) {
      return auth.response!;
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

    const startedAt = Date.now();
    const result = await fetchAllN11Products(credentials);

    return json({
      success: true,
      mode: 'PREVIEW',
      databaseChanged: false,
      message:
        'N11 ürünlerinin tamamı başarıyla çekildi. PostgreSQL değiştirilmedi.',
      reportedTotalElements: result.reportedTotalElements,
      reportedTotalPages: result.reportedTotalPages,
      fetchedPages: result.fetchedPages,
      fetchedUniqueProducts: result.products.length,
      duplicateStockCodes: result.duplicateStockCodes,
      durationMs: Date.now() - startedAt,
      sampleProducts: makePreview(result.products),
      checkedBy: auth.user.username,
    });
  } catch (error) {
    console.error('N11 IMPORT PREVIEW ERROR:', error);

    return json(
      {
        success: false,
        mode: 'PREVIEW',
        databaseChanged: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 ürünleri çekilemedi.',
      },
      502
    );
  }
}

// ============================================================
// POST /api/online/n11/import
//
// GERCEK IMPORT / UPSERT.
// N11'den tum urunleri ceker ve public.online_listings'e yazar.
// N11'e veri YAZMAZ.
// ============================================================
export async function POST(request: NextRequest) {
  try {
    const auth = await authorizeImportPost(request);

    if (auth.response || !auth.user) {
      return auth.response!;
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

    const startedAt = Date.now();
    const result = await fetchAllN11Products(credentials);

    if (result.products.length === 0) {
      return json(
        {
          success: false,
          error:
            'N11 ürün sorgusu 0 ürün döndürdü. Güvenlik için PostgreSQL importu çalıştırılmadı.',
        },
        409
      );
    }

    const importResult = await importProducts(
      result.products,
      auth.user
    );

    return json({
      success: true,
      mode: auth.mode === 'AUTO_SYNC' ? 'AUTO_SYNC' : 'IMPORT',
      databaseChanged: true,
      message: 'N11 canlı ürün/stok/fiyat verileri PostgreSQL online_listings tablosuna senkronlandı.',
      reportedTotalElements: result.reportedTotalElements,
      fetchedPages: result.fetchedPages,
      fetchedUniqueProducts: result.products.length,
      duplicateStockCodes: result.duplicateStockCodes,
      inserted: importResult.inserted,
      updated: importResult.updated,
      skipped: importResult.skipped,
      durationMs: Date.now() - startedAt,
      importedBy: auth.user.username,
      automatic: auth.mode === 'AUTO_SYNC',
    });
  } catch (error) {
    console.error('N11 IMPORT ERROR:', error);

    return json(
      {
        success: false,
        mode: 'IMPORT',
        databaseChanged: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 ürün importu tamamlanamadı.',
      },
      500
    );
  }
}
