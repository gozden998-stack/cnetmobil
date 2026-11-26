"use client";

// CNETMOBIL - Komple stok raporu (yönetici, salt okunur): grade dağılımı, yenileme uygunluğu (BTK), online kanal durumu
// Veriler DB'den okunur; Garantili'ye / pazaryerlerine / WingSM'e istek atılmaz.

import React, { useCallback, useEffect, useState } from "react";

type BtkGrup = "UYGUN" | "UYGUN_DEGIL" | "SORGULANMAMIS";
type KanalKodu = "N11" | "IDEFIX" | "IKAS" | "GARANTILI";

type GradeOzet = {
  grade: string;
  toplam: number;
  btk: Record<BtkGrup, number>;
  onlineAcik: number;
  onlineBekliyor: number;
  onlineKapali: number;
  uygunAmaKapali: number;
  kanal: Record<KanalKodu, number>;
};

type DepoOzet = { depo: string; toplam: number; uygun: number; uygunDegil: number; sorgulanmamis: number; onlineAcik: number; gradeler: Record<string, number> };

type Rapor = {
  toplam: number;
  btk: Record<BtkGrup, number>;
  onlineAcik: number;
  onlineBekliyor: number;
  onlineKapali: number;
  uygunAmaKapali: number;
  kanal: Record<KanalKodu, number>;
  gradeler: GradeOzet[];
  depolar: DepoOzet[];
  olusturuldu: string;
};

const KANAL_ETIKET: Record<KanalKodu, string> = { N11: "N11", IDEFIX: "İdefix", IKAS: "İKAS", GARANTILI: "Garantili" };

const GRADE_RENK: Record<string, string> = {
  "MÜKEMMEL": "#7c3aed",
  "ÇOK İYİ": "#2563eb",
  "İYİ": "#0891b2",
  OUTLET: "#f59e0b",
};
const gradeRenk = (grade: string) => GRADE_RENK[grade] ?? "#94a3b8";

const COLOR = { uygun: "#10b981", degil: "#f43f5e", yok: "#cbd5e1", acik: "#7c3aed", bekliyor: "#f59e0b", kapali: "#cbd5e1" };

const sayi = (value: number) => value.toLocaleString("tr-TR");
const yuzde = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

type Parca = { etiket: string; deger: number; renk: string };

// Yatay yığılmış çubuk: parçalar toplam genişliğe oranlanır (toplam = satırın kendi toplamı)
function Cubuk({ parcalar, toplam }: { parcalar: Parca[]; toplam: number }) {
  return (
    <div className="flex h-7 w-full overflow-hidden rounded-lg bg-slate-100">
      {parcalar.map((parca) =>
        parca.deger > 0 && toplam > 0 ? (
          <div
            key={parca.etiket}
            title={`${parca.etiket}: ${sayi(parca.deger)} (%${yuzde(parca.deger, toplam)})`}
            className="flex items-center justify-center text-[12px] font-black text-white"
            style={{ width: `${(parca.deger / toplam) * 100}%`, backgroundColor: parca.renk }}
          >
            {parca.deger / toplam >= 0.08 ? sayi(parca.deger) : ""}
          </div>
        ) : null
      )}
    </div>
  );
}

function Aciklama({ items }: { items: { etiket: string; renk: string }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-x-5 gap-y-1">
      {items.map((item) => (
        <span key={item.etiket} className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: item.renk }} />
          {item.etiket}
        </span>
      ))}
    </div>
  );
}

function Kutu({ baslik, alt, children }: { baslik: string; alt?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[15px] font-black text-slate-900">{baslik}</div>
      {alt && <div className="mb-4 mt-0.5 text-[12px] font-semibold text-slate-500">{alt}</div>}
      {!alt && <div className="mb-3" />}
      {children}
    </div>
  );
}

function Kart({ etiket, deger, alt, renk }: { etiket: string; deger: number; alt?: string; renk?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">{etiket}</div>
      <div className="mt-1 text-[30px] font-black leading-none" style={{ color: renk ?? "#0f172a" }}>
        {sayi(deger)}
      </div>
      {alt && <div className="mt-1.5 text-[12px] font-bold text-slate-500">{alt}</div>}
    </div>
  );
}

