// scripts/channel-close-cron.mjs
//
// CNETMOBIL - Kanallar arası stok kapatma tetikleyicisi
//
// Coolify "Scheduled Task" olarak şu komutla çalıştırılır:
//
//   node scripts/channel-close-cron.mjs
//
// Önerilen sıklık: her dakika (* * * * *)
//
// /api/online/channel-close/run ucunu çağırır: İdefix siparişlerini okuyup satılan IMEI'ler için N11
// kapatma kaydı atar, sonra kuyruktaki İdefix/N11 kapatmalarını işler (hata olanı tekrar dener).
// Bkz. app/lib/channel-close/queue.ts. WingSM'e veri YAZILMAZ.
//
// Gerekli ortam değişkenleri (wingsm-sync-cron.mjs ile aynı): APP_URL, WINGSM_SYNC_SECRET.

const appUrl = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
const secret = String(process.env.WINGSM_SYNC_SECRET || "").trim();

if (!appUrl) {
  console.error("[CHANNEL CLOSE CRON] APP_URL bulunamadi.");
  process.exit(1);
}

if (!secret) {
  console.error("[CHANNEL CLOSE CRON] WINGSM_SYNC_SECRET bulunamadi.");
  process.exit(1);
}

const controller = new AbortController();
// Her kapatma İdefix'te birkaç saniye bekleyebilir (inventory-result + canlı doğrulama).
const timeout = setTimeout(() => controller.abort(), 4 * 60 * 1000);

try {
  const response = await fetch(`${appUrl}/api/online/channel-close/run`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${secret}` },
    cache: "no-store",
    signal: controller.signal,
  });

  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    console.error(`[CHANNEL CLOSE CRON] Gecersiz JSON cevabi. HTTP ${response.status}`);
    process.exit(1);
  }

  const queue = data?.queue || {};
  const orders = data?.orders || {};

  console.log(
    `[CHANNEL CLOSE CRON] siparis okunan=${orders.ordersRead ?? "-"} yeni kalem=${orders.newItems ?? "-"} ` +
      `imeili=${orders.imeiItems ?? "-"} kuyruk: alinan=${queue.picked ?? 0} tamam=${queue.done ?? 0} ` +
      `atlanan=${queue.skipped ?? 0} hata=${queue.failed ?? 0}`
  );

  if (Array.isArray(data?.errors) && data.errors.length) {
    for (const message of data.errors) console.error(`[CHANNEL CLOSE CRON] ${message}`);
  }

  if (!response.ok || data?.success !== true) {
    console.error(`[CHANNEL CLOSE CRON] Basarisiz. HTTP ${response.status}: ${data?.error || "hata listesine bakin"}`);
    process.exit(1);
  }
} catch (error) {
  console.error(
    "[CHANNEL CLOSE CRON] Istek basarisiz:",
    error?.name === "AbortError" ? "zaman asimi" : error instanceof Error ? error.message : error
  );
  process.exit(1);
} finally {
  clearTimeout(timeout);
}
