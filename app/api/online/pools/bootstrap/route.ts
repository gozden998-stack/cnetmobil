// app/api/online/pools/bootstrap/route.ts
// CNETMOBIL - ONLINE ADIM 8.0
//
// MERKEZI IMEI HAVUZUNU HAZIRLA
//
// Source of truth: public.stock_devices
//
// Bu route:
// - AVAILABLE fiziksel cihazları marka/model/hafıza/renk/grade/garanti bazında havuzlar.
// - Her IMEI'yi sadece tek merkezi havuza bağlar.
// - N11 raw_data.availableImeis içindeki IMEI'ler stock_devices'ta bulunuyorsa,
//   ve tek bir havuza işaret ediyorsa ilgili N11 listing'i o havuza bağlar.
// - IKAS listing'lerini bu adımda OTOMATIK bağlamaz.
//   Çünkü eski IKAS ürünlerinde IMEI yok; isimden kör eşleştirme yapmıyoruz.
// - N11/IKAS canlı API'lerine yazmaz.
// - Stok miktarını değiştirmez.
// - Sipariş düşmez.
// - Hiçbir cihazı SOLD/RESERVED yapmaz.

import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  Pool,
  PoolClient,
} from "pg";
import crypto from "crypto";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetOnlinePoolBootstrap:
    | Pool
    | undefined;
}

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
        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
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
      .cnetOnlinePoolBootstrap
  ) {
    global
      .cnetOnlinePoolBootstrap =
      new Pool({
        connectionString,
        max: 3,
        idleTimeoutMillis:
          30_000,
        connectionTimeoutMillis:
          10_000,
      });
  }

  return global
    .cnetOnlinePoolBootstrap;
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
    return json(
      {
        success: false,
        error:
          "Geçersiz oturum.",
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
    return json(
      {
        success: false,
        error:
          "Bu işlem yalnızca Super Admin içindir.",
      },
      403
    );
  }

  return null;
}

function text(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function normalizePart(
  value: unknown
) {
  return text(value)
    .toLocaleUpperCase(
      "tr-TR"
    )
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(
      /[^A-Z0-9]+/g,
      ""
    );
}

function normalizeGrade(
  value: unknown
) {
  const raw =
    normalizePart(value);

  if (
    raw === "A" ||
    raw.includes(
      "MUKEMMEL"
    )
  ) {
    return "A";
  }

  if (
    raw === "B" ||
    raw.includes(
      "COKIYI"
    )
  ) {
    return "B";
  }

  if (
    raw === "C" ||
    raw === "IYI"
  ) {
    return "C";
  }

  return text(value)
    .toLocaleUpperCase(
      "tr-TR"
    );
}

function makePoolKey(
  row: {
    brand: string;
    model: string;
    memory: string;
    color: string;
    grade: string;
    warranty: string;
  }
) {
  const signature = [
    normalizePart(
      row.brand
    ),
    normalizePart(
      row.model
    ),
    normalizePart(
      row.memory
    ),
    normalizePart(
      row.color
    ),
    normalizePart(
      row.grade
    ),
    normalizePart(
      row.warranty
    ),
  ].join("|");

  return crypto
    .createHash("sha256")
    .update(signature)
    .digest("hex");
}

function uniqueStrings(
  value: unknown
) {
  if (
    !Array.isArray(value)
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (item) =>
            text(item)
        )
        .filter(Boolean)
    )
  );
}

async function ensureSchema(
  client: PoolClient
) {
  const result =
    await client.query(
      `
        SELECT
          to_regclass(
            'public.online_inventory_pools'
          ) IS NOT NULL AS has_pools,
          to_regclass(
            'public.online_inventory_pool_devices'
          ) IS NOT NULL AS has_pool_devices,
          EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'online_listings'
              AND column_name = 'inventory_pool_id'
          ) AS has_listing_pool_id
      `
    );

  const row =
    result.rows[0];

  if (
    !row?.has_pools ||
    !row?.has_pool_devices ||
    !row
      ?.has_listing_pool_id
  ) {
    throw new Error(
      "ADIM 8 migration uygulanmamış. Önce ONLINE_ADIM8_MERKEZI_IMEI_HAVUZ_MIGRATION.sql çalıştır."
    );
  }
}

