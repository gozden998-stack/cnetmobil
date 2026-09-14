import { NextRequest } from "next/server";
import { Pool, PoolClient } from "pg";
import crypto from "crypto";

export const runtime = "nodejs";

// ======================================================
// POSTGRESQL
// ======================================================

declare global {
  // eslint-disable-next-line no-var
  var cnetExternalPurchasePool: Pool | undefined;
}

export const externalPurchasePool =
  global.cnetExternalPurchasePool ||
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  global.cnetExternalPurchasePool =
    externalPurchasePool;
}

// ======================================================
// SESSION
// Mevcut app/api/auth/route.ts ile aynı cookie / imza yapısı.
// ======================================================

const COOKIE_NAME = "cnet_auth";

type SessionPayload = {
  userId: number | null;
  role: "admin" | "personel";
  branch: string;
  exp: number;
  legacy?: boolean;
};

export type ExternalPurchaseActor = {
  userId: number | null;
  email: string | null;

  branch: string;

  sessionRole:
    | "admin"
    | "personel";

  accessRole:
    | "super_admin"
    | "yonetici"
    | "personel";

  canManagePayments: boolean;
};

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
        .digest("base64url");

    const sigBuffer =
      Buffer.from(signature);

    const expectedBuffer =
      Buffer.from(
        expectedSignature
      );

    if (
      sigBuffer.length !==
      expectedBuffer.length
    ) {
      return null;
    }

    if (
      !crypto.timingSafeEqual(
        sigBuffer,
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
// OTURUMDAKİ KULLANICIYI BUL
// Yönetici yetkisi client'tan GELMEZ.
// users + user_roles tablosundan server-side doğrulanır.
// ======================================================

export async function requireExternalPurchaseActor(
  request: NextRequest,
  client?: PoolClient
): Promise<ExternalPurchaseActor> {
  const token =
    request.cookies.get(
      COOKIE_NAME
    )?.value || "";

  const session =
    token
      ? verifySession(token)
      : null;

  if (!session) {
    throw Object.assign(
      new Error(
        "Oturum bulunamadı."
      ),
      {
        status: 401,
      }
    );
  }

  // ----------------------------------------------------
  // LEGACY OTURUM
  // ----------------------------------------------------

  if (!session.userId) {
    const accessRole:
      ExternalPurchaseActor["accessRole"] =
      session.role === "admin"
        ? "yonetici"
        : "personel";

    return {
      userId: null,
      email: null,

      branch:
        session.branch ||
        "CMR MERKEZ",

      sessionRole:
        session.role,

      accessRole,

      canManagePayments:
        session.role ===
        "admin",
    };
  }

  const db =
    client ||
    externalPurchasePool;

  // ----------------------------------------------------
  // KULLANICI
  // ----------------------------------------------------

  const userResult =
    await db.query(
      `
        SELECT
          u.id,
          u.email,
          u.branch,
          u.role,
          u.active
        FROM public.users u
        WHERE u.id = $1
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

  // ----------------------------------------------------
  // GERÇEK YETKİ
  // ----------------------------------------------------

  const roleResult =
    await db.query(
      `
        SELECT
          r.code
        FROM public.user_roles ur
        JOIN public.roles r
          ON r.id = ur.role_id
        WHERE ur.user_id = $1
          AND r.active = TRUE
        ORDER BY
          CASE r.code
            WHEN 'super_admin'
              THEN 1
            WHEN 'yonetici'
              THEN 2
            WHEN 'personel'
              THEN 3
            ELSE 9
          END
        LIMIT 1
      `,
      [
        session.userId,
      ]
    );

  const roleCode =
    String(
      roleResult.rows[0]
        ?.code ||
        (
          user.role ===
          "admin"
            ? "yonetici"
            : "personel"
        )
    );

  const accessRole:
    ExternalPurchaseActor["accessRole"] =
    roleCode ===
    "super_admin"
      ? "super_admin"
      : roleCode ===
        "yonetici"
      ? "yonetici"
      : "personel";

  return {
    userId:
      Number(user.id),

    email:
      user.email
        ? String(
            user.email
          )
        : null,

    branch:
      String(
        user.branch ||
        session.branch ||
        "CMR MERKEZ"
      ),

    sessionRole:
      session.role,

    accessRole,

    canManagePayments:
      accessRole ===
        "super_admin" ||
      accessRole ===
        "yonetici",
  };
}

// ======================================================
// HASSAS VERİ ŞİFRELEME
// TC / IBAN / IBAN SAHİBİ
// AES-256-GCM
// ======================================================

function getDataKey() {
  const secret =
    process.env
      .EXTERNAL_PURCHASE_DATA_SECRET;

  if (
    !secret ||
    secret.length < 16
  ) {
    throw new Error(
      "EXTERNAL_PURCHASE_DATA_SECRET bulunamadı veya çok kısa."
    );
  }

  return crypto
    .createHash("sha256")
    .update(secret)
    .digest();
}

export function encryptSensitive(
  value: string
) {
  const iv =
    crypto.randomBytes(12);

  const cipher =
    crypto.createCipheriv(
      "aes-256-gcm",
      getDataKey(),
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        value,
        "utf8"
      ),

      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    iv.toString(
      "base64url"
    ),

    tag.toString(
      "base64url"
    ),

    encrypted.toString(
      "base64url"
    ),
  ].join(".");
}

export function decryptSensitive(
  payload: string
) {
  const [
    ivText,
    tagText,
    encryptedText,
  ] =
    String(
      payload || ""
    ).split(".");

  if (
    !ivText ||
    !tagText ||
    !encryptedText
  ) {
    throw new Error(
      "Şifreli veri formatı geçersiz."
    );
  }

  const decipher =
    crypto.createDecipheriv(
      "aes-256-gcm",

      getDataKey(),

      Buffer.from(
        ivText,
        "base64url"
      )
    );

  decipher.setAuthTag(
    Buffer.from(
      tagText,
      "base64url"
    )
  );

  const decrypted =
    Buffer.concat([
      decipher.update(
        Buffer.from(
          encryptedText,
          "base64url"
        )
      ),

      decipher.final(),
    ]);

  return decrypted.toString(
    "utf8"
  );
}

// ======================================================
// NORMALIZE
// ======================================================

export function normalizePhone(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .replace(
      /\D/g,
      ""
    )
    .slice(
      0,
      15
    );
}

export function normalizeTc(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .replace(
      /\D/g,
      ""
    )
    .slice(
      0,
      11
    );
}

export function normalizeIban(
  value: unknown
) {
  return String(
    value ?? ""
  )
    .replace(
      /\s+/g,
      ""
    )
    .toUpperCase()
    .slice(
      0,
      34
    );
}

// ======================================================
// PARA
// 42.500
// 42.500,50
// 42500
// 42500.50
// destekler.
// ======================================================

export function parseMoney(
  value: unknown
) {
  if (
    typeof value ===
    "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : 0;
  }

  let text =
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

  if (!text) {
    return 0;
  }

  if (
    text.includes(",") &&
    text.includes(".")
  ) {
    // 42.500,50
    text =
      text
        .replace(
          /\./g,
          ""
        )
        .replace(
          ",",
          "."
        );
  } else if (
    text.includes(",")
  ) {
    // 42500,50
    text =
      text.replace(
        ",",
        "."
      );
  } else {
    // 42.500 -> 42500
    const thousandFormatted =
      /^\d{1,3}(\.\d{3})+$/.test(
        text
      );

    if (
      thousandFormatted
    ) {
      text =
        text.replace(
          /\./g,
          ""
        );
    }
  }

  const number =
    Number(text);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

export function formatTry(
  value:
    | number
    | string
) {
  const number =
    Number(
      value || 0
    );

  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }
  ).format(number);
}

// ======================================================
// TELEGRAM İÇİN TELEFON MASKELE
// ======================================================

export function maskPhone(
  value: string
) {
  const digits =
    normalizePhone(value);

  if (
    digits.length < 7
  ) {
    return "***";
  }

  return `${digits.slice(
    0,
    4
  )}***${digits.slice(-3)}`;
}

// ======================================================
// TELEGRAM
// TC / IBAN BURAYA GÖNDERİLMEYECEK.
// ======================================================

export async function sendExternalPurchaseTelegram(
  message: string
) {
  const token =
    process.env
      .TELEGRAM_BOT_TOKEN;

  const chatId =
    process.env
      .TELEGRAM_CHAT_ID;

  if (
    !token ||
    !chatId
  ) {
    console.warn(
      "Telegram env eksik: TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID"
    );

    return {
      ok: false,
      skipped: true,
    };
  }

  const response =
    await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            chat_id:
              chatId,

            text:
              message,

            disable_web_page_preview:
              true,
          }),

        cache:
          "no-store",

        signal:
          AbortSignal.timeout(
            10_000
          ),
      }
    );

  if (
    !response.ok
  ) {
    const raw =
      await response
        .text()
        .catch(
          () => ""
        );

    console.error(
      "Telegram gönderim hatası:",
      response.status,
      raw
    );

    return {
      ok: false,
      skipped: false,
    };
  }

  return {
    ok: true,
    skipped: false,
  };
}

// ======================================================
// DEKONT GÖRME YETKİSİ
// Yönetici tümünü.
// Normal kullanıcı sadece kendi işlemini.
// ======================================================

export function isOwnerOrManager(
  actor: ExternalPurchaseActor,

  row: {
    source_user_id?:
      | number
      | null;
  }
) {
  if (
    actor.canManagePayments
  ) {
    return true;
  }

  if (
    !actor.userId
  ) {
    return false;
  }

  return (
    Number(
      row.source_user_id
    ) ===
    Number(
      actor.userId
    )
  );
}
