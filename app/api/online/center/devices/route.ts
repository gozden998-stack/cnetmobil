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
  type PoolClient,
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

const CENTER_BRANCH_CODE =
  "CNET";

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


function validateOrigin(
  request: NextRequest
) {
  const origin =
    request.headers.get(
      "origin"
    );

  const expectedAppUrl =
    process.env.APP_URL;

  if (!origin) {
    return false;
  }

  if (expectedAppUrl) {
    try {
      return (
        origin ===
        new URL(
          expectedAppUrl
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

  if (!host) {
    return false;
  }

  return (
    origin ===
    `${proto}://${host}`
  );
}

async function getSuperAdminUser(
  request: NextRequest
) {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return null;
  }

  const session =
    verifySession(token);

  if (!session?.userId) {
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
              ON r.id = ur.role_id
            WHERE ur.user_id = u.id
              AND r.code = 'super_admin'
              AND r.active = TRUE
          ) AS is_super_admin
        FROM public.users u
        WHERE u.id = $1
        LIMIT 1
      `,
      [session.userId]
    );

  const row =
    result.rows[0];

  if (
    !row ||
    row.active !== true ||
    row.is_super_admin !== true
  ) {
    return null;
  }

  return {
    id: Number(row.id),
    username: String(
      row.username
    ),
  };
}

function collapseSpaces(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(/\s+/g, " ");
}

function cleanRequired(
  value: unknown,
  label: string,
  maxLength: number
) {
  const result =
    collapseSpaces(value);

  if (!result) {
    throw new Error(
      `${label} zorunludur.`
    );
  }

  if (
    result.length >
    maxLength
  ) {
    throw new Error(
      `${label} çok uzun.`
    );
  }

  return result;
}

function normalizeImei(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .replace(/\D/g, "")
    .trim();
}

function normalizeMemoryInput(
  value: unknown
) {
  const raw =
    collapseSpaces(value);

  if (!raw) {
    throw new Error(
      "Hafıza zorunludur."
    );
  }

  const compact =
    raw
      .toLocaleUpperCase(
        "tr-TR"
      )
      .replace(/\s+/g, "");

  const match =
    compact.match(
      /^(\d+(?:[.,]\d+)?)(GB|TB)$/
    );

  if (match) {
    const amount =
      match[1].replace(
        ",",
        "."
      );

    return `${amount} ${match[2]}`;
  }

  if (
    raw.length > 50
  ) {
    throw new Error(
      "Hafıza çok uzun."
    );
  }

  return raw;
}

function normalizeGradeInput(
  value: unknown
) {
  const raw =
    collapseSpaces(value)
      .toLocaleUpperCase(
        "tr-TR"
      );

  const folded =
    raw
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /[^A-Z0-9]+/g,
        ""
      );

  if (
    folded === "A" ||
    folded === "AKALITE" ||
    folded.includes(
      "MUKEMMEL"
    )
  ) {
    return "A";
  }

  if (
    folded === "B" ||
    folded === "BKALITE" ||
    folded.includes(
      "COKIYI"
    )
  ) {
    return "B";
  }

  if (
    folded === "C" ||
    folded === "CKALITE" ||
    folded === "IYI"
  ) {
    return "C";
  }

  throw new Error(
    "Grade yalnızca A, B veya C olabilir."
  );
}

function normalizeWarrantyInput(
  value: unknown
) {
  const raw =
    collapseSpaces(value);

  if (!raw) {
    throw new Error(
      "Garanti zorunludur."
    );
  }

  const folded =
    raw
      .toLocaleLowerCase(
        "tr-TR"
      )
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .replace(
        /\s+/g,
        ""
      )
      .replace(
        /garantili/g,
        ""
      );

  const monthMatch =
    folded.match(
      /^(\d{1,2})ay$/
    );

  if (monthMatch) {
    return `${Number(
      monthMatch[1]
    )} Ay`;
  }

  const yearMatch =
    folded.match(
      /^(\d{1,2})yil$/
    );

  if (yearMatch) {
    return `${
      Number(
        yearMatch[1]
      ) * 12
    } Ay`;
  }

  if (
    raw.length > 100
  ) {
    throw new Error(
      "Garanti çok uzun."
    );
  }

  return raw;
}

async function ensureCenterBranch(
  client: PoolClient
) {
  const result =
    await client.query(
      `
        SELECT
          code
        FROM public.branches
        WHERE code = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [CENTER_BRANCH_CODE]
    );

  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      "CNET merkez stok kodu aktif değil. Cihaz kaydı yapılmadı."
    );
  }
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



type BulkDeviceInput = {
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
};

function parseImeiList(
  value: unknown
) {
  const raw =
    String(
      value ?? ""
    ).trim();

  if (!raw) {
    return [];
  }

  return raw
    .split(
      /[\s,;|]+/g
    )
    .map(
      (item) =>
        item.replace(
          /\D/g,
          ""
        )
    )
    .filter(Boolean);
}

function buildBulkRows(
  data: Record<
    string,
    unknown
  >
) {
  const brand =
    cleanRequired(
      data.brand,
      "Marka",
      100
    );

  const model =
    cleanRequired(
      data.model,
      "Model",
      180
    );

  const memory =
    normalizeMemoryInput(
      data.memory
    );

  const color =
    cleanRequired(
      data.color,
      "Renk",
      100
    );

  const grade =
    normalizeGradeInput(
      data.grade
    );

  const warranty =
    normalizeWarrantyInput(
      data.warranty
    );

  const imeis =
    parseImeiList(
      data.imeis
    );

  if (
    imeis.length === 0
  ) {
    throw new Error(
      "En az 1 IMEI girilmelidir."
    );
  }

  if (
    imeis.length > 500
  ) {
    throw new Error(
      "Tek seferde en fazla 500 IMEI eklenebilir."
    );
  }

  return imeis.map(
    (
      imei
    ): BulkDeviceInput => ({
      imei,
      brand,
      model,
      memory,
      color,
      grade,
      warranty,
    })
  );
}

async function validateBulkRows(
  client: PoolClient,
  rows: BulkDeviceInput[]
) {
  const errors:
    Array<{
      imei: string;
      reason: string;
      type:
        | "INVALID_IMEI"
        | "DUPLICATE_INPUT"
        | "ALREADY_EXISTS";
    }> = [];

  const seen =
    new Set<string>();

  for (
    const row of rows
  ) {
    if (
      !/^[0-9]{15}$/.test(
        row.imei
      )
    ) {
      errors.push({
        imei: row.imei,
        reason:
          "IMEI tam 15 hane olmalıdır.",
        type:
          "INVALID_IMEI",
      });
      continue;
    }

    if (
      seen.has(
        row.imei
      )
    ) {
      errors.push({
        imei: row.imei,
        reason:
          "Aynı IMEI listede birden fazla kez var.",
        type:
          "DUPLICATE_INPUT",
      });
      continue;
    }

    seen.add(
      row.imei
    );
  }

  const validImeis =
    Array.from(seen).filter(
      (imei) =>
        /^[0-9]{15}$/.test(
          imei
        )
    );

  if (
    validImeis.length > 0
  ) {
    const existing =
      await client.query(
        `
          SELECT
            imei,
            brand,
            model,
            current_branch_code,
            status
          FROM public.stock_devices
          WHERE imei = ANY($1::text[])
        `,
        [
          validImeis,
        ]
      );

    for (
      const existingRow of
        existing.rows
    ) {
      errors.push({
        imei: String(
          existingRow.imei
        ),
        reason:
          `Bu IMEI zaten sistemde kayıtlı. ` +
          `${String(
            existingRow.brand ||
              ""
          )} ${String(
            existingRow.model ||
              ""
          )}`.trim() +
          ` · Durum: ${String(
            existingRow.status ||
              "-"
          )}.`,
        type:
          "ALREADY_EXISTS",
      });
    }
  }

  const badImeis =
    new Set(
      errors.map(
        (item) =>
          item.imei
      )
    );

  const validRows =
    rows.filter(
      (row) =>
        !badImeis.has(
          row.imei
        ) &&
        /^[0-9]{15}$/.test(
          row.imei
        )
    );

  return {
    errors,
    validRows,
    total:
      rows.length,
    validCount:
      validRows.length,
    errorCount:
      errors.length,
    canCommit:
      errors.length === 0 &&
      validRows.length ===
        rows.length,
  };
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
      await getSuperAdminUser(
        request
      );

    if (!user) {
      return json(
        {
          success: false,
          error:
            "Merkez cihaz girişi yalnızca Super Admin içindir.",
        },
        403
      );
    }

    const contentLength =
      Number(
        request.headers.get(
          "content-length"
        ) || 0
      );

    if (
      contentLength >
      50_000
    ) {
      return json(
        {
          success: false,
          error:
            "İstek çok büyük.",
        },
        413
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
      Array.isArray(body)
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

    const imei =
      normalizeImei(
        data.imei
      );

    if (
      !/^[0-9]{15}$/.test(
        imei
      )
    ) {
      return json(
        {
          success: false,
          error:
            "IMEI tam 15 hane ve yalnızca rakam olmalıdır.",
        },
        400
      );
    }

    let brand: string;
    let model: string;
    let memory: string;
    let color: string;
    let grade: string;
    let warranty: string;

    try {
      brand =
        cleanRequired(
          data.brand,
          "Marka",
          100
        );

      model =
        cleanRequired(
          data.model,
          "Model",
          180
        );

      memory =
        normalizeMemoryInput(
          data.memory
        );

      color =
        cleanRequired(
          data.color,
          "Renk",
          100
        );

      grade =
        normalizeGradeInput(
          data.grade
        );

      warranty =
        normalizeWarrantyInput(
          data.warranty
        );
    } catch (error) {
      return json(
        {
          success: false,
          error:
            error instanceof
              Error
              ? error.message
              : "Cihaz bilgileri geçersiz.",
        },
        400
      );
    }

    client =
      await getPool().connect();

    await client.query(
      "BEGIN"
    );

    await ensureCenterBranch(
      client
    );

    const duplicate =
      await client.query(
        `
          SELECT
            id,
            imei,
            brand,
            model,
            current_branch_code,
            status
          FROM public.stock_devices
          WHERE imei = $1
          LIMIT 1
          FOR UPDATE
        `,
        [imei]
      );

    if (
      duplicate.rowCount
    ) {
      await client.query(
        "ROLLBACK"
      );

      const existing =
        duplicate.rows[0];

      return json(
        {
          success: false,
          error:
            `Bu IMEI zaten sistemde kayıtlı. ` +
            `${String(
              existing?.brand ||
                ""
            )} ${String(
              existing?.model ||
                ""
            )}`.trim() +
            ` · Durum: ${String(
              existing?.status ||
                "-"
            )}.`,
          duplicate: {
            id: Number(
              existing.id
            ),
            imei: String(
              existing.imei
            ),
            branch:
              String(
                existing
                  .current_branch_code ||
                  ""
              ),
            status:
              String(
                existing.status ||
                  ""
              ),
          },
        },
        409
      );
    }

    const insertResult =
      await client.query(
        `
          INSERT INTO public.stock_devices (
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
            details_completed_at,
            details_completed_by,
            created_by
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            NULL,
            $6,
            $7,
            NULL,
            NULL,
            $8,
            'AVAILABLE',
            'MANUAL',
            NULL,
            NULL,
            $9
          )
          RETURNING
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
            source,
            created_at,
            updated_at
        `,
        [
          imei,
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          CENTER_BRANCH_CODE,
          user.username,
        ]
      );

    const device =
      insertResult.rows[0];

    await client.query(
      `
        INSERT INTO public.stock_events (
          device_id,
          imei,
          event_type,
          to_branch_code,
          old_status,
          new_status,
          performed_by,
          metadata
        )
        VALUES (
          $1,
          $2,
          'DEVICE_ADDED',
          $3,
          NULL,
          'AVAILABLE',
          $4,
          $5::jsonb
        )
      `,
      [
        device.id,
        imei,
        CENTER_BRANCH_CODE,
        user.username,
        JSON.stringify({
          source:
            "CENTER_MANUAL",
          entry:
            "ONLINE_CENTER",
          brand,
          model,
          memory,
          color,
          grade,
          warranty,
          marketplaceWrite:
            false,
        }),
      ]
    );

    await client.query(
      "COMMIT"
    );

    return json(
      {
        success: true,
        message:
          "Cihaz Merkez stoğuna eklendi.",
        device,
        safety: {
          n11Write:
            false,
          ikasWrite:
            false,
          idefixWrite:
            false,
          onlineListingWrite:
            false,
          channelMembershipWrite:
            false,
        },
      },
      201
    );
  } catch (
    error: any
  ) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // rollback failure ignored
      }
    }

    if (
      error?.code ===
      "23505"
    ) {
      return json(
        {
          success: false,
          error:
            "Bu IMEI zaten sistemde kayıtlı.",
        },
        409
      );
    }

    console.error(
      "CENTER DEVICE CREATE ERROR:",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof
            Error
            ? error.message
            : "Cihaz Merkez stoğuna eklenemedi.",
      },
      500
    );
  } finally {
    client?.release();
  }
}


