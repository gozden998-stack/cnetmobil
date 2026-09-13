// app/api/wingsm/transfers/check/route.ts

import crypto from "crypto";
import { Pool } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "cnet_auth";

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var cnetWingSMTransferCheckPool:
    | Pool
    | undefined;
}

// ======================================================
// POSTGRES
// ======================================================

function getPool() {
  if (
    global.cnetWingSMTransferCheckPool
  ) {
    return global
      .cnetWingSMTransferCheckPool;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  global.cnetWingSMTransferCheckPool =
    new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis:
        10000,
    });

  return global
    .cnetWingSMTransferCheckPool;
}

// ======================================================
// AUTH
// ======================================================

function getSessionSecret() {
  const secret =
    process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "SESSION_SECRET bulunamadı."
    );
  }

  return secret;
}

function getCookieValue(
  request: Request
) {
  const raw =
    request.headers.get(
      "cookie"
    ) || "";

  const target =
    raw
      .split(";")
      .map((item) =>
        item.trim()
      )
      .find((item) =>
        item.startsWith(
          `${COOKIE_NAME}=`
        )
      );

  if (!target) {
    return null;
  }

  return decodeURIComponent(
    target.substring(
      COOKIE_NAME.length + 1
    )
  );
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

    const currentBuffer =
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
      currentBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        currentBuffer,
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
        ).toString("utf8")
      ) as SessionPayload;

    if (
      !payload.exp ||
      payload.exp <
        Math.floor(
          Date.now() / 1000
        )
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

// ======================================================
// SUPER ADMIN
// ======================================================

async function requireSuperAdmin(
  request: Request
) {
  const token =
    getCookieValue(
      request
    );

  if (!token) {
    throw Object.assign(
      new Error(
        "Oturum gerekli."
      ),
      {
        status: 401,
      }
    );
  }

  const session =
    verifySession(
      token
    );

  if (
    !session ||
    !session.userId
  ) {
    throw Object.assign(
      new Error(
        "Geçerli kullanıcı oturumu gerekli."
      ),
      {
        status: 401,
      }
    );
  }

  const pool =
    getPool();

  const result =
    await pool.query(
      `
        SELECT
          u.id,
          u.username,
          u.email

        FROM public.users u

        JOIN public.user_roles ur
          ON ur.user_id = u.id

        JOIN public.roles r
          ON r.id = ur.role_id

        WHERE
          u.id = $1
          AND u.active = TRUE
          AND r.active = TRUE
          AND r.code = 'super_admin'

        LIMIT 1
      `,
      [
        session.userId,
      ]
    );

  if (
    result.rowCount !== 1
  ) {
    throw Object.assign(
      new Error(
        "Super Admin yetkisi gerekli."
      ),
      {
        status: 403,
      }
    );
  }

  return result.rows[0];
}

// ======================================================
// GET
// ======================================================

export async function GET(
  request: Request
) {
  try {
    const user =
      await requireSuperAdmin(
        request
      );

    const pool =
      getPool();

    // ==================================================
    // WAITING_WING TRANSFERLER
    // ==================================================

    const result =
      await pool.query(
        `
          SELECT
            dt.id
              AS transfer_id,

            dt.request_id,
            dt.device_id,
            dt.imei,

            dt.from_branch_code,
            dt.to_branch_code,

            dt.status
              AS transfer_status,

            dt.panel_sent_by,
            dt.panel_sent_at,

            dr.status
              AS request_status,

            sd.current_branch_code
              AS panel_current_branch,

            sd.status
              AS device_status,

            sd.brand,
            sd.model,
            sd.memory,
            sd.color,

            wdl.panel_branch
              AS wingsm_branch,

            wdl.wingsm_depot,

            wdl.product_code
              AS wingsm_product_code,

            wdl.product_name
              AS wingsm_product_name,

            wdl.last_seen_at
              AS wingsm_last_seen_at,

            wdl.updated_at
              AS wingsm_updated_at

          FROM
            public.device_transfers dt

          JOIN
            public.stock_devices sd
              ON sd.id =
                 dt.device_id

          LEFT JOIN
            public.device_requests dr
              ON dr.id =
                 dt.request_id

          LEFT JOIN
            public.wingsm_device_locations wdl
              ON wdl.serial_no =
                 dt.imei

          WHERE
            dt.status =
              'WAITING_WING'

          ORDER BY
            dt.created_at ASC,
            dt.id ASC
        `
      );

    // ==================================================
    // DURUM HESAPLA
    // ==================================================

    const transfers =
      result.rows.map(
        (row) => {
          let verificationStatus:
            | "READY"
            | "WAITING"
            | "NOT_FOUND"
            | "INVALID" =
            "WAITING";

          let message =
            "";

          // --------------------------------------------
          // WingSM'de IMEI hiç görülmemiş
          // --------------------------------------------

          if (
            !row.wingsm_branch
          ) {
            verificationStatus =
              "NOT_FOUND";

            message =
              "IMEI henüz WingSM stok cache içinde bulunamadı.";
          }

          // --------------------------------------------
          // WingSM hedef mağazaya geçti
          // --------------------------------------------

          else if (
            String(
              row.wingsm_branch
            ) ===
            String(
              row.to_branch_code
            )
          ) {
            verificationStatus =
              "READY";

            message =
              "WingSM cihazı hedef mağazada gösteriyor. Transfer tamamlanmaya hazır.";
          }

          // --------------------------------------------
          // Eski mağazada / başka mağazada
          // --------------------------------------------

          else {
            verificationStatus =
              "WAITING";

            message =
              `WingSM cihazı şu anda ${row.wingsm_branch} mağazasında gösteriyor. Hedef: ${row.to_branch_code}.`;
          }

          // --------------------------------------------
          // Panel durumları beklenen yapıda değilse
          // --------------------------------------------

          if (
            String(
              row.request_status
            ) !==
              "TRANSFER_WAITING" ||
            String(
              row.device_status
            ) !==
              "TRANSFER_WAITING"
          ) {
            verificationStatus =
              "INVALID";

            message =
              "Panel talep/cihaz durumu transfer doğrulaması için uygun değil.";
          }

          return {
            transferId:
              Number(
                row.transfer_id
              ),

            requestId:
              row.request_id
                ? Number(
                    row.request_id
                  )
                : null,

            deviceId:
              Number(
                row.device_id
              ),

            imei:
              String(
                row.imei
              ),

            device: {
              brand:
                row.brand,

              model:
                row.model,

              memory:
                row.memory,

              color:
                row.color,
            },

            panel: {
              fromBranch:
                row.from_branch_code,

              toBranch:
                row.to_branch_code,

              currentBranch:
                row.panel_current_branch,

              deviceStatus:
                row.device_status,

              requestStatus:
                row.request_status,

              transferStatus:
                row.transfer_status,

              sentBy:
                row.panel_sent_by,

              sentAt:
                row.panel_sent_at,
            },

            wingsm: {
              found:
                Boolean(
                  row.wingsm_branch
                ),

              branch:
                row.wingsm_branch ||
                null,

              depot:
                row.wingsm_depot ||
                null,

              productCode:
                row.wingsm_product_code ||
                null,

              productName:
                row.wingsm_product_name ||
                null,

              lastSeenAt:
                row.wingsm_last_seen_at ||
                null,

              updatedAt:
                row.wingsm_updated_at ||
                null,
            },

            verification: {
              status:
                verificationStatus,

              ready:
                verificationStatus ===
                "READY",

              message,
            },
          };
        }
      );

    // ==================================================
    // SUMMARY
    // ==================================================

    const ready =
      transfers.filter(
        (item) =>
          item.verification
            .status ===
          "READY"
      ).length;

    const waiting =
      transfers.filter(
        (item) =>
          item.verification
            .status ===
          "WAITING"
      ).length;

    const notFound =
      transfers.filter(
        (item) =>
          item.verification
            .status ===
          "NOT_FOUND"
      ).length;

    const invalid =
      transfers.filter(
        (item) =>
          item.verification
            .status ===
          "INVALID"
      ).length;

    return Response.json(
      {
        success: true,

        dryRun: true,

        message:
          "Sadece WingSM transfer kontrolü yapıldı. Hiçbir stok veya talep kaydı değiştirilmedi.",

        requestedBy:
          user.username ||
          user.email,

        summary: {
          total:
            transfers.length,

          ready,

          waiting,

          notFound,

          invalid,
        },

        transfers,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",

          Pragma:
            "no-cache",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "WINGSM_TRANSFER_CHECK_ERROR:",
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
        success: false,

        error:
          error?.message ||
          "WingSM transfer kontrolü yapılamadı.",
      },
      {
        status:
          Number(
            error?.status ||
              500
          ),

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
