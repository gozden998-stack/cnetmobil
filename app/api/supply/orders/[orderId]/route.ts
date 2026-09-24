// app/api/supply/orders/[orderId]/route.ts
//
// "Mağaza Tedarik" - yönetici bir mağaza siparişinin durumunu
// (BEKLEMEDE -> HAZIRLANIYOR -> GÖNDERİLDİ) ilerletir/geri alır.

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

function parseId(value: string) {
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
    const status = (body as any)?.status;

    if (!isValidSupplyOrderStatus(status)) {
      return json({ ok: false, error: "Geçersiz durum." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const result = await client.query(
        `
          UPDATE public.supply_orders
          SET status = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [orderId, status]
      );

      if (!result.rowCount) {
        return json({ ok: false, error: "Sipariş bulunamadı." }, 404);
      }

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
