// app/api/online/garantili/imei-sorgu/route.ts
//
// CNETMOBIL - Garantili "BTK yenileme uygunluğu" IMEI sorgusu (TEK IMEI, DENEME)
//
// POST { imei }  ->  Garantili POST /cihaz/imei-sorgu  (IMEI'nin BTK yenileme/refurbish kaydına uygunluğunu SORGULAR)
// Garantili'de kayıt açmaz/değiştirmez. Cevap kişisel veri ayıklanmış olarak ham döner (alan adları henüz görülmedi).
// WingSM'e hiçbir şey yazılmaz. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { garantiliFetch, stripPii } from "@/app/lib/garantili/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  let body: any = null;

  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Geçersiz istek." }, 400);
  }

  const imei = String(body?.imei ?? "").replace(/\s+/g, "");

  if (!/^\d{15}$/.test(imei)) return json({ success: false, error: "IMEI 15 haneli rakam olmalı." }, 400);

  try {
    const result = await garantiliFetch("/cihaz/imei-sorgu", { method: "POST", body: { imei } });

    return json({
      success: true,
      imei,
      status: result.status,
      garantiliBasarili: result.ok,
      message: result.body?.message ?? null,
      data: stripPii(result.body?.data ?? null),
      // Beklenmeyen biçimde gelirse görebilmek için ham gövdenin kısa hali
      ham: result.body ? undefined : result.raw.slice(0, 500),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Garantili sorgusu yapılamadı." }, 200);
  }
}
