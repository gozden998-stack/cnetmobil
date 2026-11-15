// app/api/online/hepsiburada/stock-sync/route.ts
//
// CNETMOBIL - Hepsiburada stok senkronu
//
// GET  (yönetici)  -> ÖNİZLEME: eşleşmiş listing'ler için hedef stoğu hesaplar, ne değişeceğini gösterir. Hiçbir şey göndermez.
// POST (yönetici)  { apply: true, confirm: true } -> planı şimdi Hepsiburada'ya gönderir (yalnız değişenler).
// POST (cron, Authorization: Bearer WINGSM_SYNC_SECRET) -> ayardan "otomatik gönderim" açıksa planı uygular (4 dk'da bir).
// Kurallar ve korumalar: bkz. app/lib/hepsiburada/stock-sync.ts. Fiyata dokunulmaz.

import { NextRequest } from "next/server";
import crypto from "crypto";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { getHepsiburadaConfig } from "@/app/lib/hepsiburada/server";
import { applyStockPlan, computeStockPlan, runAutoStockSync } from "@/app/lib/hepsiburada/stock-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isCronAuthorized(request: NextRequest) {
  const secret = String(process.env.WINGSM_SYNC_SECRET || "").trim();

  if (!secret) return false;

  const received = Buffer.from(String(request.headers.get("authorization") || ""), "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  if (!getHepsiburadaConfig()) return json({ success: false, error: "Hepsiburada ortam değişkenleri eksik." }, 200);

  try {
    const plan = await computeStockPlan(getPool());

    return json({ success: true, ...plan });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Plan hesaplanamadı." }, 200);
  }
}

export async function POST(request: NextRequest) {
  const pool = getPool();

  // Cron: otomatik gönderim
  if (isCronAuthorized(request)) {
    try {
      const run = await runAutoStockSync(pool);

      return json({
        success: true,
        skipped: run.skipped ?? null,
        sent: run.result?.sent ?? 0,
        blocked: run.result?.blocked ?? null,
        changes: run.result ? run.result.plan.items.filter((item) => item.action === "CHANGE").length : 0,
      });
    } catch (error) {
      console.error("HEPSIBURADA_AUTO_STOCK_ERROR:", error);

      return json({ success: false, error: error instanceof Error ? error.message : "Otomatik stok gönderimi başarısız." }, 500);
    }
  }

  // Yönetici: elle uygula
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (body?.apply !== true || body?.confirm !== true) return json({ success: false, error: "apply ve confirm gerekli." }, 400);

  try {
    const result = await applyStockPlan(pool, "MANUAL");

    return json({ success: !result.blocked, sent: result.sent, uploadIds: result.uploadIds, blocked: result.blocked });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Stok gönderilemedi." }, 200);
  }
}
