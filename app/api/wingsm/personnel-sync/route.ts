// app/api/wingsm/personnel-sync/route.ts
//
// CNETMOBIL - WingSM PERSONEL SENKRONIZASYONU
//
// AMAÇ:
// WingSM WEB PORTAL
//   -> /HttpApiHizliSatis/HizliSatisInitilas
//   -> settings.ListSatici
//   -> PostgreSQL public.wingsm_personnel
//
// KURALLAR:
// - WingSM iş verisine YAZMAZ.
// - Stok / sipariş / transfer / ürün göndermez.
// - WingSM tarafında sadece GET yapar.
// - Authentication için portal session helper kullanılır.
// - Mevcut B2B WingSM entegrasyonuna DOKUNMAZ.
// - Kod her zaman STRING tutulur.
// - "0004" -> "4" OLMAZ.
// - WingSM'den kaybolan personeller active=false yapılır.
// - Eski kayıtlar silinmez.
//
// Kullanım:
// GET  /api/wingsm/personnel-sync
// POST /api/wingsm/personnel-sync
//
// Manuel kullanım:
// Panel admin session.
//
// Cron kullanım:
// Authorization: Bearer <WINGSM_PERSONNEL_SYNC_SECRET>
// veya
// x-sync-secret: <WINGSM_PERSONNEL_SYNC_SECRET>
//

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Pool,
  PoolClient,
} from "pg";

import crypto from "crypto";

import {
  wingSMPortalRequest,
} from "@/app/lib/wingsm/portal-server";

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

type WingSeller = {
  Id?: number | string | null;

  Kod?: string | number | null;

  Ad?: string | null;

  Sirket?: string | null;

  [key: string]: unknown;
};

type WingInitResponse = {
  success?: boolean;

  settings?: {
    ListSatici?: WingSeller[];

    [key: string]: unknown;
  };

  message?: string;

  error?: string;

  [key: string]: unknown;
};

type NormalizedSeller = {
  code: string;

  name: string;

  sourceId:
    | number
    | string
    | null;

  company:
    | string
    | null;

  raw: WingSeller;
};

declare global {
  // eslint-disable-next-line no-var
  var cnetWingSMPersonnelSyncPool:
    | Pool
    | undefined;
}

/* =========================================================
   JSON
========================================================= */

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

/* =========================================================
   POSTGRESQL
========================================================= */

