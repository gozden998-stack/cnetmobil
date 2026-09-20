// app/api/online/idefix/n11-candidates/route.ts
// CNETMOBIL - N11 -> IDEFIX "TASIMA ADAYLARI" (salt okunur)
//
// "N11'deki aktif urunleri Idefix'e tasi" ekraninin veri kaynagi.
// Bu route SADECE public.online_listings'i OKUR, hicbir INSERT/UPDATE/DELETE
// yapmaz. Idefix'e gonderme islemi client tarafindan mevcut
// /api/online/idefix/create-device POST endpoint'i cagrilarak yapilir
// (bu dosya o akisi hic tetiklemez, sadece aday listesini uretir).
//
// Aday kriterleri:
// 1) N11'de gercekten "satista" olan ilan: external_product_id dolu VE
//    sync_status = SYNCED VE product_status = ACTIVE VE sale_status = ON_SALE
//    VE quantity > 0. (Online.tsx -> isTrueN11OnSale ile BIREBIR ayni kural,
//    sadece SQL tarafinda UPPER() ile case-insensitive uygulanir.)
// 2) Tekil cihaz / IMEI bazli N11 ilani: external_stock_code TAM 15 haneli
//    rakam (^[0-9]{15}$). Havuz/coklu-IMEI (Merkez -> pool -> N11 toplu
//    ice aktarma) ilanlari bu regex'e uymadigi icin otomatik elenir.
// 3) Bu IMEI icin daha once acilmis bir Idefix ilani YOK: online_listings
//    icinde channel = 'IDEFIX' AND raw_data->>'sourceImei' = <imei> eslesmesi
//    aranmaz (create-device'in kendi duplicate-guard'iyla ayni anahtar).

import { NextRequest } from "next/server";

import {
  getIdefixDbPool,
  noStoreJson,
  requireIdefixSuperAdmin,
} from "@/app/lib/idefix/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const authError = await requireIdefixSuperAdmin(request);

  if (authError) {
    return authError;
  }

  try {
    const url = new URL(request.url);
    const rawLimit = Number(url.searchParams.get("limit"));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(Math.trunc(rawLimit), 1000)
        : 500;

    const pool = getIdefixDbPool();

    const result = await pool.query(
      `
        SELECT
          n11.id,
          n11.external_stock_code AS imei,
          n11.brand,
          n11.model,
          n11.memory,
          n11.color,
          n11.grade,
          n11.warranty,
          n11.sale_price,
          n11.list_price,
          n11.title,
          n11.updated_at
        FROM public.online_listings n11
        WHERE n11.channel = 'N11'
          AND n11.external_product_id IS NOT NULL
          AND UPPER(COALESCE(n11.sync_status, '')) = 'SYNCED'
          AND UPPER(COALESCE(n11.product_status, '')) = 'ACTIVE'
          AND UPPER(COALESCE(n11.sale_status, '')) = 'ON_SALE'
          AND COALESCE(n11.quantity, 0) > 0
          AND n11.external_stock_code ~ '^[0-9]{15}$'
          AND NOT EXISTS (
            SELECT 1
            FROM public.online_listings idf
            WHERE idf.channel = 'IDEFIX'
              AND idf.raw_data ->> 'sourceImei' = n11.external_stock_code
          )
        ORDER BY n11.updated_at DESC, n11.id DESC
        LIMIT $1
      `,
      [limit]
    );

    const candidates = result.rows.map((row: any) => ({
      listingId: Number(row.id),
      imei: text(row.imei),
      brand: text(row.brand),
      model: text(row.model),
      memory: text(row.memory),
      color: text(row.color),
      grade: text(row.grade),
      warranty: text(row.warranty),
      title: text(row.title),
      n11SalePrice: row.sale_price === null ? null : Number(row.sale_price),
      n11ListPrice: row.list_price === null ? null : Number(row.list_price),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    }));

    return noStoreJson({
      success: true,
      totalCount: candidates.length,
      candidates,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("IDEFIX N11 CANDIDATES ERROR:", error);

    return noStoreJson(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "N11 tasima adaylari alinamadi.",
      },
      500
    );
  }
}
