// app/api/wingsm/personnel-source-test/route.ts
//
// CNETMOBIL - WingSM CariKart PERSONEL endpoint testi
//
// DÜZELTME:
// Önceki çağrıda filter değeri "'*'" olarak gönderildi.
// WingSM SQL hatası:
//   Operand data type varchar is invalid for multiply operator.
//
// Bu hata, tek tırnakların da parametre değerine dahil edilmesiyle
// '*' ifadesinin SQL tarafında çarpma operatörü gibi yorumlandığını gösteriyor.
//
// Bu testte:
//   filter=*
// gönderilir.
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

function getBaseUrl() {
  const raw = String(
    process.env.WINGSM_BASE_URL || ""
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
  const url = new URL(
    `${getBaseUrl()}/api/b2b/carikart/list/P/20260917/20260917`
  );

  // ÖNEMLİ:
  // Tek tırnak YOK.
  // URL sonucu:
  // ?filter=*
  url.searchParams.set(
    "filter",
    "*"
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

function extractList(
  payload: unknown
): {
  path: string | null;
  list: unknown[];
} {
  if (Array.isArray(payload)) {
    return {
      path: "root",
      list: payload,
    };
  }

  const root =
    asObject(payload);

  if (!root) {
    return {
      path: null,
      list: [],
    };
  }

  const directCandidates = [
    ["data", root.data],
    ["Data", root.Data],
    ["list", root.list],
    ["List", root.List],
    ["items", root.items],
    ["Items", root.Items],
    ["rows", root.rows],
    ["Rows", root.Rows],
  ] as const;

  for (
    const [key, value]
    of directCandidates
  ) {
    if (Array.isArray(value)) {
      return {
        path: key,
        list: value,
      };
    }
  }

  const dataObj =
    asObject(
      root.data ??
        root.Data
    );

  if (dataObj) {
    const nestedCandidates = [
      ["data.List", dataObj.List],
      ["data.list", dataObj.list],
      ["data.Items", dataObj.Items],
      ["data.items", dataObj.items],
      ["data.Rows", dataObj.Rows],
      ["data.rows", dataObj.rows],
      ["data.Values", dataObj.Values],
      ["data.values", dataObj.values],
    ] as const;

    for (
      const [key, value]
      of nestedCandidates
    ) {
      if (Array.isArray(value)) {
        return {
          path: key,
          list: value,
        };
      }
    }
  }

  return {
    path: null,
    list: [],
  };
}

function safePreview(
  value: unknown
) {
  const row =
    asObject(value);

  if (!row) {
    return value;
  }

  const allowedKeys = [
    "Id",
    "ID",
    "id",
    "Kod",
    "KOD",
    "kod",
    "Code",
    "code",
    "Ad",
    "ADI",
    "adi",
    "Name",
    "name",
    "CariKod",
    "CariKodu",
    "CariAd",
    "CariAdi",
    "PersonelKod",
    "PersonelAd",
    "SaticiKod",
    "SaticiAd",
    "Sirket",
    "Sube",
    "GorevYeri",
    "Aktif",
    "Active",
    "Status",
    "Durum",
  ];

  const fields:
    Record<string, unknown> = {};

  for (const key of allowedKeys) {
    if (
      Object.prototype
        .hasOwnProperty.call(
          row,
          key
        )
    ) {
      fields[key] =
        row[key];
    }
  }

  return {
    keys:
      Object.keys(row),
    fields,
  };
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

    const wingSuccess =
      root?.success ??
      root?.Success ??
      null;

    if (
      wingSuccess === false
    ) {
      const errorData =
        asObject(
          root?.data ??
            root?.Data
        );

      return json({
        success: false,
        stage:
          "WINGSM_RETURNED_FALSE",
        request: {
          method: "GET",
          path:
            "/api/b2b/carikart/list/P/20260917/20260917",
          filter: "*",
        },
        httpStatus:
          response.status,
        wingError: errorData
          ? {
              Type:
                errorData.Type ??
                errorData.type ??
                null,
              Number:
                errorData.Number ??
                errorData.number ??
                null,
              Message:
                errorData.Message ??
                errorData.message ??
                null,
              Key:
                errorData.Key ??
                errorData.key ??
                null,
            }
          : null,
        responseTimeMs:
          Date.now() -
          startedAt,
      });
    }

    const found =
      extractList(payload);

    return json({
      success: true,
      stage:
        "WINGSM_CARIKART_FILTER_FIXED",
      request: {
        method: "GET",
        path:
          "/api/b2b/carikart/list/P/20260917/20260917",
        filter: "*",
      },
      wingSuccess,
      rootKeys:
        root
          ? Object.keys(root)
          : [],
      arrayPath:
        found.path,
      count:
        found.list.length,
      preview:
        found.list
          .slice(0, 5)
          .map(safePreview),
      responseTimeMs:
        Date.now() -
        startedAt,
    });
  } catch (error) {
    return json(
      {
        success: false,
        stage:
          "WINGSM_CARIKART_FILTER_FIXED",
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
