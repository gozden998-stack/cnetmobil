// app/lib/ikas/server.ts
// CNETMOBIL - IKAS ortak server yardımcıları
// Client secret sadece server tarafında kalır.

import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  Pool,
} from "pg";
import crypto from "crypto";

export const IKAS_TOKEN_URL =
  "https://api.myikas.com/api/admin/oauth/token";

export const IKAS_GRAPHQL_URL =
  "https://api.myikas.com/api/v2/admin/graphql";

const COOKIE_NAME =
  "cnet_auth";

type SessionPayload = {
  userId: number | null;
  role:
    | "admin"
    | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var cnetIkasSharedPool:
    | Pool
    | undefined;
}

export function noStoreJson(
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

export function getIkasDbPool() {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  if (
    !global
      .cnetIkasSharedPool
  ) {
    global
      .cnetIkasSharedPool =
      new Pool({
        connectionString,
        max: 4,
        idleTimeoutMillis:
          30_000,
        connectionTimeoutMillis:
          10_000,
      });
  }

  return global
    .cnetIkasSharedPool;
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

export async function requireIkasSuperAdmin(
  request: NextRequest
) {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return noStoreJson(
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
    return noStoreJson(
      {
        success: false,
        error:
          "Geçersiz oturum.",
      },
      401
    );
  }

  const result =
    await getIkasDbPool().query(
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
    return noStoreJson(
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

export async function getIkasAccessToken() {
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

    const raw =
      await response.text();

    let payload:
      any = null;

    try {
      payload =
        raw
          ? JSON.parse(
              raw
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
          `İkas token HTTP ${response.status}`
      );
    }

    const token =
      String(
        payload
          ?.access_token ||
          ""
      ).trim();

    if (!token) {
      throw new Error(
        "İkas access_token alınamadı."
      );
    }

    return token;
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

export async function ikasGraphql(
  accessToken: string,
  query: string,
  variables:
    Record<
      string,
      unknown
    > = {},
  timeoutMs = 35_000
) {
  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      timeoutMs
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
            JSON.stringify({
              query,
              variables,
            }),
          signal:
            controller.signal,
        }
      );

    const raw =
      await response.text();

    let payload:
      any = null;

    try {
      payload =
        raw
          ? JSON.parse(
              raw
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
          `İkas GraphQL HTTP ${response.status}`
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
                item?.message ||
                  "GraphQL hata"
              )
          )
          .join(" | ")
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

export function numberOrNull(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() ===
      ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}
