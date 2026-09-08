// app/api/online/ikas/discover/route.ts
// CNETMOBIL - IKAS ADIM 2 / READ ONLY KESIF
// HICBIR URUN / STOK / SIPARIS VERISI DEGISTIRMEZ.
// Amac: canli ikas GraphQL semasindan urun, varyant, stok, kategori,
// marka, satis kanali ve merchant alanlarini kesin olarak kesfetmek.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasDiscoverPool: Pool | undefined;
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

type GraphQLTypeRef = {
  kind?: string | null;
  name?: string | null;
  ofType?: GraphQLTypeRef | null;
};

type GraphQLFieldInfo = {
  name?: string;
  args?: Array<{
    name?: string;
    defaultValue?: string | null;
    type?: GraphQLTypeRef | null;
  }>;
  type?: GraphQLTypeRef | null;
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

  if (!global.cnetIkasDiscoverPool) {
    global.cnetIkasDiscoverPool =
      new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
  }

  return global.cnetIkasDiscoverPool;
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

    const payload = JSON.parse(
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
      "IKAS_CLIENT_ID Coolify ENV'de bulunamadı."
    );
  }

  if (!clientSecret) {
    throw new Error(
      "IKAS_CLIENT_SECRET Coolify ENV'de bulunamadı."
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
    clearTimeout(
      timeoutId
    );
  }
}

async function ikasGraphql(
  accessToken: string,
  query: string,
  variables: Record<string, unknown> = {}
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () => controller.abort(),
      20_000
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
    clearTimeout(
      timeoutId
    );
  }
}

function unwrapType(
  type: GraphQLTypeRef | null | undefined
) {
  let current =
    type || null;

  const wrappers: string[] = [];

  while (current) {
    if (
      current.kind === "NON_NULL" ||
      current.kind === "LIST"
    ) {
      wrappers.push(
        String(current.kind)
      );

      current =
        current.ofType || null;

      continue;
    }

    break;
  }

  return {
    name:
      String(
        current?.name || ""
      ).trim(),
    kind:
      String(
        current?.kind || ""
      ).trim(),
    wrappers,
  };
}

function typeRefToText(
  type: GraphQLTypeRef | null | undefined
): string {
  if (!type) {
    return "";
  }

  if (type.kind === "NON_NULL") {
    return `${typeRefToText(
      type.ofType
    )}!`;
  }

  if (type.kind === "LIST") {
    return `[${typeRefToText(
      type.ofType
    )}]`;
  }

  return String(
    type.name || type.kind || ""
  );
}

