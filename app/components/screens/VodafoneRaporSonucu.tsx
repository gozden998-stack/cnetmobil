"use client";

// app/components/screens/VodafoneRaporSonucu.tsx
//
// Vodafone Değer Puan - kayıtlı rapor sonucunu GÜN SEÇİCİ ile gösterir (CMR'daki
// "Değer Puan Performansı" ekranının karşılığı). Hem yönetici (Vodafone > Rapor
// Sonucu sekmesi) hem Vodafone mağaza girişi (ana sayfa kartı > Tümünü Gör) bunu
// kullanır; fark `yonetici` ile belirlenir:
//   - yönetici: "Yönetici Önizlemesi" rozeti, rapor yoksa hesaplama yönlendirmesi.
//   - mağaza: sadece görüntüleme; rapor yoksa "Rapor bekleniyor" uyarısı.
//
// Rapor her gün 11:00'da otomatik yayınlanır (bkz. api/wingsm/vodafone/auto).
// Yeni güne geçildiyse ve o günün raporu henüz yayınlanmadıysa ESKİ rakamlar
// gösterilmez, "Rapor bekleniyor" yazar; ayın 28'inden 1'ine "Ay sonu raporu"
// duyurusu çıkar (CMR ile aynı kurallar).

import React, { useCallback, useEffect, useMemo, useState } from "react";

import VodafoneSonuc from "./VodafoneSonuc";
import { AY_SONU_MESAJI, formatRangeLong } from "./degerPuanOrtak";
import {
  DayPicker,
  dayPickLabel,
  dayPickToGun,
  formatIsoDate,
  istanbulToday,
  shiftDay,
  slashToIso,
  type DayPick,
} from "./degerPuanGunSecici";
import type { VodafoneReportView } from "./vodafoneDegerPuanTipleri";

export default function VodafoneRaporSonucu({ yonetici }: { yonetici: boolean }) {
  const [pick, setPick] = useState<DayPick>({ kind: "bugun" });
  const [period, setPeriod] = useState<string | null>(null);
  const [result, setResult] = useState<VodafoneReportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (gun: string | null, periodPick: string | null, silent = false) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const query = gun ? `?gun=${gun}` : periodPick ? `?period=${encodeURIComponent(periodPick)}` : "";
      const res = await fetch(`/api/wingsm/vodafone/result${query}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await res.json().catch(() => null);

      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }

      setResult(payload as VodafoneReportView);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Sonuç alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(dayPickToGun(pick), period);
  }, [pick, period, load]);

  // "Rapor bekleniyor" iken ekran açık kalırsa, 11:00'da rapor yayınlanınca
  // sayfayı yenilemeye gerek kalmasın: 2 dakikada bir sessizce tekrar sorulur.
  const waiting = result?.durum === "bekleniyor" || (result !== null && !result.hasSnapshot && !result.bulunamadi);

  useEffect(() => {
    if (!waiting || pick.kind !== "bugun") return;

    const id = window.setInterval(() => {
      void load(null, period, true);
    }, 120_000);

    return () => window.clearInterval(id);
  }, [waiting, pick.kind, period, load]);

  const minPickDate = useMemo(() => {
    const earliest = (result?.history ?? [])
      .map((item) => slashToIso(item.tarih2))
      .filter((value): value is string => Boolean(value))
      .sort()[0];

    return earliest ? shiftDay(earliest, 1) : undefined;
  }, [result]);

  // Dönem listesi: kayıtlı raporların ayları (en yeni üstte).
  const periods = useMemo(() => {
    const months = new Set<string>();

    for (const item of result?.history ?? []) {
      const parts = item.tarih2.split("/");
      if (parts.length === 3) months.add(`${parts[2]}-${parts[1]}`);
    }

    if (result?.hedefPeriodu) months.add(result.hedefPeriodu);

    return Array.from(months).sort().reverse();
  }, [result]);

  const beklemede = result?.hasSnapshot === true && result.durum === "bekleniyor";
  const raporYok = result !== null && !result.hasSnapshot && !result.bulunamadi;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {result?.durum === "guncel" && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-[11px] font-black text-emerald-700">
            ✓ Rapor güncel
          </span>
        )}
        {(beklemede || raporYok) && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
            {result?.aySonuPaylasim ? "Ay sonu: otomatik yayın durdu" : "⏳ Rapor bekleniyor"}
          </span>
        )}
        {result?.hasSnapshot && result.durum === null && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-black text-amber-800">
            Eski rapor görüntüleniyor
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <DayPicker
            label={dayPickLabel(pick)}
            disabled={loading}
            minDate={minPickDate}
            maxDate={istanbulToday()}
            onSelect={(next) => {
              setPeriod(null);
              setPick(next);
            }}
          />
        </div>
      </div>

      {result?.hasSnapshot && result.period && !beklemede && (
        <div
          className={`mb-4 rounded-xl border px-4 py-2.5 text-sm font-bold ${
            result.durum === null ? "border-amber-300 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"
          }`}
        >
          {result.istenenGun ? `${formatIsoDate(result.istenenGun)} tarihli rapor: ` : "Güncel rapor: "}
          {formatRangeLong(result.period.tarih, result.period.tarih2)} arası
          {result.istenenGun && result.tamEsleme === false && (
            <span className="ml-1 font-semibold">
              (o gün için ayrı rapor hazırlanmamıştı, en yakın önceki rapor gösteriliyor)
            </span>
          )}
        </div>
      )}

      {loading && !result && <div className="text-sm font-bold text-slate-400">Yükleniyor...</div>}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>
      )}

      {result && !result.hasSnapshot && result.bulunamadi && (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-bold text-slate-500">
          {result.istenenGun ? `${formatIsoDate(result.istenenGun)} tarihi için` : "Bu tarih için"} kayıtlı rapor bulunamadı.
        </div>
      )}

      {/* Hiç rapor yok ya da yeni güne geçildi ve rapor henüz yayınlanmadı: eski rakamlar GÖSTERİLMEZ. */}
      {(raporYok || beklemede) && (
        <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-12 text-center shadow-sm">
          <div className="text-5xl">{result?.aySonuPaylasim ? "📢" : "⏳"}</div>
          <div className="mt-4 text-2xl font-black text-[#1b2559]">
            {result?.aySonuPaylasim ? "Ay sonu raporu" : "Rapor bekleniyor"}
          </div>
          <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
            {result?.aySonuPaylasim
              ? AY_SONU_MESAJI
              : "Vodafone Değer Puan raporu her gün saat 11:00'da otomatik yayınlanır; yayınlanınca burada görünecek."}
          </p>
          {beklemede && (
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Önceki günün raporunu görmek için sağ üstteki seçiciden &quot;Dün&quot;ü seçebilirsiniz.
            </p>
          )}
          {raporYok && yonetici && (
            <p className="mt-3 text-xs font-semibold text-slate-400">
              Yönetici: hedefler girildiyse Rapor sekmesinden HESAPLA ile hemen yayınlayabilirsiniz.
            </p>
          )}
        </div>
      )}

      {result && result.hasSnapshot && !beklemede && (
        <VodafoneSonuc
          report={result}
          yoneticiOnizlemesi={yonetici}
          periods={periods}
          period={result.hedefPeriodu}
          onPeriodChange={(next) => {
            setPick({ kind: "bugun" });
            setPeriod(next === periods[0] ? null : next);
          }}
        />
      )}
    </div>
  );
}
