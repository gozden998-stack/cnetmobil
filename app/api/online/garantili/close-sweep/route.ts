// app/api/online/garantili/close-sweep/route.ts
//
// CNETMOBIL - WingSM'de satılan cihazın Garantili ilanını kaldırma talebi
//
// GET  (yönetici)  -> son kapatma talepleri (durum, deneme, hata). Hiçbir şey göndermez.
// POST (cron, Authorization: Bearer WINGSM_SYNC_SECRET) -> dakikalık tarama (bkz. app/lib/garantili/close.ts).

import { NextRequest } from "next/server";
import crypto from "crypto";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { recentCloseRequests, runGarantiliCloseSweep } from "@/app/lib/garantili/close";

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
    return json({ success: true, rows: await recentCloseRequests(getPool(), 50) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Kapatma talepleri okunamadı." }, 200);
  }
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return json({ success: false, error: "Yetkisiz." }, 401);

  try {
    const summary = await runGarantiliCloseSweep(getPool());

    return json({ success: true, ...summary });
  } catch (error) {
    console.error("GARANTILI_CLOSE_SWEEP_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Garantili kapatma taraması başarısız." }, 500);
  }
}
