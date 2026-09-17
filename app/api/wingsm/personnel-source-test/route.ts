// app/api/wingsm/personnel-source-test/route.ts
//
// CNETMOBIL - WingSM CariKart PERSONEL hata detay testi
//
// Amaç:
// WingSM cevabı HTTP 200 + success:false dönüyor.
// Hata detayı response.data içinde:
// Type / Number / Message / Key / Values
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

function safeValues(
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
    return {
      type: "array",
      count: value.length,
      preview: value
        .slice(0, 10)
        .map((item) => {
          if (
            typeof item === "string" ||
            typeof item === "number" ||
            typeof item === "boolean"
          ) {
            return item;
          }

          const obj =
            asObject(item);

          if (!obj) {
            return typeof item;
          }

          return {
            keys:
              Object.keys(obj),
            message:
              obj.Message ??
              obj.message ??
              null,
            key:
              obj.Key ??
              obj.key ??
              null,
            value:
              obj.Value ??
              obj.value ??
              null,
          };
        }),
    };
  }

  const obj =
    asObject(value);

  if (obj) {
    return {
      type: "object",
      keys:
        Object.keys(obj),
      preview:
        Object.fromEntries(
          Object.entries(obj)
            .slice(0, 15)
            .map(
              ([key, val]) => [
                key,
                typeof val ===
                    "string" ||
                  typeof val ===
                    "number" ||
                  typeof val ===
                    "boolean" ||
                  val === null
                  ? val
                  : Array.isArray(val)
                  ? `[array:${val.length}]`
                  : "[object]",
              ]
            )
        ),
    };
  }

  return {
    type: typeof value,
  };
}

function getBaseUrl() {
  const raw =
    String(
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
  const url =
    new URL(
      `${getBaseUrl()}/api/b2b/carikart/list/P/20260917/20260917`
    );

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
      await makeRequest(
        token
      );

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
          "WINGSM_JSON_PARSE",
        httpStatus:
          response.status,
        rawPreview:
          raw.slice(0, 500),
        responseTimeMs:
          Date.now() -
          startedAt,
      });
    }

    const root =
      asObject(payload);

    const data =
      asObject(
        root?.data ??
          root?.Data
      );

    return json({
      success: true,

      stage:
        "WINGSM_CARIKART_ERROR_DETAIL",

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

        data: data
          ? {
              Type:
                data.Type ??
                data.type ??
                null,

              Number:
                data.Number ??
                data.number ??
                null,

              Message:
                data.Message ??
                data.message ??
                null,

              Key:
                data.Key ??
                data.key ??
                null,

              Values:
                safeValues(
                  data.Values ??
                    data.values
                ),
            }
          : null,

        rootKeys:
          root
            ? Object.keys(root)
            : [],
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
          "WINGSM_CARIKART_ERROR_DETAIL",
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
