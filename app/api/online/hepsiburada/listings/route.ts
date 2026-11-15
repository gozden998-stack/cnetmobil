// app/api/online/hepsiburada/listings/route.ts
//
// CNETMOBIL - Hepsiburada ürün (listing) listesi (SALT OKUNUR)
// GET ?offset=0&limit=50  -> Hepsiburada'daki satıcı listing'lerini (stok, fiyat, satış durumu) sayfalı döndürür.
// Hiçbir şey yazılmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { HEPSIBURADA_LISTING_BASE, getHepsiburadaConfig, hepsiburadaFetch } from "@/app/lib/hepsiburada/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  if (!getHepsiburadaConfig()) return json({ success: false, error: "Hepsiburada ortam değişkenleri eksik." }, 200);

  const params = request.nextUrl.searchParams;
  const offset = Math.max(0, Math.trunc(Number(params.get("offset")) || 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(params.get("limit")) || 50)));

  try {
    const result = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, "/listings/merchantid/{merchantId}", { query: { offset, limit } });

    if (!result.ok) {
      return json({ success: false, status: result.status, error: `Hepsiburada HTTP ${result.status}: ${result.raw.slice(0, 300)}` }, 200);
    }

    const rows: any[] = Array.isArray(result.body?.listings) ? result.body.listings : [];

    return json({ success: true, totalCount: Number(result.body?.totalCount ?? rows.length), offset, limit, rows });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Hepsiburada ürünleri alınamadı." }, 200);
  }
}
