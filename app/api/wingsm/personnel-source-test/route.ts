// app/api/wingsm/personnel-source-test/route.ts
//
// CNETMOBIL - WingSM PERSONEL KARŞILAŞTIRMA TESTİ
//
// Amaç:
// - Eski ve doğrulanmış 71 kişilik HizliSatis/ListSatici kümesi ile
// - yeni B2B CariKart P endpointindeki canlı listeyi karşılaştırmak.
//
// Bu route SADECE GET yapar.
// WingSM'e hiçbir veri yazmaz.
// PostgreSQL'e hiçbir veri yazmaz.
//
// Özellikle şu alanlara bakıyoruz:
// - TarihCikis
// - CalistigiSube / CalistigiSubeAdI
// - Pozisyon
//
// Böylece B2B endpointindeki fazladan kayıtların
// eski/çıkış yapmış personel mi, yoksa başka bir cari kart türü mü
// olduğunu netleştireceğiz.

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
  const url =
    new URL(
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

function safePersonnel(
  value: unknown
) {
  const row =
    asObject(value);

  if (!row) {
    return null;
  }

  const code =
    cleanString(
      row.Kod ??
        row.kod ??
        row.Code ??
        row.code
    );

  const name =
    cleanString(
      row.Ad ??
        row.ad ??
        row.Name ??
        row.name
    );

  if (
    !code ||
    !name
  ) {
    return null;
  }

  return {
    code,
    name,
    tarihGiris:
      cleanString(
        row.TarihGiris
      ) || null,
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
    sirket:
      cleanString(
        row.Sirket
      ) || null,
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
      return json(
        {
          success: false,
          stage:
            "JSON_PARSE",
          httpStatus:
            response.status,
          message:
            "WingSM JSON dönmedi.",
        },
        502
      );
    }

    const root =
      asObject(payload);

    if (
      root?.success !== true ||
      !Array.isArray(
        root?.data
      )
    ) {
      return json(
        {
          success: false,
          stage:
            "WINGSM_RESPONSE",
          httpStatus:
            response.status,
          wingSuccess:
            root?.success ??
            null,
          rootKeys:
            root
              ? Object.keys(root)
              : [],
        },
        502
      );
    }

    const live =
      root.data
        .map(
          safePersonnel
        )
        .filter(
          (
            row
          ): row is NonNullable<
            ReturnType<
              typeof safePersonnel
            >
          > =>
            Boolean(row)
        );

    const liveCodeSet =
      new Set(
        live.map(
          (row) =>
            row.code
        )
      );

    const extraVsOld71 =
      live
        .filter(
          (row) =>
            !OLD_71_CODES
              .has(
                row.code
              )
        )
        .sort(
          (a, b) =>
            a.name.localeCompare(
              b.name,
              "tr-TR"
            )
        );

    const missingFromLive =
      Array.from(
        OLD_71_CODES
      )
        .filter(
          (code) =>
            !liveCodeSet
              .has(code)
        )
        .sort();

    const tarihCikisGroups =
      new Map<
        string,
        number
      >();

    for (const row of live) {
      const key =
        row.tarihCikis ||
        "(BOŞ)";

      tarihCikisGroups.set(
        key,
        (
          tarihCikisGroups
            .get(key) ||
          0
        ) + 1
      );
    }

    const extrasWithExitDate =
      extraVsOld71.filter(
        (row) =>
          Boolean(
            row.tarihCikis
          )
      );

    const extrasWithoutExitDate =
      extraVsOld71.filter(
        (row) =>
          !row.tarihCikis
      );

    return json({
      success: true,

      stage:
        "WINGSM_PERSONNEL_COMPARE_71_VS_LIVE",

      counts: {
        oldVerified:
          OLD_71_CODES.size,
        live:
          live.length,
        extraVsOld71:
          extraVsOld71.length,
        missingFromLive:
          missingFromLive.length,
        liveWithExitDate:
          live.filter(
            (row) =>
              Boolean(
                row.tarihCikis
              )
          ).length,
        liveWithoutExitDate:
          live.filter(
            (row) =>
              !row.tarihCikis
          ).length,
        extrasWithExitDate:
          extrasWithExitDate.length,
        extrasWithoutExitDate:
          extrasWithoutExitDate.length,
      },

      tarihCikisValues:
        Array.from(
          tarihCikisGroups
            .entries()
        )
          .map(
            ([
              value,
              count,
            ]) => ({
              value,
              count,
            })
          )
          .sort(
            (a, b) =>
              b.count -
              a.count
          ),

      extraVsOld71,

      missingOld71Codes:
        missingFromLive,

      note:
        "Bu test yalnızca Kod/Ad ve personel durumunu anlamak için gerekli iş alanlarını gösterir; TC, telefon, e-posta ve adres alanları döndürülmez.",

      responseTimeMs:
        Date.now() -
        startedAt,
    });
  } catch (error) {
    return json(
      {
        success: false,
        stage:
          "COMPARE",
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
