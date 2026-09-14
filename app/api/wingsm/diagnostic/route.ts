// app/api/wingsm/diagnostic/route.ts
// CNETMOBIL - WingSM B2B kesin teşhis testi
//
// TEST:
// 1) Authenticate
// 2) B2B müşteri servisi
// 3) B2B stok servisi
//
// Güvenlik:
// - Token response'a yazılmaz.
// - Şifre response'a yazılmaz.
// - Sadece teşhis amaçlıdır.
// - WingSM'de veri değiştirmez.

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
  success?: boolean;
  token?: string;
  accessToken?: string;
  access_token?: string;
  data?: any;
  message?: string;
  error?: string;
};

type EndpointCheck = {
  ok: boolean;
  httpStatus?: number;
  responseTimeMs?: number;
  sourceBlocked?: boolean;
  detectedSourceIp?: string | null;
  networkError?: boolean;
  message?: string;
  responsePreview?: string;
};

// ======================================================
// JSON RESPONSE
// ======================================================

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

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

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return null;
}

// ======================================================
// RAW -> JSON
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
// HASSAS ALANLARI GİZLE
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

  if (Array.isArray(value)) {
    return value.map(
      sanitizeValue
    );
  }

  if (
    typeof value === "object"
  ) {
    const cleaned: Record<
      string,
      any
    > = {};

    for (
      const [key, itemValue] of
      Object.entries(value)
    ) {
      const normalized =
        key
          .toLowerCase()
          .replace(
            /[_-]/g,
            ""
          );

      if (
        normalized === "token" ||
        normalized ===
          "accesstoken" ||
        normalized ===
          "password" ||
        normalized === "secret"
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

// ======================================================
// GÜVENLİ RESPONSE PREVIEW
// ======================================================

function safePreview(
  value: unknown,
  max = 2000
) {
  try {
    const cleaned =
      sanitizeValue(value);

    const text =
      typeof cleaned === "string"
        ? cleaned
        : JSON.stringify(
            cleaned,
            null,
            2
          );

    if (
      text.length <= max
    ) {
      return text;
    }

    return (
      text.slice(0, max) +
      "\n...TRUNCATED..."
    );
  } catch {
    return "Cevap görüntülenemedi.";
  }
}

// ======================================================
// NO VALID SOURCE KONTROLÜ
// ======================================================

function detectSourceBlock(
  payload: unknown
) {
  let text = "";

  try {
    text =
      typeof payload === "string"
        ? payload
        : JSON.stringify(
            payload ?? {}
          );
  } catch {
    return false;
  }

  return /no valid source/i.test(
    text
  );
}

// ======================================================
// WINGSM'İN GÖRDÜĞÜ IP
// ======================================================

function extractSourceIp(
  payload: unknown
): string | null {
  let text = "";

  try {
    text =
      typeof payload === "string"
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

  return match?.[1] || null;
}

// ======================================================
// PAYLOAD SUCCESS
// ======================================================

function payloadSucceeded(
  payload: any
) {
  if (
    payload &&
    typeof payload === "object" &&
    "success" in payload
  ) {
    return (
      payload.success !== false
    );
  }

  return true;
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
      .replace(/\/+$/, "");

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
    !allowedDepots.has(depo)
  ) {
    return json(
      {
        success: false,
        diagnostic:
          "WINGSM_B2B_SOURCE_TEST",
        stage: "INPUT",
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
        stage: "CONFIG",
        message:
          "WingSM environment ayarları eksik.",
        env: {
          WINGSM_BASE_URL:
            Boolean(baseUrl),
          WINGSM_USER:
            Boolean(user),
          WINGSM_PASSWORD:
            Boolean(password),
        },
      },
      500
    );
  }

  // ====================================================
  // SONUÇ
  // ====================================================

  const result: {
    success: boolean;
    diagnostic: string;
    depot: string;
    checks: {
      authenticate:
        EndpointCheck;
      customer:
        EndpointCheck;
      stock:
        EndpointCheck;
    };
    stage?: string;
    message?: string;
    detectedSourceIp?:
      string | null;
    summary?: {
      authenticate: string;
      customer: string;
      stock: string;
    };
    totalTimeMs?: number;
  } = {
    success: false,

    diagnostic:
      "WINGSM_B2B_SOURCE_TEST",

    // BURASI ÖNCEKİ BUILD HATASININ
    // DÜZELTİLDİĞİ YER:
    depot: depo,

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
    string | null = null;

  try {
    const authStarted =
      Date.now();

    const authResponse =
      await fetch(
        `${baseUrl}/api/authenticate`,
        {
          method: "POST",

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
      ) as AuthPayload | null;

    token =
      pickToken(
        authPayload
      );

    const authPayloadOk =
      payloadSucceeded(
        authPayload
      );

    result.checks.authenticate =
      {
        ok:
          authResponse.ok &&
          authPayloadOk &&
          Boolean(token),

        httpStatus:
          authResponse.status,

        responseTimeMs:
          Date.now() -
          authStarted,

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
      !authPayloadOk ||
      !token
    ) {
      result.stage =
        "AUTH_FAILED";

      result.message =
        "WingSM authenticate işlemi başarısız.";

      result.totalTimeMs =
        Date.now() -
        startedAt;

      return json(
        result as unknown as Record<
          string,
          unknown
        >,
        502
      );
    }
  } catch (
    error: any
  ) {
    result.checks.authenticate =
      {
        ok: false,

        networkError:
          true,

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
      result as unknown as Record<
        string,
        unknown
      >,
      502
    );
  }

  // ====================================================
  // ORTAK B2B ENDPOINT TESTİ
  // ====================================================

  async function testEndpoint(
    url: string
  ): Promise<EndpointCheck> {
    const endpointStarted =
      Date.now();

    try {
      const response =
        await fetch(
          url,
          {
            method: "GET",

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
        parsePayload(raw);

      const sourceBlocked =
        detectSourceBlock(
          payload
        );

      const sourceIp =
        extractSourceIp(
          payload
        );

      const appSuccess =
        payloadSucceeded(
          payload
        );

      return {
        ok:
          response.ok &&
          appSuccess &&
          !sourceBlocked,

        httpStatus:
          response.status,

        responseTimeMs:
          Date.now() -
          endpointStarted,

        sourceBlocked,

        detectedSourceIp:
          sourceIp,

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
              "WingSM endpoint bağlantı hatası.",
      };
    }
  }

  // ====================================================
  // 2) MÜŞTERİ TESTİ
  // ====================================================

  result.checks.customer =
    await testEndpoint(
      `${baseUrl}/api/b2b/musteri/list`
    );

  // ====================================================
  // 3) STOK TESTİ
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
    result.checks
      .authenticate.ok;

  const customerOk =
    result.checks
      .customer.ok;

  const stockOk =
    result.checks
      .stock.ok;

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
  } else if (
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
  } else if (
    authOk &&
    customerOk &&
    stockBlocked
  ) {
    result.success =
      false;

    result.stage =
      "STOCK_SOURCE_BLOCKED";

    result.message =
      "Müşteri B2B servisi başarılı ancak stok B2B servisi source/IP kontrolünde reddediliyor.";
  } else if (
    authOk &&
    stockOk &&
    !customerOk
  ) {
    result.success =
      true;

    result.stage =
      "STOCK_OK_CUSTOMER_ERROR";

    result.message =
      "WingSM stok servisi çalışıyor. Müşteri servisinde ayrı bir hata bulunuyor.";
  } else {
    result.success =
      false;

    result.stage =
      "MIXED_ERROR";

    result.message =
      "WingSM B2B servislerinde karışık sonuç alındı. checks alanları incelenmeli.";
  }

  // ====================================================
  // WINGSM'İN GÖRDÜĞÜ IP
  // ====================================================

  result.detectedSourceIp =
    result.checks.stock
      .detectedSourceIp ||
    result.checks.customer
      .detectedSourceIp ||
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

  return json(
    result as unknown as Record<
      string,
      unknown
    >,
    result.success
      ? 200
      : 502
  );
}
