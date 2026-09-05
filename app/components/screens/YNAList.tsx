"use client";

import React, { useMemo, useRef, useState } from "react";

type YNAListProps = {
  data: any[][];
  canEdit?: boolean;
  onEdit?: () => void;
};

type YNARow = {
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
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.1}
        d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function HeadphoneIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 14v-2a8 8 0 0116 0v2M4 14h3v6H5a1 1 0 01-1-1v-5zm16 0h-3v6h2a1 1 0 001-1v-5z"
      />
    </svg>
  );
}

function WatchIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 3h6l1 4H8l1-4zm-1 4h8a2 2 0 012 2v6a2 2 0 01-2 2H8a2 2 0 01-2-2V9a2 2 0 012-2zm1 10h6l-1 4h-4l-1-4z"
      />
    </svg>
  );
}

function SparkIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3zm6 10l.9 2.1L21 16l-2.1.9L18 19l-.9-2.1L15 16l2.1-.9L18 13z"
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
  tone: "purple" | "blue" | "amber";
}) {
  const toneClass =
    tone === "purple"
      ? "bg-purple-50 text-purple-600"
      : tone === "blue"
      ? "bg-blue-50 text-blue-600"
      : "bg-amber-50 text-amber-600";

  return (
    <div className="flex min-h-[72px] items-center gap-3 rounded-[18px] border border-slate-200 bg-white px-4 py-3 shadow-[0_3px_10px_rgba(15,23,42,0.07)]">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClass}`}>
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-[20px] font-black leading-none tracking-[-0.03em] text-slate-950">
          {value}
        </p>
        <p className="mt-1 truncate text-[8px] font-semibold text-slate-400">
          {footer}
        </p>
      </div>
    </div>
  );
}

function ProductList({
  title,
  subtitle,
  rows,
  side,
  showAll,
  onToggleShowAll,
}: {
  title: string;
  subtitle: string;
  rows: YNARow[];
  side: "left" | "right";
  showAll: boolean;
  onToggleShowAll: () => void;
}) {
  const visibleRows = showAll ? rows : rows.slice(0, 18);
  const isLeft = side === "left";

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isLeft
                ? "bg-purple-50 text-purple-600"
                : "bg-fuchsia-50 text-fuchsia-600"
            }`}
          >
            {isLeft ? <WatchIcon /> : <HeadphoneIcon />}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-[17px] font-black tracking-[-0.03em] text-slate-950">
              {title}
            </h3>
            <p className="truncate text-[9px] font-semibold text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-[8px] font-black ${
            isLeft
              ? "bg-purple-50 text-purple-600"
              : "bg-fuchsia-50 text-fuchsia-600"
          }`}
        >
          {rows.length} Ürün
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[430px]">
          <div className="grid grid-cols-[42px_minmax(250px,1fr)_120px] border-y border-slate-200 bg-slate-50/90 text-[8px] font-black uppercase tracking-[0.05em] text-slate-500">
            <div className="px-2 py-3 text-center">#</div>
            <div className="px-3 py-3">Ürün Adı</div>
            <div className="bg-purple-50/70 px-3 py-3 text-right text-purple-600">
              Fiyatı (TL)
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="flex min-h-[190px] items-center justify-center px-6 text-center">
              <div>
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <SearchIcon className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-black text-slate-700">
                  Ürün bulunamadı
                </p>
                <p className="mt-1 text-[8px] font-semibold text-slate-400">
                  Arama kelimesini değiştirin.
                </p>
              </div>
            </div>
          ) : (
            visibleRows.map((row, index) => (
              <div
                key={`${side}-${row.name}-${index}`}
                className={`grid grid-cols-[42px_minmax(250px,1fr)_120px] border-b border-slate-100 last:border-b-0 transition hover:bg-purple-50/45 ${
                  row.highlighted
                    ? "bg-amber-50/75"
                    : index % 2 === 0
                    ? "bg-white"
                    : "bg-slate-50/35"
                }`}
              >
                <div className="flex items-center justify-center px-2 py-[9px] text-[8px] font-bold text-slate-400">
                  {index + 1}
                </div>

                <div className="flex min-w-0 items-center gap-2 px-3 py-[9px]">
                  {row.highlighted && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.14)]" />
                  )}
                  <span
                    title={row.name}
                    className={`truncate text-[9px] font-black ${
                      row.highlighted ? "text-amber-700" : "text-slate-900"
                    }`}
                  >
                    {row.name}
                  </span>
                </div>

                <div
                  className={`flex items-center justify-end whitespace-nowrap border-l border-slate-100 px-3 py-[9px] text-[10px] font-black ${
                    row.highlighted ? "text-amber-600" : "text-purple-700"
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
          onClick={onToggleShowAll}
          className="inline-flex items-center gap-2 text-[9px] font-black text-purple-600 transition hover:text-purple-700"
        >
          {showAll ? "Listeyi Kısalt" : "Tüm Ürünleri Gör"}
          <span className="text-[14px]">→</span>
        </button>

        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[8px] font-black text-slate-500">
          {rows.length} ürün listeleniyor
        </span>
      </div>
    </section>
  );
}

