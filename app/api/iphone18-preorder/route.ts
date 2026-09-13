import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Model = "iPhone 18 Pro" | "iPhone 18 Pro Max" | "iPhone Duo";
type Storage = "256 GB" | "512 GB" | "1 TB" | "2 TB";
type PaymentType = "deposit" | "full";
type Action = "REQUEST_ONLY" | "PAYMENT_REPORTED";

const PRICES: Record<Model, Record<Storage, number>> = {
  "iPhone 18 Pro": { "256 GB": 137999, "512 GB": 154999, "1 TB": 188999, "2 TB": 243999 },
  "iPhone 18 Pro Max": { "256 GB": 149999, "512 GB": 166999, "1 TB": 200999, "2 TB": 255999 },
  "iPhone Duo": { "256 GB": 229999, "512 GB": 246999, "1 TB": 280999, "2 TB": 335999 },
};

const COLORS: Record<Model, string[]> = {
  "iPhone 18 Pro": ["Siyah", "Buzul Rengi", "Burgonya", "Gümüş Rengi"],
  "iPhone 18 Pro Max": ["Siyah", "Buzul Rengi", "Burgonya", "Gümüş Rengi"],
  "iPhone Duo": ["Gece Rengi", "Yıldız Rengi"],
};

const STORES = ["CMR / Çerkezköy", "Cadde / Çerkezköy", "Saray", "Kapaklı"];
const COMPANY_NAME = "CENNET ELEKTRONİK İLETİŞİM HİZMETLERİ SANAYİ VE TİCARET LİMİTED ŞİRKETİ";
const IBAN_DISPLAY = "TR03 0004 6005 6388 8000 2395 59";

function money(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function cleanText(value: unknown, max = 300) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(request: NextRequest) {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json({ success: false, error: "Telegram ayarları eksik." }, { status: 500 });
    }

    const body = await request.json();
    const action = cleanText(body?.action, 30) as Action;
    const model = cleanText(body?.model, 50) as Model;
    const storage = cleanText(body?.storage, 20) as Storage;
    const color = cleanText(body?.color, 50);
    const store = cleanText(body?.store, 80);
    const customerName = cleanText(body?.customerName, 100);
    const phone = cleanText(body?.phone, 30);
    const note = cleanText(body?.note, 500);

    if (action !== "REQUEST_ONLY" && action !== "PAYMENT_REPORTED") {
      return NextResponse.json({ success: false, error: "Geçersiz işlem." }, { status: 400 });
    }

    if (!Object.prototype.hasOwnProperty.call(PRICES, model)) {
      return NextResponse.json({ success: false, error: "Geçersiz model." }, { status: 400 });
    }

    if (!Object.prototype.hasOwnProperty.call(PRICES[model], storage)) {
      return NextResponse.json({ success: false, error: "Geçersiz kapasite." }, { status: 400 });
    }

    if (!COLORS[model].includes(color)) {
      return NextResponse.json({ success: false, error: "Geçersiz renk." }, { status: 400 });
    }

    if (!STORES.includes(store)) {
      return NextResponse.json({ success: false, error: "Geçersiz mağaza." }, { status: 400 });
    }

    if (customerName.length < 3) {
      return NextResponse.json({ success: false, error: "Ad soyad gerekli." }, { status: 400 });
    }

    if (phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json({ success: false, error: "Geçerli telefon numarası gerekli." }, { status: 400 });
    }

    const price = PRICES[model][storage];
    let message = "";
    let paymentAmount: number | null = null;
    let paymentType: PaymentType | null = null;

    if (action === "PAYMENT_REPORTED") {
      if (model === "iPhone Duo") {
        return NextResponse.json({ success: false, error: "iPhone Duo için ödeme bildirimi alınmıyor." }, { status: 400 });
      }

      paymentType = cleanText(body?.paymentType, 20) as PaymentType;
      if (paymentType !== "deposit" && paymentType !== "full") {
        return NextResponse.json({ success: false, error: "Geçersiz ödeme türü." }, { status: 400 });
      }

      paymentAmount = paymentType === "deposit" ? roundMoney(price * 0.1) : price;

      message = [
        "💳 CNETMOBİL - iPHONE 18 ÖDEME BİLDİRİMİ",
        "",
        `👤 Müşteri: ${customerName}`,
        `📞 Telefon: ${phone}`,
        "",
        `📱 Model: ${model}`,
        `💾 Kapasite: ${storage}`,
        `🎨 Renk: ${color}`,
        `🏪 Teslim Mağazası: ${store}`,
        "",
        `💰 Cihaz Fiyatı: ${money(price)}`,
        `💳 Ödeme Tipi: ${paymentType === "deposit" ? "%10 Kapora" : "Tam Ödeme"}`,
        `💵 Müşterinin Bildirdiği Ödeme: ${money(paymentAmount)}`,
        "",
        `🏦 Hesap Ünvanı: ${COMPANY_NAME}`,
        `🏦 IBAN: ${IBAN_DISPLAY}`,
        "",
        `📝 Not: ${note || "-"}`,
        "",
        "⚠️ Müşteri ödeme yaptığını bildirdi.",
        "BANKA HESABINDAN KONTROL EDİLMESİ GEREKİYOR.",
      ].join("\n");
    } else {
      message = [
        "📲 CNETMOBİL - iPHONE DUO TALEBİ",
        "",
        `👤 Müşteri: ${customerName}`,
        `📞 Telefon: ${phone}`,
        "",
        `📱 Model: ${model}`,
        `💾 Kapasite: ${storage}`,
        `🎨 Renk: ${color}`,
        `💰 Fiyat: ${money(price)}`,
        `🏪 Teslim Mağazası: ${store}`,
        "",
        `📝 Not: ${note || "-"}`,
        "",
        "✅ Müşteri talebi oluşturdu.",
      ].join("\n");
    }

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
      cache: "no-store",
    });

    const telegramData = await telegramResponse.json().catch(() => null);
    if (!telegramResponse.ok || !telegramData?.ok) {
      console.error("Telegram error:", telegramData);
      return NextResponse.json({ success: false, error: "Bildirim gönderilemedi." }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      action,
      price,
      paymentType,
      paymentAmount,
      message: action === "PAYMENT_REPORTED"
        ? "Ödeme bildiriminiz alındı. Banka hesabı kontrol edildikten sonra siparişiniz kesinleştirilecektir."
        : "Talebiniz başarıyla alındı.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("iphone18-preorder error:", error);
    return NextResponse.json({ success: false, error: "Sunucu hatası oluştu." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
