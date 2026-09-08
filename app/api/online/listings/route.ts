// app/api/online/listings/route.ts
// CNETMOBIL ONLINE - N11 urun yonetimi
// GERCEK N11 urun olusturma + fiyat / stok guncelleme.
// Yeni fiziksel cihaz icin stockCode = IMEI.
// KDV online_channels.default_vat_rate alanindan otomatik alinır.
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
const N11_CATEGORY_ATTRIBUTE_BASE_URL =
  'https://api.n11.com/cdn/category';
const N11_CATALOG_SOAP_ENDPOINTS = [
  'https://api.n11.com/ws/CatalogService',
  'https://api.n11.com/ws/CatalogService.wsdl',
];
const N11_PHONE_CATEGORY_ID = 1000476;
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
  const rawValue =
    channelRow?.default_vat_rate !== null &&
    channelRow?.default_vat_rate !== undefined
      ? String(channelRow.default_vat_rate)
      : '';

  const vatRate = Number(rawValue);

  if (![0, 1, 10, 20].includes(vatRate)) {
    throw new Error(
      'N11 kanal KDV oranı ayarlı değil. online_channels.default_vat_rate alanını 0, 1, 10 veya 20 olarak ayarlayın.'
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

function normalizeTemplateValue(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '');
}

function rowSearchText(row: any, rawProduct: any) {
  return normalizeTemplateValue(
    [
      row?.brand,
      row?.model,
      row?.memory,
      row?.color,
      row?.title,
      rawProduct?.title,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

async function fetchLiveN11ProductsForTemplate() {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.'
    );
  }

  const products: any[] = [];
  const pageSize = 50;

  for (let page = 0; page < 20; page += 1) {
    const url = new URL(N11_PRODUCT_QUERY_URL);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(pageSize));

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

    products.push(...content);

    const totalPages = Number(payload?.totalPages);

    if (
      content.length === 0 ||
      (Number.isInteger(totalPages) && page + 1 >= totalPages) ||
      content.length < pageSize
    ) {
      break;
    }
  }

  return products;
}

function liveProductSearchText(product: any) {
  const attributeText = Array.isArray(product?.attributes)
    ? product.attributes
        .map((item: any) =>
          [
            item?.attributeName,
            item?.attributeValue,
            item?.value,
            item?.customValue,
          ]
            .filter(Boolean)
            .join(' ')
        )
        .join(' ')
    : '';

  return normalizeTemplateValue(
    [
      product?.title,
      product?.description,
      product?.brandName,
      attributeText,
    ]
      .filter(Boolean)
      .join(' ')
  );
}

function generatedProductMainId(params: {
  brand: string;
  model: string;
  memory: string;
}) {
  const raw = [
    'CNET',
    params.brand,
    params.model,
    params.memory,
  ]
    .map((item) =>
      normalizeTemplateValue(item).toUpperCase()
    )
    .filter(Boolean)
    .join('-');

  return raw.slice(0, 120);
}

async function findCatalogTemplate(params: {
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
}) {
  // Önce doğrudan N11'den güncel satıcı ürünlerini çekiyoruz.
  // İki mod:
  // QUICK = catalogId veya barcode var -> Hızlı Ürün Yükleme
  // FULL  = catalogId/barcode yok ama aynı ürün var -> normal CreateProduct
  const liveProducts = await fetchLiveN11ProductsForTemplate();

  const wantedBrand = normalizeTemplateValue(params.brand);
  const wantedModel = normalizeTemplateValue(params.model);
  const wantedMemory = normalizeTemplateValue(params.memory);
  const wantedColor = normalizeTemplateValue(params.color);

  type Candidate = {
    row: any;
    rawProduct: any;
    catalogId: number | null;
    barcode: string | null;
    score: number;
    source: 'N11_LIVE' | 'POSTGRES';
    createMode: 'QUICK' | 'FULL';
  };

  const quickCandidates: Candidate[] = [];
  const fullCandidates: Candidate[] = [];
  const nearMatches: Array<{
    title: string;
    stockCode: string;
    hasCatalogId: boolean;
    hasBarcode: boolean;
  }> = [];

  for (const product of liveProducts) {
    const searchable = liveProductSearchText(product);

    const modelOk =
      !wantedModel || searchable.includes(wantedModel);

    const memoryOk =
      !wantedMemory || searchable.includes(wantedMemory);

    const brandOk =
      !wantedBrand ||
      searchable.includes(wantedBrand) ||
      (wantedBrand === 'apple' && searchable.includes('iphone'));

    if (!brandOk || !modelOk || !memoryOk) {
      continue;
    }

    const colorOk =
      !wantedColor || searchable.includes(wantedColor);

    const catalogId = positiveIntegerOrNull(product?.catalogId);
    const barcodeText =
      product?.barcode === null ||
      product?.barcode === undefined
        ? ''
        : String(product.barcode).trim();
    const barcode = barcodeText || null;

    nearMatches.push({
      title: String(product?.title || '').trim(),
      stockCode: String(product?.stockCode || '').trim(),
      hasCatalogId: Boolean(catalogId),
      hasBarcode: Boolean(barcode),
    });

    if (!colorOk) {
      continue;
    }

    const categoryId = positiveIntegerOrNull(product?.categoryId);
    const shipmentTemplate = String(
      product?.shipmentTemplate || ''
    ).trim();

    if (!categoryId || !shipmentTemplate) {
      continue;
    }

    let score = 100;

    if (wantedColor && searchable.includes(wantedColor)) {
      score += 20;
    }

    if (String(product?.status || '').trim() === 'Active') {
      score += 5;
    }

    const candidate: Candidate = {
      row: {
        id: null,
        external_product_id:
          product?.n11ProductId === null ||
          product?.n11ProductId === undefined
            ? null
            : String(product.n11ProductId),
        external_product_main_id:
          product?.productMainId === null ||
          product?.productMainId === undefined
            ? null
            : String(product.productMainId),
        category_id: product?.categoryId ?? null,
        title: product?.title ?? null,
        description: product?.description ?? null,
        preparing_day: product?.preparingDay ?? null,
        shipment_template: product?.shipmentTemplate ?? null,
        product_status: product?.status ?? null,
      },
      rawProduct: product,
      catalogId,
      barcode,
      score,
      source: 'N11_LIVE',
      createMode:
        catalogId || barcode ? 'QUICK' : 'FULL',
    };

    if (candidate.createMode === 'QUICK') {
      quickCandidates.push(candidate);
    } else {
      fullCandidates.push(candidate);
    }
  }

  quickCandidates.sort((a, b) => b.score - a.score);
  fullCandidates.sort((a, b) => b.score - a.score);

  const bestLive = quickCandidates[0] || fullCandidates[0];

  if (bestLive) {
    return {
      row: bestLive.row,
      rawProduct: bestLive.rawProduct,
      catalogId: bestLive.catalogId,
      barcode: bestLive.barcode,
      source: bestLive.source,
      createMode: bestLive.createMode,
      nearMatches,
    };
  }

  // Canlı N11 cevabında tam eşleşme yoksa PostgreSQL'e bak.
  const result = await getPool().query(
    `
      SELECT *
      FROM public.online_listings
      WHERE channel = 'N11'
        AND external_product_id IS NOT NULL
        AND category_id IS NOT NULL
        AND shipment_template IS NOT NULL
      ORDER BY
        CASE WHEN product_status = 'Active' THEN 0 ELSE 1 END,
        last_synced_at DESC NULLS LAST,
        updated_at DESC
      LIMIT 1000
    `
  );

  for (const row of result.rows) {
    const rawProduct = rawN11Product(row);
    const searchable = rowSearchText(row, rawProduct);

    const brandOk =
      !wantedBrand ||
      normalizeTemplateValue(row?.brand) === wantedBrand ||
      searchable.includes(wantedBrand) ||
      (wantedBrand === 'apple' && searchable.includes('iphone'));

    const modelOk =
      !wantedModel ||
      normalizeTemplateValue(row?.model) === wantedModel ||
      searchable.includes(wantedModel);

    const memoryOk =
      !wantedMemory ||
      normalizeTemplateValue(row?.memory) === wantedMemory ||
      searchable.includes(wantedMemory);

    const colorOk =
      !wantedColor ||
      normalizeTemplateValue(row?.color) === wantedColor ||
      searchable.includes(wantedColor);

    if (!brandOk || !modelOk || !memoryOk || !colorOk) {
      continue;
    }

    const catalogId = positiveIntegerOrNull(rawProduct?.catalogId);
    const barcodeText =
      rawProduct?.barcode === null ||
      rawProduct?.barcode === undefined
        ? ''
        : String(rawProduct.barcode).trim();

    const barcode = barcodeText || null;

    return {
      row,
      rawProduct,
      catalogId,
      barcode,
      source: 'POSTGRES' as const,
      createMode:
        catalogId || barcode ? ('QUICK' as const) : ('FULL' as const),
      nearMatches,
    };
  }

  return {
    row: null,
    rawProduct: null,
    catalogId: null,
    barcode: null,
    source: null,
    createMode: null,
    nearMatches: nearMatches.slice(0, 5),
  };
}

function cleanHttpsImageUrl(value: unknown) {
  const text = String(value ?? '').trim();

  if (!text) return null;

  try {
    const url = new URL(text);

    if (url.protocol !== 'https:') return null;

    return url.toString();
  } catch {
    return null;
  }
}

function extractTemplateImageUrls(product: any, suppliedImageUrl: unknown) {
  const urls: string[] = [];

  const add = (value: unknown) => {
    const cleaned = cleanHttpsImageUrl(value);
    if (cleaned && !urls.includes(cleaned)) {
      urls.push(cleaned);
    }
  };

  add(suppliedImageUrl);

  if (Array.isArray(product?.images)) {
    product.images.forEach((item: any) => {
      if (typeof item === 'string') {
        add(item);
      } else {
        add(item?.url);
        add(item?.imageUrl);
      }
    });
  }

  if (Array.isArray(product?.imageUrls)) {
    product.imageUrls.forEach(add);
  }

  add(product?.imageUrl);
  add(product?.image);

  const description = String(product?.description || '');

  const matches = description.match(
    /https:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)(?:\?[^\s"'<>]*)?/gi
  );

  if (Array.isArray(matches)) {
    matches.forEach(add);
  }

  return urls.slice(0, 8);
}

async function fetchCategoryAttributes(categoryId: number) {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.'
    );
  }

  const response = await fetch(
    `${N11_CATEGORY_ATTRIBUTE_BASE_URL}/${categoryId}/attribute`,
    {
      method: 'GET',
      cache: 'no-store',
      headers: {
        appkey: credentials.appKey,
        Accept: 'application/json',
      },
    }
  );

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
        ? `N11 kategori özellikleri: ${message}`
        : `N11 kategori özellikleri HTTP ${response.status} hatası döndürdü.`
    );
  }

  const attributes = Array.isArray(payload?.categoryAttributes)
    ? payload.categoryAttributes
    : [];

  if (attributes.length === 0) {
    throw new Error(
      `N11 kategori ${categoryId} için özellik listesi boş döndü.`
    );
  }

  return attributes;
}

