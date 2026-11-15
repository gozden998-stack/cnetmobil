// app/api/online/hepsiburada/listings/route.ts
//
// CNETMOBIL - Hepsiburada ürün (listing) listesi (SALT OKUNUR)
// GET ?offset=0&limit=50  -> Hepsiburada'daki satıcı listing'lerini (stok, fiyat, satış durumu) sayfalı döndürür.
// Hiçbir şey yazılmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { HEPSIBURADA_LISTING_BASE, getHepsiburadaCatalogMap, getHepsiburadaConfig, hepsiburadaFetch, type HepsiburadaCatalogItem } from "@/app/lib/hepsiburada/server";

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

    // Ürün adı katalog servisinden gelir; katalog alınamazsa ad boş kalır, listing yine döner.
    let catalog: Map<string, HepsiburadaCatalogItem> | null = null;
    let catalogError: string | null = null;

    try {
      catalog = await getHepsiburadaCatalogMap();
    } catch (error) {
      catalogError = error instanceof Error ? error.message : String(error);
    }

    return json({
      success: true,
      totalCount: Number(result.body?.totalCount ?? rows.length),
      offset,
      limit,
      catalogError,
      rows: rows.map((row) => {
        const item = catalog?.get(String(row?.hepsiburadaSku ?? "")) ?? catalog?.get(String(row?.merchantSku ?? "")) ?? null;

        return {
          hepsiburadaSku: row?.hepsiburadaSku ?? null,
          merchantSku: row?.merchantSku ?? null,
          price: row?.price ?? null,
          availableStock: row?.availableStock ?? null,
          isSalable: row?.isSalable ?? null,
          isSuspended: row?.isSuspended ?? null,
          isLocked: row?.isLocked ?? null,
          productName: item?.productName || null,
          brand: item?.brand || null,
          categoryName: item?.categoryName || null,
        };
      }),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Hepsiburada ürünleri alınamadı." }, 200);
  }
}
