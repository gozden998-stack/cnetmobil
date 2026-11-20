"use client";

// CNETMOBIL - Şampiyonlar Ligi: yarışmaya özel KİŞİ HEDEFLERİ (Değer Puan hedeflerinden bağımsız)
// Yönetici burada her kişinin yarışma hedefini yazar. Hedef tanımlıysa yarışma YALNIZ bu hedefleri kullanır.

import React, { useState } from "react";

type Row = Record<string, any>;
type Line = { adi: string; magaza: string; hedef: string };

const STORES = ["CMR MERKEZ", "CMR CADDE", "CMR SARAY", "CMR KAPAKLI"];

const toLine = (target: Row): Line => ({ adi: String(target.saticiAdi ?? ""), magaza: String(target.branchLabel ?? ""), hedef: String(target.hedef ?? "") });

// "1.250,5" / "1250.5" / "1250" -> sayı
function parseNumber(value: string): number {
  const text = value.trim().replace(/\s/g, "");
  const normalized = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text.replace(/\.(?=\d{3}(\D|$))/g, "");

  return Number(normalized);
}

function guessStore(text: string): string {
  const upper = text.toLocaleUpperCase("tr-TR");

  if (upper.includes("MERKEZ") || upper.includes("MEYDAN")) return "CMR MERKEZ";
  if (upper.includes("CADDE")) return "CMR CADDE";
  if (upper.includes("SARAY")) return "CMR SARAY";
  if (upper.includes("KAPAKLI")) return "CMR KAPAKLI";

  return "";
}

