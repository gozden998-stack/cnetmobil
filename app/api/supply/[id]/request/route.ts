// app/api/supply/[id]/request/route.ts
//
// "Mağaza Tedarik" - Vodafone Kanalı bir ürün için adet talebi
// gönderir (aynı mağaza + aynı ürün için tekrar gönderirse adedi
// günceller).

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  ensureRequestChannel,
  ensureSupplyManager,
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

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSupplySession(request);
    ensureRequestChannel(session);

    const { id: idParam } = await context.params;
    const batchId = parseId(idParam);

    if (!batchId) {
      return json({ ok: false, error: "Geçersiz dönem." }, 400);
    }

    const body = await request.json().catch(() => null);
    const itemId = Number((body as any)?.itemId);
    const quantity = Number((body as any)?.quantity);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return json({ ok: false, error: "Geçersiz ürün." }, 400);
    }

    const shopResolution = resolveRequestShopName(
      session,
      (body as any)?.shopName
    );

    if (!shopResolution.ok) {
      return json({ ok: false, error: shopResolution.error }, 400);
    }

    const shopName = shopResolution.shopName;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000) {
      return json({ ok: false, error: "Geçersiz adet." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const periodResult = await client.query(
        `SELECT status FROM public.supply_periods WHERE id = $1 LIMIT 1`,
        [batchId]
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

      // Donem artik "urun secmiyor" - katalogtaki AKTIF her urun icin
      // talep alinabilir.
      const itemResult = await client.query(
        `SELECT id FROM public.supply_catalog_items WHERE id = $1 AND is_active = TRUE LIMIT 1`,
        [itemId]
      );

      if (!itemResult.rows[0]) {
        return json(
          { ok: false, error: "Ürün bulunamadı veya artık aktif değil." },
          404
        );
      }

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
        [batchId, itemId, shopName, quantity, session.userKey, session.userName]
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
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSupplySession(request);
    ensureSupplyManager(session);

    const { id: idParam } = await context.params;
    const periodId = parseId(idParam);

    if (!periodId) {
      return json({ ok: false, error: "Geçersiz dönem." }, 400);
    }

    const { searchParams } = new URL(request.url);
    const itemId = Number(searchParams.get("itemId"));
    const shopName = String(searchParams.get("shopName") || "").trim();

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return json({ ok: false, error: "Geçersiz ürün." }, 400);
    }

    if (!shopName) {
      return json({ ok: false, error: "Geçersiz mağaza." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const result = await client.query(
        `
          DELETE FROM public.supply_requests
          WHERE period_id = $1 AND item_id = $2 AND shop_name = $3
        `,
        [periodId, itemId, shopName]
      );

      if (!result.rowCount) {
        return json({ ok: false, error: "Talep bulunamadı." }, 404);
      }

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
