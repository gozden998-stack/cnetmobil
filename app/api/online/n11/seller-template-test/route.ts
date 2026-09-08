// app/api/online/n11/seller-template-test/route.ts
// CNETMOBIL ONLINE - N11 SATICI YENILENMIS SABLON TESTI
//
// AMAÇ:
// - SearchCatalog DEGIL.
// - N11'de BIZIM MAGAZAMIZDA bulunan ürünleri product-query ile çeker.
// - Yenilenmiş + marka/model/hafıza/renk/grade/garanti eşleşmesini bulur.
// - catalogId / barcode / productMainId / attributes / N11 ID bilgilerini gösterir.
// - N11'de hiçbir veri DEĞİŞTİRMEZ.
// - SADECE SUPER ADMIN.
//
// Test:
// /api/online/n11/seller-template-test?brand=Apple&model=iPhone%2011&memory=64GB&color=Siyah&grade=A&warranty=12AY

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import crypto from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetN11SellerTemplateTestPool: Pool | undefined;
}

const COOKIE_NAME = 'cnet_auth';
const N11_PRODUCT_QUERY_URL =
  'https://api.n11.com/ms/product-query';

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

  if (!global.cnetN11SellerTemplateTestPool) {
    global.cnetN11SellerTemplateTestPool = new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });
  }

  return global.cnetN11SellerTemplateTestPool;
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
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '');
}

