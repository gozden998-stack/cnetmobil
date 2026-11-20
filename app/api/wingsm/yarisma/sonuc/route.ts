// app/api/wingsm/yarisma/sonuc/route.ts
//
// CNETMOBIL - Şampiyonlar Ligi - KAYITLI SONUCU OKU (hesap yapmaz)
//   Yönetici ve TÜM CMR mağaza girişleri (CMR MERKEZ/CADDE/SARAY/KAPAKLI) görür: yarışma mağazalar arası olduğu
//   için herkes herkesin sıralamasını görür. Mağaza girişlerine SADELEŞTİRİLMİŞ görünüm gider: yalnız sıralamaya
//   girenler; hedef rakamı, satıcı kodu ve IMEI verilmez. Diğer girişler (Vodafone vb.) 403.

import { NextRequest } from "next/server";

import { getPool, json, requireValidSession } from "../../score-rules/_shared";
import { CMR_BRANCH_LABELS } from "../../gidisat/_gidisat";
import { addDays, getLatestResult, getLeagueConfig, getPublishedForDay, isAutoRunDayForLeague, isIsoDate, lastPublishDay, mudurLeagueId, toStoreView, todayInTurkey } from "../_yarisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function sameBranch(a: unknown, b: unknown) {
  return String(a ?? "").trim().toLocaleUpperCase("tr-TR") === String(b ?? "").trim().toLocaleUpperCase("tr-TR");
}

export async function GET(request: NextRequest) {
  const auth = requireValidSession(request);

  if (!auth.ok) return auth.response;

  const isAdmin = auth.session.role === "admin";
  const myBranch = String(auth.session.branch ?? "").trim();

  if (!isAdmin && !CMR_BRANCH_LABELS.some((label) => sameBranch(label, myBranch))) {
    return json({ success: false, error: "Bu ekran sadece CMR mağazalarına açıktır." }, 403);
  }

  try {
    const pool = getPool();
    const config = await getLeagueConfig(pool);
    // Mağazalar YALNIZ otomatik (12:30) "yayın" sonucunu görür. Yönetici ?kaynak=test ile kendi Hesapla (test) sonucunu önizler.
    const kaynak = isAdmin && request.nextUrl.searchParams.get("kaynak") === "test" ? "test" : "yayin";
    // GÜN SEÇİCİ (yalnız yayın): ?gun=YYYY-MM-DD o gün YAYINLANAN raporu getirir; verilmezse / bugünse bugünün raporu.
    // Bugünün raporu (12:30 otomatik yayını) henüz yoksa "bekleniyor": eski rakamlar gösterilmez.
    const today = todayInTurkey();
    const gunParam = request.nextUrl.searchParams.get("gun");
    const gun = isIsoDate(gunParam) && gunParam < today ? gunParam : today;
    const minGun = addDays(config.startDate, 1);

    const result = kaynak === "test" ? await getLatestResult(pool, config.id, "test") : await getPublishedForDay(pool, config.id, gun);
    const mudurRaw: any = kaynak === "test" ? await getLatestResult(pool, mudurLeagueId(config), "test") : await getPublishedForDay(pool, mudurLeagueId(config), gun);
    // Bugünün raporu yoksa: yayın günüyse "bekleniyor"; yayın süresi (ayın 28'i) bittiyse "donemSonu" (yeni rapor gelmeyecek).
    const bugunRaporYok = gun === today && !result;
    const sonYayinGunu = lastPublishDay(config);
    const gunBilgisi =
      kaynak === "test"
        ? {}
        : {
            gun,
            today,
            minGun,
            sonYayinGunu,
            bekleniyor: bugunRaporYok && isAutoRunDayForLeague(today, config),
            donemSonu: bugunRaporYok && today > sonYayinGunu,
            bulunamadi: gun !== today && !result,
          };
    // Mağaza müdürleri yarışması (mağaza bazlı sayılar; kişisel veri yok)
    const mudur =
      mudurRaw && Array.isArray(mudurRaw.rows)
        ? { title: mudurRaw.title, carpanMode: mudurRaw.carpanMode, computedAt: mudurRaw.computedAt, baselineRange: mudurRaw.baselineRange, range: mudurRaw.range, rows: mudurRaw.rows, prizes: mudurRaw.prizes, precondition: mudurRaw.precondition }
        : null;

    if (!result || (result as any).empty || !Array.isArray((result as any).standing)) {
      return json({
        success: true,
        hasResult: false,
        config: { title: config.title, startDate: config.startDate, endDate: config.endDate, bonusPoints: config.bonusPoints, preconditionPct: config.preconditionPct },
        prizeList: config.prizes,
        myBranch,
        kaynak,
        mudur,
        ...gunBilgisi,
      });
    }

    return json({ ...toStoreView(result as Record<string, any>), prizeList: config.prizes, myBranch, kaynak, mudur, ...gunBilgisi });
  } catch (error) {
    console.error("YARISMA_SONUC_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Sonuç alınamadı." }, 500);
  }
}
