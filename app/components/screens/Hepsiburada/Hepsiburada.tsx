"use client";

// CNETMOBIL - Hepsiburada ekranı (Entegrasyonlar > Hepsiburada)
//
// Şimdilik SALT OKUNUR: bağlantı durumu, Hepsiburada'daki ürünler (stok, fiyat, satış durumu) ve açık
// siparişler. Ürünler Hepsiburada panelinden açılır; stok yazma ve sipariş bazlı kanal senkronu sonraki adım.
// Müşteri bilgisi gösterilmez.

import React, { useCallback, useEffect, useMemo, useState } from "react";

type Row = Record<string, any>;
type Tab = "urunler" | "siparisler" | "adaylar";

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

// WingSM sıfır ürününü Hepsiburada'ya AÇAR (hızlı ürün ekleme). Bir seferde TEK ürün, gönderimden önce onay istenir.
// Gönderince Hepsiburada bir takip kodu (trackingId) verir; sonuç "Durumu sorgula" ile görülür.
function OpenButton({ row }: { row: Row }) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState(row.satisFiyat ? String(row.satisFiyat) : "");
  const [stock, setStock] = useState(String(row.adet ?? 0));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [statusText, setStatusText] = useState("");

  const send = async () => {
    const summary = `${row.malAd}
Kod: ${row.malKod}
Barkod: ${row.barkod}
Fiyat: ${price} TL
Stok: ${stock}

Bu ürün Hepsiburada'da GERÇEK olarak açılacak. Onaylıyor musunuz?`;

    if (!window.confirm(summary)) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/online/hepsiburada/open", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ malKod: row.malKod, price: Number(price), stock: Number(stock), confirm: true }),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}: ${JSON.stringify(payload?.response ?? "").slice(0, 300)}`);

      setTrackingId(payload.trackingId || "");
      setMessage(payload.trackingId ? "Hepsiburada'ya gönderildi. Takip kodu alındı, sonucu sorgulayın." : `Gönderildi (HTTP ${payload.status}), takip kodu çıkmadı: ${JSON.stringify(payload.response).slice(0, 200)}`);
    } catch (e: any) {
      setMessage(e?.message || "Gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const check = async () => {
    setBusy(true);

    try {
      const response = await fetch(`/api/online/hepsiburada/open?trackingId=${encodeURIComponent(trackingId)}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || "Sorgulanamadı.");

      const item = payload.items?.[0];

      setStatusText(
        item
          ? `Durum: ${item.productStatus || "-"} · import: ${item.importStatus || "-"}${item.hbSku ? ` · HB SKU: ${item.hbSku}` : ""}${
              item.importMessages?.length || item.rejectReasons?.length ? ` · ${JSON.stringify([...(item.importMessages || []), ...(item.rejectReasons || [])]).slice(0, 220)}` : ""
            }`
          : `Henüz sonuç yok (HTTP ${payload.status}).`
      );
    } catch (e: any) {
      setStatusText(e?.message || "Sorgulanamadı.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="ml-2 h-7 rounded-lg bg-blue-600 px-3 text-[10px] font-black uppercase text-white transition hover:bg-blue-700">
        Hepsiburada'ya aç
      </button>
    );
  }

  return (
    <div className="mt-2 w-[280px] space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
        <label className="flex-1">
          Fiyat (TL)
          <input value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" />
        </label>
        <label className="w-20">
          Stok
          <input value={stock} onChange={(e) => setStock(e.target.value)} className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-[12px]" />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {!trackingId && (
          <button type="button" disabled={busy} onClick={() => void send()} className="h-8 rounded-lg bg-emerald-600 px-3 text-[10px] font-black uppercase text-white disabled:opacity-50">
            {busy ? "Gönderiliyor..." : "Gönder"}
          </button>
        )}
        {trackingId && (
          <button type="button" disabled={busy} onClick={() => void check()} className="h-8 rounded-lg bg-slate-800 px-3 text-[10px] font-black uppercase text-white disabled:opacity-50">
            Durumu sorgula
          </button>
        )}
        <button type="button" onClick={() => setOpen(false)} className="text-[10px] font-black uppercase text-slate-500 underline">
          kapat
        </button>
      </div>
      {message && <div className="text-[10px] font-bold text-slate-600">{message}</div>}
      {statusText && <div className="text-[10px] font-bold text-blue-700">{statusText}</div>}
    </div>
  );
}

// Hepsiburada ürününü WingSM sıfır ürünüyle eşleştiren küçük arama kutusu.
// Eşleşme varsa kod + kaldır düğmesi; yoksa ad/kod yazıp WingSM ürünlerinden seçilir. Yalnız bizim tabloya yazar.
function WingPicker({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/online/hepsiburada/wing-search?q=${encodeURIComponent(query.trim())}`, { cache: "no-store", credentials: "same-origin" });
        const payload = await response.json().catch(() => null);

        setResults(payload?.success && Array.isArray(payload.rows) ? payload.rows : []);
      } catch {
        setResults([]);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, open]);

  const send = async (method: "POST" | "DELETE", malKod?: string) => {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/online/hepsiburada/map", {
        method,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(method === "POST" ? { hbSku: row.hepsiburadaSku, malKod } : { hbSku: row.hepsiburadaSku }),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setOpen(false);
      setQuery("");
      onChanged();
    } catch (e: any) {
      setMessage(e?.message || "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  if (row.malKod && !open) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded bg-blue-50 px-2 py-1 font-mono text-[11px] font-black text-blue-700">{row.malKod}</span>
        <span className="text-[10px] font-bold text-slate-400">{row.mapSource === "AUTO" ? "otomatik" : "elle"}</span>
        <button type="button" disabled={busy} onClick={() => setOpen(true)} className="text-[10px] font-black uppercase text-slate-500 underline">
          değiştir
        </button>
        {row.mapSource === "MANUAL" && (
          <button type="button" disabled={busy} onClick={() => void send("DELETE")} className="text-[10px] font-black uppercase text-rose-600 underline">
            kaldır
          </button>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-lg bg-slate-100 px-3 text-[10px] font-black uppercase text-slate-600 transition hover:bg-slate-200">
        Eşleştir
      </button>
    );
  }

  return (
    <div className="relative min-w-[240px]">
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="WingSM ürün adı ya da kodu..."
        className="h-8 w-full rounded-lg border border-blue-300 px-2.5 text-[11px] outline-none"
      />
      <button type="button" onClick={() => { setOpen(false); setQuery(""); }} className="absolute right-2 top-1.5 text-[10px] font-black text-slate-400">
        ✕
      </button>
      {results.length > 0 && (
        <div className="absolute left-0 z-20 mt-1 max-h-64 w-[360px] overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((item) => (
            <button
              key={item.mal_kod}
              type="button"
              disabled={busy}
              onClick={() => void send("POST", String(item.mal_kod))}
              className="flex w-full items-start justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left hover:bg-blue-50"
            >
              <span className="text-[11px] font-semibold text-slate-800">
                {item.mal_ad}
                <span className="block font-mono text-[10px] text-slate-400">
                  {item.mal_kod} · {item.sinif}
                </span>
              </span>
              <span className="shrink-0 text-[11px] font-black text-slate-600">{item.adet} adet</span>
            </button>
          ))}
        </div>
      )}
      {message && <div className="mt-1 text-[10px] font-bold text-rose-600">{message}</div>}
    </div>
  );
}

