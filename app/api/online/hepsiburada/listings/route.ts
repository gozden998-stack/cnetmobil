// app/api/online/hepsiburada/listings/route.ts
//
// CNETMOBIL - Hepsiburada ürün (listing) listesi + WingSM eşleşmesi (SALT OKUNUR)
// GET ?offset=0&limit=50  -> Hepsiburada'daki satıcı listing'lerini (stok, fiyat, satış durumu) sayfalı döndürür ve
//   her ürün için WingSM sıfır ürün eşleşmesini (elle: hepsiburada_sku_map, otomatik: stok kodu = WingSM MalKod) ile
//   WingSM'deki toplam stoğu ekler. Ürün adı WingSM'den gelir (Hepsiburada listing cevabında ad yok).
// Hiçbir şey yazılmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { HEPSIBURADA_LISTING_BASE, getHepsiburadaConfig, hepsiburadaFetch } from "@/app/lib/hepsiburada/server";
import { ensureHepsiburadaMapTable, wingProductsByCode, wingProductsByHbSku, type WingProduct } from "@/app/lib/hepsiburada/map";
import { indexCandidates, loadWingCandidates, suggestFor, type CandidateIndex } from "@/app/lib/hepsiburada/suggest";

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

    // WingSM eşleşmesi: önce elle yapılan, yoksa stok kodu = MalKod olan otomatik eşleşme.
    let matchError: string | null = null;
    const manual = new Map<string, string>();
    const manualSource = new Map<string, string>();
    let wing = new Map<string, WingProduct>();
    let bySku = new Map<string, WingProduct>();
    const hbNames = new Map<string, { name: string; brand: string }>();
    let candidateIndex: CandidateIndex | null = null;

    try {
      const pool = getPool();

      await ensureHepsiburadaMapTable(pool);

      const skus = rows.map((row) => String(row?.hepsiburadaSku ?? "")).filter(Boolean);
      const saved = await pool.query(`SELECT hb_sku, mal_kod, source FROM public.hepsiburada_sku_map WHERE hb_sku = ANY($1::text[])`, [skus]);

      for (const row of saved.rows) {
        manual.set(String(row.hb_sku), String(row.mal_kod));
        manualSource.set(String(row.hb_sku), String(row.source ?? "MANUAL"));
      }

      const codes = new Set<string>(manual.values());

      for (const row of rows) {
        const merchantSku = String(row?.merchantSku ?? "").trim();

        if (merchantSku) codes.add(merchantSku);
      }

      wing = await wingProductsByCode(pool, Array.from(codes));
      // WingSM barkod alanına Hepsiburada SKU'su yazılmış ürünler (hb_sku): listing SKU'su ile otomatik eşleşir.
      bySku = await wingProductsByHbSku(pool, skus);

      // Hepsiburada ürün adları (Excel'den yüklenmiş) ve adından WingSM önerisi için aday listesi.
      const names = await pool.query(`SELECT hb_sku, name, brand FROM public.hepsiburada_names WHERE hb_sku = ANY($1::text[])`, [skus]);

      for (const row of names.rows) hbNames.set(String(row.hb_sku), { name: String(row.name), brand: String(row.brand ?? "") });

      if (hbNames.size > 0) candidateIndex = indexCandidates(await loadWingCandidates(pool));
    } catch (error) {
      matchError = error instanceof Error ? error.message : String(error);
    }

    return json({
      success: true,
      totalCount: Number(result.body?.totalCount ?? rows.length),
      offset,
      limit,
      matchError,
      rows: rows.map((row) => {
        const hbSku = String(row?.hepsiburadaSku ?? "");
        const merchantSku = String(row?.merchantSku ?? "").trim();
        const manualCode = manual.get(hbSku) ?? null;
        const skuMatch = !manualCode ? bySku.get(hbSku) ?? null : null;
        const malKod = manualCode ?? (skuMatch ? String(skuMatch.mal_kod) : wing.has(merchantSku) ? merchantSku : null);
        const product = skuMatch ?? (malKod ? wing.get(malKod) ?? null : null);

        const hb = hbNames.get(hbSku) ?? null;
        // Eşleşmemiş ürünlerde Hepsiburada adından WingSM önerisi (yalnız öneri, onaylanınca kaydedilir).
        const suggestion = !malKod && hb && candidateIndex ? suggestFor(hb.name, candidateIndex) : null;

        return {
          hepsiburadaSku: row?.hepsiburadaSku ?? null,
          merchantSku: row?.merchantSku ?? null,
          price: row?.price ?? null,
          availableStock: row?.availableStock ?? null,
          isSalable: row?.isSalable ?? null,
          isSuspended: row?.isSuspended ?? null,
          isLocked: row?.isLocked ?? null,
          malKod,
          mapSource: malKod ? (manualCode ? (manualSource.get(hbSku) === "AUTO" ? "AUTO" : "MANUAL") : skuMatch ? "SKU" : "AUTO") : null,
          // Elle eşleşmiş ama WingSM sıfır stokta artık bulunmayan ürün: wingStock 0 gösterilir.
          productName: product?.mal_ad || hb?.name || null,
          nameSource: product?.mal_ad ? "WINGSM" : hb?.name ? "HEPSIBURADA" : null,
          brand: hb?.brand || null,
          suggestion,
          wingClass: product?.sinif ?? null,
          wingStock: malKod ? product?.adet ?? 0 : null,
        };
      }),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Hepsiburada ürünleri alınamadı." }, 200);
  }
}