async function upsertPoolForDevice(
  client: PoolClient,
  device: any
) {
  const brand =
    text(device?.brand);

  const model =
    text(device?.model);

  const memory =
    text(device?.memory);

  const color =
    text(device?.color);

  const grade =
    normalizeGrade(
      device?.grade
    );

  const warranty =
    text(
      device?.warranty
    );

  if (
    !brand ||
    !model ||
    !memory ||
    !color ||
    !grade ||
    !warranty
  ) {
    return {
      skipped: true,
      poolId: null,
    };
  }

  const poolKey =
    makePoolKey({
      brand,
      model,
      memory,
      color,
      grade,
      warranty,
    });

  const poolResult =
    await client.query(
      `
        INSERT INTO public.online_inventory_pools AS p (
          pool_key,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          status,
          metadata,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          'ACTIVE',
          $8::jsonb,
          now()
        )
        ON CONFLICT (pool_key)
        DO UPDATE SET
          brand = EXCLUDED.brand,
          model = EXCLUDED.model,
          memory = EXCLUDED.memory,
          color = EXCLUDED.color,
          grade = EXCLUDED.grade,
          warranty = EXCLUDED.warranty,
          status = 'ACTIVE',
          metadata =
            COALESCE(
              p.metadata,
              '{}'::jsonb
            )
            ||
            EXCLUDED.metadata,
          updated_at = now()
        RETURNING id
      `,
      [
        poolKey,
        brand,
        model,
        memory,
        color,
        grade,
        warranty,
        JSON.stringify({
          source:
            "STOCK_DEVICES",
          bootstrapVersion:
            "ADIM8",
        }),
      ]
    );

  const poolId =
    Number(
      poolResult.rows[0]
        ?.id
    );

  if (
    !Number.isFinite(
      poolId
    )
  ) {
    throw new Error(
      "Havuz kaydı oluşturulamadı."
    );
  }

  await client.query(
    `
      INSERT INTO public.online_inventory_pool_devices AS pd (
        pool_id,
        stock_device_id,
        imei,
        device_status,
        branch_code,
        updated_at
      )
      VALUES (
        $1, $2, $3,
        $4, $5, now()
      )
      ON CONFLICT (stock_device_id)
      DO UPDATE SET
        pool_id =
          EXCLUDED.pool_id,
        imei =
          EXCLUDED.imei,
        device_status =
          EXCLUDED.device_status,
        branch_code =
          EXCLUDED.branch_code,
        updated_at =
          now()
    `,
    [
      poolId,
      Number(
        device?.id
      ),
      text(
        device?.imei
      ),
      text(
        device?.status
      ),
      text(
        device
          ?.current_branch_code
      ) || null,
    ]
  );

  return {
    skipped: false,
    poolId,
  };
}

async function linkN11ByActualImeis(
  client: PoolClient
) {
  const listings =
    await client.query(
      `
        SELECT
          id,
          external_stock_code,
          raw_data
        FROM public.online_listings
        WHERE channel = 'N11'
          AND COALESCE(
            raw_data->>'poolEnabled',
            'false'
          ) = 'true'
      `
    );

  let linked = 0;
  let alreadyLinked = 0;
  let noAvailableImeis = 0;
  let noMatchedImeis = 0;
  let ambiguous = 0;
  let matchedImeis = 0;
  let missingImeis = 0;

  const samples:
    Array<
      Record<
        string,
        unknown
      >
    > = [];

  for (
    const listing of
      listings.rows
  ) {
    const raw =
      listing?.raw_data &&
      typeof listing
        .raw_data ===
        "object"
        ? listing.raw_data
        : {};

    const imeis =
      uniqueStrings(
        raw
          ?.availableImeis
      );

    if (
      imeis.length === 0
    ) {
      noAvailableImeis +=
        1;
      continue;
    }

    const deviceRows =
      await client.query(
        `
          SELECT
            pd.imei,
            pd.pool_id
          FROM public.online_inventory_pool_devices pd
          WHERE pd.imei =
            ANY($1::text[])
        `,
        [imeis]
      );

    const foundImeis =
      new Set(
        deviceRows.rows.map(
          (row: any) =>
            text(row?.imei)
        )
      );

    matchedImeis +=
      foundImeis.size;

    missingImeis +=
      imeis.filter(
        (imei) =>
          !foundImeis.has(
            imei
          )
      ).length;

    const poolIds =
      Array.from(
        new Set(
          deviceRows.rows
            .map(
              (row: any) =>
                Number(
                  row?.pool_id
                )
            )
            .filter(
              (value) =>
                Number.isFinite(
                  value
                )
            )
        )
      );

    if (
      poolIds.length === 0
    ) {
      noMatchedImeis +=
        1;
      continue;
    }

    if (
      poolIds.length > 1
    ) {
      ambiguous += 1;

      if (
        samples.length < 10
      ) {
        samples.push({
          type:
            "N11_AMBIGUOUS",
          listingId:
            listing.id,
          stockCode:
            listing
              .external_stock_code,
          poolIds,
          availableImeis:
            imeis,
        });
      }

      continue;
    }

    const update =
      await client.query(
        `
          UPDATE public.online_listings
          SET
            inventory_pool_id =
              $1,
            raw_data =
              COALESCE(
                raw_data,
                '{}'::jsonb
              )
              ||
              jsonb_build_object(
                'centralPoolLink',
                jsonb_build_object(
                  'method',
                  'N11_AVAILABLE_IMEI',
                  'poolId',
                  $1::bigint,
                  'linkedAt',
                  now()
                )
              ),
            updated_at =
              now()
          WHERE id = $2
            AND (
              inventory_pool_id
                IS DISTINCT FROM
                $1
            )
          RETURNING id
        `,
        [
          poolIds[0],
          Number(
            listing.id
          ),
        ]
      );

    if (
      update.rowCount ===
      1
    ) {
      linked += 1;
    } else {
      alreadyLinked +=
        1;
    }
  }

  return {
    listingCount:
      listings.rowCount,
    linked,
    alreadyLinked,
    noAvailableImeis,
    noMatchedImeis,
    ambiguous,
    matchedImeis,
    missingImeis,
    samples,
  };
}

