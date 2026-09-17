// app/api/wingsm/personnel-source-test/route.ts
//
// CNETMOBIL - WingSM personel kaynagi TEST
//
// AMAC:
// - WingSM web ekraninda personel listesi:
//     GET /HttpApiHizliSatis/HizliSatisInitilas
//     response.settings.ListSatici
//   icinden geliyor.
//
// BU ROUTE SADECE TEST ICINDIR:
// - Mevcut app/lib/wingsm/server.ts icindeki wingSMRequest() kullanilir.
// - WingSM'e veri YAZILMAZ.
// - Sadece GET yapilir.
// - B2B token'in bu portal endpointinde kabul edilip edilmedigini test eder.
//
// TEST BASARILI OLURSA sonraki adim:
// - Liste PostgreSQL public.wingsm_personnel tablosuna UPSERT edilecek.
// - 15 dakikalik otomatik senkron kurulacak.

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

type WingSeller = {
  Id?: number | string;
  Kod?: string;
  Ad?: string;
  [key: string]: unknown;
};

type WingInitResponse = {
  success?: boolean;
  settings?: {
    ListSatici?: WingSeller[];
    [key: string]: unknown;
  };
  message?: string;
  error?: string;
  [key: string]: unknown;
};

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
      },
    }
  );
}

function wingDateNumber(
  date = new Date()
) {
  const year =
    String(
      date.getFullYear()
    );

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}${month}${day}`;
}

export async function GET(
  _request: NextRequest
) {
  const startedAt =
    Date.now();

  try {
    const tarihN =
      wingDateNumber();

    const payload =
      await wingSMRequest<WingInitResponse>(
        "/HttpApiHizliSatis/HizliSatisInitilas",
        {
          method:
            "GET",

          query: {
            TarihN:
              tarihN,

            // WingSM kendi kaynak kodunda
            // ilk acilista Sirket:null kullaniyor.
            // wingSMRequest null degeri query'ye eklemez.
            Sirket:
              null,
          },
        }
      );

    const rawList =
      payload?.settings
        ?.ListSatici;

    if (
      !Array.isArray(
        rawList
      )
    ) {
      return json(
        {
          success:
            false,

          stage:
            "LIST_SATICI_NOT_FOUND",

          message:
            "WingSM cevabi geldi ancak settings.ListSatici bulunamadi.",

          responseKeys:
            payload &&
            typeof payload ===
              "object"
              ? Object.keys(
                  payload
                )
              : [],

          settingsKeys:
            payload
              ?.settings &&
            typeof payload
              .settings ===
              "object"
              ? Object.keys(
                  payload
                    .settings
                )
              : [],

          responseTimeMs:
            Date.now() -
            startedAt,
        },
        502
      );
    }

    const personnel =
      rawList
        .map(
          (
            row
          ) => ({
            code:
              String(
                row?.Kod ??
                  ""
              ).trim(),

            name:
              String(
                row?.Ad ??
                  ""
              ).trim(),

            sourceId:
              row?.Id ??
              null,
          })
        )
        .filter(
          (
            row
          ) =>
            row.code &&
            row.name
        )
        .sort(
          (
            a,
            b
          ) =>
            a.name.localeCompare(
              b.name,
              "tr-TR"
            )
        );

    return json({
      success:
        true,

      source:
        "WingSM / HttpApiHizliSatis/HizliSatisInitilas / settings.ListSatici",

      tarihN,

      count:
        personnel.length,

      personnel,

      responseTimeMs:
        Date.now() -
        startedAt,
    });
  } catch (
    error
  ) {
    return json(
      {
        success:
          false,

        stage:
          "WINGSM_REQUEST",

        message:
          error instanceof
          Error
            ? error.message
            : String(
                error
              ),

        note:
          "Bu hata cikarsa B2B x-access-token, WingSM portal endpointinde kabul edilmiyor olabilir. Bu durumda portal oturum mekanizmasini ayri baglayacagiz.",

        responseTimeMs:
          Date.now() -
          startedAt,
      },
      502
    );
  }
}
