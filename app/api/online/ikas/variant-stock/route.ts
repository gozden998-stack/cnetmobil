// app/api/online/ikas/variant-stock/route.ts
// CNETMOBIL - IKAS ADIM 7.1
//
// MANUEL IKAS STOK KONTROLU
//
// Destek:
// - decrement : mevcut stoktan 1 düşür
// - zero      : varyant stoğunu 0 yap
// - set       : stoğu manuel düşür / aynı bırak
//
// GÜVENLİK:
// - Bu aşamada stok ARTIRMA YASAK.
// - Çünkü +stok mutlaka fiziksel IMEI girişi ile oluşmalı.
// - İkas'a saveVariantStocks ile yazar.
// - N11'e dokunmaz.
// - stock_devices / IMEI kayıtlarına dokunmaz.
// - ADIM 7 PostgreSQL aynası varsa quantity best-effort güncellenir.
//
// Resmi ikas mutation:
// saveVariantStocks(input: SaveVariantStocksInput!)

import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  Pool,
} from "pg";
import crypto from "crypto";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasVariantStockPool:
    | Pool
    | undefined;
}

const COOKIE_NAME =
  "cnet_auth";

const IKAS_TOKEN_URL =
  "https://api.myikas.com/api/admin/oauth/token";

const IKAS_GRAPHQL_URL =
  "https://api.myikas.com/api/v2/admin/graphql";

