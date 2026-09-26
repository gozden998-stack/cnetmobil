// app/lib/dealer/paratika.ts
//
// Bayi siparişleri için KENDİ, İZOLE Paratika ödeme linki oluşturma
// mantığı. Personel tarafının app/api/paratika/payment-link/route.ts
// dosyasına KASITLI OLARAK dokunulmadı/tekrar kullanılmadı - bugün
// orada kritik bir ödeme hatası bulup düzelttik, o dosyaları
// gereksiz yere değiştirip yeni bir risk almak istemiyoruz.
//
// Ödeme onaylama/senkronizasyon (return.ts, status-sync.ts) DEĞİŞMEDİ
// ve burada TEKRAR YAZILMADI - dealer_orders sadece paratika_payments
// tablosuna merchantPaymentId ile bağlanır, doğrulama aynı mevcut
// (bugün düzeltilen) koddan geçer.

import crypto from "crypto";

export type ParatikaConfig = {
  merchant: string;
  merchantUser: string;
  merchantPassword: string;
  baseUrl: string;
};

export function getDealerParatikaConfig(): ParatikaConfig {
  const merchant = String(process.env.PARATIKA_MERCHANT || "").trim();
  const merchantUser = String(process.env.PARATIKA_MERCHANT_USER || "").trim();
  const merchantPassword = String(
    process.env.PARATIKA_MERCHANT_PASSWORD || ""
  ).trim();
  const baseUrl = String(
    process.env.PARATIKA_BASE_URL ||
      "https://vpos.paratika.com.tr/paratika/api/v2"
  )
    .trim()
    .replace(/\/+$/, "");

  const missing: string[] = [];

  if (!merchant) missing.push("PARATIKA_MERCHANT");
  if (!merchantUser) missing.push("PARATIKA_MERCHANT_USER");
  if (!merchantPassword) missing.push("PARATIKA_MERCHANT_PASSWORD");

  if (missing.length) {
    throw new Error(`Eksik environment variable: ${missing.join(", ")}`);
  }

  if (!baseUrl.startsWith("https://")) {
    throw new Error("PARATIKA_BASE_URL HTTPS olmalıdır.");
  }

  return { merchant, merchantUser, merchantPassword, baseUrl };
}

export function createDealerMerchantPaymentId() {
  const now = new Date();

  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");

  return `CNETDLR-${stamp}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

async function postParatika(config: ParatikaConfig, params: URLSearchParams) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(config.baseUrl, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: any = null;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { responseCode: "", responseMsg: text || "Paratika boş cevap döndürdü." };
    }

    return { response, data };
  } finally {
    clearTimeout(timeoutId);
  }
}

// Paratika destek ekibinin talebiyle personel tarafinda (payment-link/
// route.ts) da ayni sekilde gonderiliyor: CR1..CR24 x CONSUMER/BUSINESS
// tam listesi, sadece secilen taksit active=true. Bayi odemeleri pesin
// (taksit yok) oldugu icin burada hep installment=1 (CR1) aktif edilir.
// Bu parametre olmadan PAYBYLINKPAYMENT session'i acilsa bile odeme
// sayfasi 3D Secure kart formunu duzgun render etmiyor.
function buildInstallmentSupport(selectedInstallment: number) {
  const result: Array<{
    commissionKey: string;
    active: boolean;
    installmentType: "CONSUMER" | "BUSINESS";
    encryptable: boolean;
  }> = [];

  const installmentTypes: Array<"CONSUMER" | "BUSINESS"> = ["CONSUMER", "BUSINESS"];

  for (const installmentType of installmentTypes) {
    for (let installment = 1; installment <= 24; installment++) {
      result.push({
        commissionKey: `CR${installment}`,
        active: installment === selectedInstallment,
        installmentType,
        encryptable: false,
      });
    }
  }

  return JSON.stringify(result);
}

function field(data: any, ...keys: string[]) {
  for (const key of keys) {
    const value = data?.[key];
    if (value !== undefined && value !== null) return String(value);
  }
  return "";
}

function findDeepStringByKeys(value: unknown, keys: string[]): string {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));

  const visit = (node: unknown): string => {
    if (node === null || node === undefined) return "";

    if (Array.isArray(node)) {
      for (const item of node) {
        const found = visit(item);
        if (found) return found;
      }
      return "";
    }

    if (typeof node !== "object") return "";

    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (wanted.has(key.toLowerCase()) && child !== null && child !== undefined) {
        const text = String(child).trim();
        if (text) return text;
      }

      const nested = visit(child);
      if (nested) return nested;
    }

    return "";
  };

  return visit(value);
}

function formatParatikaQueryDate(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(value);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${map.day}-${map.month}-${map.year} ${map.hour}:${map.minute}`;
}

export function buildDealerPaymentUrl(baseUrl: string, sessionToken: string) {
  const url = new URL(baseUrl);
  return `${url.protocol}//${url.host}/merchant/payment/${encodeURIComponent(sessionToken)}`;
}

export function getDealerParatikaReturnUrl(request: { headers: Headers; url: string }) {
  const configured = String(process.env.PARATIKA_RETURN_URL || "").trim();
  if (configured) return configured;

  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const forwardedHost =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    new URL(request.url).host;

  return `${forwardedProto}://${forwardedHost}/api/paratika/return`;
}

