// app/api/wingsm/transfers/complete/route.ts
//
// CNETMOBIL - WingSM transfer tamamlama
//
// KESIN KURAL:
// - WingSM'e HICBIR veri YAZMAZ.
// - Bu endpoint WingSM API'ye transfer POST'u atmaz.
// - Once WingSM stok sync tarafindan PostgreSQL'e yazilan
//   GERCEK WingSM konumunu kontrol eder.
// - Cihaz hedef magazaya gecip cok hizli satildiysa ve anlik
//   stokta artik yoksa, WingSM IMEI hareket gecmisini SADECE GET
//   ile ikinci kanit olarak kontrol eder.
//
// TRANSFER SADECE SU SARTLARDA TAMAMLANIR:
//
// 1) Transfer          = WAITING_WING
// 2) Talep             = TRANSFER_WAITING
// 3) Cihaz             = TRANSFER_WAITING
// 4) Asagidaki kanitlardan EN AZ BIRI vardir:
//    A) WingSM anlik stok konumu hedef magazadir ve tazedir.
//    B) Gonderildi tarihinden sonra hedef depo icin IMEI hareketi vardir.
//
// Hareket gecmisi fallback'i cihaz artik anlik stokta olmadigi icin
// kullanilir. Bu durumda cihaz panelde AVAILABLE yapilmaz; MISSING
// tutulur. Sonraki stok sync cihaz tekrar stokta gorunurse AVAILABLE
// durumunu zaten otomatik geri getirir.
//
// MANUEL:
// - Super Admin oturumu ile calisir.
//
// OTOMATIK:
// - Authorization: Bearer WINGSM_SYNC_SECRET
// - Cron tarafindan calistirilabilir.

import crypto from "crypto";
import { Pool } from "pg";

import {
  getWingSMConfigStatus,
  getWingSMDepotForBranch,
  getWingSMProductMovementHistory,
} from "../../../../lib/wingsm/server";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const revalidate =
  0;

const COOKIE_NAME =
  "cnet_auth";

// ======================================================
// TYPES
// ======================================================

type SessionPayload = {
  userId: number | null;

  role:
    | "admin"
    | "personel";

  branch: string;

  exp: number;

  legacy?: boolean;
};

type ActiveActor = {
  username: string;

  email:
    | string
    | null;

  mode:
    | "AUTOMATIC_CRON"
    | "MANUAL_ADMIN";
};

// ======================================================
// GLOBAL DB
// ======================================================

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
    global
      .cnetWingSMTransferCompletePool
  ) {
    return global
      .cnetWingSMTransferCompletePool;
  }

  const connectionString =
    process.env
      .DATABASE_URL;

  if (
    !connectionString
  ) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  global
    .cnetWingSMTransferCompletePool =
    new Pool({
      connectionString,

      max: 5,

      idleTimeoutMillis:
        30_000,

      connectionTimeoutMillis:
        10_000,
    });

  return global
    .cnetWingSMTransferCompletePool;
}

// ======================================================
// SESSION SECRET
// ======================================================

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

// ======================================================
// COOKIE
// ======================================================

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
      .map(
        (
          item
        ) =>
          item.trim()
      )
      .find(
        (
          item
        ) =>
          item.startsWith(
            `${COOKIE_NAME}=`
          )
      );

  if (!target) {
    return null;
  }

  return decodeURIComponent(
    target.substring(
      COOKIE_NAME.length +
        1
    )
  );
}

