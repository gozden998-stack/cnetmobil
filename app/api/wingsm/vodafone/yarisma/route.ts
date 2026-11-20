// app/api/wingsm/vodafone/yarisma/route.ts
//
// CNETMOBIL - Vodafone "Şampiyonlar Ligi" yarışması (SADECE YÖNETİCİ)
//
// GET  -> yarışma ayarı (puanlar, mağaza çarpanları) + yöneticinin son "Hesapla" (TEST) sonucu + yayın özeti (hesap yapmaz)
// POST { action: "hesapla" }                      -> TEST sonucunu hesapla ve kaydet (mağazalara görünmez)
// POST { action: "carpanKaydet", carpan: {...} }  -> mağaza çarpanlarını kaydet (elle girilir)
// POST { action: "hedefKaydet", rows: [...] }     -> yarışmaya özel KİŞİ HEDEFLERİNİ tamamen değiştirir (elle girilir)
// POST { action: "ayar", siralama: "hedef"|"puan" } -> sıralama ölçütü
// Resmi Vodafone Değer Puan raporu/arşivi bu hesapla DEĞİŞMEZ. WingSM'e yazılmaz.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";
import { getLatestResult, getYarismaTargets, saveYarismaTargets } from "../../yarisma/_yarisma";
import { VODAFONE_DEPOTS, loadTargets } from "../_vodafone";
import { computeVdfLeague, getVdfConfig, sanitizeCarpan, saveVdfConfig, validateVdfTargets } from "./_vyarisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  try {
    const pool = getPool();
    const config = await getVdfConfig(pool);
    const published: any = await getLatestResult(pool, config.id, "yayin");

    return json({
      success: true,
      config,
      stores: VODAFONE_DEPOTS.map((depot) => depot.branchLabel),
      targets: await getYarismaTargets(pool, config.id),
      // Vodafone Değer Puan hedefleri (başlangıç listesi olarak önerilir)
      degerPuanTargets: (await loadTargets(pool, config.countFrom.slice(0, 7))).personnel.map((item) => ({ saticiAdi: item.saticiAdi, branchLabel: item.branchLabel, hedef: item.hedef })),
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
    const config = await getVdfConfig(pool);

    if (body?.action === "carpanKaydet") {
      const parsed = sanitizeCarpan(body?.carpan);

      if (!parsed.ok) return json({ success: false, error: parsed.error }, 400);

      await saveVdfConfig(pool, { ...config, carpan: parsed.value });

      return json({ success: true, config: { ...config, carpan: parsed.value } });
    }

    if (body?.action === "hedefKaydet") {
      const parsed = validateVdfTargets(body?.rows);

      if (!parsed.ok) return json({ success: false, error: parsed.error }, 400);

      await saveYarismaTargets(pool, config.id, parsed.rows);

      return json({ success: true, targets: await getYarismaTargets(pool, config.id) });
    }

    if (body?.action === "ayar") {
      if (body?.siralama !== "hedef" && body?.siralama !== "puan") return json({ success: false, error: "Sıralama ölçütü geçersiz." }, 400);

      await saveVdfConfig(pool, { ...config, siralama: body.siralama });

      return json({ success: true, config: { ...config, siralama: body.siralama } });
    }

    if (body?.action === "hesapla") {
      const result = await computeVdfLeague(pool, config, "test");

      return json({ success: true, result });
    }

    return json({ success: false, error: "Bilinmeyen işlem." }, 400);
  } catch (error) {
    console.error("VDF_YARISMA_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Yarışma işlemi başarısız." }, 500);
  }
}
