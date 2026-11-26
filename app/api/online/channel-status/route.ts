// app/api/online/channel-status/route.ts
//
// CNETMOBIL - Cihaz Talep: mağaza stoğundaki IMEI'lerin online kanal durumu (N11 / İdefix / İKAS / Garantili)
//
// GET ?depo=CMR -> { map: { [imei]: { N11, IDEFIX, IKAS, GARANTILI } } }  (her biri { durum: ACIK|BEKLIYOR|KAPALI|YOK, not })
// SALT OKUNUR: yalnız veritabanından okur, hiçbir pazaryerine istek atmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { getChannelStatusForDepo } from "@/app/lib/online/channel-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const depo = String(request.nextUrl.searchParams.get("depo") ?? "").trim().toUpperCase();

  if (!/^[A-Z0-9_]{2,30}$/.test(depo)) return json({ success: false, error: "Geçersiz mağaza." }, 400);

  try {
    return json({ success: true, depo, map: await getChannelStatusForDepo(getPool(), depo) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Online durum okunamadı." }, 200);
  }
}
