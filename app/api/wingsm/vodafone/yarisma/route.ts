// app/api/wingsm/vodafone/yarisma/route.ts
//
// CNETMOBIL - Vodafone "Şampiyonlar Ligi" yarışması (SADECE YÖNETİCİ)
//
// GET  -> yarışma ayarı (puanlar, mağaza çarpanları) + yöneticinin son "Hesapla" (TEST) sonucu + yayın özeti (hesap yapmaz)
// POST { action: "hesapla" }                      -> TEST sonucunu hesapla ve kaydet (mağazalara görünmez)
// POST { action: "carpanKaydet", carpan: {...} }  -> mağaza çarpanlarını kaydet (elle girilir)
// Resmi Vodafone Değer Puan raporu/arşivi bu hesapla DEĞİŞMEZ. WingSM'e yazılmaz.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";
import { getLatestResult } from "../../yarisma/_yarisma";
import { hasMudurPassword, setMudurPassword, validatePassword } from "../../yarisma/_mudur-erisim";
import { VODAFONE_DEPOTS } from "../_vodafone";
import { computeVdfLeague, computeVdfManagerLeague, dokumVdfPerson, getVdfConfig, sanitizeCarpan, saveVdfConfig, vdfMudurLeagueId } from "./_vyarisma";

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
      result: await getLatestResult(pool, config.id, "test"),
      // Mağaza müdürleri sekmesi şifresi belirlenmiş mi (şifrenin kendisi/hash'i HİÇBİR cevapta dönmez)
      mudurSifreVar: await hasMudurPassword(pool, vdfMudurLeagueId(config)),
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

    if (body?.action === "dokum") {
      const kisi = String(body?.kisi ?? "").trim();

      if (kisi.length < 3 || kisi.length > 100) return json({ success: false, error: "Kişi adından en az 3 harf yazın." }, 400);

      return json({ success: true, dokum: await dokumVdfPerson(config, kisi) });
    }

    if (body?.action === "mudurSifre") {
      const checked = validatePassword(body.sifre);

      if (!checked.ok) return json({ success: false, error: checked.error }, 400);

      await setMudurPassword(pool, vdfMudurLeagueId(config), checked.value);

      return json({ success: true, mudurSifreVar: true });
    }

    if (body?.action === "hesapla") {
      const result = await computeVdfLeague(pool, config, "test");

      // Mağaza müdürleri yarışması da aynı Hesapla ile (TEST) hesaplanır; biri hata verse diğeri etkilenmez.
      let mudurError: string | null = null;

      try {
        await computeVdfManagerLeague(pool, config, "test");
      } catch (error) {
        mudurError = error instanceof Error ? error.message : String(error);
      }

      return json({ success: true, result, mudurError });
    }

    return json({ success: false, error: "Bilinmeyen işlem." }, 400);
  } catch (error) {
    console.error("VDF_YARISMA_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Yarışma işlemi başarısız." }, 500);
  }
}
