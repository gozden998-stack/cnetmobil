// app/lib/garantili/server.ts
//
// CNETMOBIL - Garantili (partner.garantili.com.tr) ortak server yardımcıları
//
// Kimlik: X-Api-Key başlığı. Anahtar SADECE sunucu ortam değişkeninde durur, hiçbir cevaba/loga yazılmaz:
//   GARANTILI_API_KEY          (zorunlu)
//   GARANTILI_API_KEY_YAZMA    (isteğe bağlı: ayrı yazma anahtarı varsa yazma çağrıları bunu kullanır)
//   GARANTILI_API_BASE         (isteğe bağlı, varsayılan https://partner.garantili.com.tr/api/v1)
// Limit: dakikada 60, saatte 3000 istek. Burada dakikada en çok 45 istekle kendimizi sınırlarız.
//
// GÜVENLİK: anahtar tam yetkili olabilir (fatura gönder, kargo oluştur, müşteriye SMS...). Bu yüzden yalnızca
// aşağıda AÇIKÇA yazılı yollar çağrılabilir; listede olmayan yol hiçbir koşulda gönderilmez.

export const GARANTILI_BASE = (process.env.GARANTILI_API_BASE || "https://partner.garantili.com.tr/api/v1").replace(/\/+$/, "");

// Okuma (GET) için izinli yollar
const READ_PATHS = new Set<string>([
  "/auth/ben",
  "/cihaz/liste",
  "/cihaz/detay",
  "/ilan/liste",
  "/ilan/excel",
  "/pazaryeri/siparis-liste",
  "/pazaryeri/siparis-detay",
  "/pazaryeri/filtre-secenekleri",
  "/katalog/tumu",
  "/katalog/turler",
  "/katalog/markalar",
  "/katalog/modeller",
  "/katalog/hafizalar",
  "/katalog/renkler",
  "/katalog/model",
  "/kayit/secenekler",
  "/cihaz/grade-kriter",
  "/profil/sozlesmeler",
]);

// Yazma (POST) için izinli yollar: sonraki aşamalarda (cihaz açma / ilan kapatma) kullanılacak.
const WRITE_PATHS = new Set<string>(["/kayit/cihaz-ekle", "/cihaz/guncelle", "/ilan/ac", "/ilan/kaldir-talep", "/ilan/min-fiyat"]);

const text = (value: unknown) => String(value ?? "").trim();

export function getGarantiliKey(write = false): string | null {
  const main = text(process.env.GARANTILI_API_KEY);
  const writeKey = text(process.env.GARANTILI_API_KEY_YAZMA);

  if (write) return writeKey || main || null;

  return main || writeKey || null;
}

export function garantiliEnvStatus() {
  return {
    GARANTILI_API_KEY: Boolean(text(process.env.GARANTILI_API_KEY)),
    GARANTILI_API_KEY_YAZMA: Boolean(text(process.env.GARANTILI_API_KEY_YAZMA)),
  };
}

export type GarantiliResponse = { status: number; ok: boolean; body: any; raw: string };

declare global {
  // eslint-disable-next-line no-var
  var cnetGarantiliCalls: number[] | undefined;
}

const PER_MINUTE_LIMIT = 45;

function takeRateSlot() {
  const now = Date.now();
  const calls = (globalThis.cnetGarantiliCalls ?? []).filter((at) => now - at < 60_000);

  if (calls.length >= PER_MINUTE_LIMIT) {
    globalThis.cnetGarantiliCalls = calls;

    throw new Error("Garantili istek sınırına yaklaşıldı (dakikada 45). Birkaç saniye sonra tekrar deneyin.");
  }

  calls.push(now);
  globalThis.cnetGarantiliCalls = calls;
}

// Hata durumunda atmaz: durum kodunu ve gövdeyi döndürür (çağıran karar verir). Ağ/zaman aşımı/izinsiz yol hatası atar.
export async function garantiliFetch(
  path: string,
  options: { method?: "GET" | "POST"; query?: Record<string, string | number | undefined | null>; body?: unknown; timeoutMs?: number } = {}
): Promise<GarantiliResponse> {
  const method = options.method ?? "GET";

  if (method === "GET" ? !READ_PATHS.has(path) : !WRITE_PATHS.has(path)) {
    throw new Error(`Garantili: ${method} ${path} izinli yollar arasında değil.`);
  }

  const key = getGarantiliKey(method === "POST");

  if (!key) throw new Error("Garantili ortam değişkeni eksik (GARANTILI_API_KEY).");

  takeRateSlot();

  const url = new URL(`${GARANTILI_BASE}${path}`);

  for (const [name, value] of Object.entries(options.query ?? {})) {
    if (value === undefined || value === null || String(value) === "") continue;

    url.searchParams.set(name, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const response = await fetch(url.toString(), {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Api-Key": key,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const raw = await response.text();
    let body: any = null;

    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }

    return { status: response.status, ok: response.ok && body?.success !== false, body, raw };
  } finally {
    clearTimeout(timeout);
  }
}

// Kişisel veri (müşteri adı, TC, telefon, adres, e-posta) ekrana/loga taşınmasın diye satırlardan ayıklanır.
const PII_KEY = /tc|adres|telefon|gsm|eposta|e_posta|mail|musteri|müşteri|ad_soyad|soyad|iban|vergi/i;

export function stripPii(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => stripPii(item, depth + 1));

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !PII_KEY.test(key))
        .map(([key, item]) => [key, stripPii(item, depth + 1)])
    );
  }

  return value;
}

// Cevaptaki "satır listesi"ni bulur: data bir dizi ise o, değilse data içindeki ilk dizi alanı.
export function pickRows(body: any): { rows: any[]; total: number | null; listKey: string | null } {
  const data = body?.data;

  if (Array.isArray(data)) return { rows: data, total: Number(body?.toplam ?? body?.total ?? data.length) || data.length, listKey: null };

  if (data && typeof data === "object") {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        const total = (data as any).toplam ?? (data as any).total ?? (data as any).toplam_kayit ?? (data as any).total_count ?? null;

        return { rows: value, total: total === null ? null : Number(total) || null, listKey: key };
      }
    }
  }

  return { rows: [], total: null, listKey: null };
}
