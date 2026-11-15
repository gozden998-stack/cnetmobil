// app/api/online/hepsiburada/open-candidates/route.ts
//
// CNETMOBIL - Hepsiburada'ya AÇILABİLECEK WingSM sıfır ürünler (SALT OKUNUR ÖNİZLEME)
//
// GET ?q=iphone&sinif=1el&onlyBarcode=1&offset=0&limit=50
//   WingSM sıfır stoktaki (sifir_stock) ürünleri, tüm depoların toplam stoğuyla, barkodu ve WingSM satış fiyatıyla
//   listeler. "opened": ürün Hepsiburada'da zaten var (elle/otomatik eşleşmiş ya da stok kodu = MalKod).
// Hiçbir şey gönderilmez/yazılmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { HEPSIBURADA_LISTING_BASE, getHepsiburadaConfig, hepsiburadaFetch } from "@/app/lib/hepsiburada/server";
import { ensureHepsiburadaMapTable } from "@/app/lib/hepsiburada/map";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Hepsiburada'daki tüm listing stok kodları (sayfa sayfa). Alınamazsa boş küme: opened yalnız eşleşme tablosundan hesaplanır.
async function hepsiburadaMerchantSkus(): Promise<{ skus: Set<string>; error: string | null }> {
  const skus = new Set<string>();

  if (!getHepsiburadaConfig()) return { skus, error: "Hepsiburada ortam değişkenleri eksik." };

  try {
    for (let offset = 0; offset < 3000; offset += 100) {
      const result = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, "/listings/merchantid/{merchantId}", { query: { offset, limit: 100 } });

      if (!result.ok) return { skus, error: `Hepsiburada HTTP ${result.status}` };

      const rows: any[] = Array.isArray(result.body?.listings) ? result.body.listings : [];

      for (const row of rows) {
        const sku = String(row?.merchantSku ?? "").trim();

        if (sku) skus.add(sku);
      }

      if (rows.length < 100) break;
    }

    return { skus, error: null };
  } catch (error) {
    return { skus, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const params = request.nextUrl.searchParams;
  const q = String(params.get("q") ?? "").trim().split(/\s+/).join(" ");
  const sinif = String(params.get("sinif") ?? "").trim().toLocaleLowerCase("tr-TR");
  const onlyBarcode = params.get("onlyBarcode") === "1";
  const offset = Math.max(0, Math.trunc(Number(params.get("offset")) || 0));
  const limit = Math.min(100, Math.max(1, Math.trunc(Number(params.get("limit")) || 50)));

  try {
    const pool = getPool();

    await ensureHepsiburadaMapTable(pool);

    const args: unknown[] = [];
    const where: string[] = [];

    for (const word of q.split(" ").filter(Boolean).slice(0, 6)) {
      args.push(`%${word.split("%").join("").split("_").join("")}%`);
      where.push(`(mal_ad ILIKE $${args.length} OR mal_kod ILIKE $${args.length})`);
    }

    if (sinif) {
      args.push(sinif);
      where.push(`sinif = $${args.length}`);
    }

    const having = onlyBarcode ? `HAVING max(barkod) <> ''` : "";
    const base = `
      SELECT mal_kod, max(mal_ad) AS mal_ad, max(sinif) AS sinif, sum(miktar)::int AS adet, count(*)::int AS depo_sayisi,
             max(barkod) AS barkod, max(satis_fiyat) AS satis_fiyat, max(kdv) AS kdv
      FROM public.sifir_stock ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      GROUP BY mal_kod ${having}`;

    const [totals, page, mapped, hb] = await Promise.all([
      pool.query(`SELECT count(*)::int AS urun, count(*) FILTER (WHERE barkod <> '')::int AS barkodlu FROM (${base}) t`, args),
      pool.query(`SELECT * FROM (${base}) t ORDER BY (sinif = '1el') DESC, adet DESC LIMIT ${limit} OFFSET ${offset}`, args),
      pool.query(`SELECT mal_kod FROM public.hepsiburada_sku_map`),
      hepsiburadaMerchantSkus(),
    ]);

    const opened = new Set<string>(mapped.rows.map((row) => String(row.mal_kod)));

    return json({
      success: true,
      hepsiburadaError: hb.error,
      totalCount: Number(totals.rows[0]?.urun ?? 0),
      barcodedCount: Number(totals.rows[0]?.barkodlu ?? 0),
      offset,
      limit,
      rows: page.rows.map((row) => ({
        malKod: row.mal_kod,
        malAd: row.mal_ad,
        sinif: row.sinif,
        adet: row.adet,
        depoSayisi: row.depo_sayisi,
        barkod: row.barkod || null,
        satisFiyat: row.satis_fiyat === null ? null : Number(row.satis_fiyat),
        kdv: row.kdv === null ? null : Number(row.kdv),
        opened: opened.has(String(row.mal_kod)) || hb.skus.has(String(row.mal_kod)),
      })),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Aday listesi alınamadı." }, 200);
  }
}