function getExistingAttributeValue(
  productAttributes: any[],
  attributeId: number
) {
  const found = productAttributes.find(
    (item: any) =>
      Number(item?.attributeId ?? item?.id) === attributeId
  );

  if (!found) return null;

  const value =
    found?.attributeValue ??
    found?.value ??
    found?.customValue ??
    null;

  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  return text || null;
}

async function buildFullCreateAttributes(params: {
  categoryId: number;
  templateProduct: any;
}) {
  const definitions = await fetchCategoryAttributes(
    params.categoryId
  );

  const productAttributes = Array.isArray(
    params.templateProduct?.attributes
  )
    ? params.templateProduct.attributes
    : [];

  const output: Array<{
    id: number;
    valueId: number | null;
    customValue: string | null;
  }> = [];

  const missingMandatory: string[] = [];

  for (const definition of definitions) {
    const attributeId = Number(definition?.attributeId);

    if (!Number.isInteger(attributeId) || attributeId < 1) {
      continue;
    }

    const isMandatory = Boolean(definition?.isMandatory);
    const isCustomValue = Boolean(definition?.isCustomValue);

    const currentValue = getExistingAttributeValue(
      productAttributes,
      attributeId
    );

    if (!currentValue) {
      if (isMandatory) {
        missingMandatory.push(
          String(
            definition?.attributeName ||
              `Attribute ${attributeId}`
          )
        );
      }

      continue;
    }

    if (isCustomValue) {
      output.push({
        id: attributeId,
        valueId: null,
        customValue: currentValue,
      });

      continue;
    }

    const allowedValues = Array.isArray(
      definition?.attributeValues
    )
      ? definition.attributeValues
      : [];

    const normalizedCurrent =
      normalizeTemplateValue(currentValue);

    const matchedValue = allowedValues.find(
      (item: any) =>
        normalizeTemplateValue(item?.value) ===
        normalizedCurrent
    );

    const valueId = Number(matchedValue?.id);

    if (!Number.isInteger(valueId) || valueId < 1) {
      if (isMandatory) {
        missingMandatory.push(
          `${String(
            definition?.attributeName ||
              `Attribute ${attributeId}`
          )}: ${currentValue}`
        );
      }

      continue;
    }

    output.push({
      id: attributeId,
      valueId,
      customValue: null,
    });
  }

  if (missingMandatory.length > 0) {
    throw new Error(
      `N11 zorunlu kategori özellikleri otomatik eşleştirilemedi: ${missingMandatory.join(
        ', '
      )}`
    );
  }

  return output;
}


