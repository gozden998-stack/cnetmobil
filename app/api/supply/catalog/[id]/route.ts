// app/api/supply/catalog/[id]/route.ts
//
// "Mağaza Tedarik" - katalog ürününü aktif/pasif yapar. Fiziksel
// silme yapılmıyor (geçmiş dönemlerin talep/Excel kayıtları bu
// ürüne bağlı olabilir - silinirse geçmiş veri de kaybolur).

import { NextRequest, NextResponse } from "next/server";

import {
  apiError,
  ensureSupplyManager,
  ensureSupplyTables,
  getSupplyPool,
  getSupplySession,
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
      return json({ ok: false, error: "Geçersiz ürün." }, 400);
    }

    const body = await request.json().catch(() => null);
    const isActive = Boolean((body as any)?.isActive);

    const pool = getSupplyPool();
    const client = await pool.connect();

    try {
      await ensureSupplyTables(client);

      const result = await client.query(
        `
          UPDATE public.supply_catalog_items
          SET is_active = $2, updated_at = NOW()
          WHERE id = $1
        `,
        [id, isActive]
      );

      if (!result.rowCount) {
        return json({ ok: false, error: "Ürün bulunamadı." }, 404);
      }

      return json({ ok: true });
    } finally {
      client.release();
    }
  } catch (error) {
    return apiError(error);
  }
}
