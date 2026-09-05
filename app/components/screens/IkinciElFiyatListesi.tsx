"use client";

import React, { useMemo, useRef, useState } from "react";

export type IkinciElType = "apple" | "android";

type Props = {
  data: any[][];
  type: IkinciElType;
  canEdit?: boolean;
  onEdit?: () => void;
};

type PriceRow = {
  device: string;
  feature: string;
  price: unknown;
  description: string;
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

function AppleIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 384 512" className={`${className} fill-current`} aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-72.6-19.7-30.7.5-58.8 17.8-74.6 44.9-31.7 55.1-8.1 136.5 22.8 181.2 15.5 22.4 34.1 47.5 58.4 46.5 23.3-.9 32.1-15.2 60.1-15.2 28 0 35.9 15.2 60.6 14.7 25-.4 40.8-22.8 56.3-45.3 18-26.3 25.5-51.8 26-53.1-.6-.3-49.8-19-50-75.6zM294 102.7c12.9-15.3 21.5-36.6 19.2-57.7-18.6.8-41.1 12.4-54.2 27.7-11.8 13.6-22.1 35.3-19.3 55.9 20.7 1.6 41.4-10.5 54.3-25.9z" />
    </svg>
  );
}

function AndroidIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M7.7 7.1 6.4 4.9a.65.65 0 0 1 1.12-.66l1.36 2.3A8.9 8.9 0 0 1 12 6c1.12 0 2.18.2 3.15.55l1.35-2.3a.65.65 0 1 1 1.12.66l-1.28 2.18A6.1 6.1 0 0 1 19 12H5a6.1 6.1 0 0 1 2.7-4.9ZM8.25 9.2a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm7.5 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM5 13h14v5.8A2.2 2.2 0 0 1 16.8 21H7.2A2.2 2.2 0 0 1 5 18.8V13Z" />
    </svg>
  );
}