const QUERY_INTROSPECTION = `
  query CnetIkasQueryDiscovery {
    __type(name: "Query") {
      name
      fields {
        name
        description
        args {
          name
          defaultValue
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

const TYPE_INTROSPECTION = `
  query CnetIkasTypeDiscovery($name: String!) {
    __type(name: $name) {
      kind
      name
      description
      fields {
        name
        description
        args {
          name
          defaultValue
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
      inputFields {
        name
        description
        defaultValue
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
      enumValues {
        name
        description
      }
    }
  }
`;

const SCHEMA_TYPE_NAMES_QUERY = `
  query CnetIkasTypeNames {
    __schema {
      types {
        kind
        name
      }
    }
  }
`;

const MERCHANT_SETTINGS_QUERY = `
  query CnetIkasMerchantSettings {
    listMerchantSettings {
      id
      merchantName
      currencyCode
      currencySymbol
      defaultLocale
      timezone
    }
  }
`;

function isRelevantName(
  value: unknown
) {
  const text =
    String(
      value || ""
    ).toLowerCase();

  const keys = [
    "product",
    "variant",
    "stock",
    "inventory",
    "warehouse",
    "location",
    "merchant",
    "category",
    "brand",
    "price",
    "saleschannel",
    "sales_channel",
    "order",
  ];

  return keys.some(
    (key) =>
      text.includes(key)
  );
}

function normalizeField(
  field: GraphQLFieldInfo
) {
  const returnType =
    unwrapType(field.type);

  return {
    name:
      String(
        field.name || ""
      ),
    returnType:
      typeRefToText(
        field.type
      ),
    returnNamedType:
      returnType.name,
    args:
      Array.isArray(
        field.args
      )
        ? field.args.map(
            (arg) => ({
              name:
                String(
                  arg.name || ""
                ),
              type:
                typeRefToText(
                  arg.type
                ),
              defaultValue:
                arg.defaultValue ??
                null,
            })
          )
        : [],
  };
}

async function safeMerchantSettings(
  accessToken: string
) {
  try {
    const data =
      await ikasGraphql(
        accessToken,
        MERCHANT_SETTINGS_QUERY
      );

    return {
      success: true,
      data:
        data?.listMerchantSettings ??
        null,
      error: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Merchant ayarları okunamadı.",
    };
  }
}

async function discoverSchema(
  accessToken: string
) {
  const queryData =
    await ikasGraphql(
      accessToken,
      QUERY_INTROSPECTION
    );

  const allQueryFields =
    Array.isArray(
      queryData?.__type?.fields
    )
      ? queryData.__type.fields
      : [];

  const relevantQueryFields =
    allQueryFields
      .filter(
        (field: any) =>
          isRelevantName(
            field?.name
          )
      )
      .map(
        normalizeField
      );

  const typeNameData =
    await ikasGraphql(
      accessToken,
      SCHEMA_TYPE_NAMES_QUERY
    );

  const allTypeNames =
    Array.isArray(
      typeNameData?.__schema?.types
    )
      ? typeNameData.__schema.types
      : [];

  const relevantTypeNames =
    allTypeNames
      .filter(
        (item: any) =>
          item?.name &&
          !String(
            item.name
          ).startsWith("__") &&
          isRelevantName(
            item.name
          )
      )
      .map(
        (item: any) => ({
          kind:
            String(
              item.kind || ""
            ),
          name:
            String(
              item.name || ""
            ),
        })
      )
      .slice(0, 80);

  const directReturnTypeNames =
    Array.from(
      new Set(
        relevantQueryFields
          .map(
            (field: any) =>
              String(
                field.returnNamedType ||
                  ""
              )
          )
          .filter(Boolean)
      )
    );

  const priorityTypeNames =
    Array.from(
      new Set([
        ...directReturnTypeNames,
        ...relevantTypeNames
          .filter(
            (item: any) =>
              /product|variant|stock|inventory|warehouse|saleschannel|merchant/i.test(
                item.name
              )
          )
          .map(
            (item: any) =>
              item.name
          ),
      ])
    ).slice(0, 35);

  const typeDetails:
    Record<string, unknown> = {};

  for (
    const typeName of priorityTypeNames
  ) {
    try {
      const data =
        await ikasGraphql(
          accessToken,
          TYPE_INTROSPECTION,
          {
            name: typeName,
          }
        );

      const typeInfo =
        data?.__type;

      if (!typeInfo) {
        continue;
      }

      typeDetails[typeName] = {
        kind:
          typeInfo.kind,
        fields:
          Array.isArray(
            typeInfo.fields
          )
            ? typeInfo.fields.map(
                normalizeField
              )
            : [],
        inputFields:
          Array.isArray(
            typeInfo.inputFields
          )
            ? typeInfo.inputFields.map(
                (field: any) => ({
                  name:
                    String(
                      field?.name ||
                        ""
                    ),
                  type:
                    typeRefToText(
                      field?.type
                    ),
                  defaultValue:
                    field?.defaultValue ??
                    null,
                })
              )
            : [],
        enumValues:
          Array.isArray(
            typeInfo.enumValues
          )
            ? typeInfo.enumValues.map(
                (item: any) =>
                  String(
                    item?.name ||
                      ""
                  )
              )
            : [],
      };
    } catch (error) {
      typeDetails[typeName] = {
        error:
          error instanceof Error
            ? error.message
            : "Tip detayı alınamadı.",
      };
    }
  }

  return {
    queryFields:
      relevantQueryFields,
    relevantTypeNames,
    typeDetails,
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

    const merchant =
      await safeMerchantSettings(
        accessToken
      );

    let schema:
      | Record<string, unknown>
      | null = null;

    let schemaError:
      | string
      | null = null;

    try {
      schema =
        await discoverSchema(
          accessToken
        );
    } catch (error) {
      schemaError =
        error instanceof Error
          ? error.message
          : "GraphQL şema keşfi yapılamadı.";
    }

    return json({
      success: true,
      readOnly: true,
      connected: true,
      message:
        "ikas ADIM 2 read-only keşif tamamlandı.",
      merchant,
      schema,
      schemaError,
      next:
        "Bu JSON'daki listProduct / varyant / stok alanlarına göre ADIM 3 ürün-stok okuma route'u hazırlanacak.",
      security: {
        clientIdExposed: false,
        clientSecretExposed: false,
        accessTokenExposed: false,
      },
      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "IKAS DISCOVER ERROR:",
      error
    );

    return json(
      {
        success: false,
        readOnly: true,
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : "ikas keşif işlemi başarısız.",
        checkedAt:
          new Date().toISOString(),
      },
      500
    );
  }
}
