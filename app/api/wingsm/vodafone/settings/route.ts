// app/api/wingsm/vodafone/settings/route.ts
//
// CNETMOBIL - Vodafone Değer Puan - AYARLAR (sadece yönetici).
// Sayılacak mal sınıfı (varsayılan 5AK), mağaza/personel sıralama puanları ve
// WingSM'e "sadece aktivasyon" süzgeciyle sorulup sorulmayacağı.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";
import { loadSettings, sanitizeSettings, saveSettings } from "../_vodafone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    return json({ success: true, settings: await loadSettings(getPool()) });
  } catch (error) {
    console.error("VODAFONE_SETTINGS_GET_ERROR:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Ayarlar alınamadı." }, 500);
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    if (!body || typeof body !== "object") {
      return json({ success: false, error: "Geçersiz istek." }, 400);
    }

    // Boş bonus listesi "bonus yok" demektir; bilinçli olabilir, engellenmez.
    const settings = sanitizeSettings(body);

    await saveSettings(getPool(), settings);

    return json({ success: true, settings });
  } catch (error) {
    console.error("VODAFONE_SETTINGS_PUT_ERROR:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." }, 500);
  }
}