function getPool() {
  const connectionString =
    String(
      process.env
        .DATABASE_URL ||
        ""
    ).trim();

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  if (
    !global
      .cnetWingSMPersonnelSyncPool
  ) {
    global
      .cnetWingSMPersonnelSyncPool =
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
    .cnetWingSMPersonnelSyncPool;
}

/* =========================================================
   CNET SESSION
========================================================= */

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

    const receivedBuffer =
      Buffer.from(
        signature,
        "utf8"
      );

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        "utf8"
      );

    if (
      receivedBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        receivedBuffer,
        expectedBuffer
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
      !payload.exp
    ) {
      return null;
    }

    const now =
      Math.floor(
        Date.now() /
          1000
      );

    if (
      payload.exp <
      now
    ) {
      return null;
    }

    if (
      ![
        "admin",
        "personel",
      ].includes(
        payload.role
      )
    ) {
      return null;
    }

    if (
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

/* =========================================================
   CRON SECRET
========================================================= */

function safeEqual(
  left: string,
  right: string
) {
  try {
    const a =
      Buffer.from(
        left,
        "utf8"
      );

    const b =
      Buffer.from(
        right,
        "utf8"
      );

    if (
      a.length !==
      b.length
    ) {
      return false;
    }

    return crypto
      .timingSafeEqual(
        a,
        b
      );
  } catch {
    return false;
  }
}

function hasValidSyncSecret(
  request: NextRequest
) {
  const expected =
    String(
      process.env
        .WINGSM_PERSONNEL_SYNC_SECRET ||
        ""
    ).trim();

  if (!expected) {
    return false;
  }

  const authorization =
    String(
      request.headers.get(
        "authorization"
      ) ||
        ""
    ).trim();

  let bearer = "";

  if (
    authorization
      .toLowerCase()
      .startsWith(
        "bearer "
      )
  ) {
    bearer =
      authorization
        .slice(7)
        .trim();
  }

  const headerSecret =
    String(
      request.headers.get(
        "x-sync-secret"
      ) ||
        ""
    ).trim();

  if (
    bearer &&
    safeEqual(
      bearer,
      expected
    )
  ) {
    return true;
  }

  if (
    headerSecret &&
    safeEqual(
      headerSecret,
      expected
    )
  ) {
    return true;
  }

  return false;
}

/* =========================================================
   REQUEST AUTH
========================================================= */

function authorize(
  request: NextRequest
) {
  /*
   * Cron / Coolify çağrısı
   */
  if (
    hasValidSyncSecret(
      request
    )
  ) {
    return {
      ok: true as const,

      source:
        "SYNC_SECRET",

      role:
        "system",
    };
  }

  /*
   * Manuel admin çağrısı
   */
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
              "Yetkisiz işlem.",
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

  /*
   * Personel manuel sync yapamasın.
   */
  if (
    session.role !==
    "admin"
  ) {
    return {
      ok: false as const,

      response:
        json(
          {
            success:
              false,

            message:
              "Bu işlem için admin yetkisi gerekli.",
          },
          403
        ),
    };
  }

  return {
    ok: true as const,

    source:
      "ADMIN_SESSION",

    role:
      session.role,

    session,
  };
}

/* =========================================================
   WINGSM TARİHİ
========================================================= */

function wingDateNumber() {
  /*
   * Coolify sunucusunun timezone'u ne olursa olsun
   * WingSM'e Türkiye tarihini gönderiyoruz.
   */

  const parts =
    new Intl
      .DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Europe/Istanbul",

          year:
            "numeric",

          month:
            "2-digit",

          day:
            "2-digit",
        }
      )
      .formatToParts(
        new Date()
      );

  const year =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (
        part
      ) =>
        part.type ===
        "day"
    )?.value;

  if (
    !year ||
    !month ||
    !day
  ) {
    throw new Error(
      "WingSM tarih değeri oluşturulamadı."
    );
  }

  return `${year}${month}${day}`;
}

/* =========================================================
   NORMALIZE
========================================================= */

function normalizePersonnel(
  rawList: WingSeller[]
) {
  const map =
    new Map<
      string,
      NormalizedSeller
    >();

  for (
    const row
    of rawList
  ) {
    /*
     * IMPORTANT:
     *
     * WingSM:
     * "0004"
     *
     * PostgreSQL:
     * "0004"
     *
     * Number'a ÇEVİRME.
     */
    const code =
      String(
        row?.Kod ??
          ""
      ).trim();

    const name =
      String(
        row?.Ad ??
          ""
      ).trim();

    if (
      !code ||
      !name
    ) {
      continue;
    }

    const companyRaw =
      row?.Sirket;

    const company =
      companyRaw ===
        null ||
      companyRaw ===
        undefined
        ? null
        : String(
            companyRaw
          ).trim() ||
          null;

    map.set(
      code,
      {
        code,

        name,

        sourceId:
          row?.Id ??
          null,

        company,

        raw:
          row,
      }
    );
  }

  return Array.from(
    map.values()
  );
}

/* =========================================================
   WINGSM PERSONEL LİSTESİ
========================================================= */

