// app/api/stok-rapor/route.ts
//
// CNETMOBIL - Komple stok raporu: grade (MÜKEMMEL / ÇOK İYİ / İYİ / OUTLET) x yenileme uygunluğu x online kanal durumu
// SALT OKUNUR (DB'den okur; Garantili'ye, pazaryerlerine, WingSM'e istek atmaz). SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { getStokRapor } from "@/app/lib/stok-rapor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  try {
    return json({ success: true, rapor: await getStokRapor(getPool()) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Stok raporu hazırlanamadı." }, 200);
  }
}
