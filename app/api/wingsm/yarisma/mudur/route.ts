// app/api/wingsm/yarisma/mudur/route.ts
//
// CNETMOBIL - Şampiyonlar Ligi MAĞAZA MÜDÜRLERİ yarışması - SONUCU OKU (şifreli)
//   Yönetici ve CMR mağaza girişleri çağırabilir (Vodafone vb. 403). Sıralamayı yalnız
//     - yönetici ya da
//     - doğru şifreyle alınmış geçerli anahtar (başlık: x-mudur-token) ile
//   görebilir; aksi halde { locked: true } döner ve sıralama sunucudan ÇIKMAZ.
//   GET                 -> bugünün (12:30 otomatik) yayını; yoksa "bekleniyor" / yayın bittiyse "donemSonu"
//   GET ?gun=YYYY-MM-DD -> o gün YAYINLANAN rapor (gün seçici)
//   GET ?kaynak=test    -> (sadece yönetici) kendi Hesapla (test) sonucu

import { NextRequest } from "next/server";

import { getPool, json, requireValidSession } from "../../score-rules/_shared";
import { CMR_BRANCH_LABELS } from "../../gidisat/_gidisat";
import { addDays, getLatestResult, getLeagueConfig, getPublishedForDay, isAutoRunDayForLeague, isIsoDate, lastPublishDay, mudurLeagueId, todayInTurkey } from "../_yarisma";
import { hasMudurPassword, verifyMudurToken } from "../_mudur-erisim";

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
    const leagueId = mudurLeagueId(config);
    const info = { title: "Şampiyonlar Ligi Mağaza Müdürleri Yarışması", startDate: config.startDate, endDate: config.endDate, preconditionPct: config.preconditionPct };

    // KİLİT: yönetici dışında geçerli anahtar yoksa hiçbir sıralama verisi dönmez.
    if (!isAdmin && !verifyMudurToken(request.headers.get("x-mudur-token"), leagueId)) {
      return json({ success: true, locked: true, passwordSet: await hasMudurPassword(pool, leagueId), config: info });
    }

    const kaynak = isAdmin && request.nextUrl.searchParams.get("kaynak") === "test" ? "test" : "yayin";
    const today = todayInTurkey();
    const gunParam = request.nextUrl.searchParams.get("gun");
    const gun = isIsoDate(gunParam) && gunParam < today ? gunParam : today;
    const raw: any = kaynak === "test" ? await getLatestResult(pool, leagueId, "test") : await getPublishedForDay(pool, leagueId, gun);
    const mudur = raw && Array.isArray(raw.rows) ? { title: raw.title, carpanMode: raw.carpanMode, computedAt: raw.computedAt, baselineRange: raw.baselineRange, range: raw.range, rows: raw.rows, prizes: raw.prizes, precondition: raw.precondition } : null;
    const bugunRaporYok = gun === today && !mudur;
    const sonYayinGunu = lastPublishDay(config);

    return json({
      success: true,
      locked: false,
      config: info,
      myBranch,
      kaynak,
      mudur,
      hasResult: Boolean(mudur),
      ...(kaynak === "test"
        ? {}
        : {
            gun,
            today,
            minGun: addDays(config.startDate, 1),
            sonYayinGunu,
            bekleniyor: bugunRaporYok && isAutoRunDayForLeague(today, config),
            donemSonu: bugunRaporYok && today > sonYayinGunu,
            bulunamadi: gun !== today && !mudur,
          }),
    });
  } catch (error) {
    console.error("YARISMA_MUDUR_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Sonuç alınamadı." }, 500);
  }
}
