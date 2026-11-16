"use client";

// CNETMOBIL - Hepsiburada otomatik stok düşürme paneli
// WingSM'de satış olunca Hepsiburada stoğu kadar düşer (1 satış = -1). Stok artırma yalnız elle (ürün satırından).

import React, { useCallback, useEffect, useState } from "react";

type Row = Record<string, any>;

export default function StockSyncPanel() {
  const [enabled, setEnabled] = useState(false);
  const [log, setLog] = useState<Row[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/online/hepsiburada/stock-sync", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (payload?.success) {
        setEnabled(Boolean(payload.syncEnabled));
        setLog(Array.isArray(payload.log) ? payload.log : []);
      }
    } catch {
      // durum okunamazsa mevcut görünüm kalır
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (next: boolean) => {
    if (next && !window.confirm("Otomatik stok düşürme AÇILACAK: WingSM'de satış olunca Hepsiburada stoğu 1 dakika içinde kendiliğinden düşer. Başlangıç stokları şimdi kaydedilir; bundan önceki satışlar sayılmaz. Açılsın mı?")) return;

    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/online/hepsiburada/settings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncEnabled: next }),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setEnabled(Boolean(payload.syncEnabled));
      setMessage(next ? "Açıldı. İlk dakikada başlangıç stokları kaydedilir, sonraki satışlar düşer." : "Kapatıldı.");
      await load();
    } catch (e: any) {
      setMessage(e?.message || "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />
            </svg>
          </span>
          <div className="text-[17px] font-black text-slate-900">Otomatik stok düşürme</div>
        </div>
        <div className="hidden h-10 w-px bg-slate-200 md:block" />
        <div className="min-w-[260px] flex-1">
          <div className="text-[14px] font-semibold text-slate-700">WingSM satışı sonrası HB stoğu 1 dakika içinde güncellenir.</div>
          <div className="text-[13px] font-semibold text-slate-500">Stok artırma elle yapılır. HB stoğu WingSM stoğunu aşamaz.</div>
        </div>
        <label className="flex cursor-pointer items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={busy}
            onClick={() => void toggle(!enabled)}
            className={`relative h-7 w-12 rounded-full transition ${enabled ? "bg-emerald-500" : "bg-slate-300"} disabled:opacity-50`}
          >
            <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
          <span className={`text-[14px] font-black ${enabled ? "text-emerald-600" : "text-slate-500"}`}>{enabled ? "Açık" : "Kapalı"}</span>
        </label>
        <div className="hidden h-10 w-px bg-slate-200 md:block" />
        <button
          type="button"
          onClick={() => {
            setShowLog((v) => !v);
            void load();
          }}
          className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-[13px] font-black text-slate-800 hover:bg-slate-50"
        >
          İşlem günlüğü
        </button>
      </div>

      {message && <div className="mt-3 text-[13px] font-bold text-slate-600">{message}</div>}

      {showLog && (
        <div className="mt-4 max-h-56 overflow-y-auto rounded-xl border border-slate-100">
          {log.length === 0 ? (
            <div className="px-4 py-3 text-[13px] font-semibold text-slate-400">Henüz kayıt yok.</div>
          ) : (
            <table className="w-full text-left">
              <tbody className="divide-y divide-slate-100">
                {log.map((item, index) => (
                  <tr key={index} className="text-[12px]">
                    <td className="whitespace-nowrap px-4 py-2 font-semibold text-slate-500">{new Date(item.created_at).toLocaleString("tr-TR")}</td>
                    <td className="px-4 py-2 font-bold text-slate-600">{item.mode === "AUTO" ? "otomatik" : "elle"}</td>
                    <td className="px-4 py-2 text-slate-700">
                      {item.error ? <span className="font-bold text-rose-600">HATA: {item.error}</span> : item.blocked ? <span className="font-bold text-amber-700">{item.blocked}</span> : item.detail || `${item.sent} ürün`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
