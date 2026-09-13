// app/api/wingsm/cache/route.ts

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
  var cnetWingSMCachePool:
    | Pool
    | undefined;
}

// ======================================================
// POSTGRESQL
// ======================================================

function getPool() {
  if (
    global.cnetWingSMCachePool
  ) {
    return global
      .cnetWingSMCachePool;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  global.cnetWingSMCachePool =
    new Pool({
      connectionString,

      max: 5,

      idleTimeoutMillis:
        30000,

      connectionTimeoutMillis:
        10000,
    });

  return global
    .cnetWingSMCachePool;
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

// ======================================================
// COOKIE
// ======================================================

function getCookieValue(
  request: Request,
  name: string
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
            `${name}=`
          )
      );

  if (!target) {
    return null;
  }

  return decodeURIComponent(
    target.substring(
      name.length + 1
    )
  );
}

// ======================================================
// PANEL BRANCH NORMALIZE
// ======================================================

function normalizePanelBranch(
  value: string
) {
  const upper =
    String(
      value || ""
    )
      .trim()
      .toLocaleUpperCase(
        "tr-TR"
      );

  if (
    upper === "CNET" ||
    upper === "CNET DEPO"
  ) {
    return "CNET";
  }

  if (
    upper === "CMR" ||
    upper === "CMR MERKEZ"
  ) {
    return "CMR";
  }

  if (
    upper === "SARAY" ||
    upper === "CMR SARAY" ||
    upper === "SARAYCMR"
  ) {
    return "SARAY";
  }

  if (
    upper === "KAPAKLI" ||
    upper === "CMR KAPAKLI" ||
    upper === "KAPAKLICMR"
  ) {
    return "KAPAKLI";
  }

  if (
    upper === "CADDE" ||
    upper === "CMR CADDE"
  ) {
    return "CADDE";
  }

  return upper;
}

// ======================================================
// USER
// ======================================================

