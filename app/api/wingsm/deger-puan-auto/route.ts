// app/api/wingsm/deger-puan-auto/route.ts
//
// CNETMOBIL - WingSM "Değer Puan" - GÜNLÜK OTOMATİK HESAPLAMA
//
// Bir zamanlayıcı (Coolify Scheduled Task -> scripts/deger-puan-auto-cron.mjs)
// bu uca sık aralıkla (ör. her 10 dakikada) POST atar. Uç kendisi karar verir:
//   - Ayın 28, 29, 30, 31'i ve 1'i HİÇBİR ŞEY yapmaz (ay sonu raporu ayın 1'inde
//     yönetici tarafından gruptan paylaşılır; ayın 2'sinde yeniden başlar).
//   - Türkiye saatiyle 10:00'dan önceyse HİÇBİR ŞEY yapmaz.
//   - Bugün için zaten hesaplandıysa HİÇBİR ŞEY yapmaz (günde bir kez).
//   - Aksi halde "ayın 1'i - dün" aralığını (ör. 11'inde 1 - 10) hesaplar ve kaydeder (admin'in
//     HESAPLA düğmesiyle AYNI çekirdek: ../_deger-puan-compute.ts).
// Saat dilimi sunucuya değil bu kodun içinde Türkiye'ye sabitlendiği için
// zamanlayıcının saat dilimi ayarı önemli değildir; sunucu 10:00'da kapalıysa
// açıldığında ilk çağrıda hesaplanır; WingSM geçici hata verirse bir sonraki
// çağrıda tekrar denenir.
//
// GÜVENLİK: sadece sunucu-sunucu, Authorization: Bearer WINGSM_SYNC_SECRET
// (sync-stock ile aynı sır). Oturum/çerez kabul edilmez.
//
// WingSM'e HİÇBİR veri yazılmaz (sadece satış listesi GET).

import { NextRequest } from "next/server";
import crypto from "crypto";

import { getPool, json } from "../score-rules/_shared";
import { computeAndSaveDegerPuanReport } from "../_deger-puan-compute";
import { autoReportRange, AUTO_RUN_HOUR, isAutoRunDay, isAutoRunTime, istanbulDateAndHour } from "../_deger-puan-auto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isCronAuthorized(request: NextRequest) {
  const secret = String(process.env.WINGSM_SYNC_SECRET || "").trim();

  if (!secret) {
    return false;
  }

  const received = Buffer.from(String(request.headers.get("authorization") || ""), "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return json({ success: false, error: "Yetkisiz." }, 401);
  }

  const { date: today, hour } = istanbulDateAndHour(new Date());

  if (!isAutoRunDay(today)) {
    return json({
      success: true,
      status: "AY_SONU_DURDU",
      message: "Ayın 28'inden ayın 1'ine kadar otomatik hesaplama yapılmaz; ay sonu raporu yönetici tarafından paylaşılır.",
      today,
    });
  }

  if (!isAutoRunTime(hour)) {
    return json({
      success: true,
      status: "HENUZ_SAAT_DEGIL",
      message: `Otomatik hesaplama Türkiye saatiyle ${AUTO_RUN_HOUR}:00'dan sonra çalışır.`,
      today,
      hour,
    });
  }

  const pool = getPool();

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.wingsm_deger_puan_auto_runs (
        run_date DATE PRIMARY KEY,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ,
        tarih TEXT,
        tarih2 TEXT
      )
    `);

    // "Bugünün hesabını ben yapıyorum" kaydı. Aynı anda gelen ikinci çağrı ya da
    // bugün zaten bitmiş hesap bu kaydı alamaz. Yarım kalmış (15 dakikadan eski,
    // bitmemiş) kayıt takılı sayılır ve yeniden alınabilir.
    const claim = await pool.query(
      `
        INSERT INTO public.wingsm_deger_puan_auto_runs (run_date, started_at)
        VALUES ($1::date, now())
        ON CONFLICT (run_date) DO UPDATE SET started_at = now()
        WHERE public.wingsm_deger_puan_auto_runs.finished_at IS NULL
          AND public.wingsm_deger_puan_auto_runs.started_at < now() - interval '15 minutes'
        RETURNING run_date
      `,
      [today]
    );

    if (!claim.rows[0]) {
      return json({
        success: true,
        status: "BUGUN_ZATEN_HESAPLANDI",
        today,
      });
    }

    const { tarih, tarih2 } = autoReportRange(today);

    try {
      await computeAndSaveDegerPuanReport({ bastar: tarih, bittar: tarih2 });
    } catch (error) {
      // Hesaplama başarısızsa kaydı geri al: bir sonraki çağrıda tekrar denenir.
      await pool
        .query(`DELETE FROM public.wingsm_deger_puan_auto_runs WHERE run_date = $1::date AND finished_at IS NULL`, [
          today,
        ])
        .catch(() => undefined);

      throw error;
    }

    await pool.query(
      `UPDATE public.wingsm_deger_puan_auto_runs SET finished_at = now(), tarih = $2, tarih2 = $3 WHERE run_date = $1::date`,
      [today, tarih, tarih2]
    );

    return json({ success: true, status: "HESAPLANDI", today, tarih, tarih2 });
  } catch (error) {
    console.error("WINGSM_DEGER_PUAN_AUTO_ERROR:", error);

    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Otomatik Değer Puan hesabı başarısız.",
      },
      500
    );
  }
}
