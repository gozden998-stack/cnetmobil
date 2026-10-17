// app/api/wingsm/gidisat/auto/route.ts
//
// CNETMOBIL - Personel Gidişat - GÜNLÜK OTOMATİK HESAPLAMA
//
// CMR Değer Puan'ın deger-puan-auto ucuyla AYNI kurallar (aynı zamanlayıcı script'i çağırır):
//   - Ayın 28, 29, 30, 31'i ve 1'i hiçbir şey yapmaz.
//   - Türkiye saatiyle 12:00'dan önce hiçbir şey yapmaz (Gidişat yayın saati 12:00; CMR Değer Puan
//     10:00, Vodafone 11:00).
//   - Bugün zaten hesaplandıysa hiçbir şey yapmaz (günde bir kez, kendi kayıt tablosu).
//   - Aksi halde "ayın 1'i - dün" aralığını hesaplar ve kaydeder.
// Zamanlayıcı CMR Değer Puan'ı (10:00) ÖNCE, bunu (12:00) sonra yayınlar: Değer Puan kategorisi
// o günkü CMR raporundan beslenir.
//
// GÜVENLİK: sadece sunucu-sunucu, Authorization: Bearer WINGSM_SYNC_SECRET.
// WingSM'e HİÇBİR veri yazılmaz.

import { NextRequest } from "next/server";
import crypto from "crypto";

import { getPool, json } from "../../score-rules/_shared";
import { autoReportRange, isAutoRunDay, istanbulDateAndHour } from "../../_deger-puan-auto";
import { computeAndSaveGidisat, ensureGidisatTables } from "../_gidisat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Gidişat raporu her gün bu saatten (Türkiye saati) itibaren hesaplanıp yayınlanır.
const GIDISAT_AUTO_RUN_HOUR = 12;

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
    return json({ success: true, status: "AY_SONU_DURDU", today });
  }

  if (hour < GIDISAT_AUTO_RUN_HOUR) {
    return json({
      success: true,
      status: "HENUZ_SAAT_DEGIL",
      message: `Otomatik hesaplama Türkiye saatiyle ${GIDISAT_AUTO_RUN_HOUR}:00'dan sonra çalışır.`,
      today,
      hour,
    });
  }

  const pool = getPool();

  try {
    await ensureGidisatTables(pool);

    // "Bugünün hesabını ben yapıyorum" kaydı; yarım kalmış (15 dk'dan eski) kayıt yeniden alınabilir.
    const claim = await pool.query(
      `
        INSERT INTO public.gidisat_auto_runs (run_date, started_at)
        VALUES ($1::date, now())
        ON CONFLICT (run_date) DO UPDATE SET started_at = now()
        WHERE public.gidisat_auto_runs.finished_at IS NULL
          AND public.gidisat_auto_runs.started_at < now() - interval '15 minutes'
        RETURNING run_date
      `,
      [today]
    );

    if (!claim.rows[0]) {
      return json({ success: true, status: "BUGUN_ZATEN_HESAPLANDI", today });
    }

    const { tarih, tarih2 } = autoReportRange(today);

    try {
      await computeAndSaveGidisat({ bastar: tarih, bittar: tarih2 });
    } catch (error) {
      // Başarısızsa kaydı geri al: bir sonraki çağrıda tekrar denenir.
      await pool
        .query(`DELETE FROM public.gidisat_auto_runs WHERE run_date = $1::date AND finished_at IS NULL`, [today])
        .catch(() => undefined);

      throw error;
    }

    await pool.query(
      `UPDATE public.gidisat_auto_runs SET finished_at = now(), tarih = $2, tarih2 = $3 WHERE run_date = $1::date`,
      [today, tarih, tarih2]
    );

    return json({ success: true, status: "HESAPLANDI", today, tarih, tarih2 });
  } catch (error) {
    console.error("GIDISAT_AUTO_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Otomatik Gidişat hesabı başarısız." },
      500
    );
  }
}
