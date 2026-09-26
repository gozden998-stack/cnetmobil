// app/api/admin/dealer-orders/route.ts
//
// Yonetici TUM bayi siparislerini gorur. Odeme durumu, bayi GET
// endpoint'indeki gibi paratika_payments'tan tembel senkronize edilir.

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

export async function GET(request: NextRequest) {
  try {
    const session = await getAuctionSession(request);
    ensureManager(session);

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const ordersResult = await client.query(
        `
          SELECT
            o.id, o.dealer_id, o.status, o.total_base_amount, o.total_sale_amount,
            o.commission_amount, o.tracking_no, o.created_at, o.paid_at, o.shipped_at,
            d.company_name, d.email AS dealer_email,
            p.status AS paratika_status
          FROM public.dealer_orders o
          JOIN public.dealers d ON d.id = o.dealer_id
          LEFT JOIN public.paratika_payments p ON p.id = o.paratika_payment_id
          ORDER BY o.created_at DESC
          LIMIT 500
        `
      );

      const toSync = ordersResult.rows.filter(
        (row) =>
          row.status === "AWAITING_PAYMENT" && row.paratika_status === "APPROVED"
      );

      for (const row of toSync) {
        await client.query(
          `UPDATE public.dealer_orders SET status = 'PAID', paid_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [row.id]
        );
        row.status = "PAID";
      }

      const orderIds = ordersResult.rows.map((row) => Number(row.id));

      const itemsResult = orderIds.length
        ? await client.query(
            `
              SELECT order_id, item_name_snapshot, base_price_snapshot, sale_price, quantity
              FROM public.dealer_order_items
              WHERE order_id = ANY($1::int[])
            `,
            [orderIds]
          )
        : { rows: [] as any[] };

      const itemsByOrder = new Map<number, any[]>();

      for (const item of itemsResult.rows) {
        const key = Number(item.order_id);
        if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
        itemsByOrder.get(key)!.push({
          itemName: String(item.item_name_snapshot),
          basePrice: Number(item.base_price_snapshot),
          salePrice: Number(item.sale_price),
          quantity: Number(item.quantity),
        });
      }

      const orders = ordersResult.rows.map((row) => ({
        id: Number(row.id),
        dealerId: Number(row.dealer_id),
        companyName: String(row.company_name),
        dealerEmail: String(row.dealer_email),
        status: String(row.status),
        totalBaseAmount: Number(row.total_base_amount),
        totalSaleAmount: Number(row.total_sale_amount),
        commissionAmount: Number(row.commission_amount),
        trackingNo: row.tracking_no ? String(row.tracking_no) : "",
        createdAt: row.created_at,
        paidAt: row.paid_at,
        shippedAt: row.shipped_at,
        items: itemsByOrder.get(Number(row.id)) || [],
      }));

      return json({ ok: true, orders });
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
