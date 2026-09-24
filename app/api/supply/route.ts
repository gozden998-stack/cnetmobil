// app/api/supply/route.ts
//
// "Mağaza Tedarik" - GET (liste) / POST (yönetici yeni dönem açar).

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  cleanAuctionText,
  closeExpiredSupplyBatches,
  ensureSupplyManager,
  ensureVodafoneChannel,
  ensureSupplyTables,
  getSupplyPool,
  getSupplySession,
} from "./_server";

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
    ensureVodafoneChannel(session);

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);
      await closeExpiredSupplyBatches(client);

      const statusFilter = session.isManager
        ? `('DRAFT','LIVE','ENDED','CANCELLED')`
        : `('LIVE','ENDED')`;

      const batchesResult = await client.query(
        `
          SELECT
            b.id, b.title, b.status, b.duration_minutes,
            b.starts_at, b.ends_at, b.created_by_name, b.created_at
          FROM public.supply_batches b
          WHERE b.status IN ${statusFilter}
          ORDER BY b.created_at DESC
          LIMIT 50
        `
      );

      const batchIds = batchesResult.rows.map((row) => Number(row.id));

      const itemsResult = batchIds.length
        ? await client.query(
            `
              SELECT id, batch_id, item_name, item_note
              FROM public.supply_items
              WHERE batch_id = ANY($1::int[])
              ORDER BY id ASC
            `,
            [batchIds]
          )
        : { rows: [] as any[] };

      const itemsByBatch = new Map<number, any[]>();
      for (const item of itemsResult.rows) {
        const key = Number(item.batch_id);
        if (!itemsByBatch.has(key)) itemsByBatch.set(key, []);
        itemsByBatch.get(key)!.push({
          id: Number(item.id),
          itemName: String(item.item_name),
          itemNote: item.item_note ? String(item.item_note) : "",
        });
      }

      // Personel tarafi sadece "bu subenin kendi taleplerini" gorsun -
      // baska subelerin adedini gormesine gerek yok. Yonetici ise
      // toplu/subeler bazinda tum talepleri gorur.
      const itemIds = itemsResult.rows.map((row) => Number(row.id));

      const requestsResult = itemIds.length
        ? await client.query(
            `
              SELECT item_id, shop_name, quantity, requested_by_name, updated_at
              FROM public.supply_requests
              WHERE item_id = ANY($1::int[])
            `,
            [itemIds]
          )
        : { rows: [] as any[] };

      const requestsByItem = new Map<number, any[]>();
      for (const req of requestsResult.rows) {
        const key = Number(req.item_id);
        if (!requestsByItem.has(key)) requestsByItem.set(key, []);
        requestsByItem.get(key)!.push({
          shopName: String(req.shop_name),
          quantity: Number(req.quantity),
          requestedByName: req.requested_by_name
            ? String(req.requested_by_name)
            : "",
          updatedAt: req.updated_at,
        });
      }

      const batches = batchesResult.rows.map((row) => {
        const items = (itemsByBatch.get(Number(row.id)) || []).map(
          (item) => ({
            ...item,
            requests: session.isManager
              ? requestsByItem.get(item.id) || []
              : (requestsByItem.get(item.id) || []).filter(
                  (r) =>
                    r.shopName.toLocaleUpperCase("tr-TR") ===
                    session.branch.toLocaleUpperCase("tr-TR")
                ),
          })
        );

        return {
          id: Number(row.id),
          title: String(row.title),
          status: String(row.status),
          durationMinutes: row.duration_minutes
            ? Number(row.duration_minutes)
            : null,
          startsAt: row.starts_at,
          endsAt: row.ends_at,
          createdByName: row.created_by_name
            ? String(row.created_by_name)
            : "",
          createdAt: row.created_at,
          items,
        };
      });

      return json({ ok: true, isManager: session.isManager, batches });
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

    if (!body || typeof body !== "object") {
      return json({ ok: false, error: "Geçersiz istek." }, 400);
    }

    const title = cleanAuctionText((body as any).title, 180);
    const durationMinutes = Number((body as any).durationMinutes);

    const rawItems = Array.isArray((body as any).items)
      ? (body as any).items
      : [];

    if (!title) {
      return json({ ok: false, error: "Başlık zorunludur." }, 400);
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
      return json({ ok: false, error: "Geçersiz süre." }, 400);
    }

    const items = rawItems
      .map((item: any) => ({
        itemName: cleanAuctionText(item?.itemName, 160),
        itemNote: cleanAuctionText(item?.itemNote, 300),
      }))
      .filter((item: any) => item.itemName);

    if (!items.length) {
      return json(
        { ok: false, error: "En az bir ürün eklemelisiniz." },
        400
      );
    }

    if (items.length > 50) {
      return json(
        { ok: false, error: "Tek seferde en fazla 50 ürün eklenebilir." },
        400
      );
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);
      await client.query("BEGIN");

      const batchResult = await client.query(
        `
          INSERT INTO public.supply_batches (
            title, status, duration_minutes, created_by_user_id, created_by_name
          )
          VALUES ($1, 'DRAFT', $2, $3, $4)
          RETURNING id
        `,
        [title, durationMinutes, session.userKey, session.userName]
      );

      const batchId = Number(batchResult.rows[0].id);

      for (const item of items) {
        await client.query(
          `
            INSERT INTO public.supply_items (batch_id, item_name, item_note)
            VALUES ($1, $2, $3)
          `,
          [batchId, item.itemName, item.itemNote || null]
        );
      }

      await client.query("COMMIT");

      return json({ ok: true, batchId });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
