"use client";

// CNETMOBIL - Hepsiburada otomatik stok düşürme paneli
// WingSM'de satış olunca Hepsiburada stoğu kadar düşer (1 satış = -1). Stok artırma yalnız elle (ürün satırından).

import React, { useCallback, useEffect, useState } from "react";

type Row = Record<string, any>;

export default function StockSyncPanel() {
  const [enabled, setEnabled] = useState(false);
  const [log, setLog] = useState<Row[]>([]);
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Otomatik stok düşürme</div>
          <div className="text-[12px] font-semibold text-slate-600">
            WingSM'de eşleşmiş ürün satılınca Hepsiburada stoğu 1 dakika içinde aynı adet kadar düşer. Stok artırma yalnızca elle (satırdan). Hepsiburada stoğu WingSM toplamını aşamaz.
          </div>
        </div>
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
          <input type="checkbox" checked={enabled} disabled={busy} onChange={(e) => void toggle(e.target.checked)} />
          {enabled ? <b className="text-emerald-600">AÇIK</b> : <b className="text-slate-400">kapalı</b>}
        </label>
        <button type="button" disabled={busy} onClick={() => void load()} className="h-8 rounded-lg bg-slate-100 px-3 text-[10px] font-black uppercase text-slate-600 disabled:opacity-50">
          Günlüğü yenile
        </button>
      </div>

      {message && <div className="mt-2 text-[11px] font-bold text-slate-600">{message}</div>}

      {log.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-slate-100">
          <table className="w-full text-left">
            <tbody className="divide-y divide-slate-100">
              {log.map((item, index) => (
                <tr key={index} className="text-[11px]">
                  <td className="whitespace-nowrap px-3 py-1.5 font-semibold text-slate-500">{new Date(item.created_at).toLocaleString("tr-TR")}</td>
                  <td className="px-3 py-1.5 font-bold text-slate-600">{item.mode === "AUTO" ? "otomatik" : "elle"}</td>
                  <td className="px-3 py-1.5 text-slate-600">
                    {item.error ? <span className="font-bold text-rose-600">HATA: {item.error}</span> : item.blocked ? <span className="font-bold text-amber-700">{item.blocked}</span> : item.detail || `${item.sent} ürün`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