export default function Hepsiburada() {
  const [tab, setTab] = useState<Tab>("urunler");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [sinifFilter, setSinifFilter] = useState("");
  const [onlyBarcode, setOnlyBarcode] = useState(false);
  const [barcodedCount, setBarcodedCount] = useState(0);

  const load = useCallback(async (which: Tab, nextOffset: number) => {
    setLoading(true);
    setError("");

    try {
      const endpoint = which === "urunler" ? "listings" : which === "siparisler" ? "orders" : "open-candidates";
      const extra = which === "adaylar" ? `&sinif=${encodeURIComponent(sinifFilter)}&onlyBarcode=${onlyBarcode ? 1 : 0}` : "";
      const response = await fetch(`/api/online/hepsiburada/${endpoint}?offset=${nextOffset}&limit=${PAGE}${extra}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.totalCount) || 0);
      setBarcodedCount(Number(payload.barcodedCount) || 0);
      setOffset(nextOffset);
      setCheckedAt(new Date().toLocaleTimeString("tr-TR"));
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setError(e?.message || "Hepsiburada verisi alınamadı.");
    } finally {
      setLoading(false);
    }
  }, [sinifFilter, onlyBarcode]);

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
            Ürünler Hepsiburada panelinden açılır. WingSM eşleşmesi yalnızca bizim tabloya kaydedilir; Hepsiburada ve WingSM'e bir şey yazılmaz. Müşteri bilgisi gösterilmez.
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
          ["adaylar", "WingSM'den Aç (önizleme)"],
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
          <div className="text-[10px] font-black uppercase text-slate-400">
            {tab === "urunler" ? "Toplam ürün" : tab === "siparisler" ? "Açık sipariş" : "WingSM sıfır ürün"}
          </div>
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

      {tab === "adaylar" && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-[11px] font-bold text-slate-600">
          <span>
            Hepsiburada'ya açılabilecek WingSM sıfır ürünler. <b>Önizleme:</b> hiçbir şey gönderilmez. Barkodlu ürün: {barcodedCount} / {total}.
          </span>
          <select value={sinifFilter} onChange={(e) => setSinifFilter(e.target.value)} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold">
            <option value="">Tüm sınıflar</option>
            <option value="1el">1el (sıfır telefon)</option>
            <option value="6el">6el (aksesuar)</option>
            <option value="aks">aks</option>
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" checked={onlyBarcode} onChange={(e) => setOnlyBarcode(e.target.checked)} /> sadece barkodlu
          </label>
        </div>
      )}

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
        {tab === "adaylar" ? (
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">WingSM ürünü</th>
                <th className="px-4 py-3">Kod</th>
                <th className="px-4 py-3">Barkod</th>
                <th className="px-4 py-3 text-right">Satış fiyatı</th>
                <th className="px-4 py-3 text-right">WingSM stok</th>
                <th className="px-4 py-3">Hepsiburada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row, index) => (
                <tr key={`${row.malKod ?? index}`}>
                  <td className="px-4 py-3">
                    <div className="text-[12px] font-semibold text-slate-800">{row.malAd}</div>
                    <div className="text-[10px] font-semibold text-slate-400">sınıf: {row.sinif} · {row.depoSayisi} depo</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.malKod}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.barkod || <span className="text-rose-500">barkod yok</span>}</td>
                  <td className="px-4 py-3 text-right text-[12px] font-bold">{row.satisFiyat ? formatMoney(row.satisFiyat) : "-"}</td>
                  <td className="px-4 py-3 text-right text-[12px] font-black">{row.adet}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${row.opened ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {row.opened ? "AÇIK" : row.barkod ? "AÇILABİLİR" : "BARKOD YOK"}
                    </span>
                    {!row.opened && row.barkod && <OpenButton row={row} />}
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
        ) : tab === "urunler" ? (
          <table className="w-full min-w-[980px] text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Ürün (WingSM)</th>
                <th className="px-4 py-3">Hepsiburada SKU</th>
                <th className="px-4 py-3">Stok kodu</th>
                <th className="px-4 py-3">WingSM eşleşmesi</th>
                <th className="px-4 py-3 text-right">HB stok</th>
                <th className="px-4 py-3 text-right">WingSM stok</th>
                <th className="px-4 py-3 text-right">Fiyat</th>
                <th className="px-4 py-3">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((row, index) => (
                <tr key={`${row.hepsiburadaSku ?? index}`}>
                  <td className="px-4 py-3">
                    <div className="text-[12px] font-semibold text-slate-800">{row.productName || "-"}</div>
                    {row.wingClass && <div className="text-[10px] font-semibold text-slate-400">sınıf: {row.wingClass}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.hepsiburadaSku}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.merchantSku}</td>
                  <td className="px-4 py-3">
                    <WingPicker row={row} onChanged={() => void load(tab, offset)} />
                  </td>
                  <td className="px-4 py-3 text-right text-[12px] font-black">{row.availableStock ?? "-"}</td>
                  <td
                    className={`px-4 py-3 text-right text-[12px] font-black ${
                      row.wingStock === null || row.wingStock === undefined
                        ? "text-slate-300"
                        : Number(row.wingStock) === Number(row.availableStock)
                          ? "text-emerald-600"
                          : "text-amber-600"
                    }`}
                  >
                    {row.wingStock ?? "-"}
                  </td>
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
                  <td colSpan={8} className="px-4 py-8 text-center text-sm font-bold text-slate-400">
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
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{row.merchantSKU || row.merchantSku || row.sku || "-"}</td>
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
