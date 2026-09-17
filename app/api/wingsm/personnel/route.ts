// app/api/wingsm/personnel/route.ts
//
// CNETMOBIL - WingSM personel listesi (PostgreSQL cache)
// - WingSM'e is verisi YAZMAZ.
// - Bu endpoint SADECE public.wingsm_personnel tablosunu okur.
// - Paratika "Islemi Yapan Personel" dropdown'u buradan beslenecek.
// - Yalnizca active=true kayitlar doner.
// - Magaza filtresi YOKTUR: WingSM'deki tum personeller listelenir.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Pool,
} from "pg";

import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  var cnetWingSMPersonnelPool:
    | Pool
    | undefined;
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
      .cnetWingSMPersonnelPool
  ) {
    global.cnetWingSMPersonnelPool =
      new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis:
          30_000,
        connectionTimeoutMillis:
          10_000,
      });
  }

  return global
    .cnetWingSMPersonnelPool;
}

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
      },
    }
  );
}

function getSessionSecret() {
  const secret =
    String(
      process.env
        .SESSION_SECRET ||
        ""
    ).trim();

  if (!secret) {
    throw new Error(
      "SESSION_SECRET bulunamadı."
    );
  }

  return secret;
}

function verifySession(
  token: string
): SessionPayload | null {
  try {
    const [
      encoded,
      signature,
    ] =
      token.split(".");

    if (
      !encoded ||
      !signature
    ) {
      return null;
    }

    const expectedSignature =
      crypto
        .createHmac(
          "sha256",
          getSessionSecret()
        )
        .update(
          encoded
        )
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
        expectedSignature,
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
      !payload ||
      !payload.exp ||
      payload.exp <
        Math.floor(
          Date.now() /
            1000
        ) ||
      ![
        "admin",
        "personel",
      ].includes(
        payload.role
      ) ||
      typeof payload.branch !==
        "string"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function requireSession(
  request: NextRequest
) {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return {
      ok: false as const,
      response:
        json(
          {
            success:
              false,
            message:
              "Oturum bulunamadı.",
          },
          401
        ),
    };
  }

  const session =
    verifySession(
      token
    );

  if (!session) {
    return {
      ok: false as const,
      response:
        json(
          {
            success:
              false,
            message:
              "Oturum geçersiz veya süresi dolmuş.",
          },
          401
        ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}

export async function GET(
  request: NextRequest
) {
  const startedAt =
    Date.now();

  try {
    const auth =
      requireSession(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    const pool =
      getPool();

    const result =
      await pool.query(
        `
          SELECT
            code,
            name,
            active,
            last_seen_at,
            updated_at
          FROM public.wingsm_personnel
          WHERE active = TRUE
          ORDER BY name ASC, code ASC
        `
      );

    const personnel =
      result.rows.map(
        (
          row
        ) => ({
          code:
            String(
              row.code ??
                ""
            ),
          name:
            String(
              row.name ??
                ""
            ),
        })
      );

    const metaResult =
      await pool.query(
        `
          SELECT
            MAX(last_seen_at) AS last_sync_at,
            COUNT(*) FILTER (
              WHERE active = TRUE
            )::int AS active_count,
            COUNT(*) FILTER (
              WHERE active = FALSE
            )::int AS inactive_count
          FROM public.wingsm_personnel
        `
      );

    const meta =
      metaResult
        .rows[0] ||
      {};

    return json({
      success: true,

      source:
        "POSTGRESQL_WINGSM_CACHE",

      count:
        personnel.length,

      personnel,

      lastSyncAt:
        meta.last_sync_at ||
        null,

      activeCount:
        Number(
          meta.active_count ||
            0
        ),

      inactiveCount:
        Number(
          meta.inactive_count ||
            0
        ),

      responseTimeMs:
        Date.now() -
        startedAt,
    });
  } catch (
    error
  ) {
    console.error(
      "WINGSM PERSONNEL DB ERROR:",
      error
    );

    return json(
      {
        success:
          false,

        message:
          error instanceof
          Error
            ? error.message
            : "WingSM personel listesi okunamadı.",
      },
      500
    );
  }
}
