// app/api/online/ikas/product-structure/route.ts
// CNETMOBIL - IKAS ADIM 3.3
// READ ONLY: Yenilenmis urun + kategori + marka + fiyat + stok lokasyonu + satis kanali.
// HICBIR urun / stok / fiyat / siparis verisi DEGISTIRMEZ.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasProductStructurePool: Pool | undefined;
}

const COOKIE_NAME = "cnet_auth";

const IKAS_TOKEN_URL =
  "https://api.myikas.com/api/admin/oauth/token";

const IKAS_GRAPHQL_URL =
  "https://api.myikas.com/api/v2/admin/graphql";

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

type TypeRef = {
  kind?: string | null;
  name?: string | null;
  ofType?: TypeRef | null;
};

type FieldInfo = {
  name?: string | null;
  args?: Array<{
    name?: string | null;
    type?: TypeRef | null;
  }> | null;
  type?: TypeRef | null;
};

type TypeInfo = {
  fields?: FieldInfo[] | null;
};

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
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

  if (
    !global.cnetIkasProductStructurePool
  ) {
    global.cnetIkasProductStructurePool =
      new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
  }

  return global
    .cnetIkasProductStructurePool;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [encoded, signature] =
      token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const secret =
      process.env.SESSION_SECRET;

    if (!secret) {
      return null;
    }

    const expected = crypto
      .createHmac("sha256", secret)
      .update(encoded)
      .digest("base64url");

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
      a.length !== b.length ||
      !crypto.timingSafeEqual(a, b)
    ) {
      return null;
    }

    const payload =
      JSON.parse(
        Buffer.from(
          encoded,
          "base64url"
        ).toString("utf8")
      ) as SessionPayload;

    if (
      !payload?.userId ||
      !payload?.exp ||
      payload.exp <
        Math.floor(Date.now() / 1000)
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
        error: "Oturum gerekli.",
      },
      401
    );
  }

  const session =
    verifySession(token);

  if (!session?.userId) {
    return json(
      {
        success: false,
        error: "Geçersiz oturum.",
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
      [session.userId]
    );

  const row =
    result.rows[0];

  if (
    !row ||
    row.active !== true ||
    row.is_super_admin !== true
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
      process.env.IKAS_CLIENT_ID || ""
    ).trim();

  const clientSecret =
    String(
      process.env.IKAS_CLIENT_SECRET || ""
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
      () => controller.abort(),
      15_000
    );

  try {
    const response =
      await fetch(
        IKAS_TOKEN_URL,
        {
          method: "POST",
          cache: "no-store",
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

    let payload: any = null;

    try {
      payload =
        rawText
          ? JSON.parse(rawText)
          : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.error_description ||
          payload?.message ||
          payload?.error ||
          `ikas token HTTP ${response.status}`
      );
    }

    const accessToken =
      String(
        payload?.access_token || ""
      ).trim();

    if (!accessToken) {
      throw new Error(
        "ikas access_token alınamadı."
      );
    }

    return accessToken;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function graphql(
  accessToken: string,
  query: string,
  variables:
    Record<string, unknown> = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      25_000
    );

  try {
    const response =
      await fetch(
        IKAS_GRAPHQL_URL,
        {
          method: "POST",
          cache: "no-store",
          headers: {
            "Content-Type":
              "application/json",
            Accept:
              "application/json",
            Authorization:
              `Bearer ${accessToken}`,
          },
          body:
            JSON.stringify({
              query,
              variables,
            }),
          signal:
            controller.signal,
        }
      );

    const rawText =
      await response.text();

    let payload: any = null;

    try {
      payload =
        rawText
          ? JSON.parse(rawText)
          : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(
        payload?.errors?.[0]?.message ||
          payload?.message ||
          `ikas GraphQL HTTP ${response.status}`
      );
    }

    if (
      Array.isArray(payload?.errors) &&
      payload.errors.length > 0
    ) {
      throw new Error(
        payload.errors
          .map(
            (item: any) =>
              String(
                item?.message ||
                  "GraphQL hata"
              )
          )
          .join(" | ")
      );
    }

    return payload?.data ?? {};
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeText(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/ı/g, "i");
}

function safeNumber(
  value: unknown
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function isRenewed(
  product: any
) {
  const haystack = [
    product?.name,
    product?.description,
    product?.brand?.name,
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
    haystack.includes("yenilenmis") ||
    haystack.includes("renewed")
  );
}

const SAMPLE_PRODUCT_QUERY = `
  query CnetIkasSampleRenewedProduct(
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
        totalStock
        updatedAt

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

const QUERY_SCHEMA = `
  query CnetIkasQuerySchema {
    __type(name: "Query") {
      fields {
        name
        args {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  }
`;

const TYPE_SCHEMA = `
  query CnetIkasTypeSchema(
    $name: String!
  ) {
    __type(name: $name) {
      fields {
        name
        args {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
        type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
              }
            }
          }
        }
      }
    }
  }
`;

function unwrapType(
  type: TypeRef | null | undefined
) {
  let current =
    type || null;

  while (
    current &&
    (current.kind === "NON_NULL" ||
      current.kind === "LIST")
  ) {
    current =
      current.ofType || null;
  }

  return {
    kind:
      String(
        current?.kind || ""
      ),
    name:
      String(
        current?.name || ""
      ),
  };
}

function scalarLike(
  kind: string
) {
  return (
    kind === "SCALAR" ||
    kind === "ENUM"
  );
}

async function getTypeInfo(
  accessToken: string,
  typeName: string,
  cache:
    Map<string, TypeInfo>
) {
  if (
    cache.has(typeName)
  ) {
    return cache.get(
      typeName
    )!;
  }

  const data =
    await graphql(
      accessToken,
      TYPE_SCHEMA,
      {
        name: typeName,
      }
    );

  const info =
    (data?.__type ||
      {}) as TypeInfo;

  cache.set(
    typeName,
    info
  );

  return info;
}

async function buildScalarSelection(
  accessToken: string,
  typeName: string,
  cache:
    Map<string, TypeInfo>,
  depth = 0
): Promise<string[]> {
  const info =
    await getTypeInfo(
      accessToken,
      typeName,
      cache
    );

  const fields =
    Array.isArray(
      info?.fields
    )
      ? info.fields
      : [];

  const result:
    string[] = [];

  for (
    const field of fields
  ) {
    const name =
      String(
        field?.name || ""
      ).trim();

    if (!name) {
      continue;
    }

    if (
      Array.isArray(
        field?.args
      ) &&
      field.args.length > 0
    ) {
      continue;
    }

    const unwrapped =
      unwrapType(
        field?.type
      );

    if (
      scalarLike(
        unwrapped.kind
      )
    ) {
      result.push(name);
      continue;
    }

    if (
      depth >= 1 ||
      !unwrapped.name
    ) {
      continue;
    }

    const fieldName =
      name.toLowerCase();

    if (
      ![
        "currency",
        "payment",
        "settings",
      ].some(
        (part) =>
          fieldName.includes(
            part
          )
      )
    ) {
      continue;
    }

    const nested =
      await buildScalarSelection(
        accessToken,
        unwrapped.name,
        cache,
        depth + 1
      );

    if (
      nested.length > 0
    ) {
      result.push(
        `${name} { ${nested
          .slice(0, 16)
          .join(" ")} }`
      );
    }
  }

  return result
    .slice(0, 35);
}

async function dynamicReadList(
  accessToken: string,
  fieldName: string
) {
  const schema =
    await graphql(
      accessToken,
      QUERY_SCHEMA
    );

  const queryFields =
    Array.isArray(
      schema?.__type?.fields
    )
      ? schema.__type.fields
      : [];

  const field =
    queryFields.find(
      (item: any) =>
        item?.name ===
        fieldName
    );

  if (!field) {
    return {
      success: false,
      data: [],
      error:
        `${fieldName} bulunamadı.`,
    };
  }

  const requiredArgs =
    (
      Array.isArray(
        field?.args
      )
        ? field.args
        : []
    ).filter(
      (arg: any) =>
        arg?.type?.kind ===
        "NON_NULL"
    );

  if (
    requiredArgs.length > 0
  ) {
    return {
      success: false,
      data: [],
      error:
        `${fieldName} zorunlu argüman istiyor.`,
    };
  }

  const returnType =
    unwrapType(
      field?.type
    );

  if (!returnType.name) {
    return {
      success: false,
      data: [],
      error:
        `${fieldName} dönüş tipi çözülemedi.`,
    };
  }

  const cache =
    new Map<
      string,
      TypeInfo
    >();

  const selection =
    await buildScalarSelection(
      accessToken,
      returnType.name,
      cache
    );

  if (
    selection.length === 0
  ) {
    return {
      success: false,
      data: [],
      error:
        `${fieldName} için okunabilir alan bulunamadı.`,
    };
  }

  try {
    const data =
      await graphql(
        accessToken,
        `
          query CnetIkasDynamicRead {
            ${fieldName} {
              ${selection.join(
                "\n"
              )}
            }
          }
        `
      );

    const value =
      data?.[
        fieldName
      ];

    return {
      success: true,
      data:
        Array.isArray(value)
          ? value
          : value
          ? [value]
          : [],
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      error:
        error instanceof Error
          ? error.message
          : `${fieldName} okunamadı.`,
    };
  }
}

async function findRenewedSample(
  accessToken: string
) {
  const maxPages = 20;

  for (
    let page = 0;
    page < maxPages;
    page += 1
  ) {
    const data =
      await graphql(
        accessToken,
        SAMPLE_PRODUCT_QUERY,
        {
          pagination: {
            page,
            limit: 100,
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

    const renewed =
      items
        .filter(
          (item: any) =>
            isRenewed(item)
        )
        .sort(
          (
            a: any,
            b: any
          ) =>
            safeNumber(
              b?.totalStock
            ) -
            safeNumber(
              a?.totalStock
            )
        );

    if (
      renewed.length > 0
    ) {
      return renewed[0];
    }

    if (
      response?.hasNext !==
      true
    ) {
      break;
    }
  }

  return null;
}

async function readStockLocations(
  accessToken: string
) {
  const result =
    await dynamicReadList(
      accessToken,
      "listStockLocation"
    );

  return result;
}

async function readSalesChannels(
  accessToken: string
) {
  const list =
    await dynamicReadList(
      accessToken,
      "listSalesChannel"
    );

  if (
    list.success
  ) {
    return list;
  }

  return dynamicReadList(
    accessToken,
    "getSalesChannel"
  );
}

function buildLocationMap(
  items: any[]
) {
  const map:
    Record<string, string> = {};

  for (
    const item of items
  ) {
    const id =
      String(
        item?.id || ""
      ).trim();

    const name =
      String(
        item?.name ||
          item?.title ||
          item?.label ||
          id ||
          ""
      ).trim();

    if (id) {
      map[id] =
        name || id;
    }
  }

  return map;
}

function normalizeSample(
  product: any,
  locationMap:
    Record<string, string>
) {
  if (!product) {
    return null;
  }

  const variants =
    Array.isArray(
      product?.variants
    )
      ? product.variants
      : [];

  return {
    id:
      product?.id ||
      null,
    name:
      product?.name ||
      "",
    totalStock:
      safeNumber(
        product?.totalStock
      ),
    updatedAt:
      product?.updatedAt ||
      null,

    brand:
      product?.brand ||
      null,

    categories:
      Array.isArray(
        product?.categories
      )
        ? product.categories
        : [],

    variants:
      variants.map(
        (variant: any) => ({
          id:
            variant?.id ||
            null,
          sku:
            String(
              variant?.sku ||
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

          prices:
            Array.isArray(
              variant?.prices
            )
              ? variant.prices
              : [],

          stocks:
            (
              Array.isArray(
                variant?.stocks
              )
                ? variant.stocks
                : []
            ).map(
              (stock: any) => ({
                ...stock,
                stockLocationName:
                  locationMap[
                    String(
                      stock?.stockLocationId ||
                        ""
                    )
                  ] ||
                  null,
              })
            ),

          stockCount:
            (
              Array.isArray(
                variant?.stocks
              )
                ? variant.stocks
                : []
            ).reduce(
              (
                sum: number,
                stock: any
              ) =>
                sum +
                safeNumber(
                  stock?.stockCount
                ),
              0
            ),
        })
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

    const [
      stockLocations,
      salesChannels,
      sampleProductRaw,
    ] =
      await Promise.all([
        readStockLocations(
          accessToken
        ),
        readSalesChannels(
          accessToken
        ),
        findRenewedSample(
          accessToken
        ),
      ]);

    const locationItems =
      Array.isArray(
        stockLocations.data
      )
        ? stockLocations.data
        : [];

    const locationMap =
      buildLocationMap(
        locationItems
      );

    const sampleProduct =
      normalizeSample(
        sampleProductRaw,
        locationMap
      );

    const priceRows =
      sampleProduct
        ? sampleProduct.variants.flatMap(
            (variant: any) =>
              (
                Array.isArray(
                  variant?.prices
                )
                  ? variant.prices
                  : []
              ).map(
                (price: any) => ({
                  variantId:
                    variant?.id ||
                    null,
                  sku:
                    variant?.sku ||
                    "",
                  variantValues:
                    variant
                      ?.variantValues ||
                    [],
                  priceListId:
                    price
                      ?.priceListId ??
                    null,
                  sellPrice:
                    price
                      ?.sellPrice ??
                    null,
                  discountPrice:
                    price
                      ?.discountPrice ??
                    null,
                })
              )
          )
        : [];

    const stockRows =
      sampleProduct
        ? sampleProduct.variants.flatMap(
            (variant: any) =>
              (
                Array.isArray(
                  variant?.stocks
                )
                  ? variant.stocks
                  : []
              ).map(
                (stock: any) => ({
                  variantId:
                    variant?.id ||
                    null,
                  sku:
                    variant?.sku ||
                    "",
                  variantValues:
                    variant
                      ?.variantValues ||
                    [],
                  stockLocationId:
                    stock
                      ?.stockLocationId ??
                    null,
                  stockLocationName:
                    stock
                      ?.stockLocationName ??
                    null,
                  stockCount:
                    stock
                      ?.stockCount ??
                    0,
                })
              )
          )
        : [];

    return json({
      success: true,
      readOnly: true,
      message:
        "İkas ADIM 3.3 yenilenmiş ürün yapısı doğrulandı.",

      sampleProduct,

      priceRows,
      stockRows,

      stockLocations,
      salesChannels,

      analysis: {
        sampleFound:
          Boolean(
            sampleProduct
          ),

        productId:
          sampleProduct?.id ??
          null,

        productName:
          sampleProduct?.name ??
          null,

        brandId:
          sampleProduct?.brand
            ?.id ??
          null,

        brandName:
          sampleProduct?.brand
            ?.name ??
          null,

        categories:
          sampleProduct
            ?.categories ??
          [],

        variantCount:
          sampleProduct
            ?.variants
            ?.length ??
          0,

        priceRowCount:
          priceRows.length,

        stockRowCount:
          stockRows.length,

        stockLocationCount:
          locationItems.length,

        salesChannelCount:
          Array.isArray(
            salesChannels.data
          )
            ? salesChannels.data
                .length
            : 0,

        skuFilledCount:
          sampleProduct
            ? sampleProduct.variants.filter(
                (variant: any) =>
                  String(
                    variant?.sku ||
                      ""
                  ).trim()
              ).length
            : 0,

        note:
          "Bu adım sadece mevcut veriyi okur. İlk test ürünü henüz oluşturulmaz.",
      },

      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "IKAS PRODUCT STRUCTURE ERROR:",
      error
    );

    return json(
      {
        success: false,
        readOnly: true,
        error:
          error instanceof Error
            ? error.message
            : "İkas ürün yapısı doğrulanamadı.",
        checkedAt:
          new Date().toISOString(),
      },
      500
    );
  }
}
