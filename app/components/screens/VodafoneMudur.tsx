"use client";

// CNETMOBIL - Vodafone "Şampiyonlar Ligi Mağaza Müdürleri Yarışması" sekmesi (Vodafone girişlerinde görünür).
// CMR'deki ekranın aynısı: sıralama için yöneticinin belirlediği ŞİFRE girilir, 20 saniye sonra ekran yeniden kilitlenir.
// Her gün 12:30'da yayınlanır (dünün verisine kadar), gün seçici, 28'inde yayın durur. Hesapla (test) sonucu yalnız yöneticiye görünür.

import React from "react";

import SampiyonlarLigiMudur from "./SampiyonlarLigiMudur";

type Row = Record<string, any>;

const fmt = (value: unknown, digits = 0) => (value === null || value === undefined ? "-" : Number(value).toLocaleString("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
const dateTr = (iso: unknown) => (iso ? String(iso).split("-").reverse().join(".") : "-");
const same = (a: unknown, b: unknown) => String(a ?? "").trim().toLocaleUpperCase("tr-TR") === String(b ?? "").trim().toLocaleUpperCase("tr-TR");

function VodafoneMudurKarti({ mudur }: { mudur: Row }) {
  const rows: Row[] = Array.isArray(mudur?.rows) ? mudur.rows : [];
  const prizes: Row[] = Array.isArray(mudur?.prizes) ? mudur.prizes : [];
  const base = mudur?.baselineRange;
  const range = mudur?.range;
  const weight: Row = mudur?.agirlik ?? {};

  return (
    <div className="space-y-3 rounded-2xl border border-red-200 bg-gradient-to-r from-red-50/60 to-white p-4 shadow-sm">
      <div>
        <div className="text-[16px] font-black text-slate-900">🏆 {mudur?.title || "Vodafone Mağaza Müdürleri Yarışması"}</div>
        <div className="text-[12px] font-semibold text-slate-500">
          Tekil cihaz (temlikli satış) ağırlıklı toplamı: Samsung ×{fmt(weight.samsung, 2)} + Samsung premium (S / Fold / Flip) ×{fmt(weight.premium, 2)} + diğer marka ×{fmt(weight.diger, 0)}. Oran = {dateTr(range?.from)} - {dateTr(range?.to)} toplamı ÷{" "}
          {base ? `${dateTr(base.from)} - ${dateTr(base.to)}` : "önceki dönem"} toplamı. Oranı en yüksek mağazanın müdürü kazanır.
          {mudur?.computedAt ? ` · Son güncelleme: ${new Date(mudur.computedAt).toLocaleString("tr-TR")}` : ""}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {prizes.map((prize) => (
          <div key={prize.rank} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="text-[12px] font-black uppercase text-amber-600">{prize.rank}. Mağaza Müdürü</div>
            <div className="text-[15px] font-black text-slate-900">{prize.label}</div>
            <div className="mt-0.5 text-[13px] font-bold text-slate-600">{prize.branchLabel ? `${prize.branchLabel} · ${prize.winner}` : "Henüz belli değil"}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
              <th className="px-3 py-2">Sıra</th>
              <th className="px-3 py-2">Mağaza</th>
              <th className="px-3 py-2">Müdür</th>
              <th className="px-3 py-2 text-right">{base ? `${dateTr(base.from).slice(0, 5)}-${dateTr(base.to).slice(0, 5)}` : "Önceki"}</th>
              <th className="px-3 py-2 text-right">{range ? `${dateTr(range.from).slice(0, 5)}-${dateTr(range.to).slice(0, 5)}` : "Şimdi"}</th>
              <th className="px-3 py-2 text-right">Oran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.branchLabel} className={`text-[13px] text-slate-800 ${same(row.branchLabel, mudur?.myBranch) ? "bg-blue-50/60" : ""}`}>
                <td className="px-3 py-2 font-black">{row.siralama ?? "-"}</td>
                <td className="px-3 py-2 font-bold">{row.branchLabel}</td>
                <td className="px-3 py-2 font-semibold">{Array.isArray(row.managers) && row.managers.length ? row.managers.join(", ") : "-"}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(row.baseline, 2)}</td>
                <td className="px-3 py-2 text-right font-semibold">{fmt(row.current, 2)}</td>
                <td className="px-3 py-2 text-right font-black">{row.ratioPct === null || row.ratioPct === undefined ? "-" : `%${fmt(row.ratioPct, 1)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// kaynak "yayin": mağazaların gördüğü (şifreli). "test": yöneticinin Hesapla sonucu (şifresiz önizleme).
export default function VodafoneMudur({ kaynak = "yayin" }: { kaynak?: "yayin" | "test" }) {
  return (
    <SampiyonlarLigiMudur
      kaynak={kaynak}
      endpoint="/api/wingsm/vodafone/yarisma/mudur"
      loginEndpoint="/api/wingsm/vodafone/yarisma/mudur/giris"
      storageKey="cnet_vdf_mudur_token"
      renderKart={(mudur) => <VodafoneMudurKarti mudur={mudur} />}
    />
  );
}
