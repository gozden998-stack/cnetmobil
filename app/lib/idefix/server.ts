// app/lib/idefix/server.ts
// CNETMOBIL - IDEFIX ortak server yardımcıları
// API KEY / SECRET sadece server tarafında kalır.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Pool,
} from "pg";

import crypto from "crypto";

export const IDEFIX_BASE_URL =
  "https://merchantapi.idefix.com";

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
  var cnetIdefixSharedPool:
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

export function getIdefixDbPool() {
  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  if (
    !global
      .cnetIdefixSharedPool
  ) {
    global
      .cnetIdefixSharedPool =
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
    .cnetIdefixSharedPool;
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

export async function requireIdefixSuperAdmin(
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
    await getIdefixDbPool().query(
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

function getRequiredEnv(
  name: string
) {
  const value =
    String(
      process.env[name] ||
        ""
    ).trim();

  if (!value) {
    throw new Error(
      `${name} bulunamadı.`
    );
  }

  return value;
}

export function getIdefixVendorId() {
  return getRequiredEnv(
    "IDEFIX_VENDOR_ID"
  );
}

export function getIdefixVendorToken() {
  const apiKey =
    getRequiredEnv(
      "IDEFIX_API_KEY"
    );

  const apiSecret =
    getRequiredEnv(
      "IDEFIX_API_SECRET"
    );

  return Buffer.from(
    `${apiKey}:${apiSecret}`,
    "utf8"
  ).toString(
    "base64"
  );
}

export async function idefixFetch(
  path: string,
  options: {
    method?:
      | "GET"
      | "POST"
      | "PUT"
      | "PATCH"
      | "DELETE";
    body?: unknown;
    timeoutMs?: number;
  } = {}
) {
  const token =
    getIdefixVendorToken();

  const controller =
    new AbortController();

  const timeoutId =
    setTimeout(
      () =>
        controller.abort(),
      options.timeoutMs ??
        35_000
    );

  try {
    const response =
      await fetch(
        `${IDEFIX_BASE_URL}${path}`,
        {
          method:
            options.method ??
            "GET",
          cache:
            "no-store",
          headers: {
            Accept:
              "application/json",
            "Content-Type":
              "application/json",
            "X-API-KEY":
              token,
          },
          body:
            options.body !==
            undefined
              ? JSON.stringify(
                  options.body
                )
              : undefined,
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
      payload =
        raw || null;
    }

    if (
      !response.ok
    ) {
      const message =
        payload?.message ||
        payload?.error ||
        payload?.errors?.[0]
          ?.message ||
        `İdefix HTTP ${response.status}`;

      throw new Error(
        String(message)
      );
    }

    return payload;
  } finally {
    clearTimeout(
      timeoutId
    );
  }
}

export async function getIdefixProducts(
  page = 1,
  limit = 1
) {
  const vendorId =
    getIdefixVendorId();

  const params =
    new URLSearchParams();

  params.set(
    "page",
    String(page)
  );

  params.set(
    "limit",
    String(limit)
  );

  return idefixFetch(
    `/pim/pool/${encodeURIComponent(
      vendorId
    )}/list?${params.toString()}`
  );
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
