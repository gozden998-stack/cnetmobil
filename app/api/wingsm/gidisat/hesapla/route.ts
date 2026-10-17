// app/api/wingsm/gidisat/hesapla/route.ts
//
// CNETMOBIL - Personel Gidişat - HESAPLA (sadece yönetici).
// Gerçekleşen WingSM satışlarından (CMR 4 depo) çıkarılır, hedeflerle birleşir,
// sonuç gidisat_history'ye kaydedilir. WingSM'e hiçbir veri yazılmaz.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "../../score-rules/_shared";
import { DegerPuanInputError } from "../../_deger-puan-compute";
import { computeAndSaveGidisat } from "../_gidisat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return json({ success: false, error: "Geçersiz istek." }, 400);
    }

    const { bastar, bittar, gecenGun, ayToplamGun } = body as Record<string, unknown>;

    if (!bastar || !bittar) {
      return json({ success: false, error: "bastar ve bittar tarihleri zorunludur." }, 400);
    }

    const report = await computeAndSaveGidisat({ bastar, bittar, gecenGun, ayToplamGun });

    return json(report as unknown as Record<string, unknown>);
  } catch (error) {
    if (error instanceof DegerPuanInputError) {
      return json({ success: false, error: error.message }, 400);
    }

    console.error("GIDISAT_HESAPLA_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Gidişat hesaplanamadı." }, 500);
  }
}
