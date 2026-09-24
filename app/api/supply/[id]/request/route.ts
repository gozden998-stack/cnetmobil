// app/api/supply/[id]/request/route.ts
//
// "Mağaza Tedarik" - Vodafone Kanalı bir ürün için adet talebi
// gönderir (aynı mağaza + aynı ürün için tekrar gönderirse adedi
// günceller).

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  ensureSupplyTables,
  ensureVodafoneChannel,
  getSupplyPool,
  getSupplySession,
  isValidVodafoneShop,
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSupplySession(request);
    ensureVodafoneChannel(session);

    const { id: idParam } = await context.params;
    const batchId = parseId(idParam);

    if (!batchId) {
      return json({ ok: false, error: "Geçersiz dönem." }, 400);
    }

    const body = await request.json().catch(() => null);
    const itemId = Number((body as any)?.itemId);
    const shopName = String((body as any)?.shopName || "")
      .trim()
      .toLocaleUpperCase("tr-TR");
    const quantity = Number((body as any)?.quantity);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return json({ ok: false, error: "Geçersiz ürün." }, 400);
    }

    if (!isValidVodafoneShop(shopName)) {
      return json({ ok: false, error: "Geçersiz mağaza seçimi." }, 400);
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      return json({ ok: false, error: "Geçersiz adet." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const batchResult = await client.query(
        `SELECT status FROM public.supply_batches WHERE id = $1 LIMIT 1`,
        [batchId]
      );

      const batch = batchResult.rows[0];

      if (!batch) {
        return json({ ok: false, error: "Dönem bulunamadı." }, 404);
      }

      if (String(batch.status) !== "LIVE") {
        return json(
          { ok: false, error: "Bu dönem şu an talebe açık değil." },
          409
        );
      }

      const itemResult = await client.query(
        `SELECT id FROM public.supply_items WHERE id = $1 AND batch_id = $2 LIMIT 1`,
        [itemId, batchId]
      );

      if (!itemResult.rows[0]) {
        return json(
          { ok: false, error: "Ürün bu dönemde bulunamadı." },
          404
        );
      }

      await client.query(
        `
          INSERT INTO public.supply_requests (
            item_id, shop_name, quantity, requested_by_user_key, requested_by_name
          )
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (item_id, shop_name)
          DO UPDATE SET
            quantity = EXCLUDED.quantity,
            requested_by_user_key = EXCLUDED.requested_by_user_key,
            requested_by_name = EXCLUDED.requested_by_name,
            updated_at = NOW()
        `,
        [itemId, shopName, quantity, session.userKey, session.userName]
      );

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
