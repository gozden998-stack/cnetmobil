"use client";

import React, { useMemo, useRef, useState } from "react";

type KampanyaliSifirProps = {
  data: any[][];
};

type KampanyaRow = {
  name: string;
  price: unknown;
  highlighted: boolean;
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.1}
        d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function GiftIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M20 12v8H4v-8M2 8h20v4H2V8zm10 12V8m0 0H8.5A2.5 2.5 0 116 5.5C6 8 12 8 12 8zm0 0h3.5A2.5 2.5 0 1018 5.5C18 8 12 8 12 8z"
      />
    </svg>
  );
}

function TagIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 7h.01M3 11l8-8h6l4 4v6l-8 8L3 11z"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  footer,
  icon,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  footer: string;
  icon: React.ReactNode;
  tone: "red" | "amber" | "blue";
}) {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-red-600"
      : tone === "amber"
      ? "bg-amber-50 text-amber-600"
      : "bg-blue-50 text-blue-600";

  return (
    <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-[0_3px_10px_rgba(15,23,42,0.07)]">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[19px] font-black leading-none tracking-[-0.03em] text-slate-950">
          {value}
        </p>
        <p className="mt-1 truncate text-[8px] font-semibold text-slate-400">
          {footer}
        </p>
      </div>
    </div>
  );
}

