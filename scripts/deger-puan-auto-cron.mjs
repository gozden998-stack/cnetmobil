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
// Script sadece /api/wingsm/deger-puan-auto ucunu çağırır. KARARI UÇ VERİR:
// Türkiye saatiyle 10:00'dan önce ya da bugün zaten hesaplanmışsa hiçbir şey
// yapmaz, bu yüzden sık çağrılması zararsızdır. Saat dilimi ayarı önemli değil.
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

const controller = new AbortController();
// WingSM'den 4 depo satis listesi okunur; yavas olabilir.
const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

try {
  const response = await fetch(`${appUrl}/api/wingsm/deger-puan-auto`, {
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
    console.error(`[DEGER PUAN CRON] Gecersiz JSON cevabi. HTTP ${response.status}`);
    process.exit(1);
  }

  if (!response.ok || data?.success !== true) {
    console.error(`[DEGER PUAN CRON] Basarisiz. HTTP ${response.status}: ${data?.error || "bilinmeyen hata"}`);
    process.exit(1);
  }

  const detail = data.tarih && data.tarih2 ? ` (${data.tarih} - ${data.tarih2})` : "";
  console.log(`[DEGER PUAN CRON] ${data.status}${detail}`);
  process.exit(0);
} catch (error) {
  console.error(
    "[DEGER PUAN CRON] Istek basarisiz:",
    error?.name === "AbortError" ? "zaman asimi" : error instanceof Error ? error.message : error
  );
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
