"use client";

// CNETMOBIL - Garantili: WingSM'de satılan cihazların ilan kaldırma talepleri (otomatik, dakikalık tarama)

import React, { useCallback, useEffect, useState } from "react";

type Row = Record<string, any>;

const STATUS: Record<string, { text: string; cls: string }> = {
  REQUESTED: { text: "Kaldırma istendi (onay bekleniyor)", cls: "bg-amber-50 text-amber-700" },
  LOCKED: { text: "Kilitli (iş saati bekleniyor)", cls: "bg-slate-100 text-slate-600" },
  FAILED: { text: "Hata", cls: "bg-rose-50 text-rose-700" },
  DONE: { text: "İlan kalktı", cls: "bg-emerald-50 text-emerald-700" },
};

export default function GarantiliClose() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/online/garantili/close-sweep", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setRows(Array.isArray(payload.rows) ? payload.rows : []);
    } catch (e: any) {
      setRows([]);
      setError(e?.message || "Liste alınamadı.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 rounded-xl border border-violet-100 bg-violet-50 p-3 text-[13px] font-semibold text-violet-900">
        Her dakika Garantili'de ilandaki cihazlar taranır; WingSM'de satılmış olanlar için <b>ilan kaldırma talebi</b> açılır. Garantili talebi personel onayıyla
        işler, yeni açılan ilanlarda iş saati dolana kadar beklenir. Onay gelince ilan kalkar ve durum "İlan kalktı" olur.
      </div>

      <div className="mb-3 flex items-center gap-3">
        <button type="button" onClick={() => void load()} disabled={busy} className="rounded-xl border border-slate-200 px-4 py-2 text-[13px] font-black text-slate-700 hover:bg-slate-50 disabled:opacity-40">
          {busy ? "Yükleniyor..." : "Yenile"}
        </button>
        <div className="text-[13px] font-bold text-slate-500">{rows.length} kayıt</div>
      </div>

      {error && <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] font-bold text-rose-700">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-slate-200 text-[12px] font-black uppercase text-slate-500">
              <th className="px-3 py-2">IMEI</th>
              <th className="px-3 py-2">Cihaz</th>
              <th className="px-3 py-2">Durum</th>
              <th className="px-3 py-2">Talep</th>
              <th className="px-3 py-2">Deneme</th>
              <th className="px-3 py-2">Not</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 && !busy && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-[13px] font-semibold text-slate-400">
                  Henüz kapatma kaydı yok.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const status = STATUS[row.status] ?? { text: row.status, cls: "bg-slate-100 text-slate-600" };

              return (
                <tr key={row.imei} className="text-[13px] text-slate-800">
                  <td className="whitespace-nowrap px-3 py-2 font-bold">{row.imei}</td>
                  <td className="px-3 py-2 font-semibold">{[row.brand, row.model, row.memory, row.color].filter(Boolean).join(" ") || "-"}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-3 py-1 text-[12px] font-black ${status.cls}`}>{status.text}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold">{row.requested_at ? new Date(row.requested_at).toLocaleString("tr-TR") : "-"}</td>
                  <td className="px-3 py-2 font-semibold">{row.attempts}</td>
                  <td className="px-3 py-2 text-[12px] font-semibold text-slate-500">{row.last_error || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