// Tek taksit (pesin) - bayi odemelerinde taksit secimi yok.
export async function createDealerPayByLink(
  config: ParatikaConfig,
  input: {
    merchantPaymentId: string;
    amount: number;
    customerCode: string;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    returnUrl: string;
  }
) {
  const params = new URLSearchParams();

  params.set("ACTION", "PAYBYLINKPAYMENT");
  params.set("MERCHANT", config.merchant);
  params.set("MERCHANTUSER", config.merchantUser);
  params.set("MERCHANTPASSWORD", config.merchantPassword);
  params.set("SESSIONTYPE", "PAYMENTSESSION");
  params.set("SESSIONEXPIRY", "24h");
  params.set("MERCHANTPAYMENTID", input.merchantPaymentId);
  params.set("AMOUNT", input.amount.toFixed(2));
  params.set("CURRENCY", "TRY");
  params.set("CUSTOMER", input.customerCode);
  params.set("CUSTOMERNAME", input.customerName);
  params.set("CUSTOMEREMAIL", input.customerEmail);
  params.set("CUSTOMERPHONE", input.customerPhone);
  params.set("LANGUAGE", "tr");
  params.set("RETURNURL", input.returnUrl);
  params.set("MERCHANTNOTE", input.merchantPaymentId);

  // Personel tarafiyla ayni encode deseni: once JSON.stringify sonra
  // encodeURIComponent ile once-encode edilip URLSearchParams'a konur -
  // form-encode ikinci katmani ekler, Paratika'nin kendi decode adimi
  // JSON'u geri elde eder.
  const installmentSupport = buildInstallmentSupport(1);
  params.set("INSTALLMENTSUPPORT", encodeURIComponent(installmentSupport));

  const result = await postParatika(config, params);

  const responseCode = field(result.data, "responseCode", "RESPONSECODE");
  const responseMsg = field(result.data, "responseMsg", "RESPONSEMSG");
  const sessionToken = field(result.data, "sessionToken", "SESSIONTOKEN").trim();

  return {
    ok: result.response.ok && responseCode === "00" && Boolean(sessionToken),
    sessionToken,
    responseCode,
    responseMsg,
    raw: result.data,
  };
}

// Personel akisindaki ADIM 3 - ayni PayByLink kaydinin payByLinkToken'ini
// bulur. Personel tarafinda bu sadece SMS icin kullaniliyor gibi
// gorunse de, ADIM 4 (resend) ile birlikte PayByLink kaydini
// "aktive" eden adim gibi davraniyor - bu ikisi olmadan session
// olussa bile odeme sayfasi acilirken genel bir hata veriyor.
export async function queryDealerPayByLink(
  config: ParatikaConfig,
  input: { merchantPaymentId: string; customerEmail: string; payByLinkCreateResponse: unknown }
) {
  let payByLinkToken = findDeepStringByKeys(input.payByLinkCreateResponse, [
    "payByLinkToken",
    "PAYBYLINKTOKEN",
  ]);

  if (payByLinkToken) {
    return { ok: true, payByLinkToken };
  }

  const params = new URLSearchParams();

  params.set("ACTION", "QUERYPAYBYLINKPAYMENT");
  params.set("MERCHANT", config.merchant);
  params.set("MERCHANTUSER", config.merchantUser);
  params.set("MERCHANTPASSWORD", config.merchantPassword);

  const now = new Date();
  const start = new Date(now.getTime() - 5 * 60 * 1000);
  const end = new Date(now.getTime() + 5 * 60 * 1000);

  params.set("STARTDATE", formatParatikaQueryDate(start));
  params.set("ENDDATE", formatParatikaQueryDate(end));
  params.set("MERCHANTNOTE", input.merchantPaymentId);
  params.set("CUSTOMEREMAIL", input.customerEmail);

  const result = await postParatika(config, params);

  const list = Array.isArray(result.data?.payByLinkPaymentList)
    ? result.data.payByLinkPaymentList
    : Array.isArray(result.data?.PAYBYLINKPAYMENTLIST)
    ? result.data.PAYBYLINKPAYMENTLIST
    : [];

  const match = list.find(
    (item: any) =>
      String(item?.merchantNote ?? item?.MERCHANTNOTE ?? "").trim() ===
      input.merchantPaymentId
  );

  payByLinkToken = String(
    match?.token ?? match?.payByLinkToken ?? match?.PAYBYLINKTOKEN ?? list[0]?.token ?? ""
  ).trim();

  if (!payByLinkToken) {
    payByLinkToken = findDeepStringByKeys(result.data, [
      "payByLinkToken",
      "PAYBYLINKTOKEN",
      "token",
    ]);
  }

  return { ok: Boolean(payByLinkToken), payByLinkToken, raw: result.data };
}

export async function resendDealerPayByLink(
  config: ParatikaConfig,
  payByLinkToken: string
) {
  const params = new URLSearchParams();

  params.set("ACTION", "PAYBYLINKPAYMENTRESEND");
  params.set("MERCHANT", config.merchant);
  params.set("MERCHANTUSER", config.merchantUser);
  params.set("MERCHANTPASSWORD", config.merchantPassword);
  params.set("PAYBYLINKTOKEN", payByLinkToken);
  params.set("NOTIFICATIONCHANNELS", "SMS");

  const result = await postParatika(config, params);
  const responseCode = field(result.data, "responseCode", "RESPONSECODE");

  return { ok: result.response.ok && responseCode === "00", responseCode, raw: result.data };
}
