// app/api/wingsm/transfers/complete/route.ts

import crypto from "crypto";
import { Pool } from "pg";

import {
  getWingSMConfigStatus,
} from "../../../../lib/wingsm/server";

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
  var cnetWingSMTransferCompletePool:
    | Pool
    | undefined;
}

// ======================================================
// POSTGRES
// ======================================================

function getPool() {
  if (
    global.cnetWingSMTransferCompletePool
  ) {
    return global
      .cnetWingSMTransferCompletePool;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  global.cnetWingSMTransferCompletePool =
    new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

  return global
    .cnetWingSMTransferCompletePool;
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
        .digest("base64url");

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
// Sadece endpoint durumunu gösterir.
// ======================================================

export async function GET(
  request: Request
) {
  try {
    await requireSuperAdmin(
      request
    );

    const config =
      getWingSMConfigStatus();

    return Response.json(
      {
        success: true,

        configured:
          config.configured,

        enabled:
          config.configured,

        message:
          config.configured
            ? "WingSM transfer tamamlama servisi hazır."
            : "WingSM ENV ayarları kapalı. Transfer tamamlama çalıştırılamaz.",
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error: any) {
    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          "Durum alınamadı.",
      },
      {
        status:
          Number(
            error?.status || 500
          ),
      }
    );
  }
}

// ======================================================
// POST
//
// SADECE şu şartlarda transfer tamamlanır:
//
// 1. WingSM ENV aktif
// 2. Transfer WAITING_WING
// 3. Talep TRANSFER_WAITING
// 4. Cihaz TRANSFER_WAITING
// 5. WingSM IMEI'yi hedef mağazada gösteriyor
// 6. WingSM kaydı Gönderildi zamanından daha yeni
// 7. Gönderildi sonrasında başarılı WingSM sync yapılmış
//
// ======================================================

export async function POST(
  request: Request
) {
  try {
    const admin =
      await requireSuperAdmin(
        request
      );

    const config =
      getWingSMConfigStatus();

    // ==================================================
    // WINGSM HENÜZ AÇIK DEĞİL
    // ==================================================

    if (
      !config.configured
    ) {
      return Response.json(
        {
          success: true,

          configured: false,

          status: "SKIPPED",

          completed: 0,

          message:
            "WingSM ENV ayarları aktif değil. Hiçbir stok, talep veya transfer değiştirilmedi.",
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const pool =
      getPool();

    // ==================================================
    // TAMAMLANMAYA HAZIR TRANSFERLER
    // ==================================================

    const candidateResult =
      await pool.query(
        `
          SELECT
            dt.id AS transfer_id

          FROM public.device_transfers dt

          JOIN public.device_requests dr
            ON dr.id = dt.request_id

          JOIN public.stock_devices sd
            ON sd.id = dt.device_id

          JOIN public.wingsm_device_locations wdl
            ON wdl.serial_no = dt.imei

          WHERE
            dt.status = 'WAITING_WING'

            AND dr.status =
              'TRANSFER_WAITING'

            AND sd.status =
              'TRANSFER_WAITING'

            -- WingSM hedef mağazayı doğruladı
            AND wdl.panel_branch =
              dt.to_branch_code

            -- WingSM verisi "Gönderildi" işleminden sonra gelmiş olmalı
            AND wdl.updated_at >=
              COALESCE(
                dt.panel_sent_at,
                dt.created_at
              )

            -- Mutlaka Gönderildi'den sonra başarılı canlı sync olmalı
            AND EXISTS (
              SELECT 1

              FROM public.wingsm_sync_runs wsr

              WHERE
                wsr.panel_branch =
                  dt.to_branch_code

                AND wsr.status =
                  'SUCCESS'

                AND COALESCE(
                  wsr.finished_at,
                  wsr.started_at
                ) >=
                  COALESCE(
                    dt.panel_sent_at,
                    dt.created_at
                  )
            )

          ORDER BY
            dt.id ASC

          LIMIT 500
        `
      );

    if (
      candidateResult.rowCount ===
      0
    ) {
      return Response.json(
        {
          success: true,

          configured: true,

          status:
            "NO_READY_TRANSFER",

          completed: 0,

          message:
            "WingSM tarafından hedef mağazada doğrulanmış bekleyen transfer bulunamadı.",
        },
        {
          headers: {
            "Cache-Control":
              "no-store",
          },
        }
      );
    }

    const completed:
      any[] = [];

    const skipped:
      any[] = [];

    // ==================================================
    // HER TRANSFERİ AYRI TRANSACTION İLE TAMAMLA
    // ==================================================

    for (
      const candidate of
      candidateResult.rows
    ) {
      const transferId =
        Number(
          candidate.transfer_id
        );

      const client =
        await pool.connect();

      try {
        await client.query(
          "BEGIN"
        );

        // ==============================================
        // TRANSFERİ TEKRAR KİLİTLE VE DOĞRULA
        // ==============================================

        const rowResult =
          await client.query(
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

                dt.panel_sent_at,

                dr.status
                  AS request_status,

                sd.current_branch_code,
                sd.status
                  AS device_status,

                wdl.panel_branch
                  AS wingsm_branch,

                wdl.wingsm_depot,

                wdl.product_code,
                wdl.product_name,

                wdl.updated_at
                  AS wingsm_updated_at

              FROM public.device_transfers dt

              JOIN public.device_requests dr
                ON dr.id =
                   dt.request_id

              JOIN public.stock_devices sd
                ON sd.id =
                   dt.device_id

              JOIN public.wingsm_device_locations wdl
                ON wdl.serial_no =
                   dt.imei

              WHERE
                dt.id = $1

              LIMIT 1

              FOR UPDATE OF
                dt,
                dr,
                sd
            `,
            [
              transferId,
            ]
          );

        const row =
          rowResult.rows[0];

        if (!row) {
          await client.query(
            "ROLLBACK"
          );

          skipped.push({
            transferId,
            reason:
              "Transfer bulunamadı.",
          });

          continue;
        }

        // ==============================================
        // DURUMLARI TEKRAR KONTROL
        // ==============================================

        if (
          String(
            row.transfer_status
          ) !== "WAITING_WING" ||
          String(
            row.request_status
          ) !== "TRANSFER_WAITING" ||
          String(
            row.device_status
          ) !== "TRANSFER_WAITING"
        ) {
          await client.query(
            "ROLLBACK"
          );

          skipped.push({
            transferId,

            imei:
              row.imei,

            reason:
              "Transfer/talep/cihaz artık bekleyen durumda değil.",
          });

          continue;
        }

        // ==============================================
        // WINGSM HEDEF MAĞAZA KONTROLÜ
        // ==============================================

        if (
          String(
            row.wingsm_branch
          ) !==
          String(
            row.to_branch_code
          )
        ) {
          await client.query(
            "ROLLBACK"
          );

          skipped.push({
            transferId,

            imei:
              row.imei,

            reason:
              "WingSM hedef mağaza ile eşleşmiyor.",
          });

          continue;
        }

        // ==============================================
        // TAZELİK KONTROLÜ
        // ==============================================

        const freshSyncResult =
          await client.query(
            `
              SELECT id

              FROM public.wingsm_sync_runs

              WHERE
                panel_branch = $1

                AND status =
                  'SUCCESS'

                AND COALESCE(
                  finished_at,
                  started_at
                ) >=
                  COALESCE(
                    $2::timestamptz,
                    '-infinity'::timestamptz
                  )

              ORDER BY
                started_at DESC

              LIMIT 1
            `,
            [
              row.to_branch_code,
              row.panel_sent_at,
            ]
          );

        if (
          freshSyncResult.rowCount ===
          0
        ) {
          await client.query(
            "ROLLBACK"
          );

          skipped.push({
            transferId,

            imei:
              row.imei,

            reason:
              "Gönderildi işleminden sonra başarılı WingSM senkronizasyonu yok.",
          });

          continue;
        }

        // ==============================================
        // 1) CİHAZI HEDEF MAĞAZAYA TAŞI
        // ==============================================

        await client.query(
          `
            UPDATE public.stock_devices

            SET
              current_branch_code = $2,
              status = 'AVAILABLE',
              wing_last_seen_at = $3,
              updated_at = NOW()

            WHERE id = $1
          `,
          [
            row.device_id,
            row.to_branch_code,
            row.wingsm_updated_at,
          ]
        );

        // ==============================================
        // 2) TALEBİ COMPLETED
        // ==============================================

        await client.query(
          `
            UPDATE public.device_requests

            SET
              status = 'COMPLETED',
              completed_at = NOW(),
              updated_at = NOW()

            WHERE
              id = $1
              AND status =
                'TRANSFER_WAITING'
          `,
          [
            row.request_id,
          ]
        );

        // ==============================================
        // 3) TRANSFERİ COMPLETED
        // ==============================================

        const wingReference =
          [
            "WINGSM",
            row.wingsm_depot ||
              row.wingsm_branch,
            new Date(
              row.wingsm_updated_at
            ).toISOString(),
          ].join(":");

        await client.query(
          `
            UPDATE public.device_transfers

            SET
              status = 'COMPLETED',

              wing_transfer_at = $2,

              wing_reference = $3,

              completed_at = NOW(),

              updated_at = NOW()

            WHERE
              id = $1
              AND status =
                'WAITING_WING'
          `,
          [
            transferId,
            row.wingsm_updated_at,
            wingReference,
          ]
        );

        // ==============================================
        // 4) EVENT LOG
        // ==============================================

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

              metadata
            )

            VALUES (
              $1,
              $2,

              'TRANSFER_COMPLETED_WINGSM',

              $3,
              $4,

              'TRANSFER_WAITING',
              'AVAILABLE',

              $5,

              $6::jsonb
            )
          `,
          [
            row.device_id,
            row.imei,

            row.from_branch_code,
            row.to_branch_code,

            "WINGSM_AUTO",

            JSON.stringify({
              requestId:
                Number(
                  row.request_id
                ),

              transferId,

              wingsmBranch:
                row.wingsm_branch,

              wingsmDepot:
                row.wingsm_depot,

              wingsmProductCode:
                row.product_code,

              wingsmProductName:
                row.product_name,

              wingsmUpdatedAt:
                row.wingsm_updated_at,

              confirmedByWingSM:
                true,

              executedBy:
                admin.username ||
                admin.email,
            }),
          ]
        );

        await client.query(
          "COMMIT"
        );

        completed.push({
          transferId,

          requestId:
            Number(
              row.request_id
            ),

          deviceId:
            Number(
              row.device_id
            ),

          imei:
            String(
              row.imei
            ),

          fromBranch:
            row.from_branch_code,

          toBranch:
            row.to_branch_code,

          wingsmDepot:
            row.wingsm_depot,

          wingsmUpdatedAt:
            row.wingsm_updated_at,
        });
      } catch (error: any) {
        try {
          await client.query(
            "ROLLBACK"
          );
        } catch {}

        skipped.push({
          transferId,

          reason:
            error?.message ||
            "Transfer tamamlanırken hata oluştu.",
        });
      } finally {
        client.release();
      }
    }

    // ==================================================
    // RESPONSE
    // ==================================================

    return Response.json(
      {
        success: true,

        configured: true,

        status:
          "COMPLETED",

        requestedBy:
          admin.username ||
          admin.email,

        counts: {
          candidates:
            candidateResult.rowCount,

          completed:
            completed.length,

          skipped:
            skipped.length,
        },

        completedTransfers:
          completed,

        skippedTransfers:
          skipped,

        message:
          `${completed.length} WingSM transferi doğrulandı ve tamamlandı.`,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "WINGSM_TRANSFER_COMPLETE_ERROR:",
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
          "WingSM transferleri tamamlanamadı.",
      },
      {
        status:
          Number(
            error?.status || 500
          ),

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }
}
