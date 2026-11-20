"use client";

// CNETMOBIL - CMR "Şampiyonlar Ligi" yarışma ekranı (şimdilik sadece yönetici)
// Puan: Değer Puan + stok cihaz bonusu; sıralama hedef yüzdesine göre; ödüller ekip kuralıyla dağıtılır.

import React, { useCallback, useEffect, useState } from "react";

import SampiyonlarLigiSonuc, { MudurKarti } from "./SampiyonlarLigiSonuc";
import YarismaHedefleri from "./YarismaHedefleri";

type Row = Record<string, any>;

const fmt = (value: unknown, digits = 0) => (value === null || value === undefined ? "-" : Number(value).toLocaleString("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
const dateTr = (iso: string) => (iso ? iso.split("-").reverse().join(".") : "-");

export default function SampiyonlarLigi() {
  const [config, setConfig] = useState<Row | null>(null);
  const [result, setResult] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const [view, setView] = useState<"yonetim" | "hedefler" | "magaza">("yonetim");
  const [targets, setTargets] = useState<Row[]>([]);
  const [degerPuanTargets, setDegerPuanTargets] = useState<Row[]>([]);
  // Önizleme kaynağı: "test" = senin Hesapla sonucun, "yayin" = mağazaların şu an gördüğü (12:30 otomatik)
  const [previewKaynak, setPreviewKaynak] = useState<"test" | "yayin">("test");
  const [published, setPublished] = useState<Row | null>(null);
  const [mudur, setMudur] = useState<Row | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/wingsm/yarisma", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setConfig(payload.config);
      setResult(payload.result);
      setPublished(payload.published ?? null);
      setMudur(payload.mudur ?? null);
      setTargets(Array.isArray(payload.targets) ? payload.targets : []);
      setDegerPuanTargets(Array.isArray(payload.degerPuanTargets) ? payload.degerPuanTargets : []);
    } catch (e: any) {
      setMessage(e?.message || "Yarışma okunamadı.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Row) => {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/wingsm/yarisma", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      return payload;
    } catch (e: any) {
      setMessage(e?.message || "İşlem başarısız.");

      return null;
    } finally {
      setBusy(false);
    }
  };

  const hesapla = async () => {
    const payload = await post({ action: "hesapla" });

    if (payload) {
      if (payload.empty) setMessage(payload.message);

      await load();
    }
  };

  const changeCarpan = async (mudurCarpan: string) => {
    const payload = await post({ action: "ayar", mudurCarpan });

    if (payload) {
      setConfig(payload.config);
      setMessage("Müdür yarışması çarpanı değişti. Sonucu görmek için Hesapla'ya bas (mağazalar yarın 12:30'daki otomatik yayında görür).");
    }
  };

  const changeCountFrom = async (countFrom: string) => {
    const payload = await post({ action: "ayar", countFrom });

    if (payload) {
      setConfig(payload.config);
      setMessage("Sayım başlangıcı değişti. Sonucu görmek için Hesapla'ya bas.");
    }
  };

  const standing: Row[] = Array.isArray(result?.standing) ? result.standing : [];
  const prizes: Row[] = Array.isArray(result?.prizes) ? result.prizes : [];
  const pre: Row | null = result?.precondition ?? null;
  const monthStart = config ? `${String(config.startDate).slice(0, 7)}-01` : "";
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const remaining = config ? Math.max(0, Math.round((Date.parse(`${config.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-white p-5 shadow-sm">
        <div className="text-[20px] font-black text-slate-900">🏆 {config?.title || "Şampiyonlar Ligi"}</div>
        <div className="text-[13px] font-semibold text-slate-600">
          {config ? `${dateTr(config.startDate)} - ${dateTr(config.endDate)} · ${remaining} gün kaldı` : "Yükleniyor..."} · Tüm CMR mağazaları ana sayfadaki "Şampiyonlar Ligi" sekmesinden görür; her gün 12:30&apos;dan sonra otomatik güncellenir
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["yonetim", "Yönetim (Hesapla)"],
            ["hedefler", "Hedefler"],
            ["magaza", "Mağaza görünümü (önizleme)"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={`rounded-xl px-5 py-2 text-[13px] font-black transition ${view === id ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "magaza" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-[12px] font-bold text-blue-800">
            <span>Aşağıdaki ekran, CMR mağazalarının ana sayfada gördüğünün <b>birebir aynısıdır</b> (hedef rakamı ve IMEI yok). Kaynak:</span>
            {(
              [
                ["test", "Benim Hesapla sonucum (mağazalar görmez)"],
                ["yayin", "Mağazaların şu an gördüğü (12:30 otomatik)"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreviewKaynak(id)}
                className={`rounded-full px-3 py-1 text-[12px] font-black ${previewKaynak === id ? "bg-blue-600 text-white" : "border border-blue-200 bg-white text-blue-700"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {previewKaynak === "test" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-[12px] font-bold text-amber-800">TEST ÖNİZLEMESİ: bu sonucu mağazalar görmez.</div>}
          <SampiyonlarLigiSonuc key={previewKaynak} kaynak={previewKaynak} />
        </>
      ) : view === "hedefler" ? (
        <YarismaHedefleri key={`${targets.length}-${degerPuanTargets.length}`} targets={targets} degerPuanTargets={degerPuanTargets} onSaved={() => void load()} />
      ) : (
      <>
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-bold text-amber-800">
        &quot;Hesapla&quot; bir TEST hesabıdır: sonucu sadece sen görürsün, <b>mağazalar görmez</b>, resmi Değer Puan raporuna da yazılmaz. Mağazalar yalnız her gün 12:30&apos;da otomatik hesaplanan sonucu görür.
        Mağazalardaki son yayın:{" "}
        {published?.computedAt ? `${new Date(published.computedAt).toLocaleString("tr-TR")} (${dateTr(published.range?.from)} - ${dateTr(published.range?.to)})` : "henüz yok"}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
          Puan sayımı başlangıcı:
          <select
            value={config?.countFrom || ""}
            disabled={busy || !config}
            onChange={(event) => void changeCountFrom(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-[13px] font-semibold outline-none focus:border-violet-400"
          >
            {config && <option value={config.startDate}>{dateTr(config.startDate)} (yarışma günü)</option>}
            {config && monthStart !== config.startDate && <option value={monthStart}>{dateTr(monthStart)} (ay başı)</option>}
          </select>
        </label>
        <label className="flex items-center gap-2 text-[13px] font-bold text-slate-700">
          Müdür yarışması çarpanı:
          <select
            value={config?.mudurCarpan || "karekok"}
            disabled={busy || !config}
            onChange={(event) => void changeCarpan(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 px-3 text-[13px] font-semibold outline-none focus:border-violet-400"
          >
            <option value="karekok">Karekök (önerilen)</option>
            <option value="oransal">Tam orantılı (mutlak artış)</option>
            <option value="yok">Çarpan yok (ham yüzde)</option>
          </select>
        </label>
        <div className="text-[13px] font-semibold text-slate-500">Stok cihaz bonusu: +{config?.bonusPoints ?? 125} puan / cihaz</div>
        <button type="button" disabled={busy || !config} onClick={() => void hesapla()} className="ml-auto rounded-xl bg-violet-600 px-6 py-2.5 text-[14px] font-black text-white hover:bg-violet-700 disabled:opacity-50">
          {busy ? "Hesaplanıyor..." : "Hesapla"}
        </button>
      </div>

      {message && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[13px] font-bold text-amber-800">{message}</div>}

      {!result?.standing && !busy && <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-[13px] font-semibold text-slate-400">Henüz hesaplanmadı. "Hesapla"ya bas (dünün verisine kadar hesaplanır).</div>}

      {result?.standing && (
        <>
          <div className="text-[12px] font-semibold text-slate-500">
            Sayılan aralık: {dateTr(result.range?.from)} - {dateTr(result.range?.to)} · Son hesap: {result.computedAt ? new Date(result.computedAt).toLocaleString("tr-TR") : "-"} · Stok cihaz satışı: {result.stockDeviceCount ?? 0} adet · Hedef kaynağı: {result.targetSource === "yarisma" ? "Yarışma hedefleri" : "Değer Puan hedefleri"}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 text-[15px] font-black text-slate-900">Ödül sırası</div>
              <div className="space-y-2">
                {prizes.map((prize) => (
                  <div key={prize.rank} className="rounded-xl bg-slate-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-3 text-[13px]">
                      <span className="font-black text-slate-700">
                        {prize.rank}. {prize.label}
                      </span>
                      <span className="font-black text-slate-900">{prize.winner || "-"}</span>
                    </div>
                    {prize.note && <div className="mt-1 text-[11px] font-semibold text-amber-700">{prize.note}</div>}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-2 text-[15px] font-black text-slate-900">Önkoşul: şirket cihaz satışı +%{pre?.required ?? 15}</div>
              {pre?.available ? (
                <div className="space-y-1 text-[13px] font-semibold text-slate-700">
                  <div>
                    Bu dönem: <b>{pre.current}</b> cihaz · Geçen ay aynı günler ({dateTr(pre.previousRange?.from)} - {dateTr(pre.previousRange?.to)}): <b>{pre.previous}</b>
                  </div>
                  <div>
                    Artış: <b>{pre.growthPct === null ? "-" : `%${fmt(pre.growthPct, 1)}`}</b>{" "}
                    <span className={`rounded-full px-3 py-1 text-[12px] font-black ${pre.met ? "bg-emerald-50 text-emerald-700" : pre.met === false ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"}`}>
                      {pre.met ? "Sağlanıyor" : pre.met === false ? "Henüz sağlanmıyor" : "Hesaplanamadı"}
                    </span>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-400">Cihaz = 2.el, 1.el, 1.el tablet, 4.el sınıfı satış adedi (Gidişat "Cihaz Adet" ile aynı). Karşılaştırma tahminidir.</div>
                </div>
              ) : (
                <div className="text-[13px] font-semibold text-slate-500">Karşılaştırma hesaplanamadı{pre?.error ? `: ${pre.error}` : "."}</div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 text-[15px] font-black text-slate-900">Sıralama (hedef yüzdesine göre)</div>
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
                  <th className="px-3 py-2">Sıra</th>
                  <th className="px-3 py-2">Personel</th>
                  <th className="px-3 py-2">Mağaza</th>
                  <th className="px-3 py-2">Ekip</th>
                  <th className="px-3 py-2 text-right">Değer Puan</th>
                  <th className="px-3 py-2 text-right">Stok cihaz</th>
                  <th className="px-3 py-2 text-right">Toplam</th>
                  <th className="px-3 py-2 text-right">Hedef</th>
                  <th className="px-3 py-2 text-right">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {standing.map((person) => {
                  const key = `${person.saticiAdi}|${person.saticiKod}`;
                  const prize = prizes.find((item) => item.winner && item.winner === person.saticiAdi);

                  return (
                    <React.Fragment key={key}>
                      <tr className="text-[13px] text-slate-800">
                        <td className="px-3 py-2 font-black">{person.siralama ?? "-"}</td>
                        <td className="px-3 py-2 font-bold">
                          {person.saticiAdi || `Kod ${person.saticiKod}`}
                          {prize && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">{prize.rank}. ödül</span>}
                          {person.isManager && <span className="ml-2 text-[11px] font-semibold text-slate-400">(müdür)</span>}
                        </td>
                        <td className="px-3 py-2 font-semibold">{person.branchLabel || "-"}</td>
                        <td className="px-3 py-2 font-semibold">{person.group || "-"}</td>
                        <td className="px-3 py-2 text-right font-semibold">{fmt(person.puan)}</td>
                        <td className="px-3 py-2 text-right font-semibold">
                          {person.stokAdet > 0 ? (
                            <button type="button" onClick={() => setOpenPerson(openPerson === key ? null : key)} className="font-black text-violet-600 hover:underline">
                              {person.stokAdet} adet (+{fmt(person.bonus)})
                            </button>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-black">{fmt(person.toplamPuan)}</td>
                        <td className="px-3 py-2 text-right font-semibold">{person.hedef ? fmt(person.hedef) : "-"}</td>
                        <td className="px-3 py-2 text-right font-black">{person.yuzde === null ? "-" : `%${fmt(person.yuzde, 1)}`}</td>
                      </tr>
                      {openPerson === key && (
                        <tr>
                          <td colSpan={9} className="bg-slate-50 px-3 py-2">
                            <div className="text-[12px] font-bold text-slate-600">Stok cihaz satışları:</div>
                            {(person.stokSatislar || []).map((sale: Row) => (
                              <div key={sale.imei} className="text-[12px] font-semibold text-slate-600">
                                {sale.imei} · {sale.malAd} · {sale.tarih} · {sale.branchLabel}
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {mudur && <MudurKarti mudur={mudur} />}
      </>
      )}
    </div>
  );
}
