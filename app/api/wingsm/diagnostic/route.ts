import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type AuthPayload = {
  token?: string;
  accessToken?: string;
  access_token?: string;
  data?: any;
  message?: string;
  error?: string;
  success?: boolean;
};

function pickToken(
  payload: AuthPayload | null
): string | null {
  if (!payload) return null;

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

function safePreview(
  value: unknown,
  max = 1500
) {
  let text = "";

  try {
    text =
      typeof value === "string"
        ? value
        : JSON.stringify(
            value,
            null,
            2
          );
  } catch {
    text = String(
      value ?? ""
    );
  }

  if (text.length <= max) {
    return text;
  }

  return (
    text.slice(0, max) +
    "\n...TRUNCATED..."
  );
}

function parsePayload(
  raw: string
) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function detectSourceBlock(
  payload: unknown
) {
  const text =
    typeof payload === "string"
      ? payload
      : JSON.stringify(
          payload ?? {}
        );

  return /no valid source/i.test(
    text
  );
}

function extractSourceIp(
  payload: unknown
) {
  const text =
    typeof payload === "string"
      ? payload
      : JSON.stringify(
          payload ?? {}
        );

  const match =
    text.match(
      /Ip\s*:\s*([0-9.]+)/i
    );

  return match?.[1] || null;
}

function json(
  body: Record<string, unknown>,
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
      },
    }
  );
}

export async function GET(
  request: NextRequest
) {
  const startedAt =
    Date.now();

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

  const depo =
    String(
      request.nextUrl
        .searchParams
        .get("depo") ||
        "KAPAKLICMR"
    )
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
        message:
          "Geçersiz depo.",

        allowedDepots:
          Array.from(
            allowedDepots
          ),
      },
      400
    );
  }

  if (
    !baseUrl ||
    !user ||
    !password
  ) {
    return json(
      {
        success: false,

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

  const result: any = {
    success: false,

    diagnostic:
      "WINGSM_B2B_SOURCE_TEST",

    depot:
      depo,

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
  // 1. YENİ TOKEN AL
  // ====================================================

  let token:
    | string
    | null = null;

  try {
    const started =
      Date.now();

    const response =
      await fetch(
        `${baseUrl}/api/authenticate`,
        {
          method:
            "POST",

          cache:
            "no-store",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
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

    const raw =
      await response.text();

    const payload =
      parsePayload(raw);

    token =
      pickToken(
        payload as AuthPayload
      );

    result.checks.authenticate =
      {
        ok:
          response.ok &&
          Boolean(token),

        httpStatus:
          response.status,

        responseTimeMs:
          Date.now() -
          started,

        tokenReceived:
          Boolean(token),

        responsePreview:
          safePreview(
            payload
          ),
      };

    if (
      !response.ok ||
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
    result.stage =
      "AUTH_NETWORK";

    result.message =
      error?.message ||
      "Authenticate bağlantı hatası.";

    result.totalTimeMs =
      Date.now() -
      startedAt;

    return json(
      result,
      502
    );
  }

  // ====================================================
  // ORTAK B2B TEST FONKSİYONU
  // ====================================================

  async function testEndpoint(
    url: string
  ) {
    const started =
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
        parsePayload(raw);

      const sourceBlocked =
        detectSourceBlock(
          payload
        );

      return {
        ok:
          response.ok &&
          !sourceBlocked,

        httpStatus:
          response.status,

        responseTimeMs:
          Date.now() -
          started,

        sourceBlocked,

        detectedSourceIp:
          extractSourceIp(
            payload
          ),

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

        networkError: true,

        responseTimeMs:
          Date.now() -
          started,

        message:
          error?.message ||
          "Bağlantı hatası.",
      };
    }
  }

  // ====================================================
  // 2. AYNI TOKEN İLE MÜŞTERİ API
  // ====================================================

  result.checks.customer =
    await testEndpoint(
      `${baseUrl}/api/b2b/musteri/list`
    );

  // ====================================================
  // 3. AYNI TOKEN İLE STOK API
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
  // SONUÇ ANALİZİ
  // ====================================================

  const authOk =
    Boolean(
      result.checks
        .authenticate.ok
    );

  const customerOk =
    Boolean(
      result.checks
        .customer.ok
    );

  const stockOk =
    Boolean(
      result.checks
        .stock.ok
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
    result.stage =
      "B2B_SOURCE_BLOCKED";

    result.message =
      "Authenticate başarılı ancak müşteri ve stok B2B servislerinin ikisi de source/IP kontrolünde reddediliyor.";
  } else if (
    authOk &&
    customerOk &&
    stockBlocked
  ) {
    result.stage =
      "STOCK_SOURCE_BLOCKED";

    result.message =
      "Müşteri B2B servisi çalışıyor ancak stok servisi source/IP kontrolünde reddediliyor. Stok servisi veya depo yetkisi ayrıca kontrol edilmeli.";
  } else if (
    authOk &&
    stockOk
  ) {
    result.stage =
      "STOCK_OK_CUSTOMER_ERROR";

    result.message =
      "Stok servisi çalışıyor. Müşteri servisi farklı bir hata döndürüyor; WingSM stok entegrasyonu açısından source/IP engeli görünmüyor.";
  } else {
    result.stage =
      "MIXED_ERROR";

    result.message =
      "B2B servislerinde karışık sonuç alındı. checks alanındaki cevaplar incelenmeli.";
  }

  result.detectedSourceIp =
    result.checks.stock
      ?.detectedSourceIp ||
    result.checks.customer
      ?.detectedSourceIp ||
    null;

  result.totalTimeMs =
    Date.now() -
    startedAt;

  return json(
    result,
    result.success
      ? 200
      : 502
  );
}