async function getActiveUser(
  request: Request
) {
  const token =
    getCookieValue(
      request,
      COOKIE_NAME
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

  if (!session) {
    throw Object.assign(
      new Error(
        "Oturum geçersiz."
      ),
      {
        status: 401,
      }
    );
  }

  // ====================================================
  // POSTGRESQL USER
  // ====================================================

  if (session.userId) {
    const pool =
      getPool();

    const userResult =
      await pool.query(
        `
          SELECT
            id,
            username,
            email,
            branch,
            role,
            active

          FROM public.users

          WHERE id = $1

          LIMIT 1
        `,
        [
          session.userId,
        ]
      );

    const user =
      userResult.rows[0];

    if (
      !user ||
      !user.active
    ) {
      throw Object.assign(
        new Error(
          "Kullanıcı aktif değil."
        ),
        {
          status: 401,
        }
      );
    }

    const roleResult =
      await pool.query(
        `
          SELECT
            r.code

          FROM public.user_roles ur

          JOIN public.roles r
            ON r.id = ur.role_id

          WHERE
            ur.user_id = $1
            AND r.active = TRUE
        `,
        [
          session.userId,
        ]
      );

    const roles =
      roleResult.rows.map(
        (row) =>
          String(
            row.code
          )
      );

    return {
      userId:
        Number(
          user.id
        ),

      username:
        String(
          user.username ||
            user.email ||
            ""
        ),

      branch:
        normalizePanelBranch(
          String(
            user.branch ||
              ""
          )
        ),

      isSuperAdmin:
        roles.includes(
          "super_admin"
        ),
    };
  }

  // ====================================================
  // LEGACY
  // ====================================================

  return {
    userId: null,

    username:
      session.branch,

    branch:
      normalizePanelBranch(
        session.branch
      ),

    isSuperAdmin:
      false,
  };
}

// ======================================================
// GET
// ======================================================

export async function GET(
  request: Request
) {
  try {
    const user =
      await getActiveUser(
        request
      );

    const url =
      new URL(
        request.url
      );

    const requestedBranch =
      url.searchParams.get(
        "branch"
      );

    const all =
      url.searchParams.get(
        "all"
      ) === "1";

    const pool =
      getPool();

    // ==================================================
    // SUPER ADMIN TÜM MAĞAZALAR
    // ==================================================

    if (
      user.isSuperAdmin &&
      all
    ) {
      const mappingResult =
        await pool.query(
          `
            SELECT
              panel_branch,
              wingsm_depot,
              active

            FROM
              public.wingsm_depot_mapping

            WHERE
              active = TRUE

            ORDER BY
              panel_branch
          `
        );

      const stockResult =
        await pool.query(
          `
            SELECT
              id,
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

              active,

              first_seen_at,
              last_seen_at,
              synced_at

            FROM
              public.wingsm_stock_items

            WHERE
              active = TRUE

            ORDER BY
              panel_branch,
              product_name,
              serial_no
          `
        );

      const summaryResult =
        await pool.query(
          `
            SELECT
              panel_branch,
              wingsm_depot,

              COUNT(*)::int
                AS total_records,

              COUNT(
                DISTINCT serial_no
              ) FILTER (
                WHERE
                  serial_no IS NOT NULL
                  AND serial_no <> ''
              )::int
                AS serial_count,

              MAX(
                synced_at
              ) AS last_synced_at

            FROM
              public.wingsm_stock_items

            WHERE
              active = TRUE

            GROUP BY
              panel_branch,
              wingsm_depot

            ORDER BY
              panel_branch
          `
        );

      return Response.json(
        {
          success: true,

          mode:
            "ALL",

          requestedBy: {
            username:
              user.username,

            isSuperAdmin:
              true,
          },

          mappings:
            mappingResult.rows,

          summary:
            summaryResult.rows,

          stock:
            stockResult.rows,
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
    }

    // ==================================================
    // TEK MAĞAZA
    // ==================================================

    let branch =
      user.branch;

    if (
      user.isSuperAdmin &&
      requestedBranch
    ) {
      branch =
        normalizePanelBranch(
          requestedBranch
        );
    }

    const mappingResult =
      await pool.query(
        `
          SELECT
            panel_branch,
            wingsm_depot,
            active

          FROM
            public.wingsm_depot_mapping

          WHERE
            panel_branch = $1
            AND active = TRUE

          LIMIT 1
        `,
        [
          branch,
        ]
      );

    const mapping =
      mappingResult.rows[0];

    if (!mapping) {
      throw Object.assign(
        new Error(
          `WingSM mağaza eşleşmesi bulunamadı: ${branch}`
        ),
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // CACHE STOCK
    // ==================================================

    const stockResult =
      await pool.query(
        `
          SELECT
            id,

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

            active,

            first_seen_at,
            last_seen_at,
            synced_at

          FROM
            public.wingsm_stock_items

          WHERE
            panel_branch = $1
            AND active = TRUE

          ORDER BY
            product_name,
            serial_no

          LIMIT 10000
        `,
        [
          branch,
        ]
      );

    // ==================================================
    // DEVICE LOCATIONS
    // ==================================================

    const deviceResult =
      await pool.query(
        `
          SELECT
            serial_no,
            panel_branch,
            wingsm_depot,
            product_code,
            product_name,

            first_seen_at,
            last_seen_at,
            updated_at

          FROM
            public.wingsm_device_locations

          WHERE
            panel_branch = $1

          ORDER BY
            updated_at DESC

          LIMIT 10000
        `,
        [
          branch,
        ]
      );

    // ==================================================
    // LAST SYNC
    // ==================================================

    const syncResult =
      await pool.query(
        `
          SELECT
            id,
            status,

            received_count,
            inserted_count,
            updated_count,
            deactivated_count,

            error_message,

            started_at,
            finished_at

          FROM
            public.wingsm_sync_runs

          WHERE
            panel_branch = $1

          ORDER BY
            started_at DESC

          LIMIT 1
        `,
        [
          branch,
        ]
      );

    // ==================================================
    // RESPONSE
    // ==================================================

    return Response.json(
      {
        success: true,

        mode:
          "BRANCH",

        branch,

        depot:
          mapping.wingsm_depot,

        requestedBy: {
          username:
            user.username,

          isSuperAdmin:
            user.isSuperAdmin,
        },

        counts: {
          stock:
            stockResult.rowCount,

          devices:
            deviceResult.rowCount,
        },

        lastSync:
          syncResult.rows[0] ||
          null,

        stock:
          stockResult.rows,

        devices:
          deviceResult.rows,
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
      "WINGSM_CACHE_ERROR:",
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
          "WingSM cache okunamadı.",
      },
      {
        status:
          Number(
            error?.status ||
              500
          ),

        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }
}
