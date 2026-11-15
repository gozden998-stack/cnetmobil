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
      `SELECT max(mal_ad) AS mal_ad, max(barkod) AS barkod, max(satis_fiyat) AS satis_fiyat, sum(miktar)::int AS adet
       FROM public.sifir_stock WHERE mal_kod = $1`,
      [malKod]
    );
    const row = product.rows[0];

    if (!row || !row.mal_ad) return json({ success: false, error: "Ürün WingSM sıfır stokta bulunamadı." }, 400);
    if (!row.barkod) return json({ success: false, error: "Bu ürünün WingSM'de barkodu yok." }, 400);

    const price = body?.price === undefined || body?.price === "" ? Number(row.satis_fiyat) : Number(body.price);
    const stock = body?.stock === undefined || body?.stock === "" ? Number(row.adet) : Number(body.stock);

    const result = await openOnHepsiburada(pool, { malKod, productName: String(row.mal_ad), barcode: String(row.barkod), stock, price });

    return json({ success: result.ok, ...result, sent: { malKod, barcode: row.barkod, price, stock } });
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
