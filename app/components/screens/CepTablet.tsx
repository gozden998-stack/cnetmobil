"use client";

import React, { useMemo, useRef, useState } from "react";

type CepTabletProps = {
  data: any[][];
  canEdit?: boolean;
  onEdit?: () => void;
};

type PriceType = "all" | "campaign" | "sale" | "official";

const BRAND_OPTIONS = [
  "Tümü",
  "Apple",
  "Samsung",
  "Xiaomi",
  "Oppo",
  "Vivo",
  "Realme",
  "Tecno",
  "Infinix",
  "Diğer",
] as const;

const MEMORY_OPTIONS = [
  "Tümü",
  "32GB",
  "64GB",
  "128GB",
  "256GB",
  "512GB",
  "1TB",
  "2TB",
] as const;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR")
    .replace(/\s+/g, " ");
}

function detectBrand(name: string) {
  const upper = normalizeText(name);

  if (
    upper.includes("APPLE") ||
    upper.includes("IPHONE") ||
    upper.includes("IPAD") ||
    upper.includes("MACBOOK")
  ) {
    return "Apple";
  }
  if (upper.includes("SAMSUNG")) return "Samsung";
  if (
    upper.includes("XIAOMI") ||
    upper.includes("REDMI") ||
    upper.includes("POCO")
  ) {
    return "Xiaomi";
  }
  if (upper.includes("OPPO")) return "Oppo";
  if (upper.includes("VIVO")) return "Vivo";
  if (upper.includes("REALME")) return "Realme";
  if (upper.includes("TECNO")) return "Tecno";
  if (upper.includes("INFINIX")) return "Infinix";

  return "Diğer";
}

function detectMemory(name: string) {
  const upper = normalizeText(name).replace(/\s+/g, "");
  const match = upper.match(/(?:^|[^0-9])((?:32|64|128|256|512)GB|(?:1|2)TB)(?:$|[^0-9])/);
  return match?.[1] || "";
}

function isCampaignRow(name: string) {
  const upper = normalizeText(name);
  return upper.includes("BOMBA") || upper.includes("KAMPANYA") || upper.includes("FIRSAT");
}

function PriceCell({
  value,
  variant,
  active,
}: {
  value: unknown;
  variant: "campaign" | "sale" | "official";
  active: boolean;
}) {
  const base =
    "whitespace-nowrap px-3 py-2.5 text-right text-[11px] font-black transition";

  const variantClass =
    variant === "campaign"
      ? "text-rose-600"
      : variant === "sale"
      ? "text-slate-900"
      : "text-slate-500";

  const activeClass = active
    ? "bg-blue-50 ring-1 ring-inset ring-blue-100"
    : "";

  return (
    <div className={`${base} ${variantClass} ${activeClass}`}>
      {String(value || "-")}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center px-6 text-center">
      <div>
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <p className="text-sm font-black text-slate-700">Sonuç bulunamadı</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">{text}</p>
      </div>
    </div>
  );
}

