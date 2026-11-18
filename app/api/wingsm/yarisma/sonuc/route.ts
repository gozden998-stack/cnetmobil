// app/api/wingsm/yarisma/sonuc/route.ts
//
// CNETMOBIL - Şampiyonlar Ligi - KAYITLI SONUCU OKU (hesap yapmaz)
//   Yönetici ve TÜM CMR mağaza girişleri (CMR MERKEZ/CADDE/SARAY/KAPAKLI) görür: yarışma mağazalar arası olduğu
//   için herkes herkesin sıralamasını görür. Mağaza girişlerine SADELEŞTİRİLMİŞ görünüm gider: yalnız sıralamaya
//   girenler; hedef rakamı, satıcı kodu ve IMEI verilmez. Diğer girişler (Vodafone vb.) 403.

import { NextRequest } from "next/server";

import { getPool, json, requireValidSession } from "../../score-rules/_shared";
import { CMR_BRANCH_LABELS } from "../../gidisat/_gidisat";
import { getLatestResult, getLeagueConfig, toStoreView } from "../_yarisma";

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
    const result = await getLatestResult(pool, config.id, kaynak);

    if (!result || (result as any).empty || !Array.isArray((result as any).standing)) {
      return json({
        success: true,
        hasResult: false,
        config: { title: config.title, startDate: config.startDate, endDate: config.endDate, bonusPoints: config.bonusPoints, preconditionPct: config.preconditionPct },
        prizeList: config.prizes,
        myBranch,
        kaynak,
      });
    }

    return json({ ...toStoreView(result as Record<string, any>), prizeList: config.prizes, myBranch, kaynak });
  } catch (error) {
    console.error("YARISMA_SONUC_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Sonuç alınamadı." }, 500);
  }
}
