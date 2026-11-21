// app/api/wingsm/vodafone/yarisma/auto/route.ts
//
// CNETMOBIL - Vodafone Şampiyonlar Ligi - GÜNLÜK OTOMATİK HESAP
//
// Zamanlayıcı (deger-puan-auto-cron.mjs, 10 dakikada bir) çağırır; KARARI BU UÇ verir (CMR yarışmasıyla AYNI düzen):
//   - Yarışmanın ikinci gününden ayın 28'ine (publishUntil) kadar; sonra durur.
//   - Türkiye saatiyle 12:30'dan önce hiçbir şey yapmaz; bugün zaten hesaplandıysa hiçbir şey yapmaz (günde bir kez).
// Resmi Vodafone Değer Puan raporu/arşivi bu hesapla DEĞİŞMEZ. WingSM'e hiçbir şey yazılmaz.
// GÜVENLİK: sadece sunucu-sunucu, Authorization: Bearer WINGSM_SYNC_SECRET.

import { NextRequest } from "next/server";
import crypto from "crypto";

import { getPool, json } from "../../../score-rules/_shared";
import { YARISMA_AUTO_RUN_MINUTES, ensureYarismaTables, istanbulDateAndMinutes } from "../../../yarisma/_yarisma";
import { computeVdfLeague, computeVdfManagerLeague, getVdfConfig, vdfIsAutoRunDay } from "../_vyarisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isCronAuthorized(request: NextRequest) {
  const secret = String(process.env.WINGSM_SYNC_SECRET || "").trim();

  if (!secret) return false;

  const received = Buffer.from(String(request.headers.get("authorization") || ""), "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");

  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}

export async function POST(request: NextRequest) {
  if (!isCronAuthorized(request)) return json({ success: false, error: "Yetkisiz." }, 401);

  const { date: today, minutes } = istanbulDateAndMinutes(new Date());
  const pool = getPool();

  try {
    const config = await getVdfConfig(pool);

    if (!vdfIsAutoRunDay(today, config)) return json({ success: true, status: "YARISMA_DISI_GUN", today });

    if (minutes < YARISMA_AUTO_RUN_MINUTES) return json({ success: true, status: "HENUZ_SAAT_DEGIL", today, message: "Otomatik hesap Türkiye saatiyle 12:30'dan sonra çalışır." });

    await ensureYarismaTables(pool);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.yarisma_auto_runs (
        league_id TEXT NOT NULL,
        run_date DATE NOT NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        finished_at TIMESTAMPTZ,
        PRIMARY KEY (league_id, run_date)
      )
    `);

    const claim = await pool.query(
      `INSERT INTO public.yarisma_auto_runs (league_id, run_date, started_at)
       VALUES ($1, $2::date, now())
       ON CONFLICT (league_id, run_date) DO UPDATE SET started_at = now()
       WHERE public.yarisma_auto_runs.finished_at IS NULL AND public.yarisma_auto_runs.started_at < now() - interval '15 minutes'
       RETURNING run_date`,
      [config.id, today]
    );

    if (!claim.rows[0]) return json({ success: true, status: "BUGUN_ZATEN_HESAPLANDI", today });

    try {
      const result: any = await computeVdfLeague(pool, config, "yayin");

      // Mağaza müdürleri yarışması: ayrı hesap; hata verirse kişi yarışmasının yayınını BOZMAZ (logla, geç).
      try {
        await computeVdfManagerLeague(pool, config, "yayin");
      } catch (managerError) {
        console.error("VDF_YARISMA_MUDUR_AUTO_ERROR:", managerError);
      }

      await pool.query(`UPDATE public.yarisma_auto_runs SET finished_at = now() WHERE league_id = $1 AND run_date = $2::date`, [config.id, today]);

      return json({ success: true, status: result?.empty ? "VERI_YOK" : "HESAPLANDI", today, tarih: result?.range?.from, tarih2: result?.range?.to });
    } catch (error) {
      await pool.query(`DELETE FROM public.yarisma_auto_runs WHERE league_id = $1 AND run_date = $2::date AND finished_at IS NULL`, [config.id, today]).catch(() => undefined);

      throw error;
    }
  } catch (error) {
    console.error("VDF_YARISMA_AUTO_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Otomatik yarışma hesabı başarısız." }, 500);
  }
}
