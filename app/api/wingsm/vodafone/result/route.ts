// app/api/wingsm/vodafone/result/route.ts
//
// CNETMOBIL - Vodafone Değer Puan - KAYITLI SONUCU OKU (şimdilik sadece yönetici).
//
// CMR'ın deger-puanim ucuyla aynı fikir: canlı hesap YOK, en son kaydedilen raporu
// (ya da ?historyId= / ?gun=YYYY-MM-DD ile geçmiş günü) okur.
//   - durum: "guncel" = rapor aralığının bitişi DÜN ya da daha yeni; yoksa "bekleniyor".
//   - aySonuPaylasim: ayın 28'inden 1'ine otomatik hesap durur (CMR ile aynı kural).
//
// Erişim: yönetici oturumu VE Vodafone kanalı (VODAFONE KANALI) girişi okuyabilir;
// CMR girişleri okuyamaz. Mağaza girişine admin-only tanı alanları (puansız satır
// örnekleri, adet alanı, kaynak sayıları) verilmez.

import { NextRequest } from "next/server";

import { getPool, json, requireValidSession } from "../../score-rules/_shared";
import { isAutoRunDay } from "../../_deger-puan-auto";
import { ensureVodafoneTables, istanbulTodayIso, previousDayIso } from "../_vodafone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function wingsmDateToIsoLocal(value: unknown): string | null {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

function isVodafoneBranch(branch: string) {
  return String(branch ?? "").trim().toLocaleUpperCase("tr-TR") === "VODAFONE KANALI";
}

export async function GET(request: NextRequest) {
  const auth = requireValidSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  const isAdmin = auth.session.role === "admin";

  if (!isAdmin && !isVodafoneBranch(auth.session.branch)) {
    return json({ success: false, error: "Bu ekran sadece Vodafone kanalına açıktır." }, 403);
  }

  try {
    const pool = getPool();
    await ensureVodafoneTables(pool);

    const url = new URL(request.url);
    const today = istanbulTodayIso();
    const aySonuPaylasim = !isAutoRunDay(today);

    const historyIdParam = url.searchParams.get("historyId");
    const historyId = historyIdParam !== null ? Number(historyIdParam) : null;

    const periodParam = String(url.searchParams.get("period") || "").trim();
    const gunParam = url.searchParams.get("gun");
    const istenenGun = gunParam && /^\d{4}-\d{2}-\d{2}$/.test(gunParam) ? gunParam : null;
    const gecmisGunIstendi = Boolean(istenenGun && istenenGun < today);

    let row: { id: number; payload: unknown; computed_at: string; range_end_iso: string | null } | null = null;
    let selectedHistoryId: number | null = null;
    let tamEsleme = true;

    if (historyId !== null && Number.isInteger(historyId) && historyId > 0) {
      const result = await pool.query(
        `SELECT id, payload, computed_at, to_char(range_end, 'YYYY-MM-DD') AS range_end_iso
         FROM public.vdf_deger_puan_history WHERE id = $1`,
        [historyId]
      );

      if (result.rows[0]) {
        row = result.rows[0];
        selectedHistoryId = Number(result.rows[0].id);
      }
    }

    // ?period=YYYY-MM: seçilen ayın en güncel raporu (geçmiş ay görüntüleme).
    if (!row && /^\d{4}-\d{2}$/.test(periodParam)) {
      const result = await pool.query(
        `SELECT id, payload, computed_at, to_char(range_end, 'YYYY-MM-DD') AS range_end_iso
         FROM public.vdf_deger_puan_history
         WHERE period = $1
         ORDER BY range_end DESC NULLS LAST, computed_at DESC
         LIMIT 1`,
        [periodParam]
      );

      if (result.rows[0]) {
        row = result.rows[0];
        selectedHistoryId = Number(result.rows[0].id);
      }
    }

    if (!row && gecmisGunIstendi && istenenGun) {
      // O gün yayınlanan rapor, o günden bir önceki güne kadardır.
      const result = await pool.query(
        `SELECT id, payload, computed_at, to_char(range_end, 'YYYY-MM-DD') AS range_end_iso
         FROM public.vdf_deger_puan_history
         WHERE range_end <= ($1::date - 1)
         ORDER BY range_end DESC NULLS LAST, computed_at DESC
         LIMIT 1`,
        [istenenGun]
      );

      if (result.rows[0]) {
        row = result.rows[0];
        selectedHistoryId = Number(result.rows[0].id);
        tamEsleme = result.rows[0].range_end_iso === previousDayIso(istenenGun);
      }
    }

    if (!row && !gecmisGunIstendi) {
      const result = await pool.query(
        `SELECT id, payload, computed_at, to_char(range_end, 'YYYY-MM-DD') AS range_end_iso
         FROM public.vdf_deger_puan_history
         ORDER BY range_end DESC NULLS LAST, computed_at DESC
         LIMIT 1`
      );

      row = result.rows[0] ?? null;
    }

    const historyResult = await pool.query(
      `SELECT id, tarih, tarih2, computed_at
       FROM public.vdf_deger_puan_history
       ORDER BY range_end DESC NULLS LAST, computed_at DESC
       LIMIT 31`
    );

    const history = historyResult.rows.map((item) => ({
      id: Number(item.id),
      tarih: String(item.tarih),
      tarih2: String(item.tarih2),
      computedAt: new Date(item.computed_at).toISOString(),
    }));

    if (!row) {
      return json({
        success: true,
        hasSnapshot: false,
        bulunamadi: gecmisGunIstendi,
        istenenGun,
        history,
        aySonuPaylasim,
      });
    }

    const rawPayload = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload as Record<string, unknown>);

    // Mağaza girişine sadece ekranın gösterdiği alanlar gider (tanı alanları çıkarılır).
    const payload: Record<string, unknown> = { ...rawPayload };

    if (!isAdmin) {
      for (const key of ["withoutPuanExamples", "rowsWithPuan", "rowsWithoutPuan", "adetAlani", "kaynak", "kaynakOzeti", "sinif"]) {
        delete payload[key];
      }
    }
    const period = payload.period as { tarih: string; tarih2: string } | undefined;
    const rangeEnd = wingsmDateToIsoLocal(period?.tarih2);
    const isLatest = !selectedHistoryId;

    return json({
      ...payload,
      success: true,
      hasSnapshot: true,
      computedAt: new Date(row.computed_at).toISOString(),
      history,
      selectedHistoryId,
      istenenGun: gecmisGunIstendi ? istenenGun : null,
      tamEsleme,
      aySonuPaylasim,
      durum: isLatest ? (rangeEnd && rangeEnd >= previousDayIso(today) ? "guncel" : "bekleniyor") : null,
    });
  } catch (error) {
    console.error("VODAFONE_DEGER_PUAN_RESULT_ERROR:", error);

    return json(
      { success: false, error: error instanceof Error ? error.message : "Vodafone Değer Puan sonucu alınamadı." },
      500
    );
  }
}