function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlDecode(value: string | null) {
  if (!value) return null;

  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function xmlTagValue(xml: string, tag: string) {
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${tag}>`,
    'i'
  );

  const match = xml.match(pattern);

  if (!match?.[1]) return null;

  return xmlDecode(
    match[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
  );
}

type N11CatalogProduct = {
  catalogId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  productTitle: string | null;
  usc: string | null;
};

function parseSearchCatalogProducts(xml: string) {
  const products: N11CatalogProduct[] = [];

  const productRegex =
    /<(?:[A-Za-z0-9_]+:)?product\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?product>/gi;

  let match: RegExpExecArray | null;

  while ((match = productRegex.exec(xml)) !== null) {
    const block = match[1] || '';

    const catalogId = xmlTagValue(block, 'catalogId');
    const categoryId = xmlTagValue(block, 'categoryId');
    const categoryName = xmlTagValue(block, 'categoryName');
    const productTitle = xmlTagValue(block, 'productTitle');
    const usc = xmlTagValue(block, 'usc');

    if (catalogId || categoryId || productTitle) {
      products.push({
        catalogId,
        categoryId,
        categoryName,
        productTitle,
        usc,
      });
    }
  }

  return products;
}

function buildSearchCatalogXml(params: {
  appKey: string;
  appSecret: string;
  title: string;
  brand: string;
  categoryId: number;
  currentPage: number;
}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sch="http://www.n11.com/ws/schemas">
  <soapenv:Header/>
  <soapenv:Body>
    <sch:SearchCatalogRequest>
      <auth>
        <appKey>${xmlEscape(params.appKey)}</appKey>
        <appSecret>${xmlEscape(params.appSecret)}</appSecret>
      </auth>
      <productTitles>${xmlEscape(params.title)}</productTitles>
      <categoryId>${params.categoryId}</categoryId>
      <uscs></uscs>
      <brandName>${xmlEscape(params.brand)}</brandName>
      <catalogIds></catalogIds>
      <currentPage>${params.currentPage}</currentPage>
    </sch:SearchCatalogRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function searchN11Catalog(params: {
  brand: string;
  title: string;
  categoryId: number;
  maxPages?: number;
}) {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.'
    );
  }

  const maxPages = Math.max(
    1,
    Math.min(Number(params.maxPages || 8), 12)
  );

  let lastError = '';

  for (const endpoint of N11_CATALOG_SOAP_ENDPOINTS) {
    const collected: N11CatalogProduct[] = [];
    const seenCatalogIds = new Set<string>();

    let endpointFailed = false;

    for (
      let currentPage = 0;
      currentPage < maxPages;
      currentPage += 1
    ) {
      const xml = buildSearchCatalogXml({
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        title: params.title,
        brand: params.brand,
        categoryId: params.categoryId,
        currentPage,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        20_000
      );

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            Accept: 'text/xml, application/xml',
            SOAPAction: '',
          },
          body: xml,
          signal: controller.signal,
        });

        const rawText = await response.text();

        if (!response.ok) {
          lastError =
            xmlTagValue(rawText, 'faultstring') ||
            xmlTagValue(rawText, 'errorMessage') ||
            `HTTP ${response.status}`;

          endpointFailed = true;
          break;
        }

        const pageProducts =
          parseSearchCatalogProducts(rawText);

        if (pageProducts.length === 0) {
          break;
        }

        let newProductCount = 0;

        for (const product of pageProducts) {
          const key = String(
            product.catalogId ||
              `${product.productTitle}|${product.usc}`
          ).trim();

          if (!key || seenCatalogIds.has(key)) {
            continue;
          }

          seenCatalogIds.add(key);
          collected.push(product);
          newProductCount += 1;
        }

        // N11 bazı durumlarda currentPage'i dikkate almayıp
        // aynı ilk sayfayı döndürebiliyor. Sonsuz tekrar olmasın.
        if (newProductCount === 0) {
          break;
        }

        // SearchCatalog pratikte 10'luk sayfalar döndürüyor.
        // 10'dan az geldiyse son sayfa kabul ediyoruz.
        if (pageProducts.length < 10) {
          break;
        }
      } catch (error) {
        lastError =
          error instanceof Error
            ? error.message
            : 'SOAP bağlantı hatası';

        endpointFailed = true;
        break;
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (collected.length > 0) {
      return collected;
    }

    if (!endpointFailed) {
      return [];
    }
  }

  throw new Error(
    lastError
      ? `N11 SearchCatalog bağlantısı başarısız: ${lastError}`
      : 'N11 SearchCatalog bağlantısı başarısız.'
  );
}

function containsUnexpectedModelVariant(
  wantedModel: string,
  candidateTitle: string
) {
  const wanted = normalizeTemplateValue(wantedModel);
  const candidate =
    normalizeTemplateValue(candidateTitle);

  const variants = [
    'promax',
    'pro',
    'plus',
    'ultra',
    'mini',
    'max',
    'fe',
  ];

  for (const variant of variants) {
    const wantedHasVariant =
      wanted.includes(variant);

    const candidateHasVariantAfterModel =
      candidate.includes(`${wanted}${variant}`);

    if (
      !wantedHasVariant &&
      candidateHasVariantAfterModel
    ) {
      return true;
    }
  }

  return false;
}

function renewedGradeToken(value: string) {
  const normalized = normalizeTemplateValue(value);

  if (normalized === 'a' || normalized === 'akalite') {
    return 'akalite';
  }

  if (normalized === 'b' || normalized === 'bkalite') {
    return 'bkalite';
  }

  if (normalized === 'c' || normalized === 'ckalite') {
    return 'ckalite';
  }

  return normalized;
}

function renewedMemoryLabel(value: string) {
  const raw = String(value || '').trim();
  const normalized = normalizeTemplateValue(raw);

  const gbMatch = normalized.match(/^(\d+)gb$/);
  if (gbMatch) {
    return `${gbMatch[1]} GB`;
  }

  const tbMatch = normalized.match(/^(\d+)tb$/);
  if (tbMatch) {
    return `${tbMatch[1]} TB`;
  }

  return raw;
}

function renewedGradeLabel(value: string) {
  const token = renewedGradeToken(value);

  if (token === 'akalite') return 'A Kalite';
  if (token === 'bkalite') return 'B Kalite';
  if (token === 'ckalite') return 'C Kalite';

  return String(value || '').trim();
}

function renewedWarrantyLabel(value: string) {
  const normalized =
    normalizeTemplateValue(value);

  const monthMatch =
    normalized.match(/^(\d{1,2})ay(?:garantili)?$/);

  if (monthMatch) {
    return `${Number(monthMatch[1])} Ay Garantili`;
  }

  const yearMatch =
    normalized.match(/^(\d{1,2})yil(?:garantili)?$/);

  if (yearMatch) {
    const months =
      Number(yearMatch[1]) * 12;

    return `${months} Ay Garantili`;
  }

  return String(value || '').trim();
}

function isRenewedCatalogTitle(title: string) {
  const normalized = normalizeTemplateValue(title);

  return (
    normalized.includes('yenilenmis') ||
    normalized.includes('renewed')
  );
}

function chooseCatalogProduct(params: {
  products: N11CatalogProduct[];
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
}) {
  const wantedBrand =
    normalizeTemplateValue(params.brand);
  const wantedModel =
    normalizeTemplateValue(params.model);
  const wantedMemory =
    normalizeTemplateValue(params.memory);
  const wantedColor =
    normalizeTemplateValue(params.color);
  const wantedGrade =
    renewedGradeToken(params.grade);
  const wantedWarranty =
    normalizeTemplateValue(params.warranty);

  const scored = params.products
    .map((product) => {
      const title = String(
        product.productTitle || ''
      ).trim();

      const normalizedTitle =
        normalizeTemplateValue(title);

      if (
        !product.catalogId ||
        !product.categoryId ||
        !title
      ) {
        return null;
      }

      // KRİTİK GÜVENLİK:
      // Panel sadece yenilenmiş cihaz açar.
      // N11'in sıfır / distribütör garantili ana kataloğu ASLA seçilmez.
      if (!isRenewedCatalogTitle(title)) {
        return null;
      }

      if (
        wantedBrand &&
        !normalizedTitle.includes(wantedBrand)
      ) {
        return null;
      }

      if (
        wantedModel &&
        !normalizedTitle.includes(wantedModel)
      ) {
        return null;
      }

      if (
        containsUnexpectedModelVariant(
          params.model,
          title
        )
      ) {
        return null;
      }

      if (
        wantedMemory &&
        !normalizedTitle.includes(wantedMemory)
      ) {
        return null;
      }

      if (
        wantedColor &&
        !normalizedTitle.includes(wantedColor)
      ) {
        return null;
      }

      // Katalog başlığında kalite bilgisi varsa yanlış kaliteyi ASLA seçme.
      // Kalite başlıkta hiç yoksa sadece skorlamada kullan.
      const candidateHasKnownGrade =
        normalizedTitle.includes('akalite') ||
        normalizedTitle.includes('bkalite') ||
        normalizedTitle.includes('ckalite');

      if (
        wantedGrade &&
        ['akalite', 'bkalite', 'ckalite'].includes(
          wantedGrade
        ) &&
        candidateHasKnownGrade &&
        !normalizedTitle.includes(wantedGrade)
      ) {
        return null;
      }

      // Katalog başlığında garanti süresi varsa yanlış süreyi ASLA seçme.
      // "12AY" -> "12ay", başlıktaki "12 Ay Garantili" -> "12aygarantili".
      const warrantyTokens = [
        '3ay',
        '6ay',
        '12ay',
        '18ay',
        '24ay',
        '36ay',
      ];

      const candidateWarrantyToken =
        warrantyTokens.find((token) =>
          normalizedTitle.includes(token)
        );

      if (
        wantedWarranty &&
        candidateWarrantyToken &&
        !normalizedTitle.includes(wantedWarranty)
      ) {
        return null;
      }

      let score = 1000; // yenilenmiş ürün olduğu için ana öncelik

      if (
        wantedColor &&
        normalizedTitle.includes(wantedColor)
      ) {
        score += 50;
      }

      if (
        wantedMemory &&
        normalizedTitle.includes(wantedMemory)
      ) {
        score += 40;
      }

      if (
        wantedModel &&
        normalizedTitle.includes(wantedModel)
      ) {
        score += 40;
      }

      if (
        wantedGrade &&
        normalizedTitle.includes(wantedGrade)
      ) {
        score += 30;
      }

      if (
        wantedWarranty &&
        normalizedTitle.includes(wantedWarranty)
      ) {
        score += 20;
      }

      return {
        product,
        score,
      };
    })
    .filter(
      (
        item
      ): item is {
        product: N11CatalogProduct;
        score: number;
      } => Boolean(item)
    )
    .sort((a, b) => b.score - a.score);

  return scored[0]?.product || null;
}

async function findRenewedCatalogFromLocalMemory(params: {
  pool: Pool;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
}) {
  const result = await params.pool.query(
    `
      SELECT
        id,
        category_id,
        title,
        brand,
        model,
        memory,
        color,
        grade,
        warranty,
        raw_data,
        updated_at
      FROM public.online_listings
      WHERE channel = 'N11'
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 500
    `
  );

  const products: N11CatalogProduct[] = [];

  for (const row of result.rows) {
    const raw =
      row?.raw_data &&
      typeof row.raw_data === 'object'
        ? row.raw_data
        : {};

    const rawN11 =
      raw?.n11 &&
      typeof raw.n11 === 'object'
        ? raw.n11
        : {};

    const catalogId =
      positiveIntegerOrNull(
        raw?.selectedCatalogId
      ) ||
      positiveIntegerOrNull(
        rawN11?.catalogId
      );

    const categoryId =
      positiveIntegerOrNull(
        raw?.selectedCatalogCategoryId
      ) ||
      positiveIntegerOrNull(
        rawN11?.categoryId
      ) ||
      positiveIntegerOrNull(
        row?.category_id
      );

    const productTitle = String(
      raw?.selectedCatalogTitle ||
        rawN11?.title ||
        row?.title ||
        ''
    ).trim();

    const usc = String(
      raw?.selectedCatalogUsc ||
        rawN11?.barcode ||
        ''
    ).trim();

    if (
      !catalogId ||
      !categoryId ||
      !productTitle ||
      !isRenewedCatalogTitle(productTitle)
    ) {
      continue;
    }

    products.push({
      catalogId: String(catalogId),
      categoryId: String(categoryId),
      categoryName: 'Cep Telefonu',
      productTitle,
      usc,
    });
  }

  return chooseCatalogProduct({
    products,
    brand: params.brand,
    model: params.model,
    memory: params.memory,
    color: params.color,
    grade: params.grade,
    warranty: params.warranty,
  });
}


async function getN11RenewedPhoneCategoryId(pool: Pool) {
  // KRİTİK:
  // Yenilenmiş cihazlar N11'de sıfır "Cep Telefonu" kategorisinden
  // farklı bir leaf category altında olabiliyor.
  //
  // Bizim N11 ürünlerimiz product-query ile PostgreSQL'e zaten
  // category_id olarak senkronlandığı için, en güvenli kaynak
  // kendi gerçek yenilenmiş ürünlerimizin kullandığı category_id'dir.
  const result = await pool.query(
    `
      SELECT
        category_id,
        COUNT(*)::int AS product_count
      FROM public.online_listings
      WHERE channel = 'N11'
        AND category_id IS NOT NULL
        AND (
          title ILIKE '%Yenilen%'
          OR title ILIKE '%Renewed%'
        )
      GROUP BY category_id
      ORDER BY product_count DESC, category_id ASC
      LIMIT 1
    `
  );

  const categoryId =
    positiveIntegerOrNull(
      result.rows[0]?.category_id
    );

  if (!categoryId) {
    throw new Error(
      'N11 yenilenmiş telefon kategori ID değeri mevcut senkron ürünlerden bulunamadı.'
    );
  }

  return {
    categoryId,
    productCount:
      Number(result.rows[0]?.product_count || 0),
  };
}

async function getN11StoreDefaults() {
  const result = await getPool().query(
    `
      SELECT
        c.default_vat_rate,
        c.default_preparing_day,
        c.default_shipment_template,
        (
          SELECT ol.preparing_day
          FROM public.online_listings ol
          WHERE ol.channel = 'N11'
            AND ol.preparing_day IS NOT NULL
            AND ol.preparing_day > 0
          ORDER BY
            ol.last_synced_at DESC NULLS LAST,
            ol.updated_at DESC
          LIMIT 1
        ) AS fallback_preparing_day,
        (
          SELECT ol.shipment_template
          FROM public.online_listings ol
          WHERE ol.channel = 'N11'
            AND NULLIF(TRIM(ol.shipment_template), '') IS NOT NULL
          ORDER BY
            ol.last_synced_at DESC NULLS LAST,
            ol.updated_at DESC
          LIMIT 1
        ) AS fallback_shipment_template
      FROM public.online_channels c
      WHERE c.channel = 'N11'
      LIMIT 1
    `
  );

  return result.rows[0] ?? null;
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

function parseN11ReferenceUrl(value: unknown) {
  const text = String(value ?? '').trim();

  if (!text) return null;

  try {
    const url = new URL(text);

    if (url.protocol !== 'https:') {
      return null;
    }

    const hostname = url.hostname.toLowerCase();

    if (
      hostname !== 'n11.com' &&
      hostname !== 'www.n11.com' &&
      !hostname.endsWith('.n11.com')
    ) {
      return null;
    }

    const path = url.pathname;

    const matches = [
      ...path.matchAll(/-(\d{5,})(?=\/|$)/g),
    ];

    const lastMatch = matches[matches.length - 1];
    const productId = lastMatch?.[1] || null;

    return {
      url: url.toString(),
      productId,
    };
  } catch {
    return null;
  }
}

async function queryN11ProductById(productId: string) {
  const credentials = getN11Credentials();

  if (!credentials) {
    throw new Error(
      'N11_APP_KEY veya N11_APP_SECRET environment değişkeni eksik.'
    );
  }

  if (!/^\d+$/.test(productId)) {
    throw new Error('N11 ürün kodu geçersiz.');
  }

  const url = new URL(N11_PRODUCT_QUERY_URL);
  url.searchParams.set('id', productId);
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
        ? `N11 örnek ürün sorgulama: ${message}`
        : `N11 product-query HTTP ${response.status} hatası döndürdü.`
    );
  }

  const content = Array.isArray(payload?.content)
    ? payload.content
    : [];

  return (
    content.find(
      (item: any) =>
        String(item?.n11ProductId || '').trim() === productId
    ) ||
    content[0] ||
    null
  );
}

function decodeHtmlAttribute(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function fetchN11ReferenceImage(referenceUrl: string) {
  const parsed = parseN11ReferenceUrl(referenceUrl);

  if (!parsed) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch(parsed.url, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent':
          'Mozilla/5.0 (compatible; CNETMOBIL-N11-Integration/1.0)',
      },
      redirect: 'follow',
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const html = await response.text();

    const patterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);

      if (!match?.[1]) continue;

      const cleaned = cleanHttpsImageUrl(
        decodeHtmlAttribute(match[1])
      );

      if (cleaned) return cleaned;
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function templateFromReferenceUrl(
  referenceUrl: string
) {
  const parsed = parseN11ReferenceUrl(referenceUrl);

  if (!parsed) {
    throw new Error(
      'N11 örnek ürün linki geçersiz. n11.com üzerindeki ürün sayfası linkini yapıştırın.'
    );
  }

  if (!parsed.productId) {
    throw new Error(
      'N11 örnek ürün linkinden ürün kodu okunamadı.'
    );
  }

  const product = await queryN11ProductById(
    parsed.productId
  );

  if (!product) {
    throw new Error(
      `N11 API'de ürün kodu ${parsed.productId} bulunamadı. Link kendi N11 mağazanızdaki ürüne ait olmalı.`
    );
  }

  const categoryId = positiveIntegerOrNull(
    product?.categoryId
  );

  const shipmentTemplate = String(
    product?.shipmentTemplate || ''
  ).trim();

  if (!categoryId || !shipmentTemplate) {
    throw new Error(
      'N11 örnek ürününde categoryId veya kargo şablonu eksik.'
    );
  }

  const catalogId = positiveIntegerOrNull(
    product?.catalogId
  );

  const barcodeText =
    product?.barcode === null ||
    product?.barcode === undefined
      ? ''
      : String(product.barcode).trim();

  const barcode = barcodeText || null;

  const pageImageUrl =
    await fetchN11ReferenceImage(parsed.url);

  return {
    row: {
      id: null,
      external_product_id:
        product?.n11ProductId === null ||
        product?.n11ProductId === undefined
          ? null
          : String(product.n11ProductId),
      external_product_main_id:
        product?.productMainId === null ||
        product?.productMainId === undefined
          ? null
          : String(product.productMainId),
      category_id: product?.categoryId ?? null,
      title: product?.title ?? null,
      description: product?.description ?? null,
      preparing_day: product?.preparingDay ?? null,
      shipment_template:
        product?.shipmentTemplate ?? null,
      product_status: product?.status ?? null,
    },
    rawProduct: product,
    catalogId,
    barcode,
    source: 'N11_REFERENCE_URL' as const,
    createMode:
      catalogId || barcode
        ? ('QUICK' as const)
        : ('FULL' as const),
    nearMatches: [],
    pageImageUrl,
    referenceUrl: parsed.url,
  };
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


