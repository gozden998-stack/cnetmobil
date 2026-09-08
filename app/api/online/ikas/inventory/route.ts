// app/api/online/ikas/inventory/route.ts
// CNETMOBIL - IKAS ADIM 3.1 / TUM STOK + YENILENMIS AYRIMI
// READ ONLY.
// Tum ikas urunlerini sayfa sayfa ceker.
// Varyant, SKU, barkod, fiyat ve stok lokasyonlarini okur.
// HICBIR urun / stok / siparis verisini DEGISTIRMEZ.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasInventoryPool: Pool | undefined;
}

const COOKIE_NAME = "cnet_auth";

const IKAS_TOKEN_URL =
  "https://api.myikas.com/api/admin/oauth/token";

const IKAS_GRAPHQL_URL =
  "https://api.myikas.com/api/v2/admin/graphql";

const PAGE_LIMIT = 100;
const MAX_PAGES = 200;

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function getPool() {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  if (!global.cnetIkasInventoryPool) {
    global.cnetIkasInventoryPool =
      new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis:
          30_000,
        connectionTimeoutMillis:
          10_000,
      });
  }

  return global
    .cnetIkasInventoryPool;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [
      encoded,
      signature,
    ] = token.split(".");

    if (
      !encoded ||
      !signature
    ) {
      return null;
    }

    const secret =
      process.env.SESSION_SECRET;

    if (!secret) {
      return null;
    }

    const expected =
      crypto
        .createHmac(
          "sha256",
          secret
        )
        .update(encoded)
        .digest(
          "base64url"
        );

    const a =
      Buffer.from(
        signature,
        "utf8"
      );

    const b =
      Buffer.from(
        expected,
        "utf8"
      );

    if (
      a.length !==
        b.length ||
      !crypto.timingSafeEqual(
        a,
        b
      )
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString(
          "utf8"
        )
      ) as SessionPayload;

    if (
      !payload?.userId ||
      !payload?.exp ||
      payload.exp <
        Math.floor(
          Date.now() /
            1000
        )
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

async function requireSuperAdmin(
  request: NextRequest
) {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return json(
      {
        success: false,
        error:
          "Oturum gerekli.",
      },
      401
    );
  }

  const session =
    verifySession(token);

  if (
    !session?.userId
  ) {
    return json(
      {
        success: false,
        error:
          "Geçersiz oturum.",
      },
      401
    );
  }

  const result =
    await getPool().query(
      `
        SELECT
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
      [
        session.userId,
      ]
    );

  const row =
    result.rows[0];

  if (
    !row ||
    row.active !==
      true ||
    row.is_super_admin !==
      true
  ) {
    return json(
      {
        success: false,
        error:
          "Bu ekran yalnızca Super Admin içindir.",
      },
      403
    );
  }

  return null;
}

async function getIkasAccessToken() {
  const clientId =
    String(
      process.env
        .IKAS_CLIENT_ID ||
        ""
    ).trim();

  const clientSecret =
    String(
      process.env
        .IKAS_CLIENT_SECRET ||
        ""
    ).trim();

  if (!clientId) {
    throw new Error(
      "IKAS_CLIENT_ID bulunamadı."
    );
  }

  if (!clientSecret) {
    throw new Error(
      "IKAS_CLIENT_SECRET bulunamadı."
    );
  }

  const form =
    new URLSearchParams();

  form.set(
    "grant_type",
    "client_credentials"
  );

  form.set(
    "client_id",
    clientId
  );

  form.set(
    "client_secret",
    clientSecret
  );

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      15_000
    );

  try {
    const response =
      await fetch(
        IKAS_TOKEN_URL,
        {
          method: "POST",
          cache:
            "no-store",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
            Accept:
              "application/json",
          },
          body:
            form.toString(),
          signal:
            controller.signal,
        }
      );

    const rawText =
      await response.text();

    let payload:
      any = null;

    try {
      payload =
        rawText
          ? JSON.parse(
              rawText
            )
          : null;
    } catch {
      payload = null;
    }

    if (
      !response.ok
    ) {
      throw new Error(
        payload
          ?.error_description ||
          payload?.message ||
          payload?.error ||
          `ikas token HTTP ${response.status}`
      );
    }

    const accessToken =
      String(
        payload
          ?.access_token ||
          ""
      ).trim();

    if (
      !accessToken
    ) {
      throw new Error(
        "ikas access_token alınamadı."
      );
    }

    return accessToken;
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

async function graphql(
  accessToken: string,
  query: string,
  variables:
    Record<
      string,
      unknown
    > = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      30_000
    );

  try {
    const response =
      await fetch(
        IKAS_GRAPHQL_URL,
        {
          method: "POST",
          cache:
            "no-store",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body:
            JSON.stringify(
              {
                query,
                variables,
              }
            ),
          signal:
            controller.signal,
        }
      );

    const rawText =
      await response.text();

    let payload:
      any = null;

    try {
      payload =
        rawText
          ? JSON.parse(
              rawText
            )
          : null;
    } catch {
      payload = null;
    }

    if (
      !response.ok
    ) {
      throw new Error(
        payload?.errors?.[0]
          ?.message ||
          payload?.message ||
          `ikas GraphQL HTTP ${response.status}`
      );
    }

    if (
      Array.isArray(
        payload?.errors
      ) &&
      payload.errors
        .length > 0
    ) {
      throw new Error(
        payload.errors
          .map(
            (
              item: any
            ) =>
              String(
                item
                  ?.message ||
                  "GraphQL hata"
              )
          )
          .join(
            " | "
          )
      );
    }

    return (
      payload?.data ??
      {}
    );
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

const ALL_PRODUCTS_QUERY = `
  query CnetIkasAllProducts(
    $pagination: PaginationInput
  ) {
    listProduct(
      pagination: $pagination
    ) {
      count
      hasNext
      limit
      page
      data {
        id
        name
        description
        updatedAt
        totalStock

        brand {
          id
          name
        }

        categories {
          id
          name
        }

        variants {
          id
          sku
          barcodeList

          variantValues {
            variantTypeName
            variantValueName
          }

          prices {
            priceListId
            sellPrice
            discountPrice
          }

          stocks {
            id
            productId
            variantId
            stockLocationId
            stockCount
          }
        }
      }
    }
  }
`;

function normalizeText(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLocaleLowerCase(
      "tr-TR"
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /ı/g,
      "i"
    );
}

function isRenewedProduct(
  product: any
) {
  const source = [
    product?.name,
    product?.description,
    product?.brand
      ?.name,
    ...(Array.isArray(
      product?.categories
    )
      ? product.categories.map(
          (item: any) =>
            item?.name
        )
      : []),
  ]
    .map(normalizeText)
    .join(" ");

  return (
    source.includes(
      "yenilenmis"
    ) ||
    source.includes(
      "renewed"
    )
  );
}

function safeNumber(
  value: unknown
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function normalizeProduct(
  product: any
) {
  const variants =
    Array.isArray(
      product?.variants
    )
      ? product.variants
      : [];

  const normalizedVariants =
    variants.map(
      (variant: any) => {
        const stocks =
          Array.isArray(
            variant?.stocks
          )
            ? variant.stocks
            : [];

        const prices =
          Array.isArray(
            variant?.prices
          )
            ? variant.prices
            : [];

        const stockCount =
          stocks.reduce(
            (
              sum: number,
              stock: any
            ) =>
              sum +
              safeNumber(
                stock
                  ?.stockCount
              ),
            0
          );

        return {
          id:
            variant?.id ??
            null,
          sku:
            String(
              variant?.sku ??
                ""
            ),
          barcodeList:
            Array.isArray(
              variant
                ?.barcodeList
            )
              ? variant
                  .barcodeList
              : [],
          variantValues:
            Array.isArray(
              variant
                ?.variantValues
            )
              ? variant
                  .variantValues
              : [],
          prices,
          stocks,
          stockCount,
        };
      }
    );

  const calculatedStock =
    normalizedVariants.reduce(
      (
        sum: number,
        variant: any
      ) =>
        sum +
        safeNumber(
          variant
            ?.stockCount
        ),
      0
    );

  const apiTotalStock =
    safeNumber(
      product
        ?.totalStock
    );

  return {
    id:
      product?.id ??
      null,
    name:
      String(
        product?.name ??
          ""
      ),
    description:
      product
        ?.description ??
      null,
    updatedAt:
      product
        ?.updatedAt ??
      null,
    brand:
      product?.brand ??
      null,
    categories:
      Array.isArray(
        product
          ?.categories
      )
        ? product
            .categories
        : [],
    totalStock:
      calculatedStock ||
      apiTotalStock,
    apiTotalStock,
    calculatedStock,
    isRenewed:
      isRenewedProduct(
        product
      ),
    variants:
      normalizedVariants,
  };
}

async function fetchAllProducts(
  accessToken: string
) {
  const productMap =
    new Map<
      string,
      any
    >();

  let apiCount = 0;
  let fetchedPages = 0;

  // ikas listProduct sayfalama yapısında
  // bazı mağazalarda ilk sayfa 0,
  // bazı örneklerde 1 kullanıldığı için
  // once page=0 ile başlarız.
  let page = 0;

  for (
    let loop = 0;
    loop < MAX_PAGES;
    loop += 1
  ) {
    const data =
      await graphql(
        accessToken,
        ALL_PRODUCTS_QUERY,
        {
          pagination: {
            page,
            limit:
              PAGE_LIMIT,
          },
        }
      );

    const response =
      data?.listProduct;

    const items =
      Array.isArray(
        response?.data
      )
        ? response.data
        : [];

    if (
      loop === 0 &&
      items.length === 0
    ) {
      // page=0 boş dönerse page=1 dene.
      page = 1;

      continue;
    }

    fetchedPages += 1;

    if (
      safeNumber(
        response?.count
      ) > 0
    ) {
      apiCount =
        safeNumber(
          response?.count
        );
    }

    for (
      const item of items
    ) {
      const id =
        String(
          item?.id || ""
        ).trim();

      if (id) {
        productMap.set(
          id,
          item
        );
      }
    }

    const hasNext =
      response?.hasNext ===
      true;

    if (
      !hasNext ||
      items.length === 0
    ) {
      break;
    }

    const responsePage =
      Number(
        response?.page
      );

    if (
      Number.isFinite(
        responsePage
      )
    ) {
      page =
        responsePage + 1;
    } else {
      page += 1;
    }
  }

  return {
    apiCount,
    fetchedPages,
    products:
      Array.from(
        productMap.values()
      ),
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const authError =
      await requireSuperAdmin(
        request
      );

    if (authError) {
      return authError;
    }

    const accessToken =
      await getIkasAccessToken();

    const result =
      await fetchAllProducts(
        accessToken
      );

    const allProducts =
      result.products.map(
        normalizeProduct
      );

    const renewedProducts =
      allProducts.filter(
        (product: any) =>
          product.isRenewed
      );

    const allPhysicalStock =
      allProducts.reduce(
        (
          sum: number,
          product: any
        ) =>
          sum +
          safeNumber(
            product
              ?.totalStock
          ),
        0
      );

    const renewedPhysicalStock =
      renewedProducts.reduce(
        (
          sum: number,
          product: any
        ) =>
          sum +
          safeNumber(
            product
              ?.totalStock
          ),
        0
      );

    const allVariantCount =
      allProducts.reduce(
        (
          sum: number,
          product: any
        ) =>
          sum +
          (Array.isArray(
            product
              ?.variants
          )
            ? product
                .variants
                .length
            : 0),
        0
      );

    const renewedVariantCount =
      renewedProducts.reduce(
        (
          sum: number,
          product: any
        ) =>
          sum +
          (Array.isArray(
            product
              ?.variants
          )
            ? product
                .variants
                .length
            : 0),
        0
      );

    return json({
      success: true,
      readOnly: true,
      message:
        "İkas tüm stok ve yenilenmiş ürünler okundu.",

      summary: {
        apiReportedProductCount:
          result.apiCount,
        fetchedProductCount:
          allProducts.length,
        fetchedPages:
          result.fetchedPages,

        allProductCount:
          allProducts.length,
        allVariantCount,
        allPhysicalStock,

        renewedProductCount:
          renewedProducts.length,
        renewedVariantCount,
        renewedPhysicalStock,
      },

      renewedDetection: {
        rule:
          "Ürün adı / açıklama / kategori / marka içinde 'Yenilenmiş' veya 'Renewed' geçmesi",
        note:
          "Bu yalnızca keşif filtresidir. Ürün ekleme mimarisinde Grade/Garanti/Renk/Hafıza ayrıca modellenir.",
      },

      renewedProducts,
      allProducts,

      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "IKAS INVENTORY ERROR:",
      error
    );

    return json(
      {
        success: false,
        readOnly: true,
        error:
          error instanceof Error
            ? error.message
            : "İkas stokları okunamadı.",
        checkedAt:
          new Date().toISOString(),
      },
      500
    );
  }
}
