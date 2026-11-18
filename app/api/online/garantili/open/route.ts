// app/api/online/garantili/open/route.ts
//
// CNETMOBIL - Merkez (CNET) IMEI'li cihazı Garantili'ye AÇ (cihaz ekle + ilana aç)
//
// POST { imei, markaId, modelId, hafizaId, renkId, onKutulama: 1|2, minFiyat }
//   1) Cihaz stock_devices'te AVAILABLE + CNET olmalı, Garantili'de zaten açık/işlemde olmamalı.
//   2) Seçilen marka/model/hafıza/renk id'leri Garantili kataloğunda var olmalı.
//   3) Garantili'ye POST /kayit/cihaz-ekle (ilan_ac=1, ilan_min_fiyat) gider. Tek istek, tek cihaz.
//   4) Sonuç garantili_devices'e yazılır; id eşlemesi hatırlanır (bir sonraki aynı model için).
// WingSM'e hiçbir şey yazılmaz. Aynı IMEI için çift tıklama/çift açma tablo kilidiyle engellenir. SADECE YÖNETİCİ.

import { NextRequest } from "next/server";

import { getPool, json, requireAdminSession } from "@/app/api/wingsm/score-rules/_shared";
import { getGarantiliCatalog } from "@/app/lib/garantili/catalog";
import { garantiliFetch, stripPii } from "@/app/lib/garantili/server";
import { ensureGarantiliTables, mapKey } from "@/app/lib/garantili/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const intId = (value: unknown) => {
  const n = Math.trunc(Number(value));

  return Number.isFinite(n) && n > 0 ? n : null;
};