function gradeToken(value: string) {
  const normalized = normalize(value);

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

function warrantyToken(value: string) {
  const normalized = normalize(value);

  const match = normalized.match(/^(\d{1,2})ay/);

  if (match) {
    return `${Number(match[1])}ay`;
  }

  return normalized;
}

function isRenewed(value: unknown) {
  const normalized = normalize(value);

  return (
    normalized.includes('yenilenmis') ||
    normalized.includes('renewed')
  );
}

function containsUnexpectedModelVariant(
  wantedModel: string,
  candidateTitle: string
) {
  const wanted = normalize(wantedModel);
  const candidate = normalize(candidateTitle);

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
    const wantedHasVariant = wanted.includes(variant);
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

function searchableProductText(product: any) {
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

  return normalize(
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

async function fetchAllSellerProducts(params: {
  appKey: string;
  appSecret: string;
}) {
  const products: any[] = [];
  const pageSize = 50;

  for (let page = 0; page < 20; page += 1) {
    const url = new URL(N11_PRODUCT_QUERY_URL);
    url.searchParams.set('page', String(page));
    url.searchParams.set('size', String(pageSize));

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
          rawText.slice(0, 500) ||
          `HTTP ${response.status}`;

        throw new Error(
          `N11 product-query başarısız: ${String(message)}`
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
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return products;
}

function candidateView(product: any, score: number) {
  return {
    score,
    n11ProductId:
      product?.n11ProductId ?? null,
    stockCode:
      product?.stockCode ?? null,
    title:
      product?.title ?? null,
    description:
      product?.description ?? null,
    categoryId:
      product?.categoryId ?? null,
    productMainId:
      product?.productMainId ?? null,
    catalogId:
      product?.catalogId ?? null,
    barcode:
      product?.barcode ?? null,
    quantity:
      product?.quantity ?? null,
    productStatus:
      product?.status ?? null,
    saleStatus:
      product?.saleStatus ?? null,
    preparingDay:
      product?.preparingDay ?? null,
    shipmentTemplate:
      product?.shipmentTemplate ?? null,
    salePrice:
      product?.salePrice ?? null,
    listPrice:
      product?.listPrice ?? null,
    currencyType:
      product?.currencyType ?? null,
    attributes: Array.isArray(product?.attributes)
      ? product.attributes
      : [],
  };
}

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
            'Bu test yalnızca Super Admin tarafından çalıştırılabilir.',
        },
        403
      );
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

    const brand = String(
      url.searchParams.get('brand') || 'Apple'
    ).trim();

    const model = String(
      url.searchParams.get('model') || 'iPhone 11'
    ).trim();

    const memory = String(
      url.searchParams.get('memory') || '64GB'
    ).trim();

    const color = String(
      url.searchParams.get('color') || 'Siyah'
    ).trim();

    const grade = String(
      url.searchParams.get('grade') || 'A'
    ).trim();

    const warranty = String(
      url.searchParams.get('warranty') || '12AY'
    ).trim();

    const products =
      await fetchAllSellerProducts({
        appKey: credentials.appKey,
        appSecret: credentials.appSecret,
      });

    const wantedBrand = normalize(brand);
    const wantedModel = normalize(model);
    const wantedMemory = normalize(memory);
    const wantedColor = normalize(color);
    const wantedGrade = gradeToken(grade);
    const wantedWarranty =
      warrantyToken(warranty);

    const renewedProducts =
      products.filter((product) =>
        isRenewed(
          `${product?.title || ''} ${product?.description || ''}`
        )
      );

    const candidates = renewedProducts
      .map((product) => {
        const title = String(
          product?.title || ''
        );

        const searchable =
          searchableProductText(product);

        if (
          wantedBrand &&
          !searchable.includes(wantedBrand)
        ) {
          return null;
        }

        if (
          wantedModel &&
          !searchable.includes(wantedModel)
        ) {
          return null;
        }

        if (
          containsUnexpectedModelVariant(
            model,
            title
          )
        ) {
          return null;
        }

        if (
          wantedMemory &&
          !searchable.includes(wantedMemory)
        ) {
          return null;
        }

        let score = 100;

        if (
          wantedColor &&
          searchable.includes(wantedColor)
        ) {
          score += 40;
        }

        if (
          wantedGrade &&
          searchable.includes(wantedGrade)
        ) {
          score += 30;
        }

        if (
          wantedWarranty &&
          searchable.includes(wantedWarranty)
        ) {
          score += 20;
        }

        if (product?.catalogId) {
          score += 15;
        }

        if (product?.barcode) {
          score += 10;
        }

        if (
          wantedColor &&
          !searchable.includes(wantedColor)
        ) {
          score -= 20;
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
          product: any;
          score: number;
        } => Boolean(item)
      )
      .sort(
        (a, b) => b.score - a.score
      );

    const exactCandidates =
      candidates.filter(({ product }) => {
        const searchable =
          searchableProductText(product);

        const colorOk =
          !wantedColor ||
          searchable.includes(wantedColor);

        const gradeOk =
          !wantedGrade ||
          searchable.includes(wantedGrade);

        const warrantyOk =
          !wantedWarranty ||
          searchable.includes(
            wantedWarranty
          );

        return (
          colorOk &&
          gradeOk &&
          warrantyOk
        );
      });

    const best =
      exactCandidates[0] ||
      candidates[0] ||
      null;

    return json({
      success: true,
      readOnly: true,
      mode: 'SELLER_PRODUCT_TEMPLATE_TEST',
      searched: {
        brand,
        model,
        memory,
        color,
        grade,
        warranty,
      },
      sellerProductCount:
        products.length,
      sellerRenewedProductCount:
        renewedProducts.length,
      exactMatchFound:
        exactCandidates.length > 0,
      exactMatchCount:
        exactCandidates.length,
      candidateCount:
        candidates.length,
      bestCandidate:
        best
          ? candidateView(
              best.product,
              best.score
            )
          : null,
      exactCandidates:
        exactCandidates
          .slice(0, 10)
          .map((item) =>
            candidateView(
              item.product,
              item.score
            )
          ),
      nearCandidates:
        candidates
          .slice(0, 15)
          .map((item) =>
            candidateView(
              item.product,
              item.score
            )
          ),
      renewedSampleTitles:
        renewedProducts
          .slice(0, 30)
          .map((product) => ({
            n11ProductId:
              product?.n11ProductId ??
              null,
            stockCode:
              product?.stockCode ??
              null,
            title:
              product?.title ?? null,
            catalogId:
              product?.catalogId ??
              null,
            barcode:
              product?.barcode ?? null,
          })),
      message:
        exactCandidates.length > 0
          ? 'Kendi N11 mağazanızda tam yenilenmiş şablon bulundu.'
          : candidates.length > 0
          ? 'Kendi N11 mağazanızda yakın yenilenmiş ürün bulundu; tam renk/grade/garanti eşleşmesi yok.'
          : 'Kendi N11 mağazanızda bu model/hafıza için yenilenmiş şablon bulunamadı.',
      checkedAt:
        new Date().toISOString(),
      checkedBy:
        user.username,
    });
  } catch (error) {
    console.error(
      'N11 SELLER TEMPLATE TEST ERROR:',
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'N11 satıcı ürün testi tamamlanamadı.',
      },
      500
    );
  }
}
