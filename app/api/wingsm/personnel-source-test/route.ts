// app/api/wingsm/personnel-source-test/route.ts
//
// CNETMOBIL - WingSM B2B CariKart PERSONEL endpoint TEST
//
// WingSM tarafından verilen endpoint:
// b2b/carikart/list/P/20260917/20260917?filter='*'
//
// Mevcut WingSM B2B servisinde çalışan diğer route'lar
// /api/b2b/... altında olduğu için burada /api prefix'i kullanılır.
//
// SADECE GET.
// WingSM'e hiçbir veri yazılmaz.

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  wingSMRequest,
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
    return value as Record<
      string,
      unknown
    >;
  }

  return null;
}

function findArray(
  payload: unknown
): {
  path: string;
  list: unknown[];
} | null {
  if (Array.isArray(payload)) {
    return {
      path: "root",
      list: payload,
    };
  }

  const root = asObject(payload);

  if (!root) {
    return null;
  }

  const directKeys = [
    "data",
    "Data",
    "list",
    "List",
    "items",
    "Items",
    "rows",
    "Rows",
    "result",
    "Result",
  ];

  for (const key of directKeys) {
    if (Array.isArray(root[key])) {
      return {
        path: key,
        list: root[key] as unknown[],
      };
    }
  }

  for (
    const [parentKey, parentValue]
    of Object.entries(root)
  ) {
    const parent =
      asObject(parentValue);

    if (!parent) continue;

    for (const key of directKeys) {
      if (Array.isArray(parent[key])) {
        return {
          path:
            `${parentKey}.${key}`,
          list:
            parent[key] as unknown[],
        };
      }
    }
  }

  return null;
}

function previewRow(
  value: unknown
) {
  const row =
    asObject(value);

  if (!row) {
    return {
      type:
        Array.isArray(value)
          ? "array"
          : typeof value,
    };
  }

  const wantedKeys = [
    "Id",
    "ID",
    "id",
    "Kod",
    "KOD",
    "kod",
    "Code",
    "code",
    "CariKod",
    "CariKodu",
    "PersonelKod",
    "SaticiKod",
    "Ad",
    "ADI",
    "adi",
    "Name",
    "name",
    "CariAd",
    "CariAdi",
    "PersonelAd",
    "SaticiAd",
    "Sirket",
    "Sube",
    "GorevYeri",
    "Aktif",
    "Active",
    "Status",
    "Durum",
    "IseGirisTarih",
    "IstenCikisTarih",
  ];

  const preview:
    Record<string, unknown> = {};

  for (const key of wantedKeys) {
    if (
      Object.prototype
        .hasOwnProperty.call(
          row,
          key
        )
    ) {
      preview[key] =
        row[key];
    }
  }

  return {
    keys:
      Object.keys(row),
    fields:
      preview,
  };
}

export async function GET(
  _request: NextRequest
) {
  const startedAt =
    Date.now();

  // DÜZELTME:
  // İlk testte /b2b/... kullanılmıştı.
  // Mevcut çalışan WingSM B2B route yapısına göre /api/b2b/... olmalı.
  const path =
    "/api/b2b/carikart/list/P/20260917/20260917";

  try {
    const payload =
      await wingSMRequest<unknown>(
        path,
        {
          method: "GET",
          query: {
            filter: "'*'",
          },
        }
      );

    const found =
      findArray(payload);

    const root =
      asObject(payload);

    return json({
      success: true,

      stage:
        "WINGSM_CARIKART_PERSONNEL_TEST",

      request: {
        method: "GET",
        path,
        filter:
          "'*'",
      },

      response: {
        rootType:
          Array.isArray(payload)
            ? "array"
            : typeof payload,

        rootKeys:
          root
            ? Object.keys(root)
            : [],

        arrayPath:
          found?.path ||
          null,

        count:
          found?.list.length ??
          null,

        preview:
          found
            ? found.list
                .slice(0, 5)
                .map(previewRow)
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
          "WINGSM_CARIKART_PERSONNEL_TEST",

        request: {
          method: "GET",
          path,
          filter:
            "'*'",
        },

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
