"use client";

// CNETMOBIL - Garantili "BTK yenileme uygunluğu" IMEI sorgusu (tek IMEI, deneme)
// Alan adları henüz görülmedi: cevap olduğu gibi gösterilir (tek değerli alanlar tablo, geri kalanı ham JSON).

import React, { useState } from "react";

type Row = Record<string, any>;

const isScalar = (value: unknown) => value === null || ["string", "number", "boolean"].includes(typeof value);

export default function GarantiliImeiSorgu() {
  const [imei, setImei] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Row | null>(null);

  const clean = imei.replace(/\s+/g, "");

  const query = async () => {
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/online/garantili/imei-sorgu", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: clean }),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setResult(payload);
    } catch (e: any) {
      setError(e?.message || "Sorgu yapılamadı.");
    } finally {
      setBusy(false);
    }
  };

  const data = result?.data;
  const scalarEntries: Array<[string, any]> = data && typeof data === "object" && !Array.isArray(data) ? Object.entries(data).filter(([, value]) => isScalar(value)) : [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-[16px] font-black text-slate-900">BTK yenileme uygunluğu (IMEI)</div>
        <div className="mb-3 text-[13px] font-semibold text-slate-500">
          Garantili&apos;nin BTK yenileme kaydı sorgusu. Sadece sorgular, Garantili&apos;de hiçbir kayıt açmaz veya değiştirmez.
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={imei}
            onChange={(event) => setImei(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && clean.length === 15 && !busy) void query();
            }}
            inputMode="numeric"
            placeholder="15 haneli IMEI"
            className="h-11 w-full max-w-xs rounded-xl border border-slate-200 px-4 text-[14px] font-semibold text-slate-800 outline-none focus:border-violet-400"
          />
          <button
            type="button"
            disabled={busy || !/^\d{15}$/.test(clean)}
            onClick={() => void query()}
            className="rounded-xl bg-violet-600 px-6 py-2.5 text-[14px] font-black text-white hover:bg-violet-700 disabled:opacity-40"
          >
            {busy ? "Sorgulanıyor..." : "Sorgula"}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[13px] font-bold text-rose-700">{error}</div>}

      {result && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-[15px] font-black text-slate-900">{result.imei}</div>
            <span className={`rounded-full px-3 py-1 text-[12px] font-black ${result.garantiliBasarili ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
              Garantili cevabı: {result.garantiliBasarili ? "başarılı" : "başarısız"} (HTTP {result.status})
            </span>
          </div>
          {result.message && <div className="rounded-lg bg-slate-50 p-3 text-[13px] font-bold text-slate-700">Mesaj: {String(result.message)}</div>}

          {scalarEntries.length > 0 && (
            <table className="w-full max-w-xl text-left">
              <tbody className="divide-y divide-slate-100">
                {scalarEntries.map(([key, value]) => (
                  <tr key={key} className="text-[13px]">
                    <td className="py-1.5 pr-4 font-black text-slate-500">{key.replace(/_/g, " ")}</td>
                    <td className="py-1.5 font-semibold text-slate-800">{value === null ? "-" : String(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <details>
            <summary className="cursor-pointer text-[12px] font-black text-slate-500">Ham cevap</summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-slate-900 p-3 text-[12px] text-slate-100">{JSON.stringify(result.data ?? result.ham ?? null, null, 2)}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