function ProductList({
  title,
  subtitle,
  badge,
  accent,
  rows,
  showAll,
  onToggleShowAll,
  priceType,
}: {
  title: string;
  subtitle: string;
  badge: string;
  accent: "apple" | "android";
  rows: Array<{
    name: string;
    memory: string;
    campaign: unknown;
    sale: unknown;
    official: unknown;
    highlighted: boolean;
  }>;
  showAll: boolean;
  onToggleShowAll: () => void;
  priceType: PriceType;
}) {
  const visibleRows = showAll ? rows : rows.slice(0, 14);
  const isApple = accent === "apple";

  return (
    <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
              isApple
                ? "bg-slate-100 text-slate-900"
                : "bg-emerald-50 text-emerald-600"
            }`}
          >
            {isApple ? (
              <span className="text-xl font-black">●</span>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 9h10v8a2 2 0 01-2 2H9a2 2 0 01-2-2V9zm2-3l-1.5-2M15 6l1.5-2M9 12v3M15 12v3"
                />
              </svg>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-lg font-black tracking-tight text-slate-900">
              {title}
            </h3>
            <p className="truncate text-[11px] font-semibold text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black ${
            isApple
              ? "bg-blue-50 text-blue-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {badge}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[650px]">
          <div className="grid grid-cols-[44px_minmax(245px,1fr)_88px_105px_100px_108px] border-b border-slate-200 bg-slate-50/80 text-[9px] font-black uppercase tracking-wider text-slate-500">
            <div className="px-3 py-3 text-center">#</div>
            <div className="px-3 py-3">Ürün Adı</div>
            <div className="px-3 py-3 text-center">Hafıza</div>
            <div className="bg-rose-50/60 px-3 py-3 text-right text-rose-500">
              Kampanya
            </div>
            <div className="px-3 py-3 text-right">Satış</div>
            <div className="px-3 py-3 text-right">Resmi Fiyat</div>
          </div>

          {visibleRows.length === 0 ? (
            <EmptyState text="Arama veya filtreleri değiştirerek tekrar deneyin." />
          ) : (
            <div>
              {visibleRows.map((row, index) => (
                <div
                  key={`${row.name}-${index}`}
                  className={`grid grid-cols-[44px_minmax(245px,1fr)_88px_105px_100px_108px] items-stretch border-b border-slate-100 last:border-b-0 hover:bg-blue-50/40 ${
                    row.highlighted ? "bg-amber-50/60" : "bg-white"
                  }`}
                >
                  <div className="flex items-center justify-center px-2 py-2.5 text-[10px] font-bold text-slate-400">
                    {index + 1}
                  </div>

                  <div className="flex min-w-0 items-center gap-2 px-3 py-2.5">
                    {row.highlighted && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.12)]" />
                    )}
                    <span
                      className={`truncate text-[11px] font-black ${
                        row.highlighted ? "text-amber-700" : "text-slate-800"
                      }`}
                      title={row.name}
                    >
                      {row.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-center px-3 py-2.5 text-[10px] font-black text-slate-600">
                    {row.memory || "-"}
                  </div>

                  <PriceCell
                    value={row.campaign}
                    variant="campaign"
                    active={priceType === "campaign"}
                  />
                  <PriceCell
                    value={row.sale}
                    variant="sale"
                    active={priceType === "sale"}
                  />
                  <PriceCell
                    value={row.official}
                    variant="official"
                    active={priceType === "official"}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
        <button
          type="button"
          onClick={onToggleShowAll}
          className="inline-flex items-center gap-2 text-[10px] font-black text-blue-600 transition hover:text-blue-700"
        >
          {showAll ? "Listeyi Kısalt" : `Tüm ${title} Ürünlerini Gör`}
          <svg
            className={`h-4 w-4 transition ${showAll ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[9px] font-black text-slate-500">
          {rows.length} ürün listeleniyor
        </span>
      </div>
    </section>
  );
}

