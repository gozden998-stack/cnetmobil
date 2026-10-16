"use client";

// app/components/screens/VodafoneSonuc.tsx
//
// Vodafone Değer Puan sonucu - "Değer Puanı" ekranı: üstte dönem / mağaza / personel
// arama ve gün bilgisi; solda PERSONEL SIRALAMASI (sıra, personel, gerçekleşen,
// projeksiyon, hedef oranı, sayfalı); sağda MAĞAZA SIRALAMASI kartları (ilerleme
// çubuğu, puan projeksiyonu, sıralama puanı) ve toplamlar. Renkler CMR ile aynı
// kuraldır (degerPuanRenkleri.ts): 1 koyu yeşil, 2-3 açık yeşil, 4-6 gri/beyaz,
// 7 turuncu, geri kalanı kırmızı.

import React, { useMemo, useState } from "react";

import { formatNumber, formatPercent, ProgressBar, titleCaseTr } from "./degerPuanOrtak";
import { magazaGostergeRengi, magazalariSirala, personelGostergeRengi } from "./degerPuanRenkleri";
import type { VodafoneReportView } from "./vodafoneDegerPuanTipleri";

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const PAGE_SIZE = 12;

export function periodLabel(period: string | undefined | null) {
  const match = String(period ?? "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "-";
  return `${AYLAR[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

// "SARAY VDF" -> "Saray VDF"
function storeLabel(label: string) {
  return titleCaseTr(label).replace(/\bVdf\b/, "VDF");
}

function RankCircle({ rank }: { rank: number | null }) {
  const style =
    rank === null
      ? "bg-slate-100 text-slate-400"
      : rank === 1
        ? "bg-green-700 text-white"
        : rank <= 3
          ? "bg-lime-400 text-green-950"
          : rank <= 6
            ? "bg-slate-200 text-slate-600"
            : rank === 7
              ? "bg-orange-400 text-white"
              : "bg-red-500 text-white";

  return (
    <span className={`inline-flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-black ${style}`}>
      {rank ?? "-"}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.5-3.5" />
    </svg>
  );
}

export default function VodafoneSonuc({
  report,
  yoneticiOnizlemesi = true,
  periods = [],
  period,
  onPeriodChange,
}: {
  report: VodafoneReportView;
  yoneticiOnizlemesi?: boolean;
  periods?: string[];
  period?: string;
  onPeriodChange?: (next: string) => void;
}) {
  const [storeFilter, setStoreFilter] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const allStores = useMemo(() => magazalariSirala(report.stores ?? []), [report.stores]);
  const gun = report.gunBilgisi;
  const periodOptions = periods.length > 0 ? periods : report.hedefPeriodu ? [report.hedefPeriodu] : [];

  const filteredPersonnel = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");

    return (report.personnel ?? []).filter((person) => {
      if (storeFilter && person.branchLabel !== storeFilter) return false;
      if (needle && !person.saticiAdi.toLocaleLowerCase("tr-TR").includes(needle)) return false;
      return true;
    });
  }, [report.personnel, storeFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filteredPersonnel.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filteredPersonnel.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const visibleStores = storeFilter ? allStores.filter((store) => store.branchLabel === storeFilter) : allStores;

  return (
    <div className="rounded-3xl bg-[#f6f8fc] p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-black tracking-tight text-[#0f1b3d]">Değer Puanı</h1>
        {yoneticiOnizlemesi && (
          <span className="rounded-lg border border-blue-400 bg-white px-3 py-1 text-xs font-bold text-blue-600">
            Yönetici Önizlemesi
          </span>
        )}
      </div>
      <p className="mt-1 text-sm font-medium text-slate-500">Mağaza ve personel performans takibi.</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={period ?? report.hedefPeriodu ?? ""}
          onChange={(e) => onPeriodChange?.(e.target.value)}
          disabled={!onPeriodChange || periodOptions.length <= 1}
          className="h-11 min-w-[150px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none"
        >
          {periodOptions.map((item) => (
            <option key={item} value={item}>
              {periodLabel(item)}
            </option>
          ))}
        </select>

        <select
          value={storeFilter}
          onChange={(e) => {
            setStoreFilter(e.target.value);
            setPage(1);
          }}
          className="h-11 min-w-[170px] rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none"
        >
          <option value="">Tüm Mağazalar</option>
          {allStores.map((store) => (
            <option key={store.depotCode} value={store.branchLabel}>
              {storeLabel(store.branchLabel)}
            </option>
          ))}
        </select>

        <label className="flex h-11 min-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Personel ara"
            className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
          />
        </label>

        {gun && (
          <span className="text-sm font-medium text-slate-500">
            {gun.gecenGun} gün geçti · {gun.kalanGun} gün kaldı
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* PERSONEL SIRALAMASI */}
        <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-lg font-black text-[#0f1b3d]">Personel Sıralaması</h2>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[460px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-500">
                  <th className="px-2 py-2.5">Sıra</th>
                  <th className="px-2 py-2.5">Personel</th>
                  <th className="px-2 py-2.5 text-right">Gerçekleşen</th>
                  <th className="px-2 py-2.5 text-right">Projeksiyon</th>
                  <th className="px-2 py-2.5 text-right">Hedef Oranı</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((person) => {
                  const rank = !person.isManager && person.hedefYuzdesi !== null ? person.siralama : null;
                  const colors = personelGostergeRengi(rank);

                  return (
                    <tr key={`${person.saticiAdi}-${person.saticiKod}`} className="border-b border-slate-50 last:border-0">
                      <td className="px-2 py-2.5">
                        <RankCircle rank={rank} />
                      </td>
                      <td className="px-2 py-2.5 text-sm font-semibold text-[#0f1b3d]">
                        {titleCaseTr(person.saticiAdi || person.saticiKod)}
                        {person.siralamaPuani > 0 && (
                          <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-black text-green-700">
                            +{person.siralamaPuani}
                          </span>
                        )}
                        {person.isManager && (
                          <span className="ml-2 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                            Müdür
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-right text-sm font-semibold text-slate-700">{formatNumber(person.puan)}</td>
                      <td className="px-2 py-2.5 text-right text-sm font-semibold text-slate-700">
                        {formatNumber(person.projeksiyon)}
                      </td>
                      <td className={`px-2 py-2.5 text-right text-sm font-black ${colors.text}`}>
                        {rank === null ? "-" : formatPercent(person.hedefYuzdesi)}
                      </td>
                    </tr>
                  );
                })}
                {pageRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-8 text-center text-xs font-bold text-slate-400">
                      {search || storeFilter
                        ? "Aramanıza uyan personel bulunamadı."
                        : "Personel verisi yok. Önce Hedefler sekmesine personeli girin."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-400">
            <span>
              {filteredPersonnel.length} personelden {pageRows.length} kişi gösteriliyor
            </span>

            {pageCount > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                  <button
                    key={number}
                    type="button"
                    onClick={() => setPage(number)}
                    className={`h-8 w-8 rounded-lg border text-xs font-bold ${
                      number === currentPage
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {number}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                  disabled={currentPage === pageCount}
                  className="h-8 w-8 rounded-lg border border-slate-200 bg-white text-slate-500 disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </section>

        {/* MAĞAZA SIRALAMASI */}
        <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <h2 className="px-4 pt-4 text-lg font-black text-[#0f1b3d] sm:px-5 sm:pt-5">Mağaza Sıralaması</h2>

          <div className="mt-2 divide-y divide-slate-100">
            {visibleStores.map((store) => {
              const index = allStores.findIndex((item) => item.depotCode === store.depotCode);
              const colors = magazaGostergeRengi(index, store.hedefYuzdesi !== null);
              const rank = store.hedefYuzdesi !== null ? index + 1 : null;

              return (
                <div key={store.depotCode} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-center gap-3">
                    <RankCircle rank={rank} />
                    <span className="text-base font-black text-[#0f1b3d]">{storeLabel(store.branchLabel)}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 pl-10 sm:flex-nowrap">
                    <div>
                      <div className="text-[11px] font-medium text-slate-400">Gerçekleşen</div>
                      <div className="text-sm font-black text-[#0f1b3d]">{formatNumber(store.puan)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-medium text-slate-400">Projeksiyon</div>
                      <div className="text-sm font-black text-[#0f1b3d]">{formatNumber(store.projeksiyon, 2)}</div>
                    </div>
                    <div className="min-w-[60px] flex-1">
                      <ProgressBar percent={store.hedefYuzdesi} barClass={colors.bar} />
                    </div>
                    <span className={`flex-none text-lg font-black ${colors.text}`}>{formatPercent(store.hedefYuzdesi)}</span>
                  </div>

                  <div className="mt-1.5 pl-10 text-[11px] font-medium text-slate-400">
                    Puan projeksiyonu{" "}
                    <b className="text-slate-500">{store.puanProjex === null ? "-" : formatNumber(store.puanProjex, 2)}</b>
                    <span className="mx-2 text-slate-300">|</span>
                    Şirket 90 ve üst <b className="text-slate-500">{store.siralamaPuani > 0 ? store.siralamaPuani : "—"}</b>
                  </div>
                </div>
              );
            })}
            {visibleStores.length === 0 && (
              <div className="px-5 py-8 text-center text-xs font-bold text-slate-400">Mağaza bulunamadı.</div>
            )}
          </div>

          {report.totals && (
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 px-4 py-3.5 sm:px-5">
              <div className="pr-3">
                <div className="text-[11px] font-medium text-slate-400">Toplam gerçekleşen</div>
                <div className="text-lg font-black text-[#0f1b3d]">{formatNumber(report.totals.gerceklesen)}</div>
              </div>
              <div className="pl-4">
                <div className="text-[11px] font-medium text-slate-400">Toplam projeksiyon</div>
                <div className="text-lg font-black text-[#0f1b3d]">{formatNumber(report.totals.projeksiyon, 2)}</div>
              </div>
            </div>
          )}
        </section>
      </div>

      {(report.rowsWithoutPuan ?? 0) > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-800">
          {report.rowsWithoutPuan} satırın ürün adı 3 haneli sayıyla bitmediği için puanı 0 sayıldı
          {report.withoutPuanExamples && report.withoutPuanExamples.length > 0
            ? ` (örnek: ${report.withoutPuanExamples.slice(0, 3).join(" | ")})`
            : ""}
          .
        </div>
      )}
    </div>
  );
}
