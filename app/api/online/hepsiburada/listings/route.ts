// app/api/online/hepsiburada/listings/route.ts
//
// CNETMOBIL - Hepsiburada ürün (listing) listesi + WingSM eşleşmesi (SALT OKUNUR)
// GET ?offset=0&limit=50&q=iphone&filter=all|salable|soldout|matched|unmatched
//   Hepsiburada'daki TÜM listing'leri alır (sayfa sayfa), her ürün için WingSM sıfır ürün eşleşmesini (elle/SKU/stok kodu),
//   Hepsiburada adını ve adından WingSM önerisini ekler; sonra aramayı (q) ve filtreyi TÜM ürünlerde uygular, en sonda sayfalar.
// Hiçbir şey yazılmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { HEPSIBURADA_LISTING_BASE, getHepsiburadaConfig, hepsiburadaFetch } from "@/app/lib/hepsiburada/server";
import { ensureHepsiburadaMapTable, wingProductsByCode, wingProductsByHbSku, type WingProduct } from "@/app/lib/hepsiburada/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const fold = (value: unknown) =>
  String(value ?? "")
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ş/g, "s")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");

async function fetchAllListings() {
  const rows: any[] = [];

  for (let offset = 0; offset < 5000; offset += 100) {
    const result = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, "/listings/merchantid/{merchantId}", { query: { offset, limit: 100 } });

    if (!result.ok) throw new Error(`Hepsiburada HTTP ${result.status}: ${result.raw.slice(0, 300)}`);

    const page: any[] = Array.isArray(result.body?.listings) ? result.body.listings : [];

    rows.push(...page);

    if (page.length < 100) break;
  }

  return rows;
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  if (!getHepsiburadaConfig()) return json({ success: false, error: "Hepsiburada ortam değişkenleri eksik." }, 200);

  const params = request.nextUrl.searchParams;
  const offset = Math.max(0, Math.trunc(Number(params.get("offset")) || 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(params.get("limit")) || 50)));
  const q = fold(params.get("q") ?? "").trim();
  const filter = String(params.get("filter") ?? "all");

  try {
    const rows = await fetchAllListings();

    // WingSM eşleşmesi: önce elle yapılan/onaylanan, yoksa WingSM barkod alanındaki HB SKU, yoksa stok kodu = MalKod.
    let matchError: string | null = null;
    const manual = new Map<string, string>();
    const manualSource = new Map<string, string>();
    let wing = new Map<string, WingProduct>();
    let bySku = new Map<string, WingProduct>();

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
      bySku = await wingProductsByHbSku(pool, skus);
    } catch (error) {
      matchError = error instanceof Error ? error.message : String(error);
    }

    const all = rows.map((row) => {
      const hbSku = String(row?.hepsiburadaSku ?? "");
      const merchantSku = String(row?.merchantSku ?? "").trim();
      const manualCode = manual.get(hbSku) ?? null;
      const skuMatch = !manualCode ? bySku.get(hbSku) ?? null : null;
      const malKod = manualCode ?? (skuMatch ? String(skuMatch.mal_kod) : wing.has(merchantSku) ? merchantSku : null);
      const product = skuMatch ?? (malKod ? wing.get(malKod) ?? null : null);

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
        productName: product?.mal_ad || null,
        wingClass: product?.sinif ?? null,
        wingStock: malKod ? product?.adet ?? 0 : null,
      };
    });

    // Sayaçlar (filtre düğmeleri için; arama uygulanmadan tüm ürünler üzerinden)
    const counts = {
      all: all.length,
      salable: all.filter((row) => row.isSalable === true).length,
      soldout: all.filter((row) => Number(row.availableStock ?? 0) === 0).length,
      matched: all.filter((row) => row.malKod).length,
      unmatched: all.filter((row) => !row.malKod).length,
    };

    const filtered = all.filter((row) => {
      if (filter === "salable" && row.isSalable !== true) return false;
      if (filter === "soldout" && Number(row.availableStock ?? 0) !== 0) return false;
      if (filter === "matched" && !row.malKod) return false;
      if (filter === "unmatched" && row.malKod) return false;

      if (!q) return true;

      const haystack = fold([row.productName, row.hepsiburadaSku, row.merchantSku, row.malKod].filter(Boolean).join(" "));

      return q.split(/\s+/).every((word) => haystack.includes(word));
    });

    return json({
      success: true,
      totalCount: filtered.length,
      allCount: all.length,
      counts,
      offset,
      limit,
      matchError,
      rows: filtered.slice(offset, offset + limit),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Hepsiburada ürünleri alınamadı." }, 200);
  }
}