export async function PUT(
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
      await getSuperAdminUser(
        request
      );

    if (!user) {
      return json(
        {
          success: false,
          error:
            "Merkez toplu cihaz girişi yalnızca Super Admin içindir.",
        },
        403
      );
    }

    const contentLength =
      Number(
        request.headers.get(
          "content-length"
        ) || 0
      );

    if (
      contentLength >
      500_000
    ) {
      return json(
        {
          success: false,
          error:
            "Toplu cihaz isteği çok büyük.",
        },
        413
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
      Array.isArray(body)
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
      String(
        data.action || ""
      )
        .trim()
        .toLowerCase();

    if (
      action ===
      "channel_preview"
    ) {
      client =
        await getPool().connect();

      try {
        const preview =
          await previewCenterChannelSend(
            client,
            data
          );

        return json({
          success: true,
          action:
            "channel_preview",
          preview,
        });
      } catch (error) {
        return json(
          {
            success: false,
            action:
              "channel_preview",
            error:
              error instanceof
                Error
                ? error.message
                : "Kanal ön kontrolü yapılamadı.",
          },
          400
        );
      }
    }

    const mode =
      String(
        data.mode ||
          "preview"
      ).toLowerCase();

    if (
      mode !==
        "preview" &&
      mode !==
        "commit"
    ) {
      return json(
        {
          success: false,
          error:
            "Geçersiz toplu işlem modu.",
        },
        400
      );
    }

    let rows:
      BulkDeviceInput[];

    try {
      rows =
        buildBulkRows(
          data
        );
    } catch (error) {
      return json(
        {
          success: false,
          error:
            error instanceof
              Error
              ? error.message
              : "Toplu cihaz bilgileri geçersiz.",
        },
        400
      );
    }

    client =
      await getPool().connect();

    if (
      mode ===
      "preview"
    ) {
      const validation =
        await validateBulkRows(
          client,
          rows
        );

      return json({
        success: true,
        mode:
          "preview",
        preview: {
          total:
            validation.total,
          valid:
            validation.validCount,
          invalid:
            validation.errorCount,
          canCommit:
            validation.canCommit,
          errors:
            validation.errors,
        },
        normalized: {
          brand:
            rows[0]?.brand ||
            "",
          model:
            rows[0]?.model ||
            "",
          memory:
            rows[0]?.memory ||
            "",
          color:
            rows[0]?.color ||
            "",
          grade:
            rows[0]?.grade ||
            "",
          warranty:
            rows[0]?.warranty ||
            "",
        },
      });
    }

    await client.query(
      "BEGIN ISOLATION LEVEL SERIALIZABLE"
    );

    await client.query(
      `
        SELECT
          pg_advisory_xact_lock(
            hashtext(
              'cnet_center_bulk_device_insert'
            )
          )
      `
    );

    await ensureCenterBranch(
      client
    );

    const validation =
      await validateBulkRows(
        client,
        rows
      );

    if (
      !validation.canCommit
    ) {
      await client.query(
        "ROLLBACK"
      );

      return json(
        {
          success: false,
          error:
            "Toplu kayıt iptal edildi. Hatalı veya tekrar eden IMEI var.",
          preview: {
            total:
              validation.total,
            valid:
              validation.validCount,
            invalid:
              validation.errorCount,
            canCommit:
              false,
            errors:
              validation.errors,
          },
        },
        409
      );
    }

    const insertedDevices: any[] =
      [];

    for (
      const row of
        validation.validRows
    ) {
      const insertResult =
        await client.query(
          `
            INSERT INTO public.stock_devices (
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
              details_completed_at,
              details_completed_by,
              created_by
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              NULL,
              $6,
              $7,
              NULL,
              NULL,
              $8,
              'AVAILABLE',
              'MANUAL',
              NULL,
              NULL,
              $9
            )
            RETURNING
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
              source,
              created_at,
              updated_at
          `,
          [
            row.imei,
            row.brand,
            row.model,
            row.memory,
            row.color,
            row.grade,
            row.warranty,
            CENTER_BRANCH_CODE,
            user.username,
          ]
        );

      const device =
        insertResult.rows[0];

      insertedDevices.push(
        device
      );

      await client.query(
        `
          INSERT INTO public.stock_events (
            device_id,
            imei,
            event_type,
            to_branch_code,
            old_status,
            new_status,
            performed_by,
            metadata
          )
          VALUES (
            $1,
            $2,
            'DEVICE_ADDED',
            $3,
            NULL,
            'AVAILABLE',
            $4,
            $5::jsonb
          )
        `,
        [
          device.id,
          row.imei,
          CENTER_BRANCH_CODE,
          user.username,
          JSON.stringify({
            source:
              "CENTER_BULK",
            entry:
              "ONLINE_CENTER",
            bulk:
              true,
            brand:
              row.brand,
            model:
              row.model,
            memory:
              row.memory,
            color:
              row.color,
            grade:
              row.grade,
            warranty:
              row.warranty,
            marketplaceWrite:
              false,
          }),
        ]
      );
    }

    await client.query(
      "COMMIT"
    );

    return json(
      {
        success: true,
        mode:
          "commit",
        message:
          `${insertedDevices.length} cihaz Merkez stoğuna eklendi.`,
        insertedCount:
          insertedDevices.length,
        devices:
          insertedDevices,
        safety: {
          allOrNothing:
            true,
          n11Write:
            false,
          ikasWrite:
            false,
          idefixWrite:
            false,
          onlineListingWrite:
            false,
          channelMembershipWrite:
            false,
        },
      },
      201
    );
  } catch (
    error: any
  ) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // rollback failure ignored
      }
    }

    if (
      error?.code ===
      "23505"
    ) {
      return json(
        {
          success: false,
          error:
            "Toplu kayıt iptal edildi. IMEI'lerden en az biri sistemde zaten mevcut.",
        },
        409
      );
    }

    if (
      error?.code ===
      "40001"
    ) {
      return json(
        {
          success: false,
          error:
            "Aynı anda başka bir stok işlemi yapıldı. Hiçbir cihaz eklenmedi; tekrar deneyin.",
        },
        409
      );
    }

    console.error(
      "CENTER BULK DEVICE ERROR:",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof
            Error
            ? error.message
            : "Toplu cihaz kaydı yapılamadı.",
      },
      500
    );
  } finally {
    client?.release();
  }
}


