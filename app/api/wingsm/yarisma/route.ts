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

import { hasMudurPassword, setMudurPassword, validatePassword } from "./_mudur-erisim";
import { computeLeague, computeManagerLeague, getDegerPuanTargets, getLatestResult, getLeagueConfig, getYarismaTargets, isIsoDate, mudurLeagueId, saveLeagueConfig, saveYarismaTargets, validateTargets } from "./_yarisma";

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
      mudur: await getLatestResult(pool, mudurLeagueId(config), "test"),
      // Yarışmaya özel kişi hedefleri + (başlangıç önerisi olarak) Değer Puan hedefleri
      // Mağaza müdürleri sekmesi şifresi belirlenmiş mi (şifrenin kendisi/hash'i HİÇBİR cevapta dönmez)
      mudurSifreVar: await hasMudurPassword(pool, mudurLeagueId(config)),
      targets: await getYarismaTargets(pool, config.id),
      degerPuanTargets: await getDegerPuanTargets(pool, config.countFrom.slice(0, 7)),
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

      if (body.mudurCarpan !== undefined) {
        if (!["karekok", "oransal", "yok"].includes(body.mudurCarpan)) return json({ success: false, error: "Geçersiz çarpan yöntemi." }, 400);

        config.mudurCarpan = body.mudurCarpan;
      }

      await saveLeagueConfig(pool, config);

      return json({ success: true, config });
    }

    if (body?.action === "mudurSifre") {
      const checked = validatePassword(body.sifre);

      if (!checked.ok) return json({ success: false, error: checked.error }, 400);

      await setMudurPassword(pool, mudurLeagueId(config), checked.value);

      return json({ success: true, mudurSifreVar: true });
    }

    if (body?.action === "hedefKaydet") {
      const checked = validateTargets(body.rows);

      if (!checked.ok) return json({ success: false, error: checked.error }, 400);

      await saveYarismaTargets(pool, config.id, checked.rows);

      return json({ success: true, targets: await getYarismaTargets(pool, config.id) });
    }

    if (body?.action === "hesapla") {
      // TEST sonucu: mağazalara GÖRÜNMEZ (mağazalar yalnız otomatik 12:30 sonucunu görür).
      const result = await computeLeague(pool, config, "test");

      // Mağaza müdürleri yarışması da aynı Hesapla ile (TEST) hesaplanır; biri hata verse diğeri etkilenmez.
      let mudurError: string | null = null;

      try {
        await computeManagerLeague(pool, config, "test");
      } catch (error) {
        mudurError = error instanceof Error ? error.message : String(error);
      }

      return json({ ...result, success: true, mudurError });
    }

    return json({ success: false, error: "Bilinmeyen işlem." }, 400);
  } catch (error) {
    if (error instanceof DegerPuanInputError) return json({ success: false, error: error.message }, 400);

    console.error("YARISMA_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Yarışma hesaplanamadı." }, 200);
  }
}
