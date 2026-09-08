// app/api/online/ikas/n11-transfer/route.ts
// CNETMOBIL - IKAS ADIM 8.0 REVIZE
//
// N11 -> IKAS IMEI SECIMI + AYRI IKAS FIYATI
//
// GET:
// - N11 online_listings raw_data.availableImeis listesini okur.
// - stock_devices ile eşleştirir.
// - Aynı IMEI daha önce IKAS için hazırlanmış mı gösterir.
//
// POST:
// - Kullanıcının seçtiği IMEI'leri IKAS için PENDING_CREATE olarak kaydeder.
// - IKAS satış fiyatı / liste fiyatı AYRI tutulur.
// - N11 fiyatını DEĞİŞTİRMEZ.
// - IKAS API'ye ürün AÇMAZ.
// - Sonraki adım gerçek IKAS createProduct işlemidir.
//
// Böylece:
// - N11'de 100 IMEI olabilir.
// - Kullanıcı İkas'a sadece seçtiği 20 IMEI'yi hazırlar.
// - İkas fiyatı N11 fiyatından bağımsızdır.

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
  var cnetIkasN11TransferPool:
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
      .cnetIkasN11TransferPool
  ) {
    global
      .cnetIkasN11TransferPool =
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
    .cnetIkasN11TransferPool;
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

async function ensureSchema(
  client: PoolClient
) {
  const result =
    await client.query(
      `
        SELECT
          to_regclass(
            'public.online_channel_devices'
          ) IS NOT NULL AS has_channel_devices
      `
    );

  if (
    result.rows[0]
      ?.has_channel_devices !==
    true
  ) {
    throw new Error(
      "ADIM 8 REVIZE migration uygulanmamış. Önce ONLINE_ADIM8_REVIZE_KANAL_IMEI_UYELIK_MIGRATION.sql çalıştır."
    );
  }
}

function text(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function moneyOrNull(
  value: unknown
) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function parsePositiveMoney(
  value: unknown,
  label: string
) {
  const number =
    Number(
      String(
        value ?? ""
      )
        .replace(",", ".")
        .trim()
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    throw new Error(
      `${label} 0'dan büyük olmalı.`
    );
  }

  return Math.round(
    number * 100
  ) / 100;
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

function readAvailableImeis(
  rawData: any
) {
  if (
    !rawData ||
    typeof rawData !==
      "object"
  ) {
    return [];
  }

  return uniqueStrings(
    rawData
      ?.availableImeis
  );
}

async function loadCandidates(
  client: PoolClient
) {
  const listingsResult =
    await client.query(
      `
        SELECT
          id,
          external_stock_code,
          title,
          sale_price,
          list_price,
          quantity,
          raw_data
        FROM public.online_listings
        WHERE channel = 'N11'
        ORDER BY
          quantity DESC,
          id DESC
      `
    );

  const listings =
    listingsResult.rows
      .map(
        (listing: any) => ({
          ...listing,
          availableImeis:
            readAvailableImeis(
              listing?.raw_data
            ),
        })
      )
      .filter(
        (listing: any) =>
          listing
            .availableImeis
            .length > 0
      );

  const allImeis =
    Array.from(
      new Set(
        listings.flatMap(
          (listing: any) =>
            listing
              .availableImeis
        )
      )
    );

  if (
    allImeis.length === 0
  ) {
    return {
      groups: [],
      totalImeis: 0,
      availableStockDeviceCount:
        0,
      ikasPreparedCount: 0,
    };
  }

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
        WHERE imei =
          ANY($1::text[])
      `,
      [
        allImeis,
      ]
    );

  const deviceByImei =
    new Map<
      string,
      any
    >();

  for (
    const row of
      devicesResult.rows
  ) {
    deviceByImei.set(
      text(row?.imei),
      row
    );
  }

  const stockDeviceIds =
    devicesResult.rows
      .map(
        (row: any) =>
          Number(row?.id)
      )
      .filter(
        (value: number) =>
          Number.isFinite(
            value
          )
      );

  const membershipsResult =
    stockDeviceIds.length > 0
      ? await client.query(
          `
            SELECT
              stock_device_id,
              imei,
              channel,
              online_listing_id,
              membership_status,
              channel_sale_price,
              channel_list_price,
              source_channel,
              source_listing_id
            FROM public.online_channel_devices
            WHERE stock_device_id =
              ANY($1::bigint[])
          `,
          [
            stockDeviceIds,
          ]
        )
      : {
          rows: [],
        };

  const membershipMap =
    new Map<
      string,
      any
    >();

  for (
    const membership of
      membershipsResult.rows
  ) {
    membershipMap.set(
      `${membership.channel}:${membership.stock_device_id}`,
      membership
    );
  }

  let totalImeis = 0;
  let availableStockDeviceCount =
    0;
  let ikasPreparedCount = 0;

  const groups =
    listings.map(
      (listing: any) => {
        const imeis =
          listing
            .availableImeis
            .map(
              (
                imei: string
              ) => {
                const device =
                  deviceByImei.get(
                    imei
                  );

                const stockDeviceId =
                  device
                    ? Number(
                        device.id
                      )
                    : null;

                const ikasMembership =
                  stockDeviceId
                    ? membershipMap.get(
                        `IKAS:${stockDeviceId}`
                      )
                    : null;

                const n11Membership =
                  stockDeviceId
                    ? membershipMap.get(
                        `N11:${stockDeviceId}`
                      )
                    : null;

                totalImeis += 1;

                if (
                  device?.status ===
                  "AVAILABLE"
                ) {
                  availableStockDeviceCount +=
                    1;
                }

                if (
                  ikasMembership
                ) {
                  ikasPreparedCount +=
                    1;
                }

                return {
                  imei,
                  stockDeviceId,
                  foundInStockDevices:
                    Boolean(
                      device
                    ),
                  deviceStatus:
                    device
                      ?.status ??
                    null,
                  branchCode:
                    device
                      ?.current_branch_code ??
                    null,

                  brand:
                    device
                      ?.brand ??
                    null,
                  model:
                    device
                      ?.model ??
                    null,
                  memory:
                    device
                      ?.memory ??
                    null,
                  color:
                    device
                      ?.color ??
                    null,
                  grade:
                    device
                      ?.grade ??
                    null,
                  warranty:
                    device
                      ?.warranty ??
                    null,

                  n11Membership:
                    n11Membership
                      ? {
                          status:
                            n11Membership
                              .membership_status,
                          salePrice:
                            moneyOrNull(
                              n11Membership
                                .channel_sale_price
                            ),
                          listPrice:
                            moneyOrNull(
                              n11Membership
                                .channel_list_price
                            ),
                        }
                      : null,

                  ikasMembership:
                    ikasMembership
                      ? {
                          status:
                            ikasMembership
                              .membership_status,
                          salePrice:
                            moneyOrNull(
                              ikasMembership
                                .channel_sale_price
                            ),
                          listPrice:
                            moneyOrNull(
                              ikasMembership
                                .channel_list_price
                            ),
                        }
                      : null,
                };
              }
            );

        return {
          listingId:
            Number(
              listing.id
            ),
          stockCode:
            listing
              .external_stock_code,
          title:
            listing.title,
          n11SalePrice:
            moneyOrNull(
              listing
                .sale_price
            ),
          n11ListPrice:
            moneyOrNull(
              listing
                .list_price
            ),
          n11Quantity:
            Number(
              listing
                .quantity ||
                0
            ),
          imeiCount:
            imeis.length,
          imeis,
        };
      }
    );

  return {
    groups,
    totalImeis,
    availableStockDeviceCount,
    ikasPreparedCount,
  };
}

export async function GET(
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

    await ensureSchema(
      client
    );

    const result =
      await loadCandidates(
        client
      );

    return json({
      success: true,
      mode:
        "N11_TO_IKAS_MANUAL_IMEI_SELECTION",
      autoCreateIkas:
        false,
      pricesShared:
        false,
      ...result,
      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "IKAS N11 TRANSFER GET ERROR:",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "N11 IMEI listesi okunamadı.",
      },
      500
    );
  } finally {
    client?.release();
  }
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

    const body =
      await request.json();

    const listingId =
      Number(
        body?.listingId
      );

    const imeis =
      uniqueStrings(
        body?.imeis
      );

    const ikasSalePrice =
      parsePositiveMoney(
        body?.ikasSalePrice,
        "İkas satış fiyatı"
      );

    const ikasListPrice =
      parsePositiveMoney(
        body?.ikasListPrice,
        "İkas liste fiyatı"
      );

    if (
      !Number.isFinite(
        listingId
      ) ||
      listingId <= 0
    ) {
      return json(
        {
          success: false,
          error:
            "Geçerli N11 listingId gerekli.",
        },
        400
      );
    }

    if (
      imeis.length === 0
    ) {
      return json(
        {
          success: false,
          error:
            "En az 1 IMEI seç.",
        },
        400
      );
    }

    client =
      await getPool().connect();

    await client.query(
      "BEGIN"
    );

    await ensureSchema(
      client
    );

    const listingResult =
      await client.query(
        `
          SELECT
            id,
            external_stock_code,
            title,
            sale_price,
            list_price,
            raw_data
          FROM public.online_listings
          WHERE id = $1
            AND channel = 'N11'
          LIMIT 1
        `,
        [
          listingId,
        ]
      );

    const listing =
      listingResult.rows[0];

    if (!listing) {
      throw new Error(
        "N11 listing bulunamadı."
      );
    }

    const availableImeis =
      readAvailableImeis(
        listing?.raw_data
      );

    const invalidImeis =
      imeis.filter(
        (imei) =>
          !availableImeis.includes(
            imei
          )
      );

    if (
      invalidImeis.length >
      0
    ) {
      throw new Error(
        `${invalidImeis.length} IMEI bu N11 listing'in availableImeis havuzunda değil.`
      );
    }

    const devicesResult =
      await client.query(
        `
          SELECT
            id,
            imei,
            status,
            brand,
            model,
            memory,
            color,
            grade,
            warranty
          FROM public.stock_devices
          WHERE imei =
            ANY($1::text[])
          FOR UPDATE
        `,
        [
          imeis,
        ]
      );

    const deviceByImei =
      new Map<
        string,
        any
      >();

    for (
      const device of
        devicesResult.rows
    ) {
      deviceByImei.set(
        text(
          device?.imei
        ),
        device
      );
    }

    const missing =
      imeis.filter(
        (imei) =>
          !deviceByImei.has(
            imei
          )
      );

    if (
      missing.length > 0
    ) {
      throw new Error(
        `${missing.length} IMEI stock_devices içinde bulunamadı.`
      );
    }

    const unavailable =
      imeis.filter(
        (imei) =>
          deviceByImei.get(
            imei
          )?.status !==
          "AVAILABLE"
      );

    if (
      unavailable.length >
      0
    ) {
      throw new Error(
        `${unavailable.length} IMEI AVAILABLE değil. İkas'a hazırlanmadı.`
      );
    }

    let n11Linked = 0;
    let ikasPrepared = 0;
    let ikasUpdated = 0;

    for (
      const imei of imeis
    ) {
      const device =
        deviceByImei.get(
          imei
        );

      const stockDeviceId =
        Number(
          device.id
        );

      const n11Result =
        await client.query(
          `
            INSERT INTO public.online_channel_devices AS cd (
              stock_device_id,
              imei,
              channel,
              online_listing_id,
              membership_status,
              channel_sale_price,
              channel_list_price,
              source_channel,
              source_listing_id,
              metadata,
              listed_at,
              updated_at
            )
            VALUES (
              $1,
              $2,
              'N11',
              $3,
              'LISTED',
              $4,
              $5,
              'N11',
              $3,
              $6::jsonb,
              now(),
              now()
            )
            ON CONFLICT (
              channel,
              stock_device_id
            )
            DO UPDATE SET
              online_listing_id =
                EXCLUDED.online_listing_id,
              imei =
                EXCLUDED.imei,
              membership_status =
                CASE
                  WHEN cd.membership_status IN (
                    'SOLD',
                    'RESERVED'
                  )
                    THEN cd.membership_status
                  ELSE 'LISTED'
                END,
              channel_sale_price =
                EXCLUDED.channel_sale_price,
              channel_list_price =
                EXCLUDED.channel_list_price,
              source_channel =
                EXCLUDED.source_channel,
              source_listing_id =
                EXCLUDED.source_listing_id,
              metadata =
                COALESCE(
                  cd.metadata,
                  '{}'::jsonb
                )
                ||
                EXCLUDED.metadata,
              updated_at =
                now()
            RETURNING id
          `,
          [
            stockDeviceId,
            imei,
            listingId,
            moneyOrNull(
              listing
                .sale_price
            ),
            moneyOrNull(
              listing
                .list_price
            ),
            JSON.stringify({
              source:
                "N11_AVAILABLE_IMEI",
              sourceStockCode:
                listing
                  .external_stock_code,
            }),
          ]
        );

      if (
        n11Result.rowCount ===
        1
      ) {
        n11Linked += 1;
      }

      const existingIkas =
        await client.query(
          `
            SELECT
              membership_status
            FROM public.online_channel_devices
            WHERE channel = 'IKAS'
              AND stock_device_id = $1
            LIMIT 1
            FOR UPDATE
          `,
          [
            stockDeviceId,
          ]
        );

      const currentStatus =
        text(
          existingIkas
            .rows[0]
            ?.membership_status
        );

      if (
        [
          "SOLD",
          "RESERVED",
        ].includes(
          currentStatus
        )
      ) {
        throw new Error(
          `IMEI ${imei} IKAS üyeliği ${currentStatus}. Güvenlik için işlem durduruldu.`
        );
      }

      const ikasResult =
        await client.query(
          `
            INSERT INTO public.online_channel_devices AS cd (
              stock_device_id,
              imei,
              channel,
              online_listing_id,
              membership_status,
              channel_sale_price,
              channel_list_price,
              source_channel,
              source_listing_id,
              metadata,
              updated_at
            )
            VALUES (
              $1,
              $2,
              'IKAS',
              NULL,
              'PENDING_CREATE',
              $3,
              $4,
              'N11',
              $5,
              $6::jsonb,
              now()
            )
            ON CONFLICT (
              channel,
              stock_device_id
            )
            DO UPDATE SET
              imei =
                EXCLUDED.imei,
              membership_status =
                'PENDING_CREATE',
              channel_sale_price =
                EXCLUDED.channel_sale_price,
              channel_list_price =
                EXCLUDED.channel_list_price,
              source_channel =
                'N11',
              source_listing_id =
                EXCLUDED.source_listing_id,
              metadata =
                COALESCE(
                  cd.metadata,
                  '{}'::jsonb
                )
                ||
                EXCLUDED.metadata,
              updated_at =
                now()
            RETURNING
              id,
              (
                xmax = 0
              ) AS inserted
          `,
          [
            stockDeviceId,
            imei,
            ikasSalePrice,
            ikasListPrice,
            listingId,
            JSON.stringify({
              preparedBy:
                "N11_TO_IKAS",
              n11SalePrice:
                moneyOrNull(
                  listing
                    .sale_price
                ),
              n11ListPrice:
                moneyOrNull(
                  listing
                    .list_price
                ),
              ikasSalePrice,
              ikasListPrice,
              preparedAt:
                new Date()
                  .toISOString(),
            }),
          ]
        );

      if (
        ikasResult.rows[0]
          ?.inserted ===
        true
      ) {
        ikasPrepared += 1;
      } else {
        ikasUpdated += 1;
      }
    }

    await client.query(
      "COMMIT"
    );

    return json({
      success: true,

      source: {
        channel:
          "N11",
        listingId,
        stockCode:
          listing
            .external_stock_code,
        title:
          listing.title,
        n11SalePrice:
          moneyOrNull(
            listing
              .sale_price
          ),
        n11ListPrice:
          moneyOrNull(
            listing
              .list_price
          ),
      },

      target: {
        channel:
          "IKAS",
        ikasSalePrice,
        ikasListPrice,
        status:
          "PENDING_CREATE",
      },

      selectedImeiCount:
        imeis.length,
      n11MembershipLinked:
        n11Linked,
      ikasPrepared,
      ikasUpdated,

      safety: {
        ikasApiWrite:
          false,
        n11ApiWrite:
          false,
        stockDeviceStatusChanged:
          false,
        pricesShared:
          false,
        autoCreateOtherChannel:
          false,
      },

      message:
        `${imeis.length} IMEI İkas için hazırlandı. N11 fiyatı değişmedi. İkas fiyatı ayrı kaydedildi.`,

      next:
        "ADIM 8.1: PENDING_CREATE IMEI'leri gerçek İkas ürün/varyantına gönder ve IKAS membership_status=LISTED yap.",

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
      "IKAS N11 TRANSFER POST ERROR:",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "IMEI'ler İkas için hazırlanamadı.",
      },
      500
    );
  } finally {
    client?.release();
  }
}
