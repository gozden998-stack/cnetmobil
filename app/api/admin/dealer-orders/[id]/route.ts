// app/api/admin/dealer-orders/[id]/route.ts
//
// Yonetici bir bayi siparisini PREPARING/SHIPPED yapar (kargo takip
// no ile) veya iptal eder.

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

const VALID_ACTIONS = new Set(["PREPARING", "SHIPPED", "CANCEL"]);

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
      return json({ ok: false, error: "Geçersiz sipariş." }, 400);
    }

    const body = await request.json().catch(() => null);
    const action = String((body as any)?.action || "").toUpperCase();
    const trackingNo = String((body as any)?.trackingNo || "").trim();

    if (!VALID_ACTIONS.has(action)) {
      return json({ ok: false, error: "Geçersiz işlem." }, 400);
    }

    if (action === "SHIPPED" && !trackingNo) {
      return json({ ok: false, error: "Kargo takip numarası gerekli." }, 400);
    }

    const pool = getDealerPool();
    const client = await pool.connect();

    try {
      await ensureDealerTables(client);

      const orderResult = await client.query(
        `SELECT id, status FROM public.dealer_orders WHERE id = $1 LIMIT 1`,
        [id]
      );

      const order = orderResult.rows[0];

      if (!order) {
        return json({ ok: false, error: "Sipariş bulunamadı." }, 404);
      }

      const currentStatus = String(order.status);

      if (action === "PREPARING") {
        if (currentStatus !== "PAID") {
          return json(
            { ok: false, error: "Sadece ödemesi tamamlanmış siparişler hazırlanabilir." },
            409
          );
        }

        await client.query(
          `UPDATE public.dealer_orders SET status = 'PREPARING', prepared_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [id]
        );
      }

      if (action === "SHIPPED") {
        if (!["PAID", "PREPARING"].includes(currentStatus)) {
          return json(
            { ok: false, error: "Bu sipariş kargoya verilebilir durumda değil." },
            409
          );
        }

        await client.query(
          `UPDATE public.dealer_orders SET status = 'SHIPPED', tracking_no = $2, shipped_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [id, trackingNo]
        );
      }

      if (action === "CANCEL") {
        // Sadece ODENMEMIS siparisler buradan iptal edilebilir. Odemesi
        // alinmis (PAID/PREPARING/SHIPPED) bir siparisi iptal etmek
        // gercek parayi otomatik iade ETMEZ - bu Paratika'da ayri bir
        // manuel iade islemi gerektirir, kazayla "iptal" deyip paranin
        // iade edildigi yanilgisina dusulmesin diye burada kasitli
        // olarak engellendi.
        if (currentStatus !== "AWAITING_PAYMENT") {
          return json(
            {
              ok: false,
              error:
                "Ödemesi alınmış bir sipariş buradan iptal edilemez - önce Paratika üzerinden manuel iade yapılmalı.",
            },
            409
          );
        }

        await client.query("BEGIN");

        try {
          const items = await client.query(
            `SELECT catalog_item_id, quantity FROM public.dealer_order_items WHERE order_id = $1`,
            [id]
          );

          for (const item of items.rows) {
            if (!item.catalog_item_id) continue;

            await client.query(
              `UPDATE public.dealer_catalog_items SET stock_quantity = stock_quantity + $2, updated_at = NOW() WHERE id = $1`,
              [item.catalog_item_id, item.quantity]
            );
          }

          await client.query(
            `UPDATE public.dealer_orders SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [id]
          );

          await client.query("COMMIT");
        } catch (transactionError) {
          await client.query("ROLLBACK");
          throw transactionError;
        }
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
