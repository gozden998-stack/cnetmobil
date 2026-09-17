// app/api/wingsm/personnel-sync/route.ts
//
// CNETMOBIL - WingSM B2B PERSONEL -> PostgreSQL SYNC
//
// Kaynak:
// GET /api/b2b/carikart/list/P/:tarih1/:tarih2?filter=*
//
// Kurallar:
// - WingSM'e SADECE GET yapılır.
// - WingSM tarafında hiçbir kayıt oluşturulmaz/değiştirilmez/silinmez.
// - Kod STRING tutulur. Örn: "0004" baştaki sıfırları korur.
// - PostgreSQL public.wingsm_personnel cache tablosu güncellenir.
// - SADECE doğrulanmış HizliSatis/ListSatici Kod'ları active=true yapılır.
// - CariKart P içindeki doğrulanmamış ek kayıtlar active yapılmaz.
// - Böylece B2B'nin daha geniş personel/cari kümesi Paratika dropdown'a sızmaz.
// - Bilinmeyen yeni Kod'lar cevapta unverifiedCandidates olarak raporlanır.
// - Hassas alanlar (TC, telefon, e-posta, adres vb.) raw_data'ya YAZILMAZ.
// - Route iki şekilde çalışır:
//   1) Panelde admin oturumu ile manuel tetikleme
//    2) Coolify cron için x-sync-secret header ile otomatik tetikleme
//
// Mevcut:
// GET /api/wingsm/personnel
// endpointine dokunulmaz. Sync bittikten sonra Paratika dropdown'u
// PostgreSQL cache üzerinden yeni personel listesini otomatik görür.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  Pool,
} from "pg";

import crypto from "crypto";

import {
  wingSMRequest,
} from "@/app/lib/wingsm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME =
  "cnet_auth";

const ISTANBUL_TZ =
  "Europe/Istanbul";

type SessionPayload = {
  userId: number | null;
  role:
    | "admin"
    | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

type WingPersonnelRow = {
  Id?: number | string | null;
  Kod?: string | number | null;
  Ad?: string | null;
  Sirket?: string | null;
  CalistigiSube?: string | null;
  CalistigiSubeAdI?: string | null;
  Pozisyon?: string | null;
  [key: string]: unknown;
};

type WingPersonnelResponse = {
  success?: boolean;
  data?: WingPersonnelRow[];
  [key: string]: unknown;
};

type NormalizedPersonnel = {
  code: string;
  name: string;
  rawData: {
    sourceId: number | string | null;
    Kod: string;
    Ad: string;
    Sirket: string | null;
    CalistigiSube: string | null;
    CalistigiSubeAdI: string | null;
    Pozisyon: string | null;
  };
};

// WingSM HizliSatis -> settings.ListSatici kaynağından
// 17.09.2026 tarihinde doğrulanmış gerçek satıcı/personel Kod listesi.
//
// NEDEN:
// /api/b2b/carikart/list/P endpointi 80 kayıt döndürüyor,
// ancak gerçek HizliSatis ListSatici listesi 71 kayıt.
// B2B cevabındaki Izinler / TarihCikis / Pozisyon alanları
// bu iki kümeyi güvenilir biçimde ayırmıyor.
//
// Bu nedenle bilinmeyen yeni B2B Kod'lar otomatik olarak
// Paratika personel listesine AKTİF edilmez.
const VERIFIED_SELLER_CODES =
  new Set<string>([
  "0004",
  "0217",
  "0211",
  "0258",
  "0294",
  "0315",
  "0234",
  "0253",
  "0273",
  "0245",
  "0332",
  "0262",
  "0156",
  "0001",
  "0242",
  "0295",
  "0333",
  "0265",
  "0240",
  "0308",
  "0327",
  "0103",
  "0269",
  "0162",
  "0302",
  "0305",
  "0126",
  "0312",
  "0154",
  "0270",
  "0326",
  "0223",
  "0316",
  "0114",
  "0132",
  "0206",
  "0199",
  "0163",
  "0045",
  "0271",
  "0146",
  "0261",
  "0319",
  "0007",
  "0296",
  "0267",
  "0283",
  "0167",
  "0303",
  "0306",
  "0300",
  "0204",
  "0328",
  "0279",
  "0221",
  "0282",
  "0311",
  "0183",
  "0324",
  "0277",
  "0275",
  "0299",
  "0250",
  "0287",
  "0329",
  "0313",
  "0309",
  "0320",
  "0330",
  "0274",
  "0307"
]);

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
    global
      .cnetWingSMPersonnelPool =
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


function timingSafeStringEqual(
  a: string,
  b: string
) {
  const aBuffer =
    Buffer.from(
      a,
      "utf8"
    );

  const bBuffer =
    Buffer.from(
      b,
      "utf8"
    );

  if (
    aBuffer.length !==
    bBuffer.length
  ) {
    return false;
  }

  return crypto
    .timingSafeEqual(
      aBuffer,
      bBuffer
    );
}

function hasValidSyncSecret(
  request: NextRequest
) {
  const configured =
    String(
      process.env
        .WINGSM_PERSONNEL_SYNC_SECRET ||
        ""
    ).trim();

  if (!configured) {
    return false;
  }

  const provided =
    String(
      request.headers.get(
        "x-sync-secret"
      ) ||
        ""
    ).trim();

  if (!provided) {
    return false;
  }

  return timingSafeStringEqual(
    configured,
    provided
  );
}

function requireAdmin(
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
            success: false,
            message:
              "Oturum bulunamadı.",
          },
          401
        ),
    };
  }

  const session =
    verifySession(token);

  if (!session) {
    return {
      ok: false as const,
      response:
        json(
          {
            success: false,
            message:
              "Oturum geçersiz veya süresi dolmuş.",
          },
          401
        ),
    };
  }

  if (
    session.role !==
    "admin"
  ) {
    return {
      ok: false as const,
      response:
        json(
          {
            success: false,
            message:
              "Bu işlem yalnızca admin tarafından yapılabilir.",
          },
          403
        ),
    };
  }

  return {
    ok: true as const,
    session,
  };
}


