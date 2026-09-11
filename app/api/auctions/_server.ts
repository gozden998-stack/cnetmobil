import { Pool, PoolClient } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var cnetAuctionPool: Pool | undefined;
}

export type AuctionSession = {
  success: true;
  role: string;
  branch: string;
  userKey: string;
  userName: string;
  isAdmin: boolean;
  channel: "CMR" | "VODAFONE" | null;
};

export function getAuctionPool() {
  if (global.cnetAuctionPool) return global.cnetAuctionPool;

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error("PostgreSQL bağlantı değişkeni bulunamadı.");
  }

  global.cnetAuctionPool = new Pool({
    connectionString,
    ssl:
      process.env.NODE_ENV === "production"
        ? { rejectUnauthorized: false }
        : undefined,
    max: 8,
    idleTimeoutMillis: 30_000,
  });

  return global.cnetAuctionPool;
}

function normalizeText(value: unknown, max = 180) {
  return String(value ?? "").trim().slice(0, max);
}

export function cleanAuctionText(value: unknown, max = 180) {
  return normalizeText(value, max);
}

export function numberValue(value: unknown) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");

  const n = Number(normalized);

  return Number.isFinite(n) ? n : NaN;
}

function getChannel(branch: string): "CMR" | "VODAFONE" | null {
  const upper = branch.toLocaleUpperCase("tr-TR");

  if (upper === "VODAFONE KANALI") return "VODAFONE";
  if (upper === "CMR" || upper.startsWith("CMR ")) return "CMR";

  return null;
}

export async function getAuctionSession(
  request: Request
): Promise<AuctionSession> {
  const authUrl = new URL("/api/auth", request.url);
  const cookie = request.headers.get("cookie") || "";

  const authResponse = await fetch(authUrl, {
    method: "GET",
    cache: "no-store",
    headers: {
      cookie,
      accept: "application/json",
    },
  });

  const session = await authResponse.json().catch(() => ({}));

  if (!authResponse.ok || !session?.success) {
    throw Object.assign(new Error("Oturum doğrulanamadı."), {
      status: 401,
    });
  }

  const role = normalizeText(session.role, 40);
  const branch = normalizeText(session.branch, 120);

  const rawUserKey =
    session.userId ??
    session.user_id ??
    session.id ??
    session.email ??
    session.user?.id ??
    session.user?.email ??
    "";

  const rawUserName =
    session.name ??
    session.fullName ??
    session.userName ??
    session.email ??
    session.user?.name ??
    session.user?.email ??
    branch;

  const isAdmin = role === "yonetici";

  const userKey =
    normalizeText(rawUserKey, 120) ||
    `BRANCH:${branch.toLocaleUpperCase("tr-TR")}`;

  const userName =
    normalizeText(rawUserName, 160) || branch;

  return {
    success: true,
    role,
    branch,
    userKey,
    userName,
    isAdmin,
    channel: getChannel(branch),
  };
}

export function ensureAuctionAccess(session: AuctionSession) {
  if (session.isAdmin) return;

  if (!session.channel) {
    throw Object.assign(
      new Error(
        "İhale sadece CMR ve Vodafone kullanıcılarına açıktır."
      ),
      { status: 403 }
    );
  }
}

export function ensureAdmin(session: AuctionSession) {
  if (!session.isAdmin) {
    throw Object.assign(
      new Error(
        "Bu işlem sadece yönetici tarafından yapılabilir."
      ),
      { status: 403 }
    );
  }
}

export function auctionScopeAllowed(
  scope: string,
  channel: "CMR" | "VODAFONE" | null
) {
  if (!channel) return false;

  return scope === "BOTH" || scope === channel;
}

export async function closeExpiredAuctions() {
  const pool = getAuctionPool();

  await pool.query(`
    WITH expired AS (
      UPDATE public.auctions
      SET
        status = 'ENDED',
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
      jsonb_build_object('reason', 'TIME_EXPIRED')
    FROM expired
  `);
}

export async function getOrCreateParticipant(
  client: PoolClient,
  auctionId: number,
  session: AuctionSession
) {
  const existing = await client.query(
    `
      SELECT anonymous_code
      FROM public.auction_participants
      WHERE auction_id = $1
        AND bidder_user_id = $2
      LIMIT 1
    `,
    [auctionId, session.userKey]
  );

  if (existing.rows[0]?.anonymous_code) {
    return String(existing.rows[0].anonymous_code);
  }

  const countResult = await client.query(
    `
      SELECT COUNT(*)::int AS count
      FROM public.auction_participants
      WHERE auction_id = $1
    `,
    [auctionId]
  );

  const nextNumber =
    Number(countResult.rows[0]?.count || 0) + 1;

  const anonymousCode =
    `Teklif #${String(nextNumber).padStart(2, "0")}`;

  await client.query(
    `
      INSERT INTO public.auction_participants (
        auction_id,
        bidder_user_id,
        bidder_name,
        bidder_branch,
        anonymous_code
      )
      VALUES ($1, $2, $3, $4, $5)
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

export function apiError(error: any) {
  const status = Number(error?.status || 500);

  return Response.json(
    {
      ok: false,
      error:
        status >= 500
          ? "İhale işlemi sırasında sunucu hatası oluştu."
          : error?.message || "İşlem yapılamadı.",
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
