// app/lib/hepsiburada/server.ts
//
// CNETMOBIL - Hepsiburada (pazaryeri) ortak server yardımcıları
//
// Kimlik: Basic authentication (kullanıcı adı = merchantId, şifre = servis anahtarı) + istekte
// "User-Agent" başlığı (entegratör kullanıcı adı). Hepsiburada geliştirici dokümanına göre.
// Anahtarlar SADECE sunucu ortam değişkenlerinde durur, hiçbir cevaba/loga yazılmaz:
//   HEPSIBURADA_MERCHANT_ID, HEPSIBURADA_SERVICE_KEY, HEPSIBURADA_INTEGRATOR
// Servis adresleri (isteğe bağlı, varsayılanlar canlı ortam; dokümanda sadece test (SIT) adresleri yazıyor):
//   HEPSIBURADA_LISTING_BASE  (varsayılan https://listing-external.hepsiburada.com)
//   HEPSIBURADA_ORDERS_BASE   (varsayılan https://oms-external.hepsiburada.com)
//
// Endpoint'ler (dokümandaki OpenAPI'den):
//   GET  /listings/merchantid/{merchantId}?offset&limit     listing'leri oku
//   POST /listings/merchantid/{merchantId}/stock-uploads    stok yükle
//   GET  /orders/merchantid/{merchantId}?offset&limit       ödemesi tamamlanmış (Open) siparişler
// Limitler: listing güncellemede tek istekte en çok 4000 ürün, dakikada ~240 istek, en çok 5 bekleyen yükleme.

export const HEPSIBURADA_LISTING_BASE = (process.env.HEPSIBURADA_LISTING_BASE || "https://listing-external.hepsiburada.com").replace(/\/+$/, "");
export const HEPSIBURADA_ORDERS_BASE = (process.env.HEPSIBURADA_ORDERS_BASE || "https://oms-external.hepsiburada.com").replace(/\/+$/, "");

const text = (value: unknown) => String(value ?? "").trim();

export type HepsiburadaConfig = { merchantId: string; serviceKey: string; integrator: string };

export function getHepsiburadaConfig(): HepsiburadaConfig | null {
  const merchantId = text(process.env.HEPSIBURADA_MERCHANT_ID);
  const serviceKey = text(process.env.HEPSIBURADA_SERVICE_KEY);
  const integrator = text(process.env.HEPSIBURADA_INTEGRATOR);

  if (!merchantId || !serviceKey || !integrator) return null;

  return { merchantId, serviceKey, integrator };
}

export function hepsiburadaEnvStatus() {
  return {
    HEPSIBURADA_MERCHANT_ID: Boolean(text(process.env.HEPSIBURADA_MERCHANT_ID)),
    HEPSIBURADA_SERVICE_KEY: Boolean(text(process.env.HEPSIBURADA_SERVICE_KEY)),
    HEPSIBURADA_INTEGRATOR: Boolean(text(process.env.HEPSIBURADA_INTEGRATOR)),
  };
}

export type HepsiburadaResponse = { status: number; ok: boolean; body: any; raw: string };

// Hata durumunda atmaz: durum kodunu ve gövdeyi döndürür (çağıran karar verir). Ağ/zaman aşımı hatası atar.
export async function hepsiburadaFetch(
  base: string,
  path: string,
  options: { method?: "GET" | "POST"; query?: Record<string, string | number>; body?: unknown; timeoutMs?: number } = {}
): Promise<HepsiburadaResponse> {
  const config = getHepsiburadaConfig();

  if (!config) throw new Error("Hepsiburada ortam değişkenleri eksik (HEPSIBURADA_MERCHANT_ID / SERVICE_KEY / INTEGRATOR).");

  const url = new URL(`${base}${path.replace("{merchantId}", encodeURIComponent(config.merchantId))}`);

  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, String(value));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 20_000);

  try {
    const response = await fetch(url.toString(), {
      method: options.method ?? "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": config.integrator,
        Authorization: `Basic ${Buffer.from(`${config.merchantId}:${config.serviceKey}`, "utf8").toString("base64")}`,
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

    return { status: response.status, ok: response.ok, body, raw };
  } finally {
    clearTimeout(timeout);
  }
}
