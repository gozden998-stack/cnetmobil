"use client";

import React, { useMemo, useRef, useState } from "react";

type DisKanalProps = {
  data: any[][];
  selectedBranch: string;
  isZumay?: boolean;
  canEdit?: boolean;
  onEdit?: () => void;
};

type DisKanalRow = {
  name: string;
  price: unknown;
  vodafonePrice: unknown;
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

function ChannelIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 5h14v14H5V5zm3 3h8M8 12h5M8 16h8"
      />
    </svg>
  );
}

function StatCard({
  label,
  value,
  footer,
  tone = "teal",
  icon,
}: {
  label: string;
  value: React.ReactNode;
  footer: string;
  tone?: "teal" | "blue" | "amber" | "purple" | "red";
  icon: React.ReactNode;
}) {
  const toneMap = {
    teal: "bg-teal-50 text-teal-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    red: "bg-red-50 text-red-600",
  };

  return (
    <div className="flex min-h-[74px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-[0_3px_10px_rgba(15,23,42,0.07)]">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneMap[tone]}`}>
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[18px] font-black leading-none tracking-[-0.03em] text-slate-950">
          {value}
        </p>
        <p className="mt-1 truncate text-[8px] font-semibold text-slate-400">
          {footer}
        </p>
      </div>
    </div>
  );
}

export default function DisKanal({
  data,
  selectedBranch,
  isZumay = false,
  canEdit = false,
  onEdit,
}: DisKanalProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const isVodafone = selectedBranch === "VODAFONE KANALI";
  const accent = isZumay ? "red" : "teal";

  const rows = useMemo<DisKanalRow[]>(() => {
    const source = Array.isArray(data) ? data.slice(1) : [];

    return source
      .filter((row) => String(row?.[0] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[0] ?? "").trim();
        const normalized = normalizeText(name);

        return {
          name,
          price: row?.[1],
          vodafonePrice: row?.[2],
          highlighted:
            normalized.includes("BOMBA") ||
            normalized.includes("KAMPANYA") ||
            normalized.includes("FIRSAT") ||
            normalized.includes("ÖZEL"),
        };
      });
  }, [data]);

  const filteredRows = useMemo(() => {
    const query = normalizeText(search);

    if (!query) return rows;

    return rows.filter((row) =>
      normalizeText(
        `${row.name} ${row.price ?? ""} ${row.vodafonePrice ?? ""}`
      ).includes(query)
    );
  }, [rows, search]);

  const highlightedCount = rows.filter((row) => row.highlighted).length;
  const visibleRows = showAll || search.trim() !== "" ? filteredRows : filteredRows.slice(0, 22);

  const heroGradient = isZumay
    ? "from-[#fff1f2] via-[#ffe4e6] to-[#fecdd3]"
    : "from-[#ecfeff] via-[#ccfbf1] to-[#99f6e4]";

  const accentText = isZumay ? "text-red-600" : "text-teal-600";
  const accentBg = isZumay ? "bg-red-600" : "bg-teal-600";
  const accentHover = isZumay ? "hover:bg-red-700" : "hover:bg-teal-700";
  const accentLight = isZumay ? "bg-red-50" : "bg-teal-50";
  const accentBorder = isZumay ? "border-red-100" : "border-teal-100";

  function clearSearch() {
    setSearch("");
    setShowAll(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* ÜST HERO */}
      <section
        className={`overflow-hidden rounded-[26px] border ${accentBorder} bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]`}
      >
        <div className="grid min-h-[122px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className={`text-[8px] font-black uppercase tracking-[0.2em] ${accentText}`}>
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              Dış Kanal Satın Alma
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Dış kanal ürünlerini ve güncel satın alma fiyatlarını hızlıca görüntüleyin.
            </p>
          </div>

          <div className={`relative hidden overflow-hidden bg-gradient-to-r ${heroGradient} lg:block`}>
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[13%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 shadow-sm ${accentText}`}>
                <ChannelIcon />
              </div>

              <div className={`text-[10px] font-black leading-[1.5] ${accentText}`}>
                Güçlü Kanal
                <br />
                Güncel Fiyat
                <br />
                Hızlı Satın Alma
              </div>
            </div>

            <div className="absolute bottom-[-18px] right-[8%] h-[96px] w-[125px] rounded-[24px] border-[6px] border-slate-800 bg-white/70 shadow-2xl">
              <div className={`mx-auto mt-6 h-3 w-[70px] rounded-full ${isZumay ? "bg-red-400" : "bg-teal-400"}`} />
              <div className="mx-auto mt-3 h-3 w-[88px] rounded-full bg-slate-300" />
              <div className="mx-auto mt-3 h-3 w-[60px] rounded-full bg-slate-300" />
            </div>

            <div className="absolute bottom-[16px] right-[27%] flex h-[58px] w-[58px] rotate-[-10deg] items-center justify-center rounded-2xl bg-slate-900 text-white shadow-xl">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7h18M5 7l1 12h12l1-12M9 11v4m6-4v4M8 7l1-3h6l1 3"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className={`grid gap-2 border-t ${accentBorder} bg-slate-50/60 p-3 sm:grid-cols-2 xl:grid-cols-4`}>
          <StatCard
            label="Toplam Ürün"
            value={rows.length}
            footer="Dış kanal ürünleri"
            tone={accent}
            icon={<ChannelIcon className="h-5 w-5" />}
          />

          <StatCard
            label="Öne Çıkan"
            value={highlightedCount}
            footer="Bomba / kampanyalı ürün"
            tone="amber"
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
          />

          <StatCard
            label="Aktif Kanal"
            value={isVodafone ? "Vodafone" : "Genel"}
            footer={selectedBranch || "Tüm mağazalar"}
            tone={isVodafone ? "purple" : "blue"}
            icon={
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h10"
                />
              </svg>
            }
          />

          <StatCard
            label="Liste Durumu"
            value="Güncel"
            footer="Cnetmobil Dış Kanal"
            tone={accent}
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
          />
        </div>
      </section>

      {/* ARAMA */}
      <section className="sticky top-[104px] z-30 mt-4 rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-[0_9px_26px_rgba(15,23,42,0.07)] backdrop-blur">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1">
            <div className={`pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 ${accentText}`}>
              <SearchIcon />
            </div>

            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün / cihaz veya fiyat ara..."
              className={`h-[49px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 ${
                isZumay
                  ? "focus:border-red-400 focus:ring-red-50"
                  : "focus:border-teal-400 focus:ring-teal-50"
              } focus:bg-white focus:ring-4`}
            />
          </div>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className={`inline-flex h-[49px] min-w-[150px] items-center justify-center gap-2 rounded-2xl px-5 text-[10px] font-black text-white shadow-lg transition ${accentBg} ${accentHover}`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.5-8.5a2.121 2.121 0 013 3L12 17l-4 1 1-4 9.5-9.5z"
                />
              </svg>
              DÜZENLE
            </button>
          )}

          <button
            type="button"
            onClick={clearSearch}
            className="inline-flex h-[49px] min-w-[120px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[10px] font-black text-slate-500 transition hover:bg-slate-100"
          >
            Temizle
          </button>
        </div>
      </section>

      {/* TABLO */}
      <section className="mt-4 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentLight} ${accentText}`}>
              <ChannelIcon />
            </div>

            <div className="min-w-0">
              <h3 className="truncate text-[17px] font-black tracking-[-0.03em] text-slate-950">
                Dış Kanal Ürün Listesi
              </h3>
              <p className="truncate text-[9px] font-semibold text-slate-400">
                Güncel dış kanal satın alma fiyatları
              </p>
            </div>
          </div>

          <span className={`shrink-0 rounded-full px-3 py-1.5 text-[8px] font-black ${accentLight} ${accentText}`}>
            {filteredRows.length} Ürün
          </span>
        </div>

        <div className="overflow-x-auto">
          <div className={isVodafone ? "min-w-[760px]" : "min-w-[560px]"}>
            <div
              className={`grid ${
                isVodafone
                  ? "grid-cols-[48px_minmax(330px,1fr)_150px_170px]"
                  : "grid-cols-[48px_minmax(360px,1fr)_170px]"
              } border-y border-slate-200 bg-slate-50/90 text-[8px] font-black uppercase tracking-[0.05em] text-slate-500`}
            >
              <div className="px-2 py-3 text-center">#</div>
              <div className="px-3 py-3">Ürün / Cihaz Adı</div>
              <div className={`px-3 py-3 text-right ${accentLight} ${accentText}`}>
                Fiyatı (TL)
              </div>

              {isVodafone && (
                <div className="bg-purple-50 px-3 py-3 text-right text-purple-600">
                  Vodafone Satın Alma
                </div>
              )}
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
                  className={`grid ${
                    isVodafone
                      ? "grid-cols-[48px_minmax(330px,1fr)_150px_170px]"
                      : "grid-cols-[48px_minmax(360px,1fr)_170px]"
                  } border-b border-slate-100 last:border-b-0 transition ${
                    row.highlighted
                      ? isZumay
                        ? "bg-red-50/80"
                        : "bg-teal-50/80"
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
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          isZumay ? "bg-red-500" : "bg-teal-500"
                        } shadow-[0_0_0_4px_rgba(20,184,166,0.12)]`}
                      />
                    )}
                    <span
                      title={row.name}
                      className={`truncate text-[10px] font-black ${
                        row.highlighted ? accentText : "text-slate-900"
                      }`}
                    >
                      {row.name}
                    </span>
                  </div>

                  <div
                    className={`flex items-center justify-end whitespace-nowrap border-l border-slate-100 px-3 py-[10px] text-[11px] font-black ${
                      row.highlighted ? accentText : "text-slate-950"
                    }`}
                  >
                    {String(row.price || "-")}
                  </div>

                  {isVodafone && (
                    <div className="flex items-center justify-end whitespace-nowrap border-l border-purple-100 bg-purple-50/50 px-3 py-[10px] text-[11px] font-black text-purple-600">
                      {String(row.vodafonePrice || "-")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={() => setShowAll((value) => !value)}
            className={`inline-flex items-center gap-2 text-[9px] font-black ${accentText}`}
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
        className={`fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full text-white shadow-[0_13px_30px_rgba(15,118,110,0.35)] transition hover:scale-105 max-sm:right-5 ${accentBg} ${accentHover}`}
      >
        <SearchIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
