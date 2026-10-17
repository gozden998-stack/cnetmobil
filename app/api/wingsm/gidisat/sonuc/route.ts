// app/api/wingsm/gidisat/sonuc/route.ts
//
// CNETMOBIL - Personel Gidişat - KAYITLI SON SONUCU OKU (sadece yönetici).
//   GET [?period=YYYY-MM] -> o ayın (verilmezse en son) en güncel hesaplanmış raporu

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "../../score-rules/_shared";
import { ensureGidisatTables } from "../_gidisat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const pool = getPool();
    await ensureGidisatTables(pool);

    const periodParam = String(new URL(request.url).searchParams.get("period") || "").trim();
    const hasPeriod = /^\d{4}-\d{2}$/.test(periodParam);

    const result = await pool.query(
      `SELECT payload, computed_at FROM public.gidisat_history
       ${hasPeriod ? "WHERE period = $1" : ""}
       ORDER BY range_end DESC NULLS LAST, computed_at DESC LIMIT 1`,
      hasPeriod ? [periodParam] : []
    );

    const row = result.rows[0];

    if (!row) {
      return json({ success: true, hasReport: false });
    }

    const payload = typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload;

    return json({ ...payload, success: true, hasReport: true, computedAt: new Date(row.computed_at).toISOString() });
  } catch (error) {
    console.error("GIDISAT_SONUC_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Sonuç alınamadı." }, 500);
  }
}
