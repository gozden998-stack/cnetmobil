// app/api/supply/[id]/route.ts
//
// "Mağaza Tedarik" - tek bir dönem üzerinde yönetici aksiyonları
// (START/END/CANCEL) ve silme.

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
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

function parseId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSupplySession(request);
    ensureSupplyManager(session);

    const { id: idParam } = await context.params;
    const id = parseId(idParam);

    if (!id) {
      return json({ ok: false, error: "Geçersiz dönem." }, 400);
    }

    const body = await request.json().catch(() => null);
    const action = String((body as any)?.action || "").trim().toUpperCase();

    if (!["START", "END", "CANCEL"].includes(action)) {
      return json({ ok: false, error: "Geçersiz işlem." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const existingResult = await client.query(
        `SELECT id, status, duration_minutes FROM public.supply_batches WHERE id = $1 LIMIT 1`,
        [id]
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        return json({ ok: false, error: "Dönem bulunamadı." }, 404);
      }

      const currentStatus = String(existing.status);

      if (action === "START") {
        if (currentStatus !== "DRAFT") {
          return json(
            { ok: false, error: "Sadece taslak durumdaki dönem başlatılabilir." },
            409
          );
        }

        const durationMinutes = Number(existing.duration_minutes) || 60;

        await client.query(
          `
            UPDATE public.supply_batches
            SET status = 'LIVE', starts_at = NOW(),
                ends_at = NOW() + ($2 || ' minutes')::interval,
                updated_at = NOW()
            WHERE id = $1
          `,
          [id, durationMinutes]
        );
      } else if (action === "END") {
        if (currentStatus !== "LIVE") {
          return json(
            { ok: false, error: "Sadece açık dönem kapatılabilir." },
            409
          );
        }

        await client.query(
          `UPDATE public.supply_batches SET status = 'ENDED', updated_at = NOW() WHERE id = $1`,
          [id]
        );
      } else if (action === "CANCEL") {
        if (!["DRAFT", "LIVE"].includes(currentStatus)) {
          return json(
            { ok: false, error: "Bu dönem iptal edilemez." },
            409
          );
        }

        await client.query(
          `UPDATE public.supply_batches SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
          [id]
        );
      }

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
    const id = parseId(idParam);

    if (!id) {
      return json({ ok: false, error: "Geçersiz dönem." }, 400);
    }

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const result = await client.query(
        `
          DELETE FROM public.supply_batches
          WHERE id = $1 AND status IN ('DRAFT', 'ENDED', 'CANCELLED')
        `,
        [id]
      );

      if (!result.rowCount) {
        return json(
          { ok: false, error: "Sadece taslak/kapanmış/iptal edilmiş dönem silinebilir." },
          409
        );
      }

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
