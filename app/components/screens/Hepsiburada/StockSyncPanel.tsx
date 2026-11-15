"use client";

// CNETMOBIL - Hepsiburada STOK SENKRONU paneli (YEREL, henüz yayında değil)
// Kullanmak için Hepsiburada.tsx içinde import edip Ürünler sekmesinde <StockSyncPanel /> render edin ve
// stock-sync / settings uçlarını (app/api/online/hepsiburada) ve stock-sync.ts'i birlikte yayınlayın.

import React, { useEffect, useState } from "react";

type Row = Record<string, any>;

// Stok senkronu: WingSM toplam stoğu (- güvenlik payı) -> Hepsiburada. Ayarlar, önizleme ve elle gönderme.
export default function StockSyncPanel() {
  const [buffer, setBuffer] = useState("0");
  const [enabled, setEnabled] = useState(false);
  const [plan, setPlan] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/online/hepsiburada/settings", { cache: "no-store", credentials: "same-origin" });
        const payload = await response.json().catch(() => null);

        if (payload?.success) {
          setBuffer(String(payload.buffer ?? 0));
          setEnabled(Boolean(payload.syncEnabled));
        }
      } catch {
        // ayarlar okunamazsa varsayılanlar kalır
      }
    })();
  }, []);

  const save = async (patch: Row) => {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/online/hepsiburada/settings", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setBuffer(String(payload.buffer));
      setEnabled(Boolean(payload.syncEnabled));
      setMessage("Ayar kaydedildi.");
    } catch (e: any) {
      setMessage(e?.message || "Kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const preview = async () => {
    setBusy(true);
    setMessage("");

    try {
      const response = await fetch("/api/online/hepsiburada/stock-sync", { cache: "no-store", credentials: "same-origin" });
      const payload = await response.json().catch(() => null);

      if (!payload?.success) throw new Error(payload?.error || `HTTP ${response.status}`);

      setPlan(payload);
    } catch (e: any) {
      setPlan(null);
      setMessage(e?.message || "Önizleme alınamadı.");
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    const changes = (plan?.items || []).filter((item: Row) => item.action === "CHANGE").length;

    if (!window.confirm(`${changes} ürünün stoğu Hepsiburada'ya GERÇEK olarak gönderilecek. Onaylıyor musunuz?`)) return;

    setBusy(true);

    try {
      const response = await fetch("/api/online/hepsiburada/stock-sync", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true, confirm: true }),
      });
      const payload = await response.json().catch(() => null);

      setMessage(payload?.success ? `${payload.sent} ürünün stoğu gönderildi.` : payload?.blocked || payload?.error || `HTTP ${response.status}`);
      await preview();
    } catch (e: any) {
      setMessage(e?.message || "Gönderilemedi.");
    } finally {
      setBusy(false);
    }
  };

  const items: Row[] = plan?.items || [];
  const changeCount = items.filter((item) => item.action === "CHANGE").length;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-wide text-slate-400">Stok senkronu</div>
          <div className="text-[12px] font-semibold text-slate-600">Hepsiburada stoğu = WingSM toplam stok − güvenlik payı. Fiyata dokunulmaz.</div>
        </div>
        <label className="text-[11px] font-bold text-slate-600">
          Güvenlik payı (adet)
          <div className="mt-1 flex items-center gap-2">
            <input value={buffer} onChange={(e) => setBuffer(e.target.value)} className="h-8 w-16 rounded-lg border border-slate-200 px-2 text-[12px]" />
            <button type="button" disabled={busy} onClick={() => void save({ buffer: Number(buffer) })} className="h-8 rounded-lg bg-slate-800 px-3 text-[10px] font-black uppercase text-white disabled:opacity-50">
              Kaydet
            </button>
          </div>
        </label>
        <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => {
              if (e.target.checked && !window.confirm("Otomatik stok gönderimi AÇILACAK: sistem her 4-5 dakikada bir stokları Hepsiburada'ya kendiliğinden gönderir. Önce önizlemeyi kontrol ettiniz mi?")) return;

              void save({ syncEnabled: e.target.checked });
            }}
          />
          Otomatik gönderim {enabled ? <b className="text-emerald-600">AÇIK</b> : <b className="text-slate-400">kapalı</b>}
        </label>
        <button type="button" disabled={busy} onClick={() => void preview()} className="h-8 rounded-lg bg-blue-600 px-4 text-[10px] font-black uppercase text-white disabled:opacity-50">
          {busy ? "..." : "Önizle"}
        </button>
      </div>

      {message && <div className="mb-2 text-[11px] font-bold text-slate-600">{message}</div>}

      {plan && (
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-600">
            <span>Eşleşmiş: {plan.matched}</span>
            <span>Eşleşmemiş: {plan.unmatched}</span>
            <span>Değişmeyecek: {plan.unchanged}</span>
            <span className="text-blue-700">Gönderilecek: {changeCount}</span>
            <span>WingSM verisi: {plan.wingDataAgeMinutes ?? "-"} dk önce</span>
          </div>
          {plan.blocked && <div className="mb-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{plan.blocked}</div>}
          {items.length > 0 && (
            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-100">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                    <th className="px-3 py-2">Ürün</th>
                    <th className="px-3 py-2 text-right">HB stok</th>
                    <th className="px-3 py-2 text-right">WingSM</th>
                    <th className="px-3 py-2 text-right">Yeni stok</th>
                    <th className="px-3 py-2">Not</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item) => (
                    <tr key={item.hepsiburadaSku} className={item.action === "CHANGE" ? "" : "opacity-60"}>
                      <td className="px-3 py-2 text-[11px] font-semibold text-slate-700">
                        {item.productName || item.malKod}
                        <span className="block font-mono text-[10px] text-slate-400">{item.hepsiburadaSku}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-[12px] font-bold">{item.current}</td>
                      <td className="px-3 py-2 text-right text-[12px] font-bold">{item.wing}</td>
                      <td className="px-3 py-2 text-right text-[12px] font-black text-blue-700">{item.target}</td>
                      <td className="px-3 py-2 text-[10px] font-bold text-amber-700">{item.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {changeCount > 0 && !plan.blocked && (
            <button type="button" disabled={busy} onClick={() => void apply()} className="mt-3 h-9 rounded-lg bg-emerald-600 px-4 text-[11px] font-black uppercase text-white disabled:opacity-50">
              {changeCount} ürünün stoğunu şimdi gönder
            </button>
          )}
        </div>
      )}
    </div>
  );
}
