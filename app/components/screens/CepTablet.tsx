"use client";

import React, { useMemo, useRef, useState } from "react";

type CepTabletProps = {
  data: any[][];
  canEdit?: boolean;
  onEdit?: () => void;
};

type PriceType = "all" | "campaign" | "sale" | "official";

type ProductRow = {
  side: "apple" | "android";
  name: string;
  brand: string;
  memory: string;
  campaign: unknown;
  sale: unknown;
  official: unknown;
  highlighted: boolean;
};

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
  const value = normalizeText(name);

  if (
    value.includes("APPLE") ||
    value.includes("IPHONE") ||
    value.includes("IPAD") ||
    value.includes("WATCH")
  ) return "Apple";

  if (value.includes("SAMSUNG")) return "Samsung";
  if (
    value.includes("XIAOMI") ||
    value.includes("REDMI") ||
    value.includes("POCO")
  ) return "Xiaomi";
  if (value.includes("OPPO")) return "Oppo";
  if (value.includes("VIVO")) return "Vivo";
  if (value.includes("REALME")) return "Realme";
  if (value.includes("TECNO")) return "Tecno";
  if (value.includes("INFINIX")) return "Infinix";

  return "Diğer";
}

function detectMemory(name: string) {
  const value = normalizeText(name);

  const tb = value.match(/(?:^|[^0-9])(1|2)\s*TB(?:$|[^0-9])/);
  if (tb) return `${tb[1]}TB`;

  // Örn: "256/8 GB", "128/4GB" -> cihaz hafızası ilk sayıdır.
  const ramCombo = value.match(
    /(?:^|[^0-9])(32|64|128|256|512)\s*\/\s*\d+\s*GB(?:$|[^0-9])/
  );
  if (ramCombo) return `${ramCombo[1]}GB`;

  const gb = value.match(
    /(?:^|[^0-9])(32|64|128|256|512)\s*GB(?:$|[^0-9])/
  );
  if (gb) return `${gb[1]}GB`;

  return "";
}

function isHighlightedProduct(name: string) {
  const value = normalizeText(name);
  return (
    value.includes("BOMBA") ||
    value.includes("KAMPANYA") ||
    value.includes("FIRSAT") ||
    value.includes("ÖZEL")
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 384 512" className="h-6 w-6 fill-current" aria-hidden="true">
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-72.6-19.7-30.7.5-58.8 17.8-74.6 44.9-31.7 55.1-8.1 136.5 22.8 181.2 15.5 22.4 34.1 47.5 58.4 46.5 23.3-.9 32.1-15.2 60.1-15.2 28 0 35.9 15.2 60.6 14.7 25-.4 40.8-22.8 56.3-45.3 18-26.3 25.5-51.8 26-53.1-.6-.3-49.8-19-50-75.6zM294 102.7c12.9-15.3 21.5-36.6 19.2-57.7-18.6.8-41.1 12.4-54.2 27.7-11.8 13.6-22.1 35.3-19.3 55.9 20.7 1.6 41.4-10.5 54.3-25.9z" />
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 9h10v8a2 2 0 01-2 2H9a2 2 0 01-2-2V9zm2-3L7.8 4M15 6l1.2-2M8 9V7.7A2.7 2.7 0 0110.7 5h2.6A2.7 2.7 0 0116 7.7V9M9.5 12h.01M14.5 12h.01M5 10v6M19 10v6M9 19v2M15 19v2"
      />
    </svg>
  );
}

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
        d="M21 21l-5-5m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
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
  const color =
    variant === "campaign"
      ? "text-rose-600"
      : variant === "sale"
      ? "text-slate-900"
      : "text-slate-500";

  return (
    <div
      className={[
        "flex items-center justify-end whitespace-nowrap px-3 py-[9px] text-[10px] font-black",
        color,
        active ? "bg-blue-50 ring-1 ring-inset ring-blue-100" : "",
      ].join(" ")}
    >
      {String(value || "-")}
    </div>
  );
}

