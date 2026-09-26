// app/api/dealer/orders/[id]/route.ts
//
// Bayinin KENDI siparişinin detayi - checkout/odeme sayfasi icin.
// Odeme hala AWAITING_PAYMENT ise, Paratika Direct POST 3D formunun
// action URL'ini kurmak icin gereken sessionToken da donuyor.
// (bkz. app/lib/dealer/paratika.ts - ayni sessionToken hem Barindirilan
// Odeme Sayfasi hem Direct POST 3D icin kullanilabiliyor, Paratika'nin
// resmi API&HPP URLs bolumune gore.)

import { NextRequest, NextResponse } from "next/server";

import {
  ensureDealerTables,
  getDealerPool,
  requireDealerActor,
} from "@/app/lib/dealer/server";
import { buildDealerSale3DUrl, getDealerParatikaConfig } from "@/app/lib/dealer/paratika";

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireDealerActor(request);

    const { id: idParam } = await context.params;
    const id = parseId(idParam);

    if (!id) {
      return json({ ok: false, error: "Geçersiz sipariş." }, 400);
    }

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const orderResult = await client.query(
        `
          SELECT
            o.id, o.dealer_id, o.status, o.total_sale_amount, o.created_at,
            p.session_token, p.status AS paratika_status
          FROM public.dealer_orders o
          LEFT JOIN public.paratika_payments p ON p.id = o.paratika_payment_id
          WHERE o.id = $1 AND o.dealer_id = $2
          LIMIT 1
        `,
        [id, actor.dealerId]
      );

      const order = orderResult.rows[0];

      if (!order) {
        return json({ ok: false, error: "Sipariş bulunamadı." }, 404);
      }

      // Paratika arka planda onaylamis olabilir - tembel senkron.
      let status = String(order.status);
      if (status === "AWAITING_PAYMENT" && order.paratika_status === "APPROVED") {
        await client.query(
          `UPDATE public.dealer_orders SET status = 'PAID', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [id]
        );
        status = "PAID";
      }

      const itemsResult = await client.query(
        `
          SELECT item_name_snapshot, sale_price, quantity
          FROM public.dealer_order_items
          WHERE order_id = $1
        `,
        [id]
      );

      const items = itemsResult.rows.map((row) => ({
        itemName: String(row.item_name_snapshot),
        salePrice: Number(row.sale_price),
        quantity: Number(row.quantity),
      }));

      const canPay = status === "AWAITING_PAYMENT" && Boolean(order.session_token);

      let sale3dUrl: string | null = null;

      if (canPay) {
        const config = getDealerParatikaConfig();
        sale3dUrl = buildDealerSale3DUrl(config.baseUrl, String(order.session_token));
      }

      return json({
        ok: true,
        order: {
          id: Number(order.id),
          status,
          totalSaleAmount: Number(order.total_sale_amount),
          createdAt: order.created_at,
          items,
          companyName: actor.companyName,
          email: actor.email,
          sale3dUrl,
        },
      });
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
