"use client";

// app/components/screens/CihazTalep/VodafoneVitrin.tsx
//
// CNETMOBIL - Vodafone kanalı "Cihaz Talep" VİTRİNİ (sadece görüntüleme; talep açılmaz).
//
// Vodafone girişi CNET deposundaki, talebe hazır, grade'i MÜKEMMEL olan ve CNET yöneticisinin
// "Vodafone fiyatı" girdiği cihazları fiyatlarıyla görür. Süzme SUNUCUDA yapılır
// (/api/stock/devices Vodafone girişi için sadece bu cihazları ve sadece bu alanları döner);
// bu bileşen gelen listeyi sadece gösterir. Talep açma YOKTUR: Vodafone, müşterisi geldiğinde ofis ekibine haber verir;
// gönderim eskiden olduğu gibi elle yapılır.

import React, { useCallback, useEffect, useMemo, useState } from "react";

type VitrinDevice = {
  id: number;
  brand: string | null;
  model: string | null;
  memory: string | null;
  color: string | null;
  battery_percent: number | null;
  grade: string | null;
  warranty: string | null;
  changed_parts: string | null;
  box_invoice: string | null;
  vodafone_price: number;
};

function formatTl(value: number) {
  return `${Math.round(Number(value) || 0).toLocaleString("tr-TR")} TL`;
}

function deviceName(device: VitrinDevice) {
  const brand = String(device.brand ?? "").trim();
  const model = String(device.model ?? "").trim();

  // "Apple iPhone 15" gibi marka zaten model içinde geçiyorsa tekrar yazma.
  if (brand && model.toLocaleLowerCase("tr-TR").startsWith(brand.toLocaleLowerCase("tr-TR"))) {
    return model;
  }

  return [brand, model].filter(Boolean).join(" ") || "-";
}

export default function VodafoneVitrin() {
  const [devices, setDevices] = useState<VitrinDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("TÜMÜ");

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
      setError("");
    }

    try {
      const response = await fetch("/api/stock/devices", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      setDevices(Array.isArray(payload.devices) ? payload.devices : []);
    } catch (err) {
      if (!silent) {
        setDevices([]);
        setError(err instanceof Error ? err.message : "Cihaz listesi alınamadı.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();

    // Stok değişince sayfa yenilenmeden güncellensin: dakikada bir sessiz yenileme.
    const id = window.setInterval(() => void load(true), 60_000);

    return () => window.clearInterval(id);
  }, [load]);

  const brands = useMemo(
    () => ["TÜMÜ", ...Array.from(new Set(devices.map((device) => String(device.brand ?? "").trim()).filter(Boolean))).sort()],
    [devices]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("tr-TR");

    return devices
      .filter((device) => brandFilter === "TÜMÜ" || String(device.brand ?? "").trim() === brandFilter)
      .filter((device) =>
        query
          ? `${deviceName(device)} ${device.memory ?? ""} ${device.color ?? ""}`.toLocaleLowerCase("tr-TR").includes(query)
          : true
      )
      .sort((a, b) => deviceName(a).localeCompare(deviceName(b), "tr") || a.vodafone_price - b.vodafone_price);
  }, [devices, search, brandFilter]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.2em] text-red-500">CNET Depo · Vodafone kanalı</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#102A56] sm:text-3xl">Cihaz Talep</h1>
          <p className="mt-1 max-w-xl text-xs font-semibold text-slate-500">
            CNET deposundaki <span className="font-black text-emerald-600">MÜKEMMEL</span> grade cihazlar ve Vodafone fiyatları. Beğendiğiniz cihaz için, müşteriniz geldiğinde ofis ekibimize haber verin, cihazı gönderelim.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-right shadow-sm">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Listelenen cihaz</div>
          <div className="text-2xl font-black text-[#102A56]">{filtered.length}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Model, hafıza veya renk ara"
          className="h-11 min-w-[220px] flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 sm:max-w-sm"
        />
        {brands.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => setBrandFilter(brand)}
            className={`h-11 rounded-xl border px-4 text-[11px] font-black uppercase tracking-wide transition ${
              brandFilter === brand
                ? "border-red-500 bg-red-500 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {brand}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">{error}</div>
      )}

      {loading && <div className="mt-6 text-sm font-bold text-slate-400">Cihazlar yükleniyor...</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className="mt-5 flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <div className="text-lg font-black text-[#102A56]">Şu an listelenecek cihaz yok</div>
          <p className="mt-1 max-w-sm text-xs font-semibold text-slate-500">
            CNET deposuna MÜKEMMEL grade cihaz ve fiyatı girildiğinde burada görünecek.
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((device) => (
            <div
              key={device.id}
              className="flex flex-col rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{device.brand}</div>
                  <div className="mt-0.5 text-[15px] font-black leading-tight text-slate-900">{deviceName(device)}</div>
                </div>
                <span className="shrink-0 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-black tracking-wide text-emerald-700">
                  {String(device.grade ?? "-").toLocaleUpperCase("tr-TR")}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {device.memory && (
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">{device.memory}</span>
                )}
                {device.color && (
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">{device.color}</span>
                )}
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-700">
                  Pil {device.battery_percent === null ? "-" : `%${device.battery_percent}`}
                </span>
              </div>

              <dl className="mt-3 space-y-1.5 text-[11px]">
                <div className="flex justify-between gap-3">
                  <dt className="font-bold text-slate-400">Garanti</dt>
                  <dd className="text-right font-black text-slate-700">{device.warranty || "-"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-bold text-slate-400">Değişen parça</dt>
                  <dd className="text-right font-black text-slate-700">{device.changed_parts || "Yok"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="font-bold text-slate-400">Kutu / Fatura</dt>
                  <dd className="text-right font-black text-slate-700">{device.box_invoice || "-"}</dd>
                </div>
              </dl>

              <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vodafone fiyatı</span>
                <span className="text-[22px] font-black leading-none text-[#102A56]">{formatTl(device.vodafone_price)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
