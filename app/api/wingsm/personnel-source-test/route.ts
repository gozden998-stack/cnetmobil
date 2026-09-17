// app/api/wingsm/personnel-source-test/route.ts
//
// CNETMOBIL - WingSM B2B personel/satici izin karşılaştırma testi
//
// Amaç:
// CariKart P endpointindeki 80 kayıt içinden,
// eski doğrulanmış HizliSatis/ListSatici 71 kaydını ayıran
// işaretin Izinler alanında olup olmadığını bulmak.
//
// SADECE GET.
// WingSM'e yazmaz.
// PostgreSQL'e yazmaz.
// TC / telefon / email / adres dönmez.

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

const OLD_71_CODES = new Set<string>([
  "0004",
  "0217",
  "0211",
  "0258",
  "0294",
  "0315",
  "0234",
  "0253",
  "0273",
  "0245",
  "0332",
  "0262",
  "0156",
  "0001",
  "0242",
  "0295",
  "0333",
  "0265",
  "0240",
  "0308",
  "0327",
  "0103",
  "0269",
  "0162",
  "0302",
  "0305",
  "0126",
  "0312",
  "0154",
  "0270",
  "0326",
  "0223",
  "0316",
  "0114",
  "0132",
  "0206",
  "0199",
  "0163",
  "0045",
  "0271",
  "0146",
  "0261",
  "0319",
  "0007",
  "0296",
  "0267",
  "0283",
  "0167",
  "0303",
  "0306",
  "0300",
  "0204",
  "0328",
  "0279",
  "0221",
  "0282",
  "0311",
  "0183",
  "0324",
  "0277",
  "0275",
  "0299",
  "0250",
  "0287",
  "0329",
  "0313",
  "0309",
  "0320",
  "0330",
  "0274",
  "0307"
]);

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

function cleanString(
  value: unknown
) {
  return String(
    value ?? ""
  ).trim();
}

function getBaseUrl() {
  const raw =
    cleanString(
      process.env.WINGSM_BASE_URL
    );

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

function safePermissionSummary(
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
      preview:
        value.slice(0, 20),
    };
  }

  const obj =
    asObject(value);

  if (obj) {
    return {
      type: "object",
      keys:
        Object.keys(obj),
      values:
        Object.fromEntries(
          Object.entries(obj)
            .slice(0, 30)
            .map(
              ([key, val]) => [
                key,
                typeof val === "string" ||
                typeof val === "number" ||
                typeof val === "boolean" ||
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
    type:
      typeof value,
  };
}

function safeRow(
  value: unknown
) {
  const row =
    asObject(value);

  if (!row) {
    return null;
  }

  const code =
    cleanString(row.Kod);

  const name =
    cleanString(row.Ad);

  if (!code || !name) {
    return null;
  }

  return {
    code,
    name,
    inOldSeller71:
      OLD_71_CODES.has(
        code
      ),
    tarihCikis:
      cleanString(
        row.TarihCikis
      ) || null,
    calistigiSube:
      cleanString(
        row.CalistigiSube
      ) || null,
    calistigiSubeAdi:
      cleanString(
        row.CalistigiSubeAdI
      ) || null,
    pozisyon:
      cleanString(
        row.Pozisyon
      ) || null,
    izinler:
      safePermissionSummary(
        row.Izinler
      ),
  };
}

function stableKey(
  value: unknown
) {
  try {
    return JSON.stringify(
      value
    );
  } catch {
    return String(value);
  }
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

    let payload: unknown;

    try {
      payload =
        raw
          ? JSON.parse(raw)
          : null;
    } catch {
      return json(
        {
          success: false,
          message:
            "WingSM JSON dönmedi.",
          httpStatus:
            response.status,
        },
        502
      );
    }

    const root =
      asObject(payload);

    if (
      root?.success !== true ||
      !Array.isArray(root.data)
    ) {
      return json(
        {
          success: false,
          message:
            "WingSM success:true + data array dönmedi.",
        },
        502
      );
    }

    const rows =
      root.data
        .map(safeRow)
        .filter(
          (
            row
          ): row is NonNullable<
            ReturnType<
              typeof safeRow
            >
          > =>
            Boolean(row)
        );

    const oldRows =
      rows.filter(
        (row) =>
          row.inOldSeller71
      );

    const extraRows =
      rows.filter(
        (row) =>
          !row.inOldSeller71
      );

    const permissionGroups =
      new Map<
        string,
        {
          izinler: unknown;
          oldCount: number;
          extraCount: number;
          oldExamples: string[];
          extraExamples: string[];
        }
      >();

    for (const row of rows) {
      const key =
        stableKey(
          row.izinler
        );

      const group =
        permissionGroups.get(
          key
        ) || {
          izinler:
            row.izinler,
          oldCount: 0,
          extraCount: 0,
          oldExamples: [],
          extraExamples: [],
        };

      if (
        row.inOldSeller71
      ) {
        group.oldCount += 1;

        if (
          group.oldExamples
            .length < 5
        ) {
          group.oldExamples
            .push(
              `${row.code} - ${row.name}`
            );
        }
      } else {
        group.extraCount += 1;

        if (
          group.extraExamples
            .length < 10
        ) {
          group.extraExamples
            .push(
              `${row.code} - ${row.name}`
            );
        }
      }

      permissionGroups.set(
        key,
        group
      );
    }

    return json({
      success: true,

      stage:
        "WINGSM_PERSONNEL_IZIN_COMPARE",

      counts: {
        oldSeller71:
          oldRows.length,
        extra:
          extraRows.length,
        total:
          rows.length,
        permissionPatternCount:
          permissionGroups.size,
      },

      permissionGroups:
        Array.from(
          permissionGroups.values()
        )
          .sort(
            (a, b) =>
              b.extraCount -
              a.extraCount ||
              b.oldCount -
              a.oldCount
          ),

      extraRows,

      note:
        "Amaç, CariKart P listesinden gerçek HizliSatis satıcılarını ayıran izin/rol işaretini bulmaktır.",

      responseTimeMs:
        Date.now() -
        startedAt,
    });
  } catch (error) {
    return json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : String(error),
        responseTimeMs:
          Date.now() -
          startedAt,
      },
      500
    );
  }
}
