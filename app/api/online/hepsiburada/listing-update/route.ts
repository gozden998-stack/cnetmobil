// app/api/online/hepsiburada/listing-update/route.ts
//
// CNETMOBIL - Hepsiburada tek ürün elle stok / fiyat güncelleme
//
// POST { hbSku, merchantSku?, stock?, price? }  (yönetici)
//   stock: Hepsiburada'daki satış stoğu (artırma dahil). WingSM'e eşleşmiş üründe WingSM toplam stoğunu AŞAMAZ.
//   price: satış fiyatı (TL).
// Hepsiburada'ya POST /listings/merchantid/{id}/stock-uploads ve/veya /price-uploads gönderir (yüklemeler eşzamansızdır;
// yükleme durumu ayrıca sorgulanır ve döndürülür). WingSM'e bir şey yazılmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { HEPSIBURADA_LISTING_BASE, getHepsiburadaConfig, hepsiburadaFetch } from "@/app/lib/hepsiburada/server";
import { ensureHepsiburadaMapTable, wingProductsByCode, wingProductsByHbSku } from "@/app/lib/hepsiburada/map";
import { ensureStockSyncTables } from "@/app/lib/hepsiburada/stock-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function uploadStatus(kind: "stock" | "price", id: string) {
  await sleep(1500);

  const result = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, `/listings/merchantid/{merchantId}/${kind}-uploads/id/${encodeURIComponent(id)}`, {});

  return { http: result.status, text: result.raw.slice(0, 400) };
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  if (!getHepsiburadaConfig()) return json({ success: false, error: "Hepsiburada ortam değişkenleri eksik." }, 200);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const hbSku = String(body?.hbSku ?? "").trim();
  const hasStock = body?.stock !== undefined && body?.stock !== null && String(body.stock).trim() !== "";
  const hasPrice = body?.price !== undefined && body?.price !== null && String(body.price).trim() !== "";

  if (!hbSku || !/^[A-Za-z0-9_-]+$/.test(hbSku)) return json({ success: false, error: "Hepsiburada SKU geçersiz." }, 400);
  if (!hasStock && !hasPrice) return json({ success: false, error: "Stok ya da fiyat girin." }, 400);

  const stock = hasStock ? Number(String(body?.stock).replace(",", ".")) : null;
  const price = hasPrice ? Number(String(body?.price).replace(",", ".")) : null;

  if (stock !== null && (!Number.isInteger(stock) || stock < 0 || stock > 10000)) return json({ success: false, error: "Stok 0 ile 10000 arasında tam sayı olmalı." }, 400);
  if (price !== null && (!Number.isFinite(price) || price <= 0 || price > 10000000)) return json({ success: false, error: "Fiyat 0'dan büyük olmalı." }, 400);

  try {
    const pool = getPool();

    await ensureStockSyncTables(pool);
    await ensureHepsiburadaMapTable(pool);

    // Stok yükseltme sınırı: eşleşmiş üründe WingSM toplam stoğunu aşamaz (olmayan stok satılmasın).
    if (stock !== null) {
      const merchantSku = String(body?.merchantSku ?? "").trim();
      const manual = await pool.query(`SELECT mal_kod FROM public.hepsiburada_sku_map WHERE hb_sku = $1`, [hbSku]);
      const manualCode = manual.rows[0]?.mal_kod ? String(manual.rows[0].mal_kod) : null;
      const bySku = (await wingProductsByHbSku(pool, [hbSku])).get(hbSku) ?? null;
      const codes = [manualCode, merchantSku].filter(Boolean) as string[];
      const byCode = codes.length ? await wingProductsByCode(pool, codes) : new Map();
      const product = bySku ?? (manualCode ? byCode.get(manualCode) ?? null : merchantSku ? byCode.get(merchantSku) ?? null : null);
      const matched = Boolean(bySku || manualCode || product);

      if (matched) {
        const wing = product?.adet ?? 0;

        if (stock > wing) return json({ success: false, error: `WingSM toplam stoğu ${wing}; Hepsiburada stoğu bundan fazla olamaz.` }, 200);
      }
    }

    const out: Record<string, unknown> = { success: true };

    if (stock !== null) {
      const result = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, "/listings/merchantid/{merchantId}/stock-uploads", { method: "POST", body: [{ hepsiburadaSku: hbSku, availableStock: stock }] });

      if (!result.ok) return json({ success: false, error: `Stok yükleme HTTP ${result.status}: ${result.raw.slice(0, 300)}` }, 200);

      const id = String(result.body?.id ?? result.body?.uploadId ?? "").trim();

      out.stockUploadId = id || null;
      out.stockStatus = id ? await uploadStatus("stock", id) : null;
    }

    if (price !== null) {
      const result = await hepsiburadaFetch(HEPSIBURADA_LISTING_BASE, "/listings/merchantid/{merchantId}/price-uploads", { method: "POST", body: [{ hepsiburadaSku: hbSku, price }] });

      if (!result.ok) return json({ success: false, error: `Fiyat yükleme HTTP ${result.status}: ${result.raw.slice(0, 300)}`, ...out }, 200);

      const id = String(result.body?.id ?? result.body?.uploadId ?? "").trim();

      out.priceUploadId = id || null;
      out.priceStatus = id ? await uploadStatus("price", id) : null;
    }

    await pool.query(`INSERT INTO public.hepsiburada_stock_log (mode, changes, sent, upload_ids, detail) VALUES ('MANUAL', 1, 1, $1, $2)`, [
      [out.stockUploadId, out.priceUploadId].filter(Boolean).join(","),
      `${hbSku}: ${stock !== null ? `stok=${stock}` : ""} ${price !== null ? `fiyat=${price}` : ""}`.trim(),
    ]);

    return json(out);
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Güncellenemedi." }, 200);
  }
}
