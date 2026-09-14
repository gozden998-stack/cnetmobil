// app/api/wingsm/diagnostic/route.ts
// CNETMOBIL - WingSM B2B teşhis testi
//
// TESTLER:
// 1) Authenticate
// 2) B2B müşteri servisi
// 3) B2B stok servisi
//
// NOT:
// - Token response'a ASLA yazılmaz.
// - Şifre response'a ASLA yazılmaz.
// - Veri değiştirmez.
// - Sadece GET teşhis çağrıları yapar.

import {
  NextRequest,
  NextResponse,
} from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ======================================================
// TYPES
// ======================================================

type AuthPayload = {
  token?: string;
  accessToken?: string;
  access_token?: string;
  data?: any;
  message?: string;
  error?: string;
  success?: boolean;
};

// ======================================================
// TOKEN BUL
// ======================================================

function pickToken(
  payload: AuthPayload | null
): string | null {
  if (!payload) {
    return null;
  }

  const candidates = [
    payload.token,
    payload.accessToken,
    payload.access_token,
    payload.data?.token,
    payload.data?.accessToken,
    payload.data?.access_token,
    typeof payload.data === "string"
      ? payload.data
      : null,
  ];

  for (
    const candidate of
    candidates
  ) {
    if (
      typeof candidate ===
        "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return null;
}

// ======================================================
// JSON PARSE
// ======================================================

function parsePayload(
  raw: string
): any {
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

// ======================================================
// GÜVENLİ PREVIEW
// ======================================================

function sanitizeValue(
  value: any
): any {
  if (
    value === null ||
    value === undefined
  ) {
    return value;
  }

  if (
    Array.isArray(value)
  ) {
    return value.map(
      sanitizeValue
    );
  }

  if (
    typeof value ===
    "object"
  ) {
    const cleaned: Record<
      string,
      any
    > = {};

    for (
      const [
        key,
        itemValue,
      ] of Object.entries(
        value
      )
    ) {
      const normalizedKey =
        key
          .toLowerCase()
          .replace(
            /[_-]/g,
            ""
          );

      if (
        normalizedKey ===
          "token" ||
        normalizedKey ===
          "accesstoken" ||
        normalizedKey ===
          "password" ||
        normalizedKey ===
          "secret"
      ) {
        cleaned[key] =
          "***GIZLENDI***";

        continue;
      }

      cleaned[key] =
        sanitizeValue(
          itemValue
        );
    }

    return cleaned;
  }

  return value;
}

function safePreview(
  value: unknown,
  max = 2000
) {
  let text = "";

  try {
    const cleaned =
      sanitizeValue(
        value
      );

    text =
      typeof cleaned ===
      "string"
        ? cleaned
        : JSON.stringify(
            cleaned,
            null,
            2
          );
  } catch {
    text =
      "Cevap görüntülenemedi.";
  }

  if (
    text.length <= max
  ) {
    return text;
  }

  return (
    text.slice(
      0,
      max
    ) +
    "\n...TRUNCATED..."
  );
}

// ======================================================
// SOURCE BLOCK TESPİT
// ======================================================

function detectSourceBlock(
  payload: unknown
) {
  let text = "";

  try {
    text =
      typeof payload ===
      "string"
        ? payload
        : JSON.stringify(
            payload ?? {}
          );
  } catch {
    text = "";
  }

  return (
    /no valid source/i.test(
      text
    )
  );
}

// ======================================================
// SOURCE IP TESPİT
// ======================================================

function extractSourceIp(
  payload: unknown
) {
  let text = "";

  try {
    text =
      typeof payload ===
      "string"
        ? payload
        : JSON.stringify(
            payload ?? {}
          );
  } catch {
    return null;
  }

  const match =
    text.match(
      /Ip\s*:\s*([0-9.]+)/i
    );

  return (
    match?.[1] ||
    null
  );
}

// ======================================================
// RESPONSE
// ======================================================

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

// ======================================================
// GET
// ======================================================

export async function GET(
  request: NextRequest
) {
  const startedAt =
    Date.now();

  // ====================================================
  // ENV
  // ====================================================

  const baseUrl =
    process.env
      .WINGSM_BASE_URL
      ?.trim()
      .replace(
        /\/+$/,
        ""
      );

  const user =
    process.env
      .WINGSM_USER
      ?.trim();

  const password =
    process.env
      .WINGSM_PASSWORD;

  // ====================================================
  // DEPO
  // ====================================================

  const depoRaw =
    request.nextUrl
      .searchParams
      .get("depo") ||
    "KAPAKLICMR";

  const depo =
    String(depoRaw)
      .trim()
      .toUpperCase();

  const allowedDepots =
    new Set([
      "CNET",
      "CMR",
      "SARAYCMR",
      "KAPAKLICMR",
      "CADDE",
    ]);

  if (
    !allowedDepots.has(
      depo
    )
  ) {
    return json(
      {
        success: false,

        diagnostic:
          "WINGSM_B2B_SOURCE_TEST",

        stage:
          "INPUT",

        message:
          `Geçersiz depo: ${depo}`,

        allowedDepots:
          Array.from(
            allowedDepots
          ),
      },
      400
    );
  }

  // ====================================================
  // ENV KONTROL
  // ====================================================

  if (
    !baseUrl ||
    !user ||
    !password
  ) {
    return json(
      {
        success: false,

        diagnostic:
          "WINGSM_B2B_SOURCE_TEST",

        stage:
          "CONFIG",

        message:
          "WingSM environment ayarları eksik.",

        env: {
          WINGSM_BASE_URL:
            Boolean(
              baseUrl
            ),

          WINGSM_USER:
            Boolean(
              user
            ),

          WINGSM_PASSWORD:
            Boolean(
              password
            ),
        },
      },
      500
    );
  }

  // ====================================================
  // SONUÇ NESNESİ
  // ====================================================

  const result: any = {
    success: false,

    diagnostic:
      "WINGSM_B2B_SOURCE_TEST",

    depot,

    checks: {
      authenticate: {
        ok: false,
      },

      customer: {
        ok: false,
      },

      stock: {
        ok: false,
      },
    },
  };

  // ====================================================
  // 1) AUTHENTICATE
  // ====================================================

  let token:
    | string
    | null = null;

  try {
    const authStarted =
      Date.now();

    const authResponse =
      await fetch(
        `${baseUrl}/api/authenticate`,
        {
          method:
            "POST",

          cache:
            "no-store",

          headers: {
            Accept:
              "application/json",

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              user,
              password,
            }),

          signal:
            AbortSignal.timeout(
              15000
            ),
        }
      );

    const authRaw =
      await authResponse.text();

    const authPayload =
      parsePayload(
        authRaw
      );

    token =
      pickToken(
        authPayload
      );

    result.checks.authenticate =
      {
        ok:
          authResponse.ok &&
          Boolean(token),

        httpStatus:
          authResponse.status,

        responseTimeMs:
          Date.now() -
          authStarted,

        tokenReceived:
          Boolean(token),

        // TOKEN BURADA ASLA GÖSTERİLMEZ
        responsePreview:
          authResponse.ok &&
          token
            ? "Authenticate başarılı. Token güvenlik nedeniyle gizlendi."
            : safePreview(
                authPayload
              ),
      };

    if (
      !authResponse.ok ||
      !token
    ) {
      result.stage =
        "AUTH";

      result.message =
        "WingSM authenticate başarısız.";

      result.totalTimeMs =
        Date.now() -
        startedAt;

      return json(
        result,
        502
      );
    }
  } catch (
    error: any
  ) {
    result.checks.authenticate =
      {
        ok: false,

        message:
          error?.name ===
          "TimeoutError"
            ? "Authenticate 15 saniye içinde cevap vermedi."
            : error?.message ||
              "Authenticate bağlantı hatası.",
      };

    result.stage =
      "AUTH_NETWORK";

    result.message =
      result.checks
        .authenticate
        .message;

    result.totalTimeMs =
      Date.now() -
      startedAt;

    return json(
      result,
      502
    );
  }

  // ====================================================
  // ORTAK B2B TEST
  // ====================================================

  async function testEndpoint(
    url: string
  ) {
    const endpointStarted =
      Date.now();

    try {
      const response =
        await fetch(
          url,
          {
            method:
              "GET",

            cache:
              "no-store",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",

              "x-access-token":
                token!,
            },

            signal:
              AbortSignal.timeout(
                20000
              ),
          }
        );

      const raw =
        await response.text();

      const payload =
        parsePayload(
          raw
        );

      const sourceBlocked =
        detectSourceBlock(
          payload
        );

      const detectedSourceIp =
        extractSourceIp(
          payload
        );

      const payloadSuccess =
        typeof payload ===
          "object" &&
        payload !== null &&
        "success" in payload
          ? payload.success !==
            false
          : true;

      return {
        ok:
          response.ok &&
          payloadSuccess &&
          !sourceBlocked,

        httpStatus:
          response.status,

        responseTimeMs:
          Date.now() -
          endpointStarted,

        sourceBlocked,

        detectedSourceIp,

        responsePreview:
          safePreview(
            payload
          ),
      };
    } catch (
      error: any
    ) {
      return {
        ok: false,

        networkError:
          true,

        responseTimeMs:
          Date.now() -
          endpointStarted,

        message:
          error?.name ===
          "TimeoutError"
            ? "Endpoint 20 saniye içinde cevap vermedi."
            : error?.message ||
              "Bağlantı hatası.",
      };
    }
  }

  // ====================================================
  // 2) MÜŞTERİ B2B TESTİ
  // ====================================================

  result.checks.customer =
    await testEndpoint(
      `${baseUrl}/api/b2b/musteri/list`
    );

  // ====================================================
  // 3) STOK B2B TESTİ
  // ====================================================

  const stockUrl =
    new URL(
      `${baseUrl}/api/b2b/stok/list`
    );

  stockUrl.searchParams.set(
    "depo",
    depo
  );

  stockUrl.searchParams.set(
    "sinif",
    "2el"
  );

  stockUrl.searchParams.set(
    "stok",
    "1"
  );

  result.checks.stock =
    await testEndpoint(
      stockUrl.toString()
    );

  // ====================================================
  // SONUÇLARI OKU
  // ====================================================

  const authOk =
    Boolean(
      result.checks
        .authenticate
        .ok
    );

  const customerOk =
    Boolean(
      result.checks
        .customer
        .ok
    );

  const stockOk =
    Boolean(
      result.checks
        .stock
        .ok
    );

  const customerBlocked =
    Boolean(
      result.checks
        .customer
        .sourceBlocked
    );

  const stockBlocked =
    Boolean(
      result.checks
        .stock
        .sourceBlocked
    );

  // ====================================================
  // ANALİZ
  // ====================================================

  if (
    authOk &&
    customerOk &&
    stockOk
  ) {
    result.success =
      true;

    result.stage =
      "ALL_OK";

    result.message =
      "WingSM B2B bağlantısı tamamen başarılı. Authenticate, müşteri ve stok servisleri çalışıyor.";
  }

  else if (
    authOk &&
    customerBlocked &&
    stockBlocked
  ) {
    result.success =
      false;

    result.stage =
      "B2B_SOURCE_BLOCKED";

    result.message =
      "Authenticate başarılı ancak müşteri ve stok B2B servislerinin ikisi de source/IP kontrolünde reddediliyor.";
  }

  else if (
    authOk &&
    customerOk &&
    stockBlocked
  ) {
    result.success =
      false;

    result.stage =
      "STOCK_SOURCE_BLOCKED";

    result.message =
      "Müşteri B2B servisi çalışıyor ancak stok servisi source/IP kontrolünde reddediliyor. WingSM stok/depo yetkisi kontrol edilmeli.";
  }

  else if (
    authOk &&
    stockOk &&
    !customerOk
  ) {
    result.success =
      true;

    result.stage =
      "STOCK_OK_CUSTOMER_ERROR";

    result.message =
      "WingSM stok servisi başarılı. Müşteri servisi ayrı bir hata döndürüyor fakat stok entegrasyonu açısından source/IP engeli görünmüyor.";
  }

  else {
    result.success =
      false;

    result.stage =
      "MIXED_ERROR";

    result.message =
      "WingSM B2B servislerinde karışık sonuç alındı. checks alanları incelenmeli.";
  }

  // ====================================================
  // WINGSM'İN GÖRDÜĞÜ SOURCE IP
  // ====================================================

  result.detectedSourceIp =
    result.checks.stock
      ?.detectedSourceIp ||
    result.checks.customer
      ?.detectedSourceIp ||
    null;

  // ====================================================
  // KISA ÖZET
  // ====================================================

  result.summary = {
    authenticate:
      authOk
        ? "OK"
        : "ERROR",

    customer:
      customerOk
        ? "OK"
        : customerBlocked
        ? "SOURCE_BLOCKED"
        : "ERROR",

    stock:
      stockOk
        ? "OK"
        : stockBlocked
        ? "SOURCE_BLOCKED"
        : "ERROR",
  };

  result.totalTimeMs =
    Date.now() -
    startedAt;

  // Kaynak engeli varsa teşhis endpoint'i 502 döndürür.
  // Her şey başarılıysa 200 döndürür.

  return json(
    result,
    result.success
      ? 200
      : 502
  );
}
