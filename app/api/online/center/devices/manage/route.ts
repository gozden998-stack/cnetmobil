// app/api/online/center/devices/manage/route.ts
// CNETMOBIL - MERKEZ STOK DURUM MOTORU
//
// AVAILABLE -> PASSIVE:
// 1) Önce kanal stok hedeflerini hesaplar.
// 2) Frontend N11 / İkas / İdefix'e gerçek stokları yazar.
// 3) Tüm kanal çağrıları başarılı olduktan sonra finalize_exit çağrılır.
// 4) Cihaz DB'den SILINMEZ; PASSIVE olur ve "Stokta Olmayanlar"a taşınır.
//
// PASSIVE -> AVAILABLE:
// - restore_selected ile cihaz tekrar Merkez stoğa alınır.
// - Marketplace kanalları otomatik açılmaz; kullanıcı yeniden kanal gönderimi yapar.

import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  Pool,
  type PoolClient,
} from "pg";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetCenterStockStatePool:
    | Pool
    | undefined;
}

const COOKIE_NAME =
  "cnet_auth";

const CENTER_BRANCH_CODE =
  "CNET";

const ACTIVE_MEMBERSHIP_STATUSES =
  [
    "LISTED",
    "RESERVED",
    "PENDING_CREATE",
  ];

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
      .cnetCenterStockStatePool
  ) {
    global
      .cnetCenterStockStatePool =
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
    .cnetCenterStockStatePool;
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
      b.length
    ) {
      return null;
    }

    if (
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

function validateOrigin(
  request: NextRequest
) {
  const origin =
    request.headers.get(
      "origin"
    );

  if (!origin) {
    return false;
  }

  const appUrl =
    process.env.APP_URL;

  if (appUrl) {
    try {
      return (
        origin ===
        new URL(
          appUrl
        ).origin
      );
    } catch {
      return false;
    }
  }

  const host =
    request.headers.get(
      "host"
    );

  const proto =
    request.headers.get(
      "x-forwarded-proto"
    ) ||
    request.nextUrl.protocol.replace(
      ":",
      ""
    );

  return (
    Boolean(host) &&
    origin ===
      `${proto}://${host}`
  );
}

async function requireSuperAdmin(
  request: NextRequest
) {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  const session =
    token
      ? verifySession(
          token
        )
      : null;

  if (
    !session?.userId
  ) {
    return null;
  }

  const result =
    await getPool().query(
      `
        SELECT
          u.id,
          u.username,
          u.active,
          EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r
              ON r.id =
                 ur.role_id
            WHERE ur.user_id =
                  u.id
              AND r.code =
                  'super_admin'
              AND r.active =
                  TRUE
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
    return null;
  }

  return {
    id:
      Number(row.id),
    username:
      String(
        row.username ||
          "super_admin"
      ),
  };
}

function text(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function cleanIds(
  value: unknown
) {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map(
          (item) =>
            Number(item)
        )
        .filter(
          (item) =>
            Number.isInteger(
              item
            ) &&
            item > 0
        )
    )
  ).slice(
    0,
    500
  );
}

function nonNegativeInt(
  value: unknown
) {
  const n =
    Number(value);

  if (
    !Number.isFinite(n)
  ) {
    return 0;
  }

  return Math.max(
    0,
    Math.trunc(n)
  );
}

async function loadDevices(
  client: PoolClient,
  ids: number[]
) {
  const result =
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
          status,
          source
        FROM public.stock_devices
        WHERE id =
          ANY($1::bigint[])
        ORDER BY id
      `,
      [
        ids,
      ]
    );

  return result.rows;
}

async function buildExitPlan(
  client: PoolClient,
  ids: number[]
) {
  const devices =
    await loadDevices(
      client,
      ids
    );

  if (
    devices.length !==
    ids.length
  ) {
    throw new Error(
      "Seçili cihazlardan bazıları bulunamadı."
    );
  }

  const invalid =
    devices.filter(
      (row: any) =>
        text(
          row.current_branch_code
        ).toUpperCase() !==
          CENTER_BRANCH_CODE ||
        text(
          row.status
        ).toUpperCase() !==
          "AVAILABLE"
    );

  if (
    invalid.length > 0
  ) {
    throw new Error(
      `Stoktan çıkarma yalnız CNET + AVAILABLE cihazlarda yapılır. Engelli IMEI: ${invalid
        .map(
          (row: any) =>
            text(
              row.imei
            )
        )
        .join(", ")}`
    );
  }

  const memberships =
    await client.query(
      `
        SELECT
          ocd.id
            AS membership_id,
          ocd.stock_device_id,
          ocd.imei,
          ocd.channel,
          ocd.membership_status,
          ocd.online_listing_id,

          ol.external_product_id,
          ol.external_variant_id,
          ol.external_stock_code,
          ol.quantity,
          ol.sale_price,
          ol.list_price,
          ol.title,
          ol.raw_data

        FROM public.online_channel_devices ocd
        LEFT JOIN public.online_listings ol
          ON ol.id =
             ocd.online_listing_id

        WHERE ocd.stock_device_id =
              ANY($1::bigint[])
          AND ocd.channel IN (
            'N11',
            'IKAS',
            'IDEFIX'
          )
          AND UPPER(
            COALESCE(
              ocd.membership_status,
              ''
            )
          ) =
            ANY($2::text[])

        ORDER BY
          ocd.channel,
          ocd.online_listing_id,
          ocd.id
      `,
      [
        ids,
        ACTIVE_MEMBERSHIP_STATUSES,
      ]
    );

  const grouped =
    new Map<
      string,
      any[]
    >();

  for (
    const row of
      memberships.rows
  ) {
    const channel =
      text(
        row.channel
      ).toUpperCase();

    const listingId =
      Number(
        row.online_listing_id ||
          0
      );

    if (!listingId) {
      throw new Error(
        `${text(
          row.imei
        )} ${channel} üyeliğinde listing bağlantısı bulunamadı.`
      );
    }

    const key =
      `${channel}:${listingId}`;

    const current =
      grouped.get(
        key
      ) || [];

    current.push(
      row
    );

    grouped.set(
      key,
      current
    );
  }

  const n11Actions:
    any[] = [];

  const ikasActions:
    any[] = [];

  const idefixActions:
    any[] = [];

  const blockers:
    string[] = [];

  for (
    const [
      key,
      rows,
    ] of
      grouped.entries()
  ) {
    const first =
      rows[0];

    const channel =
      text(
        first.channel
      ).toUpperCase();

    const listingId =
      Number(
        first
          .online_listing_id
      );

    // Seçilen cihaz(lar) PASSIVE olduktan sonra
    // aynı listing üzerinde kaç gerçek AVAILABLE IMEI kalacak?
    const countResult =
      await client.query(
        `
          SELECT
            COUNT(*)::int
              AS count
          FROM public.online_channel_devices ocd
          JOIN public.stock_devices sd
            ON sd.id =
               ocd.stock_device_id
          WHERE ocd.channel =
                $1
            AND ocd.online_listing_id =
                $2
            AND sd.status =
                'AVAILABLE'
            AND UPPER(
              COALESCE(
                ocd.membership_status,
                ''
              )
            ) =
              ANY($3::text[])
            AND NOT (
              ocd.stock_device_id =
                ANY($4::bigint[])
            )
        `,
        [
          channel,
          listingId,
          ACTIVE_MEMBERSHIP_STATUSES,
          ids,
        ]
      );

    const targetQuantity =
      nonNegativeInt(
        countResult
          .rows[0]
          ?.count
      );

    const currentQuantity =
      nonNegativeInt(
        first.quantity
      );

    const base = {
      key,
      channel,
      listingId,
      title:
        text(
          first.title
        ),
      currentQuantity,
      targetQuantity,
      selectedImeis:
        rows.map(
          (row: any) =>
            text(
              row.imei
            )
        ),
    };

    if (
      channel ===
      "N11"
    ) {
      // Mevcut N11 yapısında yeni cihaz stockCode=IMEI ile
      // ayrı listing olarak açılıyor.
      // Legacy ortak listing yakalanırsa kalan ürünü yanlış kapatmamak için blokla.
      if (
        targetQuantity !==
        0
      ) {
        blockers.push(
          `${text(
            first.title
          ) || listingId}: N11 listing birden fazla aktif IMEI paylaşıyor. Güvenlik için otomatik stoktan çıkarma durduruldu.`
        );

        continue;
      }

      const stockCode =
        text(
          first
            .external_stock_code
        );

      if (!stockCode) {
        blockers.push(
          `${text(
            first.title
          ) || listingId}: N11 stockCode eksik.`
        );

        continue;
      }

      n11Actions.push({
        ...base,
        stockCode,
      });

      continue;
    }

    if (
      channel ===
      "IKAS"
    ) {
      const productId =
        text(
          first
            .external_product_id
        );

      const variantId =
        text(
          first
            .external_variant_id
        );

      if (
        !productId ||
        !variantId
      ) {
        blockers.push(
          `${text(
            first.title
          ) || listingId}: İkas product/variant ID eksik.`
        );

        continue;
      }

      ikasActions.push({
        ...base,
        productId,
        variantId,
      });

      continue;
    }

    if (
      channel ===
      "IDEFIX"
    ) {
      const barcode =
        text(
          first
            .external_variant_id
        ) ||
        text(
          first
            ?.raw_data
            ?.idefixBarcode
        ) ||
        text(
          first
            ?.raw_data
            ?.catalogBarcode
        );

      if (!barcode) {
        blockers.push(
          `${text(
            first.title
          ) || listingId}: İdefix barkodu eksik.`
        );

        continue;
      }

      idefixActions.push({
        ...base,
        barcode,
      });
    }
  }

  return {
    devices:
      devices.map(
        (row: any) => ({
          id:
            Number(
              row.id
            ),
          imei:
            text(
              row.imei
            ),
          brand:
            text(
              row.brand
            ),
          model:
            text(
              row.model
            ),
          memory:
            text(
              row.memory
            ),
          color:
            text(
              row.color
            ),
          grade:
            text(
              row.grade
            ),
          status:
            text(
              row.status
            ),
        })
      ),

    blockers,

    canProceed:
      blockers.length ===
      0,

    n11Actions,
    ikasActions,
    idefixActions,
  };
}

async function removeImeisFromListingRawData(
  client: PoolClient,
  deviceIds:
    number[]
) {
  const rows =
    await client.query(
      `
        SELECT
          ocd.online_listing_id,
          ocd.imei,
          ol.raw_data
        FROM public.online_channel_devices ocd
        JOIN public.online_listings ol
          ON ol.id =
             ocd.online_listing_id
        WHERE ocd.stock_device_id =
              ANY($1::bigint[])
          AND ocd.online_listing_id
              IS NOT NULL
      `,
      [
        deviceIds,
      ]
    );

  const byListing =
    new Map<
      number,
      {
        raw:
          any;
        imeis:
          string[];
      }
    >();

  for (
    const row of
      rows.rows
  ) {
    const listingId =
      Number(
        row
          .online_listing_id
      );

    const current =
      byListing.get(
        listingId
      ) || {
        raw:
          row.raw_data &&
          typeof row.raw_data ===
            "object"
            ? row.raw_data
            : {},
        imeis: [],
      };

    current.imeis.push(
      text(
        row.imei
      )
    );

    byListing.set(
      listingId,
      current
    );
  }

  for (
    const [
      listingId,
      item,
    ] of
      byListing.entries()
  ) {
    const remove =
      new Set(
        item.imeis
      );

    const raw = {
      ...item.raw,
    };

    if (
      Array.isArray(
        raw
          .availableImeis
      )
    ) {
      raw.availableImeis =
        raw.availableImeis.filter(
          (
            imei:
              unknown
          ) =>
            !remove.has(
              text(
                imei
              )
            )
        );
    }

    if (
      Array.isArray(
        raw.centerImeis
      )
    ) {
      raw.centerImeis =
        raw.centerImeis.filter(
          (
            imei:
              unknown
          ) =>
            !remove.has(
              text(
                imei
              )
            )
        );
    }

    raw.lastCenterStockExitAt =
      new Date()
        .toISOString();

    await client.query(
      `
        UPDATE public.online_listings
        SET
          raw_data =
            $2::jsonb,
          updated_at =
            now()
        WHERE id =
          $1
      `,
      [
        listingId,
        JSON.stringify(
          raw
        ),
      ]
    );
  }
}

export async function POST(
  request: NextRequest
) {
  let client:
    | PoolClient
    | null = null;

  try {
    if (
      !validateOrigin(
        request
      )
    ) {
      return json(
        {
          success: false,
          error:
            "Geçersiz istek kaynağı.",
        },
        403
      );
    }

    const user =
      await requireSuperAdmin(
        request
      );

    if (!user) {
      return json(
        {
          success: false,
          error:
            "Merkez stok yönetimi yalnız Super Admin içindir.",
        },
        403
      );
    }

    const body =
      await request
        .json()
        .catch(
          () => null
        );

    if (
      !body ||
      typeof body !==
        "object" ||
      Array.isArray(
        body
      )
    ) {
      return json(
        {
          success: false,
          error:
            "Geçersiz istek.",
        },
        400
      );
    }

    const data =
      body as Record<
        string,
        unknown
      >;

    const action =
      text(
        data.action
      ).toLowerCase();

    const ids =
      cleanIds(
        data.deviceIds
      );

    if (
      ids.length ===
      0
    ) {
      return json(
        {
          success: false,
          error:
            "En az 1 cihaz seç.",
        },
        400
      );
    }

    client =
      await getPool().connect();

    if (
      action ===
      "exit_preview"
    ) {
      const plan =
        await buildExitPlan(
          client,
          ids
        );

      return json({
        success: true,
        action,
        plan,
      });
    }

    if (
      action ===
      "restore_selected"
    ) {
      await client.query(
        "BEGIN ISOLATION LEVEL SERIALIZABLE"
      );

      await client.query(
        `
          SELECT
            pg_advisory_xact_lock(
              hashtext(
                'cnet_center_stock_restore'
              )
            )
        `
      );

      const rows =
        await loadDevices(
          client,
          ids
        );

      if (
        rows.length !==
        ids.length
      ) {
        throw new Error(
          "Seçili cihazlardan bazıları bulunamadı."
        );
      }

      const invalid =
        rows.filter(
          (row: any) =>
            text(
              row.current_branch_code
            ).toUpperCase() !==
              CENTER_BRANCH_CODE ||
            text(
              row.status
            ).toUpperCase() !==
              "PASSIVE"
        );

      if (
        invalid.length >
        0
      ) {
        throw new Error(
          "Tekrar stoğa alma yalnız CNET + PASSIVE cihazlarda yapılır."
        );
      }

      const restored =
        await client.query(
          `
            UPDATE public.stock_devices
            SET
              status =
                'AVAILABLE',
              updated_at =
                now()
            WHERE id =
              ANY($1::bigint[])
              AND current_branch_code =
                  'CNET'
              AND status =
                  'PASSIVE'
            RETURNING
              id,
              imei
          `,
          [
            ids,
          ]
        );

      for (
        const row of
          restored.rows
      ) {
        await client.query(
          `
            INSERT INTO public.stock_events (
              device_id,
              imei,
              event_type,
              from_branch_code,
              to_branch_code,
              old_status,
              new_status,
              performed_by,
              metadata,
              created_at
            )
            VALUES (
              $1,
              $2,
              'STOCK_RESTORE',
              'CNET',
              'CNET',
              'PASSIVE',
              'AVAILABLE',
              $3,
              $4::jsonb,
              now()
            )
          `,
          [
            Number(
              row.id
            ),
            text(
              row.imei
            ),
            user.username,
            JSON.stringify({
              source:
                "CENTER_STOCK_STATE",
            }),
          ]
        );
      }

      await client.query(
        "COMMIT"
      );

      return json({
        success: true,
        action,
        restored:
          restored.rowCount ||
          0,
        message:
          `${restored.rowCount || 0} cihaz tekrar Merkez stoğa alındı. Kanallara yeniden gönderilebilir.`,
      });
    }

    if (
      action ===
      "finalize_exit"
    ) {
      if (
        data
          .marketplaceSyncCompleted !==
        true
      ) {
        return json(
          {
            success: false,
            error:
              "Kanal stok senkronu tamamlanmadan Merkez cihazı PASSIVE yapılamaz.",
          },
          409
        );
      }

      await client.query(
        "BEGIN ISOLATION LEVEL SERIALIZABLE"
      );

      await client.query(
        `
          SELECT
            pg_advisory_xact_lock(
              hashtext(
                'cnet_center_stock_exit'
              )
            )
        `
      );

      // Dış API çağrılarından sonra Merkez durumu değişmiş mi tekrar kontrol et.
      const plan =
        await buildExitPlan(
          client,
          ids
        );

      if (
        !plan.canProceed
      ) {
        throw new Error(
          plan.blockers.join(
            " | "
          )
        );
      }

      const rows =
        await loadDevices(
          client,
          ids
        );

      await removeImeisFromListingRawData(
        client,
        ids
      );

      await client.query(
        `
          UPDATE public.online_channel_devices
          SET
            membership_status =
              'PASSIVE',
            metadata =
              COALESCE(
                metadata,
                '{}'::jsonb
              )
              || $2::jsonb,
            updated_at =
              now()
          WHERE stock_device_id =
            ANY($1::bigint[])
            AND channel IN (
              'N11',
              'IKAS',
              'IDEFIX'
            )
            AND UPPER(
              COALESCE(
                membership_status,
                ''
              )
            ) =
              ANY($3::text[])
        `,
        [
          ids,
          JSON.stringify({
            stockExitedAt:
              new Date()
                .toISOString(),
            source:
              "CENTER_STOCK_STATE",
          }),
          ACTIVE_MEMBERSHIP_STATUSES,
        ]
      );

      const passive =
        await client.query(
          `
            UPDATE public.stock_devices
            SET
              status =
                'PASSIVE',
              updated_at =
                now()
            WHERE id =
              ANY($1::bigint[])
              AND current_branch_code =
                  'CNET'
              AND status =
                  'AVAILABLE'
            RETURNING
              id,
              imei
          `,
          [
            ids,
          ]
        );

      for (
        const row of
          rows
      ) {
        await client.query(
          `
            INSERT INTO public.stock_events (
              device_id,
              imei,
              event_type,
              from_branch_code,
              to_branch_code,
              old_status,
              new_status,
              performed_by,
              metadata,
              created_at
            )
            VALUES (
              $1,
              $2,
              'STOCK_EXIT',
              'CNET',
              'CNET',
              'AVAILABLE',
              'PASSIVE',
              $3,
              $4::jsonb,
              now()
            )
          `,
          [
            Number(
              row.id
            ),
            text(
              row.imei
            ),
            user.username,
            JSON.stringify({
              source:
                "CENTER_STOCK_STATE",
              marketplaceSyncCompleted:
                true,
            }),
          ]
        );
      }

      await client.query(
        "COMMIT"
      );

      return json({
        success: true,
        action,
        passive:
          passive.rowCount ||
          0,
        message:
          `${passive.rowCount || 0} cihaz Stokta Olmayanlar bölümüne taşındı.`,
      });
    }

    return json(
      {
        success: false,
        error:
          "Bilinmeyen stok işlemi.",
      },
      400
    );
  } catch (error) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {}
    }

    console.error(
      "[CENTER STOCK STATE]",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof
          Error
            ? error.message
            : "Merkez stok işlemi başarısız.",
      },
      500
    );
  } finally {
    client?.release();
  }
}