type ExcelDeviceRow = {
  rowNumber: number;
  imei: string;
  brand: string;
  model: string;
  memory: string;
  color: string;
  grade: string;
  warranty: string;
};

type ExcelValidationError = {
  rowNumber: number;
  imei: string;
  reason: string;
  type:
    | "INVALID_ROW"
    | "INVALID_IMEI"
    | "DUPLICATE_INPUT"
    | "ALREADY_EXISTS";
};

function normalizeExcelRows(
  value: unknown
) {
  if (!Array.isArray(value)) {
    throw new Error(
      "Excel satırları bulunamadı."
    );
  }

  if (value.length === 0) {
    throw new Error(
      "Excel dosyasında cihaz satırı bulunamadı."
    );
  }

  if (value.length > 500) {
    throw new Error(
      "Tek Excel dosyasında en fazla 500 cihaz yüklenebilir."
    );
  }

  const rows: ExcelDeviceRow[] = [];
  const errors: ExcelValidationError[] = [];

  value.forEach(
    (
      rawRow,
      index
    ) => {
      const rowNumber =
        Number(
          (
            rawRow as any
          )?.rowNumber
        ) ||
        index + 2;

      if (
        !rawRow ||
        typeof rawRow !==
          "object" ||
        Array.isArray(rawRow)
      ) {
        errors.push({
          rowNumber,
          imei: "",
          reason:
            "Satır formatı geçersiz.",
          type:
            "INVALID_ROW",
        });
        return;
      }

      const data =
        rawRow as Record<
          string,
          unknown
        >;

      const imei =
        normalizeImei(
          data.imei
        );

      if (
        !/^[0-9]{15}$/.test(
          imei
        )
      ) {
        errors.push({
          rowNumber,
          imei,
          reason:
            "IMEI tam 15 hane olmalıdır.",
          type:
            "INVALID_IMEI",
        });
        return;
      }

      try {
        rows.push({
          rowNumber,
          imei,
          brand:
            cleanRequired(
              data.brand,
              "Marka",
              100
            ),
          model:
            cleanRequired(
              data.model,
              "Model",
              180
            ),
          memory:
            normalizeMemoryInput(
              data.memory
            ),
          color:
            cleanRequired(
              data.color,
              "Renk",
              100
            ),
          grade:
            normalizeGradeInput(
              data.grade
            ),
          warranty:
            normalizeWarrantyInput(
              data.warranty
            ),
        });
      } catch (error) {
        errors.push({
          rowNumber,
          imei,
          reason:
            error instanceof
              Error
              ? error.message
              : "Satırdaki cihaz bilgileri geçersiz.",
          type:
            "INVALID_ROW",
        });
      }
    }
  );

  return {
    rows,
    errors,
    total:
      value.length,
  };
}