export default function StokRapor() {
  const [rapor, setRapor] = useState<Rapor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/stok-rapor", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRapor(payload.rapor);
    } catch (e: any) {
      setError(e?.message || "Stok raporu okunamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const gradeKolonlari = rapor ? rapor.gradeler.map((g) => g.grade) : [];
  const enBuyukKanal = rapor ? Math.max(1, ...Object.values(rapor.kanal)) : 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[18px] font-black text-slate-900">Stok Raporu</div>
          <div className="text-[12px] font-semibold text-slate-500">
            Stok = panelde AVAILABLE + WingSM IN_STOCK. Yenileme durumu son Garantili sorgusundan, online durumu panel kayıtlarından okunur (pazaryerine sorulmaz).
            {rapor ? ` Hazırlanma: ${new Date(rapor.olusturuldu).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}` : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-[14px] font-black text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {loading ? "Hazırlanıyor..." : "Yenile ↻"}
        </button>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-bold text-rose-700">{error}</div>}

      {!rapor && loading && <div className="py-10 text-center text-[14px] font-bold text-slate-400">Tüm stok taranıyor...</div>}

      {rapor && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kart etiket="Toplam stok" deger={rapor.toplam} alt="IMEI" />
            <Kart etiket="Online satışta açık" deger={rapor.onlineAcik} alt={`%${yuzde(rapor.onlineAcik, rapor.toplam)} · +${sayi(rapor.onlineBekliyor)} açılıyor`} renk={COLOR.acik} />
            <Kart etiket="Yenilemeye uygun" deger={rapor.btk.UYGUN} alt={`%${yuzde(rapor.btk.UYGUN, rapor.toplam)} · ${sayi(rapor.btk.SORGULANMAMIS)} sorgulanmamış`} renk={COLOR.uygun} />
            <Kart etiket="Uygun ama online kapalı" deger={rapor.uygunAmaKapali} alt="satışa açılabilir" renk="#ea580c" />
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            {rapor.gradeler.map((g) => (
              <div key={g.grade} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" style={{ borderTop: `4px solid ${gradeRenk(g.grade)}` }}>
                <div className="text-[12px] font-black uppercase tracking-wider" style={{ color: gradeRenk(g.grade) }}>
                  {g.grade}
                </div>
                <div className="mt-1 text-[30px] font-black leading-none text-slate-900">{sayi(g.toplam)}</div>
                <div className="mt-1.5 text-[12px] font-bold text-slate-500">stokun %{yuzde(g.toplam, rapor.toplam)}</div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${yuzde(g.toplam, rapor.toplam)}%`, backgroundColor: gradeRenk(g.grade) }} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Kutu baslik="Grade'e göre yenileme uygunluğu" alt="Her çubuk o grade'in tamamı; yeşil uygun, kırmızı uygun değil, gri henüz sorgulanmamış.">
              <Aciklama
                items={[
                  { etiket: "Yenilemeye uygun", renk: COLOR.uygun },
                  { etiket: "Uygun değil", renk: COLOR.degil },
                  { etiket: "Sorgulanmamış", renk: COLOR.yok },
                ]}
              />
              <div className="space-y-3">
                {rapor.gradeler.map((g) => (
                  <div key={g.grade} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
                    <div className="text-[13px] font-black text-slate-700">{g.grade}</div>
                    <Cubuk
                      toplam={g.toplam}
                      parcalar={[
                        { etiket: "Yenilemeye uygun", deger: g.btk.UYGUN, renk: COLOR.uygun },
                        { etiket: "Uygun değil", deger: g.btk.UYGUN_DEGIL, renk: COLOR.degil },
                        { etiket: "Sorgulanmamış", deger: g.btk.SORGULANMAMIS, renk: COLOR.yok },
                      ]}
                    />
                    <div className="w-12 text-right text-[12px] font-bold text-slate-500">{sayi(g.toplam)}</div>
                  </div>
                ))}
                <div className="grid grid-cols-[88px_1fr_auto] items-center gap-3 border-t border-slate-100 pt-3">
                  <div className="text-[13px] font-black text-slate-900">TOPLAM</div>
                  <Cubuk
                    toplam={rapor.toplam}
                    parcalar={[
                      { etiket: "Yenilemeye uygun", deger: rapor.btk.UYGUN, renk: COLOR.uygun },
                      { etiket: "Uygun değil", deger: rapor.btk.UYGUN_DEGIL, renk: COLOR.degil },
                      { etiket: "Sorgulanmamış", deger: rapor.btk.SORGULANMAMIS, renk: COLOR.yok },
                    ]}
                  />
                  <div className="w-12 text-right text-[12px] font-bold text-slate-500">{sayi(rapor.toplam)}</div>
                </div>
              </div>
            </Kutu>

            <Kutu baslik="Grade'e göre online satış durumu" alt="Herhangi bir kanalda (N11, İdefix, İKAS, Garantili) açık olan cihazlar.">
              <Aciklama
                items={[
                  { etiket: "Online açık", renk: COLOR.acik },
                  { etiket: "Açılıyor", renk: COLOR.bekliyor },
                  { etiket: "Kapalı / hiç açılmamış", renk: COLOR.kapali },
                ]}
              />
              <div className="space-y-3">
                {rapor.gradeler.map((g) => (
                  <div key={g.grade} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
                    <div className="text-[13px] font-black text-slate-700">{g.grade}</div>
                    <Cubuk
                      toplam={g.toplam}
                      parcalar={[
                        { etiket: "Online açık", deger: g.onlineAcik, renk: COLOR.acik },
                        { etiket: "Açılıyor", deger: g.onlineBekliyor, renk: COLOR.bekliyor },
                        { etiket: "Kapalı / hiç açılmamış", deger: g.onlineKapali, renk: COLOR.kapali },
                      ]}
                    />
                    <div className="w-12 text-right text-[12px] font-bold text-slate-500">{sayi(g.toplam)}</div>
                  </div>
                ))}
                <div className="grid grid-cols-[88px_1fr_auto] items-center gap-3 border-t border-slate-100 pt-3">
                  <div className="text-[13px] font-black text-slate-900">TOPLAM</div>
                  <Cubuk
                    toplam={rapor.toplam}
                    parcalar={[
                      { etiket: "Online açık", deger: rapor.onlineAcik, renk: COLOR.acik },
                      { etiket: "Açılıyor", deger: rapor.onlineBekliyor, renk: COLOR.bekliyor },
                      { etiket: "Kapalı / hiç açılmamış", deger: rapor.onlineKapali, renk: COLOR.kapali },
                    ]}
                  />
                  <div className="w-12 text-right text-[12px] font-bold text-slate-500">{sayi(rapor.toplam)}</div>
                </div>
              </div>
            </Kutu>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Kutu baslik="Kanal bazında online açık cihaz" alt="Bir cihaz birden fazla kanalda açık olabilir; toplam bu yüzden stoktan farklı olabilir.">
              <div className="space-y-3">
                {(Object.keys(KANAL_ETIKET) as KanalKodu[]).map((kod) => (
                  <div key={kod} className="grid grid-cols-[88px_1fr_auto] items-center gap-3">
                    <div className="text-[13px] font-black text-slate-700">{KANAL_ETIKET[kod]}</div>
                    <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                      <div className="h-full rounded-lg" style={{ width: `${(rapor.kanal[kod] / enBuyukKanal) * 100}%`, backgroundColor: COLOR.acik }} title={`${KANAL_ETIKET[kod]}: ${sayi(rapor.kanal[kod])}`} />
                    </div>
                    <div className="w-12 text-right text-[13px] font-black text-slate-700">{sayi(rapor.kanal[kod])}</div>
                  </div>
                ))}
              </div>
            </Kutu>

            <Kutu baslik="Grade × kanal (açık cihaz sayısı)" alt="Hangi grade hangi kanalda ne kadar açık.">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                      <th className="pb-2">Grade</th>
                      {(Object.keys(KANAL_ETIKET) as KanalKodu[]).map((kod) => (
                        <th key={kod} className="pb-2 text-right">
                          {KANAL_ETIKET[kod]}
                        </th>
                      ))}
                      <th className="pb-2 text-right">Uygun ama kapalı</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rapor.gradeler.map((g) => (
                      <tr key={g.grade} className="border-t border-slate-100">
                        <td className="py-2 font-black" style={{ color: gradeRenk(g.grade) }}>
                          {g.grade}
                        </td>
                        {(Object.keys(KANAL_ETIKET) as KanalKodu[]).map((kod) => (
                          <td key={kod} className="py-2 text-right font-bold text-slate-700">
                            {sayi(g.kanal[kod])}
                          </td>
                        ))}
                        <td className="py-2 text-right font-black text-orange-600">{sayi(g.uygunAmaKapali)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Kutu>
          </div>

          <Kutu baslik="Mağaza / depo bazında" alt="Her depodaki stok, grade dağılımı, yenileme uygunluğu ve online açık sayısı.">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-2">Depo</th>
                    <th className="pb-2 text-right">Stok</th>
                    {gradeKolonlari.map((grade) => (
                      <th key={grade} className="pb-2 text-right" style={{ color: gradeRenk(grade) }}>
                        {grade}
                      </th>
                    ))}
                    <th className="pb-2 text-right text-emerald-600">Uygun</th>
                    <th className="pb-2 text-right text-rose-500">Uygun değil</th>
                    <th className="pb-2 text-right">Sorgulanmamış</th>
                    <th className="pb-2 text-right text-violet-600">Online açık</th>
                    <th className="w-40 pb-2 pl-4">Uygunluk</th>
                  </tr>
                </thead>
                <tbody>
                  {rapor.depolar.map((d) => (
                    <tr key={d.depo} className="border-t border-slate-100">
                      <td className="py-2 font-black text-slate-800">{d.depo}</td>
                      <td className="py-2 text-right font-black text-slate-900">{sayi(d.toplam)}</td>
                      {gradeKolonlari.map((grade) => (
                        <td key={grade} className="py-2 text-right font-bold text-slate-600">
                          {d.gradeler[grade] ? sayi(d.gradeler[grade]) : "-"}
                        </td>
                      ))}
                      <td className="py-2 text-right font-bold text-emerald-600">{sayi(d.uygun)}</td>
                      <td className="py-2 text-right font-bold text-rose-500">{sayi(d.uygunDegil)}</td>
                      <td className="py-2 text-right font-bold text-slate-500">{sayi(d.sorgulanmamis)}</td>
                      <td className="py-2 text-right font-black text-violet-600">{sayi(d.onlineAcik)}</td>
                      <td className="py-2 pl-4">
                        <Cubuk
                          toplam={d.toplam}
                          parcalar={[
                            { etiket: "Uygun", deger: d.uygun, renk: COLOR.uygun },
                            { etiket: "Uygun değil", deger: d.uygunDegil, renk: COLOR.degil },
                            { etiket: "Sorgulanmamış", deger: d.sorgulanmamis, renk: COLOR.yok },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kutu>
        </>
      )}
    </div>
  );
}
