"use client";

// CNETMOBIL - CMR "Şampiyonlar Ligi" - mağaza/personel görünümü (salt okunur, ana sayfada)
// Sıralama her gün 10:00'dan sonra güncellenir. Tüm CMR mağazaları herkesin sıralamasını görür.

import React, { useCallback, useEffect, useState } from "react";

type Row = Record<string, any>;

const fmt = (value: unknown, digits = 0) => (value === null || value === undefined ? "-" : Number(value).toLocaleString("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
const dateTr = (iso: unknown) => (iso ? String(iso).split("-").reverse().join(".") : "-");
const same = (a: unknown, b: unknown) => String(a ?? "").trim().toLocaleUpperCase("tr-TR") === String(b ?? "").trim().toLocaleUpperCase("tr-TR");

// kaynak "yayin": mağazaların gördüğü (her gün 12:30 otomatik). "test": yöneticinin Hesapla sonucu (yalnız yönetici önizlemesi).
export default function SampiyonlarLigiSonuc({ kaynak = "yayin" }: { kaynak?: "yayin" | "test" }) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/wingsm/yarisma/sonuc${kaynak === "test" ? "?kaynak=test" : ""}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setData(payload);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Yarışma bilgisi alınamadı.");
    }
  }, [kaynak]);

  useEffect(() => {
    void load();

    // Rapor yayınlanınca ekran kendiliğinden yenilensin (2 dakikada bir, sessiz)
    const timer = window.setInterval(() => void load(), 120_000);

    return () => window.clearInterval(timer);
  }, [load]);

  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[13px] font-bold text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 text-center text-[13px] font-semibold text-slate-400">Yükleniyor...</div>;

  const config: Row = data.config ?? {};
  const standing: Row[] = Array.isArray(data.standing) ? data.standing : [];
  const prizes: Row[] = Array.isArray(data.prizes) ? data.prizes : Array.isArray(data.prizeList) ? data.prizeList : [];
  const pre: Row | null = data.precondition ?? null;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const remaining = config.endDate ? Math.max(0, Math.round((Date.parse(`${config.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1) : 0;
  const visible = showAll ? standing : standing.slice(0, 10);
  const growth = pre?.available && typeof pre.growthPct === "number" ? pre.growthPct : null;
  const barPct = growth === null ? 0 : Math.max(0, Math.min(100, (growth / (pre?.required || 15)) * 100));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 p-5">
        <div className="text-[20px] font-black text-slate-900">🏆 {config.title || "Şampiyonlar Ligi"}</div>
        <div className="mt-1 text-[13px] font-semibold text-slate-600">
          {dateTr(config.startDate)} - {dateTr(config.endDate)} · <b>{remaining} gün kaldı</b>
          {data.computedAt ? ` · Son güncelleme: ${new Date(data.computedAt).toLocaleString("tr-TR")}` : ""}
        </div>
        <div className="mt-2 text-[12px] font-semibold text-slate-500">
          Puan = Değer Puan + stok cihaz satışı başına +{config.bonusPoints ?? 125} puan. Sıralama, kişi hedefinin yüzde kaçı tamamlandığına göre. İlk iki ödül aynı ekipten (Cadde-Saray veya Kapaklı-Meydan) olmalıdır.
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {prizes.map((prize) => (
          <div key={prize.rank} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[12px] font-black uppercase text-amber-600">{prize.rank}. Ödül</div>
            <div className="text-[16px] font-black text-slate-900">{prize.label}</div>
            <div className="mt-1 text-[13px] font-bold text-slate-600">{prize.winner || (data.hasResult === false ? "Henüz belli değil" : "-")}</div>
          </div>
        ))}
      </div>

      {data.hasResult === false ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-[13px] font-semibold text-slate-500">
          Sıralama ilk hesaplandığında burada görünecek. Rapor her gün 12:30&apos;dan sonra güncellenir.
        </div>
      ) : (
        <>
          {pre && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-1 flex items-center justify-between text-[13px] font-black text-slate-800">
                <span>Önkoşul: şirket cihaz satışı +%{pre.required ?? 15}</span>
                <span className={pre.met ? "text-emerald-600" : "text-slate-500"}>{growth === null ? "Hesaplanıyor" : `Şu an %${fmt(growth, 1)}`}</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${pre.met ? "bg-emerald-500" : "bg-amber-400"}`} style={{ width: `${barPct}%` }} />
              </div>
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <table className="w-full min-w-[620px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
                  <th className="px-3 py-2">Sıra</th>
                  <th className="px-3 py-2">Personel</th>
                  <th className="px-3 py-2">Mağaza</th>
                  <th className="px-3 py-2 text-right">Puan</th>
                  <th className="px-3 py-2 text-right">Stok cihaz</th>
                  <th className="px-3 py-2 text-right">Hedef %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((person) => {
                  const mine = same(person.branchLabel, data.myBranch);
                  const prize = prizes.find((item) => item.winner && item.winner === person.saticiAdi);

                  return (
                    <tr key={`${person.saticiAdi}-${person.siralama}`} className={`text-[13px] text-slate-800 ${mine ? "bg-blue-50/60" : ""}`}>
                      <td className="px-3 py-2 font-black">{person.siralama}</td>
                      <td className="px-3 py-2 font-bold">
                        {person.saticiAdi}
                        {prize && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">{prize.rank}. ödül</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold">{person.branchLabel}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(person.toplamPuan)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{person.stokAdet > 0 ? `${person.stokAdet} (+${fmt(person.bonus)})` : "-"}</td>
                      <td className="px-3 py-2 text-right font-black">%{fmt(person.yuzde, 1)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {standing.length > 10 && (
              <button type="button" onClick={() => setShowAll((value) => !value)} className="mt-3 text-[13px] font-black text-blue-700 hover:underline">
                {showAll ? "İlk 10'u göster" : `Tümünü göster (${standing.length} kişi)`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