async function validateExcelRows(
  client: PoolClient,
  rawRows: unknown
) {
  const normalized =
    normalizeExcelRows(
      rawRows
    );

  const errors:
    ExcelValidationError[] =
      [
        ...normalized.errors,
      ];

  const seen =
    new Map<
      string,
      number
    >();

  for (
    const row of
      normalized.rows
  ) {
    const firstRow =
      seen.get(
        row.imei
      );

    if (firstRow) {
      errors.push({
        rowNumber:
          row.rowNumber,
        imei: row.imei,
        reason:
          `Aynı IMEI Excel içinde tekrar ediyor. İlk satır: ${firstRow}.`,
        type:
          "DUPLICATE_INPUT",
      });
      continue;
    }

    seen.set(
      row.imei,
      row.rowNumber
    );
  }

  const uniqueRows =
    normalized.rows.filter(
      (row) =>
        seen.get(
          row.imei
        ) === row.rowNumber
    );

  const imeis =
    uniqueRows.map(
      (row) =>
        row.imei
    );

  if (
    imeis.length > 0
  ) {
    const existing =
      await client.query(
        `
          SELECT
            imei,
            brand,
            model,
            current_branch_code,
            status
          FROM public.stock_devices
          WHERE imei = ANY($1::text[])
        `,
        [imeis]
      );

    const rowByImei =
      new Map(
        uniqueRows.map(
          (row) => [
            row.imei,
            row,
          ]
        )
      );

    for (
      const existingRow of
        existing.rows
    ) {
      const imei =
        String(
          existingRow.imei
        );

      const sourceRow =
        rowByImei.get(
          imei
        );

      errors.push({
        rowNumber:
          sourceRow?.rowNumber ||
          0,
        imei,
        reason:
          `Bu IMEI zaten sistemde kayıtlı. ` +
          `${String(
            existingRow.brand ||
              ""
          )} ${String(
            existingRow.model ||
              ""
          )}`.trim() +
          ` · Durum: ${String(
            existingRow.status ||
              "-"
          )}.`,
        type:
          "ALREADY_EXISTS",
      });
    }
  }

  const invalidRowKeys =
    new Set(
      errors.map(
        (item) =>
          `${item.rowNumber}:${item.imei}`
      )
    );

  const validRows =
    normalized.rows.filter(
      (row) =>
        !invalidRowKeys.has(
          `${row.rowNumber}:${row.imei}`
        ) &&
        seen.get(
          row.imei
        ) === row.rowNumber
    );

  return {
    total:
      normalized.total,
    validRows,
    validCount:
      validRows.length,
    errors,
    errorCount:
      errors.length,
    canCommit:
      errors.length === 0 &&
      validRows.length ===
        normalized.total,
  };
}


