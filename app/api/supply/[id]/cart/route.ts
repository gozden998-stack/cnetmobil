// app/api/supply/[id]/cart/route.ts
//
// "Mağaza Tedarik" - bir mağaza sepetindeki TÜM ürünleri TEK seferde
// gönderir (online alışveriş sepeti gibi). Bu çağrı hem ilgili
// supply_requests satırlarını yazar hem de o mağaza için bir
// supply_orders kaydını BEKLEMEDE durumuna (yeniden) alır - yönetici
// panelinde "Hazırlanıyor / Gönderildi" olarak ilerletilir.

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  ensureRequestChannel,
  ensureSupplyTables,
  getSupplyPool,
  getSupplySession,
  resolveRequestShopName,
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

type CartItemInput = { itemId: number; quantity: number };

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSupplySession(request);
    ensureRequestChannel(session);

    const { id: idParam } = await context.params;
    const periodId = parseId(idParam);

    if (!periodId) {
      return json({ ok: false, error: "Geçersiz dönem." }, 400);
    }

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

    const items: CartItemInput[] = [];

    for (const raw of rawItems) {
      const itemId = Number((raw as any)?.itemId);
      const quantity = Number((raw as any)?.quantity);

      if (!Number.isInteger(itemId) || itemId <= 0) {
        return json({ ok: false, error: "Sepette geçersiz ürün var." }, 400);
      }

      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
        return json({ ok: false, error: "Sepette geçersiz adet var." }, 400);
      }

      items.push({ itemId, quantity });
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

      const periodResult = await client.query(
        `SELECT status FROM public.supply_periods WHERE id = $1 LIMIT 1`,
        [periodId]
      );

      const period = periodResult.rows[0];

      if (!period) {
        return json({ ok: false, error: "Dönem bulunamadı." }, 404);
      }

      if (String(period.status) !== "LIVE") {
        return json(
          { ok: false, error: "Bu dönem şu an talebe açık değil." },
          409
        );
      }

      const itemIds = items.map((item) => item.itemId);

      const validItemsResult = await client.query(
        `
          SELECT id FROM public.supply_catalog_items
          WHERE id = ANY($1::int[]) AND is_active = TRUE
        `,
        [itemIds]
      );

      const validItemIds = new Set(
        validItemsResult.rows.map((row) => Number(row.id))
      );

      const invalidItem = items.find((item) => !validItemIds.has(item.itemId));

      if (invalidItem) {
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
        for (const item of items) {
          await client.query(
            `
              INSERT INTO public.supply_requests (
                period_id, item_id, shop_name, quantity, requested_by_user_key, requested_by_name
              )
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (period_id, item_id, shop_name)
              DO UPDATE SET
                quantity = EXCLUDED.quantity,
                requested_by_user_key = EXCLUDED.requested_by_user_key,
                requested_by_name = EXCLUDED.requested_by_name,
                updated_at = NOW()
            `,
            [
              periodId,
              item.itemId,
              shopName,
              item.quantity,
              session.userKey,
              session.userName,
            ]
          );
        }

        await client.query(
          `
            INSERT INTO public.supply_orders (
              period_id, shop_name, status, submitted_by_user_key, submitted_by_name
            )
            VALUES ($1, $2, 'BEKLEMEDE', $3, $4)
            ON CONFLICT (period_id, shop_name)
            DO UPDATE SET
              status = 'BEKLEMEDE',
              submitted_by_user_key = EXCLUDED.submitted_by_user_key,
              submitted_by_name = EXCLUDED.submitted_by_name,
              updated_at = NOW()
          `,
          [periodId, shopName, session.userKey, session.userName]
        );

        await client.query("COMMIT");
      } catch (transactionError) {
        await client.query("ROLLBACK");
        throw transactionError;
      }

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