export default function CepTablet({
  data,
  canEdit = false,
  onEdit,
}: CepTabletProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);

  const [search, setSearch] = useState("");
  const [brand, setBrand] = useState<(typeof BRAND_OPTIONS)[number]>("Tümü");
  const [memory, setMemory] = useState<(typeof MEMORY_OPTIONS)[number]>("Tümü");
  const [priceType, setPriceType] = useState<PriceType>("all");
  const [showAllApple, setShowAllApple] = useState(false);
  const [showAllAndroid, setShowAllAndroid] = useState(false);

  const allRows = useMemo(() => {
    const source = Array.isArray(data) ? data.slice(1) : [];

    const appleRows = source
      .filter((row) => String(row?.[0] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[0] ?? "").trim();
        return {
          side: "apple" as const,
          name,
          brand: "Apple",
          memory: detectMemory(name),
          campaign: row?.[1],
          sale: row?.[2],
          official: row?.[3],
          highlighted: isCampaignRow(name),
        };
      });

    const androidRows = source
      .filter((row) => String(row?.[5] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[5] ?? "").trim();
        return {
          side: "android" as const,
          name,
          brand: detectBrand(name),
          memory: detectMemory(name),
          campaign: row?.[6],
          sale: row?.[7],
          official: row?.[8],
          highlighted: isCampaignRow(name),
        };
      });

    return [...appleRows, ...androidRows];
  }, [data]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);

    return allRows.filter((row) => {
      const matchesSearch =
        q === "" ||
        normalizeText(
          `${row.name} ${row.brand} ${row.memory} ${row.campaign ?? ""} ${
            row.sale ?? ""
          } ${row.official ?? ""}`
        ).includes(q);

      const matchesBrand = brand === "Tümü" || row.brand === brand;
      const matchesMemory = memory === "Tümü" || row.memory === memory;

      return matchesSearch && matchesBrand && matchesMemory;
    });
  }, [allRows, search, brand, memory]);

  const appleRows = filteredRows.filter((row) => row.side === "apple");
  const androidRows = filteredRows.filter((row) => row.side === "android");

  const appleTotal = allRows.filter((row) => row.side === "apple").length;
  const androidTotal = allRows.filter((row) => row.side === "android").length;

  function clearFilters() {
    setSearch("");
    setBrand("Tümü");
    setMemory("Tümü");
    setPriceType("all");
    setShowAllApple(false);
    setShowAllAndroid(false);
    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="overflow-hidden rounded-[30px] border border-blue-100 bg-gradient-to-r from-white via-white to-blue-50 shadow-[0_12px_35px_rgba(15,23,42,0.06)]">
        <div className="grid gap-5 px-5 py-5 sm:px-7 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 3h7a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2zm10 4h2a2 2 0 012 2v8a2 2 0 01-2 2h-2"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                  CNETMOBİL V2
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-black text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  CANLI
                </span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Cep + Tablet Fiyat Merkezi
              </h2>
              <p className="mt-1 text-xs font-semibold text-slate-400">
                Güncel cep telefonu ve tablet fiyatlarını hızlıca bulun.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-100 bg-white/90 p-3">
              <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                Toplam Ürün
              </p>
              <p className="mt-1 text-xl font-black text-slate-900">
                {allRows.length}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white/90 p-3">
              <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                Apple
              </p>
              <p className="mt-1 text-xl font-black text-slate-900">
                {appleTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white/90 p-3">
              <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                Android / Diğer
              </p>
              <p className="mt-1 text-xl font-black text-slate-900">
                {androidTotal}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-600 p-3 text-white">
              <p className="text-[8px] font-black uppercase tracking-wider text-blue-100">
                Veri Kaynağı
              </p>
              <p className="mt-1 text-[11px] font-black leading-tight">
                Cnetmobil Fiyat Listesi
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="sticky top-[104px] z-30 mt-4 rounded-[24px] border border-slate-200 bg-white/95 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <svg
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Model, marka, hafıza veya fiyat ara..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <select
            value={brand}
            onChange={(event) =>
              setBrand(event.target.value as (typeof BRAND_OPTIONS)[number])
            }
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 outline-none focus:border-blue-400"
          >
            {BRAND_OPTIONS.map((item) => (
              <option key={item} value={item}>
                Marka: {item}
              </option>
            ))}
          </select>

          <select
            value={memory}
            onChange={(event) =>
              setMemory(event.target.value as (typeof MEMORY_OPTIONS)[number])
            }
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 outline-none focus:border-blue-400"
          >
            {MEMORY_OPTIONS.map((item) => (
              <option key={item} value={item}>
                Hafıza: {item}
              </option>
            ))}
          </select>

          <select
            value={priceType}
            onChange={(event) => setPriceType(event.target.value as PriceType)}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 outline-none focus:border-blue-400"
          >
            <option value="all">Fiyat Tipi: Tümü</option>
            <option value="campaign">Kampanya</option>
            <option value="sale">Satış</option>
            <option value="official">Resmi Fiyat</option>
          </select>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-xs font-black text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 active:scale-[0.99]"
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
            onClick={clearFilters}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-5 text-xs font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h5M20 20v-5h-5M5.5 18.5A8 8 0 0118 6M18.5 5.5A8 8 0 006 18"
              />
            </svg>
            Temizle
          </button>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {BRAND_OPTIONS.map((item) => {
            const active = brand === item;
            return (
              <button
                type="button"
                key={item}
                onClick={() => setBrand(item)}
                className={`shrink-0 rounded-xl border px-4 py-2 text-[10px] font-black transition ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/15"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600"
                }`}
              >
                {item}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProductList
          title="Apple"
          subtitle="iPhone, iPad ve Apple ürünleri"
          badge={`${appleRows.length} Ürün`}
          accent="apple"
          rows={appleRows}
          showAll={showAllApple || search.trim() !== ""}
          onToggleShowAll={() => setShowAllApple((value) => !value)}
          priceType={priceType}
        />

        <ProductList
          title="Android / Diğer"
          subtitle="Samsung, Xiaomi, Oppo, Realme, Tecno ve daha fazlası"
          badge={`${androidRows.length} Ürün`}
          accent="android"
          rows={androidRows}
          showAll={showAllAndroid || search.trim() !== ""}
          onToggleShowAll={() => setShowAllAndroid((value) => !value)}
          priceType={priceType}
        />
      </div>

      <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-[10px] font-bold text-blue-700 sm:flex-row sm:items-center sm:justify-between">
        <span>Fiyat listesi mevcut veri kaynağından otomatik görüntülenir.</span>
        <span>
          Sonuç: {filteredRows.length} / {allRows.length} ürün
        </span>
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
        className="fixed bottom-24 right-5 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_12px_30px_rgba(37,99,235,0.35)] transition hover:scale-105 hover:bg-blue-700 sm:h-14 sm:w-14"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.2}
            d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </button>
    </div>
  );
}
