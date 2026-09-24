// app/api/supply/catalog/route.ts
//
// "Mağaza Tedarik" - KALICI ürün kataloğu. Yönetici bir ürünü BİR KEZ
// ekler, sonraki tüm dönemlerde tekrar eklemeye gerek kalmaz.

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  cleanAuctionText,
  ensureRequestChannel,
  ensureSupplyManager,
  ensureSupplyTables,
  getSupplyPool,
  getSupplySession,
} from "../_server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSupplySession(request);
    ensureRequestChannel(session);

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const result = await client.query(
        `
          SELECT id, item_name, item_note, is_active, created_at
          FROM public.supply_catalog_items
          ${session.isManager ? "" : "WHERE is_active = TRUE"}
          ORDER BY item_name ASC
        `
      );

      const items = result.rows.map((row) => ({
        id: Number(row.id),
        itemName: String(row.item_name),
        itemNote: row.item_note ? String(row.item_note) : "",
        isActive: Boolean(row.is_active),
      }));

      return json({ ok: true, items });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSupplySession(request);
    ensureSupplyManager(session);

    const body = await request.json().catch(() => null);
    const itemName = cleanAuctionText((body as any)?.itemName, 160);
    const itemNote = cleanAuctionText((body as any)?.itemNote, 300);

    if (!itemName) {
      return json({ ok: false, error: "Ürün adı zorunludur." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const result = await client.query(
        `
          INSERT INTO public.supply_catalog_items (item_name, item_note)
          VALUES ($1, $2)
          RETURNING id
        `,
        [itemName, itemNote || null]
      );

      return json({ ok: true, id: Number(result.rows[0].id) });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
