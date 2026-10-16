"use client";

// app/components/screens/VodafoneDegerPuanOzeti.tsx
//
// Ana sayfa "Şirket Değer Puan" kartının VODAFONE görünümü (SirketDegerPuanOzeti'nin
// kardeşi): 4 mağaza + ilk 5 personel. Şimdilik SADECE yönetici görür; veri
// /api/wingsm/vodafone/result'tan gelir (yönetici oturumu ister).

import React, { useEffect, useState } from "react";

import { AY_SONU_MESAJI, formatComputedAt, formatNumber, formatPercent, formatRangeLong, ProgressBar, titleCaseTr } from "./degerPuanOrtak";
import { magazaGostergeRengi, magazalariSirala, personelGostergeRengi } from "./degerPuanRenkleri";
import type { VodafoneReportView } from "./vodafoneDegerPuanTipleri";

// "SARAY VDF" -> "Saray VDF"
function storeLabel(label: string) {
  return titleCaseTr(label).replace(/Vdf/, "VDF");
}

export default function VodafoneDegerPuanOzeti({
  onTumunuGor,
  yonetici = false,
}: {
  onTumunuGor: () => void;
  yonetici?: boolean;
}) {
  const [report, setReport] = useState<VodafoneReportView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/wingsm/vodafone/result", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload?.success) {
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }

        if (!cancelled) setReport(payload as VodafoneReportView);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Vodafone Değer Puan alınamadı.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // "Rapor bekleniyor" iken kart açık kalırsa, 11:00'da rapor yayınlanınca sayfayı
  // yenilemeye gerek kalmasın: 2 dakikada bir sessizce tekrar sorulur.
  const beklemedeMi = report !== null && (!report.hasSnapshot || report.durum === "bekleniyor");

  useEffect(() => {
    if (!beklemedeMi) return;

    const id = window.setInterval(() => {
      fetch("/api/wingsm/vodafone/result", { method: "GET", credentials: "same-origin", cache: "no-store" })
        .then((res) => res.json().catch(() => null))
        .then((payload) => {
          if (payload?.success && payload.hasSnapshot && payload.durum === "guncel") {
            setReport(payload as VodafoneReportView);
          }
        })
        .catch(() => {
          // Arka plan kontrolü kartı bozmaz.
        });
    }, 120_000);

    return () => window.clearInterval(id);
  }, [beklemedeMi]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm font-bold text-slate-400">
        Vodafone Değer Puan yükleniyor...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 sm:m-5">
        {error || "Vodafone Değer Puan alınamadı."}
      </div>
    );
  }

  if (!report.hasSnapshot) {
    return (
      <div className="p-4 sm:p-5">
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl bg-slate-50 px-6 py-10 text-center">
          <div className="text-4xl">⏳</div>
          <div className="mt-3 text-xl font-black text-[#102A56]">Rapor bekleniyor</div>
          <p className="mt-1.5 max-w-sm text-xs font-semibold text-slate-500">
            Vodafone Değer Puan raporu her gün saat 11:00&apos;da otomatik yayınlanır.
            {yonetici ? " Yönetici: Değer Puan > Vodafone Kanalı > Rapor sekmesinden hemen hesaplayabilirsiniz." : ""}
          </p>
        </div>
      </div>
    );
  }

  const beklemede = report.durum === "bekleniyor";
  const aySonuDuyurusu = Boolean(report.aySonuPaylasim) && beklemede;

  if (beklemede) {
    return (
      <div className="p-4 sm:p-5">
        <div className="mb-2 flex justify-end">
          <button type="button" onClick={onTumunuGor} className="text-[11px] font-black text-blue-600 hover:text-blue-700">
            Tümünü Gör →
          </button>
        </div>
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl bg-slate-50 px-6 py-10 text-center">
          <div className="text-4xl">{aySonuDuyurusu ? "📢" : "⏳"}</div>
          <div className="mt-3 text-xl font-black text-[#102A56]">{aySonuDuyurusu ? "Ay sonu raporu" : "Rapor bekleniyor"}</div>
          <p className="mt-1.5 max-w-sm text-xs font-semibold text-slate-500">
            {aySonuDuyurusu ? AY_SONU_MESAJI : "Yeni günün raporu 11:00'da yayınlanınca burada otomatik görünecek."}
          </p>
        </div>
      </div>
    );
  }

  const stores = magazalariSirala(report.stores ?? []);
  const topPersonnel = (report.personnel ?? [])
    .filter((person) => !person.isManager && person.hedefYuzdesi !== null && person.siralama !== null)
    .slice(0, 5);

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700">✓ Rapor güncellendi</span>
          {report.period && (
            <span className="text-slate-500">
              Güncel rapor: {formatRangeLong(report.period.tarih, report.period.tarih2)} arası
            </span>
          )}
          <span className="font-semibold text-slate-400">Son güncelleme: {formatComputedAt(report.computedAt ?? null)}</span>
        </div>

        <button
          type="button"
          onClick={onTumunuGor}
          className="self-start text-[11px] font-black text-blue-600 hover:text-blue-700 sm:self-auto"
        >
          Tümünü Gör →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stores.map((store, index) => {
          const colors = magazaGostergeRengi(index, store.hedefYuzdesi !== null);

          return (
            <div key={store.depotCode} className="relative rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              {store.siralamaPuani > 0 && (
                <span
                  className={`absolute -top-2.5 right-2 rounded-full px-2 py-0.5 text-[10px] font-black shadow-sm ${
                    index === 0 ? "bg-green-700 text-white" : "bg-lime-400 text-green-900"
                  }`}
                >
                  {store.siralamaPuani} PUAN
                </span>
              )}
              <div className="flex flex-col items-start gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-blue-50 text-[9px] font-black text-blue-700">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-xs font-black text-[#102A56]">{storeLabel(store.branchLabel)}</span>
                </div>
                <span className={`text-lg font-black ${colors.text}`}>{formatPercent(store.hedefYuzdesi)}</span>
              </div>
              <div className="mt-1.5">
                <ProgressBar percent={store.hedefYuzdesi} barClass={colors.bar} />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] font-semibold text-slate-400 sm:grid-cols-2">
                <div>
                  Gerçekleşen
                  <div className="text-xs font-black text-[#102A56]">{formatNumber(store.puan)}</div>
                </div>
                <div>
                  Ay sonu tahmini
                  <div className="text-xs font-black text-[#102A56]">{formatNumber(store.projeksiyon)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-black text-[#102A56]">En İyi 5 Personel</h3>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {topPersonnel.map((person) => {
            const colors = personelGostergeRengi(person.siralama);

            return (
              <div key={`${person.saticiAdi}-${person.saticiKod}`} className="flex items-center gap-3 px-3 py-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-black text-slate-600">
                  {person.siralama}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#102A56]">
                    {titleCaseTr(person.saticiAdi || person.saticiKod)}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">{storeLabel(person.branchLabel)}</div>
                </div>
                <div className="hidden w-28 sm:block">
                  <ProgressBar percent={person.hedefYuzdesi} barClass={colors.bar} />
                </div>
                <span className={`w-16 text-right text-sm font-black ${colors.text}`}>{formatPercent(person.hedefYuzdesi)}</span>
                <span className="w-10 text-right text-xs font-bold text-slate-500">
                  {person.siralamaPuani > 0 ? `${person.siralamaPuani} P` : "-"}
                </span>
              </div>
            );
          })}
          {topPersonnel.length === 0 && (
            <div className="px-3 py-6 text-center text-xs font-bold text-slate-400">Henüz sıralamaya giren personel yok.</div>
          )}
        </div>
      </div>
    </div>
  );
}
