"use client";

// app/components/screens/VodafoneSonuc.tsx
//
// Vodafone Değer Puan sonucu - Excel görünümü: solda personel (Adı Soyadı /
// Gerçekleşme / Projeksiyon / Sıralama / Sıralama puanı), sağda mağazalar
// (+ toplam ve ortalamalar), gün kutusu. Satır renkleri CMR ile aynı kural
// (degerPuanRenkleri.ts).

import React from "react";

import { formatComputedAt, formatNumber, formatPercent, formatRangeLong, titleCaseTr } from "./degerPuanOrtak";
import { magazaSatirRengi, magazalariSirala, personelSatirRengi } from "./degerPuanRenkleri";
import type { VodafoneReportView } from "./vodafoneDegerPuanTipleri";

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function periodLabel(period: string | undefined) {
  const match = String(period ?? "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return "-";
  return `${AYLAR[Number(match[2]) - 1] ?? match[2]} ${match[1]}`;
}

export default function VodafoneSonuc({ report }: { report: VodafoneReportView }) {
  const stores = magazalariSirala(report.stores ?? []);
  const personnel = report.personnel ?? [];
  const gun = report.gunBilgisi;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">
          Değer Puan · {periodLabel(report.hedefPeriodu)}
        </span>
        {report.period && (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            {formatRangeLong(report.period.tarih, report.period.tarih2)} arası
          </span>
        )}
        {gun && (
          <>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-800">Gün: {gun.gecenGun}</span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Kalan gün: {gun.kalanGun}</span>
            <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">Bu ay gün: {gun.ayToplamGun}</span>
          </>
        )}
        {report.computedAt && (
          <span className="font-semibold text-slate-400">Hesaplandı: {formatComputedAt(report.computedAt)}</span>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* PERSONEL */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="bg-yellow-300 text-[11px] font-black uppercase text-slate-900">
                  <th className="px-3 py-2">Adı Soyadı</th>
                  <th className="px-3 py-2 text-right">Gerçekleşme</th>
                  <th className="px-3 py-2 text-right">Projeksiyon</th>
                  <th className="px-3 py-2 text-right">Sıralama</th>
                  <th className="px-3 py-2 text-right">Puan</th>
                </tr>
              </thead>
              <tbody>
                {personnel.map((person) => (
                  <tr
                    key={`${person.saticiAdi}-${person.saticiKod}`}
                    className={`border-t border-white/60 text-[12px] font-semibold ${personelSatirRengi(person.siralama)}`}
                  >
                    <td className="px-3 py-1.5 font-bold">
                      {titleCaseTr(person.saticiAdi || person.saticiKod)}
                      <span className="ml-2 text-[10px] font-semibold text-slate-500">{person.branchLabel}</span>
                      {person.isManager && (
                        <span className="ml-2 rounded bg-slate-900/10 px-1.5 py-0.5 text-[9px] font-black uppercase">Müdür</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(person.puan)}</td>
                    <td className="px-3 py-1.5 text-right">{formatNumber(person.projeksiyon)}</td>
                    <td className="px-3 py-1.5 text-right">
                      {person.hedefYuzdesi === null ? "-" : formatPercent(person.hedefYuzdesi)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-black">{person.siralamaPuani > 0 ? person.siralamaPuani : ""}</td>
                  </tr>
                ))}
                {personnel.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-xs font-bold text-slate-400">
                      Personel verisi yok. Önce Hedefler sekmesine personeli girin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* MAĞAZALAR */}
        <section className="space-y-3">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left">
                <thead>
                  <tr className="bg-yellow-300 text-[11px] font-black uppercase text-slate-900">
                    <th className="px-3 py-2">Mağazalar</th>
                    <th className="px-3 py-2 text-right">Gerçekleşme</th>
                    <th className="px-3 py-2 text-right">Projeksiyon</th>
                    <th className="px-3 py-2 text-right">Sıralama</th>
                    <th className="px-3 py-2 text-right">Puan Projex</th>
                    <th className="px-3 py-2 text-right">Puan</th>
                  </tr>
                </thead>
                <tbody>
                  {stores.map((store, index) => (
                    <tr
                      key={store.depotCode}
                      className={`border-t border-white/60 text-[12px] font-semibold ${magazaSatirRengi(index, store.hedefYuzdesi !== null)}`}
                    >
                      <td className="px-3 py-2 font-black">{store.branchLabel}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(store.puan)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(store.projeksiyon, 2)}</td>
                      <td className="px-3 py-2 text-right">
                        {store.hedefYuzdesi === null ? "-" : formatPercent(store.hedefYuzdesi)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {store.puanProjex === null ? "-" : formatNumber(store.puanProjex, 2)}
                      </td>
                      <td className="px-3 py-2 text-right font-black">{store.siralamaPuani > 0 ? store.siralamaPuani : ""}</td>
                    </tr>
                  ))}
                  {report.totals && (
                    <tr className="border-t-2 border-slate-300 bg-slate-50 text-[12px] font-black">
                      <td className="px-3 py-2">TOPLAM</td>
                      <td className="px-3 py-2 text-right">{formatNumber(report.totals.gerceklesen, 2)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(report.totals.projeksiyon, 2)}</td>
                      <td colSpan={3} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {report.totals && (
            <div className="grid grid-cols-2 gap-3 text-[11px] font-black uppercase">
              <div className="rounded-xl bg-yellow-300 px-4 py-3 text-slate-900">
                Projek. ortalama
                <div className="mt-1 text-lg">{formatNumber(report.totals.projeksiyonOrtalama, 2)}</div>
              </div>
              <div className="rounded-xl bg-yellow-300 px-4 py-3 text-slate-900">
                Gerçek. ortalama
                <div className="mt-1 text-lg">{formatNumber(report.totals.gerceklesenOrtalama, 2)}</div>
              </div>
            </div>
          )}
        </section>
      </div>

      {(report.rowsWithoutPuan ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] font-bold text-amber-800">
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
