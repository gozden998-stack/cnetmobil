// app/api/online/garantili/catalog/route.ts
//
// CNETMOBIL - Garantili katalog listesi (açma ekranındaki seçim kutuları için). Salt okunur. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { getGarantiliCatalog } from "@/app/lib/garantili/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  try {
    const catalog = await getGarantiliCatalog(request.nextUrl.searchParams.get("yenile") === "1");

    return json({ success: true, ...catalog });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Garantili kataloğu alınamadı." }, 200);
  }
}
