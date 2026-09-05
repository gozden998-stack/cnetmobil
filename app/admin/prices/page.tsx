"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PriceRow = {
  rowNumber: number;
  brand: string;
  model: string;
  capacity: string;
  basePrice: number;
  minPrice: number;
  image: string;
  updatedAt?: string | null;
};

function money(value: number) {
  return new Intl.NumberFormat("tr-TR").format(Number(value || 0));
}

export default function AdminPricesPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("TÜMÜ");

  const [editing, setEditing] = useState<PriceRow | null>(null);
  const [basePrice, setBasePrice] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const loadPrices = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/admin/prices", {
        method: "GET",
        cache: "no-store",
      });

      const data = await res.json();

      if (res.status === 401) {
        router.replace("/");
        return;
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Fiyat listesi alınamadı.");
      }

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setCanEdit(Boolean(data.canEdit));
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Fiyat listesi alınamadı.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brands = useMemo(() => {
    return Array.from(
      new Set(rows.map((row) => row.brand).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "tr"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("tr-TR");

    return rows.filter((row) => {
      const brandOk =
        brandFilter === "TÜMÜ" || row.brand === brandFilter;

      if (!brandOk) return false;

      if (!q) return true;

      const text = `${row.brand} ${row.model} ${row.capacity}`
        .toLocaleLowerCase("tr-TR");

      return text.includes(q);
    });
  }, [rows, search, brandFilter]);

  const openEdit = (row: PriceRow) => {
    if (!canEdit) return;

    setMessage(null);
    setEditing(row);
    setBasePrice(String(row.basePrice || 0));
    setMinPrice(String(row.minPrice || 0));
  };

  const savePrice = async () => {
    if (!editing || !canEdit) return;

    const nextBase = Number(basePrice);
    const nextMin = Number(minPrice);

    if (
      !Number.isFinite(nextBase) ||
      !Number.isFinite(nextMin) ||
      nextBase < 0 ||
      nextMin < 0
    ) {
      setMessage({
        type: "error",
        text: "Geçerli fiyat girin.",
      });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/prices", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rowNumber: editing.rowNumber,
          basePrice: Math.round(nextBase),
          minPrice: Math.round(nextMin),
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Fiyat güncellenemedi.");
      }

      setRows((current) =>
        current.map((row) =>
          row.rowNumber === editing.rowNumber
            ? {
                ...row,
                basePrice: Math.round(nextBase),
                minPrice: Math.round(nextMin),
                updatedAt: new Date().toISOString(),
              }
            : row
        )
      );

      setMessage({
        type: "success",
        text: `${editing.brand} ${editing.model} ${editing.capacity} fiyatı güncellendi.`,
      });

      setEditing(null);
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error?.message || "Fiyat güncellenemedi.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fb] text-slate-900">
      <header className="sticky top-0 z-30 bg-[#172033] text-white shadow-lg">
        <div className="max-w-[1600px] mx-auto h-[70px] px-5 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/admin")}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center"
            >
              ←
            </button>

            <div>
              <div className="text-xl font-black">CNETMOBİL</div>
              <div className="text-[11px] text-slate-300">
                Super Admin • Cihaz Alım
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                window.open("/?view=normal", "_blank", "noopener,noreferrer")
              }
              className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-sm"
            >
              Normal Paneli Aç
            </button>

            <button
              onClick={loadPrices}
              disabled={loading}
              className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm disabled:opacity-50"
            >
              {loading ? "Yükleniyor..." : "Yenile"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-5 lg:p-8">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-5 mb-7">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">
              Ana cihaz listesi
            </div>
            <h1 className="mt-1 text-3xl lg:text-4xl font-black">
              Cihaz Alım
            </h1>
            <p className="mt-2 text-slate-500 max-w-3xl">
              Marka, model ve hafızaya göre baz fiyat ile minimum fiyatı
              yönetin. Kaydettiğiniz değişiklik Google Sheets, PostgreSQL ve
              işlem geçmişine birlikte yazılır.
            </p>
          </div>

          <div
            className={`rounded-full px-4 py-2 text-xs font-black border ${
              canEdit
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {canEdit ? "Fiyat değiştirme yetkisi açık" : "Sadece görüntüleme"}
          </div>
        </div>

        {message && (
          <div
            className={`mb-5 rounded-2xl border px-5 py-4 font-semibold ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-700"
            }`}
          >
            {message.text}
          </div>
        )}

        <section className="rounded-3xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 lg:p-6 border-b border-slate-100 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-black">
                Cihaz Fiyatları
              </div>
              <div className="text-sm text-slate-500 mt-1">
                {filteredRows.length} / {rows.length} kayıt
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Model veya hafıza ara..."
                className="h-11 w-full sm:w-[300px] rounded-xl border border-slate-200 px-4 outline-none focus:border-blue-500"
              />

              <select
                value={brandFilter}
                onChange={(e) => setBrandFilter(e.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-blue-500"
              >
                <option value="TÜMÜ">Tüm Markalar</option>
                {brands.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50">
                <tr className="text-left text-xs font-black uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4">Marka</th>
                  <th className="px-6 py-4">Model</th>
                  <th className="px-6 py-4">Hafıza</th>
                  <th className="px-6 py-4 text-right">Baz Fiyat</th>
                  <th className="px-6 py-4 text-right">Minimum Fiyat</th>
                  <th className="px-6 py-4 text-right">İşlem</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className="hover:bg-slate-50/70"
                  >
                    <td className="px-6 py-4 font-black">
                      {row.brand}
                    </td>
                    <td className="px-6 py-4 font-semibold">
                      {row.model}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {row.capacity}
                    </td>
                    <td className="px-6 py-4 text-right font-black tabular-nums">
                      {money(row.basePrice)} TL
                    </td>
                    <td className="px-6 py-4 text-right font-black tabular-nums text-slate-600">
                      {money(row.minPrice)} TL
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => openEdit(row)}
                        disabled={!canEdit}
                        className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black disabled:opacity-35 disabled:cursor-not-allowed"
                      >
                        Fiyatı Değiştir
                      </button>
                    </td>
                  </tr>
                ))}

                {!loading && filteredRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center text-slate-400 font-semibold"
                    >
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {editing && (
        <div className="fixed inset-0 z-50 bg-slate-950/55 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-lg rounded-[28px] bg-white shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-widest text-blue-600">
                  Fiyat Düzenle
                </div>
                <h2 className="mt-1 text-2xl font-black">
                  {editing.brand} {editing.model}
                </h2>
                <div className="mt-1 text-sm text-slate-500">
                  {editing.capacity}
                </div>
              </div>

              <button
                onClick={() => !saving && setEditing(null)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-xl"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-[11px] font-black uppercase text-slate-400">
                    Mevcut Baz
                  </div>
                  <div className="mt-1 text-xl font-black">
                    {money(editing.basePrice)} TL
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
                  <div className="text-[11px] font-black uppercase text-slate-400">
                    Mevcut Minimum
                  </div>
                  <div className="mt-1 text-xl font-black">
                    {money(editing.minPrice)} TL
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-black mb-2">
                  Yeni Baz Fiyat
                </label>
                <div className="relative">
                  <input
                    value={basePrice}
                    onChange={(e) =>
                      setBasePrice(e.target.value.replace(/[^\d]/g, ""))
                    }
                    inputMode="numeric"
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 outline-none focus:bg-white focus:border-blue-500 text-lg font-black"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    TL
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-black mb-2">
                  Yeni Minimum Fiyat
                </label>
                <div className="relative">
                  <input
                    value={minPrice}
                    onChange={(e) =>
                      setMinPrice(e.target.value.replace(/[^\d]/g, ""))
                    }
                    inputMode="numeric"
                    className="w-full h-12 rounded-xl border border-slate-200 bg-slate-50 px-4 pr-12 outline-none focus:bg-white focus:border-blue-500 text-lg font-black"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    TL
                  </span>
                </div>
              </div>

              <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
                Kaydettiğinizde değişiklik Google Sheets'e yazılır,
                PostgreSQL anında güncellenir ve eski/yeni değer işlem
                geçmişine kaydedilir.
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
              <button
                onClick={() => setEditing(null)}
                disabled={saving}
                className="h-11 px-5 rounded-xl border border-slate-200 font-black"
              >
                Vazgeç
              </button>

              <button
                onClick={savePrice}
                disabled={saving}
                className="h-11 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black disabled:opacity-50"
              >
                {saving ? "Kaydediliyor..." : "Fiyatı Kaydet"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
