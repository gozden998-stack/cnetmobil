// app/api/wingsm/vodafone/yarisma/sonuc/route.ts
//
// CNETMOBIL - Vodafone Şampiyonlar Ligi - KAYITLI SONUCU OKU (hesap yapmaz)
//   Yönetici ve Vodafone kanalı (VODAFONE KANALI) girişleri görür; CMR girişleri 403.
//   Mağaza girişlerine SADELEŞTİRİLMİŞ görünüm gider (yalnız sıralamaya girenler; satıcı kodu/tanı verisi yok).
//   Mağazalar YALNIZ her gün 12:30'daki otomatik "yayın" sonucunu görür; yönetici ?kaynak=test ile kendi Hesapla sonucunu önizler.
//   ?gun=YYYY-MM-DD o gün YAYINLANAN raporu getirir.

import { NextRequest } from "next/server";

import { getPool, json, requireValidSession } from "../../../score-rules/_shared";
import { addDays, getLatestResult, getPublishedForDay, isIsoDate, todayInTurkey } from "../../../yarisma/_yarisma";
import { getVdfConfig, toVdfStoreView, vdfIsAutoRunDay, vdfLastPublishDay } from "../_vyarisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isVodafoneBranch(branch: string) {
  return String(branch ?? "").trim().toLocaleUpperCase("tr-TR") === "VODAFONE KANALI";
}

export async function GET(request: NextRequest) {
  const auth = requireValidSession(request);

  if (!auth.ok) return auth.response;

  const isAdmin = auth.session.role === "admin";

  if (!isAdmin && !isVodafoneBranch(auth.session.branch)) {
    return json({ success: false, error: "Bu ekran sadece Vodafone kanalına açıktır." }, 403);
  }

  try {
    const pool = getPool();
    const config = await getVdfConfig(pool);
    const kaynak = isAdmin && request.nextUrl.searchParams.get("kaynak") === "test" ? "test" : "yayin";
    const today = todayInTurkey();
    const gunParam = request.nextUrl.searchParams.get("gun");
    const gun = isIsoDate(gunParam) && gunParam < today ? gunParam : today;
    const result = kaynak === "test" ? await getLatestResult(pool, config.id, "test") : await getPublishedForDay(pool, config.id, gun);
    const bugunRaporYok = gun === today && !result;
    const sonYayinGunu = vdfLastPublishDay(config);
    const gunBilgisi =
      kaynak === "test"
        ? {}
        : {
            gun,
            today,
            minGun: addDays(config.startDate, 1),
            sonYayinGunu,
            bekleniyor: bugunRaporYok && vdfIsAutoRunDay(today, config),
            donemSonu: bugunRaporYok && today > sonYayinGunu,
            bulunamadi: gun !== today && !result,
          };

    if (!result || (result as any).empty || !Array.isArray((result as any).standing)) {
      return json({
        success: true,
        hasResult: false,
        config: { title: config.title, startDate: config.startDate, endDate: config.endDate, points: config.points },
        prizeList: config.prizes,
        kaynak,
        ...gunBilgisi,
      });
    }

    return json({ ...toVdfStoreView(result as Record<string, any>), prizeList: config.prizes, kaynak, ...gunBilgisi });
  } catch (error) {
    console.error("VDF_YARISMA_SONUC_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Sonuç alınamadı." }, 500);
  }
}
