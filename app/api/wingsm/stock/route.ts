// app/api/wingsm/stock/route.ts

import crypto from "crypto";
import { Pool } from "pg";

import {
  getWingSMConfigStatus,
  getWingSMDepotForBranch,
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
  var cnetWingSMStockPool:
    | Pool
    | undefined;
}

// ======================================================
// POSTGRESQL
// ======================================================

function getPool() {
  if (
    global.cnetWingSMStockPool
  ) {
    return global
      .cnetWingSMStockPool;
  }

  const connectionString =
    process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL bulunamadı."
    );
  }

  global.cnetWingSMStockPool =
    new Pool({
      connectionString,

      max: 5,

      idleTimeoutMillis:
        30000,

      connectionTimeoutMillis:
        10000,
    });

  return global
    .cnetWingSMStockPool;
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

  const parts =
    raw
      .split(";")
      .map(
        (item) =>
          item.trim()
      );

  const target =
    parts.find(
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
// AKTİF KULLANICI
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

  // ----------------------------------------------
  // PostgreSQL kullanıcısı
  // ----------------------------------------------

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

    const roleCodes =
      roleResult.rows.map(
        (row) =>
          String(
            row.code
          )
      );

    return {
      id:
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
        String(
          user.branch ||
            ""
        ),

      isSuperAdmin:
        roleCodes.includes(
          "super_admin"
        ),
    };
  }

  // ----------------------------------------------
  // Legacy kullanıcı
  // ----------------------------------------------

  return {
    id: null,

    username:
      session.branch,

    branch:
      session.branch,

    // Legacy admin Super Admin sayılmayacak.
    isSuperAdmin:
      false,
  };
}

// ======================================================
// NORMALIZE PANEL BRANCH
// ======================================================

function normalizeRequestedBranch(
  value: string
) {
  const upper =
    value
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

  return value.trim();
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

    // ==================================================
    // MAĞAZA SEÇİMİ
    // ==================================================
    //
    // Super Admin:
    // ?branch=CNET gibi seçebilir.
    //
    // Personel:
    // URL'den mağaza değiştiremez.
    // Kendi branch'i zorunlu.
    // ==================================================

    let branch =
      user.branch;

    if (
      user.isSuperAdmin &&
      requestedBranch
    ) {
      branch =
        requestedBranch;
    }

    branch =
      normalizeRequestedBranch(
        branch
      );

    const depot =
      getWingSMDepotForBranch(
        branch
      );

    if (!depot) {
      throw Object.assign(
        new Error(
          `Bu mağaza için WingSM depo eşleşmesi bulunamadı: ${branch}`
        ),
        {
          status: 400,
        }
      );
    }

    // ==================================================
    // CONFIG
    // ==================================================

    const config =
      getWingSMConfigStatus();

    // ENV henüz yoksa WingSM'ye istek atma.
    if (
      !config.configured
    ) {
      return Response.json(
        {
          success: true,

          configured:
            false,

          live:
            false,

          branch,

          depot,

          stock: [],

          message:
            "WingSM ENV ayarları henüz yapılmadı. Mağaza/depo eşleşmesi hazır.",
        },
        {
          status: 200,

          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    // ==================================================
    // WINGSM CANLI STOK
    // ==================================================

    const result =
      await getWingSMStock(
        depot,
        true
      );

    return Response.json(
      {
        success: true,

        configured:
          true,

        live:
          true,

        branch,

        depot,

        stock:
          result,

        requestedBy: {
          user:
            user.username,

          isSuperAdmin:
            user.isSuperAdmin,
        },
      },
      {
        status: 200,

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
      "WINGSM_STOCK_ERROR:",
      {
        message:
          error?.message,

        stack:
          error?.stack,

        code:
          error?.code,
      }
    );

    return Response.json(
      {
        success: false,

        error:
          error?.message ||
          "WingSM stok bilgisi alınamadı.",
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