export default function KampanyaliSifir({ data }: KampanyaliSifirProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo<KampanyaRow[]>(() => {
    const source = Array.isArray(data) ? data.slice(1) : [];

    return source
      .filter((row) => String(row?.[10] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[10] ?? "").trim();
        const normalized = normalizeText(name);

        return {
          name,
          price: row?.[11],
          highlighted:
            normalized.includes("BOMBA") ||
            normalized.includes("KAMPANYA") ||
            normalized.includes("İNDİRİM") ||
            normalized.includes("FIRSAT") ||
            normalized.includes("ÖZEL"),
        };
      });
  }, [data]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);

    if (!query) return rows;

    return rows.filter((row) =>
      normalizeText(`${row.name} ${row.price ?? ""}`).includes(query)
    );
  }, [rows, search]);

  const highlightedCount = rows.filter((row) => row.highlighted).length;
  const visibleRows =
    showAll || search.trim() !== "" ? filteredRows : filteredRows.slice(0, 22);

  function clearSearch() {
    setSearch("");
    setShowAll(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* HERO */}
      <section className="overflow-hidden rounded-[26px] border border-red-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]">
        <div className="grid min-h-[122px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className="text-[8px] font-black uppercase tracking-[0.2em] text-red-600">
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              Kampanyalı Sıfır Liste
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Sıfır cihaz kampanyalarını ve güncel kampanyalı fiyatları hızlıca görüntüleyin.
            </p>
          </div>

          <div className="relative hidden overflow-hidden bg-gradient-to-r from-[#fff4f4] via-[#ffe4e6] to-[#fecaca] lg:block">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[13%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-red-600 shadow-sm">
                <GiftIcon />
              </div>

              <div className="text-[10px] font-black leading-[1.5] text-red-700">
                Kampanyalı Fiyat
                <br />
                Sıfır Cihaz
                <br />
                Tek Ekranda
              </div>
            </div>

            <div className="absolute bottom-[-18px] right-[8%] flex h-[105px] w-[105px] rotate-[7deg] items-center justify-center rounded-[28px] border-[7px] border-[#7f1d1d] bg-gradient-to-br from-red-300 via-red-500 to-rose-600 shadow-2xl">
              <GiftIcon className="h-12 w-12 text-white/90" />
            </div>

            <div className="absolute bottom-[12px] right-[31%] flex h-[60px] w-[60px] -rotate-[12deg] items-center justify-center rounded-2xl bg-white/80 text-amber-500 shadow-xl">
              <TagIcon className="h-8 w-8" />
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-red-50 bg-[#fffafa] p-3 sm:grid-cols-3">
          <StatCard
            label="Toplam Kampanya"
            value={rows.length}
            footer="Sıfır cihaz listesi"
            icon={<GiftIcon className="h-5 w-5" />}
            tone="red"
          />

          <StatCard
            label="Öne Çıkan"
            value={highlightedCount}
            footer="Bomba / indirim / fırsat"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 18l.9-5.4-3.9-3.8 5.4-.8L12 3z"
                />
              </svg>
            }
            tone="amber"
          />

          <StatCard
            label="Liste Durumu"
            value="Güncel"
            footer="Cnetmobil Kampanyalı Liste"
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            }
            tone="blue"
          />
        </div>
      </section>

      {/* ARAMA */}
      <section className="sticky top-[104px] z-30 mt-4 rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-[0_9px_26px_rgba(15,23,42,0.07)] backdrop-blur">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-red-500">
              <SearchIcon />
            </div>

            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün, model veya fiyat ara..."
              className="h-[49px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-red-400 focus:bg-white focus:ring-4 focus:ring-red-50"
            />
          </div>

          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex h-[49px] min-w-[120px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black text-slate-500 transition hover:bg-slate-100"
          >
            Temizle
          </button>
        </div>
      </section>

      {/* LİSTE */}
      <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <GiftIcon />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-black tracking-[-0.03em] text-slate-950">
                Kampanyalı Sıfır Cihazlar
              </h3>
              <p className="truncate text-[9px] font-semibold text-slate-400">
                Güncel sıfır cihaz kampanya fiyatları
              </p>
            </div>
          </div>

          <span className="shrink-0 rounded-full bg-red-50 px-3 py-1.5 text-[8px] font-black text-red-600">
            {filteredRows.length} Ürün
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[48px_minmax(360px,1fr)_170px] border-y border-slate-200 bg-slate-50/90 text-[8px] font-black uppercase tracking-[0.05em] text-slate-500">
              <div className="px-2 py-3 text-center">#</div>
              <div className="px-3 py-3">Ürün Adı</div>
              <div className="bg-red-50 px-3 py-3 text-right text-red-600">
                Fiyatı (TL)
              </div>
            </div>

            {visibleRows.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <SearchIcon />
                  </div>
                  <p className="text-[11px] font-black text-slate-700">
                    Ürün bulunamadı
                  </p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-400">
                    Arama kelimesini değiştirerek tekrar deneyin.
                  </p>
                </div>
              </div>
            ) : (
              visibleRows.map((row, index) => (
                <div
                  key={`${row.name}-${index}`}
                  className={`grid grid-cols-[48px_minmax(360px,1fr)_170px] border-b border-slate-100 last:border-b-0 transition ${
                    row.highlighted
                      ? "bg-amber-50/80"
                      : index % 2 === 0
                      ? "bg-white"
                      : "bg-slate-50/35"
                  } hover:bg-red-50/35`}
                >
                  <div className="flex items-center justify-center px-2 py-[10px] text-[9px] font-bold text-slate-400">
                    {index + 1}
                  </div>

                  <div className="flex min-w-0 items-center gap-2 px-3 py-[10px]">
                    {row.highlighted && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.13)]" />
                    )}
                    <span
                      title={row.name}
                      className={`truncate text-[10px] font-black ${
                        row.highlighted ? "text-amber-700" : "text-slate-900"
                      }`}
                    >
                      {row.name}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-end whitespace-nowrap border-l border-slate-100 px-3 py-[10px] text-[11px] font-black ${
                      row.highlighted ? "text-amber-600" : "text-red-600"
                    }`}
                  >
                    {String(row.price || "-")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className="inline-flex items-center gap-2 text-[9px] font-black text-red-600 transition hover:text-red-700"
          >
            {showAll ? "Listeyi Kısalt" : "Tüm Ürünleri Gör"}
            <span className="text-[14px]">→</span>
          </button>

          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[8px] font-black text-slate-500">
            {filteredRows.length} ürün listeleniyor
          </span>
        </div>
      </section>

      {/* HIZLI ARA */}
      <button
        type="button"
        title="Hızlı Ara"
        onClick={() => {
          searchRef.current?.focus();
          searchRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }}
        className="fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-red-600 text-white shadow-[0_13px_30px_rgba(220,38,38,0.35)] transition hover:scale-105 hover:bg-red-700 max-sm:right-5"
      >
        <SearchIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
