// app/api/online/channel-close/run/route.ts
//
// CNETMOBIL - KANALLAR ARASI STOK KAPATMA (cron)
//
// Zamanlayıcı (scripts/wingsm-sync-cron.mjs) her turda çağırır:
//   1) İdefix siparişlerini okur, satılan IMEI'li kalemler için N11 kapatma kaydı atar.
//   2) Kuyruktaki bekleyen kapatmaları (İdefix / N11) işler; hata olanı sınırlı sayıda yeniden dener.
// Bkz. app/lib/channel-close/queue.ts. WingSM'e hiçbir veri yazılmaz.
//
// GÜVENLİK: sadece sunucu-sunucu, Authorization: Bearer WINGSM_SYNC_SECRET.

import { NextRequest } from "next/server";
import crypto from "crypto";

import { getIdefixDbPool } from "@/app/lib/idefix/server";
import { pollIdefixOrdersForClose } from "@/app/lib/idefix/order-close";
import { processChannelCloseQueue } from "@/app/lib/channel-close/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function respond(body: Record<string, unknown>, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isCronAuthorized(request: NextRequest) {
  const secret = String(process.env.WINGSM_SYNC_SECRET || "").trim();

  if (!secret) return false;

  const received = Buffer.from(String(request.headers.get("authorization") || ""), "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return respond({ success: false, error: "Yetkisiz." }, 401);
  }

  const pool = getIdefixDbPool();
  const errors: string[] = [];
  let orders: Awaited<ReturnType<typeof pollIdefixOrdersForClose>> | null = null;

  // İdefix sipariş okuma hata verse (anahtar yok, servis yavaş) kuyruk yine işlenir.
  try {
    orders = await pollIdefixOrdersForClose(pool);
  } catch (error) {
    errors.push(`İdefix siparişleri okunamadı: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const queue = await processChannelCloseQueue(pool, 10);

    errors.push(...queue.errors);

    return respond({ success: errors.length === 0, orders, queue, errors });
  } catch (error) {
    console.error("CHANNEL_CLOSE_RUN_ERROR:", error);

    return respond(
      { success: false, error: error instanceof Error ? error.message : "Kapatma kuyruğu çalıştırılamadı." },
      500
    );
  }
}