export default function YNAList({
  data,
  canEdit = false,
  onEdit,
}: YNAListProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [showAllLeft, setShowAllLeft] = useState(false);
  const [showAllRight, setShowAllRight] = useState(false);

  const lists = useMemo(() => {
    const source = Array.isArray(data) ? data.slice(1) : [];

    const left: YNARow[] = source
      .filter((row) => String(row?.[0] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[0] ?? "").trim();
        return {
          name,
          price: row?.[1],
          highlighted: normalizeText(name).includes("BOMBA"),
        };
      });

    const right: YNARow[] = source
      .filter((row) => String(row?.[3] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[3] ?? "").trim();
        return {
          name,
          price: row?.[4],
          highlighted: normalizeText(name).includes("BOMBA"),
        };
      });

    return { left, right };
  }, [data]);

  const filtered = useMemo(() => {
    const query = normalizeText(search);

    const filterRows = (rows: YNARow[]) =>
      rows.filter((row) => {
        if (!query) return true;
        return normalizeText(`${row.name} ${row.price ?? ""}`).includes(query);
      });

    return {
      left: filterRows(lists.left),
      right: filterRows(lists.right),
    };
  }, [lists, search]);

  const totalProducts = lists.left.length + lists.right.length;
  const totalHighlighted = [...lists.left, ...lists.right].filter(
    (row) => row.highlighted
  ).length;

  function clearSearch() {
    setSearch("");
    setShowAllLeft(false);
    setShowAllRight(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div className="animate-in fade-in duration-300">
      {/* HERO */}
      <section className="overflow-hidden rounded-[26px] border border-purple-100 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.055)]">
        <div className="grid min-h-[122px] lg:grid-cols-[1.25fr_0.75fr]">
          <div className="flex flex-col justify-center px-7 py-5 sm:px-8">
            <div className="text-[8px] font-black uppercase tracking-[0.20em] text-purple-600">
              CNETMOBİL V2
            </div>

            <h2 className="mt-2 text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              YNA Fiyat Listesi
            </h2>

            <p className="mt-2 text-[10px] font-semibold text-slate-400">
              Watch, kulaklık ve yeni nesil aksesuar fiyatlarını hızlıca görüntüleyin.
            </p>
          </div>

          <div className="relative hidden overflow-hidden bg-gradient-to-r from-[#f7f1ff] via-[#eee1ff] to-[#ddc2ff] lg:block">
            <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[14%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-purple-600 shadow-sm">
                <SparkIcon />
              </div>
              <div className="text-[10px] font-black leading-[1.5] text-purple-700">
                Yeni Nesil
                <br />
                Aksesuarlar
                <br />
                Tek Ekranda
              </div>
            </div>

            <div className="absolute bottom-[-18px] right-[10%] flex h-[105px] w-[105px] items-center justify-center rounded-[28px] border-[8px] border-[#39205e] bg-gradient-to-br from-violet-300 via-purple-500 to-fuchsia-500 shadow-2xl">
              <WatchIcon className="h-12 w-12 text-white/90" />
            </div>

            <div className="absolute bottom-[10px] right-[31%] flex h-[62px] w-[62px] rotate-[-12deg] items-center justify-center rounded-full border-[6px] border-[#39205e] bg-white/65 shadow-xl">
              <HeadphoneIcon className="h-8 w-8 text-purple-700" />
            </div>
          </div>
        </div>

        <div className="grid gap-2 border-t border-purple-50 bg-[#fbf9ff] p-3 sm:grid-cols-3">
          <StatCard
            label="Toplam Ürün"
            value={totalProducts}
            footer="YNA ürünleri"
            icon={<SparkIcon className="h-5 w-5" />}
            tone="purple"
          />

          <StatCard
            label="Öne Çıkan"
            value={totalHighlighted}
            footer="Bomba / özel ürün"
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
            footer="Cnetmobil YNA List"
            icon={
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-purple-500">
              <SearchIcon />
            </div>

            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün, model veya fiyat ara..."
              className="h-[49px] w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[11px] font-bold text-slate-800 outline-none placeholder:text-slate-400 focus:border-purple-400 focus:bg-white focus:ring-4 focus:ring-purple-50"
            />
          </div>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-[49px] min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-purple-600 px-5 text-[10px] font-black text-white shadow-lg shadow-purple-600/20 transition hover:bg-purple-700"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
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

      {/* İKİ LİSTE */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProductList
          title="YNA Liste 1"
          subtitle="Yeni nesil aksesuar ürünleri"
          rows={filtered.left}
          side="left"
          showAll={showAllLeft || search.trim() !== ""}
          onToggleShowAll={() => setShowAllLeft((value) => !value)}
        />

        <ProductList
          title="YNA Liste 2"
          subtitle="Watch, kulaklık ve diğer aksesuarlar"
          rows={filtered.right}
          side="right"
          showAll={showAllRight || search.trim() !== ""}
          onToggleShowAll={() => setShowAllRight((value) => !value)}
        />
      </div>

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
        className="fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-purple-600 text-white shadow-[0_13px_30px_rgba(147,51,234,0.35)] transition hover:scale-105 hover:bg-purple-700 max-sm:right-5"
      >
        <SearchIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
