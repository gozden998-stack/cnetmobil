// app/api/supply/orders/[orderId]/route.ts
//
// "Mağaza Tedarik" - yönetici bir siparişi yönetir:
//   PATCH { status }                        -> BEKLEMEDE / HAZIRLANIYOR / GÖNDERİLDİ
//   PATCH { itemId, deliveredQuantity }     -> kalemin fiilen gönderilen adedi
//   DELETE ?itemId=N                        -> kalemi siparişten çıkarır (son kalem
//                                              giderse sipariş de silinir)

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  ensureSupplyManager,
  ensureSupplyTables,
  getSupplyPool,
  getSupplySession,
  isValidSupplyOrderStatus,
} from "../../_server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function parseId(value: string | null) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getSupplySession(request);
    ensureSupplyManager(session);

    const { orderId: orderIdParam } = await context.params;
    const orderId = parseId(orderIdParam);

    if (!orderId) {
      return json({ ok: false, error: "Geçersiz sipariş." }, 400);
    }

    const body = await request.json().catch(() => null);

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      if ((body as any)?.status !== undefined) {
        const status = (body as any).status;

        if (!isValidSupplyOrderStatus(status)) {
          return json({ ok: false, error: "Geçersiz durum." }, 400);
        }

        const result = await client.query(
          `
            UPDATE public.supply_shop_orders
            SET status = $2, updated_at = NOW()
            WHERE id = $1
          `,
          [orderId, status]
        );

        if (!result.rowCount) {
          return json({ ok: false, error: "Sipariş bulunamadı." }, 404);
        }

        return json({ ok: true });
      }

      const itemId = parseId(String((body as any)?.itemId ?? ""));
      const deliveredQuantity = Number((body as any)?.deliveredQuantity);

      if (!itemId) {
        return json({ ok: false, error: "Geçersiz ürün." }, 400);
      }

      if (
        !Number.isInteger(deliveredQuantity) ||
        deliveredQuantity < 0 ||
        deliveredQuantity > 100000
      ) {
        return json({ ok: false, error: "Geçersiz adet." }, 400);
      }

      const result = await client.query(
        `
          UPDATE public.supply_shop_order_items
          SET delivered_quantity = $3
          WHERE order_id = $1 AND item_id = $2
        `,
        [orderId, itemId, deliveredQuantity]
      );

      if (!result.rowCount) {
        return json({ ok: false, error: "Kalem bulunamadı." }, 404);
      }

      await client.query(
        `UPDATE public.supply_shop_orders SET updated_at = NOW() WHERE id = $1`,
        [orderId]
      );

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const session = await getSupplySession(request);
    ensureSupplyManager(session);

    const { orderId: orderIdParam } = await context.params;
    const orderId = parseId(orderIdParam);
    const itemId = parseId(request.nextUrl.searchParams.get("itemId"));

    if (!orderId) {
      return json({ ok: false, error: "Geçersiz sipariş." }, 400);
    }

    if (!itemId) {
      return json({ ok: false, error: "Geçersiz ürün." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const result = await client.query(
        `
          DELETE FROM public.supply_shop_order_items
          WHERE order_id = $1 AND item_id = $2
        `,
        [orderId, itemId]
      );

      if (!result.rowCount) {
        return json({ ok: false, error: "Kalem bulunamadı." }, 404);
      }

      // Siparişte hiç kalem kalmadıysa boş siparişi de temizle.
      await client.query(
        `
          DELETE FROM public.supply_shop_orders
          WHERE id = $1
            AND NOT EXISTS (
              SELECT 1 FROM public.supply_shop_order_items WHERE order_id = $1
            )
        `,
        [orderId]
      );

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
