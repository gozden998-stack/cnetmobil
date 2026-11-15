// app/api/online/hepsiburada/stock-sync/route.ts
//
// CNETMOBIL - Hepsiburada stok düşürme (WingSM satışı -> Hepsiburada stok -1)
//
// GET  (yönetici)  -> durum: otomatik açık mı + son çalışmalar (hiçbir şey göndermez).
// POST (cron, Authorization: Bearer WINGSM_SYNC_SECRET) -> ayardan açıksa her dakika çalışır.
// Kurallar ve korumalar: bkz. app/lib/hepsiburada/stock-sync.ts. Fiyata dokunulmaz, stok ARTIRILMAZ.

import { NextRequest } from "next/server";
import crypto from "crypto";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { getHepsiburadaConfig } from "@/app/lib/hepsiburada/server";
import { getSettings, recentLog, runAutoStockSync } from "@/app/lib/hepsiburada/stock-sync";

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

  try {
    const pool = getPool();

    return json({ success: true, ...(await getSettings(pool)), log: await recentLog(pool, 8) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Durum okunamadı." }, 200);
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return json({ success: false, error: "Yetkisiz." }, 401);

  if (!getHepsiburadaConfig()) return json({ success: true, skipped: "Hepsiburada ortam değişkenleri eksik." });

  try {
    const run = await runAutoStockSync(getPool());

    return json({
      success: true,
      skipped: run.skipped ?? null,
      sent: run.result?.sent ?? 0,
      changes: run.result ? run.result.plan.items.length : 0,
      baseline: run.result?.baseline ?? false,
      blocked: run.result?.blocked ?? null,
    });
  } catch (error) {
    console.error("HEPSIBURADA_AUTO_STOCK_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Stok düşürme başarısız." }, 500);
  }
}