export async function POST(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  let body: any = null;

  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Geçersiz istek." }, 400);
  }

  const imei = String(body?.imei ?? "").trim();
  const markaId = intId(body?.markaId);
  const modelId = intId(body?.modelId);
  const hafizaId = intId(body?.hafizaId);
  const renkId = intId(body?.renkId);
  const onKutulama = Math.trunc(Number(body?.onKutulama));
  const minFiyat = Number(body?.minFiyat);

  if (!/^\d{15}$/.test(imei)) return json({ success: false, error: "IMEI 15 haneli olmalı." }, 400);
  if (!markaId || !modelId || !hafizaId || !renkId) return json({ success: false, error: "Marka, model, hafıza ve renk seçilmeli." }, 400);
  if (![1, 2].includes(onKutulama)) return json({ success: false, error: "Kutu seçilmeli (turuncu veya gri)." }, 400);
  if (!Number.isFinite(minFiyat) || minFiyat <= 0 || minFiyat > 1_000_000) return json({ success: false, error: "Geçerli bir minimum satış fiyatı girin." }, 400);

  const pool = getPool();

  try {
    await ensureGarantiliTables(pool);

    // 1) Cihaz uygun mu
    const device = (
      await pool.query(`SELECT imei, brand, model, memory, color FROM public.stock_devices WHERE imei = $1 AND status = 'AVAILABLE' AND current_branch_code = 'CNET' LIMIT 1`, [imei])
    ).rows[0];

    if (!device) return json({ success: false, error: "Cihaz Merkez stoğunda (AVAILABLE) bulunamadı." }, 409);

    // 2) Seçilen id'ler Garantili kataloğunda var mı (elle değiştirilmiş istek olmasın)
    const catalog = await getGarantiliCatalog();
    const model = catalog.models.find((item) => item.id === modelId);

    if (
      !catalog.brands.some((item) => item.id === markaId) ||
      !model ||
      (model.brandId !== null && model.brandId !== markaId) ||
      !catalog.memories.some((item) => item.id === hafizaId) ||
      !catalog.colors.some((item) => item.id === renkId)
    ) {
      return json({ success: false, error: "Seçilen marka/model/hafıza/renk Garantili kataloğunda bulunamadı. Listeyi yenileyip tekrar seçin." }, 400);
    }

    // 3) Kilit: aynı IMEI ikinci kez açılamaz (başarısız/kapanmış olanlar yeniden denenebilir)
    const lock = await pool.query(
      `INSERT INTO public.garantili_devices (imei, status, min_fiyat, on_kutulama, marka_id, model_id, hafiza_id, renk_id)
       VALUES ($1, 'OPENING', $2, $3, $4, $5, $6, $7)
       ON CONFLICT (imei) DO UPDATE
         SET status = 'OPENING', min_fiyat = EXCLUDED.min_fiyat, on_kutulama = EXCLUDED.on_kutulama, marka_id = EXCLUDED.marka_id,
             model_id = EXCLUDED.model_id, hafiza_id = EXCLUDED.hafiza_id, renk_id = EXCLUDED.renk_id, error = NULL, garantili_response = NULL, updated_at = now()
         WHERE public.garantili_devices.status IN ('FAILED', 'CLOSED')
            OR (public.garantili_devices.status = 'OPENING' AND public.garantili_devices.updated_at < now() - interval '10 minutes')
       RETURNING imei`,
      [imei, minFiyat, onKutulama, markaId, modelId, hafizaId, renkId]
    );

    if (lock.rowCount === 0) return json({ success: false, error: "Bu cihaz Garantili'de zaten açık ya da işlemde." }, 409);

    // 4) Garantili'ye gönder
    let result;

    try {
      result = await garantiliFetch("/kayit/cihaz-ekle", {
        method: "POST",
        timeoutMs: 30_000,
        body: {
          marka: markaId,
          model: modelId,
          hafiza: hafizaId,
          renk: renkId,
          on_kutulama: onKutulama,
          imei,
          adet: 1,
          ilan_ac: 1,
          ilan_min_fiyat: String(Math.round(minFiyat)),
          tezgahta_hazir: 0,
        },
      });
    } catch (error) {
      const message = `Garantili'ye ulaşılamadı: ${error instanceof Error ? error.message : String(error)}. Cihaz Garantili'de oluşmuş olabilir; Cihazlarım sekmesinden kontrol edin.`;

      await pool.query(`UPDATE public.garantili_devices SET status = 'FAILED', error = $2, updated_at = now() WHERE imei = $1`, [imei, message.slice(0, 1000)]);

      return json({ success: false, error: message }, 200);
    }

    if (!result.ok) {
      const errors = result.body?.errors ? ` ${JSON.stringify(result.body.errors).slice(0, 400)}` : "";
      const message = `${result.body?.message || `Garantili HTTP ${result.status}`}${errors}`;

      await pool.query(`UPDATE public.garantili_devices SET status = 'FAILED', error = $2, garantili_response = $3::jsonb, updated_at = now() WHERE imei = $1`, [
        imei,
        message.slice(0, 1000),
        JSON.stringify(stripPii(result.body ?? {})).slice(0, 20000),
      ]);

      return json({ success: false, error: message }, 200);
    }

    await pool.query(`UPDATE public.garantili_devices SET status = 'OPEN', error = NULL, garantili_response = $2::jsonb, updated_at = now() WHERE imei = $1`, [
      imei,
      JSON.stringify(stripPii(result.body ?? {})).slice(0, 20000),
    ]);

    // 5) Seçimi hatırla: aynı marka/model/hafıza/renk bir dahaki sefere hazır gelir
    await pool.query(
      `INSERT INTO public.garantili_model_map (map_key, marka_id, model_id, hafiza_id, renk_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (map_key) DO UPDATE SET marka_id = EXCLUDED.marka_id, model_id = EXCLUDED.model_id, hafiza_id = EXCLUDED.hafiza_id, renk_id = EXCLUDED.renk_id, updated_at = now()`,
      [mapKey({ brand: device.brand, model: device.model, memory: device.memory, color: device.color }), markaId, modelId, hafizaId, renkId]
    );

    return json({ success: true, imei, message: result.body?.message ?? "Cihaz eklendi ve ilana açıldı.", data: stripPii(result.body?.data ?? null) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Cihaz açılamadı." }, 200);
  }
}
