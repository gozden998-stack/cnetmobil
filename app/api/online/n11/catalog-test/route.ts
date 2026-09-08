// app/api/online/n11/catalog-search-test/route.ts
// CNETMOBIL ONLINE - N11 KATALOG ARAMA TESTI (READ ONLY)
//
// AMAÇ:
// N11 Satıcı Ofisi'ndeki "Katalogdan Ürün Ekle" mantığına yaklaşmak:
// - Önce bizim N11 mağazamızdaki yenilenmiş ürünlerden gerçek categoryId'yi bul.
// - Sonra SearchCatalog'a KISA arama metni gönder:
//     "yenilenmiş iphone 11"
// - brand / hafıza / renk / grade / garanti ile gereksiz daraltma YOK.
// - İlk 3 sayfayı çeker, sonuçları döndürür.
// - N11'de hiçbir ürün oluşturmaz/değiştirmez.
//
// Test:
// /api/online/n11/catalog-search-test?q=yenilenmis%20iphone%2011

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11CatalogSearchTestPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';

const N11_PRODUCT_QUERY_URL =
  'https://api.n11.com/ms/product-query';

const N11_CATALOG_SOAP_ENDPOINTS = [
  'https://api.n11.com/ws/CatalogService',
  'https://api.n11.com/ws/CatalogService.ws',
];

type SessionPayload = {
  userId: number | null;
  role: 'admin' | 'personel';
  branch: string;
  exp: number;
  legacy?: boolean;
};

type N11CatalogProduct = {
  catalogId: string;
  categoryId: string;
  categoryName: string;
  productTitle: string;
  usc: string;
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

  if (!global.cnetN11CatalogSearchTestPool) {
    global.cnetN11CatalogSearchTestPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11CatalogSearchTestPool;
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

async function requireSuperAdmin(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;

  if (!token) {
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

  const session = verifySession(token);

  if (!session?.userId) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error: 'Geçersiz oturum.',
        },
        401
      ),
    };
  }

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
    return {
      user: null,
      response: json(
        {
          success: false,
          error: 'Aktif kullanıcı bulunamadı.',
        },
        401
      ),
    };
  }

  if (row.is_super_admin !== true) {
    return {
      user: null,
      response: json(
        {
          success: false,
          error:
            'Bu test yalnızca Super Admin tarafından kullanılabilir.',
        },
        403
      ),
    };
  }

  return {
    user: {
      id: Number(row.id),
      username: String(row.username),
    },
    response: null,
  };
}

function getN11Credentials() {
  const appKey = String(process.env.N11_APP_KEY || '').trim();
  const appSecret = String(
    process.env.N11_APP_SECRET || ''
  ).trim();

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
    .replace(/ç/g, 'c');
}

function isRenewedTitle(value: unknown) {
  const text = normalize(value);

  return (
    text.includes('yenilenmis') ||
    text.includes('renewed')
  );
}