function requireSyncAccess(
  request: NextRequest
) {
  if (
    hasValidSyncSecret(
      request
    )
  ) {
    return {
      ok: true as const,
      mode:
        "cron" as const,
      session:
        null,
    };
  }

  const admin =
    requireAdmin(
      request
    );

  if (!admin.ok) {
    return admin;
  }

  return {
    ok: true as const,
    mode:
      "admin" as const,
    session:
      admin.session,
  };
}

function getIstanbulDateNumber() {
  const parts =
    new Intl
      .DateTimeFormat(
        "en-GB",
        {
          timeZone:
            ISTANBUL_TZ,
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
      (part) =>
        part.type ===
        "year"
    )?.value;

  const month =
    parts.find(
      (part) =>
        part.type ===
        "month"
    )?.value;

  const day =
    parts.find(
      (part) =>
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

function cleanString(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function nullableString(
  value: unknown
) {
  const result =
    cleanString(value);

  return result ||
    null;
}

function normalizePersonnel(
  rows: WingPersonnelRow[]
) {
  const byCode =
    new Map<
      string,
      NormalizedPersonnel
    >();

  for (const row of rows) {
    const code =
      cleanString(
        row?.Kod
      );

    const name =
      cleanString(
        row?.Ad
      );

    if (
      !code ||
      !name
    ) {
      continue;
    }

    // Kod string kalır.
    // parseInt / Number YAPILMAZ.
    byCode.set(
      code,
      {
        code,
        name,
        rawData: {
          sourceId:
            row?.Id ??
            null,
          Kod:
            code,
          Ad:
            name,
          Sirket:
            nullableString(
              row?.Sirket
            ),
          CalistigiSube:
            nullableString(
              row
                ?.CalistigiSube
            ),
          CalistigiSubeAdI:
            nullableString(
              row
                ?.CalistigiSubeAdI
            ),
          Pozisyon:
            nullableString(
              row?.Pozisyon
            ),
        },
      }
    );
  }

  return Array.from(
    byCode.values()
  );
}

async function syncPersonnel(
  personnel:
    NormalizedPersonnel[]
) {
  const pool =
    getPool();

  const client =
    await pool.connect();

  try {
    await client.query(
      "BEGIN"
    );

    const beforeResult =
      await client.query(
        `
          SELECT
            COUNT(*)::int
              AS total_count,
            COUNT(*) FILTER (
              WHERE active = TRUE
            )::int
              AS active_count
          FROM public.wingsm_personnel
        `
      );

    // Önce mevcut cache kayıtlarının hepsini pasif yap.
    // Aşağıdaki UPSERT ile WingSM'de halen bulunanlar tekrar active=true olur.
    await client.query(
      `
        UPDATE
          public.wingsm_personnel
        SET
          active = FALSE,
          updated_at = NOW()
        WHERE
          active = TRUE
      `
    );

    const params:
      unknown[] = [];

    const valuesSql =
      personnel.map(
        (
          person,
          index
        ) => {
          const base =
            index * 3;

          params.push(
            person.code,
            person.name,
            JSON.stringify(
              person.rawData
            )
          );

          return `(
            $${base + 1}::varchar,
            $${base + 2}::varchar,
            TRUE,
            $${base + 3}::jsonb,
            NOW(),
            NOW(),
            NOW()
          )`;
        }
      ).join(",\n");

    await client.query(
      `
        INSERT INTO
          public.wingsm_personnel
        (
          code,
          name,
          active,
          raw_data,
          last_seen_at,
          created_at,
          updated_at
        )
        VALUES
          ${valuesSql}
        ON CONFLICT (code)
        DO UPDATE SET
          name =
            EXCLUDED.name,
          active =
            TRUE,
          raw_data =
            EXCLUDED.raw_data,
          last_seen_at =
            NOW(),
          updated_at =
            NOW()
      `,
      params
    );

    const afterResult =
      await client.query(
        `
          SELECT
            COUNT(*)::int
              AS total_count,
            COUNT(*) FILTER (
              WHERE active = TRUE
            )::int
              AS active_count,
            COUNT(*) FILTER (
              WHERE active = FALSE
            )::int
              AS inactive_count,
            MAX(last_seen_at)
              AS last_sync_at
          FROM public.wingsm_personnel
        `
      );

    await client.query(
      "COMMIT"
    );

    return {
      before:
        beforeResult
          .rows[0] ||
        {},
      after:
        afterResult
          .rows[0] ||
        {},
    };
  } catch (error) {
    try {
      await client.query(
        "ROLLBACK"
      );
    } catch {
      // rollback hatası ana hatayı gölgelememeli
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function GET(
  request: NextRequest
) {
  const startedAt =
    Date.now();

  try {
    const auth =
      requireSyncAccess(
        request
      );

    if (!auth.ok) {
      return auth.response;
    }

    const tarih =
      getIstanbulDateNumber();

    const path =
      `/api/b2b/carikart/list/P/${tarih}/${tarih}`;

    const payload =
      await wingSMRequest<
        WingPersonnelResponse
      >(
        path,
        {
          method: "GET",
          query: {
            // ÖNEMLİ:
            // Tek tırnak YOK.
            filter: "*",
          },
        }
      );

    if (
      payload?.success !==
        true
    ) {
      return json(
        {
          success: false,
          stage:
            "WINGSM_RESPONSE",
          message:
            "WingSM personel endpointi success:true dönmedi.",
          tarih,
        },
        502
      );
    }

    if (
      !Array.isArray(
        payload.data
      )
    ) {
      return json(
        {
          success: false,
          stage:
            "WINGSM_DATA",
          message:
            "WingSM cevabında data array bulunamadı.",
          tarih,
        },
        502
      );
    }

    const allPersonnel =
      normalizePersonnel(
        payload.data
      );

    const personnel =
      allPersonnel.filter(
        (person) =>
          VERIFIED_SELLER_CODES.has(
            person.code
          )
      );

    const unverifiedCandidates =
      allPersonnel
        .filter(
          (person) =>
            !VERIFIED_SELLER_CODES.has(
              person.code
            )
        )
        .map(
          (person) => ({
            code:
              person.code,
            name:
              person.name,
          })
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(
              b.name,
              "tr-TR"
            )
        );

    // Güvenlik:
    // Doğrulanmış 71 satıcının büyük kısmı kaynakta yoksa
    // mevcut cache'i topluca pasif yapmayalım.
    if (
      personnel.length <
      60
    ) {
      return json(
        {
          success: false,
          stage:
            "SAFETY_GUARD",
          message:
            "WingSM doğrulanmış satıcı listesi beklenenden çok az kayıt döndürdü. PostgreSQL değiştirilmedi.",
          wingCount:
            payload.data.length,
          normalizedCount:
            allPersonnel.length,
          verifiedFoundCount:
            personnel.length,
          unverifiedCount:
            unverifiedCandidates.length,
          tarih,
        },
        502
      );
    }

    const result =
      await syncPersonnel(
        personnel
      );

    return json({
      success: true,

      source:
        "WINGSM_B2B_CARIKART_PERSONEL",

      triggerMode:
        auth.mode,

      request: {
        path,
        filter: "*",
        tarih,
      },

      wingCount:
        payload.data.length,

      normalizedCount:
        allPersonnel.length,

      verifiedSellerCount:
        personnel.length,

      syncedCount:
        personnel.length,

      unverifiedCount:
        unverifiedCandidates.length,

      unverifiedCandidates,

      database: {
        beforeTotal:
          Number(
            result.before
              .total_count ||
              0
          ),
        beforeActive:
          Number(
            result.before
              .active_count ||
              0
          ),
        total:
          Number(
            result.after
              .total_count ||
              0
          ),
        active:
          Number(
            result.after
              .active_count ||
              0
          ),
        inactive:
          Number(
            result.after
              .inactive_count ||
              0
          ),
        lastSyncAt:
          result.after
            .last_sync_at ||
          null,
      },

      note:
        "WingSM'e yalnızca GET yapıldı. Sadece doğrulanmış HizliSatis/ListSatici Kod'ları aktif edildi; doğrulanmamış B2B kayıtları Paratika listesine alınmadı.",

      responseTimeMs:
        Date.now() -
        startedAt,
    });
  } catch (error) {
    console.error(
      "WINGSM PERSONNEL SYNC ERROR:",
      error
    );

    return json(
      {
        success: false,
        stage:
          "PERSONNEL_SYNC",
        message:
          error instanceof Error
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
