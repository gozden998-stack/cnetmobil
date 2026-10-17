// app/api/wingsm/gidisat/sonuc/route.ts
//
// CNETMOBIL - Personel Gidişat - KAYITLI SONUCU OKU.
//   Yönetici: tüm kişiler + tanı alanları.
//   CMR mağaza girişi (CMR MERKEZ/CADDE/SARAY/KAPAKLI): SADECE kendi mağazasının personeli döner
//   (diğer mağazaların kişi/rakamları sunucudan hiç çıkmaz); tanı alanları (hedefsiz satıcılar,
//   alan adları, uyarılar, satır sayısı) verilmez. Diğer girişler (Vodafone vb.) 403.
//   GET                      -> en güncel rapor
//   GET ?gun=YYYY-MM-DD      -> o gün YAYINLANAN rapor (Dün / Önceki Gün / takvim). Bir günde
//                               yayınlanan rapor o günden bir önceki güne kadardır (CMR/Vodafone
//                               ile aynı kural). O gün için rapor yoksa en yakın önceki gösterilir.
//   GET ?period=YYYY-MM      -> o ayın en güncel raporu
//
// Cevapta ayrıca: durum ("guncel" = rapor aralığının bitişi DÜN ya da daha yeni, yoksa
// "bekleniyor"), aySonuPaylasim (ayın 28'i-1'i otomatik yayın durur), history (seçilebilir
// geçmiş günler).

import { NextRequest } from "next/server";

import { getPool, json, requireValidSession } from "../../score-rules/_shared";
import { isAutoRunDay } from "../../_deger-puan-auto";
import { istanbulTodayIso, previousDayIso } from "../../vodafone/_vodafone";
import { CMR_BRANCH_LABELS, ensureGidisatTables } from "../_gidisat";

function sameBranch(a: unknown, b: unknown) {
  return String(a ?? "").trim().toLocaleUpperCase("tr-TR") === String(b ?? "").trim().toLocaleUpperCase("tr-TR");
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function wingsmDateToIso(value: unknown): string | null {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
}

export async function GET(request: NextRequest) {
  const auth = requireValidSession(request);

  if (!auth.ok) {
    return auth.response;
  }

  const isAdmin = auth.session.role === "admin";
  const myBranch = String(auth.session.branch ?? "").trim();

  if (!isAdmin && !CMR_BRANCH_LABELS.some((label) => sameBranch(label, myBranch))) {
    return json({ success: false, error: "Bu ekran sadece CMR mağazalarına açıktır." }, 403);
  }

  try {
    const pool = getPool();
    await ensureGidisatTables(pool);

    const url = new URL(request.url);
    const today = istanbulTodayIso();
    const aySonuPaylasim = !isAutoRunDay(today);

    const periodParam = String(url.searchParams.get("period") || "").trim();
    const gunParam = url.searchParams.get("gun");
    const istenenGun = gunParam && /^\d{4}-\d{2}-\d{2}$/.test(gunParam) ? gunParam : null;
    const gecmisGunIstendi = Boolean(istenenGun && istenenGun < today);

    type Row = { payload: unknown; computed_at: string; range_end_iso: string | null };
    let row: Row | null = null;
    let eskiRapor = false;
    let tamEsleme = true;

    if (gecmisGunIstendi && istenenGun) {
      // O gün yayınlanan rapor: bitişi (gün - 1) olan, yoksa ondan önceki en yakın.
      const result = await pool.query(
        `SELECT payload, computed_at, to_char(range_end, 'YYYY-MM-DD') AS range_end_iso
         FROM public.gidisat_history
         WHERE range_end <= ($1::date - 1)
         ORDER BY range_end DESC NULLS LAST, computed_at DESC
         LIMIT 1`,
        [istenenGun]
      );

      if (result.rows[0]) {
        row = result.rows[0];
        eskiRapor = true;
        tamEsleme = result.rows[0].range_end_iso === previousDayIso(istenenGun);
      }
    } else if (/^\d{4}-\d{2}$/.test(periodParam)) {
      const result = await pool.query(
        `SELECT payload, computed_at, to_char(range_end, 'YYYY-MM-DD') AS range_end_iso
         FROM public.gidisat_history WHERE period = $1
         ORDER BY range_end DESC NULLS LAST, computed_at DESC LIMIT 1`,
        [periodParam]
      );

      row = result.rows[0] ?? null;
    } else {
      const result = await pool.query(
        `SELECT payload, computed_at, to_char(range_end, 'YYYY-MM-DD') AS range_end_iso
         FROM public.gidisat_history
         ORDER BY range_end DESC NULLS LAST, computed_at DESC LIMIT 1`
      );

      row = result.rows[0] ?? null;
    }

    const historyResult = await pool.query(
      `SELECT tarih, tarih2, computed_at FROM public.gidisat_history
       ORDER BY range_end DESC NULLS LAST, computed_at DESC LIMIT 62`
    );

    const history = historyResult.rows.map((item) => ({
      tarih: String(item.tarih),
      tarih2: String(item.tarih2),
      computedAt: new Date(item.computed_at).toISOString(),
    }));

    if (!row) {
      return json({
        success: true,
        hasReport: false,
        bulunamadi: gecmisGunIstendi,
        istenenGun,
        history,
        aySonuPaylasim,
      });
    }

    const fullPayload = typeof row.payload === "string" ? JSON.parse(row.payload) : (row.payload as Record<string, unknown>);

    // Mağaza girişi: kişiler sunucuda kendi mağazasına indirgenir, tanı alanları atılır.
    const payload: Record<string, unknown> = isAdmin
      ? fullPayload
      : {
          success: true,
          period: fullPayload.period,
          range: fullPayload.range,
          gunBilgisi: fullPayload.gunBilgisi,
          kategoriler: fullPayload.kategoriler,
          kisiler: (Array.isArray(fullPayload.kisiler) ? fullPayload.kisiler : []).filter(
            (person: { branchLabel?: unknown }) => sameBranch(person?.branchLabel, myBranch)
          ),
        };
    const range = payload.range as { tarih: string; tarih2: string } | undefined;
    const rangeEnd = wingsmDateToIso(range?.tarih2);
    const isLatest = !eskiRapor && !/^\d{4}-\d{2}$/.test(periodParam);

    return json({
      ...payload,
      success: true,
      hasReport: true,
      computedAt: new Date(row.computed_at).toISOString(),
      history,
      istenenGun: gecmisGunIstendi ? istenenGun : null,
      tamEsleme,
      aySonuPaylasim,
      durum: isLatest ? (rangeEnd && rangeEnd >= previousDayIso(today) ? "guncel" : "bekleniyor") : null,
    });
  } catch (error) {
    console.error("GIDISAT_SONUC_ERROR:", error);

    return json({ success: false, error: error instanceof Error ? error.message : "Sonuç alınamadı." }, 500);
  }
}
