// app/api/wingsm/gidisat/config/route.ts
//
// CNETMOBIL - Personel Gidişat - KATEGORİ AYARLARI (sadece yönetici).
//   GET -> 9 kategorinin puan / max puan / barem / ölçü / kuralı + genel ayarlar
//   PUT -> hepsini kaydeder (kategori anahtarları sabit; ad, ölçü, puan, barem ve kural düzenlenir)

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";
import { loadConfig, sanitizeConfig, saveConfig } from "../_gidisat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    return json({ success: true, ...(await loadConfig(getPool())) });
  } catch (error) {
    console.error("GIDISAT_CONFIG_GET_ERROR:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Ayarlar alınamadı." }, 500);
  }
}

export async function PUT(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ success: false, error: "Geçersiz istek." }, 400);
    }

    const config = sanitizeConfig(body);
    await saveConfig(getPool(), config);

    return json({ success: true, ...config });
  } catch (error) {
    console.error("GIDISAT_CONFIG_PUT_ERROR:", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." }, 500);
  }
}
