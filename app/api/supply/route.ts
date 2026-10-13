// app/api/supply/route.ts
//
// "Mağaza Tedarik" - dönem YOK: her gün her saat sipariş geçilebilir.
//   GET  ?gun=30  -> oturumun görebildiği siparişler (bekleyenler her zaman,
//                    gönderilenler son N gün) + rapor için kalem detayı.
//   POST          -> bir mağaza sepetindeki ürünleri YENİ bir sipariş olarak
//                    gönderir (her gönderim bağımsız bir sipariştir).

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  ensureRequestChannel,
  ensureSupplyTables,
  getSupplyPool,
  getSupplySession,
  resolveRequestShopName,
} from "./_server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_DAYS = 30;
const MAX_DAYS = 365;
const MAX_ROWS = 5000;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function sameShop(a: string, b: string) {
  return a.toLocaleUpperCase("tr-TR") === b.toLocaleUpperCase("tr-TR");
}

type OrderItemOut = {
  itemId: number;
  itemName: string;
  itemNote: string;
  quantity: number;
  deliveredQuantity: number | null;
};

type OrderOut = {
  id: number;
  shopName: string;
  status: string;
  submittedByName: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItemOut[];
};

export async function GET(request: NextRequest) {
  try {
    const session = await getSupplySession(request);
    ensureRequestChannel(session);

    const rawDays = Number(request.nextUrl.searchParams.get("gun"));
    const days =
      Number.isInteger(rawDays) && rawDays > 0
        ? Math.min(rawDays, MAX_DAYS)
        : DEFAULT_DAYS;

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const result = await client.query(
        `
          SELECT
            o.id, o.shop_name, o.status, o.submitted_by_name, o.created_at, o.updated_at,
            i.item_id, i.quantity, i.delivered_quantity,
            c.item_name, c.item_note
          FROM public.supply_shop_orders o
          JOIN public.supply_shop_order_items i ON i.order_id = o.id
          JOIN public.supply_catalog_items c ON c.id = i.item_id
          WHERE o.status <> 'GONDERILDI'
             OR o.created_at >= NOW() - ($1::int * INTERVAL '1 day')
          ORDER BY o.created_at DESC, o.id DESC, c.item_name ASC
          LIMIT ${MAX_ROWS}
        `,
        [days]
      );

      const canSeeAll = session.isManager || session.channel === "VODAFONE";
      const ordersById = new Map<number, OrderOut>();

      for (const row of result.rows) {
        const shopName = String(row.shop_name);

        if (!canSeeAll && !sameShop(shopName, session.branch)) continue;

        const orderId = Number(row.id);
        let order = ordersById.get(orderId);

        if (!order) {
          order = {
            id: orderId,
            shopName,
            status: String(row.status),
            submittedByName: row.submitted_by_name
              ? String(row.submitted_by_name)
              : "",
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            items: [],
          };
          ordersById.set(orderId, order);
        }

        order.items.push({
          itemId: Number(row.item_id),
          itemName: String(row.item_name),
          itemNote: row.item_note ? String(row.item_note) : "",
          quantity: Number(row.quantity),
          deliveredQuantity:
            row.delivered_quantity === null ||
            row.delivered_quantity === undefined
              ? null
              : Number(row.delivered_quantity),
        });
      }

      return json({
        ok: true,
        isManager: session.isManager,
        channel: session.channel,
        branch: session.branch,
        days,
        orders: Array.from(ordersById.values()),
      });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}

type CartItemInput = { itemId: number; quantity: number };

export async function POST(request: NextRequest) {
  try {
    const session = await getSupplySession(request);
    ensureRequestChannel(session);

    const body = await request.json().catch(() => null);
    const rawItems = Array.isArray((body as any)?.items)
      ? ((body as any).items as unknown[])
      : [];

    if (rawItems.length === 0) {
      return json({ ok: false, error: "Sepetiniz boş." }, 400);
    }

    if (rawItems.length > 200) {
      return json({ ok: false, error: "Sepette çok fazla ürün var." }, 400);
    }

    // Ayni urun iki kez gelirse adetleri toplanir (tek kalem olarak yazilir).
    const merged = new Map<number, number>();

    for (const raw of rawItems) {
      const itemId = Number((raw as any)?.itemId);
      const quantity = Number((raw as any)?.quantity);

      if (!Number.isInteger(itemId) || itemId <= 0) {
        return json({ ok: false, error: "Sepette geçersiz ürün var." }, 400);
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
        return json({ ok: false, error: "Sepette geçersiz adet var." }, 400);
      }

      merged.set(itemId, (merged.get(itemId) || 0) + quantity);
    }

    const items: CartItemInput[] = Array.from(merged.entries()).map(
      ([itemId, quantity]) => ({ itemId, quantity })
    );

    if (items.some((item) => item.quantity > 100000)) {
      return json({ ok: false, error: "Sepette geçersiz adet var." }, 400);
    }

    const shopResolution = resolveRequestShopName(
      session,
      (body as any)?.shopName
    );

    if (!shopResolution.ok) {
      return json({ ok: false, error: shopResolution.error }, 400);
    }

    const shopName = shopResolution.shopName;

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const validItemsResult = await client.query(
        `
          SELECT id FROM public.supply_catalog_items
          WHERE id = ANY($1::int[]) AND is_active = TRUE
        `,
        [items.map((item) => item.itemId)]
      );

      const validItemIds = new Set(
        validItemsResult.rows.map((row) => Number(row.id))
      );

      if (items.some((item) => !validItemIds.has(item.itemId))) {
        return json(
          {
            ok: false,
            error: "Sepetteki bazı ürünler artık aktif değil, sepeti yenileyin.",
          },
          400
        );
      }

      await client.query("BEGIN");

      try {
        const orderResult = await client.query(
          `
            INSERT INTO public.supply_shop_orders (
              shop_name, status, submitted_by_user_key, submitted_by_name
            )
            VALUES ($1, 'BEKLEMEDE', $2, $3)
            RETURNING id
          `,
          [shopName, session.userKey, session.userName]
        );

        const orderId = Number(orderResult.rows[0].id);

        for (const item of items) {
          await client.query(
            `
              INSERT INTO public.supply_shop_order_items (order_id, item_id, quantity)
              VALUES ($1, $2, $3)
            `,
            [orderId, item.itemId, item.quantity]
          );
        }

        await client.query("COMMIT");

        return json({ ok: true, orderId });
      } catch (transactionError) {
        await client.query("ROLLBACK");
        throw transactionError;
      }
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
