// app/api/online/ikas/structure/route.ts
// CNETMOBIL - IKAS ADIM 3.2
// READ ONLY: Stok lokasyonlari + fiyat listeleri + urun attribute yapisi.
// HICBIR urun / stok / fiyat / siparis verisi DEGISTIRMEZ.
//
// Bu route GraphQL introspection kullanarak canli ikas hesabindaki
// gercek alanlari okur. Boylece field isimlerini tahmin etmeyiz.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasStructurePool: Pool | undefined;
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
  kind?: string | null;
  name?: string | null;
  fields?: FieldInfo[] | null;
  enumValues?: Array<{
    name?: string | null;
  }> | null;
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

  if (!global.cnetIkasStructurePool) {
    global.cnetIkasStructurePool =
      new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
  }

  return global.cnetIkasStructurePool;
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

    const a = Buffer.from(
      signature,
      "utf8"
    );

    const b = Buffer.from(
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

function isScalarLike(
  kind: string
) {
  return (
    kind === "SCALAR" ||
    kind === "ENUM"
  );
}

const QUERY_SCHEMA = `
  query CnetIkasStructureQuerySchema {
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
  query CnetIkasStructureTypeSchema($name: String!) {
    __type(name: $name) {
      kind
      name
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
      enumValues {
        name
      }
    }
  }
`;

async function getTypeInfo(
  accessToken: string,
  typeName: string,
  cache:
    Map<string, TypeInfo>
) {
  if (cache.has(typeName)) {
    return cache.get(typeName)!;
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

function interestingNestedField(
  fieldName: string
) {
  const value =
    fieldName.toLowerCase();

  return [
    "value",
    "option",
    "attribute",
    "location",
    "currency",
    "channel",
  ].some(
    (key) =>
      value.includes(key)
  );
}

async function buildSelection(
  accessToken: string,
  typeName: string,
  cache:
    Map<string, TypeInfo>,
  depth = 0,
  visited =
    new Set<string>()
): Promise<string[]> {
  if (
    !typeName ||
    visited.has(typeName)
  ) {
    return [];
  }

  const nextVisited =
    new Set(visited);

  nextVisited.add(
    typeName
  );

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
    const fieldName =
      String(
        field?.name || ""
      ).trim();

    if (!fieldName) {
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
      isScalarLike(
        unwrapped.kind
      )
    ) {
      result.push(
        fieldName
      );

      continue;
    }

    if (
      depth >= 1 ||
      !interestingNestedField(
        fieldName
      ) ||
      !unwrapped.name
    ) {
      continue;
    }

    const nested =
      await buildSelection(
        accessToken,
        unwrapped.name,
        cache,
        depth + 1,
        nextVisited
      );

    if (
      nested.length > 0
    ) {
      result.push(
        `${fieldName} { ${nested
          .slice(0, 18)
          .join(" ")} }`
      );
    }
  }

  return result
    .slice(0, 35);
}

function normalizeSearchText(
  value: unknown
) {
  return String(
    value ?? ""
  )
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

function deepText(
  value: unknown
) {
  try {
    return normalizeSearchText(
      JSON.stringify(
        value
      )
    );
  } catch {
    return normalizeSearchText(
      value
    );
  }
}

function candidateMatches(
  items: unknown[],
  keywords: string[]
) {
  return items.filter(
    (item) => {
      const text =
        deepText(item);

      return keywords.some(
        (keyword) =>
          text.includes(
            normalizeSearchText(
              keyword
            )
          )
      );
    }
  );
}

async function fetchDynamicList(
  accessToken: string,
  queryFieldName: string,
  queryFields:
    FieldInfo[],
  typeCache:
    Map<string, TypeInfo>
) {
  const queryField =
    queryFields.find(
      (field) =>
        field?.name ===
        queryFieldName
    );

  if (!queryField) {
    return {
      success: false,
      queryField:
        queryFieldName,
      returnType: null,
      selection: [],
      data: [],
      error:
        `${queryFieldName} Query alanında bulunamadı.`,
    };
  }

  const requiredArgs =
    (
      Array.isArray(
        queryField.args
      )
        ? queryField.args
        : []
    ).filter(
      (arg) =>
        arg?.type?.kind ===
        "NON_NULL"
    );

  if (
    requiredArgs.length > 0
  ) {
    return {
      success: false,
      queryField:
        queryFieldName,
      returnType:
        unwrapType(
          queryField.type
        ).name,
      selection: [],
      data: [],
      error:
        `${queryFieldName} zorunlu argüman istiyor: ${requiredArgs
          .map(
            (arg) =>
              arg?.name
          )
          .join(", ")}`,
    };
  }

  const returnType =
    unwrapType(
      queryField.type
    );

  if (!returnType.name) {
    return {
      success: false,
      queryField:
        queryFieldName,
      returnType: null,
      selection: [],
      data: [],
      error:
        `${queryFieldName} dönüş tipi çözülemedi.`,
    };
  }

  const selection =
    await buildSelection(
      accessToken,
      returnType.name,
      typeCache
    );

  if (
    selection.length === 0
  ) {
    return {
      success: false,
      queryField:
        queryFieldName,
      returnType:
        returnType.name,
      selection: [],
      data: [],
      error:
        `${returnType.name} için okunabilir scalar alan bulunamadı.`,
    };
  }

  const query = `
    query CnetIkasDynamicStructureRead {
      ${queryFieldName} {
        ${selection.join(
          "\n"
        )}
      }
    }
  `;

  try {
    const data =
      await graphql(
        accessToken,
        query
      );

    const value =
      data?.[
        queryFieldName
      ];

    const list =
      Array.isArray(value)
        ? value
        : value
        ? [value]
        : [];

    return {
      success: true,
      queryField:
        queryFieldName,
      returnType:
        returnType.name,
      selection,
      data: list,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      queryField:
        queryFieldName,
      returnType:
        returnType.name,
      selection,
      data: [],
      error:
        error instanceof Error
          ? error.message
          : `${queryFieldName} okunamadı.`,
    };
  }
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

    const schemaData =
      await graphql(
        accessToken,
        QUERY_SCHEMA
      );

    const queryFields =
      Array.isArray(
        schemaData?.__type
          ?.fields
      )
        ? schemaData.__type
            .fields
        : [];

    const typeCache =
      new Map<
        string,
        TypeInfo
      >();

    const [
      stockLocations,
      priceLists,
      productAttributes,
      productStockLocations,
    ] =
      await Promise.all([
        fetchDynamicList(
          accessToken,
          "listStockLocation",
          queryFields,
          typeCache
        ),
        fetchDynamicList(
          accessToken,
          "listPriceList",
          queryFields,
          typeCache
        ),
        fetchDynamicList(
          accessToken,
          "listProductAttribute",
          queryFields,
          typeCache
        ),
        fetchDynamicList(
          accessToken,
          "listProductStockLocation",
          queryFields,
          typeCache
        ),
      ]);

    const attributeItems =
      Array.isArray(
        productAttributes.data
      )
        ? productAttributes.data
        : [];

    const gradeCandidates =
      candidateMatches(
        attributeItems,
        [
          "grade",
          "kalite",
          "mükemmel",
          "mukemmel",
          "çok iyi",
          "cok iyi",
          "iyi",
          "kondisyon",
        ]
      );

    const warrantyCandidates =
      candidateMatches(
        attributeItems,
        [
          "garanti",
          "warranty",
          "ay garant",
          "12 ay",
          "6 ay",
          "24 ay",
        ]
      );

    return json({
      success: true,
      readOnly: true,
      message:
        "İkas stok lokasyonu, fiyat listesi ve ürün attribute yapısı okundu.",

      stockLocations,
      productStockLocations,
      priceLists,
      productAttributes,

      analysis: {
        stockLocationCount:
          stockLocations.data
            .length,
        productStockLocationCount:
          productStockLocations
            .data.length,
        priceListCount:
          priceLists.data
            .length,
        productAttributeCount:
          productAttributes
            .data.length,

        gradeCandidateCount:
          gradeCandidates.length,
        warrantyCandidateCount:
          warrantyCandidates.length,

        gradeCandidates,
        warrantyCandidates,

        note:
          "Grade/Garanti adayları sadece mevcut İkas attribute kayıtlarında kelime eşleşmesiyle tespit edildi. Henüz hiçbir alan oluşturulmadı.",
      },

      next:
        "Bu sonuçla stok lokasyonu, fiyat listesi ve Grade/Garanti modelini kesinleştirip ürün oluşturma taslağına geçebiliriz.",

      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "IKAS STRUCTURE ERROR:",
      error
    );

    return json(
      {
        success: false,
        readOnly: true,
        error:
          error instanceof Error
            ? error.message
            : "İkas yapı bilgileri okunamadı.",
        checkedAt:
          new Date().toISOString(),
      },
      500
    );
  }
}