export async function POST(
  request: NextRequest
) {
  let client:
    PoolClient | null = null;

  try {
    const authError =
      await requireSuperAdmin(
        request
      );

    if (authError) {
      return authError;
    }

    client =
      await getPool().connect();

    await client.query(
      "BEGIN"
    );

    await ensureSchema(
      client
    );

    const devicesResult =
      await client.query(
        `
          SELECT
            id,
            imei,
            brand,
            model,
            memory,
            color,
            grade,
            warranty,
            current_branch_code,
            status
          FROM public.stock_devices
          WHERE status = 'AVAILABLE'
          ORDER BY id ASC
        `
      );

    let deviceLinked = 0;
    let deviceSkipped = 0;

    const touchedPoolIds =
      new Set<number>();

    for (
      const device of
        devicesResult.rows
    ) {
      const result =
        await upsertPoolForDevice(
          client,
          device
        );

      if (
        result.skipped
      ) {
        deviceSkipped += 1;
        continue;
      }

      deviceLinked += 1;

      if (
        result.poolId
      ) {
        touchedPoolIds.add(
          result.poolId
        );
      }
    }

    // AVAILABLE olmayan kayıtlar central pool tablosunda tutulabilir ama
    // availability bilgisi güncel kalmalı.
    await client.query(
      `
        UPDATE public.online_inventory_pool_devices pd
        SET
          device_status =
            sd.status,
          branch_code =
            sd.current_branch_code,
          updated_at =
            now()
        FROM public.stock_devices sd
        WHERE sd.id =
          pd.stock_device_id
          AND (
            pd.device_status
              IS DISTINCT FROM
              sd.status
            OR
            pd.branch_code
              IS DISTINCT FROM
              sd.current_branch_code
          )
      `
    );

    const n11 =
      await linkN11ByActualImeis(
        client
      );

    const summaryResult =
      await client.query(
        `
          SELECT
            (
              SELECT
                COUNT(*)::integer
              FROM public.online_inventory_pools
              WHERE status = 'ACTIVE'
            ) AS pool_count,

            (
              SELECT
                COUNT(*)::integer
              FROM public.online_inventory_pool_devices
              WHERE device_status = 'AVAILABLE'
            ) AS available_device_count,

            (
              SELECT
                COUNT(*)::integer
              FROM public.online_listings
              WHERE channel = 'N11'
                AND inventory_pool_id IS NOT NULL
            ) AS n11_linked_listing_count,

            (
              SELECT
                COUNT(*)::integer
              FROM public.online_listings
              WHERE channel = 'IKAS'
                AND inventory_pool_id IS NOT NULL
            ) AS ikas_linked_listing_count
        `
      );

    await client.query(
      "COMMIT"
    );

    const summary =
      summaryResult.rows[0] ||
      {};

    return json({
      success: true,

      centralPool: {
        availableStockDeviceCount:
          devicesResult.rowCount,
        linkedDeviceCount:
          deviceLinked,
        skippedIncompleteDeviceCount:
          deviceSkipped,
        touchedPoolCount:
          touchedPoolIds.size,
        totalActivePoolCount:
          Number(
            summary
              .pool_count ||
              0
          ),
        totalAvailableDeviceCount:
          Number(
            summary
              .available_device_count ||
              0
          ),
      },

      channels: {
        n11: {
          ...n11,
          totalLinkedListingCount:
            Number(
              summary
                .n11_linked_listing_count ||
                0
            ),
        },
        ikas: {
          totalLinkedListingCount:
            Number(
              summary
                .ikas_linked_listing_count ||
                0
            ),
          autoLinkedThisStep:
            0,
          note:
            "Eski İkas kayıtlarında IMEI olmadığı için otomatik isim eşleştirmesi yapılmadı.",
        },
      },

      safety: {
        ikasApiWrite:
          false,
        n11ApiWrite:
          false,
        stockQuantityChanged:
          false,
        deviceStatusChanged:
          false,
        orderProcessed:
          false,
        deletedRows:
          0,
      },

      next:
        "ADIM 8.1: İkas varyantlarını merkezi havuzlara güvenli eşleştirme. Ardından iki kanal siparişleri aynı havuzdan IMEI tüketecek.",

      completedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // best effort
      }
    }

    console.error(
      "ONLINE CENTRAL POOL BOOTSTRAP ERROR:",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Merkezi IMEI havuzu hazırlanamadı.",
      },
      500
    );
  } finally {
    client?.release();
  }
}
