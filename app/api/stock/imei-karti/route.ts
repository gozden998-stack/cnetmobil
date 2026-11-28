// app/api/stock/imei-karti/route.ts
//
// CNETMOBIL - IMEI kartı: cihazın tüm hareketleri (mağaza / tarih sınırı yok) + grade + satış özeti (müşteri, tutar, mağaza, personel).
// SALT OKUNUR. SADECE YÖNETİCİ (müşteri adı/telefonu kişisel veridir; TC kimlik, doğum tarihi, maliyet/kâr döndürülmez).

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { saleState, type KartOlay } from "@/app/lib/stok-imei-karti";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  const imei = String(request.nextUrl.searchParams.get("imei") ?? "").replace(/\D/g, "");

  if (imei.length !== 15) return json({ success: false, error: "15 haneli IMEI girin." }, 400);

  try {
    const pool = getPool();

    const [device, events] = await Promise.all([
      pool.query(
        `SELECT imei, brand, model, memory, color, grade, status, wing_status, current_branch_code
         FROM public.stock_devices WHERE imei = $1 LIMIT 1`,
        [imei]
      ),
      pool.query(
        `SELECT id, event_type, from_branch_code, to_branch_code, old_status, new_status, performed_by, created_at,
                CASE WHEN event_type IN ('WINGSM_SALE_DETECTED', 'WINGSM_SALE_REVERSED') THEN metadata -> 'evidence' ELSE NULL END AS evidence
         FROM public.stock_events WHERE imei = $1
         ORDER BY created_at DESC, id DESC LIMIT 300`,
        [imei]
      ),
    ]);

    const olaylar: KartOlay[] = events.rows.map((row: any) => ({
      id: Number(row.id),
      event_type: String(row.event_type),
      from_branch_code: row.from_branch_code ?? null,
      to_branch_code: row.to_branch_code ?? null,
      old_status: row.old_status ?? null,
      new_status: row.new_status ?? null,
      performed_by: row.performed_by ?? null,
      created_at: new Date(row.created_at).toISOString(),
      evidence: row.evidence,
    }));

    const { durum, satis } = saleState(olaylar);
    const cihaz = device.rows[0] ?? null;

    return json({
      success: true,
      imei,
      bulundu: Boolean(cihaz) || olaylar.length > 0,
      cihaz: cihaz
        ? {
            marka: cihaz.brand ?? null,
            model: cihaz.model ?? null,
            hafiza: cihaz.memory ?? null,
            renk: cihaz.color ?? null,
            grade: cihaz.grade ?? null,
            durum: cihaz.status ?? null,
            wingDurum: cihaz.wing_status ?? null,
            depo: cihaz.current_branch_code ?? null,
          }
        : null,
      satisDurumu: durum,
      satis,
      // ham kanıt satırı dönmez (kişisel veri); yalnız sade olay listesi
      olaylar: olaylar.map(({ evidence, ...rest }) => rest),
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "IMEI kartı alınamadı." }, 200);
  }
}