type CenterChannelCode =
  | "N11"
  | "IKAS"
  | "IDEFIX";

function normalizeCenterChannel(
  value: unknown
): CenterChannelCode {
  const channel =
    String(
      value ?? ""
    )
      .trim()
      .toUpperCase();

  if (
    channel === "N11" ||
    channel === "IKAS" ||
    channel === "IDEFIX"
  ) {
    return channel;
  }

  throw new Error(
    "Geçersiz kanal."
  );
}

function parseCenterMoney(
  value: unknown,
  label: string
) {
  if (
    typeof value ===
      "number" &&
    Number.isFinite(value)
  ) {
    if (value <= 0) {
      throw new Error(
        `${label} 0'dan büyük olmalıdır.`
      );
    }

    return Math.round(
      value * 100
    ) / 100;
  }

  let raw =
    String(
      value ?? ""
    )
      .trim()
      .replace(
        /\s+/g,
        ""
      )
      .replace(
        /₺|TL/gi,
        ""
      );

  if (!raw) {
    throw new Error(
      `${label} zorunludur.`
    );
  }

  if (
    raw.includes(",") &&
    raw.includes(".")
  ) {
    raw =
      raw
        .replace(/\./g, "")
        .replace(",", ".");
  } else if (
    raw.includes(",")
  ) {
    raw =
      raw.replace(",", ".");
  } else {
    const dotMatch =
      raw.match(
        /^(\d{1,3})\.(\d{3})$/
      );

    if (dotMatch) {
      raw =
        `${dotMatch[1]}${dotMatch[2]}`;
    }
  }

  const number =
    Number(raw);

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    throw new Error(
      `${label} geçerli bir tutar olmalıdır.`
    );
  }

  if (
    number >
    10_000_000
  ) {
    throw new Error(
      `${label} çok yüksek.`
    );
  }

  return Math.round(
    number * 100
  ) / 100;
}

