// app/api/wingsm/sync/route.ts

import crypto from "crypto";
import { Pool, type PoolClient } from "pg";

import {
  getWingSMConfigStatus,
  getWingSMStock,
} from "../../../lib/wingsm/server";

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
  var cnetWingSMSyncPool:
    | Pool
    | undefined;
}

// ======================================================
// POSTGRESQL
// ======================================================

function getPool() {
  if (
    global.cnetWingSMSyncPool
  ) {
    return global
      .cnetWingSMSyncPool;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  global.cnetWingSMSyncPool =
    new Pool({
      connectionString,
      max: 5,
      idleTimeoutMillis:
        30000,
      connectionTimeoutMillis:
        10000,
    });

  return global
    .cnetWingSMSyncPool;
}

// ======================================================
// SESSION
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

    const signatureBuffer =
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
      signatureBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        signatureBuffer,
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
      !payload ||
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
        (item) =>
          item.trim()
      )
      .find(
        (item) =>
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
          AND r.code = 'super_admin'
          AND r.active = TRUE

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
// WINGSM RESPONSE -> ARRAY
// ======================================================

function extractRows(
  payload: any
): any[] {
  if (
    Array.isArray(
      payload
    )
  ) {
    return payload;
  }

  const candidates = [
    payload?.data,
    payload?.Data,
    payload?.list,
    payload?.List,
    payload?.rows,
    payload?.Rows,
    payload?.items,
    payload?.Items,

    payload?.data?.list,
    payload?.data?.List,
    payload?.data?.rows,
    payload?.data?.items,

    payload?.Data?.List,
    payload?.Data?.Rows,
    payload?.Data?.Items,
  ];

  for (
    const candidate of
    candidates
  ) {
    if (
      Array.isArray(
        candidate
      )
    ) {
      return candidate;
    }
  }

  return [];
}

// ======================================================
// CASE INSENSITIVE VALUE
// ======================================================

function getValue(
  object: any,
  names: string[]
) {
  if (
    !object ||
    typeof object !==
      "object"
  ) {
    return null;
  }

  for (
    const name of
    names
  ) {
    if (
      object[name] !==
        undefined &&
      object[name] !==
        null
    ) {
      return object[name];
    }
  }

  const keys =
    Object.keys(
      object
    );

  for (
    const name of
    names
  ) {
    const found =
      keys.find(
        (key) =>
          key.toLowerCase() ===
          name.toLowerCase()
      );

    if (found) {
      return object[found];
    }
  }

  return null;
}

function cleanText(
  value: any,
  max = 1000
) {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(
      value
    ).trim();

  return text
    ? text.slice(
        0,
        max
      )
    : null;
}

function numberValue(
  value: any
) {
  if (
    typeof value ===
      "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : null;
  }

  const raw =
    String(
      value ?? ""
    )
      .trim()
      .replace(
        /\./g,
        ""
      )
      .replace(
        ",",
        "."
      );

  if (!raw) {
    return null;
  }

  const number =
    Number(
      raw
    );

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

// ======================================================
// SERIAL / IMEI LIST
// ======================================================

function extractSerials(
  row: any
) {
  const result:
    string[] = [];

  const direct =
    getValue(
      row,
      [
        "Serino",
        "SeriNo",
        "SerialNo",
        "serial_no",
        "IMEI",
        "Imei",
        "imei",
        "BarkodSeri",
      ]
    );

  if (direct) {
    const value =
      cleanText(
        direct,
        180
      );

    if (value) {
      result.push(
        value
      );
    }
  }

  const serialContainer =
    getValue(
      row,
      [
        "SerinoList",
        "SeriNoList",
        "SerialList",
      ]
    );

  const serialList =
    serialContainer?.List ||
    serialContainer?.list ||
    serialContainer;

  if (
    Array.isArray(
      serialList
    )
  ) {
    for (
      const item of
      serialList
    ) {
      const value =
        getValue(
          item,
          [
            "SerinoA",
            "Serino",
            "SeriNo",
            "SerialNo",
            "IMEI",
            "imei",
          ]
        );

      const serial =
        cleanText(
          value,
          180
        );

      if (
        serial &&
        !result.includes(
          serial
        )
      ) {
        result.push(
          serial
        );
      }
    }
  }

  return result;
}

// ======================================================
// NORMALIZE STOCK ROW
// ======================================================

function normalizeStockRow(
  row: any
) {
  return {
    wingsmProductId:
      cleanText(
        getValue(
          row,
          [
            "Id",
            "ID",
            "UrunId",
            "MalId",
            "MalIdI",
          ]
        ),
        120
      ),

    productCode:
      cleanText(
        getValue(
          row,
          [
            "MalKod",
            "MalKodu",
            "UrunKodu",
            "StokKod",
            "StokKodu",
            "Kod",
          ]
        ),
        180
      ),

    barcode:
      cleanText(
        getValue(
          row,
          [
            "Barkod",
            "Barcode",
            "BarKod",
          ]
        ),
        180
      ),

    productName:
      cleanText(
        getValue(
          row,
          [
            "MalAdI",
            "MalAdi",
            "UrunAdi",
            "StokAdi",
            "Ad",
            "Adi",
          ]
        ),
        2000
      ),

    productClass:
      cleanText(
        getValue(
          row,
          [
            "MalSinifI",
            "MalSinifi",
            "Sinif",
            "SinifKod",
          ]
        ),
        120
      ),

    productType:
      cleanText(
        getValue(
          row,
          [
            "Cins",
            "CinsKod",
            "Marka",
          ]
        ),
        120
      ),

    productGroup:
      cleanText(
        getValue(
          row,
          [
            "Grup",
            "GrupKod",
            "Model",
          ]
        ),
        120
      ),

    productGroup2:
      cleanText(
        getValue(
          row,
          [
            "Grup2",
            "Grup2Kod",
            "Renk",
          ]
        ),
        120
      ),

    quantity:
      numberValue(
        getValue(
          row,
          [
            "Miktar",
            "Stok",
            "Mevcut",
            "Adet",
            "Bakiye",
          ]
        )
      ),

    serials:
      extractSerials(
        row
      ),

    rawData:
      row,
  };
}

// ======================================================
// BRANCH SYNC
// ======================================================

async function syncBranch(
  client: PoolClient,
  panelBranch: string,
  depot: string
) {
  const syncResult =
    await client.query(
      `
        INSERT INTO public.wingsm_sync_runs (
          panel_branch,
          wingsm_depot,
          status
        )

        VALUES (
          $1,
          $2,
          'STARTED'
        )

        RETURNING id
      `,
      [
        panelBranch,
        depot,
      ]
    );

  const syncId =
    Number(
      syncResult
        .rows[0]
        .id
    );

  try {
    // WingSM CANLI API
    const payload =
      await getWingSMStock(
        depot,
        true
      );

    const rows =
      extractRows(
        payload
      );

    // ================================================
    // Eski cache snapshot
    // ================================================

    const oldCountResult =
      await client.query(
        `
          SELECT
            COUNT(*)::int
              AS count

          FROM public.wingsm_stock_items

          WHERE
            panel_branch = $1
            AND active = TRUE
        `,
        [
          panelBranch,
        ]
      );

    const oldCount =
      Number(
        oldCountResult
          .rows[0]
          ?.count || 0
      );

    // Cache tablosu snapshot olduğu için
    // bu mağazanın eski verisini temizliyoruz.
    await client.query(
      `
        DELETE FROM
          public.wingsm_stock_items

        WHERE
          panel_branch = $1
      `,
      [
        panelBranch,
      ]
    );

    let insertedCount =
      0;

    let deviceCount =
      0;

    for (
      const sourceRow of
      rows
    ) {
      const item =
        normalizeStockRow(
          sourceRow
        );

      // ==============================================
      // IMEI/SERIAL VARSA HER SERİ AYRI KAYIT
      // ==============================================

      if (
        item.serials.length >
        0
      ) {
        for (
          const serialNo of
          item.serials
        ) {
          await client.query(
            `
              INSERT INTO public.wingsm_stock_items (
                panel_branch,
                wingsm_depot,

                wingsm_product_id,
                product_code,
                barcode,

                serial_no,
                product_name,

                product_class,
                product_type,
                product_group,
                product_group2,

                quantity,

                raw_data,

                active,

                first_seen_at,
                last_seen_at,
                synced_at
              )

              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                $11,
                1,
                $12::jsonb,
                TRUE,
                NOW(),
                NOW(),
                NOW()
              )
            `,
            [
              panelBranch,
              depot,

              item.wingsmProductId,
              item.productCode,
              item.barcode,

              serialNo,
              item.productName,

              item.productClass,
              item.productType,
              item.productGroup,
              item.productGroup2,

              JSON.stringify(
                item.rawData
              ),
            ]
          );

          // Cihazın son WingSM mağazası
          await client.query(
            `
              INSERT INTO public.wingsm_device_locations (
                serial_no,

                panel_branch,
                wingsm_depot,

                product_code,
                product_name,

                raw_data,

                first_seen_at,
                last_seen_at,
                updated_at
              )

              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6::jsonb,
                NOW(),
                NOW(),
                NOW()
              )

              ON CONFLICT (
                serial_no
              )

              DO UPDATE SET
                panel_branch =
                  EXCLUDED.panel_branch,

                wingsm_depot =
                  EXCLUDED.wingsm_depot,

                product_code =
                  EXCLUDED.product_code,

                product_name =
                  EXCLUDED.product_name,

                raw_data =
                  EXCLUDED.raw_data,

                last_seen_at =
                  NOW(),

                updated_at =
                  NOW()
            `,
            [
              serialNo,

              panelBranch,
              depot,

              item.productCode,
              item.productName,

              JSON.stringify(
                item.rawData
              ),
            ]
          );

          insertedCount++;
          deviceCount++;
        }
      }

      // ==============================================
      // SERİ YOKSA ÜRÜN BAZLI KAYIT
      // ==============================================

      else {
        await client.query(
          `
            INSERT INTO public.wingsm_stock_items (
              panel_branch,
              wingsm_depot,

              wingsm_product_id,
              product_code,
              barcode,

              serial_no,
              product_name,

              product_class,
              product_type,
              product_group,
              product_group2,

              quantity,

              raw_data,

              active,

              first_seen_at,
              last_seen_at,
              synced_at
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
              $8,
              $9,
              $10,
              $11,

              $12::jsonb,

              TRUE,

              NOW(),
              NOW(),
              NOW()
            )
          `,
          [
            panelBranch,
            depot,

            item.wingsmProductId,
            item.productCode,
            item.barcode,

            item.productName,

            item.productClass,
            item.productType,
            item.productGroup,
            item.productGroup2,

            item.quantity,

            JSON.stringify(
              item.rawData
            ),
          ]
        );

        insertedCount++;
      }
    }

    await client.query(
      `
        UPDATE public.wingsm_sync_runs

        SET
          status = 'SUCCESS',

          received_count = $2,
          inserted_count = $3,
          updated_count = 0,
          deactivated_count = $4,

          finished_at = NOW()

        WHERE id = $1
      `,
      [
        syncId,
        rows.length,
        insertedCount,
        oldCount,
      ]
    );

    return {
      success: true,
      branch:
        panelBranch,
      depot,
      received:
        rows.length,
      inserted:
        insertedCount,
      devices:
        deviceCount,
    };
  } catch (error: any) {
    await client.query(
      `
        UPDATE public.wingsm_sync_runs

        SET
          status = 'FAILED',

          error_message = $2,

          finished_at = NOW()

        WHERE id = $1
      `,
      [
        syncId,
        String(
          error?.message ||
            "Bilinmeyen hata"
        ).slice(
          0,
          4000
        ),
      ]
    );

    return {
      success: false,
      branch:
        panelBranch,
      depot,
      error:
        error?.message ||
        "Senkronizasyon başarısız.",
    };
  }
}

// ======================================================
// GET - DURUM
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

        ready:
          true,

        message:
          config.configured
            ? "WingSM senkronizasyon servisi çalışmaya hazır."
            : "WingSM senkronizasyon altyapısı hazır. ENV/IP bağlantısı henüz aktif değil.",
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
          "WingSM sync durumu alınamadı.",
      },
      {
        status:
          Number(
            error?.status ||
              500
          ),
      }
    );
  }
}

