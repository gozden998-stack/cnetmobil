// app/api/dealer/catalog/route.ts
//
// Bayinin gordugu aktif katalog - sadece is_active=TRUE ve stogu
// olan urunler.

import { NextRequest, NextResponse } from "next/server";

import {
  ensureDealerTables,
  getDealerPool,
  requireDealerActor,
} from "@/app/lib/dealer/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireDealerActor(request);

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const result = await client.query(
        `
          SELECT id, brand_model, memory, color, grade, base_price,
                 stock_quantity, image_url
          FROM public.dealer_catalog_items
          WHERE is_active = TRUE AND stock_quantity > 0
          ORDER BY brand_model ASC
        `
      );

      const items = result.rows.map((row) => ({
        id: Number(row.id),
        brandModel: String(row.brand_model),
        memory: row.memory ? String(row.memory) : "",
        color: row.color ? String(row.color) : "",
        grade: row.grade ? String(row.grade) : "",
        basePrice: Number(row.base_price),
        stockQuantity: Number(row.stock_quantity),
        imageUrl: row.image_url ? String(row.image_url) : "",
      }));

      return json({ ok: true, items });
    } finally {
      client.release();
    }
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as any).status) || 500
        : 500;

    return json(
      { ok: false, error: error instanceof Error ? error.message : "Hata" },
      status
    );
  }
}
