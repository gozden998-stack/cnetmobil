// app/api/online/center/devices/create/route.ts
// CNETMOBIL - MERKEZ ADIM 2A
//
// Güvenli tekli cihaz girişi.
//
// UI alanları:
// - IMEI
// - Marka
// - Model
// - Hafıza
// - Renk
// - Grade
// - Garanti
//
// UI'da özellikle YOK:
// - Durum
// - Mağaza
// - Pil
// - Değişen parça
// - Kutu / fatura
//
// Teknik kayıt:
// - current_branch_code = CNET
// - status = AVAILABLE
// - battery_percent = NULL
// - changed_parts = NULL
// - box_invoice = NULL
//
// Bu route:
// - N11'e yazmaz
// - İkas'a yazmaz
// - İdefix'e yazmaz
// - online_listings oluşturmaz
// - online_channel_devices oluşturmaz
// - mevcut /api/stock/devices route'unu değiştirmez

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
  var cnetCenterCreatePool:
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

type ActiveUser = {
  id: number;
  username: string;
  isSuperAdmin: boolean;
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
      .cnetCenterCreatePool
  ) {
    global
      .cnetCenterCreatePool =
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
    .cnetCenterCreatePool;
}

function getSessionSecret() {
  const secret =
    process.env
      .SESSION_SECRET;

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
    ] = token.split(".");

    if (
      !encoded ||
      !signature
    ) {
      return null;
    }

    const expected =
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

async function getSuperAdmin(
  request: NextRequest
): Promise<
  ActiveUser | null
> {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value;

  if (!token) {
    return null;
  }

  const session =
    verifySession(token);

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
    return null;
  }

  return {
    id: Number(row.id),
    username: String(
      row.username
    ),
    isSuperAdmin: true,
  };
}

function collapseSpaces(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
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

function normalizeMemory(
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

function normalizeGrade(
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
    folded ===
      "AKALITE" ||
    folded.includes(
      "MUKEMMEL"
    )
  ) {
    return "A";
  }

  if (
    folded === "B" ||
    folded ===
      "BKALITE" ||
    folded.includes(
      "COKIYI"
    )
  ) {
    return "B";
  }

  if (
    folded === "C" ||
    folded ===
      "CKALITE" ||
    folded === "IYI"
  ) {
    return "C";
  }

  throw new Error(
    "Grade yalnızca A, B veya C olabilir."
  );
}

function normalizeWarranty(
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
          code,
          name
        FROM public.branches
        WHERE code = $1
          AND is_active = TRUE
        LIMIT 1
      `,
      [
        CENTER_BRANCH_CODE,
      ]
    );

  if (
    result.rowCount !== 1
  ) {
    throw new Error(
      "CNET merkez stok kodu aktif değil. Cihaz kaydı yapılmadı."
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
      await getSuperAdmin(
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
        normalizeMemory(
          data.memory
        );

      color =
        cleanRequired(
          data.color,
          "Renk",
          100
        );

      grade =
        normalizeGrade(
          data.grade
        );

      warranty =
        normalizeWarranty(
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
          n11Write: false,
          ikasWrite: false,
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
  } catch (error: any) {
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
