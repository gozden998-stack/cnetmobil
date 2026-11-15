// app/api/online/hepsiburada/open/route.ts
//
// CNETMOBIL - WingSM sıfır ürünü Hepsiburada'ya AÇ (hızlı ürün ekleme)
//
// POST { malKod, price, stock, confirm: true }
//   malKod WingSM sıfır stokta olmalı ve barkodu geçerli olmalı. price/stock verilmezse WingSM satış fiyatı / toplam stok.
//   confirm:true zorunludur (yanlışlıkla çağrılmasın). Her gönderim hepsiburada_open_log'a yazılır.
// GET ?trackingId=...  -> hızlı eklemenin sonucunu Hepsiburada'dan sorgular (salt okunur).
// SADECE YÖNETİCİ. Bu uç Hepsiburada'da GERÇEK ürün açar; bir seferde TEK ürün.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { ensureHepsiburadaMapTable } from "@/app/lib/hepsiburada/map";
import { fastListingStatus, openOnHepsiburada } from "@/app/lib/hepsiburada/open";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const malKod = String(body?.malKod ?? "").trim();

  if (body?.confirm !== true) return json({ success: false, error: "Onay (confirm) gerekli." }, 400);
  if (!malKod) return json({ success: false, error: "malKod zorunludur." }, 400);

  try {
    const pool = getPool();

    await ensureHepsiburadaMapTable(pool);

    const product = await pool.query(
      `SELECT max(mal_ad) AS mal_ad, max(barkod) AS barkod, max(satis_fiyat) AS satis_fiyat, sum(miktar)::int AS adet, max(hb_sku) AS hb_sku
       FROM public.sifir_stock WHERE mal_kod = $1`,
      [malKod]
    );
    const row = product.rows[0];

    if (!row || !row.mal_ad) return json({ success: false, error: "Ürün WingSM sıfır stokta bulunamadı." }, 400);
    // Hepsiburada SKU: istekte verilmediyse WingSM barkod alanına yazılmış SKU (varsa) kullanılır.
    const hbSku = String(body?.hbSku ?? "").trim() || String(row.hb_sku ?? "").trim();
    // Deneme için barkod biçimi elle verilebilir (ör. 14 haneli: başına 0 eklenmiş). Verilmezse WingSM barkodu kullanılır.
    const barcode = String(body?.barcode ?? "").trim() || String(row.barkod ?? "");

    // Barkod yoksa yalnızca Hepsiburada SKU ile açılabilir.
    if (!barcode && !hbSku) return json({ success: false, error: "Bu ürünün WingSM'de barkodu yok. Hepsiburada SKU (HBCV...) girerek açabilirsiniz." }, 400);

    const price = body?.price === undefined || body?.price === "" ? Number(row.satis_fiyat) : Number(body.price);
    const stock = body?.stock === undefined || body?.stock === "" ? Number(row.adet) : Number(body.stock);

    const result = await openOnHepsiburada(pool, { malKod, productName: String(row.mal_ad), barcode, stock, price, hbSku });

    return json({ success: result.ok, ...result, sent: { malKod, barcode, hbSku: hbSku || null, price, stock } });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Ürün açılamadı." }, 200);
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const trackingId = String(request.nextUrl.searchParams.get("trackingId") ?? "").trim();

  if (!trackingId) return json({ success: false, error: "trackingId zorunludur." }, 400);

  try {
    return json({ success: true, ...(await fastListingStatus(trackingId)) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Durum sorgulanamadı." }, 200);
  }
}
