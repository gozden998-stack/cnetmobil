// app/api/online/center/devices/route.ts
// CNETMOBIL - MERKEZ ADIM 1
//
// READ ONLY.
// Merkezi fiziksel IMEI stok ekranı.
//
// Kaynaklar:
// - public.stock_devices         : fiziksel cihaz / IMEI source of truth
// - public.online_channel_devices: kanal bazlı IMEI üyeliği (varsa)
// - public.online_listings       : N11 eski availableImeis kayıtlarından
//                                  read-only fallback kanal durumu
//
// Bu route:
// - hiçbir marketplace API'sine yazmaz
// - stok değiştirmez
// - ürün oluşturmaz
// - aynı IMEI'nin N11 / IKAS / IDEFIX durumunu döndürür

import {
  NextRequest,
  NextResponse,
} from "next/server";
import {
  Pool,
} from "pg";
import crypto from "crypto";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

declare global {
  // eslint-disable-next-line no-var
  var cnetCenterDevicesPool:
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

type ChannelCode =
  | "N11"
  | "IKAS"
  | "IDEFIX";

type ChannelStatus = {
  channel: ChannelCode;
  status: string | null;
  listingId: number | null;
  salePrice: number | null;
  listPrice: number | null;
  source: string | null;
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
      .cnetCenterDevicesPool
  ) {
    global
      .cnetCenterDevicesPool =
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
    .cnetCenterDevicesPool;
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
          "Merkez ekranı yalnızca Super Admin içindir.",
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

function numberOrNull(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    text(value) === ""
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

  return (
    text(value) || "-"
  );
}

function groupKey(
  device: any
) {
  return [
    normalizePart(
      device?.brand
    ),
    normalizePart(
      device?.model
    ),
    normalizePart(
      device?.memory
    ),
    normalizePart(
      device?.color
    ),
    normalizePart(
      normalizeGrade(
        device?.grade
      )
    ),
    normalizePart(
      device?.warranty
    ),
  ].join("|");
}

function emptyChannel(
  channel: ChannelCode
): ChannelStatus {
  return {
    channel,
    status: null,
    listingId: null,
    salePrice: null,
    listPrice: null,
    source: null,
  };
}

function statusPriority(
  status: unknown
) {
  const value =
    text(status)
      .toUpperCase();

  if (value === "SOLD") {
    return 100;
  }

  if (
    value === "RESERVED"
  ) {
    return 90;
  }

  if (
    value === "LISTED"
  ) {
    return 80;
  }

  if (
    value ===
    "PENDING_CREATE"
  ) {
    return 70;
  }

  if (
    value === "ERROR"
  ) {
    return 60;
  }

  return 10;
}

export async function GET(
  request: NextRequest
) {
  try {
    const authError =
      await requireSuperAdmin(
        request
      );

    if (authError) {
      return authError;
    }

    const pool =
      getPool();

    const schemaResult =
      await pool.query(
        `
          SELECT
            to_regclass(
              'public.online_channel_devices'
            ) IS NOT NULL AS has_channel_devices
        `
      );

    const hasChannelDevices =
      schemaResult.rows[0]
        ?.has_channel_devices ===
      true;

    const devicesResult =
      await pool.query(
        `
          SELECT
            id,
            imei,
            brand,
            model,
            memory,
            color,
            battery_percent,
            grade,
            warranty,
            changed_parts,
            box_invoice,
            current_branch_code,
            status,
            source,
            created_at,
            updated_at
          FROM public.stock_devices
          WHERE status <> 'PASSIVE'
          ORDER BY
            CASE status
              WHEN 'AVAILABLE'
                THEN 1
              WHEN 'DETAILS_PENDING'
                THEN 2
              WHEN 'REQUESTED'
                THEN 3
              WHEN 'TRANSFER_WAITING'
                THEN 4
              WHEN 'SOLD'
                THEN 5
              ELSE 6
            END,
            updated_at DESC,
            id DESC
        `
      );

    const channelRows =
      hasChannelDevices
        ? (
            await pool.query(
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
                  updated_at
                FROM public.online_channel_devices
                WHERE channel IN (
                  'N11',
                  'IKAS',
                  'IDEFIX'
                )
              `
            )
          ).rows
        : [];

    // Eski N11 yapısında online_channel_devices üyeliği henüz yazılmamış
    // olabilir. raw_data.availableImeis üzerinden sadece ekranda LISTED
    // fallback gösteriyoruz. Hiçbir DB kaydı değiştirilmez.
    const n11FallbackResult =
      await pool.query(
        `
          SELECT
            id,
            sale_price,
            list_price,
            raw_data
          FROM public.online_listings
          WHERE channel = 'N11'
            AND jsonb_typeof(
              raw_data->'availableImeis'
            ) = 'array'
        `
      );

    const channelByDeviceId =
      new Map<
        number,
        Map<
          ChannelCode,
          ChannelStatus
        >
      >();

    const channelByImei =
      new Map<
        string,
        Map<
          ChannelCode,
          ChannelStatus
        >
      >();

    const setStatus = (
      deviceId: number | null,
      imei: string,
      next: ChannelStatus
    ) => {
      if (
        deviceId &&
        Number.isFinite(
          deviceId
        )
      ) {
        if (
          !channelByDeviceId.has(
            deviceId
          )
        ) {
          channelByDeviceId.set(
            deviceId,
            new Map()
          );
        }

        const map =
          channelByDeviceId.get(
            deviceId
          )!;

        const existing =
          map.get(
            next.channel
          );

        if (
          !existing ||
          statusPriority(
            next.status
          ) >=
            statusPriority(
              existing.status
            )
        ) {
          map.set(
            next.channel,
            next
          );
        }
      }

      if (imei) {
        if (
          !channelByImei.has(
            imei
          )
        ) {
          channelByImei.set(
            imei,
            new Map()
          );
        }

        const map =
          channelByImei.get(
            imei
          )!;

        const existing =
          map.get(
            next.channel
          );

        if (
          !existing ||
          statusPriority(
            next.status
          ) >=
            statusPriority(
              existing.status
            )
        ) {
          map.set(
            next.channel,
            next
          );
        }
      }
    };

    for (
      const row of
        channelRows
    ) {
      const channel =
        text(
          row?.channel
        ).toUpperCase() as
          ChannelCode;

      if (
        ![
          "N11",
          "IKAS",
          "IDEFIX",
        ].includes(
          channel
        )
      ) {
        continue;
      }

      setStatus(
        Number(
          row
            ?.stock_device_id
        ),
        text(
          row?.imei
        ),
        {
          channel,
          status:
            text(
              row
                ?.membership_status
            ) || null,
          listingId:
            numberOrNull(
              row
                ?.online_listing_id
            ),
          salePrice:
            numberOrNull(
              row
                ?.channel_sale_price
            ),
          listPrice:
            numberOrNull(
              row
                ?.channel_list_price
            ),
          source:
            text(
              row
                ?.source_channel
            ) || "CHANNEL_DEVICE",
        }
      );
    }

    for (
      const listing of
        n11FallbackResult.rows
    ) {
      const availableImeis =
        Array.isArray(
          listing?.raw_data
            ?.availableImeis
        )
          ? listing
              .raw_data
              .availableImeis
          : [];

      for (
        const rawImei of
          availableImeis
      ) {
        const imei =
          text(rawImei);

        if (!imei) {
          continue;
        }

        const current =
          channelByImei
            .get(imei)
            ?.get("N11");

        if (current) {
          continue;
        }

        setStatus(
          null,
          imei,
          {
            channel: "N11",
            status: "LISTED",
            listingId:
              numberOrNull(
                listing?.id
              ),
            salePrice:
              numberOrNull(
                listing
                  ?.sale_price
              ),
            listPrice:
              numberOrNull(
                listing
                  ?.list_price
              ),
            source:
              "N11_AVAILABLE_IMEI",
          }
        );
      }
    }

    const devices =
      devicesResult.rows.map(
        (device: any) => {
          const id =
            Number(
              device?.id
            );

          const imei =
            text(
              device?.imei
            );

          const idMap =
            channelByDeviceId.get(
              id
            );

          const imeiMap =
            channelByImei.get(
              imei
            );

          const getChannel = (
            channel: ChannelCode
          ) =>
            idMap?.get(
              channel
            ) ||
            imeiMap?.get(
              channel
            ) ||
            emptyChannel(
              channel
            );

          const channels = {
            N11:
              getChannel(
                "N11"
              ),
            IKAS:
              getChannel(
                "IKAS"
              ),
            IDEFIX:
              getChannel(
                "IDEFIX"
              ),
          };

          return {
            ...device,
            id,
            grade:
              normalizeGrade(
                device?.grade
              ),
            groupKey:
              groupKey(
                device
              ),
            channels,
          };
        }
      );

    const groupsMap =
      new Map<
        string,
        any
      >();

    for (
      const device of
        devices
    ) {
      const key =
        device.groupKey;

      if (
        !groupsMap.has(
          key
        )
      ) {
        groupsMap.set(
          key,
          {
            key,
            brand:
              text(
                device.brand
              ) || "-",
            model:
              text(
                device.model
              ) || "-",
            memory:
              text(
                device.memory
              ) || "-",
            color:
              text(
                device.color
              ) || "-",
            grade:
              text(
                device.grade
              ) || "-",
            warranty:
              text(
                device.warranty
              ) || "-",
            devices: [],
          }
        );
      }

      groupsMap
        .get(key)!
        .devices.push(
          device
        );
    }

    const groups =
      Array.from(
        groupsMap.values()
      )
        .map(
          (group: any) => {
            const groupDevices =
              group.devices;

            const countStatus = (
              channel: ChannelCode,
              statuses: string[]
            ) =>
              groupDevices.filter(
                (
                  device: any
                ) =>
                  statuses.includes(
                    text(
                      device
                        ?.channels?.[
                        channel
                      ]?.status
                    ).toUpperCase()
                  )
              ).length;

            return {
              ...group,
              total:
                groupDevices.length,
              available:
                groupDevices.filter(
                  (
                    device: any
                  ) =>
                    device.status ===
                    "AVAILABLE"
                ).length,

              channelSummary: {
                N11: {
                  sent:
                    countStatus(
                      "N11",
                      [
                        "LISTED",
                        "RESERVED",
                        "SOLD",
                      ]
                    ),
                  preparing:
                    countStatus(
                      "N11",
                      [
                        "PENDING_CREATE",
                      ]
                    ),
                },
                IKAS: {
                  sent:
                    countStatus(
                      "IKAS",
                      [
                        "LISTED",
                        "RESERVED",
                        "SOLD",
                      ]
                    ),
                  preparing:
                    countStatus(
                      "IKAS",
                      [
                        "PENDING_CREATE",
                      ]
                    ),
                },
                IDEFIX: {
                  sent:
                    countStatus(
                      "IDEFIX",
                      [
                        "LISTED",
                        "RESERVED",
                        "SOLD",
                      ]
                    ),
                  preparing:
                    countStatus(
                      "IDEFIX",
                      [
                        "PENDING_CREATE",
                      ]
                    ),
                },
              },
            };
          }
        )
        .sort(
          (
            a: any,
            b: any
          ) =>
            b.available -
              a.available ||
            b.total -
              a.total ||
            `${a.brand} ${a.model}`.localeCompare(
              `${b.brand} ${b.model}`,
              "tr"
            )
        );

    const activeDevices =
      devices.filter(
        (device: any) =>
          ![
            "SOLD",
            "PASSIVE",
          ].includes(
            text(
              device?.status
            ).toUpperCase()
          )
      );

    const listedCount = (
      channel: ChannelCode
    ) =>
      devices.filter(
        (device: any) =>
          [
            "LISTED",
            "RESERVED",
            "SOLD",
            "PENDING_CREATE",
          ].includes(
            text(
              device
                ?.channels?.[
                channel
              ]?.status
            ).toUpperCase()
          )
      ).length;

    return json({
      success: true,
      readOnly: true,

      summary: {
        totalDevices:
          devices.length,
        activePhysicalStock:
          activeDevices.length,
        availableDevices:
          devices.filter(
            (device: any) =>
              device.status ===
              "AVAILABLE"
          ).length,
        soldDevices:
          devices.filter(
            (device: any) =>
              device.status ===
              "SOLD"
          ).length,
        groupCount:
          groups.length,
        n11:
          listedCount(
            "N11"
          ),
        ikas:
          listedCount(
            "IKAS"
          ),
        idefix:
          listedCount(
            "IDEFIX"
          ),
      },

      channelMembershipTableReady:
        hasChannelDevices,

      groups,
      devices,

      safety: {
        marketplaceWrite:
          false,
        stockWrite:
          false,
        deviceStatusWrite:
          false,
      },

      checkedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "CENTER DEVICES ERROR:",
      error
    );

    return json(
      {
        success: false,
        readOnly: true,
        error:
          error instanceof Error
            ? error.message
            : "Merkez stok listesi alınamadı.",
      },
      500
    );
  }
}
