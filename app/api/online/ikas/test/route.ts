// app/api/online/ikas/test/route.ts
// CNETMOBIL - IKAS BAGLANTI TESTI
// READ ONLY.
// Client ID / Client Secret server-side Coolify ENV'den okunur.
// Access token kullaniciya kesinlikle dondurulmez.
// Sadece Super Admin erisebilir.

import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasTestPool: Pool | undefined;
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

  if (!global.cnetIkasTestPool) {
    global.cnetIkasTestPool =
      new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis:
          10_000,
      });
  }

  return global.cnetIkasTestPool;
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
      process.env.IKAS_CLIENT_ID ||
        ""
    ).trim();

  const clientSecret =
    String(
      process.env.IKAS_CLIENT_SECRET ||
        ""
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
        payload?.access_token ||
          ""
      ).trim();

    if (!accessToken) {
      throw new Error(
        "ikas token cevabında access_token bulunamadı."
      );
    }

    return {
      accessToken,
      tokenType:
        String(
          payload?.token_type ||
            "Bearer"
        ),
      expiresIn:
        Number(
          payload?.expires_in ||
            0
        ),
    };
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

async function testIkasGraphql(
  accessToken: string
) {
  const query = `
    query CnetIkasConnectionTest {
      me {
        id
      }
    }
  `;

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
      payload.errors.length >
        0
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

    const merchantId =
      String(
        payload?.data?.me?.id ||
          ""
      ).trim();

    if (!merchantId) {
      throw new Error(
        "ikas GraphQL bağlantısı kuruldu fakat me.id alınamadı."
      );
    }

    return {
      merchantId,
    };
  } finally {
    clearTimeout(
      timeoutId
    );
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

    const token =
      await getIkasAccessToken();

    const graphql =
      await testIkasGraphql(
        token.accessToken
      );

    return json({
      success: true,
      readOnly: true,
      connected: true,
      message:
        "ikas bağlantısı başarılı.",
      ikas: {
        merchantId:
          graphql.merchantId,
        tokenType:
          token.tokenType,
        tokenExpiresInSeconds:
          token.expiresIn,
        apiVersion: "v2",
      },
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
      "IKAS CONNECTION TEST ERROR:",
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
            : "ikas bağlantı testi başarısız.",
        checkedAt:
          new Date().toISOString(),
      },
      500
    );
  }
}
