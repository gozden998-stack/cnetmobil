"use client";

// app/components/screens/SirketDegerPuanOzeti.tsx
//
// CNETMOBIL - Ana sayfa "Aylık Performans" kartındaki "Şirket Değer Puan"
// görünümü: WingSM Değer Puan'ın KISA özeti (4 mağaza + ilk 5 personel).
// Tam ekran için "Tümünü Gör" ile WingSM Değer Puan ekranına gidilir.
//
// Veri /api/wingsm/deger-puanim'den gelir (adminin / otomatik günlük hesabın
// kaydettiği son rapor). Ana sayfa mevcut "Puan" kutularından (Google Sheets
// hedef puanları) FARKLI bir sistemdir, bu yüzden adı "Şirket Değer Puan".

import React, { useEffect, useState } from "react";

import {
  AY_SONU_MESAJI,
  formatComputedAt,
  formatNumber,
  formatPercent,
  formatRangeLong,
  formatStoreName,
  ProgressBar,
  titleCaseTr,
  type DegerPuanimReport,
} from "./degerPuanOrtak";
import { magazaGostergeRengi, magazalariSirala, personelGostergeRengi } from "./degerPuanRenkleri";

function RankDot({ rank }: { rank: number | null }) {
  if (rank === null) {
    return <span className="inline-flex h-6 w-6 items-center justify-center text-sm font-bold text-slate-400">-</span>;
  }

  const style =
    rank === 1
      ? "bg-amber-400 text-white"
      : rank === 2
        ? "bg-slate-300 text-slate-700"
        : rank === 3
          ? "bg-orange-400 text-white"
          : "border border-slate-300 bg-white text-slate-600";

  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${style}`}>
      {rank}
    </span>
  );
}

export default function SirketDegerPuanOzeti({ onTumunuGor }: { onTumunuGor: () => void }) {
  const [report, setReport] = useState<DegerPuanimReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/wingsm/deger-puanim", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await res.json().catch(() => null);

        if (!res.ok || !payload?.success) {
          throw new Error(payload?.error || `HTTP ${res.status}`);
        }

        if (!cancelled) {
          setReport(payload as DegerPuanimReport);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Şirket Değer Puan alınamadı.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center text-sm font-bold text-slate-400">
        Şirket Değer Puan yükleniyor...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700 sm:m-5">
        {error || "Şirket Değer Puan alınamadı."}
      </div>
    );
  }

  if (!report.hasSnapshot) {
    return (
      <div className="m-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-500 sm:m-5">
        Bu ay için henüz Değer Puan raporu hesaplanmadı. Yönetici hesapladığında burada görünecek.
      </div>
    );
  }

  const stores = magazalariSirala(report.stores);
  const topPersonnel = report.personnel
    .filter((person) => !person.isManager && person.hedefYuzdesi !== null && person.siralama !== null)
    .slice(0, 5);

  const aySonuDuyurusu = Boolean(report.aySonuPaylasim) && report.durum === "bekleniyor";

  return (
    <div className="p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
          {report.durum === "guncel" && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-700">✓ Rapor güncellendi</span>
          )}
          {report.durum === "bekleniyor" && !aySonuDuyurusu && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-amber-700">⏳ Rapor bekleniyor</span>
          )}
          {report.period && (
            <span className="text-slate-500">
              Güncel rapor: {formatRangeLong(report.period.tarih, report.period.tarih2)} arası
            </span>
          )}
          <span className="font-semibold text-slate-400">Son güncelleme: {formatComputedAt(report.computedAt)}</span>
        </div>

        <button
          type="button"
          onClick={onTumunuGor}
          className="self-start text-[11px] font-black text-blue-600 hover:text-blue-700 sm:self-auto"
        >
          Tümünü Gör →
        </button>
      </div>

      {aySonuDuyurusu && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-900">
          📢 {AY_SONU_MESAJI}
        </div>
      )}

      {/* Mağazalar */}
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
                  <span className="text-xs font-black text-[#102A56]">{formatStoreName(store.branchLabel)}</span>
                </div>
                <span className={`text-lg font-black ${colors.text}`}>{formatPercent(store.hedefYuzdesi)}</span>
              </div>
              <div className="mt-1.5">
                <ProgressBar percent={store.hedefYuzdesi} barClass={colors.bar} />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1 text-[10px] font-semibold text-slate-400 sm:grid-cols-2">
                <div>
                  Gerçekleşen
                  <div className="text-xs font-black text-[#102A56]">{formatNumber(store.carpanliPuan)}</div>
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

      {/* İlk 5 personel */}
      <div className="mt-5">
        <h3 className="mb-2 text-sm font-black text-[#102A56]">En İyi 5 Personel</h3>
        <div className="divide-y divide-slate-100 rounded-xl border border-slate-100">
          {topPersonnel.map((person) => {
            const colors = personelGostergeRengi(person.siralama);

            return (
              <div
                key={`${person.branchLabel}-${person.saticiKod || person.saticiAdi}`}
                className="flex items-center gap-3 px-3 py-2"
              >
                <RankDot rank={person.siralama} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-[#102A56]">
                    {titleCaseTr(person.saticiAdi || person.saticiKod)}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-400">{formatStoreName(person.branchLabel)}</div>
                </div>
                <div className="hidden w-28 sm:block">
                  <ProgressBar percent={person.hedefYuzdesi} barClass={colors.bar} />
                </div>
                <span className={`w-16 text-right text-sm font-black ${colors.text}`}>
                  {formatPercent(person.hedefYuzdesi)}
                </span>
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
