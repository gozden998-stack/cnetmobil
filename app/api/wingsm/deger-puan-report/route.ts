// app/api/wingsm/deger-puan-report/route.ts
//
// CNETMOBIL - WingSM "Değer Puan" raporu - AŞAMA 3+4: PUAN HESABI + RAPOR
//
// AMAÇ:
// Aşama 1 (app/api/wingsm/value-report/route.ts) WingSM satış verisinin
// okunabildiğini, Aşama 2 (public.wingsm_score_rules + CRUD) admin'in
// puan kurallarını yönetebildiğini kanıtladı. Bu uç, ikisini birleştirip
// CMR'nin 4 deposu için tarih aralığına göre satış -> puan hesabını
// canlı olarak yapar ve mağaza/personel/detay kırılımlarını döner.
//
// GÜVENLİK / KAPSAM:
// - WingSM'e HİÇBİR veri yazılmaz (sadece GET /api/b2b/satis/list/:depo,
//   4 kez, sabit CMR depo kodlarıyla).
// - public.wingsm_score_rules SADECE okunur, hiçbir satır yazılmaz/silinmez.
// - Hiçbir yerde kalıcı saklama (snapshot) yapılmaz — admin her seferinde
//   tarih aralığı seçip yeniden hesaplatır, bu BİLEREK böyle (bkz. görev
//   açıklaması: geçmiş anlık görüntüleme kapsam dışı).
// - Sadece admin oturumuna açık (requireAdminSession).
// - Depo listesi sabit (CMR'nin 4 deposu) — client'tan depo/şirket
//   parametresi ALINMAZ, sadece bastar/bittar.

import { NextRequest } from "next/server";

import { json, requireAdminSession } from "../score-rules/_shared";
import { computeAndSaveDegerPuanReport, DegerPuanInputError } from "../_deger-puan-compute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Hesaplama çekirdeği ../_deger-puan-compute.ts'e taşındı (otomatik günlük
// hesaplama da aynısını kullanıyor). Bu uç sadece admin oturumunu doğrular,
// istek gövdesini okur ve çekirdeği çağırır.
export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ success: false, error: "Geçersiz istek gövdesi." }, 400);
    }

    const data = body as Record<string, unknown>;

    if (!data.bastar || !data.bittar) {
      return json({ success: false, error: "bastar (başlangıç tarihi) ve bittar (bitiş tarihi) zorunludur." }, 400);
    }

    const payload = await computeAndSaveDegerPuanReport({
      bastar: data.bastar,
      bittar: data.bittar,
      gecenGun: data.gecenGun,
      ayToplamGun: data.ayToplamGun,
    });

    return json(payload);
  } catch (error) {
    if (error instanceof DegerPuanInputError) {
      return json({ success: false, error: error.message }, 400);
    }

    console.error("WINGSM_DEGER_PUAN_REPORT_ERROR:", error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Değer Puan raporu alınamadı.",
      },
      500
    );
  }
}