async function readWingSMPersonnel() {
  const tarihN =
    wingDateNumber();

  /*
   * Bu helper:
   *
   * 1) WingSM portal login
   * 2) session/cookie
   * 3) cookie ile request
   *
   * işlemlerini server-side yapıyor.
   *
   * B2B x-access-token kullanılmıyor.
   */
  const payload =
    await wingSMPortalRequest<WingInitResponse>(
      "/HttpApiHizliSatis/HizliSatisInitilas",
      {
        method:
          "GET",

        query: {
          TarihN:
            tarihN,

          /*
           * WingSM frontend ilk açılışta
           * Sirket=null gönderiyor.
           */
          Sirket:
            null,
        },
      }
    );

  const rawList =
    payload?.settings
      ?.ListSatici;

  if (
    !Array.isArray(
      rawList
    )
  ) {
    throw new Error(
      "WingSM cevabında settings.ListSatici bulunamadı."
    );
  }

  const personnel =
    normalizePersonnel(
      rawList
    );

  if (
    personnel.length ===
    0
  ) {
    throw new Error(
      "WingSM personel listesi boş döndü. Güvenlik nedeniyle PostgreSQL güncellenmedi."
    );
  }

  return {
    tarihN,

    rawCount:
      rawList.length,

    personnel,
  };
}

/* =========================================================
   DB SAFETY CHECK
========================================================= */

async function getCurrentActiveCount(
  client: PoolClient
) {
  const result =
    await client.query(
      `
        SELECT
          COUNT(*)::int AS count
        FROM public.wingsm_personnel
        WHERE active = TRUE
      `
    );

  return Number(
    result.rows[0]
      ?.count ||
      0
  );
}

function validateIncomingCount(
  incomingCount: number,
  previousActiveCount: number
) {
  /*
   * WingSM'de şu an yaklaşık 71 personel var.
   *
   * Eğer bir gün portal hata verip
   * örneğin sadece 2-3 kişi döndürürse,
   * kalan 68 kişiyi yanlışlıkla
   * active=false yapmayalım.
   */

  if (
    incomingCount <=
    0
  ) {
    throw new Error(
      "WingSM personel listesi boş."
    );
  }

  /*
   * İlk kurulum ise karşılaştırma yapma.
   */
  if (
    previousActiveCount <
    10
  ) {
    return;
  }

  const minimumSafeCount =
    Math.max(
      10,

      Math.floor(
        previousActiveCount *
          0.5
      )
    );

  if (
    incomingCount <
    minimumSafeCount
  ) {
    throw new Error(
      `WingSM personel sayısı beklenmedik şekilde düştü. ` +
        `Mevcut aktif: ${previousActiveCount}, ` +
        `WingSM'den gelen: ${incomingCount}. ` +
        `Güvenlik nedeniyle senkron iptal edildi.`
    );
  }
}

/* =========================================================
   DATABASE SYNC
========================================================= */

