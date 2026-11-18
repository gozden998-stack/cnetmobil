// app/api/wingsm/yarisma/route.ts
//
// CNETMOBIL - CMR "Şampiyonlar Ligi" yarışması (SADECE YÖNETİCİ, şimdilik)
//
// GET  -> yarışma ayarı + kayıtlı son sonuç (hesap yapmaz)
// POST { action: "hesapla" }                          -> TEST sonucunu hesapla ve kaydet (mağazalara görünmez)
// POST { action: "ayar", countFrom?, bonusPoints? }   -> sayım başlangıcı / stok cihaz bonusu (kaydeder, hesaplamaz)
// Resmi Değer Puan raporu/arşivi bu hesapla DEĞİŞMEZ (bkz. _yarisma.ts). WingSM'e yazılmaz.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { DegerPuanInputError } from "@/app/api/wingsm/_deger-puan-compute";

import { computeLeague, getLatestResult, getLeagueConfig, isIsoDate, saveLeagueConfig } from "./_yarisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  try {
    const pool = getPool();
    const config = await getLeagueConfig(pool);
    const published: any = await getLatestResult(pool, config.id, "yayin");

    // result = yöneticinin son "Hesapla" (TEST) sonucu; mağazalara görünmez.
    // published = mağazaların gördüğü, her gün 12:30'daki otomatik sonucun özeti.
    return json({
      success: true,
      config,
      result: await getLatestResult(pool, config.id, "test"),
      published: published ? { computedAt: published.computedAt, range: published.range ?? null } : null,
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Yarışma okunamadı." }, 200);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  let body: any = null;

  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Geçersiz istek." }, 400);
  }

  try {
    const pool = getPool();
    const config = await getLeagueConfig(pool);

    if (body?.action === "ayar") {
      if (body.countFrom !== undefined) {
        // Sayım başlangıcı: yarışmanın ayının 1'i ile bitiş günü arasında olmalı
        const monthStart = `${config.startDate.slice(0, 7)}-01`;

        if (!isIsoDate(body.countFrom) || body.countFrom < monthStart || body.countFrom > config.endDate) {
          return json({ success: false, error: `Sayım başlangıcı ${monthStart} ile ${config.endDate} arasında olmalı.` }, 400);
        }

        config.countFrom = body.countFrom;
      }

      if (body.bonusPoints !== undefined) {
        const bonus = Number(body.bonusPoints);

        if (!Number.isInteger(bonus) || bonus < 0 || bonus > 1000) return json({ success: false, error: "Bonus 0 ile 1000 arasında tam sayı olmalı." }, 400);

        config.bonusPoints = bonus;
      }

      await saveLeagueConfig(pool, config);

      return json({ success: true, config });
    }

    if (body?.action === "hesapla") {
      // TEST sonucu: mağazalara GÖRÜNMEZ (mağazalar yalnız otomatik 12:30 sonucunu görür).
      const result = await computeLeague(pool, config, "test");

      return json({ ...result, success: true });
    }

    return json({ success: false, error: "Bilinmeyen işlem." }, 400);
  } catch (error) {
    if (error instanceof DegerPuanInputError) return json({ success: false, error: error.message }, 400);

    console.error("YARISMA_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Yarışma hesaplanamadı." }, 200);
  }
}