function xmlEscape(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function xmlTagValue(xml: string, tag: string) {
  const regex = new RegExp(
    `<(?:[A-Za-z0-9_]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${tag}>`,
    'i'
  );

  const match = xml.match(regex);

  if (!match) return '';

  return String(match[1] || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function parseSearchCatalogProducts(xml: string) {
  const products: N11CatalogProduct[] = [];

  const productRegex =
    /<(?:[A-Za-z0-9_]+:)?product\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?product>/gi;

  let match: RegExpExecArray | null;

  while ((match = productRegex.exec(xml)) !== null) {
    const block = match[1] || '';

    const item: N11CatalogProduct = {
      catalogId: xmlTagValue(block, 'catalogId'),
      categoryId: xmlTagValue(block, 'categoryId'),
      categoryName: xmlTagValue(block, 'categoryName'),
      productTitle: xmlTagValue(block, 'productTitle'),
      usc: xmlTagValue(block, 'usc'),
    };

    if (
      item.catalogId ||
      item.categoryId ||
      item.productTitle
    ) {
      products.push(item);
    }
  }

  return products;
}

function buildSearchCatalogXml(params: {
  appKey: string;
  appSecret: string;
  title: string;
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
      <brandName></brandName>
      <catalogIds></catalogIds>
      <currentPage>${params.currentPage}</currentPage>
    </sch:SearchCatalogRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
}

async function fetchSellerProducts(params: {
  appKey: string;
  appSecret: string;
}) {
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
        appkey: params.appKey,
        appsecret: params.appSecret,
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
      throw new Error(
        payload?.message ||
          payload?.error ||
          rawText.slice(0, 500) ||
          `N11 product-query HTTP ${response.status}`
      );
    }

    const content = Array.isArray(payload?.content)
      ? payload.content
      : [];

    products.push(...content);

    const totalPages = Number(payload?.totalPages);

    if (
      content.length === 0 ||
      (Number.isInteger(totalPages) &&
        page + 1 >= totalPages) ||
      content.length < pageSize
    ) {
      break;
    }
  }

  return products;
}

function getRenewedCategoryInfo(products: any[]) {
  const renewed = products.filter((product) =>
    isRenewedTitle(
      `${product?.title || ''} ${product?.description || ''}`
    )
  );

  const counts = new Map<
    number,
    {
      categoryId: number;
      count: number;
      samples: string[];
    }
  >();

  for (const product of renewed) {
    const categoryId = Number(product?.categoryId);

    if (!Number.isInteger(categoryId) || categoryId < 1) {
      continue;
    }

    const existing =
      counts.get(categoryId) || {
        categoryId,
        count: 0,
        samples: [],
      };

    existing.count += 1;

    if (
      existing.samples.length < 5 &&
      product?.title
    ) {
      existing.samples.push(
        String(product.title)
      );
    }

    counts.set(categoryId, existing);
  }

  const categories = Array.from(counts.values()).sort(
    (a, b) => b.count - a.count
  );

  return {
    renewedSellerProductCount: renewed.length,
    categories,
  };
}

async function searchCatalog(params: {
  appKey: string;
  appSecret: string;
  q: string;
  categoryId: number;
  maxPages: number;
}) {
  let lastError = '';

  for (const endpoint of N11_CATALOG_SOAP_ENDPOINTS) {
    const collected: N11CatalogProduct[] = [];
    const seen = new Set<string>();

    let endpointFailed = false;

    for (
      let currentPage = 0;
      currentPage < params.maxPages;
      currentPage += 1
    ) {
      const xml = buildSearchCatalogXml({
        appKey: params.appKey,
        appSecret: params.appSecret,
        title: params.q,
        categoryId: params.categoryId,
        currentPage,
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        15_000
      );

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          cache: 'no-store',
          headers: {
            'Content-Type':
              'text/xml; charset=utf-8',
            Accept:
              'text/xml, application/xml',
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

        let added = 0;

        for (const product of pageProducts) {
          const key = String(
            product.catalogId ||
              `${product.productTitle}|${product.usc}`
          ).trim();

          if (!key || seen.has(key)) {
            continue;
          }

          seen.add(key);
          collected.push(product);
          added += 1;
        }

        if (added === 0) {
          break;
        }

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
      ? `N11 SearchCatalog başarısız: ${lastError}`
      : 'N11 SearchCatalog başarısız.'
  );
}

export async function GET(request: NextRequest) {
  try {
    const auth =
      await requireSuperAdmin(request);

    if (auth.response) {
      return auth.response;
    }

    const credentials =
      getN11Credentials();

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

    const q = String(
      url.searchParams.get('q') ||
        'yenilenmis iphone 11'
    ).trim();

    if (q.length < 10) {
      return json(
        {
          success: false,
          error:
            'N11 SearchCatalog ürün adı araması en az 10 karakter olmalıdır.',
        },
        400
      );
    }

    const sellerProducts =
      await fetchSellerProducts({
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
      });

    const categoryInfo =
      getRenewedCategoryInfo(
        sellerProducts
      );

    if (
      categoryInfo.categories.length === 0
    ) {
      return json(
        {
          success: false,
          error:
            'Kendi N11 mağazanızdaki yenilenmiş ürünlerden categoryId çıkarılamadı.',
          sellerProductCount:
            sellerProducts.length,
          renewedSellerProductCount:
            categoryInfo.renewedSellerProductCount,
        },
        409
      );
    }

    // Tek bir kategoriye körü körüne güvenmiyoruz.
    // Bizim yenilenmiş ürünlerde kullanılan ilk 5 categoryId'yi
    // paralel arıyoruz.
    const categories =
      categoryInfo.categories.slice(0, 5);

    const jobs = categories.map(
      async (category) => {
        const products =
          await searchCatalog({
            appKey: credentials.appKey,
            appSecret:
              credentials.appSecret,
            q,
            categoryId:
              category.categoryId,
            maxPages: 3,
          });

        return {
          categoryId:
            category.categoryId,
          sellerProductCount:
            category.count,
          sellerSamples:
            category.samples,
          products,
        };
      }
    );

    const settled =
      await Promise.allSettled(jobs);

    const searches = settled.map(
      (result, index) => {
        const category =
          categories[index];

        if (
          result.status ===
          'fulfilled'
        ) {
          return {
            success: true,
            ...result.value,
          };
        }

        return {
          success: false,
          categoryId:
            category.categoryId,
          sellerProductCount:
            category.count,
          sellerSamples:
            category.samples,
          products: [],
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        };
      }
    );

    const unique = new Map<
      string,
      N11CatalogProduct
    >();

    for (const search of searches) {
      for (const product of search.products) {
        const key = String(
          product.catalogId ||
            `${product.productTitle}|${product.usc}`
        ).trim();

        if (
          key &&
          !unique.has(key)
        ) {
          unique.set(key, product);
        }
      }
    }

    const products = Array.from(
      unique.values()
    );

    return json({
      success: true,
      readOnly: true,
      mode:
        'SHORT_TITLE_RENEWED_CATALOG_SEARCH',
      q,
      sellerProductCount:
        sellerProducts.length,
      renewedSellerProductCount:
        categoryInfo.renewedSellerProductCount,
      renewedCategories:
        categoryInfo.categories,
      searchedCategoryCount:
        categories.length,
      resultCount:
        products.length,
      products,
      searches,
      message:
        products.length > 0
          ? `${products.length} katalog ürünü bulundu.`
          : 'Bu kısa arama ile katalog ürünü bulunamadı.',
      checkedAt:
        new Date().toISOString(),
      checkedBy:
        auth.user?.username || null,
    });
  } catch (error) {
    console.error(
      'N11 CATALOG SEARCH TEST ERROR:',
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 katalog araması tamamlanamadı.',
      },
      500
    );
  }
}
