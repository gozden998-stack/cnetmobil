// app/api/wingsm/personnel-source-test/route.ts
//
// CNETMOBIL - WingSM CariKart PERSONEL RAW DIAGNOSTIC
//
// Amaç:
// /api/b2b/carikart/list/P/20260917/20260917?filter='*'
// endpointi HTTP olarak çalışıyor ama success:false dönüyor.
// Bu route wingSMRequest içindeki generic hata dönüşünü BYPASS eder,
// gerçek WingSM cevap yapısındaki hata/message alanlarını güvenli biçimde gösterir.
//
// SADECE GET.
// WingSM'e hiçbir veri yazılmaz.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  clearWingSMToken,
  getWingSMToken,
} from "@/app/lib/wingsm/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "no-store, max-age=0",
    },
  });
}

function asObject(
  value: unknown
): Record<string, unknown> | null {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return null;
}

function safeErrorValue(
  value: unknown
): unknown {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 10)
      .map((item) => {
        if (
          typeof item === "string" ||
          typeof item === "number" ||
          typeof item === "boolean"
        ) {
          return item;
        }

        const row = asObject(item);

        if (!row) {
          return typeof item;
        }

        return {
          message:
            row.message ??
            row.Message ??
            null,
          error:
            row.error ??
            row.Error ??
            null,
          code:
            row.code ??
            row.Code ??
            null,
          description:
            row.description ??
            row.Description ??
            null,
        };
      });
  }

  const obj = asObject(value);

  if (!obj) {
    return typeof value;
  }

  return {
    message:
      obj.message ??
      obj.Message ??
      null,
    error:
      obj.error ??
      obj.Error ??
      null,
    code:
      obj.code ??
      obj.Code ??
      null,
    description:
      obj.description ??
      obj.Description ??
      null,
  };
}

function inspectData(
  data: unknown
) {
  if (Array.isArray(data)) {
    const first =
      asObject(data[0]);

    return {
      type: "array",
      count: data.length,
      firstRowKeys:
        first
          ? Object.keys(first)
          : [],
    };
  }

  const obj =
    asObject(data);

  if (obj) {
    return {
      type: "object",
      keys:
        Object.keys(obj),
    };
  }

  return {
    type:
      data === null
        ? "null"
        : typeof data,
  };
}

function getBaseUrl() {
  const raw = String(
    process.env.WINGSM_BASE_URL ||
      ""
  ).trim();

  if (!raw) {
    throw new Error(
      "WINGSM_BASE_URL bulunamadı."
    );
  }

  return raw.replace(/\/+$/, "");
}

async function makeRequest(
  token: string
) {
  const baseUrl =
    getBaseUrl();

  const url =
    new URL(
      `${baseUrl}/api/b2b/carikart/list/P/20260917/20260917`
    );

  // WingSM desteğinin verdiği ifade:
  // ?filter='*'
  url.searchParams.set(
    "filter",
    "'*'"
  );

  return fetch(
    url.toString(),
    {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept:
          "application/json",
        "Content-Type":
          "application/json",
        "x-access-token":
          token,
      },
      signal:
        AbortSignal.timeout(
          20000
        ),
    }
  );
}

export async function GET(
  _request: NextRequest
) {
  const startedAt =
    Date.now();

  try {
    let token =
      await getWingSMToken();

    let response =
      await makeRequest(token);

    if (
      response.status === 401 ||
      response.status === 403
    ) {
      clearWingSMToken();

      token =
        await getWingSMToken(
          true
        );

      response =
        await makeRequest(
          token
        );
    }

    const raw =
      await response.text();

    let payload: unknown =
      null;

    try {
      payload =
        raw
          ? JSON.parse(raw)
          : null;
    } catch {
      return json({
        success: false,
        stage:
          "WINGSM_RAW_RESPONSE",
        httpStatus:
          response.status,
        httpOk:
          response.ok,
        contentType:
          response.headers.get(
            "content-type"
          ),
        rawPreview:
          raw.slice(0, 500),
        note:
          "WingSM JSON dönmedi.",
        responseTimeMs:
          Date.now() -
          startedAt,
      });
    }

    const root =
      asObject(payload);

    const data =
      root?.data ??
      root?.Data ??
      root?.list ??
      root?.List ??
      null;

    return json({
      success: true,

      stage:
        "WINGSM_RAW_DIAGNOSTIC",

      request: {
        method: "GET",
        path:
          "/api/b2b/carikart/list/P/20260917/20260917",
        filter:
          "'*'",
      },

      wingResponse: {
        httpStatus:
          response.status,
        httpOk:
          response.ok,

        success:
          root?.success ??
          root?.Success ??
          null,

        message:
          safeErrorValue(
            root?.message ??
            root?.Message
          ),

        error:
          safeErrorValue(
            root?.error ??
            root?.Error
          ),

        errors:
          safeErrorValue(
            root?.errors ??
            root?.Errors
          ),

        code:
          root?.code ??
          root?.Code ??
          null,

        rootKeys:
          root
            ? Object.keys(root)
            : [],

        data:
          inspectData(data),
      },

      responseTimeMs:
        Date.now() -
        startedAt,
    });
  } catch (error) {
    return json(
      {
        success: false,
        stage:
          "WINGSM_RAW_DIAGNOSTIC",

        message:
          error instanceof Error
            ? error.message
            : String(error),

        responseTimeMs:
          Date.now() -
          startedAt,
      },
      502
    );
  }
}