// ======================================================
// POST - TÜM MAĞAZALARI SYNC
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
    // ENV YOKSA DIŞARI İSTEK YOK
    // ==================================================

    if (
      !config.configured
    ) {
      return Response.json(
        {
          success: true,

          configured:
            false,

          status:
            "SKIPPED",

          requestedBy:
            admin.username ||
            admin.email,

          message:
            "WingSM ENV ayarları henüz yapılmadı. Hiçbir dış API isteği gönderilmedi.",
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

    const mappings =
      await pool.query(
        `
          SELECT
            panel_branch,
            wingsm_depot

          FROM
            public.wingsm_depot_mapping

          WHERE
            active = TRUE

          ORDER BY
            id
        `
      );

    const results:
      any[] = [];

    // WingSM'yi gereksiz yere aynı anda
    // 5 istekle zorlamıyoruz.
    // Depolar sırayla çekilecek.
    for (
      const mapping of
      mappings.rows
    ) {
      const client =
        await pool.connect();

      try {
        const result =
          await syncBranch(
            client,

            String(
              mapping.panel_branch
            ),

            String(
              mapping.wingsm_depot
            )
          );

        results.push(
          result
        );
      } finally {
        client.release();
      }
    }

    const successCount =
      results.filter(
        (item) =>
          item.success
      ).length;

    const failedCount =
      results.length -
      successCount;

    return Response.json(
      {
        success:
          failedCount === 0,

        configured:
          true,

        status:
          failedCount === 0
            ? "SUCCESS"
            : "PARTIAL",

        requestedBy:
          admin.username ||
          admin.email,

        totals: {
          branches:
            results.length,

          success:
            successCount,

          failed:
            failedCount,
        },

        results,
      },
      {
        status:
          failedCount ===
          results.length
            ? 500
            : 200,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "WINGSM_SYNC_ERROR:",
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
          "WingSM senkronizasyonu yapılamadı.",
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