type SessionPayload = {
  userId: number | null;
  role:
    | "admin"
    | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

type StockAction =
  | "decrement"
  | "zero"
  | "set";

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
    !global
      .cnetIkasVariantStockPool
  ) {
    global
      .cnetIkasVariantStockPool =
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
    .cnetIkasVariantStockPool;
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

const PRODUCTS_QUERY = `
  query CnetIkasVariantStockProduct(
    $pagination: PaginationInput
  ) {
    listProduct(
      pagination: $pagination
    ) {
      hasNext
      page
      data {
        id
        name
        variants {
          id
          sku
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

const STOCK_LOCATIONS_QUERY = `
  query CnetIkasVariantStockLocations {
    listStockLocation {
      id
      name
      deleted
    }
  }
`;

const SAVE_VARIANT_STOCKS = `
  mutation CnetIkasSaveVariantStocks(
    $input: SaveVariantStocksInput!
  ) {
    saveVariantStocks(
      input: $input
    ) {
      isSuccess
      errorInputs {
        variantId
        productId
      }
    }
  }
`;

function safeInteger(
  value: unknown
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(number)
  );
}

async function findVariant(
  accessToken: string,
  productId: string,
  variantId: string
) {
  let page = 0;

  for (
    let loop = 0;
    loop < 200;
    loop += 1
  ) {
    const data =
      await graphql(
        accessToken,
        PRODUCTS_QUERY,
        {
          pagination: {
            page,
            limit: 100,
          },
        }
      );

    const response =
      data?.listProduct;

    const products =
      Array.isArray(
        response?.data
      )
        ? response.data
        : [];

    if (
      loop === 0 &&
      products.length === 0
    ) {
      page = 1;
      continue;
    }

    for (
      const product of
      products
    ) {
      if (
        String(
          product?.id ||
            ""
        ) !== productId
      ) {
        continue;
      }

      const variants =
        Array.isArray(
          product?.variants
        )
          ? product.variants
          : [];

      const variant =
        variants.find(
          (item: any) =>
            String(
              item?.id ||
                ""
            ) ===
            variantId
        );

      if (variant) {
        return {
          product,
          variant,
        };
      }
    }

    if (
      response?.hasNext !==
        true ||
      products.length === 0
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

  return null;
}

function totalStock(
  variant: any
) {
  const stocks =
    Array.isArray(
      variant?.stocks
    )
      ? variant.stocks
      : [];

  return stocks.reduce(
    (
      sum: number,
      stock: any
    ) =>
      sum +
      safeInteger(
        stock?.stockCount
      ),
    0
  );
}

async function getFallbackLocationId(
  accessToken: string
) {
  const data =
    await graphql(
      accessToken,
      STOCK_LOCATIONS_QUERY
    );

  const locations =
    Array.isArray(
      data
        ?.listStockLocation
    )
      ? data.listStockLocation
      : [];

  const active =
    locations.filter(
      (item: any) =>
        item?.deleted !==
        true
    );

  const anaDepo =
    active.find(
      (item: any) =>
        String(
          item?.name ||
            ""
        )
          .toLocaleLowerCase(
            "tr-TR"
          )
          .includes(
            "ana depo"
          )
    );

  return String(
    anaDepo?.id ||
      active[0]?.id ||
      ""
  ).trim();
}

function buildStockInputs(
  productId: string,
  variantId: string,
  variant: any,
  targetQuantity: number,
  fallbackLocationId: string
) {
  const stocks =
    Array.isArray(
      variant?.stocks
    )
      ? variant.stocks
      : [];

  const validStocks =
    stocks.filter(
      (stock: any) =>
        String(
          stock
            ?.stockLocationId ||
            ""
        ).trim()
    );

  if (
    targetQuantity === 0
  ) {
    if (
      validStocks.length >
      0
    ) {
      return validStocks.map(
        (stock: any) => ({
          deleted: false,
          productId,
          stockCount: 0,
          stockLocationId:
            String(
              stock
                ?.stockLocationId
            ),
          variantId,
        })
      );
    }

    if (
      !fallbackLocationId
    ) {
      throw new Error(
        "Aktif İkas stok lokasyonu bulunamadı."
      );
    }

    return [
      {
        deleted: false,
        productId,
        stockCount: 0,
        stockLocationId:
          fallbackLocationId,
        variantId,
      },
    ];
  }

  const positiveStocks =
    validStocks.filter(
      (stock: any) =>
        safeInteger(
          stock?.stockCount
        ) > 0
    );

  const positiveLocationIds =
    Array.from(
      new Set(
        positiveStocks.map(
          (stock: any) =>
            String(
              stock
                ?.stockLocationId
            )
        )
      )
    );

  if (
    positiveLocationIds.length >
    1
  ) {
    throw new Error(
      "Bu varyant birden fazla pozitif stok lokasyonunda görünüyor. Güvenlik için manuel değişiklik durduruldu."
    );
  }

  const targetLocationId =
    positiveLocationIds[0] ||
    fallbackLocationId ||
    String(
      validStocks[0]
        ?.stockLocationId ||
        ""
    ).trim();

  if (
    !targetLocationId
  ) {
    throw new Error(
      "İkas stok lokasyonu bulunamadı."
    );
  }

  const inputs =
    validStocks
      .filter(
        (stock: any) =>
          String(
            stock
              ?.stockLocationId
          ) !==
          targetLocationId
      )
      .map(
        (stock: any) => ({
          deleted: false,
          productId,
          stockCount: 0,
          stockLocationId:
            String(
              stock
                ?.stockLocationId
            ),
          variantId,
        })
      );

  inputs.push({
    deleted: false,
    productId,
    stockCount:
      targetQuantity,
    stockLocationId:
      targetLocationId,
    variantId,
  });

  return inputs;
}

async function updatePostgresMirror(
  variantId: string,
  targetQuantity: number,
  action: StockAction
) {
  try {
    const result =
      await getPool().query(
        `
          UPDATE public.online_listings
          SET
            quantity = $1,
            sale_status =
              CASE
                WHEN $1 > 0
                  THEN 'ON_SALE'
                ELSE 'OUT_OF_STOCK'
              END,
            sync_status = 'SYNCED',
            raw_data =
              COALESCE(
                raw_data,
                '{}'::jsonb
              )
              ||
              jsonb_build_object(
                'manualStockControl',
                jsonb_build_object(
                  'action', $2::text,
                  'quantity', $1::integer,
                  'source', 'PANEL',
                  'updatedAt', now()
                )
              ),
            last_synced_at = now(),
            updated_at = now()
          WHERE channel = 'IKAS'
            AND external_variant_id = $3
          RETURNING id
        `,
        [
          targetQuantity,
          action,
          variantId,
        ]
      );

    return {
      updated:
        result.rowCount ===
        1,
      error: null,
    };
  } catch (error) {
    return {
      updated: false,
      error:
        error instanceof Error
          ? error.message
          : "PostgreSQL ayna güncellenemedi.",
    };
  }
}

export async function POST(
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

    const body =
      await request.json();

    const productId =
      String(
        body?.productId ||
          ""
      ).trim();

    const variantId =
      String(
        body?.variantId ||
          ""
      ).trim();

    const action =
      String(
        body?.action ||
          ""
      ) as StockAction;

    if (
      !productId ||
      !variantId
    ) {
      return json(
        {
          success: false,
          error:
            "productId ve variantId zorunlu.",
        },
        400
      );
    }

    if (
      ![
        "decrement",
        "zero",
        "set",
      ].includes(action)
    ) {
      return json(
        {
          success: false,
          error:
            "Geçersiz stok işlemi.",
        },
        400
      );
    }

    const accessToken =
      await getIkasAccessToken();

    const current =
      await findVariant(
        accessToken,
        productId,
        variantId
      );

    if (!current) {
      return json(
        {
          success: false,
          error:
            "İkas ürün/varyant bulunamadı.",
        },
        404
      );
    }

    const currentQuantity =
      totalStock(
        current.variant
      );

    let targetQuantity =
      currentQuantity;

    if (
      action ===
      "decrement"
    ) {
      targetQuantity =
        Math.max(
          0,
          currentQuantity - 1
        );
    }

    if (
      action === "zero"
    ) {
      targetQuantity = 0;
    }

    if (
      action === "set"
    ) {
      const requested =
        Number(
          body?.quantity
        );

      if (
        !Number.isInteger(
          requested
        ) ||
        requested < 0
      ) {
        return json(
          {
            success: false,
            error:
              "Stok adedi 0 veya daha büyük tam sayı olmalı.",
          },
          400
        );
      }

      if (
        requested >
        currentQuantity
      ) {
        return json(
          {
            success: false,
            error:
              "Bu aşamada panelden stok artırma kapalı. Yeni stok sadece IMEI girişi ile eklenecek.",
            currentQuantity,
          },
          409
        );
      }

      targetQuantity =
        requested;
    }

    if (
      targetQuantity ===
      currentQuantity
    ) {
      return json({
        success: true,
        noChange: true,
        productId,
        variantId,
        action,
        previousQuantity:
          currentQuantity,
        quantity:
          currentQuantity,
        ikasUpdated: false,
        n11Touched: false,
        imeiTouched: false,
        message:
          "Stok zaten istenen değerde.",
      });
    }

    const fallbackLocationId =
      await getFallbackLocationId(
        accessToken
      );

    const stockInputs =
      buildStockInputs(
        productId,
        variantId,
        current.variant,
        targetQuantity,
        fallbackLocationId
      );

    const mutationData =
      await graphql(
        accessToken,
        SAVE_VARIANT_STOCKS,
        {
          input: {
            stockInputs,
          },
        }
      );

    const result =
      mutationData
        ?.saveVariantStocks;

    if (
      result?.isSuccess !==
      true
    ) {
      return json(
        {
          success: false,
          error:
            "İkas stok güncellemesini kabul etmedi.",
          errorInputs:
            result?.errorInputs ||
            [],
        },
        502
      );
    }

    const verified =
      await findVariant(
        accessToken,
        productId,
        variantId
      );

    const verifiedQuantity =
      verified
        ? totalStock(
            verified.variant
          )
        : targetQuantity;

    if (
      verified &&
      verifiedQuantity !==
        targetQuantity
    ) {
      return json(
        {
          success: false,
          partialSuccess: true,
          error:
            "İkas mutation başarılı döndü ancak doğrulanan stok beklenen değerle uyuşmuyor.",
          previousQuantity:
            currentQuantity,
          targetQuantity,
          verifiedQuantity,
          ikasUpdated: true,
          n11Touched: false,
          imeiTouched: false,
        },
        409
      );
    }

    const postgres =
      await updatePostgresMirror(
        variantId,
        verifiedQuantity,
        action
      );

    return json({
      success: true,
      productId,
      variantId,
      productName:
        current.product
          ?.name ||
        null,
      sku:
        current.variant
          ?.sku ||
        null,
      action,
      previousQuantity:
        currentQuantity,
      quantity:
        verifiedQuantity,
      ikasUpdated: true,
      postgresMirrorUpdated:
        postgres.updated,
      postgresMirrorError:
        postgres.error,
      n11Touched: false,
      imeiTouched: false,
      stockIncreaseAllowed:
        false,
      message:
        `${currentQuantity} → ${verifiedQuantity} İkas stoğu güncellendi.`,
      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "IKAS VARIANT STOCK ERROR:",
      error
    );

    return json(
      {
        success: false,
        ikasUpdated: false,
        n11Touched: false,
        imeiTouched: false,
        error:
          error instanceof Error
            ? error.message
            : "İkas stok işlemi başarısız.",
      },
      500
    );
  }
}