async function previewCenterChannelSend(
  client: PoolClient,
  data: Record<
    string,
    unknown
  >
) {
  const channel =
    normalizeCenterChannel(
      data.channel
    );

  if (
    !Array.isArray(
      data.deviceIds
    )
  ) {
    throw new Error(
      "Seçili cihazlar bulunamadı."
    );
  }

  const rawIds =
    data.deviceIds
      .map(
        (value) =>
          Number(value)
      )
      .filter(
        (value) =>
          Number.isInteger(
            value
          ) &&
          value > 0
      );

  const deviceIds =
    Array.from(
      new Set(rawIds)
    );

  if (
    deviceIds.length === 0
  ) {
    throw new Error(
      "En az 1 IMEI seç."
    );
  }

  if (
    deviceIds.length > 200
  ) {
    throw new Error(
      "Tek seferde en fazla 200 IMEI kanala hazırlanabilir."
    );
  }

  const salePrice =
    parseCenterMoney(
      data.salePrice,
      "Satış fiyatı"
    );

  const listPrice =
    parseCenterMoney(
      data.listPrice,
      "Liste fiyatı"
    );

  if (
    listPrice <
    salePrice
  ) {
    throw new Error(
      "Liste fiyatı satış fiyatından düşük olamaz."
    );
  }

  const tableCheck =
    await client.query(
      `
        SELECT
          to_regclass(
            'public.online_channel_devices'
          ) IS NOT NULL AS ready
      `
    );

  if (
    tableCheck.rows[0]
      ?.ready !== true
  ) {
    throw new Error(
      "online_channel_devices tablosu bulunamadı. Kanal IMEI migration tamamlanmadan gönderim hazırlanamaz."
    );
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
        WHERE id = ANY(
          $1::bigint[]
        )
        ORDER BY id
      `,
      [deviceIds]
    );

  const foundIds =
    new Set(
      devicesResult.rows.map(
        (row) =>
          Number(row.id)
      )
    );

  const membershipResult =
    await client.query(
      `
        SELECT
          stock_device_id,
          imei,
          channel,
          membership_status,
          online_listing_id
        FROM public.online_channel_devices
        WHERE channel = $1
          AND stock_device_id = ANY(
            $2::bigint[]
          )
      `,
      [
        channel,
        deviceIds,
      ]
    );

  const membershipByDevice =
    new Map<
      number,
      any
    >();

  for (
    const row of
      membershipResult.rows
  ) {
    membershipByDevice.set(
      Number(
        row.stock_device_id
      ),
      row
    );
  }

  const listingLinkResult =
    await client.query(
      `
        SELECT
          stock_device_id,
          id,
          product_status,
          sale_status,
          sync_status
        FROM public.online_listings
        WHERE channel = $1
          AND stock_device_id = ANY(
            $2::bigint[]
          )
      `,
      [
        channel,
        deviceIds,
      ]
    );

  const linkedListingByDevice =
    new Map<
      number,
      any
    >();

  for (
    const row of
      listingLinkResult.rows
  ) {
    if (
      row.stock_device_id
    ) {
      linkedListingByDevice.set(
        Number(
          row.stock_device_id
        ),
        row
      );
    }
  }

  const n11LegacyImeis =
    new Set<string>();

  if (
    channel === "N11"
  ) {
    const imeis =
      devicesResult.rows
        .map(
          (row) =>
            String(
              row.imei ||
                ""
            ).trim()
        )
        .filter(Boolean);

    if (
      imeis.length > 0
    ) {
      const legacyResult =
        await client.query(
          `
            SELECT DISTINCT
              item.imei
            FROM public.online_listings l
            CROSS JOIN LATERAL
              jsonb_array_elements_text(
                CASE
                  WHEN jsonb_typeof(
                    l.raw_data->'availableImeis'
                  ) = 'array'
                  THEN l.raw_data->'availableImeis'
                  ELSE '[]'::jsonb
                END
              ) AS item(imei)
            WHERE l.channel = 'N11'
              AND item.imei = ANY(
                $1::text[]
              )
          `,
          [imeis]
        );

      for (
        const row of
          legacyResult.rows
      ) {
        n11LegacyImeis.add(
          String(
            row.imei
          )
        );
      }
    }
  }

  const items:
    Array<{
      deviceId: number;
      imei: string;
      brand: string;
      model: string;
      memory: string;
      color: string;
      grade: string;
      warranty: string;
      status: string;
      eligible: boolean;
      errors: string[];
      existingChannelStatus:
        string | null;
    }> = [];

  for (
    const id of
      deviceIds
  ) {
    if (
      !foundIds.has(id)
    ) {
      items.push({
        deviceId: id,
        imei: "-",
        brand: "-",
        model: "-",
        memory: "-",
        color: "-",
        grade: "-",
        warranty: "-",
        status:
          "NOT_FOUND",
        eligible: false,
        errors: [
          "Cihaz Merkez stokta bulunamadı.",
        ],
        existingChannelStatus:
          null,
      });
      continue;
    }

    const row =
      devicesResult.rows.find(
        (deviceRow) =>
          Number(
            deviceRow.id
          ) === id
      );

    const errors:
      string[] = [];

    const imei =
      String(
        row?.imei ||
          ""
      ).trim();

    const status =
      String(
        row?.status ||
          ""
      )
        .trim()
        .toUpperCase();

    if (
      !/^[0-9]{15}$/.test(
        imei
      )
    ) {
      errors.push(
        "IMEI 15 hane değil."
      );
    }

    if (
      status !==
      "AVAILABLE"
    ) {
      errors.push(
        `Cihaz durumu AVAILABLE değil: ${status || "-"}.`
      );
    }

    const requiredFields:
      Array<
        [
          string,
          unknown
        ]
      > = [
        [
          "Marka",
          row?.brand,
        ],
        [
          "Model",
          row?.model,
        ],
        [
          "Hafıza",
          row?.memory,
        ],
        [
          "Renk",
          row?.color,
        ],
        [
          "Grade",
          row?.grade,
        ],
        [
          "Garanti",
          row?.warranty,
        ],
      ];

    for (
      const [
        label,
        value,
      ] of
        requiredFields
    ) {
      if (
        !String(
          value ?? ""
        ).trim()
      ) {
        errors.push(
          `${label} eksik.`
        );
      }
    }

    const membership =
      membershipByDevice.get(
        id
      );

    const linkedListing =
      linkedListingByDevice.get(
        id
      );

    let existingStatus:
      string | null = null;

    if (membership) {
      existingStatus =
        String(
          membership
            .membership_status ||
            "KAYITLI"
        );

      errors.push(
        `${channel} kanalında zaten kayıtlı: ${existingStatus}.`
      );
    }

    if (
      linkedListing &&
      !membership
    ) {
      existingStatus =
        "LISTING_VAR";

      errors.push(
        `${channel} kanalında bu cihaza bağlı listing zaten var.`
      );
    }

    if (
      channel === "N11" &&
      n11LegacyImeis.has(
        imei
      ) &&
      !membership
    ) {
      existingStatus =
        "LISTED";

      errors.push(
        "IMEI eski N11 stok havuzunda zaten gönderilmiş."
      );
    }

    items.push({
      deviceId:
        Number(row.id),
      imei,
      brand:
        String(
          row.brand ||
            ""
        ),
      model:
        String(
          row.model ||
            ""
        ),
      memory:
        String(
          row.memory ||
            ""
        ),
      color:
        String(
          row.color ||
            ""
        ),
      grade:
        String(
          row.grade ||
            ""
        ),
      warranty:
        String(
          row.warranty ||
            ""
        ),
      status,
      eligible:
        errors.length === 0,
      errors,
      existingChannelStatus:
        existingStatus,
    });
  }

  const eligibleCount =
    items.filter(
      (item) =>
        item.eligible
    ).length;

  return {
    channel,
    salePrice,
    listPrice,
    total:
      items.length,
    eligible:
      eligibleCount,
    blocked:
      items.length -
      eligibleCount,
    canProceed:
      items.length > 0 &&
      eligibleCount ===
        items.length,
    items,
    safety: {
      previewOnly: true,
      databaseWrite:
        false,
      n11Write: false,
      ikasWrite: false,
      idefixWrite:
        false,
    },
  };
}

export async function PATCH(
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
      await getSuperAdminUser(
        request
      );

    if (!user) {
      return json(
        {
          success: false,
          error:
            "Merkez Excel cihaz girişi yalnızca Super Admin içindir.",
        },
        403
      );
    }

    const contentLength =
      Number(
        request.headers.get(
          "content-length"
        ) || 0
      );

    if (
      contentLength >
      2_000_000
    ) {
      return json(
        {
          success: false,
          error:
            "Excel cihaz isteği çok büyük.",
        },
        413
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
      Array.isArray(body)
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

    const mode =
      String(
        data.mode ||
          "preview"
      ).toLowerCase();

    if (
      mode !==
        "preview" &&
      mode !==
        "commit"
    ) {
      return json(
        {
          success: false,
          error:
            "Geçersiz Excel işlem modu.",
        },
        400
      );
    }

    client =
      await getPool().connect();

    if (
      mode ===
      "preview"
    ) {
      const validation =
        await validateExcelRows(
          client,
          data.rows
        );

      return json({
        success: true,
        mode:
          "preview",
        preview: {
          total:
            validation.total,
          valid:
            validation.validCount,
          invalid:
            validation.errorCount,
          canCommit:
            validation.canCommit,
          errors:
            validation.errors,
        },
      });
    }

    await client.query(
      "BEGIN ISOLATION LEVEL SERIALIZABLE"
    );

    await client.query(
      `
        SELECT
          pg_advisory_xact_lock(
            hashtext(
              'cnet_center_excel_device_insert'
            )
          )
      `
    );

    await ensureCenterBranch(
      client
    );

    const validation =
      await validateExcelRows(
        client,
        data.rows
      );

    if (
      !validation.canCommit
    ) {
      await client.query(
        "ROLLBACK"
      );

      return json(
        {
          success: false,
          error:
            "Excel kaydı iptal edildi. Hatalı veya tekrar eden cihaz satırı var.",
          preview: {
            total:
              validation.total,
            valid:
              validation.validCount,
            invalid:
              validation.errorCount,
            canCommit:
              false,
            errors:
              validation.errors,
          },
        },
        409
      );
    }

    const insertedDevices:
      any[] = [];

    for (
      const row of
        validation.validRows
    ) {
      const insertResult =
        await client.query(
          `
            INSERT INTO public.stock_devices (
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
              details_completed_at,
              details_completed_by,
              created_by
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              $5,
              NULL,
              $6,
              $7,
              NULL,
              NULL,
              $8,
              'AVAILABLE',
              'MANUAL',
              NULL,
              NULL,
              $9
            )
            RETURNING
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
              source,
              created_at,
              updated_at
          `,
          [
            row.imei,
            row.brand,
            row.model,
            row.memory,
            row.color,
            row.grade,
            row.warranty,
            CENTER_BRANCH_CODE,
            user.username,
          ]
        );

      const device =
        insertResult.rows[0];

      insertedDevices.push(
        device
      );

      await client.query(
        `
          INSERT INTO public.stock_events (
            device_id,
            imei,
            event_type,
            to_branch_code,
            old_status,
            new_status,
            performed_by,
            metadata
          )
          VALUES (
            $1,
            $2,
            'DEVICE_ADDED',
            $3,
            NULL,
            'AVAILABLE',
            $4,
            $5::jsonb
          )
        `,
        [
          device.id,
          row.imei,
          CENTER_BRANCH_CODE,
          user.username,
          JSON.stringify({
            source:
              "CENTER_EXCEL",
            entry:
              "ONLINE_CENTER",
            excel:
              true,
            rowNumber:
              row.rowNumber,
            brand:
              row.brand,
            model:
              row.model,
            memory:
              row.memory,
            color:
              row.color,
            grade:
              row.grade,
            warranty:
              row.warranty,
            marketplaceWrite:
              false,
          }),
        ]
      );
    }

    await client.query(
      "COMMIT"
    );

    return json(
      {
        success: true,
        mode:
          "commit",
        message:
          `${insertedDevices.length} cihaz Excel'den Merkez stoğuna eklendi.`,
        insertedCount:
          insertedDevices.length,
        safety: {
          allOrNothing:
            true,
          n11Write:
            false,
          ikasWrite:
            false,
          idefixWrite:
            false,
          onlineListingWrite:
            false,
          channelMembershipWrite:
            false,
        },
      },
      201
    );
  } catch (
    error: any
  ) {
    if (client) {
      try {
        await client.query(
          "ROLLBACK"
        );
      } catch {
        // rollback failure ignored
      }
    }

    if (
      error?.code ===
      "23505"
    ) {
      return json(
        {
          success: false,
          error:
            "Excel kaydı iptal edildi. IMEI'lerden en az biri sistemde zaten mevcut.",
        },
        409
      );
    }

    if (
      error?.code ===
      "40001"
    ) {
      return json(
        {
          success: false,
          error:
            "Aynı anda başka bir stok işlemi yapıldı. Hiçbir cihaz eklenmedi; tekrar deneyin.",
        },
        409
      );
    }

    console.error(
      "CENTER EXCEL DEVICE ERROR:",
      error
    );

    return json(
      {
        success: false,
        error:
          error instanceof
            Error
            ? error.message
            : "Excel cihaz kaydı yapılamadı.",
      },
      500
    );
  } finally {
    client?.release();
  }
}
