"use client";

// CNETMOBIL - Vodafone "Şampiyonlar Ligi" - mağaza görünümü (salt okunur) + yönetici bölümü (çarpan girişi, Hesapla)
// Sıralama her gün 12:30'da yayınlanır; yeni güne geçince yayın gelene kadar "Rapor bekleniyor" görünür.
// Hesapla (test) sonucu yalnız yöneticiye görünür; mağazalar yalnız 12:30 yayınını görür.

import React, { useCallback, useEffect, useState } from "react";

import { DayPicker, dayPickLabel, dayPickToGun, formatIsoDate, istanbulToday, type DayPick } from "./degerPuanGunSecici";

type Row = Record<string, any>;

const fmt = (value: unknown, digits = 0) => (value === null || value === undefined ? "-" : Number(value).toLocaleString("tr-TR", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
const dateTr = (iso: unknown) => (iso ? String(iso).split("-").reverse().join(".") : "-");

// kaynak "yayin": mağazaların gördüğü (her gün 12:30). "test": yöneticinin Hesapla sonucu (yalnız yönetici önizlemesi).
function VodafoneYarismaSonuc({ kaynak = "yayin", refreshKey = 0 }: { kaynak?: "yayin" | "test"; refreshKey?: number }) {
  const [data, setData] = useState<Row | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [pick, setPick] = useState<DayPick>({ kind: "bugun" });
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const gun = kaynak === "test" ? null : dayPickToGun(pick);
      const query = kaynak === "test" ? "?kaynak=test" : gun ? `?gun=${gun}` : "";
      const response = await fetch(`/api/wingsm/vodafone/yarisma/sonuc${query}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setData(payload);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Yarışma bilgisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [kaynak, pick]);

  useEffect(() => {
    setLoading(true);
    void load();

    const timer = window.setInterval(() => void load(), 120_000);

    return () => window.clearInterval(timer);
  }, [load, refreshKey]);

  if (error) return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-[13px] font-bold text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 text-center text-[13px] font-semibold text-slate-400">Yükleniyor...</div>;

  const config: Row = data.config ?? {};
  const points: Row = config.points ?? {};
  const standing: Row[] = Array.isArray(data.standing) ? data.standing : [];
  const prizes: Row[] = Array.isArray(data.prizes) ? data.prizes : Array.isArray(data.prizeList) ? data.prizeList : [];
  const carpanlar: Row = data.carpan ?? {};
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Istanbul" });
  const remaining = config.endDate ? Math.max(0, Math.round((Date.parse(`${config.endDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1) : 0;
  const visible = showAll ? standing : standing.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 via-white to-red-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[20px] font-black text-slate-900">🏆 {config.title || "Vodafone Şampiyonlar Ligi"}</div>
            <div className="mt-1 text-[13px] font-semibold text-slate-600">
              {dateTr(config.startDate)} - {dateTr(config.endDate)} · <b>{remaining} gün kaldı</b>
              {data.computedAt && !data.bekleniyor ? ` · Yayın: ${new Date(data.computedAt).toLocaleString("tr-TR")}` : ""}
            </div>
          </div>
          {kaynak !== "test" && (
            <div>
              <div className="mb-1 text-[10px] font-bold text-slate-500">Gün</div>
              <DayPicker label={dayPickLabel(pick)} disabled={loading} minDate={data.minGun} maxDate={istanbulToday()} onSelect={setPick} />
            </div>
          )}
        </div>
        <div className="mt-2 text-[12px] font-semibold text-slate-500">
          Puanlar: Gross {fmt(points.gross, 1)} · Baz {fmt(points.baz, 1)} · Tekil cihaz (tüm temlikli satış) {fmt(points.tekil, 1)} · Samsung ise ek +{fmt(points.samsung, 1)} · Samsung premium (S / Fold / Flip) ise ayrıca ek +{fmt(points.premium, 1)}. Tekil toplam adettir; Samsung ve Premium bunun içinden ayrılır. Sıralama, mağaza çarpanıyla çarpılmış toplam puana göredir. 1. ve 2. farklı mağazalardan, ilk 5 ödül en az 3 farklı mağazadan olmalıdır; kural bozulursa ödül sıradaki uygun kişiye kayar.
        </div>
        {Object.keys(carpanlar).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-black">
            {Object.entries(carpanlar).map(([store, value]) => (
              <span key={store} className="rounded-full bg-white px-2.5 py-1 text-slate-700 ring-1 ring-slate-200">
                {store}: x{fmt(value, 2)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {prizes.map((prize) => (
          <div key={prize.rank} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[12px] font-black uppercase text-amber-600">{prize.rank}. Ödül</div>
            <div className="text-[15px] font-black text-slate-900">{prize.label}</div>
            <div className="mt-1 text-[13px] font-bold text-slate-600">{prize.winner || (data.hasResult === false ? "Henüz belli değil" : "-")}</div>
            {prize.winner && prize.branchLabel && <div className="text-[11px] font-semibold text-slate-400">{prize.branchLabel}</div>}
            {prize.note && <div className="mt-1 text-[11px] font-semibold text-amber-700">{prize.note}</div>}
          </div>
        ))}
      </div>

      {data.donemSonu ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
          <div className="text-5xl">📢</div>
          <div className="mt-3 text-2xl font-black text-[#1b2559]">Yayın sona erdi</div>
          <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">
            Şampiyonlar Ligi sıralaması {data.sonYayinGunu ? formatIsoDate(data.sonYayinGunu) : "ayın 28'i"} tarihine kadar yayınlandı. Nihai sonuç yarışma bitince yönetici tarafından paylaşılacaktır.
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-400">Son yayınlanan raporu görmek için sağ üstteki seçiciden günü seçebilirsiniz.</p>
        </div>
      ) : data.bekleniyor ? (
        <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
          <div className="text-5xl">⏳</div>
          <div className="mt-3 text-2xl font-black text-[#1b2559]">Rapor bekleniyor</div>
          <p className="mt-2 max-w-md text-sm font-semibold text-slate-500">Şampiyonlar Ligi sıralaması her gün saat 12:30&apos;da otomatik yayınlanır; yayınlanınca burada görünecek.</p>
          <p className="mt-3 text-xs font-semibold text-slate-400">Önceki günün raporunu görmek için sağ üstteki seçiciden &quot;Dün&quot;ü seçebilirsiniz.</p>
        </div>
      ) : data.bulunamadi ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center text-sm font-bold text-slate-500">
          {data.gun ? `${formatIsoDate(data.gun)} tarihi için` : "Bu tarih için"} kayıtlı rapor bulunamadı.
        </div>
      ) : data.hasResult === false ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-[13px] font-semibold text-slate-500">
          Sıralama ilk hesaplandığında burada görünecek. Rapor her gün 12:30&apos;da yayınlanır.
        </div>
      ) : (
        <>
          {data.gun && data.today && data.gun !== data.today && data.range && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-bold text-blue-900">
              {formatIsoDate(data.gun)} tarihli rapor: {dateTr(data.range.from)} - {dateTr(data.range.to)} arası
            </div>
          )}

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
                  <th className="px-3 py-2">Sıra</th>
                  <th className="px-3 py-2">Personel</th>
                  <th className="px-3 py-2">Mağaza</th>
                  <th className="px-3 py-2 text-right">Gross</th>
                  <th className="px-3 py-2 text-right">Baz</th>
                  <th className="px-3 py-2 text-right">Tekil</th>
                  <th className="px-3 py-2 text-right">Samsung</th>
                  <th className="px-3 py-2 text-right">Premium</th>
                  <th className="px-3 py-2 text-right">Ham</th>
                  <th className="px-3 py-2 text-right">Çarpan</th>
                  <th className="px-3 py-2 text-right">Puan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((person) => {
                  const prize = prizes.find((item) => item.winner && item.winner === person.saticiAdi);

                  return (
                    <tr key={`${person.saticiAdi}-${person.siralama}`} className="text-[13px] text-slate-800">
                      <td className="px-3 py-2 font-black">{person.siralama}</td>
                      <td className="px-3 py-2 font-bold">
                        {person.saticiAdi}
                        {prize && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-black text-amber-800">{prize.rank}. ödül</span>}
                      </td>
                      <td className="px-3 py-2 font-semibold">{person.branchLabel}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(person.gross)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(person.baz)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(person.tekil)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(person.samsung)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(person.premium)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{fmt(person.ham, 1)}</td>
                      <td className="px-3 py-2 text-right font-semibold">x{fmt(person.carpan, 2)}</td>
                      <td className="px-3 py-2 text-right font-black">{fmt(person.puan, 1)}</td>
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

// Yönetici bölümü: mağaza çarpanları (elle), Hesapla (test), test sonucu önizlemesi + tanı bilgisi
function VodafoneYarismaYonetim() {
  const [stores, setStores] = useState<string[]>([]);
  const [carpan, setCarpan] = useState<Record<string, string>>({});
  const [admin, setAdmin] = useState<Row | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadAdmin = useCallback(async () => {
    try {
      const response = await fetch("/api/wingsm/vodafone/yarisma", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setAdmin(payload);
      setStores(payload.stores ?? []);
      setCarpan(Object.fromEntries(Object.entries(payload.config?.carpan ?? {}).map(([store, value]) => [store, String(value)])));
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message || "Yarışma ayarı alınamadı." });
    }
  }, []);

  useEffect(() => {
    void loadAdmin();
  }, [loadAdmin]);

  const post = async (body: Row) => {
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/wingsm/vodafone/yarisma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      return payload;
    } finally {
      setBusy(false);
    }
  };

  const saveCarpan = async () => {
    try {
      await post({ action: "carpanKaydet", carpan });
      setMessage({ type: "ok", text: "Çarpanlar kaydedildi. Değişiklik bir sonraki hesaplamada geçerli olur (Hesapla ya da 12:30 yayını)." });
      await loadAdmin();
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message || "Çarpanlar kaydedilemedi." });
    }
  };

  const hesapla = async () => {
    try {
      const payload = await post({ action: "hesapla" });

      setMessage({ type: "ok", text: payload.result?.empty ? payload.result.message : "Test sonucu hesaplandı (mağazalara görünmez)." });
      await loadAdmin();
      setRefreshKey((value) => value + 1);
    } catch (e: any) {
      setMessage({ type: "err", text: e?.message || "Hesaplanamadı." });
    }
  };

  const result: Row | null = admin?.result ?? null;
  const diag: Row | null = result?.diagnostics ?? null;
  const missing: string[] = Array.isArray(result?.carpanEksik) ? result.carpanEksik : [];
  const published: Row | null = admin?.published ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[14px] font-black text-slate-900">Mağaza çarpanları (elle girilir)</div>
        <p className="mt-1 text-[12px] font-semibold text-slate-500">
          Her kişinin puanı, kendi mağazasındaki ham puanı × o mağazanın çarpanıdır. Boş bırakılan mağaza için çarpan 1 sayılır. Ondalık için virgül ya da nokta kullanabilirsiniz (ör. 1,15).
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stores.map((store) => (
            <label key={store} className="block">
              <div className="mb-1 text-[12px] font-black text-slate-600">{store}</div>
              <input
                value={carpan[store] ?? ""}
                onChange={(event) => setCarpan((prev) => ({ ...prev, [store]: event.target.value }))}
                inputMode="decimal"
                placeholder="1"
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] font-bold text-slate-800 outline-none focus:border-blue-400"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={saveCarpan} className="h-10 rounded-xl bg-blue-600 px-5 text-[12px] font-black uppercase text-white disabled:opacity-50">
            Çarpanları kaydet
          </button>
          <button type="button" disabled={busy} onClick={hesapla} className="h-10 rounded-xl bg-slate-900 px-5 text-[12px] font-black uppercase text-white disabled:opacity-50">
            {busy ? "Çalışıyor..." : "Hesapla (test)"}
          </button>
          <span className="text-[11px] font-semibold text-slate-400">
            Hesapla sonucu yalnız sana görünür. Mağazalar her gün 12:30 yayınını görür{published?.computedAt ? ` (son yayın: ${new Date(published.computedAt).toLocaleString("tr-TR")})` : ""}.
          </span>
        </div>
        {message && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-[12px] font-bold ${message.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{message.text}</div>
        )}
      </div>

      {result && missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] font-bold text-amber-800">Çarpanı girilmeyen mağaza (1 sayıldı): {missing.join(", ")}</div>
      )}

      {diag && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-[12px] font-semibold text-slate-600 shadow-sm">
          <div className="mb-1 text-[13px] font-black text-slate-900">Kontrol bilgisi (yalnız yönetici)</div>
          <div>
            5AK: Gross {diag.gross5akRows} satır · Baz {diag.baz5akRows} satır · <b className={diag.unmatched5akRows ? "text-amber-700" : ""}>tanınmayan {diag.unmatched5akRows}</b> satır (Gross/Baz'a girmedi)
          </div>
          <div>
            Temlikli liste: {diag.temlikRows} satır · 1el {diag.temlik1elRows} satır · 1el olmayan {diag.temlikOtherClassRows} satır (sayılmadı)
          </div>
          {Array.isArray(diag.unmatched5akExamples) && diag.unmatched5akExamples.length > 0 && <div className="mt-1 text-amber-700">Tanınmayan 5AK örnekleri: {diag.unmatched5akExamples.join(" | ")}</div>}
          {Array.isArray(diag.temlikOtherClassExamples) && diag.temlikOtherClassExamples.length > 0 && <div className="mt-1 text-slate-500">1el olmayan temlik örnekleri: {diag.temlikOtherClassExamples.join(" | ")}</div>}
        </div>
      )}

      <div>
        <div className="mb-2 text-[13px] font-black uppercase text-slate-500">Test sonucu önizlemesi (mağazalara görünmez)</div>
        <VodafoneYarismaSonuc kaynak="test" refreshKey={refreshKey} />
      </div>
    </div>
  );
}

export default function VodafoneYarisma({ yonetici = false }: { yonetici?: boolean }) {
  const [gorunum, setGorunum] = useState<"yayin" | "yonetim">("yayin");

  if (!yonetici) return <VodafoneYarismaSonuc />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100 p-1.5">
        {(
          [
            ["yayin", "Mağaza görünümü (yayın)"],
            ["yonetim", "Yönetim"],
          ] as Array<["yayin" | "yonetim", string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGorunum(id)}
            className={`h-8 whitespace-nowrap rounded-lg px-3.5 text-[11px] font-black uppercase tracking-wide transition ${gorunum === id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {gorunum === "yayin" ? <VodafoneYarismaSonuc /> : <VodafoneYarismaYonetim />}
    </div>
  );
}