export default function YarismaHedefleri({ targets, degerPuanTargets, onSaved }: { targets: Row[]; degerPuanTargets: Row[]; onSaved: () => void }) {
  const [lines, setLines] = useState<Line[]>(() => targets.map(toLine));
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [dirty, setDirty] = useState(false);

  const update = (index: number, patch: Partial<Line>) => {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
    setDirty(true);
  };

  const fillFromDegerPuan = () => {
    if (lines.length > 0 && !window.confirm("Mevcut liste Değer Puan hedefleriyle DEĞİŞTİRİLECEK. Devam edilsin mi?")) return;

    setLines(degerPuanTargets.map(toLine));
    setDirty(true);
    setMessage(`${degerPuanTargets.length} kişi Değer Puan hedeflerinden dolduruldu. Hedefleri düzenleyip Kaydet'e bas.`);
  };

  const importPaste = () => {
    const parsed: Line[] = [];
    const problems: string[] = [];

    for (const raw of paste.split(/\r?\n/)) {
      const text = raw.trim();

      if (!text) continue;

      const cols = text.split(/\t|;/).map((col) => col.trim()).filter((col, index, all) => col !== "" || index < all.length);

      if (cols.length < 2) {
        problems.push(text);
        continue;
      }

      const hedefText = cols[cols.length - 1];
      const adi = cols[0];
      const magaza = cols.length >= 3 ? guessStore(cols[1]) : guessStore("");

      if (!adi || !Number.isFinite(parseNumber(hedefText))) {
        problems.push(text);
        continue;
      }

      // Mağaza yazılmadıysa Değer Puan listesindeki aynı isimden alınır
      const known = degerPuanTargets.find((target) => String(target.saticiAdi).toLocaleUpperCase("tr-TR") === adi.toLocaleUpperCase("tr-TR"));

      parsed.push({ adi, magaza: magaza || (known ? String(known.branchLabel) : ""), hedef: String(parseNumber(hedefText)) });
    }

    // Aynı isim varsa sonuncusu geçerli
    setLines((current) => {
      const map = new Map(current.map((line) => [line.adi.toLocaleUpperCase("tr-TR"), line]));

      for (const line of parsed) map.set(line.adi.toLocaleUpperCase("tr-TR"), line);

      return Array.from(map.values());
    });
    setDirty(true);
    setPaste("");
    setMessage(`${parsed.length} satır eklendi/güncellendi.${problems.length ? ` Okunamayan ${problems.length} satır atlandı: ${problems.slice(0, 3).join(" | ")}` : ""} Mağazası boş kalanları seçmelisin.`);
  };

  const save = async () => {
    const rows = lines.map((line) => ({ saticiAdi: line.adi, branchLabel: line.magaza, hedef: parseNumber(line.hedef) }));

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/wingsm/yarisma", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "hedefKaydet", rows }),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setLines((payload.targets as Row[]).map(toLine));
      setDirty(false);
      setMessage(
        rows.length === 0
          ? "Liste boşaltıldı: yarışma Değer Puan hedeflerine döndü."
          : `${rows.length} kişinin yarışma hedefi kaydedildi. Test için Yönetim'de Hesapla'ya bas; mağazalar yeni hedefleri bir sonraki 12:30 otomatik yayınında görür.`
      );
      onSaved();
    } catch (e: any) {
      setMessage(e?.message || "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-bold leading-5 text-amber-800">
        Burada yazdığın hedefler <b>sadece Şampiyonlar Ligi</b> içindir (Değer Puan hedefleri değişmez). Liste doluysa yarışma <b>yalnız bu hedefleri</b> kullanır: listede olmayan kişi sıralamaya girmez. Liste boşsa Değer Puan hedefleri kullanılır.
        Kişi adı WingSM&apos;deki satıcı adıyla <b>birebir aynı</b> olmalı (Türkçe karakterler dahil), yoksa satışları eşleşmez; emin olmak için &quot;Değer Puan hedeflerinden doldur&quot; ile başla. Mağaza müdürleri de sıralamaya girer.
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button type="button" onClick={fillFromDegerPuan} disabled={busy || degerPuanTargets.length === 0} className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40">
          Değer Puan hedeflerinden doldur ({degerPuanTargets.length} kişi)
        </button>
        <button
          type="button"
          onClick={() => {
            setLines((current) => [...current, { adi: "", magaza: "", hedef: "" }]);
            setDirty(true);
          }}
          className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50"
        >
          + Kişi ekle
        </button>
        <div className="text-[13px] font-bold text-slate-500">{lines.length} kişi{dirty ? " · kaydedilmemiş değişiklik var" : ""}</div>
        <button type="button" onClick={() => void save()} disabled={busy || !dirty} className="ml-auto rounded-xl bg-violet-600 px-6 py-2.5 text-[14px] font-black text-white hover:bg-violet-700 disabled:opacity-50">
          {busy ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div>

      {message && <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] font-bold text-slate-700">{message}</div>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <table className="w-full min-w-[620px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
              <th className="px-3 py-2">Kişi (WingSM satıcı adı)</th>
              <th className="px-3 py-2">Mağaza</th>
              <th className="px-3 py-2">Yarışma hedefi (puan)</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-[13px] font-semibold text-slate-400">
                  Liste boş: yarışma şu an Değer Puan hedeflerini kullanıyor.
                </td>
              </tr>
            )}
            {lines.map((line, index) => (
              <tr key={index}>
                <td className="px-3 py-1.5">
                  <input value={line.adi} onChange={(event) => update(index, { adi: event.target.value })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px] font-semibold outline-none focus:border-violet-400" />
                </td>
                <td className="px-3 py-1.5">
                  <select value={line.magaza} onChange={(event) => update(index, { magaza: event.target.value })} className={`h-10 w-full rounded-lg border px-2 text-[13px] font-semibold outline-none focus:border-violet-400 ${line.magaza ? "border-slate-200" : "border-amber-300 bg-amber-50"}`}>
                    <option value="">Mağaza seç</option>
                    {STORES.map((store) => (
                      <option key={store} value={store}>
                        {store}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input value={line.hedef} onChange={(event) => update(index, { hedef: event.target.value.replace(/[^\d.,]/g, "") })} inputMode="decimal" className="h-10 w-40 rounded-lg border border-slate-200 px-3 text-right text-[13px] font-semibold outline-none focus:border-violet-400" />
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setLines((current) => current.filter((_, i) => i !== index));
                      setDirty(true);
                    }}
                    className="text-[12px] font-black text-rose-600 hover:underline"
                  >
                    Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-1 text-[14px] font-black text-slate-900">Excel&apos;den toplu yapıştır</div>
        <div className="mb-2 text-[12px] font-semibold text-slate-500">
          Her satır: <b>Ad Soyad</b> ⇥ <b>Mağaza</b> ⇥ <b>Hedef</b> (Excel&apos;den kopyala-yapıştır). Mağaza yazmazsan Değer Puan listesindeki aynı isimden alınır. Aynı isim varsa yenisi geçerli olur. Sonra Kaydet&apos;e bas.
        </div>
        <textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 p-3 text-[13px] font-semibold outline-none focus:border-violet-400" placeholder={"EMİRHAN ÇETİN\tCMR MERKEZ\t450"} />
        <button type="button" onClick={importPaste} disabled={!paste.trim()} className="mt-2 rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40">
          Listeye ekle
        </button>
      </div>
    </div>
  );
}
