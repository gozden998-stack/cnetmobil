// app/api/supply/route.ts
//
// "Mağaza Tedarik" - GET (dönem listesi) / POST (yönetici yeni bir
// dönem açar - ürün SEÇMEZ, kataloğun TAMAMI otomatik bu döneme dahil
// olur).

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  cleanAuctionText,
  closeExpiredSupplyPeriods,
  ensureRequestChannel,
  ensureSupplyManager,
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
    ensureRequestChannel(session);

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);
      await closeExpiredSupplyPeriods(client);

      const statusFilter = session.isManager
        ? `('DRAFT','LIVE','ENDED','CANCELLED')`
        : `('LIVE','ENDED')`;

      const periodsResult = await client.query(
        `
          SELECT
            id, title, status, duration_minutes,
            starts_at, ends_at, created_by_name, created_at
          FROM public.supply_periods
          WHERE status IN ${statusFilter}
          ORDER BY created_at DESC
          LIMIT 50
        `
      );

      const periodIds = periodsResult.rows.map((row) => Number(row.id));

      // LIVE bir donemde katalogtaki TUM aktif urunler otomatik
      // talebe aciktir - donem "urun secimi" tutmuyor. ENDED/CANCELLED
      // donemlerde ise sadece o donemde GERCEKTEN talep edilmis
      // urunler gosterilir (Excel/gecmis icin).
      const catalogResult = await client.query(
        `
          SELECT id, item_name, item_note, is_active
          FROM public.supply_catalog_items
          ORDER BY item_name ASC
        `
      );

      const catalogById = new Map<
        number,
        { id: number; itemName: string; itemNote: string; isActive: boolean }
      >();

      for (const row of catalogResult.rows) {
        catalogById.set(Number(row.id), {
          id: Number(row.id),
          itemName: String(row.item_name),
          itemNote: row.item_note ? String(row.item_note) : "",
          isActive: Boolean(row.is_active),
        });
      }

      const requestsResult = periodIds.length
        ? await client.query(
            `
              SELECT period_id, item_id, shop_name, quantity, requested_by_name, updated_at
              FROM public.supply_requests
              WHERE period_id = ANY($1::int[])
            `,
            [periodIds]
          )
        : { rows: [] as any[] };

      const requestsByPeriodItem = new Map<string, any[]>();
      for (const req of requestsResult.rows) {
        const key = `${req.period_id}:${req.item_id}`;
        if (!requestsByPeriodItem.has(key)) requestsByPeriodItem.set(key, []);
        requestsByPeriodItem.get(key)!.push({
          shopName: String(req.shop_name),
          quantity: Number(req.quantity),
          requestedByName: req.requested_by_name
            ? String(req.requested_by_name)
            : "",
          updatedAt: req.updated_at,
        });
      }

      const activeCatalog = Array.from(catalogById.values()).filter(
        (item) => item.isActive
      );

      const periods = periodsResult.rows.map((row) => {
        const periodId = Number(row.id);
        const status = String(row.status);

        // Bu donemde HANGI urunlerin gosterilecegini belirle: LIVE
        // ise TUM aktif katalog; degilse sadece talep edilmis olanlar.
        const relevantItems =
          status === "LIVE"
            ? activeCatalog
            : Array.from(catalogById.values()).filter((item) =>
                requestsByPeriodItem.has(`${periodId}:${item.id}`)
              );

        const items = relevantItems.map((item) => {
          const allRequests =
            requestsByPeriodItem.get(`${periodId}:${item.id}`) || [];

          const visibleRequests =
            session.isManager || session.channel === "VODAFONE"
              ? allRequests
              : allRequests.filter(
                  (r) =>
                    r.shopName.toLocaleUpperCase("tr-TR") ===
                    session.branch.toLocaleUpperCase("tr-TR")
                );

          return {
            id: item.id,
            itemName: item.itemName,
            itemNote: item.itemNote,
            requests: visibleRequests,
          };
        });

        return {
          id: periodId,
          title: String(row.title),
          status,
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

      return json({
        ok: true,
        isManager: session.isManager,
        channel: session.channel,
        branch: session.branch,
        periods,
      });
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

    if (!title) {
      return json({ ok: false, error: "Başlık zorunludur." }, 400);
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
      return json({ ok: false, error: "Geçersiz süre." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const catalogCount = await client.query(
        `SELECT COUNT(*)::int AS count FROM public.supply_catalog_items WHERE is_active = TRUE`
      );

      if (!Number(catalogCount.rows[0]?.count)) {
        return json(
          {
            ok: false,
            error:
              "Önce katalogdan en az bir aktif ürün eklemelisiniz.",
          },
          400
        );
      }

      const result = await client.query(
        `
          INSERT INTO public.supply_periods (
            title, status, duration_minutes, created_by_user_id, created_by_name
          )
          VALUES ($1, 'DRAFT', $2, $3, $4)
          RETURNING id
        `,
        [title, durationMinutes, session.userKey, session.userName]
      );

      return json({ ok: true, periodId: Number(result.rows[0].id) });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
