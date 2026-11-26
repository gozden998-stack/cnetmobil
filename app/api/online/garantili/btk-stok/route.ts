// app/api/online/garantili/btk-stok/route.ts
//
// CNETMOBIL - Stoktaki (WingSM'de IN_STOCK + panelde AVAILABLE) IMEI'lerin Garantili BTK yenileme uygunluğu
//
// GET  ?depo=CMR -> stok listesi + son sorgu sonuçları + özet (Garantili'ye istek ATMAZ). depo yoksa tüm stok
// POST { imeis?: string[], mod?: "bekleyen"|"kirmizi", depo?: "CMR", limit?: 1-10 } -> seçilenleri sırayla sorgular, sonucu kaydeder
//   (yalnız stoktaki IMEI'ler sorgulanır; Garantili'de kayıt açılmaz). SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { listStockBtk, runBtkChecks } from "@/app/lib/garantili/btk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Mağaza kodu: CNET, MERKEZ, CMR, CADDE, KAPAKLI, SARAY... (yalnız harf/rakam/_)
const cleanDepo = (value: unknown) => {
  const text = String(value ?? "").trim().toUpperCase();

  return /^[A-Z0-9_]{2,30}$/.test(text) ? text : null;
};

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  try {
    return json({ success: true, ...(await listStockBtk(getPool(), cleanDepo(request.nextUrl.searchParams.get("depo")))) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Stok listesi okunamadı." }, 200);
  }
}

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  let body: any = null;

  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Geçersiz istek." }, 400);
  }

  try {
    const result = await runBtkChecks(getPool(), {
      imeis: Array.isArray(body?.imeis) ? body.imeis : undefined,
      mod: body?.mod === "kirmizi" ? "kirmizi" : "bekleyen",
      limit: body?.limit,
      depo: cleanDepo(body?.depo),
      oncesi: typeof body?.oncesi === "string" ? body.oncesi : null,
    });

    return json({ success: true, ...result });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Sorgu yapılamadı." }, 200);
  }
}
