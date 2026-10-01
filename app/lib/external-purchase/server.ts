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
// IMEI SÜTUNU
// Tablo bu repodan bagimsiz (elle) olusturulmus, device_imei
// sonradan eklendigi icin idempotent ALTER TABLE ile garanti altina
// aliniyor.
// ======================================================

let imeiColumnEnsured = false;

export async function ensureExternalPurchaseImeiColumn(
  client?: PoolClient
) {
  if (imeiColumnEnsured) return;

  const db = client || externalPurchasePool;

  await db.query(`
    ALTER TABLE public.external_purchase_requests
    ADD COLUMN IF NOT EXISTS device_imei TEXT
  `);

  imeiColumnEnsured = true;
}

export function normalizeImei(
  value: unknown
) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 15);
}

// ======================================================
// SMS DOĞRULAMA (OTP) TABLOSU
// Diğer tablolar gibi bu repodan bağımsız, idempotent
// CREATE TABLE IF NOT EXISTS ile garanti altına alınıyor.
// ======================================================

let otpTableEnsured = false;

export async function ensureExternalPurchaseOtpTable(
  client?: PoolClient
) {
  if (otpTableEnsured) return;

  const db = client || externalPurchasePool;

  await db.query(`
    CREATE TABLE IF NOT EXISTS public.external_purchase_otp_codes (
      id SERIAL PRIMARY KEY,
      phone TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      actor_user_id INTEGER,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      consumed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS external_purchase_otp_codes_phone_idx
    ON public.external_purchase_otp_codes (phone, created_at)
  `);

  otpTableEnsured = true;
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
// SMS DOĞRULAMA (OTP) - EKOMESAJ
// "Ödeme Talebi Gönder" öncesi müşteri telefonuna
// 6 haneli doğrulama kodu gönderilir, kod hash'lenerek
// saklanır, talep oluşturulurken tüketilir.
// ======================================================

export function generateOtpCode() {
  return String(
    crypto.randomInt(0, 1_000_000)
  ).padStart(6, "0");
}

export function hashOtpCode(
  phone: string,
  code: string
) {
  return crypto
    .createHash("sha256")
    .update(`${phone}:${code}`)
    .digest("hex");
}

// Ekomesaj "ülke kodu dahil tam numara" bekliyor (ör. 905xxxxxxxxx).
function toEkoMesajPhone(phone: string) {
  const digits = normalizePhone(phone);

  if (digits.startsWith("90") && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith("0") && digits.length === 11) {
    return `90${digits.slice(1)}`;
  }

  if (digits.length === 10) {
    return `90${digits}`;
  }

  return digits;
}

export async function sendExternalPurchaseOtpSms(
  phone: string,
  code: string
) {
  const baseUrl =
    process.env.EKOMESAJ_BASE_URL;

  const username =
    process.env.EKOMESAJ_USERNAME;

  const password =
    process.env.EKOMESAJ_PASSWORD;

  const sender =
    process.env.EKOMESAJ_SENDER;

  if (!baseUrl || !username || !password || !sender) {
    console.warn(
      "Ekomesaj env eksik: EKOMESAJ_BASE_URL / EKOMESAJ_USERNAME / EKOMESAJ_PASSWORD / EKOMESAJ_SENDER"
    );

    return {
      ok: false,
      skipped: true,
    };
  }

  const authHeader =
    "Basic " +
    Buffer.from(`${username}:${password}`).toString("base64");

  // --------------------------------------------------
  // KODUN GİDECEĞİ NUMARA
  //
  // PAYMENT_APPROVAL_PHONES tanımlıysa kod, formdaki müşteri
  // numarasına DEĞİL bu sabit numaraya (virgülle ayrılmış
  // birden fazla olabilir) gider. Tanımlı değilse müşterinin
  // kendi numarasına gider.
  // --------------------------------------------------

  const approverPhones = (process.env.PAYMENT_APPROVAL_PHONES || "")
    .split(/[,;\s]+/)
    .map((value) => toEkoMesajPhone(value.trim()))
    .filter((value) => value.length >= 10);

  const targetPhones =
    approverPhones.length > 0
      ? approverPhones
      : [toEkoMesajPhone(phone)];

  const content =
    approverPhones.length > 0
      ? `CNETMOBIL odeme talebi onay kodu: ${code}. Musteri tel: ***${normalizePhone(phone).slice(-4)}. Kodu kimseyle paylasmayin.`
      : `CNETMOBIL dogrulama kodunuz: ${code}. Kodu kimseyle paylasmayin.`;

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/sms/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        // Ekomesaj /sms/create şeması: anlık (sendingType 1) tekil SMS.
        // İçerik ASCII olduğu için encoding 0 yeterli.
        body: JSON.stringify({
          type: 1,
          sendingType: 1,
          title: "CNETMOBIL OTP",
          content,
          numbers: targetPhones,
          encoding: 0,
          sender,
          commercial: false,
          skipAhsQuery: true,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }
    );

    const raw = await response.text().catch(() => "");

    // Yanıt: { data: { pkgID }, err: { code, status, message } }
    let parsed: any = null;

    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }

    const hasError = Boolean(
      parsed?.err?.code ||
        parsed?.err?.message ||
        (parsed && !parsed?.data?.pkgID)
    );

    if (!response.ok || hasError) {
      console.error(
        "Ekomesaj OTP gönderim hatası:",
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
      toApprover: approverPhones.length > 0,
    };
  } catch (error) {
    console.error(
      "Ekomesaj OTP gönderim istisnası:",
      error
    );

    return {
      ok: false,
      skipped: false,
    };
  }
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
