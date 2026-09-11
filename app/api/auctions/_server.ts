import { Pool, PoolClient } from "pg";
import crypto from "crypto";

declare global {
  // eslint-disable-next-line no-var
  var cnetAuctionPool: Pool | undefined;
}

const COOKIE_NAME = "cnet_auth";

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

export type AuctionSession = {
  success: true;
  role: string;
  branch: string;
  userKey: string;
  userName: string;
  isAdmin: boolean;
  channel: "CMR" | "VODAFONE" | null;
};

// ======================================================
// POSTGRESQL
// ======================================================

export function getAuctionPool() {
  if (global.cnetAuctionPool) {
    return global.cnetAuctionPool;
  }

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("DATABASE_URL bulunamadı.");
  }

  global.cnetAuctionPool = new Pool({
    connectionString,
    max: 8,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });

  return global.cnetAuctionPool;
}

// ======================================================
// SESSION
// ======================================================

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET bulunamadı.");
  }

  return secret;
}

function verifySession(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");

    if (!encoded || !signature) {
      return null;
    }

    const expectedSignature = crypto
      .createHmac("sha256", getSessionSecret())
      .update(encoded)
      .digest("base64url");

    const signatureBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    if (signatureBuffer.length !== expectedBuffer.length) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        signatureBuffer,
        expectedBuffer
      )
    ) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;

    if (
      !payload ||
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000) ||
      !["admin", "personel"].includes(payload.role) ||
      typeof payload.branch !== "string"
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ======================================================
// METİN
// ======================================================

function normalizeText(
  value: unknown,
  max = 180
) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

export function cleanAuctionText(
  value: unknown,
  max = 180
) {
  return normalizeText(value, max);
}

// ======================================================
// SAYI
// ======================================================

export function numberValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  const raw = String(value ?? "").trim();

  if (!raw) {
    return NaN;
  }

  let normalized = raw;

  if (
    raw.includes(".") &&
    raw.includes(",")
  ) {
    normalized = raw
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (raw.includes(",")) {
    normalized = raw.replace(",", ".");
  }

  const result = Number(normalized);

  return Number.isFinite(result)
    ? result
    : NaN;
}

// ======================================================
// KANAL
// ======================================================

function getChannel(
  branch: string
): "CMR" | "VODAFONE" | null {
  const upper =
    branch
      .trim()
      .toLocaleUpperCase("tr-TR");

  if (upper === "VODAFONE KANALI") {
    return "VODAFONE";
  }

  if (
    upper === "CMR" ||
    upper.startsWith("CMR ")
  ) {
    return "CMR";
  }

  return null;
}

// ======================================================
// OTURUMU DOĞRUDAN COOKIE'DEN OKU
// ======================================================

export async function getAuctionSession(
  request: Request
): Promise<AuctionSession> {
  const cookieHeader =
    request.headers.get("cookie") || "";

  const cookies = cookieHeader
    .split(";")
    .map((item) => item.trim());

  const authCookie = cookies.find((item) =>
    item.startsWith(`${COOKIE_NAME}=`)
  );

  if (!authCookie) {
    throw Object.assign(
      new Error("Oturum bulunamadı. Tekrar giriş yapın."),
      {
        status: 401,
      }
    );
  }

  const token = decodeURIComponent(
    authCookie.substring(
      COOKIE_NAME.length + 1
    )
  );

  const session =
    verifySession(token);

  if (!session) {
    throw Object.assign(
      new Error(
        "Oturum doğrulanamadı. Tekrar giriş yapın."
      ),
      {
        status: 401,
      }
    );
  }

  // ==========================================
  // POSTGRESQL KULLANICISI
  // ==========================================

  if (session.userId) {
    const pool =
      getAuctionPool();

    const result =
      await pool.query(
        `
          SELECT
            id,
            username,
            email,
            branch,
            role,
            active

          FROM public.users

          WHERE id = $1

          LIMIT 1
        `,
        [session.userId]
      );

    const user =
      result.rows[0];

    if (!user || !user.active) {
      throw Object.assign(
        new Error(
          "Kullanıcı hesabı aktif değil."
        ),
        {
          status: 401,
        }
      );
    }

    const branch =
      normalizeText(
        user.branch,
        120
      );

    const role =
      normalizeText(
        user.role,
        40
      );

    const userName =
      normalizeText(
        user.username ||
          user.email ||
          branch,
        160
      );

    return {
      success: true,

      role:
        role === "admin"
          ? "yonetici"
          : "personel",

      branch,

      userKey:
        String(user.id),

      userName,

      isAdmin:
        role === "admin",

      channel:
        getChannel(branch),
    };
  }

  // ==========================================
  // LEGACY ENV OTURUMU
  // ==========================================

  const branch =
    normalizeText(
      session.branch,
      120
    );

  const isAdmin =
    session.role === "admin";

  return {
    success: true,

    role:
      isAdmin
        ? "yonetici"
        : "personel",

    branch,

    userKey:
      `LEGACY:${session.role}:${branch.toLocaleUpperCase(
        "tr-TR"
      )}`,

    userName:
      branch,

    isAdmin,

    channel:
      getChannel(branch),
  };
}

