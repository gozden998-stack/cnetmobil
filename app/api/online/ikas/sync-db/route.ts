// app/api/online/ikas/sync-db/route.ts
// CNETMOBIL - IKAS ADIM 7.0
//
// IKAS -> POSTGRESQL KATALOG ESLESTIRME
//
// Bu route:
// - İkas'taki YENİLENMİŞ ürünleri canlı API'den okur.
// - Her İkas varyantını public.online_listings tablosunda channel='IKAS'
//   olarak upsert eder.
// - N11 kayıtlarına DOKUNMAZ.
// - İkas'a HİÇBİR veri YAZMAZ.
// - stock_device_id = NULL kalır. Henüz IMEI eşleştirmesi YAPILMAZ.
// - İkas'ta silinmiş/eski kayıtları bu adımda DELETE etmez.
//
// Kimlik:
// external_product_id = Ikas product id
// external_variant_id = Ikas variant id
// external_stock_code = gerçek Ikas SKU; SKU boşsa IKASVAR-{variantId}
//
// Fiyat:
// list_price = Ikas sellPrice
// sale_price = discountPrice > 0 ise discountPrice, yoksa sellPrice
//
// Stok:
// quantity = varyantın tüm stock satırlarının toplamı
// stock_location_id = ilk pozitif stok lokasyonu (detayların tamamı raw_data'da)

import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  Pool,
  PoolClient,
} from "pg";
import crypto from "crypto";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasDbSyncPool:
    | Pool
    | undefined;
}

const COOKIE_NAME =
  "cnet_auth";

const IKAS_TOKEN_URL =
  "https://api.myikas.com/api/admin/oauth/token";

const IKAS_GRAPHQL_URL =
  "https://api.myikas.com/api/v2/admin/graphql";

const PAGE_LIMIT = 100;
const MAX_PAGES = 200;

