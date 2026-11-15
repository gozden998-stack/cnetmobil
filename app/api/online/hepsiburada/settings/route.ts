// app/api/online/hepsiburada/settings/route.ts
//
// Hepsiburada stok düşürme ayarı.
// GET             -> { syncEnabled }
// POST { syncEnabled } -> otomatik stok düşürmeyi açar/kapatır (açılınca başlangıç fotoğrafı yeniden alınır).
// SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { getSettings, saveSettings } from "@/app/lib/hepsiburada/stock-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  try {
    return json({ success: true, ...(await getSettings(getPool())) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Ayarlar okunamadı." }, 200);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) return json({ success: false, error: "Geçersiz istek." }, 400);

  try {
    const pool = getPool();

    await saveSettings(pool, { syncEnabled: body.syncEnabled === undefined ? undefined : body.syncEnabled === true });

    return json({ success: true, ...(await getSettings(pool)) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Ayarlar kaydedilemedi." }, 200);
  }
}
