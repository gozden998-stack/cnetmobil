import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Model =
  | "iPhone 18 Pro"
  | "iPhone 18 Pro Max"
  | "iPhone Duo";

type Storage =
  | "256 GB"
  | "512 GB"
  | "1 TB"
  | "2 TB";

const PRICE_MAP: Record<
  Model,
  Record<Storage, number>
> = {
  "iPhone 18 Pro": {
    "256 GB": 137999,
    "512 GB": 154999,
    "1 TB": 188999,
    "2 TB": 243999,
  },

  "iPhone 18 Pro Max": {
    "256 GB": 149999,
    "512 GB": 166999,
    "1 TB": 200999,
    "2 TB": 255999,
  },

  "iPhone Duo": {
    "256 GB": 229999,
    "512 GB": 246999,
    "1 TB": 280999,
    "2 TB": 335999,
  },
};

const COLOR_MAP: Record<Model, string[]> = {
  "iPhone 18 Pro": [
    "Siyah",
    "Buzul Rengi",
    "Burgonya",
    "Gümüş Rengi",
  ],

  "iPhone 18 Pro Max": [
    "Siyah",
    "Buzul Rengi",
    "Burgonya",
    "Gümüş Rengi",
  ],

  "iPhone Duo": [
    "Gece Rengi",
    "Yıldız Rengi",
  ],
};

const STORES = new Set([
  "CMR / Çerkezköy",
  "Cadde / Çerkezköy",
  "Saray",
  "Kapaklı",
]);

// 16 Ekim 2026 15:00 Türkiye
const DUO_PREORDER_START = Date.UTC(
  2026,
  9,
  16,
  12,
  0,
  0
);

function clean(
  value: unknown,
  max = 300
) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function money(value: number) {
  return new Intl.NumberFormat(
    "tr-TR",
    {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }
  ).format(value);
}

export async function POST(
  request: NextRequest
) {
  try {
    const token =
      process.env.TELEGRAM_BOT_TOKEN;

    const chatId =
      process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Telegram ayarları eksik.",
        },
        {
          status: 500,
        }
      );
    }

    const body = await request
      .json()
      .catch(() => null);

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Geçersiz istek.",
        },
        {
          status: 400,
        }
      );
    }

    const model = clean(
      (body as any).model,
      50
    ) as Model;

    const storage = clean(
      (body as any).storage,
      20
    ) as Storage;

    const color = clean(
      (body as any).color,
      50
    );

    const store = clean(
      (body as any).store,
      80
    );

    const customerName = clean(
      (body as any).customerName,
      160
    );

    const phone = clean(
      (body as any).phone,
      30
    );

    const note = clean(
      (body as any).note,
      500
    );

    if (!PRICE_MAP[model]) {
      return NextResponse.json(
        {
          success: false,
          error: "Model geçersiz.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !PRICE_MAP[model][storage]
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Kapasite geçersiz.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !COLOR_MAP[model].includes(
        color
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Renk geçersiz.",
        },
        {
          status: 400,
        }
      );
    }

    if (!STORES.has(store)) {
      return NextResponse.json(
        {
          success: false,
          error: "Mağaza geçersiz.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      customerName.length < 3
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Ad soyad gerekli.",
        },
        {
          status: 400,
        }
      );
    }

    const phoneDigits =
      phone.replace(/\D/g, "");

    if (
      phoneDigits.length < 10
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Telefon numarası geçersiz.",
        },
        {
          status: 400,
        }
      );
    }

    const price =
      PRICE_MAP[model][storage];

    const requestType =
      model === "iPhone Duo" &&
      Date.now() <
        DUO_PREORDER_START
        ? "ÖN TALEP"
        : "ÖN SİPARİŞ";

    const message = [
      `🍎 CNETMOBİL - iPHONE 18 ${requestType}`,
      ``,

      `📱 Model: ${model}`,
      `💾 Kapasite: ${storage}`,
      `🎨 Renk: ${color}`,
      `💰 Fiyat: ${money(price)}`,
      `🏪 Teslim Mağazası: ${store}`,

      ``,

      `👤 Müşteri: ${customerName}`,
      `📞 Telefon: ${phone}`,

      note
        ? `📝 Not: ${note}`
        : "",

      ``,

      requestType === "ÖN TALEP"
        ? "ℹ️ iPhone Duo ön talebi oluşturuldu."
        : "✅ Ön sipariş talebi oluşturuldu.",
    ]
      .filter(Boolean)
      .join("\n");

    const telegramResponse =
      await fetch(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            chat_id: chatId,
            text: message,
          }),
        }
      );

    const telegramData =
      await telegramResponse
        .json()
        .catch(() => null);

    if (
      !telegramResponse.ok ||
      !telegramData?.ok
    ) {
      console.error(
        "[IPHONE18 TELEGRAM]",
        telegramData
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Telegram bildirimi gönderilemedi.",
        },
        {
          status: 502,
        }
      );
    }

    return NextResponse.json({
      success: true,

      requestType,

      price,

      message:
        requestType ===
        "ÖN TALEP"
          ? "Ön talebiniz alındı. CNETMOBİL ekibi sizinle iletişime geçecek."
          : "Ön sipariş talebiniz alındı. CNETMOBİL ekibi sizinle iletişime geçecek.",
    });
  } catch (error) {
    console.error(
      "[IPHONE18 PREORDER]",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "İşlem başarısız.",
      },
      {
        status: 500,
      }
    );
  }
}
