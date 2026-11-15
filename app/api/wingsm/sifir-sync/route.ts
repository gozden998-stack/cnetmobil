// app/api/wingsm/sifir-sync/route.ts
//
// CNETMOBIL - WingSM sıfır stok senkronu (salt okunur)
//
// POST (cron, Authorization: Bearer WINGSM_SYNC_SECRET): sıfır ürün stoğunu WingSM'den okuyup public.sifir_stock'a
//   yazar. En az 45 saniyede bir gerçekten çalışır (dakikalık cron: her dakika; arada çağrılırsa "skipped"). Hepsiburada stok düşürme bu veriyi kullanır. ?force=1 sınırı atlar.
// GET (yönetici oturumu): tablonun özeti (sınıf/depo toplamları, son çalışma, ilk ürünler). Hiçbir şey yazmaz.
// WingSM'e HİÇBİR veri yazılmaz.

import { NextRequest } from "next/server";
import crypto from "crypto";

import { getPool, json, requireAdminSession } from "../score-rules/_shared";
import { ensureSifirTables, sifirClasses, sifirDepots, syncSifirStock } from "@/app/lib/wingsm/sifir";

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

  try {
    const force = request.nextUrl.searchParams.get("force") === "1";
    const summary = await syncSifirStock(getPool(), { minIntervalMs: force ? 0 : 45 * 1000 });

    return json({ success: summary.depotsFailed === 0, ...summary });
  } catch (error) {
    console.error("SIFIR_SYNC_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Sıfır stok senkronu başarısız." }, 500);
  }
}

export async function GET(request: NextRequest) {
  const auth = requireAdminSession(request);

  if (!auth.ok) return auth.response;

  try {
    const pool = getPool();

    await ensureSifirTables(pool);

    const [byClass, byDepo, lastRun, top] = await Promise.all([
      pool.query(`SELECT sinif, count(*)::int AS urun, COALESCE(sum(miktar), 0)::int AS adet FROM public.sifir_stock GROUP BY sinif ORDER BY sinif`),
      pool.query(`SELECT depo, count(*)::int AS urun, COALESCE(sum(miktar), 0)::int AS adet FROM public.sifir_stock GROUP BY depo ORDER BY depo`),
      pool.query(`SELECT started_at, finished_at, depots_ok, depots_failed, rows_written, errors FROM public.sifir_sync_runs ORDER BY id DESC LIMIT 1`),
      pool.query(
        `SELECT mal_kod, max(mal_ad) AS mal_ad, max(sinif) AS sinif, sum(miktar)::int AS adet, count(*)::int AS depo_sayisi
         FROM public.sifir_stock GROUP BY mal_kod ORDER BY sum(miktar) DESC LIMIT 15`
      ),
    ]);

    return json({
      success: true,
      config: { depots: sifirDepots(), classes: sifirClasses() },
      byClass: byClass.rows,
      byDepo: byDepo.rows,
      lastRun: lastRun.rows[0] ?? null,
      top: top.rows,
    });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : "Özet alınamadı." }, 500);
  }
}