function taskReasonList(matched: any) {
  const reasons: string[] = [];

  const add = (value: unknown) => {
    if (
      typeof value === 'string' &&
      value.trim() &&
      !reasons.includes(value.trim())
    ) {
      reasons.push(value.trim());
    }
  };

  if (Array.isArray(matched?.reasons)) {
    matched.reasons.forEach(add);
  }

  if (Array.isArray(matched?.sku?.reasons)) {
    matched.sku.reasons.forEach(add);
  }

  return reasons;
}

async function reconcilePendingN11Listing(listing: any) {
  const pool = getPool();

  const listingId = Number(listing?.id);
  const stockCode = String(
    listing?.external_stock_code || ''
  ).trim();

  const taskId = String(
    listing?.last_task_id || ''
  ).trim();

  if (!listingId || !stockCode) {
    return {
      state: 'ERROR' as const,
      created: false,
      pending: false,
      error:
        'Yerel N11 kaydında listing id veya stockCode eksik.',
      listing,
    };
  }

  // En güvenilir kontrol: ürün N11 product-query'de gerçekten var mı?
  const product =
    await queryN11ProductByStockCode(stockCode);

  if (product) {
    await finalizeCreatedListing(
      listingId,
      stockCode,
      taskId || 'NO_TASK',
      product
    );

    const finalResult = await pool.query(
      `
        SELECT *
        FROM public.online_listings
        WHERE id = $1
        LIMIT 1
      `,
      [listingId]
    );

    return {
      state: 'CREATED' as const,
      created: true,
      pending: false,
      error: null,
      listing: finalResult.rows[0],
      product,
    };
  }

  if (!taskId) {
    const errorMessage =
      'N11 ürün kodu oluşmamış ve create taskId bulunmuyor. Ürün N11’de oluşturulmamış.';

    await pool.query(
      `
        UPDATE public.online_listings
        SET
          quantity = 0,
          sync_status = 'ERROR',
          last_task_status = COALESCE(last_task_status, 'NO_TASK'),
          last_error = $2,
          updated_at = now()
        WHERE id = $1
      `,
      [listingId, errorMessage]
    );

    return {
      state: 'ERROR' as const,
      created: false,
      pending: false,
      error: errorMessage,
      listing: {
        ...listing,
        quantity: 0,
        sync_status: 'ERROR',
        last_error: errorMessage,
      },
    };
  }

  const task = await getN11TaskOnce(taskId);

  if (task.overallStatus === 'REJECT') {
    const errorMessage =
      'N11 create task reddedildi.';

    await pool.query(
      `
        UPDATE public.online_listings
        SET
          quantity = 0,
          sync_status = 'ERROR',
          last_task_status = 'REJECT',
          last_error = $2,
          updated_at = now()
        WHERE id = $1
      `,
      [listingId, errorMessage]
    );

    return {
      state: 'ERROR' as const,
      created: false,
      pending: false,
      error: errorMessage,
      listing: {
        ...listing,
        quantity: 0,
        sync_status: 'ERROR',
        last_task_status: 'REJECT',
        last_error: errorMessage,
      },
    };
  }

  if (task.overallStatus === 'PROCESSED') {
    const matched =
      task.content.find(
        (item: any) =>
          String(item?.itemCode || '').trim() === stockCode
      ) ||
      (task.content.length === 1
        ? task.content[0]
        : null);

    const skuStatus = String(
      matched?.status || ''
    )
      .trim()
      .toUpperCase();

    const reasons =
      taskReasonList(matched);

    if (skuStatus === 'SUCCESS') {
      // Task başarıyla işlendi ama product-query henüz ürünü göstermiyor.
      // Bu durumda panelde ASLA satışa açık saymayız.
      await pool.query(
        `
          UPDATE public.online_listings
          SET
            quantity = 0,
            sync_status = 'SYNCED_PENDING_QUERY',
            last_task_status = 'SUCCESS',
            last_error = NULL,
            updated_at = now()
          WHERE id = $1
        `,
        [listingId]
      );

      return {
        state: 'PENDING_QUERY' as const,
        created: false,
        pending: true,
        error: null,
        taskStatus: 'SUCCESS',
        reasons,
        listing: {
          ...listing,
          quantity: 0,
          sync_status:
            'SYNCED_PENDING_QUERY',
          last_task_status: 'SUCCESS',
          last_error: null,
        },
      };
    }

    const errorMessage =
      reasons.join(' | ') ||
      `N11 create task sonucu: ${
        skuStatus || 'FAIL'
      }`;

    await pool.query(
      `
        UPDATE public.online_listings
        SET
          quantity = 0,
          sync_status = 'ERROR',
          last_task_status = $2,
          last_error = $3,
          updated_at = now()
        WHERE id = $1
      `,
      [
        listingId,
        skuStatus || 'FAIL',
        errorMessage,
      ]
    );

    return {
      state: 'ERROR' as const,
      created: false,
      pending: false,
      error: errorMessage,
      taskStatus:
        skuStatus || 'FAIL',
      reasons,
      listing: {
        ...listing,
        quantity: 0,
        sync_status: 'ERROR',
        last_task_status:
          skuStatus || 'FAIL',
        last_error: errorMessage,
      },
    };
  }

  // Kuyrukta / henüz işleniyor.
  await pool.query(
    `
      UPDATE public.online_listings
      SET
        quantity = 0,
        sync_status = 'IN_QUEUE',
        last_task_status = $2,
        last_error = NULL,
        updated_at = now()
      WHERE id = $1
    `,
    [
      listingId,
      task.overallStatus ||
        'IN_QUEUE',
    ]
  );

  return {
    state: 'IN_QUEUE' as const,
    created: false,
    pending: true,
    error: null,
    taskStatus:
      task.overallStatus ||
      'IN_QUEUE',
    listing: {
      ...listing,
      quantity: 0,
      sync_status: 'IN_QUEUE',
      last_task_status:
        task.overallStatus ||
        'IN_QUEUE',
      last_error: null,
    },
  };
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

    const requestUrl =
      new URL(request.url);

    const refreshN11 =
      requestUrl.searchParams.get(
        'refreshN11'
      ) === '1';

    const stockCode = String(
      requestUrl.searchParams.get(
        'stockCode'
      ) || ''
    ).trim();

    if (refreshN11 && stockCode) {
      const existingResult =
        await getPool().query(
          `
            SELECT *
            FROM public.online_listings
            WHERE channel = 'N11'
              AND external_stock_code = $1
            LIMIT 1
          `,
          [stockCode]
        );

      const existing =
        existingResult.rows[0];

      if (!existing) {
        return json(
          {
            success: false,
            created: false,
            pending: false,
            error:
              'Bu IMEI / stockCode için yerel N11 kaydı bulunamadı.',
          },
          404
        );
      }

      const reconciliation =
        await reconcilePendingN11Listing(
          existing
        );

      if (
        reconciliation.state ===
        'ERROR'
      ) {
        return json(
          {
            success: false,
            created: false,
            pending: false,
            state:
              reconciliation.state,
            error:
              reconciliation.error,
            listing:
              reconciliation.listing,
          },
          422
        );
      }

      return json({
        success: true,
        created:
          reconciliation.created,
        pending:
          reconciliation.pending,
        state:
          reconciliation.state,
        taskStatus:
          'taskStatus' in
          reconciliation
            ? reconciliation.taskStatus
            : null,
        reasons:
          'reasons' in reconciliation
            ? reconciliation.reasons
            : [],
        listing:
          reconciliation.listing,
      });
    }

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
        SELECT
          id,
          external_stock_code,
          external_product_id,
          quantity,
          sync_status,
          last_task_id,
          last_task_status,
          last_error
        FROM public.online_listings
        WHERE channel = 'N11'
          AND external_stock_code = $1
        LIMIT 1
      `,
      [imei]
    );

    if (duplicate.rowCount) {
      const existing =
        duplicate.rows[0];

      if (!existing.external_product_id) {
        const reconciliation =
          await reconcilePendingN11Listing(
            existing
          );

        if (
          reconciliation.state ===
          'CREATED'
        ) {
          return json(
            {
              success: true,
              n11Requested: true,
              created: true,
              pending: false,
              recoveredExisting:
                true,
              message:
                `Cihaz N11’de mevcut. N11 ürün kodu panele işlendi. IMEI/Stok Kodu: ${imei}`,
              listing:
                reconciliation.listing,
            },
            200
          );
        }

        if (
          reconciliation.state ===
          'ERROR'
        ) {
          return json(
            {
              success: false,
              n11Requested: true,
              created: false,
              pending: false,
              recoveredExisting:
                false,
              error:
                `Önceki N11 create işlemi başarısız: ${reconciliation.error}`,
              existingListing:
                reconciliation.listing,
            },
            422
          );
        }

        return json(
          {
            success: true,
            n11Requested: true,
            created: false,
            pending: true,
            recoveredExisting:
              true,
            state:
              reconciliation.state,
            message:
              'N11 ürün oluşturma işlemi hâlâ işleniyor. Ürün kodu oluşana kadar satışa açık sayılmayacak.',
            existingListing:
              reconciliation.listing,
          },
          202
        );
      }

      return json(
        {
          success: false,
          error:
            'Bu IMEI için N11 ürünü zaten mevcut.',
          existingListing: existing,
        },
        409
      );
    }

    const channel = await getN11StoreDefaults();

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

    const preparingDay =
      positiveIntegerOrNull(
        channel?.default_preparing_day
      ) ||
      positiveIntegerOrNull(
        channel?.fallback_preparing_day
      );

    const shipmentTemplate = String(
      channel?.default_shipment_template ||
        channel?.fallback_shipment_template ||
        ''
    ).trim();

    if (!preparingDay || !shipmentTemplate) {
      return json(
        {
          success: false,
          error:
            'N11 hazırlık süresi veya kargo şablonu bulunamadı. Mevcut N11 ürünlerinden mağaza varsayılanı okunamadı.',
        },
        409
      );
    }

    // YENİLENMİŞ ürün standardını kullanıcıya iş çıkarmadan
    // backend otomatik üretir.
    const normalizedGrade =
      renewedGradeLabel(grade);

    const normalizedWarranty =
      renewedWarrantyLabel(warranty);

    const normalizedMemory =
      renewedMemoryLabel(memory);

    // YENİLENMİŞ ÜRÜNLER İÇİN GERÇEK N11 LEAF CATEGORY
    // hard-code 1000476 kullanmıyoruz.
    const renewedCategory =
      await getN11RenewedPhoneCategoryId(pool);

    const renewedCategoryId =
      renewedCategory.categoryId;

    // 1) ÖNCE POSTGRESQL KATALOG HAFIZASI
    // Daha önce doğru yenilenmiş catalogId kullanıldıysa N11'e arama
    // isteği atmadan anında aynı katalog kullanılır.
    let catalogSource:
      | 'LOCAL_MEMORY'
      | 'N11_SEARCH_CATALOG' =
      'LOCAL_MEMORY';

    let catalogProduct =
      await findRenewedCatalogFromLocalMemory({
        pool,
        brand,
        model,
        memory: normalizedMemory,
        color,
        grade: normalizedGrade,
        warranty: normalizedWarranty,
      });

    const catalogSearchTitle = [
      'Yenilenmiş',
      brand,
      model,
      memory,
      color,
    ]
      .filter(Boolean)
      .join(' ');

    let catalogProducts: N11CatalogProduct[] =
      catalogProduct ? [catalogProduct] : [];

    // 2) HAFIZADA YOKSA N11'E PARALEL / TEK SAYFALIK
    // HEDEFLİ ARAMALAR ATILIR.
    //
    // N11 SearchCatalog kelime sırasına duyarlı davranabildiği için
    // gerçek N11 başlık sırasını da birebir deniyoruz:
    // "Yenilenmiş Apple iPhone 11 64 GB A Kalite
    //  (12 Ay Garantili) Siyah"
    //
    // Tüm çağrılar PARALEL gider; uzun sayfa taraması yok.
    let searchedTitles: string[] = [];

    if (!catalogProduct) {
      catalogSource =
        'N11_SEARCH_CATALOG';

      const exactN11Title = [
        'Yenilenmiş',
        brand,
        model,
        normalizedMemory,
        normalizedGrade,
        `(${normalizedWarranty})`,
        color,
      ]
        .filter(Boolean)
        .join(' ');

      const exactNoParentheses = [
        'Yenilenmiş',
        brand,
        model,
        normalizedMemory,
        normalizedGrade,
        normalizedWarranty,
        color,
      ]
        .filter(Boolean)
        .join(' ');

      const renewedModelTitle = [
        'Yenilenmiş',
        brand,
        model,
        normalizedMemory,
      ]
        .filter(Boolean)
        .join(' ');

      const renewedColorTitle = [
        'Yenilenmiş',
        brand,
        model,
        normalizedMemory,
        color,
      ]
        .filter(Boolean)
        .join(' ');

      searchedTitles = Array.from(
        new Set([
          exactN11Title,
          exactNoParentheses,
          renewedModelTitle,
          renewedColorTitle,
        ])
      );

      const searchJobs = [
        ...searchedTitles.map((title) =>
          searchN11Catalog({
            brand,
            title,
            categoryId:
              renewedCategoryId,
            maxPages: 1,
          })
        ),

        // Bazı kataloglarda brandName filtresi beklenmedik şekilde
        // sonucu daraltabiliyor. Tam başlığı bir kez de brand filtresiz
        // arıyoruz. Bu da diğerleriyle paralel çalışır.
        searchN11Catalog({
          brand: '',
          title: exactN11Title,
          categoryId:
            renewedCategoryId,
          maxPages: 1,
        }),
      ];

      const searchResults =
        await Promise.allSettled(
          searchJobs
        );

      const merged: N11CatalogProduct[] =
        [];

      for (const result of searchResults) {
        if (result.status === 'fulfilled') {
          merged.push(...result.value);
        }
      }

      const unique = new Map<
        string,
        N11CatalogProduct
      >();

      for (const item of merged) {
        const key = String(
          item.catalogId ||
            `${item.productTitle}|${item.usc}`
        ).trim();

        if (key && !unique.has(key)) {
          unique.set(key, item);
        }
      }

      catalogProducts = Array.from(
        unique.values()
      );

      catalogProduct =
        chooseCatalogProduct({
          products: catalogProducts,
          brand,
          model,
          memory: normalizedMemory,
          color,
          grade: normalizedGrade,
          warranty: normalizedWarranty,
        });
    }

    if (!catalogProduct) {
      const renewedSamples =
        catalogProducts.filter((item) =>
          isRenewedCatalogTitle(
            String(item.productTitle || '')
          )
        );

      const sampleTitles = (
        renewedSamples.length > 0
          ? renewedSamples
          : catalogProducts
      )
        .slice(0, 12)
        .map((item) => item.productTitle)
        .filter(Boolean);

      return json(
        {
          success: false,
          catalogFound: catalogProducts.length > 0,
          catalogResultCount:
            catalogProducts.length,
          catalogSamples: sampleTitles,
          error:
            catalogProducts.length > 0
              ? `YENİLENMİŞ ${brand} ${model} ${memory} ${color} ${normalizedGrade} ${normalizedWarranty} için güvenli katalog eşleşmesi bulunamadı. Sıfır ürün açılmadı.`
              : `YENİLENMİŞ ${brand} ${model} ${memory} ${color} için N11 katalog kaydı bulunamadı. Sıfır ürün açılmadı.`,
          catalogSource,
          renewedCategoryId,
          renewedCategoryProductCount:
            renewedCategory.productCount,
          searchedTitles:
            typeof searchedTitles !== 'undefined'
              ? searchedTitles
              : [],
        },
        409
      );
    }

    // SON GÜVENLİK KAPISI:
    // SearchCatalog yanlış sonuç döndürse bile sıfır ürün açılmasına izin verme.
    if (
      !isRenewedCatalogTitle(
        String(catalogProduct.productTitle || '')
      )
    ) {
      return json(
        {
          success: false,
          error:
            'N11 katalog eşleşmesi yenilenmiş ürün değil. Güvenlik nedeniyle ürün açılmadı.',
          selectedCatalogTitle:
            catalogProduct.productTitle,
        },
        409
      );
    }

    const categoryId =
      positiveIntegerOrNull(
        catalogProduct.categoryId
      );

    const catalogId =
      positiveIntegerOrNull(
        catalogProduct.catalogId
      );

    if (
      categoryId &&
      categoryId !== renewedCategoryId
    ) {
      return json(
        {
          success: false,
          error:
            `N11 katalog eşleşmesi beklenen yenilenmiş kategoriyle uyuşmuyor. Beklenen: ${renewedCategoryId}, dönen: ${categoryId}. Ürün açılmadı.`,
          renewedCategoryId,
          selectedCategoryId:
            categoryId,
          selectedCatalogTitle:
            catalogProduct.productTitle,
        },
        409
      );
    }

    if (!categoryId || !catalogId) {
      return json(
        {
          success: false,
          error:
            'N11 SearchCatalog sonucu categoryId veya catalogId içermiyor.',
        },
        409
      );
    }

    const productMainId =
      generatedProductMainId({
        brand,
        model,
        memory,
      });

    const title = [
      'Yenilenmiş',
      brand,
      model,
      normalizedMemory,
      color,
      normalizedGrade,
      normalizedWarranty,
    ]
      .filter(Boolean)
      .join(' ');

    const description =
      `Yenilenmiş ${brand} ${model} ${normalizedMemory} ${color} ${normalizedGrade} ${normalizedWarranty}`;

    // Önce yerel kayıt açılır.
    // N11 create başarısızsa ERROR nedeni burada saklanır.
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
          0,
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
        description,
        brand,
        model,
        memory,
        color,
        normalizedGrade,
        normalizedWarranty,
        salePrice,
        listPrice,
        preparingDay,
        shipmentTemplate,
        vatRate,
        JSON.stringify({
          draftSource:
            'PANEL_N11_RENEWED_SEARCH_CATALOG_CREATE',
          createdBy: auth.user.username,
          imei,
          catalogSearchTitle,
          selectedCatalogId: catalogId,
          selectedCatalogCategoryId:
            categoryId,
          selectedCatalogTitle:
            catalogProduct.productTitle,
          selectedCatalogUsc:
            catalogProduct.usc,
          brand,
          model,
          memory,
          color,
          grade:
            normalizedGrade,
          warranty:
            normalizedWarranty,
          catalogSource,
          productCondition:
            'YENILENMIS',
          renewedCategoryId,
          renewedCategoryProductCount:
            renewedCategory.productCount,
          salePrice,
          listPrice,
        }),
      ]
    );

    const listing = insertResult.rows[0];

    // SearchCatalog catalogId bulduğunda N11'in HIZLI ÜRÜN YÜKLEME
    // akışını kullanıyoruz. images ve attributes boş gönderilebilir.
    const createSku: Record<string, unknown> = {
      description,
      categoryId,
      productMainId,
      preparingDay,
      shipmentTemplate,
      maxPurchaseQuantity: 1,
      stockCode: imei,
      catalogId,
      barcode: null,
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
          pending: true,
          taskId: createResult.taskId,
          taskStatus: 'IN_QUEUE',
          message:
            `N11 işlemi devam ediyor. Task #${createResult.taskId}. N11 ürün kodu oluşana kadar ürün satışa açık sayılmayacak.`,
          listing: {
            ...listing,
            quantity: 0,
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
          quantity = 0,
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
        created: false,
        pending: true,
        taskId: createResult.taskId,
        taskStatus: 'SUCCESS',
        message:
          `N11 task SUCCESS ancak ürün kodu henüz product-query’de görünmüyor. IMEI ${imei}. Ürün kodu doğrulanana kadar satışa açık sayılmayacak.`,
        listing: {
          ...listing,
          quantity: 0,
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

