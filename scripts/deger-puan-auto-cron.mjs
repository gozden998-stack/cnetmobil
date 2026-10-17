// scripts/deger-puan-auto-cron.mjs
//
// CNETMOBIL - WingSM Değer Puan - günlük otomatik hesaplama tetikleyicisi
//
// Coolify "Scheduled Task" olarak şu komutla çalıştırılır:
//
//   node scripts/deger-puan-auto-cron.mjs
//
// Önerilen sıklık: her 10 dakikada bir  (*/10 * * * *)
//
// Script sırayla üç ucu çağırır: CMR (/api/wingsm/deger-puan-auto), Gidişat
// (/api/wingsm/gidisat/auto) ve Vodafone
// (/api/wingsm/vodafone/auto). KARARI UÇLAR VERİR: Türkiye saatiyle 10:00'dan
// önce ya da bugün zaten hesaplanmışsa hiçbir şey yapmazlar, bu yüzden sık
// çağrılması zararsızdır. İkisi birbirinden BAĞIMSIZDIR: biri hata verse diğeri
// yine çalışır (çıkış kodu, biri bile başarısızsa 1 olur).
//
// Gerekli ortam değişkenleri (wingsm-sync-cron.mjs ile aynı): APP_URL,
// WINGSM_SYNC_SECRET.
//
// WingSM'e veri YAZILMAZ.

const appUrl = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
const secret = String(process.env.WINGSM_SYNC_SECRET || "").trim();

if (!appUrl) {
  console.error("[DEGER PUAN CRON] APP_URL bulunamadi.");
  process.exit(1);
}

if (!secret) {
  console.error("[DEGER PUAN CRON] WINGSM_SYNC_SECRET bulunamadi.");
  process.exit(1);
}

// Sıra önemli: Gidişat'ın "Değer Puan" kategorisi CMR Değer Puan raporundan beslenir.
const TARGETS = [
  { label: "CMR", path: "/api/wingsm/deger-puan-auto" },
  { label: "GIDISAT", path: "/api/wingsm/gidisat/auto" },
  { label: "VODAFONE", path: "/api/wingsm/vodafone/auto" },
];

async function callEndpoint({ label, path }) {
  const controller = new AbortController();
  // WingSM'den 4 depo satis listesi okunur; yavas olabilir.
  const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

  try {
    const response = await fetch(`${appUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${secret}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    let data = null;

    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      console.error(`[DEGER PUAN CRON] ${label}: Gecersiz JSON cevabi. HTTP ${response.status}`);
      return false;
    }

    if (!response.ok || data?.success !== true) {
      console.error(`[DEGER PUAN CRON] ${label}: Basarisiz. HTTP ${response.status}: ${data?.error || "bilinmeyen hata"}`);
      return false;
    }

    const detail = data.tarih && data.tarih2 ? ` (${data.tarih} - ${data.tarih2})` : "";
    console.log(`[DEGER PUAN CRON] ${label}: ${data.status}${detail}`);
    return true;
  } catch (error) {
    console.error(
      `[DEGER PUAN CRON] ${label}: Istek basarisiz:`,
      error?.name === "AbortError" ? "zaman asimi" : error instanceof Error ? error.message : error
    );
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

let allOk = true;

for (const target of TARGETS) {
  const ok = await callEndpoint(target);
  allOk = allOk && ok;
}

process.exit(allOk ? 0 : 1);
