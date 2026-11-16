"use client";

// CNETMOBIL - Hepsiburada ekranı (Entegrasyonlar > Hepsiburada)
//
// Şimdilik SALT OKUNUR: bağlantı durumu, Hepsiburada'daki ürünler (stok, fiyat, satış durumu) ve açık
// siparişler. Ürünler Hepsiburada panelinden açılır; stok yazma ve sipariş bazlı kanal senkronu sonraki adım.
// Müşteri bilgisi gösterilmez.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import StockSyncPanel from "./StockSyncPanel";

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
  const [hbSku, setHbSku] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [statusText, setStatusText] = useState("");

  const send = async () => {
    const summary = `${row.malAd}
Kod: ${row.malKod}
Barkod: ${row.barkod}${hbSku ? `
Hepsiburada SKU: ${hbSku}` : ""}
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
        body: JSON.stringify({ malKod: row.malKod, price: Number(price), stock: Number(stock), hbSku: hbSku.trim(), confirm: true }),
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
      <button type="button" onClick={() => setOpen(true)} className="h-10 rounded-xl bg-blue-600 px-5 text-[13px] font-black text-white transition hover:bg-blue-700">
        Ürünü aç
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
      <label className="block text-[11px] font-bold text-slate-600">
        Hepsiburada SKU (isteğe bağlı, barkod bulunamazsa)
        <input value={hbSku} onChange={(e) => setHbSku(e.target.value)} placeholder="HBCV0000XXXXXX" className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 font-mono text-[11px]" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {!trackingId && (
          <button type="button" disabled={busy} onClick={() => void send()} className="h-8 rounded-lg bg-emerald-600 px-3 text-[10px] font-black uppercase text-white disabled:opacity-50">
            {busy ? "Gönderiliyor..." : "Gönder"}
          </button>
        )}
        {trackingId && (
          <button type="button" disabled={busy} onClick={() => { setTrackingId(""); setStatusText(""); setMessage(""); }} className="h-8 rounded-lg bg-slate-200 px-3 text-[10px] font-black uppercase text-slate-700">
            Yeniden dene
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

// Elle stok / fiyat güncelleme (stok artırma dahil; WingSM'e eşleşmiş üründe WingSM toplamını aşamaz).
function RowEditor({ row, onChanged }: { row: Row; onChanged: () => void }) {
  const [stock, setStock] = useState(String(row.availableStock ?? ""));
  const [price, setPrice] = useState(row.price === null || row.price === undefined ? "" : String(row.price));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);

  const stockChanged = stock.trim() !== "" && stock.trim() !== String(row.availableStock ?? "");
  const priceChanged = price.trim() !== "" && price.trim() !== String(row.price ?? "");

  const save = async () => {
    if (!stockChanged && !priceChanged) return;

    const parts = [stockChanged ? `stok ${row.availableStock ?? "-"} → ${stock}` : "", priceChanged ? `fiyat ${row.price ?? "-"} → ${price}` : ""].filter(Boolean).join(", ");

    if (!window.confirm(`Hepsiburada'da bu ürün GERÇEKTEN güncellenecek: ${parts}. Onaylıyor musunuz?`)) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/online/hepsiburada/listing-update", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hbSku: row.hepsiburadaSku,
          merchantSku: row.merchantSku,
          stock: stockChanged ? stock.trim() : undefined,
          price: priceChanged ? price.trim() : undefined,
        }),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setOk(true);
      setMessage(`Gönderildi (${[payload.stockUploadId && `stok #${String(payload.stockUploadId).slice(0, 8)}`, payload.priceUploadId && `fiyat #${String(payload.priceUploadId).slice(0, 8)}`].filter(Boolean).join(", ") || "tamam"}). Hepsiburada birkaç dakikada işler; Yenile ile kontrol edin.`);
      onChanged();
    } catch (e: any) {
      setOk(false);
      setMessage(e?.message || "Güncellenemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-w-[170px]">
      <div className="flex items-center gap-1">
        <input value={stock} onChange={(e) => setStock(e.target.value)} title="Hepsiburada stoğu" className="h-10 w-16 rounded-lg border border-slate-200 px-2 text-[13px] font-bold" />
        <div className="relative">
          <input value={price} onChange={(e) => setPrice(e.target.value)} title="Fiyat (TL)" className="h-10 w-28 rounded-lg border border-slate-200 pl-2 pr-8 text-[13px] font-bold" />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">TL</span>
        </div>
        <button
          type="button"
          disabled={busy || (!stockChanged && !priceChanged)}
          onClick={() => void save()}
          className="h-10 rounded-lg bg-blue-600 px-4 text-[12px] font-black text-white disabled:opacity-30"
        >
          {busy ? "..." : "Kaydet"}
        </button>
      </div>
      {message && <div className={`mt-1 max-w-[260px] text-[10px] font-bold ${ok ? "text-emerald-600" : "text-rose-600"}`}>{message}</div>}
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
        <span className="text-[10px] font-bold text-slate-400">{row.mapSource === "MANUAL" ? "elle" : row.mapSource === "SKU" ? "SKU ile otomatik" : "otomatik"}</span>
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
  const [tab, setTab] = useState<Tab>("siparisler");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [checkedAt, setCheckedAt] = useState("");
  const [sinifFilter, setSinifFilter] = useState("");
  const [urunFilter, setUrunFilter] = useState("all");
  const [durum, setDurum] = useState("any");
  const [barkod, setBarkod] = useState("any");
  const [sort, setSort] = useState("stock");
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Arama kutusu: yazmayı bıraktıktan 400 ms sonra TÜM ürünlerde sunucuda aranır (sayfa sayfa gezmeye gerek yok).
  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 400);

    return () => clearTimeout(timer);
  }, [search]);

  // Siparişler sekmesi küçük bir liste: arama tarayıcıda yapılır, sunucuya gitmez.
  const serverQuery = tab === "siparisler" ? "" : q;
  const paramsKey = tab === "urunler" ? `${serverQuery}|${urunFilter}` : tab === "adaylar" ? `${serverQuery}|${sinifFilter}|${durum}|${barkod}|${sort}` : "";
  const paramsRef = useRef({ serverQuery, urunFilter, sinifFilter, durum, barkod, sort });

  paramsRef.current = { serverQuery, urunFilter, sinifFilter, durum, barkod, sort };

  const load = useCallback(async (which: Tab, nextOffset: number) => {
    setLoading(true);
    setError("");

    try {
      const p = paramsRef.current;
      const endpoint = which === "urunler" ? "listings" : which === "siparisler" ? "orders" : "open-candidates";
      const extra =
        which === "adaylar"
          ? `&q=${encodeURIComponent(p.serverQuery)}&sinif=${encodeURIComponent(p.sinifFilter)}&durum=${p.durum}&barkod=${p.barkod}&sort=${p.sort}`
          : which === "urunler"
            ? `&q=${encodeURIComponent(p.serverQuery)}&filter=${p.urunFilter}`
            : "";
      const response = await fetch(`/api/online/hepsiburada/${endpoint}?offset=${nextOffset}&limit=${PAGE}${extra}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(Number(payload.totalCount) || 0);
      setCounts(payload.counts && typeof payload.counts === "object" ? payload.counts : {});
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

  // Sekme ya da arama/filtre değişince ilk sayfadan yeniden yükle.
  useEffect(() => {
    void load(tab, 0);
  }, [tab, paramsKey, load]);

  const filtered = useMemo(() => {
    if (tab !== "siparisler") return rows;

    const needle = search.trim().toLocaleLowerCase("tr-TR");

    if (!needle) return rows;

    return rows.filter((row) => JSON.stringify(row).toLocaleLowerCase("tr-TR").includes(needle));
  }, [rows, search, tab]);

  const pages = Math.max(1, Math.ceil(total / PAGE));
  const page = Math.floor(offset / PAGE) + 1;

  const rangeFrom = total === 0 ? 0 : offset + 1;
  const rangeTo = Math.min(offset + rows.length, total);
  const goPage = (p: number) => void load(tab, (p - 1) * PAGE);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Entegrasyon</div>
          <h1 className="text-3xl font-black text-slate-900">Hepsiburada</h1>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Ürünler Hepsiburada panelinden ya da buradan açılır. WingSM'e bir şey yazılmaz. Müşteri bilgisi gösterilmez.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`flex h-10 items-center gap-2 rounded-xl px-4 text-[12px] font-black ${
              error ? "bg-rose-100 text-rose-700" : loading ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            <Icon name="link" className="h-4 w-4" />
            {error ? "Bağlantı hatası" : loading ? "Yükleniyor" : "Bağlı"}
          </span>
          <span className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-[12px] font-bold text-slate-500">
            Son kontrol: <b className="ml-1 text-slate-900">{checkedAt || "-"}</b>
          </span>
          <button
            type="button"
            onClick={() => void load(tab, offset)}
            disabled={loading}
            className="flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-5 text-[12px] font-black text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Icon name="refresh" className="h-4 w-4" />
            Yenile
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([
          ["siparisler", "Açık Siparişler"],
          ["urunler", "Ürünler"],
          ["adaylar", "WingSM'den Aç"],
        ] as Array<[Tab, string]>).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setSearch("");
              setQ("");
              setTab(key);
            }}
            className={`h-10 rounded-full border px-5 text-[12px] font-black transition ${
              tab === key ? "border-blue-600 bg-blue-600 text-white shadow" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {tab === "adaylar" && (
          <>
            <Stat icon="layers" tint="bg-blue-50 text-blue-600" label="Toplam Ürün" value={counts.all ?? total} />
            <Stat icon="tag" tint="bg-sky-50 text-sky-600" label="Açılabilir" value={counts.openable ?? "-"} />
            <Stat icon="check" tint="bg-emerald-50 text-emerald-600" label="Zaten Açık" value={counts.opened ?? "-"} />
          </>
        )}
        {tab === "urunler" && (
          <>
            <Stat icon="layers" tint="bg-blue-50 text-blue-600" label="Listelenen ürün" value={counts.all ?? total} />
            <Stat icon="cart" tint="bg-emerald-50 text-emerald-600" label="Satışta" value={counts.salable ?? "-"} valueClass="text-emerald-600" />
            <Stat icon="ban" tint="bg-rose-50 text-rose-600" label="Tükendi" value={counts.soldout ?? "-"} valueClass="text-rose-600" />
          </>
        )}
        {tab === "siparisler" && <Stat icon="cart" tint="bg-blue-50 text-blue-600" label="Açık sipariş" value={total} />}
      </div>

      {tab === "urunler" && <StockSyncPanel />}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {tab !== "siparisler" && (
          <div className="flex flex-wrap gap-x-8 border-b border-slate-200 px-6">
            {(tab === "adaylar"
              ? ([
                  ["any", `Tüm Ürünler (${counts.all ?? "-"})`],
                  ["openable", `Açılabilir (${counts.openable ?? "-"})`],
                  ["opened", `Zaten Açık (${counts.opened ?? "-"})`],
                ] as Array<[string, string]>)
              : ([
                  ["all", `Tümü (${counts.all ?? "-"})`],
                  ["salable", `Satışta (${counts.salable ?? "-"})`],
                  ["soldout", `Tükendi (${counts.soldout ?? "-"})`],
                ] as Array<[string, string]>)
            ).map(([key, label]) => {
              const active = tab === "adaylar" ? durum === key : urunFilter === key;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => (tab === "adaylar" ? setDurum(key) : setUrunFilter(key))}
                  className={`-mb-px border-b-2 py-4 text-[14px] font-black transition ${
                    active ? "border-blue-600 text-blue-600" : "border-transparent text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[240px] flex-1">
              <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tab === "siparisler" ? "Siparişlerde ara..." : "Marka, model veya SKU ara..."}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-400"
              />
            </div>
            {tab === "adaylar" && (
              <>
                <select value={barkod} onChange={(e) => setBarkod(e.target.value)} className="h-11 min-w-[190px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  <option value="any">Barkod durumu: Hepsi</option>
                  <option value="barcode">Geçerli barkodlu ({counts.barcode ?? "-"})</option>
                  <option value="sku">HB SKU'lu ({counts.sku ?? "-"})</option>
                  <option value="none">Barkodsuz / SKU'suz ({counts.none ?? "-"})</option>
                </select>
                <select value={sinifFilter} onChange={(e) => setSinifFilter(e.target.value)} className="h-11 min-w-[160px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  <option value="">Tüm sınıflar</option>
                  <option value="1el">1el (sıfır telefon)</option>
                  <option value="6el">6el (aksesuar)</option>
                  <option value="aks">aks</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)} className="h-11 min-w-[170px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
                  <option value="stock">Stok: Çoktan aza</option>
                  <option value="stock_asc">Stok: Azdan çoğa</option>
                  <option value="name">Ada göre</option>
                </select>
              </>
            )}
          </div>

          {tab === "adaylar" && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-[13px] font-semibold text-slate-700">
              <Icon name="info" className="h-4 w-4 shrink-0 text-blue-600" />
              Ürünler, satırdaki onayınızla Hepsiburada'ya gönderilir. Listeleme hiçbir şey göndermez.
            </div>
          )}
          {tab === "urunler" && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-[13px] font-semibold text-slate-700">
              <Icon name="info" className="h-4 w-4 shrink-0 text-blue-600" />
              Stok ve fiyat satırdan elle güncellenir. Hepsiburada stoğu WingSM toplam stoğunu aşamaz.
            </div>
          )}

          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            {tab === "adaylar" ? (
              <table className="w-full min-w-[980px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-500">
                    <th className="px-4 py-3">Ürün</th>
                    <th className="px-4 py-3">Hafıza / Renk</th>
                    <th className="px-4 py-3">Stok</th>
                    <th className="px-4 py-3">Fiyat</th>
                    <th className="px-4 py-3">Eşleşme Durumu</th>
                    <th className="px-4 py-3">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row, index) => {
                    const specs = parseSpecs(row.malAd);

                    return (
                      <tr key={`${row.malKod ?? index}`} className="align-top">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Thumb kind={row.sinif} />
                            <div>
                              <div className="text-[14px] font-black text-slate-900">{row.malAd}</div>
                              <div className="text-[12px] font-semibold text-slate-500">
                                Kod: {row.malKod} · sınıf: {row.sinif} · {row.depoSayisi} depo
                              </div>
                              {row.barkod && <div className={`font-mono text-[11px] ${row.barkodGecerli ? "text-slate-400" : "text-rose-500"}`}>Barkod: {row.barkod}</div>}
                              {row.hbSku && <div className="font-mono text-[11px] font-bold text-blue-600">HB SKU: {row.hbSku}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-[13px] font-semibold text-slate-700">{specs.memory || specs.color ? [specs.memory, specs.color].filter(Boolean).join(" / ") : "-"}</td>
                        <td className="px-4 py-4 text-[15px] font-black text-slate-900">{row.adet}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-[13px] font-bold text-slate-800">{row.satisFiyat ? formatMoney(row.satisFiyat) : "-"}</td>
                        <td className="px-4 py-4">
                          {row.opened ? (
                            <Badge tone="green">Zaten açık</Badge>
                          ) : row.hbSku ? (
                            <Badge tone="green">HB SKU hazır</Badge>
                          ) : row.barkodGecerli ? (
                            <Badge tone="green">Barkod hazır</Badge>
                          ) : row.barkod ? (
                            <Badge tone="amber">Barkod geçersiz</Badge>
                          ) : (
                            <Badge tone="rose">Barkod yok</Badge>
                          )}
                        </td>
                        <td className="px-4 py-4">{row.opened ? <span className="text-[12px] font-bold text-slate-400">Hepsiburada'da açık</span> : <OpenButton row={row} />}</td>
                      </tr>
                    );
                  })}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                        Kayıt yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : tab === "urunler" ? (
              <table className="w-full min-w-[1180px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-500">
                    <th className="px-4 py-3">Ürün</th>
                    <th className="px-4 py-3">HB SKU</th>
                    <th className="px-4 py-3">WingSM eşleşmesi</th>
                    <th className="px-4 py-3 text-right">HB stok</th>
                    <th className="px-4 py-3 text-right">WingSM stok</th>
                    <th className="px-4 py-3 text-right">Fiyat</th>
                    <th className="px-4 py-3">Durum</th>
                    <th className="px-4 py-3">Stok ve fiyat düzenle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((row, index) => {
                    const specs = parseSpecs(row.productName);

                    return (
                      <tr key={`${row.hepsiburadaSku ?? index}`} className="align-top">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <Thumb kind={row.wingClass} />
                            <div>
                              <div className="text-[14px] font-black text-slate-900">{row.productName || "Eşleşmemiş ürün"}</div>
                              <div className="text-[12px] font-semibold text-slate-500">
                                {[specs.memory, specs.color].filter(Boolean).join(" · ")}
                                {specs.memory || specs.color ? " · " : ""}Stok kodu: {row.merchantSku}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-[12px] text-slate-600">{row.hepsiburadaSku}</td>
                        <td className="px-4 py-4">
                          <WingPicker row={row} onChanged={() => void load(tab, offset)} />
                        </td>
                        <td className="px-4 py-4 text-right text-[15px] font-black text-slate-900">{row.availableStock ?? "-"}</td>
                        <td
                          className={`px-4 py-4 text-right text-[15px] font-black ${
                            row.wingStock === null || row.wingStock === undefined
                              ? "text-slate-300"
                              : Number(row.wingStock) === Number(row.availableStock)
                                ? "text-emerald-600"
                                : "text-amber-600"
                          }`}
                        >
                          {row.wingStock ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-right text-[13px] font-bold text-slate-800">{formatMoney(row.price)}</td>
                        <td className="px-4 py-4">
                          {row.isSalable ? <Badge tone="green">Satışta</Badge> : <Badge tone="gray">Satışta değil</Badge>}
                          {row.isSuspended === true && <span className="ml-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-700">Askıda</span>}
                        </td>
                        <td className="px-4 py-4">
                          <RowEditor key={`${row.availableStock}-${row.price}`} row={row} onChanged={() => void load(tab, offset)} />
                        </td>
                      </tr>
                    );
                  })}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                        Kayıt yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-bold text-slate-500">
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
                      <td className="px-4 py-4 font-mono text-[12px] text-slate-700">{row.orderNumber}</td>
                      <td className="px-4 py-4 text-[14px] font-black text-slate-900">{row.productName || row.name || "-"}</td>
                      <td className="px-4 py-4 font-mono text-[12px] text-slate-600">{row.merchantSKU || row.merchantSku || row.sku || "-"}</td>
                      <td className="px-4 py-4 text-right text-[15px] font-black">{row.quantity ?? "-"}</td>
                      <td className="px-4 py-4 text-[12px] font-bold text-slate-600">{row.status}</td>
                      <td className="px-4 py-4 text-[12px] text-slate-500">{orderDate(row)}</td>
                    </tr>
                  ))}
                  {!loading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-sm font-bold text-slate-400">
                        Açık sipariş yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>

          {tab !== "siparisler" && (
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] font-semibold text-slate-500">
              <span>
                {total} üründen {rangeFrom}-{rangeTo} gösteriliyor
              </span>
              <Pagination page={page} pages={pages} disabled={loading} onGo={goPage} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- Görünüm yardımcıları ----

const COLOR_TR: Record<string, string> = {
  BLACK: "Siyah", SIYAH: "Siyah", BLUE: "Mavi", MAVI: "Mavi", WHITE: "Beyaz", BEYAZ: "Beyaz", GRAY: "Gri", GREY: "Gri", GRI: "Gri",
  SILVER: "Gümüş", GUMUS: "Gümüş", GOLD: "Altın", ALTIN: "Altın", PINK: "Pembe", PEMBE: "Pembe", RED: "Kırmızı", KIRMIZI: "Kırmızı",
  GREEN: "Yeşil", YESIL: "Yeşil", PURPLE: "Mor", MOR: "Mor", ORANGE: "Turuncu", TURUNCU: "Turuncu", YELLOW: "Sarı", SARI: "Sarı",
  LACIVERT: "Lacivert", NAVY: "Lacivert", TITANYUM: "Titanyum", TITANIUM: "Titanyum", BROWN: "Kahverengi", KAHVERENGI: "Kahverengi", CREAM: "Krem", KREM: "Krem",
};

// Ürün adından hafıza ve renk ayıklar (örn. "TECNO SPARK 50 5G 128/6 GB BLACK" -> 128 GB · 6 GB RAM / Siyah). Bulamazsa boş döner.
function parseSpecs(name: unknown): { memory: string; color: string } {
  const text = String(name ?? "")
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .replace(/Ş/g, "S")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
  const pair = text.match(/(\d{2,4})\s*\/\s*(\d{1,2})\s*(?:GB)?/);
  const single = text.match(/(\d{2,4})\s*GB/);
  const memory = pair ? `${pair[1]} GB · ${pair[2]} GB RAM` : single ? `${single[1]} GB` : "";
  const colors = text.split(/[^A-Z]+/).filter((word) => COLOR_TR[word]).map((word) => COLOR_TR[word]);

  return { memory, color: colors.length ? Array.from(new Set(colors)).join(" ") : "" };
}

function Icon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    link: <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />,
    refresh: <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />,
    search: <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3" />,
    info: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" />,
    layers: <path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5" />,
    tag: <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9zM8 8h.01" />,
    check: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM8 12l3 3 5-6" />,
    cart: <path d="M3 4h2l2.4 11h11l2-8H6M9 20h.01M17 20h.01" />,
    ban: <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM5 5l14 14" />,
    phone: <path d="M8 2h8a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 19h2" />,
    box: <path d="M21 8 12 3 3 8v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8" />,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Stat({ icon, tint, label, value, valueClass }: { icon: string; tint: string; label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${tint}`}>
        <Icon name={icon} className="h-7 w-7" />
      </span>
      <div>
        <div className="text-[15px] font-bold text-slate-600">{label}</div>
        <div className={`text-3xl font-black ${valueClass || "text-slate-900"}`}>{value}</div>
      </div>
    </div>
  );
}

function Thumb({ kind }: { kind?: string }) {
  return (
    <span className="flex h-12 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
      <Icon name={kind === "1el" ? "phone" : "box"} className="h-6 w-6" />
    </span>
  );
}

function Badge({ tone, children }: { tone: "green" | "amber" | "rose" | "gray"; children: React.ReactNode }) {
  const styles = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    gray: "bg-slate-100 text-slate-500",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-black ${styles}`}>
      <Icon name={tone === "green" ? "check" : tone === "gray" ? "ban" : "info"} className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}

// Numaralı sayfalama: 1 2 3 4 5 … son
function Pagination({ page, pages, disabled, onGo }: { page: number; pages: number; disabled: boolean; onGo: (p: number) => void }) {
  const wanted = new Set<number>([1, pages, page - 1, page, page + 1]);

  if (page <= 3) for (let i = 1; i <= 5; i += 1) wanted.add(i);

  const list = Array.from(wanted).filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const items: Array<number | "gap-a" | "gap-b"> = [];

  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) items.push(i === list.length - 1 ? "gap-b" : "gap-a");

    items.push(n);
  });

  const base = "flex h-10 min-w-10 items-center justify-center rounded-lg border px-3 text-[13px] font-black transition disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" disabled={disabled || page <= 1} onClick={() => onGo(page - 1)} className={`${base} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
        ‹
      </button>
      {items.map((item) =>
        typeof item === "number" ? (
          <button
            key={item}
            type="button"
            disabled={disabled}
            onClick={() => onGo(item)}
            className={`${base} ${item === page ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="px-1 text-slate-400">
            …
          </span>
        )
      )}
      <button type="button" disabled={disabled || page >= pages} onClick={() => onGo(page + 1)} className={`${base} border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}>
        ›
      </button>
    </div>
  );
}
