"use client";

// CNETMOBIL - Stoktaki IMEI'lerin Garantili BTK yenileme uygunluğu (yeşil = uygun, kırmızı = uygun değil, gri = sorgulanmamış)
// Sorgu sonucu DB'de saklanır; Garantili'de kayıt açılmaz, WingSM'e yazılmaz.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = {
  imei: string;
  brand: string | null;
  model: string | null;
  memory: string | null;
  color: string | null;
  grade: string | null;
  depo: string | null;
  durum: "UYGUN" | "UYGUN_DEGIL" | null;
  mesaj: string | null;
  checkedAt: string | null;
  kontrolSayisi: number;
};
type Ozet = { toplam: number; uygun: number; uygunDegil: number; sorgulanmamis: number };
type Filtre = "tumu" | "UYGUN" | "UYGUN_DEGIL" | "BEKLEYEN";

const PAGE = 100;
const dateTr = (value: string | null) => (value ? new Date(value).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "-");

export default function GarantiliStokBtk() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ozet, setOzet] = useState<Ozet | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<"" | "bekleyen" | "kirmizi">("");
  const [progress, setProgress] = useState("");
  const [rowBusy, setRowBusy] = useState("");
  const [filtre, setFiltre] = useState<Filtre>("tumu");
  const [depo, setDepo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const stopRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/online/garantili/btk-stok", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRows(payload.rows ?? []);
      setOzet(payload.ozet ?? null);
    } catch (e: any) {
      setError(e?.message || "Stok listesi okunamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    const response = await fetch("/api/online/garantili/btk-stok", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);

    if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

    return payload;
  };

  const runLoop = async (mod: "bekleyen" | "kirmizi") => {
    stopRef.current = false;
    setRunning(mod);
    setError("");

    const initial = mod === "bekleyen" ? ozet?.sorgulanmamis ?? 0 : ozet?.uygunDegil ?? 0;
    let processed = 0;
    let rateWaits = 0;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      while (!stopRef.current) {
        const cycleStart = Date.now();
        const data = await post({ mod, limit: 5 });

        processed += data.results?.length ?? 0;
        setProgress(`${processed} / ${initial} sorgulandı`);

        if (data.errors?.length) {
          setError(`${data.errors.length} sorguda hata: ${data.errors.slice(0, 2).join(" | ")}`);
        }

        // Garantili dakika sınırı: hata değil, 20 sn bekleyip devam (en çok 10 kez üst üste)
        if (data.rateLimited) {
          rateWaits += 1;

          if (rateWaits > 10) {
            setError("Garantili istek sınırı uzun süre açılmadı; birkaç dakika sonra tekrar deneyin.");
            break;
          }

          setProgress(`${processed} / ${initial} sorgulandı · Garantili sınırı, 20 sn bekleniyor`);
          await sleep(20000);
          continue;
        }

        rateWaits = 0;

        if (!data.results?.length) break;
        if (mod === "bekleyen" && data.kalanBekleyen === 0) break;
        if (mod === "kirmizi" && processed >= initial) break;

        // Dakikada ~40 sorguyu aşmamak için her tur en az 8 sn sürsün
        const elapsed = Date.now() - cycleStart;

        if (elapsed < 8000) await sleep(8000 - elapsed);
      }
    } catch (e: any) {
      setError(e?.message || "Sorgu yapılamadı.");
    } finally {
      setRunning("");
      setProgress("");
      await load();
    }
  };

  const recheck = async (imei: string) => {
    setRowBusy(imei);
    setError("");

    try {
      const data = await post({ imeis: [imei] });

      if (data.errors?.length) setError(data.errors.join(" | "));
    } catch (e: any) {
      setError(e?.message || "Sorgu yapılamadı.");
    } finally {
      setRowBusy("");
      await load();
    }
  };

  const depolar = useMemo(() => Array.from(new Set(rows.map((row) => row.depo).filter(Boolean) as string[])).sort(), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");

    return rows.filter((row) => {
      if (filtre === "UYGUN" && row.durum !== "UYGUN") return false;
      if (filtre === "UYGUN_DEGIL" && row.durum !== "UYGUN_DEGIL") return false;
      if (filtre === "BEKLEYEN" && row.durum !== null) return false;
      if (depo && row.depo !== depo) return false;
      if (q && !`${row.imei} ${row.brand} ${row.model} ${row.memory} ${row.color}`.toLocaleLowerCase("tr-TR").includes(q)) return false;

      return true;
    });
  }, [rows, filtre, depo, search]);

  useEffect(() => setPage(1), [filtre, depo, search]);

  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const lastPage = Math.max(1, Math.ceil(filtered.length / PAGE));

  const cards: Array<{ key: Filtre; label: string; value: number | undefined; tone: string }> = [
    { key: "tumu", label: "Stoktaki IMEI", value: ozet?.toplam, tone: "border-slate-200 bg-white text-slate-900" },
    { key: "UYGUN", label: "Yenileme uygun (yeşil)", value: ozet?.uygun, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
    { key: "UYGUN_DEGIL", label: "Uygun değil (kırmızı)", value: ozet?.uygunDegil, tone: "border-rose-200 bg-rose-50 text-rose-800" },
    { key: "BEKLEYEN", label: "Sorgulanmamış", value: ozet?.sorgulanmamis, tone: "border-slate-200 bg-slate-50 text-slate-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setFiltre(card.key)}
            className={`rounded-2xl border p-4 text-left shadow-sm transition ${card.tone} ${filtre === card.key ? "ring-2 ring-violet-400" : ""}`}
          >
            <div className="text-[12px] font-black uppercase tracking-wide opacity-70">{card.label}</div>
            <div className="text-[26px] font-black">{card.value ?? "-"}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <button
          type="button"
          disabled={Boolean(running) || loading || !ozet?.sorgulanmamis}
          onClick={() => void runLoop("bekleyen")}
          className="rounded-xl bg-violet-600 px-5 py-2.5 text-[14px] font-black text-white hover:bg-violet-700 disabled:opacity-40"
        >
          {running === "bekleyen" ? "Sorgulanıyor..." : `Sorgulanmamışları sorgula (${ozet?.sorgulanmamis ?? 0})`}
        </button>
        <button
          type="button"
          disabled={Boolean(running) || loading || !ozet?.uygunDegil}
          onClick={() => void runLoop("kirmizi")}
          className="rounded-xl border border-rose-200 bg-white px-5 py-2.5 text-[14px] font-black text-rose-700 hover:bg-rose-50 disabled:opacity-40"
        >
          {running === "kirmizi" ? "Sorgulanıyor..." : `Kırmızıları tekrar sorgula (${ozet?.uygunDegil ?? 0})`}
        </button>
        {running && (
          <button type="button" onClick={() => (stopRef.current = true)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-[13px] font-black text-slate-700 hover:bg-slate-50">
            Durdur
          </button>
        )}
        <div className="text-[13px] font-bold text-slate-500">{progress || "Sorgular Garantili'nin BTK servisi üzerinden, sırayla yapılır."}</div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] font-bold text-rose-700">{error}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="IMEI / model ara"
            className="h-11 w-full max-w-xs rounded-xl border border-slate-200 px-4 text-[14px] font-semibold text-slate-800 outline-none focus:border-violet-400"
          />
          <select value={depo} onChange={(event) => setDepo(event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-[13px] font-semibold text-slate-700">
            <option value="">Tüm depolar</option>
            {depolar.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <div className="text-[13px] font-bold text-slate-500">{loading ? "Yükleniyor..." : `${filtered.length} kayıt`}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
                <th className="px-3 py-2">Durum</th>
                <th className="px-3 py-2">IMEI</th>
                <th className="px-3 py-2">Depo</th>
                <th className="px-3 py-2">Ürün</th>
                <th className="px-3 py-2">Grade</th>
                <th className="px-3 py-2">Son sorgu</th>
                <th className="px-3 py-2">Not</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[13px] font-semibold text-slate-400">
                    Kayıt yok.
                  </td>
                </tr>
              )}
              {pageRows.map((row) => (
                <tr key={row.imei} className={`text-[13px] text-slate-800 ${row.durum === "UYGUN" ? "bg-emerald-50/50" : row.durum === "UYGUN_DEGIL" ? "bg-rose-50/60" : ""}`}>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-black ${
                        row.durum === "UYGUN" ? "bg-emerald-100 text-emerald-800" : row.durum === "UYGUN_DEGIL" ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.durum === "UYGUN" ? "Yenileme uygun" : row.durum === "UYGUN_DEGIL" ? "Uygun değil" : "Sorgulanmadı"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono font-bold">{row.imei}</td>
                  <td className="px-3 py-2 font-semibold">{row.depo || "-"}</td>
                  <td className="px-3 py-2 font-semibold">{[row.brand, row.model, row.memory, row.color].filter(Boolean).join(" ") || "-"}</td>
                  <td className="px-3 py-2">{row.grade || "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-[12px] text-slate-500">
                    {dateTr(row.checkedAt)}
                    {row.kontrolSayisi > 1 ? ` (${row.kontrolSayisi}x)` : ""}
                  </td>
                  <td className="max-w-[260px] px-3 py-2 text-[12px] font-semibold text-slate-600">{row.durum === "UYGUN_DEGIL" ? row.mesaj || "-" : ""}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      disabled={Boolean(running) || rowBusy === row.imei}
                      onClick={() => void recheck(row.imei)}
                      className="rounded-lg border border-slate-200 px-3 py-1 text-[12px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {rowBusy === row.imei ? "..." : row.durum === null ? "Sorgula" : "Tekrar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {lastPage > 1 && (
          <div className="mt-3 flex items-center justify-end gap-3 text-[13px] font-bold text-slate-600">
            <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">
              Önceki
            </button>
            <span>
              {page} / {lastPage}
            </span>
            <button type="button" disabled={page >= lastPage} onClick={() => setPage(page + 1)} className="rounded-lg border border-slate-200 px-3 py-1 disabled:opacity-40">
              Sonraki
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
