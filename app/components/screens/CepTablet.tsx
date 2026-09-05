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


function BrandLogo({ brand }: { brand: (typeof BRAND_OPTIONS)[number] }) {
  if (brand === "Tümü" || brand === "Diğer") {
    return (
      <span className="grid h-5 w-5 grid-cols-2 gap-[2px] rounded-md bg-blue-50 p-[4px] text-blue-600">
        <span className="rounded-[1px] bg-current" />
        <span className="rounded-[1px] bg-current" />
        <span className="rounded-[1px] bg-current" />
        <span className="rounded-[1px] bg-current" />
      </span>
    );
  }

  if (brand === "Apple") {
    return (
      <span className="flex h-5 w-5 items-center justify-center text-slate-950">
        <AppleIcon />
      </span>
    );
  }

  if (brand === "Samsung") {
    return (
      <span className="inline-flex min-w-[54px] items-center justify-center rounded-full bg-blue-600 px-2 py-[3px] text-[7px] font-black italic tracking-[0.08em] text-white">
        SAMSUNG
      </span>
    );
  }

  if (brand === "Xiaomi") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-[5px] bg-[#ff6900] text-[8px] font-black lowercase text-white">
        mi
      </span>
    );
  }

  if (brand === "Oppo") {
    return (
      <span className="text-[10px] font-black tracking-[-0.06em] text-emerald-600">
        OPPO
      </span>
    );
  }

  if (brand === "Vivo") {
    return (
      <span className="text-[11px] font-black lowercase tracking-[-0.04em] text-blue-600">
        vivo
      </span>
    );
  }

  if (brand === "Realme") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-black lowercase tracking-[-0.03em] text-slate-950">
        <span className="h-2 w-1 rounded-full bg-yellow-400" />
        realme
      </span>
    );
  }

  if (brand === "Tecno") {
    return (
      <span className="text-[9px] font-black tracking-[0.05em] text-blue-600">
        TECNO
      </span>
    );
  }

  if (brand === "Infinix") {
    return (
      <span className="text-[10px] font-black tracking-[-0.03em] text-slate-900">
        Infinix
      </span>
    );
  }

  return null;
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
      {/* ÜST HERO - REFERANS GÖRSELLE AYNI YAPI */}
      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-white shadow-[0_10px_32px_rgba(15,23,42,0.055)]">
        {/* Başlık + sağ görsel alanı */}
        <div className="grid min-h-[116px] lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col justify-center px-6 py-5 sm:px-8">
            <span className="mb-1 text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
              CNETMOBİL V2
            </span>

            <h2 className="text-[27px] font-black tracking-[-0.045em] text-slate-950 sm:text-[31px]">
              Cep + Tablet Fiyat Listesi
            </h2>

            <p className="mt-1 max-w-[760px] text-[10px] font-semibold text-slate-400 sm:text-[11px]">
              Güncel piyasa fiyatları, kampanyalı fiyatlar ve resmi fiyatlarla tüm cep telefonu ve tablet modelleri.
            </p>
          </div>

          <div className="relative hidden overflow-hidden bg-gradient-to-r from-[#edf6ff] via-[#dcebff] to-[#b9d8ff] lg:block">
            <div className="absolute inset-y-0 left-0 w-28 bg-gradient-to-r from-white to-transparent" />

            <div className="absolute left-[17%] top-1/2 z-10 flex -translate-y-1/2 items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/70 text-blue-600 shadow-sm ring-1 ring-white/80">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 3l8 4-8 4-8-4 8-4zm8 4v10l-8 4-8-4V7m8 4v10"
                  />
                </svg>
              </div>

              <div className="text-[11px] font-black leading-[1.45] text-blue-700">
                Güçlü Stok
                <br />
                Güvenilir Fiyat
                <br />
                Cnetmobil Yanınızda
              </div>
            </div>

            {/* Telefon / tablet görselini CSS ile oluşturdum; harici resim yok */}
            <div className="absolute bottom-[-20px] right-[11%] h-[112px] w-[62px] rotate-[8deg] rounded-[14px] border-[5px] border-slate-800 bg-gradient-to-br from-blue-300 via-blue-500 to-violet-500 shadow-2xl">
              <div className="mx-auto mt-1 h-1.5 w-5 rounded-full bg-slate-800" />
              <div className="absolute bottom-3 left-2 right-2 h-8 rounded-lg bg-white/15" />
            </div>

            <div className="absolute bottom-[-24px] right-[22%] h-[104px] w-[58px] rotate-[-8deg] rounded-[13px] border-[5px] border-slate-800 bg-gradient-to-br from-slate-200 via-slate-400 to-slate-700 shadow-xl">
              <div className="absolute left-2 top-2 grid grid-cols-2 gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900 ring-1 ring-white/40" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900 ring-1 ring-white/40" />
                <span className="h-2.5 w-2.5 rounded-full bg-slate-900 ring-1 ring-white/40" />
              </div>
            </div>

            <div className="absolute bottom-[-26px] right-[2%] h-[120px] w-[84px] rotate-[4deg] rounded-[13px] border-[5px] border-slate-800 bg-gradient-to-br from-blue-100 via-blue-300 to-violet-400 shadow-xl">
              <div className="mx-auto mt-1 h-1.5 w-7 rounded-full bg-slate-800" />
            </div>
          </div>
        </div>

        {/* Alt istatistik kartları */}
        <div className="grid gap-2 border-t border-blue-50 bg-[#f8fbff] p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex min-h-[70px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <p className="mt-0.5 text-[20px] font-black leading-none text-slate-950">
                {products.length}
              </p>
              <p className="mt-1 text-[8px] font-semibold text-slate-400">
                Cep telefonu ve tablet
              </p>
            </div>

            <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 15l4-4 3 3 5-6m0 0h-4m4 0v4"
                />
              </svg>
            </div>
          </div>

          <div className="flex min-h-[70px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-900">
              <AppleIcon />
            </div>

            <div>
              <p className="text-[7px] font-black uppercase tracking-wider text-slate-400">
                Apple Ürün
              </p>
              <p className="mt-0.5 text-[20px] font-black leading-none text-slate-950">
                {appleAll.length}
              </p>
              <p className="mt-1 text-[8px] font-semibold text-slate-400">
                iPhone &amp; iPad modelleri
              </p>
            </div>

            <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 19V9m5 10V5m5 14v-7m4 7V3"
                />
              </svg>
            </div>
          </div>

          <div className="flex min-h-[70px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <AndroidIcon />
            </div>

            <div>
              <p className="text-[7px] font-black uppercase tracking-wider text-slate-400">
                Android Ürün
              </p>
              <p className="mt-0.5 text-[20px] font-black leading-none text-slate-950">
                {androidAll.length}
              </p>
              <p className="mt-1 text-[8px] font-semibold text-slate-400">
                Samsung, Xiaomi, Oppo, vb.
              </p>
            </div>

            <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 19V9m5 10V5m5 14v-7m4 7V3"
                />
              </svg>
            </div>
          </div>

          <div className="flex min-h-[70px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <p className="mt-0.5 text-[12px] font-black leading-tight text-slate-950">
                {new Intl.DateTimeFormat("tr-TR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                }).format(new Date())}
              </p>
              <p className="mt-1 text-[8px] font-semibold text-slate-400">
                CNETMOBİL • Güncel veri
              </p>
            </div>

            <div className="ml-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h5M20 20v-5h-5M5.5 18.5A8 8 0 0118 6M18.5 5.5A8 8 0 006 18"
                />
              </svg>
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
                  "flex min-h-[38px] shrink-0 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-[9px] font-black transition",
                  active
                    ? "border-blue-600 bg-blue-600 text-white shadow-md shadow-blue-600/15"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600",
                ].join(" ")}
              >
                <span className={active && item !== "Apple" && item !== "Samsung" && item !== "Xiaomi" && item !== "Oppo" && item !== "Vivo" && item !== "Realme" && item !== "Tecno" && item !== "Infinix" ? "text-white" : ""}>
                  <BrandLogo brand={item} />
                </span>
                <span>{item}</span>
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
