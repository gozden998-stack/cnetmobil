// app/api/admin/dealer-catalog/route.ts
//
// "Bayi Portali" - yonetici bayilere acilacak cihaz kataloğunu
// yonetir: marka/model, hafiza, renk, grade, TEMEL fiyat, stok.

import { NextRequest, NextResponse } from "next/server";

import { getAuctionSession } from "../../auctions/_server";
import { ensureDealerTables, getDealerPool } from "@/app/lib/dealer/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function ensureManager(session: { isManager: boolean }) {
  if (!session.isManager) {
    throw Object.assign(
      new Error("Bu işlem sadece yönetici/admin oturumu ile yapılabilir."),
      { status: 403 }
    );
  }
}

function parsePrice(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? Math.round(num * 100) / 100 : null;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAuctionSession(request);
    ensureManager(session);

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const result = await client.query(
        `
          SELECT id, brand_model, memory, color, grade, base_price,
                 stock_quantity, image_url, is_active, created_at, updated_at
          FROM public.dealer_catalog_items
          ORDER BY created_at DESC
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
        isActive: Boolean(row.is_active),
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

export async function POST(request: NextRequest) {
  try {
    const session = await getAuctionSession(request);
    ensureManager(session);

    const body = await request.json().catch(() => null);

    const brandModel = String((body as any)?.brandModel || "").trim();
    const memory = String((body as any)?.memory || "").trim();
    const color = String((body as any)?.color || "").trim();
    const grade = String((body as any)?.grade || "").trim();
    const basePrice = parsePrice((body as any)?.basePrice);
    const stockQuantity = Number((body as any)?.stockQuantity);
    const imageUrl = String((body as any)?.imageUrl || "").trim();

    if (!brandModel || brandModel.length > 200) {
      return json({ ok: false, error: "Marka/model geçersiz." }, 400);
    }

    if (basePrice === null || basePrice <= 0) {
      return json({ ok: false, error: "Geçerli bir temel fiyat girin." }, 400);
    }

    if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
      return json({ ok: false, error: "Geçerli bir stok adedi girin." }, 400);
    }

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const result = await client.query(
        `
          INSERT INTO public.dealer_catalog_items
            (brand_model, memory, color, grade, base_price, stock_quantity, image_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `,
        [
          brandModel,
          memory || null,
          color || null,
          grade || null,
          basePrice,
          stockQuantity,
          imageUrl || null,
        ]
      );

      return json({ ok: true, id: Number(result.rows[0].id) });
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
