// app/api/online/n11/catalog-test/route.ts
// CNETMOBIL ONLINE - N11 SEARCH CATALOG TEST
//
// AMAÇ:
// - N11'in satıcı ürünleri (59 ürün) içinde değil, N11 KATALOGUNDA arama yapmak.
// - Kategori ağacından telefon kategorilerini bulmak.
// - SOAP CatalogService.searchCatalog ile catalogId/categoryId aramak.
// - N11'de hiçbir veri DEĞİŞTİRMEZ.
// - SADECE SUPER ADMIN.
//
// Test:
// /api/online/n11/catalog-test?brand=Apple&title=iPhone%2011%2064%20GB
//
// İstersen kategori ID'yi elle de verebilirsin:
// /api/online/n11/catalog-test?brand=Apple&title=iPhone%2011%2064%20GB&categoryId=123456

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11CatalogTestPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const N11_CATEGORIES_URL = 'https://api.n11.com/cdn/categories';

const N11_CATALOG_SOAP_ENDPOINTS = [
  'https://api.n11.com/ws/CatalogService',
  'https://api.n11.com/ws/CatalogService.wsdl',
];

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

type CategoryNode = {
  id: number;
  name: string;
  path: string[];
  leaf: boolean;
};

type CatalogProduct = {
  catalogId: string | null;
  categoryId: string | null;
  categoryName: string | null;
  productTitle: string | null;
  usc: string | null;
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

  if (!global.cnetN11CatalogTestPool) {
    global.cnetN11CatalogTestPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11CatalogTestPool;
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

function normalize(value: unknown) {
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

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value: string | null) {
  if (!value) return null;

  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function tagValue(xml: string, tag: string) {
  const pattern = new RegExp(
    `<(?:[A-Za-z0-9_]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${tag}>`,
    'i'
  );

  const match = xml.match(pattern);

  if (!match?.[1]) return null;

  return decodeXml(
    match[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<[^>]+>/g, '')
  );
}

function flattenCategories(value: unknown) {
  const output: CategoryNode[] = [];
  const visited = new Set<string>();

  const walk = (
    node: unknown,
    parentPath: string[] = []
  ) => {
    if (Array.isArray(node)) {
      node.forEach((item) => walk(item, parentPath));
      return;
    }

    if (!node || typeof node !== 'object') return;

    const row = node as Record<string, unknown>;

    const idRaw =
      row.id ??
      row.categoryId ??
      row.category_id ??
      null;

    const nameRaw =
      row.name ??
      row.categoryName ??
      row.title ??
      null;

    const id = Number(idRaw);
    const name =
      nameRaw === null || nameRaw === undefined
        ? ''
        : String(nameRaw).trim();

    const possibleChildren: unknown[] = [];

    const childKeys = [
      'subCategories',
      'children',
      'categories',
      'subcategories',
      'categoryList',
    ];

    for (const key of childKeys) {
      const childValue = row[key];

      if (Array.isArray(childValue)) {
        possibleChildren.push(...childValue);
      }
    }

    const nextPath = name
      ? [...parentPath, name]
      : parentPath;

    if (
      Number.isInteger(id) &&
      id > 0 &&
      name
    ) {
      const key = `${id}:${name}`;

      if (!visited.has(key)) {
        visited.add(key);

        output.push({
          id,
          name,
          path: nextPath,
          leaf: possibleChildren.length === 0,
        });
      }
    }

    for (const child of possibleChildren) {
      walk(child, nextPath);
    }

    // Root JSON yapısı farklı gelirse genel nested object alanlarını da dolaş.
    for (const [key, childValue] of Object.entries(row)) {
      if (childKeys.includes(key)) continue;

      if (
        childValue &&
        typeof childValue === 'object'
      ) {
        walk(childValue, nextPath);
      }
    }
  };

  walk(value);

  return output;
}

function rankPhoneCategory(category: CategoryNode) {
  const name = normalize(category.name);
  const path = normalize(category.path.join(' '));

  let score = 0;

  if (category.leaf) score += 20;

  if (name === 'ceptelefonu') score += 500;
  if (name === 'akillitelefon') score += 480;
  if (name === 'smartphone') score += 470;

  if (name.includes('ceptelefon')) score += 350;
  if (name.includes('akillitelefon')) score += 340;
  if (name.includes('telefon')) score += 180;

  if (path.includes('ceptelefon')) score += 140;
  if (path.includes('telefon')) score += 80;

  if (name.includes('aksesuar')) score -= 250;
  if (name.includes('kilif')) score -= 250;
  if (name.includes('sarj')) score -= 250;
  if (name.includes('ekrankoruyucu')) score -= 250;
  if (name.includes('yedekparca')) score -= 250;

  return score;
}

async function fetchCategories(appKey: string) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(N11_CATEGORIES_URL, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        appkey: appKey,
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
      throw new Error(
        `N11 kategori servisi HTTP ${response.status} döndürdü.`
      );
    }

    if (!payload) {
      throw new Error(
        'N11 kategori servisi geçersiz JSON döndürdü.'
      );
    }

    return payload;
  } finally {
    clearTimeout(timeoutId);
  }
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
        <appKey>${escapeXml(params.appKey)}</appKey>
        <appSecret>${escapeXml(params.appSecret)}</appSecret>
      </auth>
      <productTitles>${escapeXml(params.title)}</productTitles>
      <categoryId>${params.categoryId}</categoryId>
      <uscs></uscs>
      <brandName>${escapeXml(params.brand)}</brandName>
      <catalogIds></catalogIds>
      <currentPage>${params.currentPage}</currentPage>
    </sch:SearchCatalogRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function parseCatalogProducts(xml: string) {
  const products: CatalogProduct[] = [];

  const productRegex =
    /<(?:[A-Za-z0-9_]+:)?product\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?product>/gi;

  let match: RegExpExecArray | null;

  while ((match = productRegex.exec(xml)) !== null) {
    const block = match[1] || '';

    const catalogId = tagValue(block, 'catalogId');
    const categoryId = tagValue(block, 'categoryId');
    const categoryName = tagValue(block, 'categoryName');
    const productTitle = tagValue(block, 'productTitle');
    const usc = tagValue(block, 'usc');

    if (
      catalogId ||
      categoryId ||
      productTitle
    ) {
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

function parseSoapStatus(xml: string) {
  const status = tagValue(xml, 'status');
  const errorCode =
    tagValue(xml, 'errorCode') ||
    tagValue(xml, 'code');
  const errorMessage =
    tagValue(xml, 'errorMessage') ||
    tagValue(xml, 'message') ||
    tagValue(xml, 'faultstring');

  return {
    status,
    errorCode,
    errorMessage,
  };
}

async function postSearchCatalog(params: {
  xml: string;
}) {
  const attempts: Array<{
    endpoint: string;
    httpStatus: number | null;
    ok: boolean;
    soapStatus: string | null;
    errorMessage: string | null;
    bodyPreview?: string;
  }> = [];

  for (const endpoint of N11_CATALOG_SOAP_ENDPOINTS) {
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
        body: params.xml,
        signal: controller.signal,
      });

      const rawText = await response.text();
      const soap = parseSoapStatus(rawText);
      const products = parseCatalogProducts(rawText);

      attempts.push({
        endpoint,
        httpStatus: response.status,
        ok: response.ok,
        soapStatus: soap.status,
        errorMessage: soap.errorMessage,
        bodyPreview:
          response.ok || products.length > 0
            ? undefined
            : rawText.slice(0, 500),
      });

      if (
        response.ok &&
        String(soap.status || '').toLowerCase() ===
          'success'
      ) {
        return {
          success: true,
          endpoint,
          httpStatus: response.status,
          soap,
          products,
          rawText,
          attempts,
        };
      }

      // Bazı SOAP servisleri 200 + ürün döndürüp status alanını farklı yapıda verebilir.
      if (response.ok && products.length > 0) {
        return {
          success: true,
          endpoint,
          httpStatus: response.status,
          soap,
          products,
          rawText,
          attempts,
        };
      }
    } catch (error) {
      attempts.push({
        endpoint,
        httpStatus: null,
        ok: false,
        soapStatus: null,
        errorMessage:
          error instanceof Error
            ? error.message
            : 'SOAP bağlantı hatası',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    success: false,
    endpoint: null,
    httpStatus: null,
    soap: null,
    products: [] as CatalogProduct[],
    rawText: '',
    attempts,
  };
}

// ============================================================
// GET /api/online/n11/catalog-test
// READ-ONLY.
// ============================================================
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);

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

    const brand = String(
      url.searchParams.get('brand') || 'Apple'
    ).trim();

    const title = String(
      url.searchParams.get('title') ||
        'iPhone 11 64 GB'
    ).trim();

    const explicitCategoryIdRaw = String(
      url.searchParams.get('categoryId') || ''
    ).trim();

    if (title.length < 10) {
      return json(
        {
          success: false,
          error:
            'N11 SearchCatalog ürün adı aramasında title en az 10 karakter olmalı.',
        },
        400
      );
    }

    let categoryCandidates: CategoryNode[] = [];

    if (explicitCategoryIdRaw) {
      const explicitId = Number(
        explicitCategoryIdRaw
      );

      if (
        !Number.isInteger(explicitId) ||
        explicitId < 1
      ) {
        return json(
          {
            success: false,
            error: 'categoryId geçersiz.',
          },
          400
        );
      }

      categoryCandidates = [
        {
          id: explicitId,
          name: 'MANUAL_CATEGORY',
          path: ['MANUAL_CATEGORY'],
          leaf: true,
        },
      ];
    } else {
      const categoryPayload =
        await fetchCategories(credentials.appKey);

      const allCategories =
        flattenCategories(categoryPayload);

      categoryCandidates = allCategories
        .map((category) => ({
          category,
          score: rankPhoneCategory(category),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 12)
        .map((item) => item.category);

      if (categoryCandidates.length === 0) {
        return json(
          {
            success: false,
            stage: 'CATEGORY_DISCOVERY',
            error:
              'N11 kategori ağacında telefon kategorisi adayı bulunamadı.',
            categoryCount: allCategories.length,
            sampleCategories: allCategories
              .slice(0, 20)
              .map((item) => ({
                id: item.id,
                name: item.name,
                path: item.path,
                leaf: item.leaf,
              })),
          },
          404
        );
      }
    }

    const searchAttempts: Array<Record<string, unknown>> =
      [];

    for (const category of categoryCandidates) {
      const xml = buildSearchCatalogXml({
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
        title,
        brand,
        categoryId: category.id,
        currentPage: 0,
      });

      const result =
        await postSearchCatalog({ xml });

      searchAttempts.push({
        categoryId: category.id,
        categoryName: category.name,
        categoryPath: category.path,
        success: result.success,
        endpoint: result.endpoint,
        httpStatus: result.httpStatus,
        soapStatus: result.soap?.status || null,
        soapError:
          result.soap?.errorMessage || null,
        productCount: result.products.length,
        transportAttempts: result.attempts,
      });

      if (
        result.success &&
        result.products.length > 0
      ) {
        return json({
          success: true,
          mode: 'SEARCH_CATALOG',
          readOnly: true,
          searched: {
            brand,
            title,
            categoryId: category.id,
            categoryName: category.name,
            categoryPath: category.path,
          },
          catalogFound: true,
          catalogProductCount:
            result.products.length,
          products: result.products.slice(0, 50),
          message:
            'N11 SearchCatalog gerçek katalog sonucu bulundu.',
          checkedBy: user.username,
        });
      }
    }

    return json({
      success: true,
      mode: 'SEARCH_CATALOG',
      readOnly: true,
      searched: {
        brand,
        title,
      },
      catalogFound: false,
      categoryCandidates:
        categoryCandidates.map((item) => ({
          id: item.id,
          name: item.name,
          path: item.path,
          leaf: item.leaf,
        })),
      searchAttempts,
      message:
        'SearchCatalog bağlantısı çalıştı ancak bu arama için katalog ürünü bulunamadı veya SOAP endpoint sonucu ürün döndürmedi.',
      checkedBy: user.username,
    });
  } catch (error) {
    console.error('N11 CATALOG TEST ERROR:', error);

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 katalog testi tamamlanamadı.',
      },
      500
    );
  }
}
