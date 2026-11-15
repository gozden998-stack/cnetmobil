"use client";

// CNETMOBIL - Hepsiburada ekranı (Entegrasyonlar > Hepsiburada)
//
// Şimdilik SALT OKUNUR: bağlantı durumu, Hepsiburada'daki ürünler (stok, fiyat, satış durumu) ve açık
// siparişler. Ürünler Hepsiburada panelinden açılır; stok yazma ve sipariş bazlı kanal senkronu sonraki adım.
// Müşteri bilgisi gösterilmez.

import React, { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, any>;
type Tab = "urunler" | "siparisler";

const PAGE = 50;

const formatMoney = (value: unknown) => {
  const n = Number(value);

  return Number.isFinite(n) ? n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }) : "-";
};

const orderDate = (row: Row) => {
  const key = Object.keys(row).find((k) => /date|time/i.test(k) && typeof row[k] === "string");
  const d = key ? new Date(String(row[key])) : null;

  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString("tr-TR") : "-";
};

export default function Hepsiburada() {
  const [tab, setTab] = useState<Tab>("urunler");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [checkedAt, setCheckedAt] = useState("");

  const load = useCallback(async (which: Tab, nextOffset: number) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/online/hepsiburada/${which === "urunler" ? "listings" : "orders"}?offset=${nextOffset}&limit=${PAGE}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.totalCount) || 0);
      setOffset(nextOffset);
      setCheckedAt(new Date().toLocaleTimeString("tr-TR"));
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setError(e?.message || "Hepsiburada verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab, 0);
  }, [tab, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");

    if (!q) return rows;

    return rows.filter((row) => JSON.stringify(row).toLocaleLowerCase("tr-TR").includes(q));
  }, [rows, search]);

  const salable = rows.filter((row) => row.isSalable === true).length;
  const stockSum = rows.reduce((sum, row) => sum + (Number(row.availableStock) || 0), 0);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Entegrasyon</div>
          <h1 className="text-2xl font-black text-slate-900">Hepsiburada</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Salt okunur görünüm. Ürünler Hepsiburada panelinden açılır; müşteri bilgisi gösterilmez.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${
              error ? "bg-rose-100 text-rose-700" : loading ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {error ? "Bağlantı hatası" : loading ? "Yükleniyor" : "Bağlı"}
          </span>
          <button
            type="button"
            onClick={() => void load(tab, offset)}
            disabled={loading}
            className="h-9 rounded-lg bg-slate-800 px-4 text-[11px] font-black uppercase text-white transition hover:bg-slate-900 disabled:opacity-50"
          >
            Yenile
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["urunler", "Ürünler"],
          ["siparisler", "Açık Siparişler"],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSearch("");
              setTab(key);
            }}
            className={`h-9 rounded-full px-4 text-[11px] font-black uppercase transition ${
              tab === key ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-black uppercase text-slate-400">{tab === "urunler" ? "Toplam ürün" : "Açık sipariş"}</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{total}</div>
        </div>
        {tab === "urunler" && (
          <>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase text-slate-400">Satışta (bu sayfa)</div>
              <div className="mt-1 text-2xl font-black text-emerald-600">{salable}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="text-[10px] font-black uppercase text-slate-400">Stok adedi (bu sayfa)</div>
              <div className="mt-1 text-2xl font-black text-slate-900">{stockSum}</div>
            </div>
          </>
        )}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[10px] font-black uppercase text-slate-400">Son kontrol</div>
          <div className="mt-1 text-lg font-black text-slate-900">{checkedAt || "-"}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Bu sayfada ara (ürün, stok kodu...)"
          className="h-9 w-full max-w-sm rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-400"
        />
        <div className="ml-auto flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <button
            type="button"
            disabled={loading || offset === 0}
            onClick={() => void load(tab, Math.max(0, offset - PAGE))}
            className="h-8 rounded-lg bg-slate-100 px-3 font-black disabled:opacity-40"
          >
            ‹ Önceki
          </button>
          <span>
            {page} / {pages}
          </span>
          <button
            type="button"
            disabled={loading || offset + PAGE >= total}
            onClick={() => void load(tab, offset + PAGE)}
            className="h-8 rounded-lg bg-slate-100 px-3 font-black disabled:opacity-40"
          >
            Sonraki ›
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        {tab === "urunler" ? (
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">Hepsiburada SKU</th>
                <th className="px-4 py-3">Stok kodu</th>
                <th className="px-4 py-3 text-right">Stok</th>
                <th className="px-4 py-3 text-right">Fiyat</th>
                <th className="px-4 py-3">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row, index) => (
                <tr key={`${row.hepsiburadaSku ?? index}`}>
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">{row.productName || row.name || "-"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.hepsiburadaSku}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.merchantSku}</td>
                  <td className="px-4 py-3 text-right text-[12px] font-black">{row.availableStock ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-[12px] font-bold">{formatMoney(row.price)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        row.isSalable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.isSalable ? "SATIŞTA" : "SATIŞTA DEĞİL"}
                    </span>
                    {row.isSuspended === true && <span className="ml-1 rounded-full bg-amber-100 px-2 py-1 text-[10px] font-black text-amber-700">ASKIDA</span>}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-400">
                    Kayıt yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Sipariş no</th>
                <th className="px-4 py-3">Ürün</th>
                <th className="px-4 py-3">Stok kodu</th>
                <th className="px-4 py-3 text-right">Adet</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Tarih</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row, index) => (
                <tr key={`${row.id ?? row.orderNumber ?? index}-${index}`}>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-700">{row.orderNumber}</td>
                  <td className="px-4 py-3 text-[12px] font-semibold text-slate-800">{row.productName || row.name || "-"}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.merchantSku || row.sku || row.hepsiburadaSku || "-"}</td>
                  <td className="px-4 py-3 text-right text-[12px] font-black">{row.quantity ?? "-"}</td>
                  <td className="px-4 py-3 text-[11px] font-bold text-slate-600">{row.status}</td>
                  <td className="px-4 py-3 text-[11px] text-slate-500">{orderDate(row)}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-400">
                    Açık sipariş yok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
