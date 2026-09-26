// app/api/admin/dealer-catalog/[id]/route.ts
//
// "Bayi Portali" - yonetici katalog urununu duzenler (fiyat, stok,
// aktif/pasif). Fiziksel silme yok - gecmis siparislerde referans
// olarak kalabilir.

import { NextRequest, NextResponse } from "next/server";

import { getAuctionSession } from "../../../auctions/_server";
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

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuctionSession(request);
    ensureManager(session);

    const { id: idParam } = await context.params;
    const id = parseId(idParam);

    if (!id) {
      return json({ ok: false, error: "Geçersiz ürün." }, 400);
    }

    const body = await request.json().catch(() => null);

    const updates: string[] = [];
    const values: unknown[] = [id];

    if (typeof (body as any)?.isActive === "boolean") {
      values.push((body as any).isActive);
      updates.push(`is_active = $${values.length}`);
    }

    if ((body as any)?.basePrice !== undefined) {
      const basePrice = Number((body as any).basePrice);

      if (!Number.isFinite(basePrice) || basePrice <= 0) {
        return json({ ok: false, error: "Geçerli bir temel fiyat girin." }, 400);
      }

      values.push(Math.round(basePrice * 100) / 100);
      updates.push(`base_price = $${values.length}`);
    }

    if ((body as any)?.stockQuantity !== undefined) {
      const stockQuantity = Number((body as any).stockQuantity);

      if (!Number.isInteger(stockQuantity) || stockQuantity < 0) {
        return json({ ok: false, error: "Geçerli bir stok adedi girin." }, 400);
      }

      values.push(stockQuantity);
      updates.push(`stock_quantity = $${values.length}`);
    }

    if (typeof (body as any)?.imageUrl === "string") {
      const imageUrl = (body as any).imageUrl.trim();
      values.push(imageUrl || null);
      updates.push(`image_url = $${values.length}`);
    }

    if (!updates.length) {
      return json({ ok: false, error: "Güncellenecek alan yok." }, 400);
    }

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const result = await client.query(
        `
          UPDATE public.dealer_catalog_items
          SET ${updates.join(", ")}, updated_at = NOW()
          WHERE id = $1
        `,
        values
      );

      if (!result.rowCount) {
        return json({ ok: false, error: "Ürün bulunamadı." }, 404);
      }

      return json({ ok: true });
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