// ======================================================
// SESSION VERIFY
// ======================================================

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
        ).toString(
          "utf8"
        )
      ) as SessionPayload;

    if (
      !payload.exp ||
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

  const result =
    await getPool().query(
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

          AND u.active =
            TRUE

          AND r.active =
            TRUE

          AND r.code =
            'super_admin'

        LIMIT 1
      `,
      [
        session.userId,
      ]
    );

  if (
    result.rowCount !==
    1
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

  return result
    .rows[0];
}

// ======================================================
// CRON AUTH
// ======================================================

function isCronAuthorized(
  request: Request
) {
  const secret =
    String(
      process.env
        .WINGSM_SYNC_SECRET ||
        ""
    ).trim();

  if (!secret) {
    return false;
  }

  const received =
    String(
      request.headers.get(
        "authorization"
      ) || ""
    );

  const expected =
    `Bearer ${secret}`;

  const receivedBuffer =
    Buffer.from(
      received,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expected,
      "utf8"
    );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto
    .timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    );
}

// ======================================================
// ACTOR
// ======================================================

async function getActor(
  request: Request
): Promise<ActiveActor> {
  if (
    isCronAuthorized(
      request
    )
  ) {
    return {
      username:
        "WINGSM_CRON",

      email:
        null,

      mode:
        "AUTOMATIC_CRON",
    };
  }

  const admin =
    await requireSuperAdmin(
      request
    );

  return {
    username:
      String(
        admin.username ||
          ""
      ),

    email:
      admin.email
        ? String(
            admin.email
          )
        : null,

    mode:
      "MANUAL_ADMIN",
  };
}

// ======================================================
// RESPONSE HEADERS
// ======================================================

function noStoreHeaders() {
  return {
    "Cache-Control":
      "no-store, max-age=0",

    Pragma:
      "no-cache",

    "X-Content-Type-Options":
      "nosniff",
  };
}


// ======================================================
// WINGSM HAREKET RESPONSE -> SATIRLAR
// ======================================================
//
// B2B servislerinde liste bazen dogrudan data, bazen de
// data.List / rows / items gibi alanlarda gelebiliyor.
// Ham hareket verisini loglamiyoruz; sadece satir sayisini
// transfer kaniti olarak kullaniyoruz.
// ======================================================

function extractWingSMMovementRows(
  payload: any
): any[] {
  const visit = (
    value: any,
    depth: number
  ): any[] | null => {
    if (
      depth > 5 ||
      value === null ||
      value === undefined
    ) {
      return null;
    }

    if (
      Array.isArray(
        value
      )
    ) {
      return value;
    }

    if (
      typeof value !==
      "object"
    ) {
      return null;
    }

    const preferredKeys = [
      "data",
      "Data",
      "list",
      "List",
      "rows",
      "Rows",
      "items",
      "Items",
      "result",
      "Result",
    ];

    for (
      const key of
      preferredKeys
    ) {
      if (
        Object.prototype.hasOwnProperty.call(
          value,
          key
        )
      ) {
        const found =
          visit(
            value[key],
            depth + 1
          );

        if (found) {
          return found;
        }
      }
    }

    return null;
  };

  return (
    visit(
      payload,
      0
    ) || []
  );
}

// ======================================================
// GET
//
// Sadece servis durumunu gösterir.
// GET cron için gerekli değildir.
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
        success:
          true,

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
        headers:
          noStoreHeaders(),
      }
    );
  } catch (
    error: any
  ) {
    return Response.json(
      {
        success:
          false,

        error:
          error?.message ||
          "Durum alınamadı.",
      },
      {
        status:
          Number(
            error?.status ||
              500
          ),

        headers:
          noStoreHeaders(),
      }
    );
  }
}

// ======================================================
// POST
//
// OTOMATIK:
// Authorization: Bearer WINGSM_SYNC_SECRET
//
// MANUEL:
// Super Admin session
//
// WINGSM'E POST YOK.
// ======================================================

export async function POST(
  request: Request
) {
  try {
    // ==================================================
    // YETKI
    // ==================================================

    const actor =
      await getActor(
        request
      );

    // ==================================================
    // WINGSM CONFIG
    // ==================================================

    const config =
      getWingSMConfigStatus();

    if (
      !config.configured
    ) {
      return Response.json(
        {
          success:
            true,

          mode:
            actor.mode,

          configured:
            false,

          status:
            "SKIPPED",

          completed:
            0,

          message:
            "WingSM ENV ayarları aktif değil. Hiçbir stok, talep veya transfer değiştirilmedi.",
        },
        {
          headers:
            noStoreHeaders(),
        }
      );
    }

    const pool =
      getPool();

    // ==================================================
    // ADVISORY LOCK
    //
    // Aynı anda iki transfer-complete görevi
    // cihazları işlemeye çalışmasın.
    // ==================================================

    const lockClient =
      await pool.connect();

    try {
      const lockResult =
        await lockClient.query(
          `
            SELECT
              pg_try_advisory_lock(
                hashtext(
                  'cnet_wingsm_transfer_complete'
                )
              ) AS locked
          `
        );

      if (
        lockResult.rows[0]
          ?.locked !== true
      ) {
        return Response.json(
          {
            success:
              true,

            mode:
              actor.mode,

            configured:
              true,

            status:
              "ALREADY_RUNNING",

            completed:
              0,

            message:
              "WingSM transfer tamamlama görevi zaten çalışıyor.",
          },
          {
            headers:
              noStoreHeaders(),
          }
        );
      }

      try {
        // ==============================================
        // TAMAMLANMAYA HAZIR TRANSFERLER
        // ==============================================

        const candidateResult =
          await pool.query(
            `
              SELECT
                dt.id
                  AS transfer_id

              FROM public.device_transfers dt

              JOIN public.device_requests dr
                ON dr.id =
                   dt.request_id

              JOIN public.stock_devices sd
                ON sd.id =
                   dt.device_id

              WHERE
                dt.status =
                  'WAITING_WING'

                AND
                dr.status =
                  'TRANSFER_WAITING'

                AND
                sd.status =
                  'TRANSFER_WAITING'

              ORDER BY
                dt.id ASC

              LIMIT 500
            `
          );

        // ==============================================
        // HAZIR TRANSFER YOK
        // ==============================================

        if (
          candidateResult
            .rowCount ===
          0
        ) {
          return Response.json(
            {
              success:
                true,

              mode:
                actor.mode,

              configured:
                true,

              status:
                "NO_READY_TRANSFER",

              completed:
                0,

              requestedBy:
                actor.username ||
                actor.email,

              message:
                "WingSM doğrulaması bekleyen transfer bulunamadı.",
            },
            {
              headers:
                noStoreHeaders(),
            }
          );
        }

        const completed:
          any[] = [];

        const skipped:
          any[] = [];

        // ==============================================
        // HER TRANSFERI AYRI TRANSACTION
        // ==============================================

        for (
          const candidate of
          candidateResult.rows
        ) {
          const transferId =
            Number(
              candidate
                .transfer_id
            );

          const client =
            await pool.connect();

          try {
            await client.query(
              "BEGIN"
            );

            // ==========================================
            // SATIRLARI KILITLE + TEKRAR DOGRULA
            // ==========================================

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

                    dt.created_at
                      AS transfer_created_at,

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

                  LEFT JOIN public.wingsm_device_locations wdl
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
              rowResult
                .rows[0];

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

            // ==========================================
            // DURUMLARI TEKRAR KONTROL
            // ==========================================

            if (
              String(
                row.transfer_status
              ) !==
                "WAITING_WING" ||
              String(
                row.request_status
              ) !==
                "TRANSFER_WAITING" ||
              String(
                row.device_status
              ) !==
                "TRANSFER_WAITING"
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

            // ==========================================
            // WINGSM DOGRULAMA
            //
            // 1) Once mevcut hizli yol:
            //    anlik stok konumu hedef magazada mi?
            //
            // 2) Degilse hareket gecmisi fallback:
            //    cihaz hedef magazaya gecip cok hizli
            //    satilmis olabilir.
            // ==========================================

            const sentAt =
              row.panel_sent_at ||
              row.transfer_created_at;

            const sentAtDate =
              new Date(
                sentAt
              );

            if (
              Number.isNaN(
                sentAtDate.getTime()
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
                  "Gonderildi tarihi gecersiz.",
              });

              continue;
            }

            const targetDepot =
              getWingSMDepotForBranch(
                String(
                  row
                    .to_branch_code ||
                    ""
                )
              );

            if (!targetDepot) {
              await client.query(
                "ROLLBACK"
              );

              skipped.push({
                transferId,

                imei:
                  row.imei,

                reason:
                  "WingSM hedef depo eslesmesi bulunamadi.",
              });

              continue;
            }

            let verificationMode:
              | "CURRENT_STOCK"
              | "MOVEMENT_HISTORY"
              | null =
                null;

            let verificationAt:
              Date | null =
                null;

            let verifiedWingDepot:
              string | null =
                null;

            let movementHistoryCount =
              0;

            // ------------------------------------------
            // A) ANLIK STOK KANITI
            // ------------------------------------------

            const currentStockMatches =
              String(
                row.wingsm_branch ||
                  ""
              ) ===
                String(
                  row.to_branch_code ||
                    ""
                ) &&
              Boolean(
                row.wingsm_updated_at
              ) &&
              new Date(
                row.wingsm_updated_at
              ).getTime() >=
                sentAtDate.getTime();

            if (
              currentStockMatches
            ) {
              const freshSyncResult =
                await client.query(
                  `
                    SELECT id

                    FROM public.wingsm_sync_runs

                    WHERE
                      panel_branch =
                        $1

                      AND
                      status =
                        'SUCCESS'

                      AND
                      COALESCE(
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
                    row
                      .to_branch_code,

                    sentAt,
                  ]
                );

              if (
                freshSyncResult
                  .rowCount ===
                1
              ) {
                verificationMode =
                  "CURRENT_STOCK";

                verificationAt =
                  new Date(
                    row
                      .wingsm_updated_at
                  );

                verifiedWingDepot =
                  String(
                    row.wingsm_depot ||
                      targetDepot
                  );
              }
            }

            // ------------------------------------------
            // B) HAREKET GECMISI FALLBACK
            // ------------------------------------------
            //
            // Anlik stokta gorunmuyorsa cihaz hedef
            // magazada satilmis olabilir. WingSM'in
            // resmi B2B IMEI hareket endpointini sadece
            // GET ile sorguluyoruz.
            // ------------------------------------------

            if (
              !verificationMode
            ) {
              try {
                const movementPayload =
                  await getWingSMProductMovementHistory(
                    {
                      serialNo:
                        String(
                          row.imei ||
                            ""
                        ),

                      startDate:
                        sentAtDate,

                      endDate:
                        new Date(),

                      depot:
                        targetDepot,
                    }
                  );

                const movementRows =
                  extractWingSMMovementRows(
                    movementPayload
                  );

                movementHistoryCount =
                  movementRows.length;

                if (
                  movementHistoryCount >
                  0
                ) {
                  verificationMode =
                    "MOVEMENT_HISTORY";

                  verificationAt =
                    new Date();

                  verifiedWingDepot =
                    targetDepot;
                }
              } catch (
                historyError: any
              ) {
                skipped.push({
                  transferId,

                  imei:
                    row.imei,

                  reason:
                    `WingSM hareket gecmisi okunamadi: ${
                      historyError?.message ||
                      "Bilinmeyen hata"
                    }`,
                });
              }
            }

            if (
              !verificationMode ||
              !verificationAt
            ) {
              await client.query(
                "ROLLBACK"
              );

              if (
                !skipped.some(
                  (item) =>
                    Number(
                      item?.transferId
                    ) ===
                    transferId
                )
              ) {
                skipped.push({
                  transferId,

                  imei:
                    row.imei,

                  reason:
                    "WingSM anlik stok veya hedef depo hareket gecmisi ile transfer dogrulanamadi.",
                });
              }

              continue;
            }

            const resultingDeviceStatus =
              verificationMode ===
              "CURRENT_STOCK"
                ? "AVAILABLE"
                : "MISSING";

            // ==========================================
            // 1) CIHAZI HEDEF MAGAZAYA TASI
            // ==========================================

            const deviceResult =
              await client.query(
                `
                  UPDATE public.stock_devices

                  SET
                    current_branch_code =
                      $2,

                    status =
                      $4,

                    wing_last_seen_at =
                      CASE
                        WHEN $4 = 'AVAILABLE'
                          THEN $3
                        ELSE wing_last_seen_at
                      END,

                    updated_at =
                      NOW()

                  WHERE
                    id = $1

                    AND
                    status =
                      'TRANSFER_WAITING'

                  RETURNING
                    id,
                    imei,
                    current_branch_code,
                    status
                `,
                [
                  row.device_id,

                  row
                    .to_branch_code,

                  verificationAt,

                  resultingDeviceStatus,
                ]
              );

            if (
              deviceResult
                .rowCount !==
              1
            ) {
              throw new Error(
                "Cihaz hedef mağazaya taşınamadı."
              );
            }

            // ==========================================
            // 2) TALEBI COMPLETED
            // ==========================================

            const requestResult =
              await client.query(
                `
                  UPDATE public.device_requests

                  SET
                    status =
                      'COMPLETED',

                    completed_at =
                      NOW(),

                    updated_at =
                      NOW()

                  WHERE
                    id = $1

                    AND
                    status =
                      'TRANSFER_WAITING'

                  RETURNING id
                `,
                [
                  row.request_id,
                ]
              );

            if (
              requestResult
                .rowCount !==
              1
            ) {
              throw new Error(
                "Talep tamamlanamadı."
              );
            }

            // ==========================================
            // 3) TRANSFER COMPLETED
            // ==========================================

            const wingReference =
              [
                "WINGSM",

                verificationMode,

                verifiedWingDepot ||
                  targetDepot,

                verificationAt
                  .toISOString(),
              ].join(":");

            const transferResult =
              await client.query(
                `
                  UPDATE public.device_transfers

                  SET
                    status =
                      'COMPLETED',

                    wing_transfer_at =
                      $2,

                    wing_reference =
                      $3,

                    completed_at =
                      NOW(),

                    updated_at =
                      NOW()

                  WHERE
                    id = $1

                    AND
                    status =
                      'WAITING_WING'

                  RETURNING id
                `,
                [
                  transferId,

                  verificationAt,

                  wingReference,
                ]
              );

            if (
              transferResult
                .rowCount !==
              1
            ) {
              throw new Error(
                "Transfer tamamlanamadı."
              );
            }

            // ==========================================
            // 4) EVENT LOG
            // ==========================================

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

                  $7,

                  $5,

                  $6::jsonb
                )
              `,
              [
                row.device_id,

                row.imei,

                row
                  .from_branch_code,

                row
                  .to_branch_code,

                "WINGSM_AUTO",

                JSON.stringify({
                  requestId:
                    Number(
                      row
                        .request_id
                    ),

                  transferId,

                  wingsmBranch:
                    row
                      .to_branch_code,

                  wingsmDepot:
                    verifiedWingDepot ||
                    targetDepot,

                  wingsmProductCode:
                    row
                      .product_code,

                  wingsmProductName:
                    row
                      .product_name,

                  wingsmUpdatedAt:
                    verificationAt
                      .toISOString(),

                  confirmedByWingSM:
                    true,

                  executionMode:
                    actor.mode,

                  executedBy:
                    actor.username ||
                    actor.email ||
                    "WINGSM_AUTO",

                  verificationMode,

                  movementHistoryCount,

                  targetDepot,

                  resultingDeviceStatus,

                  currentStockWingBranch:
                    row.wingsm_branch ||
                    null,

                  currentStockWingDepot:
                    row.wingsm_depot ||
                    null,

                  currentStockUpdatedAt:
                    row.wingsm_updated_at ||
                    null,
                }),

                resultingDeviceStatus,
              ]
            );

            await client.query(
              "COMMIT"
            );

            completed.push({
              transferId,

              requestId:
                Number(
                  row
                    .request_id
                ),

              deviceId:
                Number(
                  row
                    .device_id
                ),

              imei:
                String(
                  row.imei
                ),

              fromBranch:
                row
                  .from_branch_code,

              toBranch:
                row
                  .to_branch_code,

              wingsmDepot:
                verifiedWingDepot ||
                targetDepot,

              wingsmUpdatedAt:
                verificationAt
                  .toISOString(),

              verificationMode,

              movementHistoryCount,

              deviceStatus:
                resultingDeviceStatus,
            });
          } catch (
            error: any
          ) {
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

        // ==============================================
        // RESPONSE
        // ==============================================

        return Response.json(
          {
            success:
              true,

            mode:
              actor.mode,

            configured:
              true,

            status:
              "COMPLETED",

            requestedBy:
              actor.username ||
              actor.email ||
              "WINGSM_AUTO",

            counts: {
              candidates:
                candidateResult
                  .rowCount,

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
            headers:
              noStoreHeaders(),
          }
        );
      } finally {
        // ==============================================
        // ADVISORY LOCK RELEASE
        // ==============================================

        try {
          await lockClient.query(
            `
              SELECT
                pg_advisory_unlock(
                  hashtext(
                    'cnet_wingsm_transfer_complete'
                  )
                )
            `
          );
        } catch {}
      }
    } finally {
      lockClient.release();
    }
  } catch (
    error: any
  ) {
    console.error(
      "WINGSM_TRANSFER_COMPLETE_ERROR:",
      {
        message:
          error?.message,

        code:
          error?.code,

        detail:
          error?.detail,
      }
    );

    return Response.json(
      {
        success:
          false,

        error:
          error?.message ||
          "WingSM transferleri tamamlanamadı.",
      },
      {
        status:
          Number(
            error?.status ||
              500
          ),

        headers:
          noStoreHeaders(),
      }
    );
  }
}