export default function IkinciElFiyatListesi({
  data,
  type,
  canEdit = false,
  onEdit,
}: Props) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const isApple = type === "apple";
  const indexes = isApple
    ? { device: 0, feature: 1, price: 2, description: 3 }
    : { device: 6, feature: 7, price: 8, description: 9 };

  const rows = useMemo<PriceRow[]>(() => {
    const source = Array.isArray(data) ? data.slice(1) : [];

    return source
      .filter((row) => String(row?.[indexes.device] ?? "").trim() !== "")
      .map((row) => {
        const device = String(row?.[indexes.device] ?? "").trim();
        const normalized = normalizeText(device);

        return {
          device,
          feature: String(row?.[indexes.feature] ?? "").trim(),
          price: row?.[indexes.price],
          description: String(row?.[indexes.description] ?? "").trim(),
          highlighted:
            normalized.includes("BOMBA") ||
            normalized.includes("KAMPANYA") ||
            normalized.includes("FIRSAT") ||
            normalized.includes("ÖZEL"),
        };
      });
  }, [data, indexes.device, indexes.feature, indexes.price, indexes.description]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);
    if (!query) return rows;

    return rows.filter((row) =>
      normalizeText(
        `${row.device} ${row.feature} ${row.price ?? ""} ${row.description}`
      ).includes(query)
    );
  }, [rows, search]);

  const highlightedCount = rows.filter((row) => row.highlighted).length;
  const visibleRows =
    showAll || search.trim() !== "" ? filteredRows : filteredRows.slice(0, 24);

  const accent = isApple ? {
    text: "text-blue-600",
    bg: "bg-blue-600",
    hover: "hover:bg-blue-700",
    light: "bg-blue-50",
    border: "border-blue-100",
    hero: "from-[#eff6ff] via-[#dbeafe] to-[#bfdbfe]",
    shadow: "shadow-[0_13px_30px_rgba(37,99,235,0.35)]",
  } : {
    text: "text-emerald-600",
    bg: "bg-emerald-600",
    hover: "hover:bg-emerald-700",
    light: "bg-emerald-50",
    border: "border-emerald-100",
    hero: "from-[#ecfdf5] via-[#d1fae5] to-[#a7f3d0]",
    shadow: "shadow-[0_13px_30px_rgba(5,150,105,0.35)]",
  };

  function clearSearch() {
    setSearch("");
    setShowAll(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div className="animate-in fade-in duration-300">
      <section className={`overflow-hidden rounded-[26px] border ${accent.border} bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]`}>
        <div className="grid min-h-[122px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className={`text-[8px] font-black uppercase tracking-[0.2em] ${accent.text}`}>
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              2. El {isApple ? "Apple" : "Android"} Fiyat Listesi
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Güncel ikinci el {isApple ? "Apple" : "Android"} cihaz fiyatlarını, özelliklerini ve açıklamalarını hızlıca görüntüleyin.
            </p>
          </div>

          <div className={`relative hidden overflow-hidden bg-gradient-to-r ${accent.hero} lg:block`}>
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[13%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm ${accent.text}`}>
                {isApple ? <AppleIcon /> : <AndroidIcon />}
              </div>
              <div className={`text-[10px] font-black leading-[1.5] ${accent.text}`}>
                İkinci El
                <br />
                Güncel Fiyat
                <br />
                Güvenli Liste
              </div>
            </div>

            <div className="absolute bottom-[-20px] right-[9%] h-[108px] w-[66px] rotate-[6deg] rounded-[15px] border-[6px] border-slate-800 bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700 shadow-2xl">
              <div className="mx-auto mt-1 h-1.5 w-6 rounded-full bg-slate-800" />
            </div>

            <div className={`absolute bottom-[16px] right-[27%] flex h-[58px] w-[58px] -rotate-[10deg] items-center justify-center rounded-2xl bg-white/80 shadow-xl ${accent.text}`}>
              {isApple ? <AppleIcon className="h-7 w-7" /> : <AndroidIcon className="h-7 w-7" />}
            </div>
          </div>
        </div>

        <div className={`grid gap-2 border-t ${accent.border} bg-slate-50/60 p-3 sm:grid-cols-3`}>
          <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accent.light} ${accent.text}`}>
              {isApple ? <AppleIcon className="h-5 w-5" /> : <AndroidIcon className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">Toplam Cihaz</p>
              <p className="text-[19px] font-black text-slate-950">{rows.length}</p>
              <p className="text-[8px] font-semibold text-slate-400">{isApple ? "Apple" : "Android"} cihaz</p>
            </div>
          </div>

          <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 15.4 7.2 18l.9-5.4-3.9-3.8 5.4-.8L12 3z" />
              </svg>
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">Öne Çıkan</p>
              <p className="text-[19px] font-black text-slate-950">{highlightedCount}</p>
              <p className="text-[8px] font-semibold text-slate-400">Kampanyalı / özel cihaz</p>
            </div>
          </div>

          <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${accent.light} ${accent.text}`}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">Liste Durumu</p>
              <p className="text-[15px] font-black text-slate-950">Güncel</p>
              <p className="text-[8px] font-semibold text-slate-400">2. El fiyat listesi</p>
            </div>
          </div>
        </div>
      </section>

      <section className="sticky top-[104px] z-30 mt-4 rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-[0_9px_26px_rgba(15,23,42,0.07)] backdrop-blur">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <div className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${accent.text}`}>
              <SearchIcon />
            </div>
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`${isApple ? "Apple" : "Android"} cihaz, özellik veya fiyat ara...`}
              className={`h-[49px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:bg-white focus:ring-4 ${
                isApple
                  ? "focus:border-blue-400 focus:ring-blue-50"
                  : "focus:border-emerald-400 focus:ring-emerald-50"
              }`}
            />
          </div>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className={`inline-flex h-[49px] min-w-[150px] items-center justify-center gap-2 rounded-2xl px-5 text-[10px] font-black text-white shadow-lg transition ${accent.bg} ${accent.hover}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.5-8.5a2.121 2.121 0 013 3L12 17l-4 1 1-4 9.5-9.5z" />
              </svg>
              DÜZENLE
            </button>
          )}

          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex h-[49px] min-w-[120px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black text-slate-500 transition hover:bg-slate-100"
          >
            Temizle
          </button>
        </div>
      </section>

      <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accent.light} ${accent.text}`}>
              {isApple ? <AppleIcon /> : <AndroidIcon />}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-black tracking-[-0.03em] text-slate-950">
                {isApple ? "Apple" : "Android"} Cihaz Listesi
              </h3>
              <p className="truncate text-[9px] font-semibold text-slate-400">
                Cihaz bilgisi, özellik/durum, fiyat ve açıklama
              </p>
            </div>
          </div>

          <span className={`shrink-0 rounded-full px-3 py-1.5 text-[8px] font-black ${accent.light} ${accent.text}`}>
            {filteredRows.length} Cihaz
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[930px]">
            <div className={`grid grid-cols-[48px_minmax(330px,1fr)_170px_150px_minmax(260px,1fr)] border-y border-slate-200 bg-slate-50/90 text-[8px] font-black uppercase tracking-[0.05em] text-slate-500`}>
              <div className="px-2 py-3 text-center">#</div>
              <div className="px-3 py-3">Cihaz Bilgisi</div>
              <div className="px-3 py-3 text-center">Özellik / Durum</div>
              <div className={`${accent.light} ${accent.text} px-3 py-3 text-right`}>Fiyatı (TL)</div>
              <div className="px-3 py-3 text-left">Açıklama</div>
            </div>

            {visibleRows.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center px-6 text-center">
                <div>
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <SearchIcon />
                  </div>
                  <p className="text-[11px] font-black text-slate-700">Cihaz bulunamadı</p>
                  <p className="mt-1 text-[9px] font-semibold text-slate-400">Arama kelimesini değiştirin.</p>
                </div>
              </div>
            ) : (
              visibleRows.map((row, index) => (
                <div
                  key={`${row.device}-${index}`}
                  className={`grid grid-cols-[48px_minmax(330px,1fr)_170px_150px_minmax(260px,1fr)] border-b border-slate-100 last:border-b-0 transition ${
                    row.highlighted
                      ? "bg-amber-50/80"
                      : index % 2 === 0
                      ? "bg-white"
                      : "bg-slate-50/35"
                  } hover:bg-slate-50`}
                >
                  <div className="flex items-center justify-center px-2 py-[10px] text-[9px] font-bold text-slate-400">
                    {index + 1}
                  </div>

                  <div className="flex min-w-0 items-center gap-2 px-3 py-[10px]">
                    {row.highlighted && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.13)]" />
                    )}
                    <span title={row.device} className={`truncate text-[10px] font-black ${row.highlighted ? "text-amber-700" : "text-slate-900"}`}>
                      {row.device}
                    </span>
                  </div>

                  <div className="flex items-center justify-center border-l border-slate-100 px-3 py-[10px] text-center text-[9px] font-bold text-slate-600">
                    {row.feature || "-"}
                  </div>

                  <div className={`flex items-center justify-end whitespace-nowrap border-l border-slate-100 px-3 py-[10px] text-[11px] font-black ${row.highlighted ? "text-amber-600" : accent.text}`}>
                    {String(row.price || "-")}
                  </div>

                  <div className="flex items-center border-l border-slate-100 px-3 py-[10px] text-[9px] font-semibold text-slate-500">
                    <span title={row.description} className="line-clamp-2">
                      {row.description || "-"}
                    </span>
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
            className={`inline-flex items-center gap-2 text-[9px] font-black ${accent.text}`}
          >
            {showAll ? "Listeyi Kısalt" : "Tüm Cihazları Gör"}
            <span className="text-[14px]">→</span>
          </button>

          <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[8px] font-black text-slate-500">
            {filteredRows.length} cihaz listeleniyor
          </span>
        </div>
      </section>

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
        className={`fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full text-white transition hover:scale-105 max-sm:right-5 ${accent.bg} ${accent.hover} ${accent.shadow}`}
      >
        <SearchIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