// ======================================================
// YETKİ
// ======================================================

export function ensureAuctionAccess(
  session: AuctionSession
) {
  if (session.isAdmin) {
    return;
  }

  if (!session.channel) {
    throw Object.assign(
      new Error(
        "İhale sadece CMR ve Vodafone kullanıcılarına açıktır."
      ),
      {
        status: 403,
      }
    );
  }
}

export function ensureAdmin(
  session: AuctionSession
) {
  if (!session.isAdmin) {
    throw Object.assign(
      new Error(
        "Bu işlem sadece yönetici tarafından yapılabilir."
      ),
      {
        status: 403,
      }
    );
  }
}

// ======================================================
// KAPSAM
// ======================================================

export function auctionScopeAllowed(
  scope: string,
  channel: "CMR" | "VODAFONE" | null
) {
  if (!channel) {
    return false;
  }

  return (
    scope === "BOTH" ||
    scope === channel
  );
}

// ======================================================
// SÜRESİ DOLAN İHALELER
// ======================================================

export async function closeExpiredAuctions() {
  const pool =
    getAuctionPool();

  await pool.query(`
    WITH expired AS (
      UPDATE public.auctions

      SET
        status = 'ENDED',
        paused_at = NULL,
        updated_at = NOW()

      WHERE
        status = 'LIVE'
        AND ends_at IS NOT NULL
        AND ends_at <= NOW()

      RETURNING id
    )

    INSERT INTO public.auction_events (
      auction_id,
      event_type,
      actor_name,
      new_value
    )

    SELECT
      id,
      'ENDED',
      'SYSTEM',
      jsonb_build_object(
        'reason',
        'TIME_EXPIRED'
      )

    FROM expired
  `);
}

// ======================================================
// ANONİM KATILIMCI
// ======================================================

export async function getOrCreateParticipant(
  client: PoolClient,
  auctionId: number,
  session: AuctionSession
) {
  const existing =
    await client.query(
      `
        SELECT anonymous_code

        FROM public.auction_participants

        WHERE
          auction_id = $1
          AND bidder_user_id = $2

        LIMIT 1
      `,
      [
        auctionId,
        session.userKey,
      ]
    );

  if (
    existing.rows[0]?.anonymous_code
  ) {
    return String(
      existing.rows[0]
        .anonymous_code
    );
  }

  const countResult =
    await client.query(
      `
        SELECT
          COUNT(*)::int AS count

        FROM public.auction_participants

        WHERE auction_id = $1
      `,
      [auctionId]
    );

  const nextNumber =
    Number(
      countResult.rows[0]?.count || 0
    ) + 1;

  const anonymousCode =
    `Teklif #${String(
      nextNumber
    ).padStart(2, "0")}`;

  await client.query(
    `
      INSERT INTO public.auction_participants (
        auction_id,
        bidder_user_id,
        bidder_name,
        bidder_branch,
        anonymous_code
      )

      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5
      )
    `,
    [
      auctionId,
      session.userKey,
      session.userName,
      session.branch,
      anonymousCode,
    ]
  );

  return anonymousCode;
}

// ======================================================
// ERROR
// ======================================================

export function apiError(error: any) {
  const status =
    Number(
      error?.status || 500
    );

  console.error(
    "IHALE_API_ERROR:",
    {
      message:
        error?.message,

      stack:
        error?.stack,

      code:
        error?.code,

      detail:
        error?.detail,
    }
  );

  return Response.json(
    {
      ok: false,

      error:
        error?.message ||
        "İhale işlemi sırasında sunucu hatası oluştu.",

      debug:
        status >= 500
          ? {
              code:
                error?.code || null,

              detail:
                error?.detail || null,
            }
          : undefined,
    },
    {
      status,

      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );
}