type SessionPayload = {
  userId: number | null;
  role:
    | "admin"
    | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

function json(
  body: Record<
    string,
    unknown
  >,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
        Pragma:
          "no-cache",
        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
}

function getPool() {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  if (
    !global.cnetIkasDbSyncPool
  ) {
    global.cnetIkasDbSyncPool =
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
    .cnetIkasDbSyncPool;
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
      process.env
        .SESSION_SECRET;

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
    row.active !== true ||
    row.is_super_admin !==
      true
  ) {
    return json(
      {
        success: false,
        error:
          "Bu işlem yalnızca Super Admin içindir.",
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

    if (!response.ok) {
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

    if (!accessToken) {
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

    if (!response.ok) {
      throw new Error(
        payload
          ?.errors?.[0]
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
  query CnetIkasDbSyncProducts(
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
    .map(
      normalizeText
    )
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

function positiveMoneyOrNull(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    return null;
  }

  return Math.round(
    number * 100
  ) / 100;
}

function stringOrNull(
  value: unknown,
  max = 10_000
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return null;
  }

  return text.slice(
    0,
    max
  );
}

function extractMemory(
  productName: unknown
) {
  const text =
    String(
      productName ?? ""
    );

  const match =
    text.match(
      /\b(\d+\s*(?:GB|TB))\b/i
    );

  return match
    ? match[1]
        .replace(
          /\s+/g,
          ""
        )
        .toUpperCase()
    : null;
}

function extractGrade(
  productName: unknown
) {
  const text =
    normalizeText(
      productName
    );

  if (
    text.includes(
      "mukemmel"
    )
  ) {
    return "A";
  }

  if (
    text.includes(
      "cok iyi"
    )
  ) {
    return "B";
  }

  if (
    /(^|\s)iyi($|\s)/.test(
      text
    )
  ) {
    return "C";
  }

  return null;
}

function extractColor(
  variant: any
) {
  const values =
    Array.isArray(
      variant?.variantValues
    )
      ? variant.variantValues
      : [];

  const color =
    values.find(
      (item: any) => {
        const type =
          normalizeText(
            item
              ?.variantTypeName
          );

        return (
          type.includes(
            "renk"
          ) ||
          type.includes(
            "color"
          )
        );
      }
    );

  return stringOrNull(
    color
      ?.variantValueName ??
      values[0]
        ?.variantValueName,
    250
  );
}

function extractModel(
  productName: unknown,
  brandName: unknown,
  memory: string | null
) {
  let text =
    String(
      productName ?? ""
    ).trim();

  text =
    text.replace(
      /yenilenmiş/gi,
      ""
    );

  text =
    text.replace(
      /renewed/gi,
      ""
    );

  const brand =
    String(
      brandName ?? ""
    ).trim();

  if (brand) {
    const escaped =
      brand.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    text =
      text.replace(
        new RegExp(
          escaped,
          "ig"
        ),
        ""
      );
  }

  if (memory) {
    const escaped =
      memory.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    text =
      text.replace(
        new RegExp(
          escaped,
          "ig"
        ),
        ""
      );
  }

  text =
    text
      .replace(
        /\bmükemmel\b/gi,
        ""
      )
      .replace(
        /\bçok\s+iyi\b/gi,
        ""
      )
      .replace(
        /\biyi\b/gi,
        ""
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return (
    stringOrNull(
      text,
      500
    ) || null
  );
}

function firstPositiveLocationId(
  variant: any
) {
  const stocks =
    Array.isArray(
      variant?.stocks
    )
      ? variant.stocks
      : [];

  const positive =
    stocks.find(
      (stock: any) =>
        safeNumber(
          stock
            ?.stockCount
        ) > 0
    );

  return stringOrNull(
    positive
      ?.stockLocationId ??
      stocks[0]
        ?.stockLocationId,
    500
  );
}

function quantityOfVariant(
  variant: any
) {
  const stocks =
    Array.isArray(
      variant?.stocks
    )
      ? variant.stocks
      : [];

  return Math.max(
    0,
    Math.trunc(
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
      )
    )
  );
}

function priceOfVariant(
  variant: any
) {
  const prices =
    Array.isArray(
      variant?.prices
    )
      ? variant.prices
      : [];

  const first =
    prices[0] || null;

  const sellPrice =
    positiveMoneyOrNull(
      first?.sellPrice
    );

  const discountPrice =
    positiveMoneyOrNull(
      first?.discountPrice
    );

  return {
    listPrice:
      sellPrice,
    salePrice:
      discountPrice ??
      sellPrice,
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

  let page = 0;
  let fetchedPages = 0;
  let apiCount = 0;

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
          item?.id ||
            ""
        ).trim();

      if (id) {
        productMap.set(
          id,
          item
        );
      }
    }

    if (
      response?.hasNext !==
        true ||
      items.length === 0
    ) {
      break;
    }

    const responsePage =
      Number(
        response?.page
      );

    page =
      Number.isFinite(
        responsePage
      )
        ? responsePage + 1
        : page + 1;
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

async function ensureSchema(
  client: PoolClient
) {
  const result =
    await client.query(
      `
        SELECT
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'online_listings'
              AND column_name = 'external_variant_id'
          ) AS has_external_variant_id,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'online_listings'
              AND column_name = 'stock_location_id'
          ) AS has_stock_location_id
      `
    );

  const row =
    result.rows[0];

  if (
    !row
      ?.has_external_variant_id ||
    !row
      ?.has_stock_location_id
  ) {
    throw new Error(
      "ADIM 7 PostgreSQL migration henüz uygulanmamış. Önce IKAS_ADIM7_POSTGRESQL_MIGRATION.sql çalıştır."
    );
  }
}

async function upsertVariant(
  client: PoolClient,
  product: any,
  variant: any
) {
  const productId =
    stringOrNull(
      product?.id,
      500
    );

  const variantId =
    stringOrNull(
      variant?.id,
      500
    );

  if (
    !productId ||
    !variantId
  ) {
    return {
      skipped: true,
      quantity: 0,
    };
  }

  const realSku =
    stringOrNull(
      variant?.sku,
      500
    );

  const stockCode =
    realSku ||
    `IKASVAR-${variantId}`;

  const quantity =
    quantityOfVariant(
      variant
    );

  const prices =
    priceOfVariant(
      variant
    );

  const brand =
    stringOrNull(
      product?.brand
        ?.name,
      500
    );

  const memory =
    extractMemory(
      product?.name
    );

  const model =
    extractModel(
      product?.name,
      brand,
      memory
    );

  const color =
    extractColor(
      variant
    );

  const grade =
    extractGrade(
      product?.name
    );

  const stockLocationId =
    firstPositiveLocationId(
      variant
    );

  const categories =
    Array.isArray(
      product?.categories
    )
      ? product.categories
      : [];

  const firstCategoryId =
    stringOrNull(
      categories[0]?.id,
      500
    );

  const attributes = {
    ikasVariantValues:
      Array.isArray(
        variant?.variantValues
      )
        ? variant.variantValues
        : [],
  };

  const rawData = {
    source:
      "IKAS_LIVE_SYNC",
    ikasProductId:
      productId,
    ikasVariantId:
      variantId,
    ikasSku:
      realSku,
    generatedStockCode:
      !realSku,
    productUpdatedAt:
      product?.updatedAt ??
      null,
    brand:
      product?.brand ??
      null,
    categories,
    primaryCategoryId:
      firstCategoryId,
    barcodeList:
      Array.isArray(
        variant?.barcodeList
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
    prices:
      Array.isArray(
        variant?.prices
      )
        ? variant.prices
        : [],
    stocks:
      Array.isArray(
        variant?.stocks
      )
        ? variant.stocks
        : [],
    ikasTotalStock:
      product
        ?.totalStock ??
      null,
    mapping: {
      stockDeviceId:
        null,
      imeiLinked:
        false,
      phase:
        "IKAS_CATALOG_MIRROR",
    },
  };

  const result =
    await client.query(
      `
        INSERT INTO public.online_listings AS ol (
          stock_device_id,
          channel,
          external_product_id,
          external_variant_id,
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
          currency_type,
          attributes,
          raw_data,
          last_synced_at,
          stock_location_id,
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
          'IKAS',
          $1,
          $2,
          $3,
          NULL,
          NULL,
          $4,
          $5,
          $6,
          $7,
          $8,
          'ACTIVE',
          $9,
          'SYNCED',
          'TRY',
          $10::jsonb,
          $11::jsonb,
          now(),
          $12,
          $13,
          $14,
          $15,
          $16,
          $17,
          NULL,
          now()
        )
        ON CONFLICT (
          channel,
          external_stock_code
        )
        DO UPDATE SET
          stock_device_id =
            ol.stock_device_id,
          external_product_id =
            EXCLUDED.external_product_id,
          external_variant_id =
            EXCLUDED.external_variant_id,
          title =
            EXCLUDED.title,
          description =
            EXCLUDED.description,
          sale_price =
            EXCLUDED.sale_price,
          list_price =
            EXCLUDED.list_price,
          quantity =
            EXCLUDED.quantity,
          product_status =
            EXCLUDED.product_status,
          sale_status =
            EXCLUDED.sale_status,
          sync_status =
            'SYNCED',
          currency_type =
            EXCLUDED.currency_type,
          attributes =
            EXCLUDED.attributes,
          raw_data =
            (
              COALESCE(
                ol.raw_data,
                '{}'::jsonb
              )
              ||
              EXCLUDED.raw_data
            ),
          last_synced_at =
            now(),
          stock_location_id =
            EXCLUDED.stock_location_id,
          brand =
            EXCLUDED.brand,
          model =
            EXCLUDED.model,
          memory =
            EXCLUDED.memory,
          color =
            EXCLUDED.color,
          grade =
            EXCLUDED.grade,
          warranty =
            COALESCE(
              ol.warranty,
              EXCLUDED.warranty
            ),
          updated_at =
            now()
        RETURNING
          id,
          (
            xmax = 0
          ) AS inserted
      `,
      [
        productId,
        variantId,
        stockCode,
        stringOrNull(
          product?.name,
          1_000
        ),
        stringOrNull(
          product
            ?.description,
          50_000
        ),
        prices.salePrice,
        prices.listPrice,
        quantity,
        quantity > 0
          ? "ON_SALE"
          : "OUT_OF_STOCK",
        JSON.stringify(
          attributes
        ),
        JSON.stringify(
          rawData
        ),
        stockLocationId,
        brand,
        model,
        memory,
        color,
        grade,
      ]
    );

  return {
    skipped: false,
    inserted:
      result.rows[0]
        ?.inserted ===
      true,
    quantity,
  };
}

export async function POST(
  request: NextRequest
) {
  let client:
    PoolClient | null = null;

  try {
    const authError =
      await requireSuperAdmin(
        request
      );

    if (authError) {
      return authError;
    }

    const syncStartedAt =
      new Date();

    const accessToken =
      await getIkasAccessToken();

    const fetched =
      await fetchAllProducts(
        accessToken
      );

    const renewedProducts =
      fetched.products.filter(
        (
          product: any
        ) =>
          isRenewedProduct(
            product
          )
      );

    client =
      await getPool().connect();

    await client.query(
      "BEGIN"
    );

    await ensureSchema(
      client
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let variantCount = 0;
    let physicalStock = 0;

    for (
      const product of
      renewedProducts
    ) {
      const variants =
        Array.isArray(
          product?.variants
        )
          ? product.variants
          : [];

      for (
        const variant of
        variants
      ) {
        variantCount += 1;

        const result =
          await upsertVariant(
            client,
            product,
            variant
          );

        if (
          result.skipped
        ) {
          skipped += 1;
          continue;
        }

        physicalStock +=
          result.quantity;

        if (
          result.inserted
        ) {
          inserted += 1;
        } else {
          updated += 1;
        }
      }
    }

    const mirrorResult =
      await client.query(
        `
          SELECT
            COUNT(*)::integer AS row_count,
            COALESCE(
              SUM(quantity),
              0
            )::integer AS quantity_sum,
            COUNT(*) FILTER (
              WHERE quantity > 0
            )::integer AS open_variant_count,
            COUNT(*) FILTER (
              WHERE stock_device_id IS NOT NULL
            )::integer AS imei_linked_count
          FROM public.online_listings
          WHERE channel = 'IKAS'
        `
      );

    await client.query(
      "COMMIT"
    );

    const mirror =
      mirrorResult.rows[0] ||
      {};

    return json({
      success: true,
      direction:
        "IKAS_TO_POSTGRESQL",
      ikasWrite:
        false,
      n11Touched:
        false,
      imeiMapping:
        false,

      source: {
        apiReportedProductCount:
          fetched.apiCount,
        fetchedPages:
          fetched.fetchedPages,
        renewedProductCount:
          renewedProducts.length,
        renewedVariantCount:
          variantCount,
        renewedPhysicalStock:
          physicalStock,
      },

      postgres: {
        inserted,
        updated,
        skipped,
        totalIkasRows:
          Number(
            mirror.row_count ||
              0
          ),
        totalIkasQuantity:
          Number(
            mirror.quantity_sum ||
              0
          ),
        openVariantCount:
          Number(
            mirror.open_variant_count ||
              0
          ),
        imeiLinkedCount:
          Number(
            mirror.imei_linked_count ||
              0
          ),
      },

      safety: {
        stockDeviceIdChanged:
          false,
        ikasChanged:
          false,
        n11Changed:
          false,
        deletedRows:
          0,
        note:
          "Bu adım sadece İkas kataloğunu PostgreSQL online_listings içine aynalar. IMEI bağlama sonraki adımdır.",
      },

      syncStartedAt:
        syncStartedAt.toISOString(),
      completedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // rollback best effort
      }
    }

    console.error(
      "IKAS DB SYNC ERROR:",
      error
    );

    return json(
      {
        success: false,
        direction:
          "IKAS_TO_POSTGRESQL",
        ikasWrite:
          false,
        error:
          error instanceof Error
            ? error.message
            : "İkas PostgreSQL eşleştirmesi başarısız.",
      },
      500
    );
  } finally {
    client?.release();
  }
}