async function syncDatabase(
  personnel: NormalizedSeller[]
) {
  const pool =
    getPool();

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const previousActiveCount =
      await getCurrentActiveCount(
        client
      );

    validateIncomingCount(
      personnel.length,
      previousActiveCount
    );

    const syncTime =
      new Date();

    /*
     * Gelen kodları topluyoruz.
     */
    const activeCodes =
      personnel.map(
        (
          person
        ) =>
          person.code
      );

    let insertedOrUpdated =
      0;

    /*
     * Tek tek UPSERT.
     *
     * 71 kayıt olduğu için performans açısından
     * herhangi bir sorun oluşturmaz.
     *
     * Avantajı:
     * Kod okunaklı ve güvenlidir.
     */
    for (
      const person
      of personnel
    ) {
      await client.query(
        `
          INSERT INTO public.wingsm_personnel (
            code,
            name,
            active,
            raw_data,
            last_seen_at,
            created_at,
            updated_at
          )
          VALUES (
            $1,
            $2,
            TRUE,
            $3::jsonb,
            $4,
            NOW(),
            NOW()
          )

          ON CONFLICT (code)
          DO UPDATE SET
            name =
              EXCLUDED.name,

            active =
              TRUE,

            raw_data =
              EXCLUDED.raw_data,

            last_seen_at =
              EXCLUDED.last_seen_at,

            updated_at =
              NOW()
        `,
        [
          person.code,

          person.name,

          JSON.stringify(
            person.raw
          ),

          syncTime,
        ]
      );

      insertedOrUpdated++;
    }

    /*
     * WingSM listesinden artık gelmeyenleri
     * active=false yap.
     *
     * SİLME YOK.
     */
    let deactivatedCount =
      0;

    if (
      activeCodes.length >
      0
    ) {
      const deactivateResult =
        await client.query(
          `
            UPDATE public.wingsm_personnel

            SET
              active = FALSE,
              updated_at = NOW()

            WHERE
              active = TRUE

              AND NOT (
                code =
                ANY(
                  $1::varchar[]
                )
              )
          `,
          [
            activeCodes,
          ]
        );

      deactivatedCount =
        deactivateResult.rowCount ??
        0;
    }

    const finalCountResult =
      await client.query(
        `
          SELECT
            COUNT(*) FILTER (
              WHERE active = TRUE
            )::int AS active_count,

            COUNT(*) FILTER (
              WHERE active = FALSE
            )::int AS inactive_count,

            COUNT(*)::int AS total_count

          FROM public.wingsm_personnel
        `
      );

    const counts =
      finalCountResult
        .rows[0] ||
      {};

    await client.query(
      "COMMIT"
    );

    return {
      previousActiveCount,

      receivedCount:
        personnel.length,

      insertedOrUpdated,

      deactivatedCount,

      activeCount:
        Number(
          counts.active_count ||
            0
        ),

      inactiveCount:
        Number(
          counts.inactive_count ||
            0
        ),

      totalCount:
        Number(
          counts.total_count ||
            0
        ),

      syncedAt:
        syncTime.toISOString(),
    };
  } catch (
    error
  ) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {
      // rollback hatasını ayrıca dışarı fırlatmıyoruz
    }

    throw error;
  } finally {
    client.release();
  }
}

/* =========================================================
   MAIN SYNC
========================================================= */

async function runSync(
  request: NextRequest
) {
  const startedAt =
    Date.now();

  /*
   * 1) Panel admin veya cron secret doğrula.
   */
  const auth =
    authorize(
      request
    );

  if (!auth.ok) {
    return auth.response;
  }

  try {
    /*
     * 2) WingSM portalından personelleri oku.
     */
    const wingResult =
      await readWingSMPersonnel();

    /*
     * 3) PostgreSQL'e senkronla.
     */
    const dbResult =
      await syncDatabase(
        wingResult.personnel
      );

    /*
     * Güvenlik:
     *
     * Burada WingSM raw settings,
     * cookie,
     * session,
     * credential,
     * password,
     * token DÖNDÜRMÜYORUZ.
     */
    return json({
      success:
        true,

      source:
        "WINGSM_PORTAL",

      authSource:
        auth.source,

      wingSM: {
        tarihN:
          wingResult.tarihN,

        received:
          wingResult
            .personnel
            .length,
      },

      database: {
        previousActiveCount:
          dbResult
            .previousActiveCount,

        upserted:
          dbResult
            .insertedOrUpdated,

        deactivated:
          dbResult
            .deactivatedCount,

        active:
          dbResult
            .activeCount,

        inactive:
          dbResult
            .inactiveCount,

        total:
          dbResult
            .totalCount,

        syncedAt:
          dbResult
            .syncedAt,
      },

      responseTimeMs:
        Date.now() -
        startedAt,
    });
  } catch (
    error
  ) {
    /*
     * Hassas login/session bilgilerini
     * loglamıyoruz.
     */
    console.error(
      "WINGSM PERSONNEL SYNC ERROR:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    );

    return json(
      {
        success:
          false,

        stage:
          "PERSONNEL_SYNC",

        message:
          error instanceof
          Error
            ? error.message
            : "WingSM personel senkronizasyonu başarısız.",

        responseTimeMs:
          Date.now() -
          startedAt,
      },
      500
    );
  }
}

/* =========================================================
   GET
========================================================= */

export async function GET(
  request: NextRequest
) {
  return runSync(
    request
  );
}

/* =========================================================
   POST
========================================================= */

export async function POST(
  request: NextRequest
) {
  return runSync(
    request
  );
}