function ProductPanel({
  title,
  subtitle,
  rows,
  total,
  type,
  showAll,
  onToggleShowAll,
  priceType,
}: {
  title: string;
  subtitle: string;
  rows: ProductRow[];
  total: number;
  type: "apple" | "android";
  showAll: boolean;
  onToggleShowAll: () => void;
  priceType: PriceType;
}) {
  const isApple = type === "apple";
  const visibleRows = showAll ? rows : rows.slice(0, 10);

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.055)]">
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={[
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
              isApple
                ? "bg-slate-100 text-slate-950"
                : "bg-emerald-50 text-emerald-600",
            ].join(" ")}
          >
            {isApple ? <AppleIcon /> : <AndroidIcon />}
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-[18px] font-black tracking-tight text-slate-950">
              {title}
            </h3>
            <p className="truncate text-[10px] font-semibold text-slate-400">
              {subtitle}
            </p>
          </div>
        </div>

        <span
          className={[
            "shrink-0 rounded-full px-3 py-1.5 text-[9px] font-black",
            isApple
              ? "bg-blue-50 text-blue-600"
              : "bg-emerald-50 text-emerald-600",
          ].join(" ")}
        >
          {rows.length} Ürün
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[650px]">
          <div className="grid grid-cols-[42px_minmax(250px,1fr)_82px_105px_96px_106px] border-y border-slate-200 bg-slate-50/80 text-[8px] font-black uppercase tracking-[0.04em] text-slate-500">
            <div className="px-2 py-3 text-center">#</div>
            <div className="px-3 py-3">Ürün Adı</div>
            <div className="px-2 py-3 text-center">Hafıza</div>
            <div className="bg-rose-50/80 px-3 py-3 text-right text-rose-500">
              Kampanya
            </div>
            <div className="px-3 py-3 text-right">Satış</div>
            <div className="px-3 py-3 text-right">Resmi Fiyat</div>
          </div>

          {visibleRows.length === 0 ? (
            <div className="flex min-h-[210px] items-center justify-center px-6 text-center">
              <div>
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                  <SearchIcon />
                </div>
                <p className="text-xs font-black text-slate-700">Ürün bulunamadı</p>
                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                  Arama veya filtreleri değiştirin.
                </p>
              </div>
            </div>
          ) : (
            visibleRows.map((row, index) => (
              <div
                key={`${row.side}-${row.name}-${index}`}
                className={[
                  "grid grid-cols-[42px_minmax(250px,1fr)_82px_105px_96px_106px] border-b border-slate-100 transition last:border-b-0 hover:bg-blue-50/45",
                  row.highlighted
                    ? "bg-amber-50/70"
                    : index % 2 === 0
                    ? "bg-white"
                    : "bg-slate-50/35",
                ].join(" ")}
              >
                <div className="flex items-center justify-center px-2 py-[9px] text-[9px] font-bold text-slate-400">
                  {index + 1}
                </div>

                <div className="flex min-w-0 items-center gap-2 px-3 py-[9px]">
                  {row.highlighted && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 shadow-[0_0_0_4px_rgba(251,191,36,0.14)]" />
                  )}
                  <span
                    title={row.name}
                    className={[
                      "truncate text-[10px] font-black tracking-[-0.01em]",
                      row.highlighted ? "text-amber-700" : "text-slate-800",
                    ].join(" ")}
                  >
                    {row.name}
                  </span>
                </div>

                <div className="flex items-center justify-center px-2 py-[9px] text-[9px] font-black text-slate-600">
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
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3.5">
        <button
          type="button"
          onClick={onToggleShowAll}
          className="inline-flex items-center gap-2 text-[10px] font-black text-blue-600 transition hover:text-blue-700"
        >
          {showAll ? "Listeyi Kısalt" : `Tüm ${title} Ürünlerini Gör`}
          <svg
            className={[
              "h-4 w-4 transition-transform",
              showAll ? "rotate-180" : "-rotate-90",
            ].join(" ")}
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

        <span
          className={[
            "rounded-full px-3 py-1.5 text-[9px] font-black",
            isApple
              ? "bg-blue-50 text-blue-500"
              : "bg-emerald-50 text-emerald-500",
          ].join(" ")}
        >
          {total} ürün listeleniyor
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
  const [brand, setBrand] =
    useState<(typeof BRAND_OPTIONS)[number]>("Tümü");
  const [memory, setMemory] =
    useState<(typeof MEMORY_OPTIONS)[number]>("Tümü");
  const [priceType, setPriceType] = useState<PriceType>("all");
  const [showAllApple, setShowAllApple] = useState(false);
  const [showAllAndroid, setShowAllAndroid] = useState(false);

  const products = useMemo<ProductRow[]>(() => {
    const rows = Array.isArray(data) ? data.slice(1) : [];

    const apple: ProductRow[] = rows
      .filter((row) => String(row?.[0] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[0] ?? "").trim();

        return {
          side: "apple",
          name,
          brand: "Apple",
          memory: detectMemory(name),
          campaign: row?.[1],
          sale: row?.[2],
          official: row?.[3],
          highlighted: isHighlightedProduct(name),
        };
      });

    const android: ProductRow[] = rows
      .filter((row) => String(row?.[5] ?? "").trim() !== "")
      .map((row) => {
        const name = String(row?.[5] ?? "").trim();

        return {
          side: "android",
          name,
          brand: detectBrand(name),
          memory: detectMemory(name),
          campaign: row?.[6],
          sale: row?.[7],
          official: row?.[8],
          highlighted: isHighlightedProduct(name),
        };
      });

    return [...apple, ...android];
  }, [data]);

  const filtered = useMemo(() => {
    const query = normalizeText(search);

    return products.filter((row) => {
      const searchable = normalizeText(
        `${row.name} ${row.brand} ${row.memory} ${row.campaign ?? ""} ${
          row.sale ?? ""
        } ${row.official ?? ""}`
      );

      const searchOk = query === "" || searchable.includes(query);
      const brandOk = brand === "Tümü" || row.brand === brand;
      const memoryOk = memory === "Tümü" || row.memory === memory;

      return searchOk && brandOk && memoryOk;
    });
  }, [products, search, brand, memory]);

  const appleAll = products.filter((row) => row.side === "apple");
  const androidAll = products.filter((row) => row.side === "android");

  const appleRows = filtered.filter((row) => row.side === "apple");
  const androidRows = filtered.filter((row) => row.side === "android");

  function clearFilters() {
    setSearch("");
    setBrand("Tümü");
    setMemory("Tümü");
    setPriceType("all");
    setShowAllApple(false);
    setShowAllAndroid(false);

    window.setTimeout(() => searchRef.current?.focus(), 0);
  }

  function focusSearch() {
    searchRef.current?.focus();
    searchRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  return (
    <div className="animate-in fade-in duration-500">
      {/* ÜST HERO */}
      <section className="overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-r from-white via-white to-[#eaf4ff] shadow-[0_10px_32px_rgba(15,23,42,0.055)]">
        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[1.35fr_1fr] lg:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 3h7a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2zm11 4h1a2 2 0 012 2v8a2 2 0 01-2 2h-1"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-blue-600">
                  CNETMOBİL V2
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[8px] font-black text-emerald-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  CANLI
                </span>
              </div>

              <h2 className="text-[26px] font-black tracking-[-0.04em] text-slate-950 sm:text-[30px]">
                Cep + Tablet Fiyat Merkezi
              </h2>

              <p className="mt-1 text-[11px] font-semibold text-slate-400">
                Güncel cep telefonu ve tablet fiyatlarını görüntüleyin, karşılaştırın ve yönetin.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3l8 4-8 4-8-4 8-4zm8 4v10l-8 4-8-4V7m8 4v10"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[7px] font-black uppercase tracking-wider text-slate-400">
                    Toplam Ürün
                  </p>
                  <p className="text-lg font-black text-slate-950">{products.length}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3M4 11h16M5 5h14a1 1 0 011 1v14H4V6a1 1 0 011-1z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[7px] font-black uppercase tracking-wider text-slate-400">
                    Son Güncelleme
                  </p>
                  <p className="text-[10px] font-black text-slate-950">Anlık</p>
                  <p className="text-[8px] font-semibold text-slate-400">Otomatik</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 19V9m5 10V5m5 14v-7m5 7V3"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-[7px] font-black uppercase tracking-wider text-slate-400">
                    Veri Kaynağı
                  </p>
                  <p className="text-[9px] font-black leading-tight text-slate-950">
                    Cnetmobil Fiyat Listesi
                  </p>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 px-4 py-3">
              <div className="absolute -bottom-7 -right-5 h-20 w-20 rounded-full bg-white/45" />
              <p className="relative text-[10px] font-black italic leading-tight text-blue-700">
                Doğru Stok
                <br />
                Güçlü Mağazalar
              </p>
              <div className="relative mt-2 h-[2px] w-14 rotate-[-5deg] rounded-full bg-blue-500" />
            </div>
          </div>
        </div>
      </section>

      {/* ARAMA + FİLTRE */}
      <section className="sticky top-[104px] z-30 mt-4 rounded-[22px] border border-slate-200 bg-white/95 p-3 shadow-[0_10px_30px_rgba(15,23,42,0.075)] backdrop-blur">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1">
            <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-blue-500">
              <SearchIcon />
            </div>
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Model, marka veya özellik ara..."
              className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[12px] font-bold text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
            />
          </div>

          <select
            value={brand}
            onChange={(event) =>
              setBrand(event.target.value as (typeof BRAND_OPTIONS)[number])
            }
            className="h-12 min-w-[165px] rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-black text-slate-700 outline-none focus:border-blue-400"
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
            className="h-12 min-w-[145px] rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-black text-slate-700 outline-none focus:border-blue-400"
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
            className="h-12 min-w-[155px] rounded-2xl border border-slate-200 bg-white px-4 text-[11px] font-black text-slate-700 outline-none focus:border-blue-400"
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
              className="inline-flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-[11px] font-black text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700"
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
            className="inline-flex h-12 min-w-[120px] items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-[11px] font-black text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
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
                className={[
                  "shrink-0 rounded-xl border px-4 py-2 text-[9px] font-black transition",
                  active
                    ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/15"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600",
                ].join(" ")}
              >
                {item}
              </button>
            );
          })}
        </div>
      </section>

      {/* İKİLİ LİSTE */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ProductPanel
          title="Apple"
          subtitle="iPhone, iPad ve Apple ürünleri"
          rows={appleRows}
          total={appleRows.length}
          type="apple"
          showAll={showAllApple || search.trim() !== ""}
          onToggleShowAll={() => setShowAllApple((value) => !value)}
          priceType={priceType}
        />

        <ProductPanel
          title="Android / Diğer"
          subtitle="Samsung, Xiaomi, Oppo, Realme, Tecno ve daha fazlası"
          rows={androidRows}
          total={androidRows.length}
          type="android"
          showAll={showAllAndroid || search.trim() !== ""}
          onToggleShowAll={() => setShowAllAndroid((value) => !value)}
          priceType={priceType}
        />
      </div>

      {/* ALT BİLGİ */}
      <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[9px] font-bold text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>Fiyatlar mevcut Cnetmobil fiyat listesinden görüntülenmektedir.</span>
        <span>
          Gösterilen: {filtered.length} / {products.length} ürün
        </span>
      </div>

      {/* AŞAĞIDA KALAN HIZLI ARAMA */}
      <button
        type="button"
        title="Hızlı Ara"
        onClick={focusSearch}
        className="fixed bottom-[88px] right-[74px] z-40 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_13px_30px_rgba(37,99,235,0.38)] transition hover:scale-105 hover:bg-blue-700 max-sm:right-5"
      >
        <SearchIcon className="h-6 w-6" />
      </button>
    </div>
  );
}
