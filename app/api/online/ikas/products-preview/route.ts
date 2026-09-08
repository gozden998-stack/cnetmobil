// app/api/online/ikas/products-preview/route.ts
// CNETMOBIL - IKAS ADIM 3 / GERCEK URUN ORNEKLEME
// READ ONLY.
// Urun, varyant, SKU ve varyant degerlerini okur.
// HICBIR urun / stok / siparis verisi degistirmez.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasProductsPreviewPool: Pool | undefined;
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
    !global.cnetIkasProductsPreviewPool
  ) {
    global.cnetIkasProductsPreviewPool =
      new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });
  }

  return global
    .cnetIkasProductsPreviewPool;
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
    clearTimeout(
      timeoutId
    );
  }
}

async function graphql(
  accessToken: string,
  query: string
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

// Bu alanlar ikas'in resmi Product API orneklerinde mevcut:
// Product: id, name, description, updatedAt
// Variant: id, sku, variantValues
// VariantValue: variantTypeName, variantValueName
//
// Ozellikle ilk okumada stok/fiyat gibi alanlari zorlamiyoruz.
// Once magaza urun yapisini risksiz olarak goruyoruz.
const PRODUCT_PREVIEW_QUERY = `
  query CnetIkasProductPreview {
    listProduct {
      data {
        id
        name
        description
        updatedAt
        variants {
          id
          sku
          variantValues {
            variantTypeName
            variantValueName
          }
        }
      }
    }
  }
`;

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

    const data =
      await graphql(
        accessToken,
        PRODUCT_PREVIEW_QUERY
      );

    const allProducts =
      Array.isArray(
        data?.listProduct?.data
      )
        ? data.listProduct.data
        : [];

    // Ekranda yapıyı incelemek için ilk 10 gerçek ürün yeterli.
    const products =
      allProducts.slice(
        0,
        10
      );

    const summary = {
      returnedProductCount:
        allProducts.length,
      previewProductCount:
        products.length,
      previewVariantCount:
        products.reduce(
          (
            total: number,
            product: any
          ) =>
            total +
            (Array.isArray(
              product?.variants
            )
              ? product.variants
                  .length
              : 0),
          0
        ),
      productsWithVariants:
        products.filter(
          (product: any) =>
            Array.isArray(
              product?.variants
            ) &&
            product.variants
              .length > 0
        ).length,
    };

    return json({
      success: true,
      readOnly: true,
      message:
        "İkas gerçek ürün örnekleri okundu.",
      summary,
      products,
      next:
        "Ürün/varyant yapısı doğrulandıktan sonra stok lokasyonu, stok ve fiyat alanları okunacak.",
      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "IKAS PRODUCTS PREVIEW ERROR:",
      error
    );

    return json(
      {
        success: false,
        readOnly: true,
        error:
          error instanceof Error
            ? error.message
            : "İkas ürünleri okunamadı.",
        checkedAt:
          new Date().toISOString(),
      },
      500
    );
  }
}
