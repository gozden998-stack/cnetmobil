"use client";

// CNETMOBIL - Garantili (partner.garantili.com.tr) entegrasyon ekranı
// 1. aşama: SALT OKUNUR. Bağlantı testi + Garantili'deki cihazlar / ilanlar / siparişler.
// Alan adları henüz canlıda görülmedi; tablolar gelen veriye göre kolon seçer (sonraki aşamada sabitlenecek).

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Row = Record<string, any>;
type Tab = "baglanti" | "cihaz" | "ilan" | "siparis";

const PAGE = 50;

const TABS: { id: Tab; label: string }[] = [
  { id: "baglanti", label: "Bağlantı" },
  { id: "cihaz", label: "Cihazlarım" },
  { id: "ilan", label: "İlanlar" },
  { id: "siparis", label: "Siparişler" },
];

// Kolon önceliği: bunlara benzeyen alanlar öne alınır
const PRIORITY = [/imei/i, /marka/i, /model/i, /hafiza/i, /renk/i, /grade|kutu/i, /durum|statu/i, /ilan/i, /fiyat|tutar/i, /tarih/i, /^id$|_id$|no$/i];

function isScalar(value: unknown) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function pickColumns(rows: Row[]): string[] {
  const seen = new Map<string, number>();

  for (const row of rows.slice(0, 20)) {
    for (const [key, value] of Object.entries(row ?? {})) {
      if (isScalar(value)) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }

  const keys = Array.from(seen.keys());
  const score = (key: string) => {
    const index = PRIORITY.findIndex((pattern) => pattern.test(key));

    return index === -1 ? 99 : index;
  };

  return keys.sort((a, b) => score(a) - score(b)).slice(0, 9);
}

function formatCell(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Evet" : "Hayır";

  const textValue = String(value);

  return textValue.length > 60 ? `${textValue.slice(0, 57)}...` : textValue;
}

function ProbeCard({ title, probe }: { title: string; probe: Row | undefined }) {
  if (!probe) return null;

  const failed = Boolean(probe.error) || probe.ok === false;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[15px] font-black text-slate-900">{title}</div>
        <span className={`rounded-full px-3 py-1 text-[12px] font-black ${failed ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
          {probe.error ? "HATA" : `HTTP ${probe.status}${probe.ok ? " · tamam" : ""}`}
        </span>
      </div>
      {probe.error && <div className="mt-2 text-[13px] font-semibold text-rose-600">{probe.error}</div>}
      {probe.detail && <div className="mt-2 break-all text-[12px] font-semibold text-rose-600">{probe.detail}</div>}
      {probe.message && !failed && <div className="mt-2 text-[12px] font-semibold text-slate-500">{probe.message}</div>}
      {typeof probe.total === "number" && <div className="mt-2 text-[13px] font-bold text-slate-700">Toplam kayıt: {probe.total}</div>}
      {Array.isArray(probe.rowKeys) && probe.rowKeys.length > 0 && (
        <div className="mt-2 text-[12px] font-semibold text-slate-500">Alanlar: {probe.rowKeys.join(", ")}</div>
      )}
      {Array.isArray(probe.dataKeys) && probe.dataKeys.length > 0 && (
        <div className="mt-2 text-[12px] font-semibold text-slate-500">Veri alanları: {probe.dataKeys.join(", ")}</div>
      )}
      {(probe.firstRow || probe.data) && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600">{probe.firstRow || probe.data}</pre>
      )}
    </div>
  );
}

export default function Garantili() {
  const [tab, setTab] = useState<Tab>("baglanti");

  // Bağlantı
  const [health, setHealth] = useState<Row | null>(null);
  const [healthBusy, setHealthBusy] = useState(false);

  // Veri sekmeleri
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openRow, setOpenRow] = useState<number | null>(null);
  const requestId = useRef(0);

  const testConnection = async () => {
    setHealthBusy(true);

    try {
      const response = await fetch("/api/online/garantili/health", { cache: "no-store", credentials: "same-origin" });

      setHealth(await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` })));
    } catch (e: any) {
      setHealth({ success: false, error: e?.message || "Bağlantı testi yapılamadı." });
    } finally {
      setHealthBusy(false);
    }
  };

  const load = useCallback(async (kaynak: Exclude<Tab, "baglanti">, pageNumber: number, q: string) => {
    const id = ++requestId.current;

    setBusy(true);
    setError("");

    try {
      const query = new URLSearchParams({ kaynak, sayfa: String(pageNumber), adet: String(PAGE) });

      if (q.trim()) query.set("ara", q.trim());

      const response = await fetch(`/api/online/garantili/data?${query.toString()}`, { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (id !== requestId.current) return;

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
      setTotal(typeof payload.total === "number" ? payload.total : null);
    } catch (e: any) {
      if (id !== requestId.current) return;

      setRows([]);
      setTotal(null);
      setError(e?.message || "Veri alınamadı.");
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }, []);

  // Sekme değişince başa dön
  useEffect(() => {
    setPage(1);
    setSearch("");
    setOpenRow(null);
    setRows([]);
    setTotal(null);
    setError("");
  }, [tab]);

  // Arama: 400 ms bekleyip sayfa 1'den; sayfa değişince hemen
  const lastSearch = useRef("");

  useEffect(() => {
    if (tab === "baglanti") return;

    const searchChanged = lastSearch.current !== search;

    lastSearch.current = search;

    const timer = setTimeout(() => void load(tab, page, search), searchChanged ? 400 : 0);

    return () => clearTimeout(timer);
  }, [tab, page, search, load]);

  const columns = useMemo(() => pickColumns(rows), [rows]);
  const lastPage = total ? Math.max(1, Math.ceil(total / PAGE)) : rows.length === PAGE ? page + 1 : page;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[20px] font-black text-slate-900">Garantili</div>
        <div className="text-[13px] font-semibold text-slate-500">Partner paneli entegrasyonu. Bu sürüm salt okunur: hiçbir şey gönderilmez.</div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-xl px-5 py-2.5 text-[14px] font-black transition ${tab === item.id ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "baglanti" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <button
              type="button"
              disabled={healthBusy}
              onClick={() => void testConnection()}
              className="rounded-xl bg-violet-600 px-5 py-2.5 text-[14px] font-black text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {healthBusy ? "Test ediliyor..." : "Bağlantıyı test et"}
            </button>
            <div className="text-[13px] font-semibold text-slate-500">Hesabı, ilk 3 cihazı, ilk 3 ilanı ve ilk 3 siparişi okur.</div>
          </div>

          {health && !health.success && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13px] font-bold text-rose-700">{health.error || "Bağlantı kurulamadı."}</div>}

          {health?.success && (
            <div className="grid gap-4 md:grid-cols-2">
              <ProbeCard title="Hesabım (/auth/ben)" probe={health.ben} />
              <ProbeCard title="Cihazlar" probe={health.cihaz} />
              <ProbeCard title="İlanlar" probe={health.ilan} />
              <ProbeCard title="Siparişler" probe={health.siparis} />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder={tab === "siparis" ? "Sipariş no / IMEI ara" : "IMEI / seri no ara"}
              className="h-11 w-full max-w-sm rounded-xl border border-slate-200 px-4 text-[14px] font-semibold text-slate-800 outline-none focus:border-violet-400"
            />
            <div className="text-[13px] font-bold text-slate-500">{busy ? "Yükleniyor..." : total !== null ? `${total} kayıt` : `${rows.length} kayıt`}</div>
          </div>

          {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] font-bold text-rose-700">{error}</div>}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
                  {columns.map((column) => (
                    <th key={column} className="whitespace-nowrap px-3 py-2">
                      {column.replace(/_/g, " ")}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.length === 0 && !busy && (
                  <tr>
                    <td colSpan={Math.max(columns.length + 1, 2)} className="px-3 py-6 text-center text-[13px] font-semibold text-slate-400">
                      Kayıt yok.
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => (
                  <React.Fragment key={index}>
                    <tr className="text-[13px] text-slate-800">
                      {columns.map((column) => (
                        <td key={column} className="whitespace-nowrap px-3 py-2 font-semibold">
                          {formatCell(row[column])}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => setOpenRow(openRow === index ? null : index)} className="text-[12px] font-black text-violet-600 hover:underline">
                          {openRow === index ? "Kapat" : "Ham veri"}
                        </button>
                      </td>
                    </tr>
                    {openRow === index && (
                      <tr>
                        <td colSpan={columns.length + 1} className="bg-slate-50 px-3 py-2">
                          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all text-[11px] text-slate-600">{JSON.stringify(row, null, 2)}</pre>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={page <= 1 || busy}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Önceki
            </button>
            <div className="text-[13px] font-bold text-slate-500">
              Sayfa {page}
              {total ? ` / ${lastPage}` : ""}
            </div>
            <button
              type="button"
              disabled={busy || rows.length < PAGE || (total !== null && page >= lastPage)}
              onClick={() => setPage((value) => value + 1)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Sonraki
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
